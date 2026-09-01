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
  last_version TEXT,
  last_dist_tags JSONB,
  last_tarball_url TEXT,
  last_shasum TEXT,
  last_sha256 TEXT,
  last_checked_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  last_scan_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, package_name)
);

CREATE INDEX IF NOT EXISTS watched_packages_install_idx
  ON watched_packages (installation_id, package_name);

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

