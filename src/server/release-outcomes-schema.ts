import type {SqlClient} from './sql.ts';
export async function migrateReleaseOutcomes(sql:SqlClient){await sql.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
  if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_009_release_outcomes'")).rows.length)return;
  await tx.exec(`CREATE TABLE release_outcome_preferences(
    stream_id UUID PRIMARY KEY REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,revision INTEGER NOT NULL CHECK(revision>0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_009_release_outcomes')");
});}
