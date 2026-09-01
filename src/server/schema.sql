CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  avatar_url TEXT,
  access_token TEXT,
  trial_ends_at TIMESTAMPTZ,
  plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS installations (
  id BIGINT PRIMARY KEY,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_id BIGINT NOT NULL,
  suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installation_users (
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (installation_id, user_id)
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  installation_id BIGINT PRIMARY KEY REFERENCES installations (id) ON DELETE CASCADE,
  trial_ends_at TIMESTAMPTZ,
  plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repos (
  id BIGINT PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  private BOOLEAN NOT NULL,
  html_url TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ,
  last_private BOOLEAN,
  UNIQUE (installation_id, id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  delivery_id TEXT,
  installation_id BIGINT REFERENCES installations (id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('light', 'heavy')),
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_delivery_id_uidx
  ON jobs (delivery_id)
  WHERE delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_claim_idx
  ON jobs (priority, id)
  WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  repo_id BIGINT REFERENCES repos (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  findings JSONB,
  github_delivery_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_feed_idx
  ON alerts (installation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_delivery_uidx
  ON alerts (github_delivery_id)
  WHERE github_delivery_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS prospects (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('github_release', 'npm')),
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  package_name TEXT,
  release_tag TEXT,
  artifact_name TEXT NOT NULL,
  artifact_url TEXT NOT NULL UNIQUE,
  artifact_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'fixed', 'ignored')),
  scan_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (scan_status IN ('queued', 'scanning', 'complete', 'failed')),
  file_count INTEGER,
  critical_count INTEGER,
  warning_count INTEGER,
  findings JSONB,
  error TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_at TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospects_queue_idx
  ON prospects (scan_status, id);

CREATE INDEX IF NOT EXISTS prospects_action_idx
  ON prospects (status, critical_count DESC, discovered_at DESC);

CREATE TABLE IF NOT EXISTS watched_packages (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  registry_origin TEXT NOT NULL DEFAULT 'https://registry.npmjs.org',
  last_version TEXT,
  last_dist_tags JSONB,
  last_tarball_url TEXT,
  last_shasum TEXT,
  last_sha256 TEXT,
  last_checked_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  last_scan_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, package_name, registry_origin)
);

CREATE INDEX IF NOT EXISTS watched_packages_install_idx
  ON watched_packages (installation_id, package_name);

CREATE TABLE IF NOT EXISTS npm_registries (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  host TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, origin)
);

CREATE INDEX IF NOT EXISTS npm_registries_install_idx
  ON npm_registries (installation_id);

CREATE TABLE IF NOT EXISTS scan_receipts (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES watched_packages (id) ON DELETE SET NULL,
  repo_id BIGINT REFERENCES repos (id) ON DELETE SET NULL,
  coordinate TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL DEFAULT '',
  artifact_sha512 TEXT,
  artifact_bytes BIGINT,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed-policy', 'inconclusive')),
  engine_version TEXT NOT NULL,
  manifest JSONB NOT NULL,
  finding_fingerprints JSONB NOT NULL,
  signature TEXT NOT NULL,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_receipts_install_idx
  ON scan_receipts (installation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scan_receipts_package_idx
  ON scan_receipts (package_id, created_at DESC)
  WHERE package_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scan_receipts_repo_idx
  ON scan_receipts (repo_id, created_at DESC)
  WHERE repo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scan_receipts_coordinate_idx
  ON scan_receipts (installation_id, coordinate, created_at DESC);

CREATE TABLE IF NOT EXISTS policy_exceptions (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES watched_packages (id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  path_pattern TEXT,
  reason TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  actor_login TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_exceptions_active_idx
  ON policy_exceptions (installation_id, package_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS scan_baselines (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES watched_packages (id) ON DELETE CASCADE,
  repo_id BIGINT REFERENCES repos (id) ON DELETE SET NULL,
  receipt_id BIGINT NOT NULL REFERENCES scan_receipts (id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  actor_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scan_baselines_package_idx
  ON scan_baselines (package_id, created_at DESC)
  WHERE package_id IS NOT NULL AND superseded_at IS NULL;

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

CREATE TABLE IF NOT EXISTS release_revisions (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT REFERENCES watched_packages (id) ON DELETE SET NULL,
  repo_id BIGINT REFERENCES repos (id) ON DELETE SET NULL,
  receipt_id BIGINT NOT NULL REFERENCES scan_receipts (id) ON DELETE RESTRICT,
  channel TEXT NOT NULL CHECK (channel IN ('stable', 'beta', 'canary')),
  coordinate TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  artifact_sha512 TEXT,
  source_revision TEXT,
  ci_run_url TEXT,
  previous_sha256 TEXT,
  mismatch BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_revisions_feed_idx
  ON release_revisions (installation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS release_revisions_channel_idx
  ON release_revisions (installation_id, coordinate, channel, id DESC);

CREATE OR REPLACE FUNCTION reject_release_revision_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'release_revisions are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS release_revisions_no_update ON release_revisions;
CREATE TRIGGER release_revisions_no_update
  BEFORE UPDATE ON release_revisions
  FOR EACH ROW EXECUTE PROCEDURE reject_release_revision_mutation();

DROP TRIGGER IF EXISTS release_revisions_no_delete ON release_revisions;
CREATE TRIGGER release_revisions_no_delete
  BEFORE DELETE ON release_revisions
  FOR EACH ROW EXECUTE PROCEDURE reject_release_revision_mutation();

CREATE TABLE IF NOT EXISTS package_protections (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES watched_packages (id) ON DELETE CASCADE,
  verified_via TEXT NOT NULL CHECK (verified_via IN ('scope_match', 'github_repository')),
  github_repo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id)
);

CREATE INDEX IF NOT EXISTS package_protections_install_idx
  ON package_protections (installation_id);

CREATE TABLE IF NOT EXISTS package_identity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES watched_packages (id) ON DELETE CASCADE,
  version TEXT,
  maintainers JSONB NOT NULL,
  repository_url TEXT,
  homepage TEXT,
  bin_names JSONB NOT NULL,
  lifecycle_scripts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS package_identity_snapshots_pkg_idx
  ON package_identity_snapshots (package_id, id DESC);

CREATE OR REPLACE FUNCTION reject_package_identity_snapshot_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'package_identity_snapshots are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS package_identity_snapshots_no_update ON package_identity_snapshots;
CREATE TRIGGER package_identity_snapshots_no_update
  BEFORE UPDATE ON package_identity_snapshots
  FOR EACH ROW EXECUTE PROCEDURE reject_package_identity_snapshot_mutation();

DROP TRIGGER IF EXISTS package_identity_snapshots_no_delete ON package_identity_snapshots;
CREATE TRIGGER package_identity_snapshots_no_delete
  BEFORE DELETE ON package_identity_snapshots
  FOR EACH ROW EXECUTE PROCEDURE reject_package_identity_snapshot_mutation();

