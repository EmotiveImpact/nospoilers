import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type QueryResult<T> = { rows: T[] };

export type SqlClient = {
  query: <T>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  exec: (text: string) => Promise<void>;
  transaction: <T>(fn: (sql: SqlClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

function wrapPglite(db: PGlite): SqlClient {
  const run = (target: PGlite) =>
    async <T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> => {
      const result = await target.query<T>(text, params);
      return { rows: result.rows ?? [] };
    };

  return {
    query: run(db),
    async exec(text: string) {
      await db.exec(text);
    },
    async transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
      return await db.transaction(async (tx) => {
        const inner: SqlClient = {
          query: async <R>(text: string, params: unknown[] = []) => {
            const result = await tx.query<R>(text, params);
            return { rows: result.rows ?? [] };
          },
          exec: async (text: string) => {
            await tx.exec(text);
          },
          transaction: async (nested) => nested(inner),
          close: async () => undefined,
        };
        return await fn(inner);
      });
    },
    async close() {
      await db.close();
    },
  };
}

function wrapPool(pool: pg.Pool): SqlClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const result = await pool.query(text, params);
      return { rows: result.rows as T[] };
    },
    async exec(text: string) {
      await pool.query(text);
    },
    async transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inner: SqlClient = {
          async query<R>(text: string, params: unknown[] = []) {
            const result = await client.query(text, params);
            return { rows: result.rows as R[] };
          },
          exec: async (text: string) => {
            await client.query(text);
          },
          transaction: async (nested) => nested(inner),
          close: async () => undefined,
        };
        const value = await fn(inner);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export type DatabaseDriver = "pglite" | "neon" | "postgres";

export type DatabaseIdentity = {
  driver: DatabaseDriver;
  host: string | null;
  database: string | null;
};

export function describeDatabaseUrl(databaseUrl: string): DatabaseIdentity {
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    const loc = databaseUrl.replace(/^pglite:\/\//, "") || "./data/nospoilers";
    return { driver: "pglite", host: loc, database: null };
  }
  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname || null;
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null;
    const driver: DatabaseDriver = (host ?? "").includes("neon.tech") ? "neon" : "postgres";
    return { driver, host, database };
  } catch {
    return { driver: "postgres", host: null, database: null };
  }
}

export function splitSql(script: string): string[] {
  return script
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .map((line) => (line.trimStart().startsWith("--") ? "" : line))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

function postgresPoolConfig(databaseUrl: string): pg.PoolConfig {
  const identity = describeDatabaseUrl(databaseUrl);
  return {
    connectionString: databaseUrl,
    max: 8,
    ssl:
      identity.driver === "neon"
        ? {
            rejectUnauthorized: true,
          }
        : undefined,
  };
}

export async function openSql(databaseUrl: string): Promise<SqlClient> {
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    const loc = databaseUrl.replace(/^pglite:\/\//, "") || "./data/nospoilers";
    const db =
      loc === ":memory:" || loc === "memory"
        ? new PGlite()
        : await (async () => {
            const abs = path.resolve(loc);
            await mkdir(path.dirname(abs), { recursive: true });
            return new PGlite(abs);
          })();
    await db.waitReady;
    return wrapPglite(db);
  }
  const pool = new pg.Pool(postgresPoolConfig(databaseUrl));
  return wrapPool(pool);
}

export async function migrate(sql: SqlClient): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(here, "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  for (const statement of splitSql(schema)) {
    await sql.exec(statement);
  }
  await sql.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ");
  await sql.exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT");
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "001_init",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "002_coverage",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "003_prospects",
  ]);
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value);
}
