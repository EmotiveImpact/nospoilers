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
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return wrapPool(pool);
}

export async function migrate(sql: SqlClient): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(here, "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await sql.exec(schema);
  await sql.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "001_init",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "002_coverage",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "003_prospects",
  ]);
  const { rows: missingBilling } = await sql.query<{ id: string }>(
    `SELECT i.id::text AS id
     FROM installations i
     LEFT JOIN billing_accounts b ON b.installation_id = i.id
     WHERE b.installation_id IS NULL`,
  );
  for (const row of missingBilling) {
    const installationId = Number(row.id);
    const { rows: fromUser } = await sql.query<{
      trial_ends_at: string | Date | null;
      plan: string | null;
    }>(
      `SELECT u.trial_ends_at, u.plan
       FROM installation_users iu
       JOIN users u ON u.id = iu.user_id
       WHERE iu.installation_id = $1
       ORDER BY CASE WHEN u.plan IN ('solo', 'team') THEN 0 ELSE 1 END,
                u.trial_ends_at DESC NULLS LAST
       LIMIT 1`,
      [installationId],
    );
    const trial = fromUser[0]?.trial_ends_at;
    await sql.query(
      `INSERT INTO billing_accounts (installation_id, trial_ends_at, plan)
       VALUES ($1, COALESCE($2::timestamptz, now() + interval '14 days'), $3)
       ON CONFLICT (installation_id) DO NOTHING`,
      [
        installationId,
        trial instanceof Date ? trial.toISOString() : (trial ?? null),
        fromUser[0]?.plan ?? "trial",
      ],
    );
  }
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "004_billing_accounts",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "005_watched_packages",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "006_scan_receipts",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "007_policy_exceptions",
  ]);
  await sql.exec(`
    ALTER TABLE watched_packages ADD COLUMN IF NOT EXISTS registry_origin TEXT NOT NULL DEFAULT 'https://registry.npmjs.org';
    ALTER TABLE watched_packages DROP CONSTRAINT IF EXISTS watched_packages_installation_id_package_name_key;
    CREATE UNIQUE INDEX IF NOT EXISTS watched_packages_install_name_registry_uidx
      ON watched_packages (installation_id, package_name, registry_origin);
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "008_npm_registries",
  ]);
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS scan_api_tokens (
      id BIGSERIAL PRIMARY KEY,
      installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_by_login TEXT NOT NULL,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS scan_api_tokens_install_idx
      ON scan_api_tokens (installation_id)
      WHERE revoked_at IS NULL;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "009_scan_api_tokens",
  ]);
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value);
}
