import { databaseMode, loadConfig } from "../src/server/config.ts";
import { migrate, openSql } from "../src/server/sql.ts";

const marker = `phase0-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const config = loadConfig();
const mode = databaseMode(config.databaseUrl);
if (mode !== "neon") {
  throw new Error(`Expected Neon runtime, got ${mode}`);
}

const sql = await openSql(config.databaseUrl);
try {
  await migrate(sql);
  const identity = await sql.query<{ db: string }>("SELECT current_database() AS db");
  const db = identity.rows[0]?.db;
  if (db !== "neondb") {
    throw new Error(`Expected database neondb, got ${db ?? "unknown"}`);
  }

  await sql.transaction(async (tx) => {
    await tx.exec("CREATE TEMP TABLE runtime_probe (id TEXT PRIMARY KEY)");
    await tx.query("INSERT INTO runtime_probe (id) VALUES ($1)", [marker]);
    const read = await tx.query<{ id: string }>("SELECT id FROM runtime_probe WHERE id = $1", [
      marker,
    ]);
    if (read.rows[0]?.id !== marker) {
      throw new Error("Probe row was not readable after insert.");
    }
    await tx.query("DELETE FROM runtime_probe WHERE id = $1", [marker]);
    const gone = await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM runtime_probe");
    if (Number(gone.rows[0]?.n) !== 0) {
      throw new Error("Probe row was not deleted.");
    }
  });

  const leftover = await sql.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM schema_migrations WHERE id LIKE $1",
    [`phase0-%`],
  );
  if (Number(leftover.rows[0]?.n) !== 0) {
    throw new Error("Probe leaked into schema_migrations.");
  }

  console.log(
    JSON.stringify({
      ok: true,
      database: { mode, name: db },
      probe: "write-read-delete",
      pgliteImported: false,
    }),
  );
} finally {
  await sql.close();
}
