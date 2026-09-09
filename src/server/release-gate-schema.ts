import type {SqlClient} from './sql.ts';
export async function migrateReleaseGate(sql:SqlClient){await sql.transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock($1)',[1857679437]);
  if((await tx.query("SELECT id FROM schema_migrations WHERE id='ra_005_release_gate'")).rows.length)return;
  await tx.exec(`CREATE TABLE release_gate_policies (
    id UUID PRIMARY KEY,stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK(revision>0),mode TEXT NOT NULL CHECK(mode IN ('advisory','warn','enforce')),
    max_age_hours INTEGER NOT NULL CHECK(max_age_hours BETWEEN 1 AND 168),rollback_from INTEGER,
    reason TEXT NOT NULL,actor_login TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(stream_id,revision)
  );
  CREATE TABLE release_gate_decisions (
    id UUID PRIMARY KEY,request_key UUID NOT NULL UNIQUE,
    stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
    record_kind TEXT NOT NULL CHECK(record_kind IN ('upload','release')),record_id TEXT NOT NULL,
    upload_id TEXT REFERENCES uploaded_scans(id) ON DELETE CASCADE,release_id BIGINT REFERENCES release_revisions(id) ON DELETE CASCADE,
    digest TEXT NOT NULL,receipt_fingerprint TEXT,policy_revision INTEGER NOT NULL,mode TEXT NOT NULL,
    deployment_id TEXT NOT NULL,result JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),expires_at TIMESTAMPTZ NOT NULL,
    CHECK((record_kind='upload' AND upload_id=record_id AND upload_id IS NOT NULL AND release_id IS NULL)
      OR (record_kind='release' AND release_id::text=record_id AND release_id IS NOT NULL AND upload_id IS NULL))
  );
  CREATE TABLE release_gate_overrides (
    id UUID PRIMARY KEY,decision_id UUID NOT NULL UNIQUE REFERENCES release_gate_decisions(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,actor_login TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE release_gate_consumptions (
    id UUID PRIMARY KEY,decision_id UUID NOT NULL UNIQUE REFERENCES release_gate_decisions(id) ON DELETE CASCADE,
    result JSONB NOT NULL,actor_login TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX release_gate_recent ON release_gate_decisions(stream_id,created_at DESC);
  CREATE TRIGGER release_gate_policy_immutable BEFORE UPDATE OR DELETE ON release_gate_policies FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
  CREATE TRIGGER release_gate_decision_immutable BEFORE UPDATE OR DELETE ON release_gate_decisions FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
  CREATE TRIGGER release_gate_override_immutable BEFORE UPDATE OR DELETE ON release_gate_overrides FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
  CREATE TRIGGER release_gate_consumption_immutable BEFORE UPDATE OR DELETE ON release_gate_consumptions FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();`);
  await tx.query("INSERT INTO schema_migrations(id) VALUES('ra_005_release_gate')");
});}
