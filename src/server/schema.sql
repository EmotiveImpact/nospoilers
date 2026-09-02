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
  last_permission_test_at TIMESTAMPTZ,
  last_permission_test JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installation_users (
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  CONSTRAINT installation_users_role_check CHECK (role IN ('member', 'admin')),
  PRIMARY KEY (installation_id, user_id)
);

CREATE TABLE IF NOT EXISTS installation_invites (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  github_login TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, github_login)
);

CREATE INDEX IF NOT EXISTS installation_invites_install_idx
  ON installation_invites (installation_id);

CREATE TABLE IF NOT EXISTS billing_accounts (
  installation_id BIGINT PRIMARY KEY REFERENCES installations (id) ON DELETE CASCADE,
  trial_ends_at TIMESTAMPTZ,
  plan TEXT,
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days IN (0, 90, 180, 365)),
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

CREATE INDEX IF NOT EXISTS jobs_running_heavy_install_idx
  ON jobs (installation_id)
  WHERE status = 'running' AND priority = 'heavy';

CREATE TABLE IF NOT EXISTS hosted_usage_days (
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  day DATE NOT NULL,
  heavy_jobs INTEGER NOT NULL DEFAULT 0 CHECK (heavy_jobs >= 0),
  PRIMARY KEY (installation_id, day)
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  repo_id BIGINT REFERENCES repos (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  findings JSONB,
  github_delivery_id TEXT,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_login TEXT,
  assigned_to_login TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_login TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_feed_idx
  ON alerts (installation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_delivery_uidx
  ON alerts (github_delivery_id)
  WHERE github_delivery_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS alert_events (
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  actor_login TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('acknowledged', 'assigned', 'resolved', 'reopened', 'note')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_events_alert_idx
  ON alert_events (alert_id, id);

CREATE OR REPLACE FUNCTION reject_alert_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'alert_events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alert_events_no_update ON alert_events;
CREATE TRIGGER alert_events_no_update
  BEFORE UPDATE ON alert_events
  FOR EACH ROW EXECUTE PROCEDURE reject_alert_event_mutation();
DROP TRIGGER IF EXISTS alert_events_no_delete ON alert_events;
CREATE TRIGGER alert_events_no_delete
  BEFORE DELETE ON alert_events
  FOR EACH ROW EXECUTE PROCEDURE reject_alert_event_mutation();

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
  artifact_sha256 TEXT,
  artifact_sha512 TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'fixed', 'ignored')),
  scan_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (scan_status IN ('queued', 'scanning', 'complete', 'failed')),
  file_count INTEGER,
  critical_count INTEGER,
  warning_count INTEGER,
  findings JSONB,
  workspace_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_at TIMESTAMPTZ,
  contacted_at TIMESTAMPTZ,
  feed_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospects_queue_idx
  ON prospects (scan_status, id);

CREATE INDEX IF NOT EXISTS prospects_action_idx
  ON prospects (status, critical_count DESC, discovered_at DESC);

CREATE TABLE IF NOT EXISTS discovery_campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  last_ran_at TIMESTAMPTZ,
  last_repositories INTEGER,
  last_queued INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discovery_campaigns_query_uidx
  ON discovery_campaigns (lower(query));
CREATE INDEX IF NOT EXISTS discovery_campaigns_next_idx
  ON discovery_campaigns (enabled, last_ran_at ASC NULLS FIRST, id ASC);

CREATE TABLE IF NOT EXISTS disclosure_cases (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES prospects (id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'signal'
    CHECK (state IN ('signal', 'verifying', 'verified', 'false_positive', 'duplicate')),
  checklist_public_artifact BOOLEAN NOT NULL DEFAULT FALSE,
  checklist_reproduced BOOLEAN NOT NULL DEFAULT FALSE,
  checklist_fingerprints_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  checklist_no_secret_values BOOLEAN NOT NULL DEFAULT FALSE,
  checklist_contact_or_policy BOOLEAN NOT NULL DEFAULT FALSE,
  reproducibility_steps TEXT,
  fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
  finding_category TEXT
    CHECK (finding_category IS NULL OR finding_category IN (
      'sourcemap', 'environment', 'credential', 'source', 'git', 'archive',
      'backup', 'database', 'crash', 'document', 'agent', 'debug', 'network',
      'size', 'other'
    )),
  security_contact TEXT,
  policy_url TEXT,
  notes_ciphertext TEXT,
  notes_expires_at TIMESTAMPTZ,
  draft_subject TEXT,
  draft_body TEXT,
  draft_sent BOOLEAN NOT NULL DEFAULT FALSE CHECK (draft_sent = FALSE),
  acknowledgement_note TEXT,
  acknowledged_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  conversion TEXT NOT NULL DEFAULT 'none'
    CHECK (conversion IN ('none', 'trial', 'paid', 'declined')),
  fix_version TEXT,
  last_rescan_at TIMESTAMPTZ,
  vendor_channel TEXT
    CHECK (vendor_channel IS NULL OR vendor_channel IN (
      'security_email', 'form', 'security_txt', 'platform'
    )),
  outcome_credit TEXT,
  outcome_cve TEXT,
  outcome_notes TEXT,
  assignee TEXT,
  review_state TEXT NOT NULL DEFAULT 'none'
    CHECK (review_state IN ('none', 'pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disclosure_cases_state_idx
  ON disclosure_cases (state, updated_at DESC);

CREATE TABLE IF NOT EXISTS disclosure_events (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disclosure_events_case_idx
  ON disclosure_events (case_id, id ASC);

CREATE OR REPLACE FUNCTION reject_disclosure_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'disclosure_events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disclosure_events_no_update ON disclosure_events;
CREATE TRIGGER disclosure_events_no_update
  BEFORE UPDATE ON disclosure_events
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_event_mutation();
DROP TRIGGER IF EXISTS disclosure_events_no_delete ON disclosure_events;
CREATE TRIGGER disclosure_events_no_delete
  BEFORE DELETE ON disclosure_events
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_event_mutation();

CREATE TABLE IF NOT EXISTS disclosure_duplicate_links (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  other_case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  reasons JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (case_id <> other_case_id),
  UNIQUE (case_id, other_case_id)
);

CREATE INDEX IF NOT EXISTS disclosure_duplicate_links_case_idx
  ON disclosure_duplicate_links (case_id, id ASC);
CREATE INDEX IF NOT EXISTS disclosure_duplicate_links_other_idx
  ON disclosure_duplicate_links (other_case_id, id ASC);

CREATE OR REPLACE FUNCTION reject_disclosure_duplicate_link_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'disclosure_duplicate_links are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disclosure_duplicate_links_no_update ON disclosure_duplicate_links;
CREATE TRIGGER disclosure_duplicate_links_no_update
  BEFORE UPDATE ON disclosure_duplicate_links
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_duplicate_link_mutation();
DROP TRIGGER IF EXISTS disclosure_duplicate_links_no_delete ON disclosure_duplicate_links;
CREATE TRIGGER disclosure_duplicate_links_no_delete
  BEFORE DELETE ON disclosure_duplicate_links
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_duplicate_link_mutation();

CREATE TABLE IF NOT EXISTS disclosure_vendor_replies (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'security_email', 'form', 'security_txt', 'platform', 'other'
  )),
  summary TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disclosure_vendor_replies_case_idx
  ON disclosure_vendor_replies (case_id, id ASC);

CREATE OR REPLACE FUNCTION reject_disclosure_reply_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'disclosure_vendor_replies are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disclosure_vendor_replies_no_update ON disclosure_vendor_replies;
CREATE TRIGGER disclosure_vendor_replies_no_update
  BEFORE UPDATE ON disclosure_vendor_replies
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_reply_mutation();
DROP TRIGGER IF EXISTS disclosure_vendor_replies_no_delete ON disclosure_vendor_replies;
CREATE TRIGGER disclosure_vendor_replies_no_delete
  BEFORE DELETE ON disclosure_vendor_replies
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_reply_mutation();

CREATE TABLE IF NOT EXISTS disclosure_attachments (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disclosure_attachments_case_idx
  ON disclosure_attachments (case_id, id ASC);
CREATE INDEX IF NOT EXISTS disclosure_attachments_expiry_idx
  ON disclosure_attachments (expires_at)
  WHERE ciphertext <> '';

CREATE OR REPLACE FUNCTION reject_disclosure_attachment_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.ciphertext = ''
      AND OLD.ciphertext <> ''
      AND OLD.expires_at <= now()
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.case_id IS NOT DISTINCT FROM OLD.case_id
      AND NEW.filename IS NOT DISTINCT FROM OLD.filename
      AND NEW.media_type IS NOT DISTINCT FROM OLD.media_type
      AND NEW.byte_length IS NOT DISTINCT FROM OLD.byte_length
      AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
      AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'disclosure_attachments are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disclosure_attachments_no_update ON disclosure_attachments;
CREATE TRIGGER disclosure_attachments_no_update
  BEFORE UPDATE ON disclosure_attachments
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_attachment_mutation();
DROP TRIGGER IF EXISTS disclosure_attachments_no_delete ON disclosure_attachments;
CREATE TRIGGER disclosure_attachments_no_delete
  BEFORE DELETE ON disclosure_attachments
  FOR EACH ROW EXECUTE PROCEDURE reject_disclosure_attachment_mutation();

CREATE TABLE IF NOT EXISTS disclosure_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disclosure_do_not_contact (
  id BIGSERIAL PRIMARY KEY,
  owner TEXT,
  repo TEXT,
  package_name TEXT,
  contact TEXT,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (owner IS NOT NULL AND repo IS NOT NULL)
    OR package_name IS NOT NULL
    OR contact IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS disclosure_dnc_owner_repo_idx
  ON disclosure_do_not_contact (lower(owner), lower(repo))
  WHERE owner IS NOT NULL AND repo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS disclosure_dnc_package_idx
  ON disclosure_do_not_contact (lower(package_name))
  WHERE package_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS disclosure_dnc_contact_idx
  ON disclosure_do_not_contact (lower(contact))
  WHERE contact IS NOT NULL;

CREATE TABLE IF NOT EXISTS internal_notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('verified_critical', 'deadline_missed')),
  prospect_id BIGINT NOT NULL REFERENCES prospects (id) ON DELETE CASCADE,
  case_id BIGINT NOT NULL REFERENCES disclosure_cases (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, kind)
);

CREATE INDEX IF NOT EXISTS internal_notifications_unread_idx
  ON internal_notifications (read_at NULLS FIRST, created_at DESC, id DESC);

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
  last_debug_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_release TEXT,
  last_public_map BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, package_name, registry_origin)
);

CREATE INDEX IF NOT EXISTS watched_packages_install_idx
  ON watched_packages (installation_id, package_name);

CREATE TABLE IF NOT EXISTS watched_origins (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  origin_url TEXT NOT NULL,
  host TEXT NOT NULL,
  last_sha256 TEXT,
  last_checked_at TIMESTAMPTZ,
  last_scanned_at TIMESTAMPTZ,
  last_scan_status TEXT,
  last_debug_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_release TEXT,
  last_public_map BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, origin_url)
);

CREATE INDEX IF NOT EXISTS watched_origins_install_idx
  ON watched_origins (installation_id, origin_url);

CREATE TABLE IF NOT EXISTS map_destinations (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('sentry', 'bugsnag')),
  host TEXT NOT NULL,
  org_slug TEXT,
  project_slug TEXT NOT NULL,
  token_ciphertext TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, kind)
);

CREATE INDEX IF NOT EXISTS map_destinations_install_idx
  ON map_destinations (installation_id);

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

CREATE TABLE IF NOT EXISTS notification_destinations (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty')),
  host TEXT NOT NULL,
  project_key TEXT,
  webhook_ciphertext TEXT NOT NULL,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status TEXT,
  last_delivery_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (installation_id, kind)
);

CREATE INDEX IF NOT EXISTS notification_destinations_install_idx
  ON notification_destinations (installation_id);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  destination_id BIGINT REFERENCES notification_destinations (id) ON DELETE SET NULL,
  alert_id BIGINT REFERENCES alerts (id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  invented_incident BOOLEAN NOT NULL DEFAULT false CHECK (invented_incident = false),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_install_idx
  ON notification_deliveries (installation_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_notification_delivery_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.destination_id IS NULL
      AND OLD.destination_id IS NOT NULL
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.installation_id IS NOT DISTINCT FROM OLD.installation_id
      AND NEW.alert_id IS NOT DISTINCT FROM OLD.alert_id
      AND NEW.kind IS NOT DISTINCT FROM OLD.kind
      AND NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.invented_incident IS NOT DISTINCT FROM OLD.invented_incident
      AND NEW.error IS NOT DISTINCT FROM OLD.error
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'notification_deliveries are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_deliveries_no_update ON notification_deliveries;
CREATE TRIGGER notification_deliveries_no_update
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW EXECUTE PROCEDURE reject_notification_delivery_mutation();
DROP TRIGGER IF EXISTS notification_deliveries_no_delete ON notification_deliveries;
CREATE TRIGGER notification_deliveries_no_delete
  BEFORE DELETE ON notification_deliveries
  FOR EACH ROW EXECUTE PROCEDURE reject_notification_delivery_mutation();

CREATE TABLE IF NOT EXISTS notification_routes (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  destination_id BIGINT NOT NULL REFERENCES notification_destinations (id) ON DELETE CASCADE,
  min_severity TEXT NOT NULL DEFAULT 'all' CHECK (min_severity IN ('all', 'warn', 'critical')),
  repo_full_name TEXT,
  package_name TEXT,
  team_login TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_routes_install_idx
  ON notification_routes (installation_id, destination_id);

CREATE UNIQUE INDEX IF NOT EXISTS notification_routes_uniq
  ON notification_routes (
    installation_id,
    destination_id,
    min_severity,
    COALESCE(lower(repo_full_name), ''),
    COALESCE(package_name, ''),
    COALESCE(lower(team_login), '')
  );

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
  artifact_bytes BIGINT,
  media_type TEXT,
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

CREATE TABLE IF NOT EXISTS release_delivery_locations (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES release_revisions (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  expected_media_type TEXT,
  created_by_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (revision_id, url)
);

CREATE INDEX IF NOT EXISTS release_delivery_locations_install_idx
  ON release_delivery_locations (installation_id, id DESC);

CREATE INDEX IF NOT EXISTS release_delivery_locations_revision_idx
  ON release_delivery_locations (revision_id, id ASC);

CREATE TABLE IF NOT EXISTS release_delivery_verifications (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  location_id BIGINT NOT NULL REFERENCES release_delivery_locations (id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES release_revisions (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (
    'matched', 'mismatch', 'missing', 'redirect', 'content_type', 'blocked', 'error'
  )),
  observed_sha256 TEXT,
  observed_sha512 TEXT,
  observed_bytes BIGINT,
  observed_media_type TEXT,
  final_host TEXT,
  redirect_count INTEGER NOT NULL DEFAULT 0,
  redirect_hosts TEXT,
  cache_state TEXT,
  delivery_region TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_delivery_verifications_location_idx
  ON release_delivery_verifications (location_id, id DESC);

CREATE OR REPLACE FUNCTION reject_delivery_verification_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'release_delivery_verifications are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS release_delivery_verifications_no_update ON release_delivery_verifications;
CREATE TRIGGER release_delivery_verifications_no_update
  BEFORE UPDATE ON release_delivery_verifications
  FOR EACH ROW EXECUTE PROCEDURE reject_delivery_verification_mutation();

DROP TRIGGER IF EXISTS release_delivery_verifications_no_delete ON release_delivery_verifications;
CREATE TRIGGER release_delivery_verifications_no_delete
  BEFORE DELETE ON release_delivery_verifications
  FOR EACH ROW EXECUTE PROCEDURE reject_delivery_verification_mutation();

CREATE TABLE IF NOT EXISTS release_approvals (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES release_revisions (id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT NOT NULL,
  actor_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_approvals_revision_idx
  ON release_approvals (revision_id, id DESC);

CREATE INDEX IF NOT EXISTS release_approvals_install_idx
  ON release_approvals (installation_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_release_approval_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'release_approvals are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS release_approvals_no_update ON release_approvals;
CREATE TRIGGER release_approvals_no_update
  BEFORE UPDATE ON release_approvals
  FOR EACH ROW EXECUTE PROCEDURE reject_release_approval_mutation();

DROP TRIGGER IF EXISTS release_approvals_no_delete ON release_approvals;
CREATE TRIGGER release_approvals_no_delete
  BEFORE DELETE ON release_approvals
  FOR EACH ROW EXECUTE PROCEDURE reject_release_approval_mutation();

CREATE TABLE IF NOT EXISTS release_legal_holds (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL REFERENCES release_revisions (id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('place', 'release')),
  reason TEXT NOT NULL,
  actor_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_legal_holds_revision_idx
  ON release_legal_holds (revision_id, id DESC);

CREATE INDEX IF NOT EXISTS release_legal_holds_install_idx
  ON release_legal_holds (installation_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_release_legal_hold_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'release_legal_holds are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS release_legal_holds_no_update ON release_legal_holds;
CREATE TRIGGER release_legal_holds_no_update
  BEFORE UPDATE ON release_legal_holds
  FOR EACH ROW EXECUTE PROCEDURE reject_release_legal_hold_mutation();

DROP TRIGGER IF EXISTS release_legal_holds_no_delete ON release_legal_holds;
CREATE TRIGGER release_legal_holds_no_delete
  BEFORE DELETE ON release_legal_holds
  FOR EACH ROW EXECUTE PROCEDURE reject_release_legal_hold_mutation();

CREATE TABLE IF NOT EXISTS release_public_pages (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  revision_id BIGINT NOT NULL UNIQUE REFERENCES release_revisions (id) ON DELETE CASCADE,
  public_token TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_login TEXT NOT NULL,
  updated_by_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_public_pages_token_idx
  ON release_public_pages (public_token);

CREATE INDEX IF NOT EXISTS release_public_pages_install_idx
  ON release_public_pages (installation_id, enabled, id DESC);

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
  published_at TIMESTAMPTZ,
  dependency_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  unpacked_bytes BIGINT,
  has_attestations BOOLEAN,
  attestation_predicate TEXT,
  signature_keyids JSONB NOT NULL DEFAULT '[]'::jsonb,
  publisher_name TEXT,
  trusted_publisher TEXT,
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

CREATE TABLE IF NOT EXISTS identity_candidates (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES watched_packages (id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  transformation TEXT NOT NULL CHECK (transformation IN (
    'homoglyph',
    'adjacent_key',
    'separator',
    'token_order',
    'scope_confusion',
    'edit_distance'
  )),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  last_version TEXT,
  last_published_at TIMESTAMPTZ,
  allowlisted_at TIMESTAMPTZ,
  allowlist_reason TEXT,
  allowlisted_by_login TEXT,
  UNIQUE (package_id, candidate_name)
);

CREATE INDEX IF NOT EXISTS identity_candidates_pkg_idx
  ON identity_candidates (package_id, candidate_name);

CREATE INDEX IF NOT EXISTS identity_candidates_check_idx
  ON identity_candidates (package_id, last_checked_at ASC NULLS FIRST, id ASC);

CREATE INDEX IF NOT EXISTS identity_candidates_install_idx
  ON identity_candidates (installation_id, package_id);

CREATE TABLE IF NOT EXISTS identity_evidence_packs (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL UNIQUE REFERENCES watched_packages (id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  created_by_login TEXT NOT NULL,
  updated_by_login TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_evidence_packs_token_idx
  ON identity_evidence_packs (public_token);

CREATE INDEX IF NOT EXISTS identity_evidence_packs_install_idx
  ON identity_evidence_packs (installation_id, enabled, id DESC);

CREATE TABLE IF NOT EXISTS protected_namespaces (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL UNIQUE REFERENCES installations (id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  created_by_login TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protected_namespaces_scope_idx
  ON protected_namespaces (installation_id, scope);

CREATE TABLE IF NOT EXISTS namespace_name_snapshots (
  id BIGSERIAL PRIMARY KEY,
  namespace_id BIGINT NOT NULL REFERENCES protected_namespaces (id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  names JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS namespace_name_snapshots_ns_idx
  ON namespace_name_snapshots (namespace_id, id DESC);

CREATE OR REPLACE FUNCTION reject_namespace_name_snapshot_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'namespace_name_snapshots are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS namespace_name_snapshots_no_update ON namespace_name_snapshots;
CREATE TRIGGER namespace_name_snapshots_no_update
  BEFORE UPDATE ON namespace_name_snapshots
  FOR EACH ROW EXECUTE PROCEDURE reject_namespace_name_snapshot_update();

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
  actor_login TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'destination.save',
    'destination.delete',
    'route.save',
    'route.delete',
    'registry.save',
    'registry.delete',
    'scan_token.mint',
    'scan_token.revoke',
    'exception.save',
    'exception.revoke',
    'baseline.save',
    'member.role_change',
    'member.remove',
    'invite.create',
    'invite.revoke',
    'setup_pr.create',
    'remediation_pr.create',
    'package.unwatch',
    'origin.unwatch',
    'map_destination.save',
    'map_destination.delete',
    'identity.allowlist',
    'identity.revoke_allowlist',
    'retention.save',
    'repo.make_private',
    'repo.delete_pack_assets',
    'repo.disable_workflow',
    'delivery_location.save',
    'release.approve',
    'release.reject',
    'release.hold',
    'release.release_hold',
    'release.publish_verify',
    'release.unpublish_verify',
    'identity.evidence',
    'identity.publish_advisory',
    'identity.unpublish_advisory',
    'namespace.protect',
    'namespace.unprotect'
  )),
  summary TEXT NOT NULL,
  target_kind TEXT,
  target_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_install_idx
  ON audit_events (installation_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION reject_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW EXECUTE PROCEDURE reject_audit_event_mutation();
DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE PROCEDURE reject_audit_event_mutation();

CREATE TABLE IF NOT EXISTS disclosure_destinations (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL UNIQUE CHECK (kind IN ('webhook', 'jira')),
  host TEXT NOT NULL,
  project_key TEXT,
  secret_ciphertext TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disclosure_destinations_kind_idx
  ON disclosure_destinations (kind);

CREATE TABLE IF NOT EXISTS operator_grants (
  id BIGSERIAL PRIMARY KEY,
  github_login TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS operator_grants_login_idx
  ON operator_grants (lower(github_login));

