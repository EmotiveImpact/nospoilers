export const uploadSchema = `
CREATE TABLE IF NOT EXISTS resource_locks (name TEXT PRIMARY KEY);
INSERT INTO resource_locks(name) VALUES ('staging'),('jobs-heavy'),('jobs-light') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS uploaded_scans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id BIGINT REFERENCES installations(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  artifact_bytes BYTEA,
  artifact_sha256 TEXT NOT NULL,
  report_json JSONB,
  receipt_json JSONB,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day'
);
CREATE INDEX IF NOT EXISTS uploaded_scans_owner_idx ON uploaded_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uploaded_scans_install_idx ON uploaded_scans(installation_id, created_at DESC);
CREATE TABLE IF NOT EXISTS personal_scan_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  scans INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,day)
);
CREATE TABLE IF NOT EXISTS request_rate_buckets (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE uploaded_scans ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS token_id BIGINT REFERENCES scan_api_tokens(id) ON DELETE SET NULL;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS submission_meta JSONB NOT NULL DEFAULT '{}';
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS receipt_id BIGINT REFERENCES scan_receipts(id) ON DELETE SET NULL;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS revision_id BIGINT REFERENCES release_revisions(id) ON DELETE SET NULL;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS usage_refunded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE installation_users DROP CONSTRAINT IF EXISTS installation_users_role_check;
ALTER TABLE installation_users ADD CONSTRAINT installation_users_role_check CHECK (role IN ('admin','member','viewer'));
ALTER TABLE installation_invites DROP CONSTRAINT IF EXISTS installation_invites_role_check;
ALTER TABLE installation_invites ADD CONSTRAINT installation_invites_role_check CHECK (role IN ('admin','member','viewer'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS usage_reserved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS usage_day DATE;
CREATE OR REPLACE FUNCTION guard_completed_upload() RETURNS trigger AS $$
BEGIN
  IF OLD.status='done' AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.report_json IS DISTINCT FROM OLD.report_json OR
    NEW.receipt_json IS DISTINCT FROM OLD.receipt_json OR NEW.artifact_sha256 IS DISTINCT FROM OLD.artifact_sha256 OR
    NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.installation_id IS DISTINCT FROM OLD.installation_id OR
    NEW.target IS DISTINCT FROM OLD.target OR NEW.submission_meta IS DISTINCT FROM OLD.submission_meta
  ) THEN RAISE EXCEPTION 'Completed scan evidence is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS completed_upload_immutable ON uploaded_scans;
CREATE TRIGGER completed_upload_immutable BEFORE UPDATE ON uploaded_scans FOR EACH ROW EXECUTE FUNCTION guard_completed_upload();
`;
