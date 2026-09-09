import type { SqlClient } from './sql.ts';
import {migrateAutomaticCapture} from './automatic-capture-schema.ts';
import {migrateProductionParity} from './production-parity-schema.ts';
import {migrateReleaseGate} from './release-gate-schema.ts';
import {migrateReleaseGateAccess} from './release-gate-access-schema.ts';
import {migrateReleaseRemediation} from './release-remediation-schema.ts';
import {migrateAgentAccess} from './agent-access-schema.ts';
export const INTELLIGENCE_MIGRATION = 'ra_002_release_intelligence';
export const intelligenceSchema = `
CREATE TABLE IF NOT EXISTS release_intelligence_streams (
 id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 stream_key TEXT NOT NULL CHECK(stream_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
 artifact_role TEXT NOT NULL CHECK(length(artifact_role) BETWEEN 1 AND 80),
 source_binding TEXT NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('stable','beta','canary')),
 format TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 archived_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,stream_key), UNIQUE(id,workspace_id)
);
CREATE TABLE IF NOT EXISTS release_intelligence_snapshots (
 id UUID PRIMARY KEY, stream_id UUID NOT NULL, workspace_id UUID NOT NULL,
 record_kind TEXT NOT NULL CHECK(record_kind IN ('upload','release')), record_id TEXT NOT NULL,
 upload_id TEXT REFERENCES uploaded_scans(id) ON DELETE CASCADE,
 release_id BIGINT REFERENCES release_revisions(id) ON DELETE CASCADE,
 digest TEXT NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 receipt_fingerprint TEXT NOT NULL CHECK(receipt_fingerprint ~ '^[a-f0-9]{64}$'),
 scanned_at TIMESTAMPTZ NOT NULL, metrics JSONB NOT NULL, analysis_summary JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(stream_id,workspace_id) REFERENCES release_intelligence_streams(id,workspace_id) ON DELETE CASCADE,
 CHECK((record_kind='upload' AND upload_id IS NOT NULL AND upload_id=record_id AND release_id IS NULL)
 OR (record_kind='release' AND release_id IS NOT NULL AND release_id::text=record_id AND upload_id IS NULL)),
 UNIQUE(stream_id,record_kind,record_id), UNIQUE(id,stream_id)
);
CREATE INDEX IF NOT EXISTS release_intelligence_history_idx ON release_intelligence_snapshots(stream_id,scanned_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS release_intelligence_baselines (
 id UUID PRIMARY KEY, stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0), action TEXT NOT NULL CHECK(action IN ('adopt','revoke')),
 snapshot_ref UUID, digest TEXT, reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 1000),
 actor_login TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((action='adopt' AND snapshot_ref IS NOT NULL AND digest IS NOT NULL AND digest ~ '^[a-f0-9]{64}$') OR (action='revoke' AND snapshot_ref IS NULL AND digest IS NULL)),
 UNIQUE(stream_id,revision)
);
CREATE TABLE IF NOT EXISTS release_intelligence_exclusions (
 id UUID PRIMARY KEY, stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
 snapshot_ref UUID NOT NULL, revision INTEGER NOT NULL, excluded BOOLEAN NOT NULL,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 1000), actor_login TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(stream_id,revision)
);
CREATE TABLE IF NOT EXISTS release_intelligence_events (
 id UUID PRIMARY KEY, stream_id UUID NOT NULL REFERENCES release_intelligence_streams(id) ON DELETE CASCADE,
 action TEXT NOT NULL, actor_login TEXT NOT NULL, detail JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION guard_intelligence_stream_identity() RETURNS trigger AS $$
BEGIN
 IF ROW(NEW.id,NEW.workspace_id,NEW.stream_key,NEW.artifact_role,NEW.source_binding,NEW.channel,NEW.format)
 IS DISTINCT FROM ROW(OLD.id,OLD.workspace_id,OLD.stream_key,OLD.artifact_role,OLD.source_binding,OLD.channel,OLD.format)
 THEN RAISE EXCEPTION 'Release stream identity is immutable'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS release_intelligence_stream_identity ON release_intelligence_streams;
CREATE TRIGGER release_intelligence_stream_identity BEFORE UPDATE ON release_intelligence_streams FOR EACH ROW EXECUTE FUNCTION guard_intelligence_stream_identity();
CREATE OR REPLACE FUNCTION reject_intelligence_evidence_mutation() RETURNS trigger AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Release intelligence evidence is immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS release_intelligence_snapshot_immutable ON release_intelligence_snapshots;
CREATE TRIGGER release_intelligence_snapshot_immutable BEFORE UPDATE OR DELETE ON release_intelligence_snapshots FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
DROP TRIGGER IF EXISTS release_intelligence_baseline_immutable ON release_intelligence_baselines;
CREATE TRIGGER release_intelligence_baseline_immutable BEFORE UPDATE OR DELETE ON release_intelligence_baselines FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
DROP TRIGGER IF EXISTS release_intelligence_exclusion_immutable ON release_intelligence_exclusions;
CREATE TRIGGER release_intelligence_exclusion_immutable BEFORE UPDATE OR DELETE ON release_intelligence_exclusions FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
DROP TRIGGER IF EXISTS release_intelligence_event_immutable ON release_intelligence_events;
CREATE TRIGGER release_intelligence_event_immutable BEFORE UPDATE OR DELETE ON release_intelligence_events FOR EACH ROW EXECUTE FUNCTION reject_intelligence_evidence_mutation();
`;
/** Adds its own marker without replacing the existing linear migration chain. */
export async function migrateReleaseIntelligence(sql: SqlClient): Promise<void> {
  if (!(await sql.query('SELECT id FROM schema_migrations WHERE id=$1', [INTELLIGENCE_MIGRATION])).rows.length) await sql.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [1857679437]);
    if ((await tx.query('SELECT id FROM schema_migrations WHERE id=$1', [INTELLIGENCE_MIGRATION])).rows.length) return;
    await tx.exec(intelligenceSchema);
    await tx.query('INSERT INTO schema_migrations(id) VALUES($1)', [INTELLIGENCE_MIGRATION]);
  });
  await migrateAutomaticCapture(sql);
  await migrateProductionParity(sql);
  await migrateReleaseGate(sql);
  await migrateReleaseGateAccess(sql);
  await migrateReleaseRemediation(sql);
  await migrateAgentAccess(sql);
}
