import type {SqlClient} from './sql.ts';
export async function migrateReleaseRemediation(sql:SqlClient){await sql.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
  if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_007_remediation'")).rows.length)return;
  await tx.exec(`CREATE TABLE release_remediation_cases(
    id UUID PRIMARY KEY,stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
    original_snapshot UUID NOT NULL,finding TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY(original_snapshot,stream_id) REFERENCES release_intelligence_snapshots(id,stream_id) ON DELETE CASCADE,
    UNIQUE(stream_id,original_snapshot,finding)
  );
  CREATE TABLE release_remediation_events(
    id UUID PRIMARY KEY,case_id UUID NOT NULL REFERENCES release_remediation_cases(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,action TEXT NOT NULL CHECK(action IN ('investigate','review','verify','reopen')),
    actor_login TEXT NOT NULL,detail JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(case_id,revision)
  );
  CREATE TRIGGER remediation_event_immutable BEFORE UPDATE OR DELETE ON release_remediation_events
    FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
  CREATE FUNCTION guard_remediation_identity() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF ROW(NEW.id,NEW.stream_id,NEW.original_snapshot,NEW.finding,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.stream_id,OLD.original_snapshot,OLD.finding,OLD.created_at)
    THEN RAISE EXCEPTION 'Remediation identity is immutable'; END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER remediation_identity BEFORE UPDATE ON release_remediation_cases FOR EACH ROW EXECUTE FUNCTION guard_remediation_identity();`);
  await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_007_remediation')");
});}
