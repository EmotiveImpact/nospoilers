import type {SqlClient} from './sql.ts';
export const AUTOMATIC_CAPTURE_MIGRATION='ra_003_automatic_capture';
export async function migrateAutomaticCapture(sql:SqlClient){
  await sql.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
    if((await tx.query('SELECT id FROM schema_migrations WHERE id=$1',[AUTOMATIC_CAPTURE_MIGRATION])).rows.length)return;
    await tx.exec(`
      CREATE TABLE release_intelligence_capture_rules (
        stream_id UUID PRIMARY KEY REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT false, revision INTEGER NOT NULL CHECK(revision>0),
        actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        selector TEXT NOT NULL, connection_generation TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE release_intelligence_capture_attempts (
        id UUID PRIMARY KEY, stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
        rule_revision INTEGER NOT NULL, record_kind TEXT NOT NULL CHECK(record_kind IN ('release','upload')),
        record_id TEXT NOT NULL, release_id BIGINT REFERENCES release_revisions(id) ON DELETE CASCADE,
        upload_id TEXT REFERENCES uploaded_scans(id) ON DELETE CASCADE,
        job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','captured','stopped','failed')),
        outcome TEXT, snapshot_id UUID REFERENCES release_intelligence_snapshots(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK((record_kind='release' AND release_id IS NOT NULL AND release_id::text=record_id AND upload_id IS NULL)
          OR (record_kind='upload' AND upload_id IS NOT NULL AND upload_id=record_id AND release_id IS NULL)),
        UNIQUE(stream_id,rule_revision,record_kind,record_id)
      );
      CREATE INDEX release_capture_recent ON release_intelligence_capture_attempts(stream_id,created_at DESC);
    `);
    await tx.query('INSERT INTO schema_migrations(id) VALUES($1)',[AUTOMATIC_CAPTURE_MIGRATION]);
  });
}
