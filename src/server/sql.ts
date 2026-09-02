import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type QueryResult<T> = { rows: T[] };

export type SqlClient = {
  query: <T>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  exec: (text: string) => Promise<void>;
  transaction: <T>(fn: (sql: SqlClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

function wrapPglite(db: PGlite): SqlClient {
  const run = (target: PGlite) =>
    async <T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> => {
      const result = await target.query<T>(text, params);
      return { rows: result.rows ?? [] };
    };

  return {
    query: run(db),
    async exec(text: string) {
      await db.exec(text);
    },
    async transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
      return await db.transaction(async (tx) => {
        const inner: SqlClient = {
          query: async <R>(text: string, params: unknown[] = []) => {
            const result = await tx.query<R>(text, params);
            return { rows: result.rows ?? [] };
          },
          exec: async (text: string) => {
            await tx.exec(text);
          },
          transaction: async (nested) => nested(inner),
          close: async () => undefined,
        };
        return await fn(inner);
      });
    },
    async close() {
      await db.close();
    },
  };
}

function wrapPool(pool: pg.Pool): SqlClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const result = await pool.query(text, params);
      return { rows: result.rows as T[] };
    },
    async exec(text: string) {
      await pool.query(text);
    },
    async transaction<T>(fn: (sql: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inner: SqlClient = {
          async query<R>(text: string, params: unknown[] = []) {
            const result = await client.query(text, params);
            return { rows: result.rows as R[] };
          },
          exec: async (text: string) => {
            await client.query(text);
          },
          transaction: async (nested) => nested(inner),
          close: async () => undefined,
        };
        const value = await fn(inner);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function openSql(databaseUrl: string): Promise<SqlClient> {
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    const loc = databaseUrl.replace(/^pglite:\/\//, "") || "./data/nospoilers";
    const db =
      loc === ":memory:" || loc === "memory"
        ? new PGlite()
        : await (async () => {
            const abs = path.resolve(loc);
            await mkdir(path.dirname(abs), { recursive: true });
            return new PGlite(abs);
          })();
    await db.waitReady;
    return wrapPglite(db);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return wrapPool(pool);
}

export async function migrate(sql: SqlClient): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(here, "schema.sql");
  const schema = await readFile(schemaPath, "utf8");
  await sql.exec(schema);
  await sql.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "001_init",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "002_coverage",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "003_prospects",
  ]);
  const { rows: missingBilling } = await sql.query<{ id: string }>(
    `SELECT i.id::text AS id
     FROM installations i
     LEFT JOIN billing_accounts b ON b.installation_id = i.id
     WHERE b.installation_id IS NULL`,
  );
  for (const row of missingBilling) {
    const installationId = Number(row.id);
    const { rows: fromUser } = await sql.query<{
      trial_ends_at: string | Date | null;
      plan: string | null;
    }>(
      `SELECT u.trial_ends_at, u.plan
       FROM installation_users iu
       JOIN users u ON u.id = iu.user_id
       WHERE iu.installation_id = $1
       ORDER BY CASE WHEN u.plan IN ('solo', 'team') THEN 0 ELSE 1 END,
                u.trial_ends_at DESC NULLS LAST
       LIMIT 1`,
      [installationId],
    );
    const trial = fromUser[0]?.trial_ends_at;
    await sql.query(
      `INSERT INTO billing_accounts (installation_id, trial_ends_at, plan)
       VALUES ($1, COALESCE($2::timestamptz, now() + interval '14 days'), $3)
       ON CONFLICT (installation_id) DO NOTHING`,
      [
        installationId,
        trial instanceof Date ? trial.toISOString() : (trial ?? null),
        fromUser[0]?.plan ?? "trial",
      ],
    );
  }
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "004_billing_accounts",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "005_watched_packages",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "006_scan_receipts",
  ]);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "007_policy_exceptions",
  ]);
  await sql.exec(`
    ALTER TABLE watched_packages ADD COLUMN IF NOT EXISTS registry_origin TEXT NOT NULL DEFAULT 'https://registry.npmjs.org';
    ALTER TABLE watched_packages DROP CONSTRAINT IF EXISTS watched_packages_installation_id_package_name_key;
    CREATE UNIQUE INDEX IF NOT EXISTS watched_packages_install_name_registry_uidx
      ON watched_packages (installation_id, package_name, registry_origin);
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "008_npm_registries",
  ]);
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "009_scan_api_tokens",
  ]);
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "010_release_revisions",
  ]);
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "011_package_identities",
  ]);
  await sql.exec(`
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS installation_id BIGINT;
    CREATE INDEX IF NOT EXISTS jobs_install_feed_idx
      ON jobs (installation_id, created_at DESC, id DESC)
      WHERE installation_id IS NOT NULL;
    UPDATE jobs
       SET installation_id = (payload->>'installationId')::bigint
     WHERE installation_id IS NULL
       AND (payload->>'installationId') ~ '^[0-9]+$'
       AND EXISTS (
         SELECT 1 FROM installations i
         WHERE i.id = (payload->>'installationId')::bigint
       );
    CREATE UNIQUE INDEX IF NOT EXISTS alerts_delivery_uidx
      ON alerts (github_delivery_id)
      WHERE github_delivery_id IS NOT NULL;
  `);
  try {
    await sql.exec(`
      ALTER TABLE jobs
        ADD CONSTRAINT jobs_installation_id_fkey
        FOREIGN KEY (installation_id) REFERENCES installations (id) ON DELETE CASCADE
    `);
  } catch {
    // Fresh schema.sql already has the FK; existing databases keep the column.
  }
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "012_install_health",
  ]);
  await sql.exec(`
    ALTER TABLE installations ADD COLUMN IF NOT EXISTS last_permission_test_at TIMESTAMPTZ;
    ALTER TABLE installations ADD COLUMN IF NOT EXISTS last_permission_test JSONB;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by_login TEXT;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS assigned_to_login TEXT;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_by_login TEXT;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "013_incident_response",
  ]);
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS notification_destinations (
      id BIGSERIAL PRIMARY KEY,
      installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('slack', 'siem')),
      host TEXT NOT NULL,
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
      destination_id BIGINT NOT NULL REFERENCES notification_destinations (id) ON DELETE CASCADE,
      alert_id BIGINT REFERENCES alerts (id) ON DELETE SET NULL,
      kind TEXT NOT NULL CHECK (kind IN ('slack', 'siem')),
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "014_notification_destinations",
  ]);
  const { rows: siemKindMigration } = await sql.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = $1`,
    ["015_siem_destinations"],
  );
  if (!siemKindMigration[0]) {
    await sql.exec(`
      ALTER TABLE notification_destinations DROP CONSTRAINT IF EXISTS notification_destinations_kind_check;
      ALTER TABLE notification_destinations ADD CONSTRAINT notification_destinations_kind_check
        CHECK (kind IN ('slack', 'siem'));
      ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_kind_check;
      ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
        CHECK (kind IN ('slack', 'siem'));
    `);
    await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
      "015_siem_destinations",
    ]);
  }
  await sql.exec(`
    ALTER TABLE installation_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
    ALTER TABLE installation_users DROP CONSTRAINT IF EXISTS installation_users_role_check;
    ALTER TABLE installation_users ADD CONSTRAINT installation_users_role_check
      CHECK (role IN ('member', 'admin'));
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "016_installation_roles",
  ]);
  await sql.exec(`
    ALTER TABLE notification_destinations ADD COLUMN IF NOT EXISTS project_key TEXT;
  `);
  const { rows: jiraKindMigration } = await sql.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = $1`,
    ["017_jira_destinations"],
  );
  if (!jiraKindMigration[0]) {
    await sql.exec(`
      ALTER TABLE notification_destinations DROP CONSTRAINT IF EXISTS notification_destinations_kind_check;
      ALTER TABLE notification_destinations ADD CONSTRAINT notification_destinations_kind_check
        CHECK (kind IN ('slack', 'siem', 'jira'));
      ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_kind_check;
      ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
        CHECK (kind IN ('slack', 'siem', 'jira'));
    `);
    await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
      "017_jira_destinations",
    ]);
  }
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "018_notification_routes",
  ]);
  await sql.exec(`
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
        'setup_pr.create',
        'remediation_pr.create',
        'package.unwatch',
        'identity.allowlist',
        'identity.revoke_allowlist'
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "019_audit_events",
  ]);
  await sql.exec(`
    ALTER TABLE package_identity_snapshots ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "020_identity_signals",
  ]);
  await sql.exec(`
    ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS retention_days INTEGER NOT NULL DEFAULT 90;
  `);
  await sql.exec(`
    ALTER TABLE billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_retention_days_check;
    ALTER TABLE billing_accounts ADD CONSTRAINT billing_accounts_retention_days_check
      CHECK (retention_days IN (0, 90, 180, 365));
  `);
  await sql.exec(`
    CREATE OR REPLACE FUNCTION row_within_retention(install_id BIGINT, created TIMESTAMPTZ)
    RETURNS BOOLEAN
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        (
          SELECT CASE
            WHEN b.retention_days = 0 THEN TRUE
            ELSE $2 >= now() - (b.retention_days * INTERVAL '1 day')
          END
          FROM billing_accounts b
          WHERE b.installation_id = $1
        ),
        $2 >= now() - INTERVAL '90 days'
      );
    $$;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "021_retention_policies",
  ]);
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS watched_origins (
      id BIGSERIAL PRIMARY KEY,
      installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
      origin_url TEXT NOT NULL,
      host TEXT NOT NULL,
      last_sha256 TEXT,
      last_checked_at TIMESTAMPTZ,
      last_scanned_at TIMESTAMPTZ,
      last_scan_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (installation_id, origin_url)
    );
  `);
  await sql.exec(`
    CREATE INDEX IF NOT EXISTS watched_origins_install_idx
      ON watched_origins (installation_id, origin_url);
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "022_watched_origins",
  ]);
  await sql.exec(`
    ALTER TABLE watched_origins ADD COLUMN IF NOT EXISTS last_debug_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await sql.exec(`
    ALTER TABLE watched_origins ADD COLUMN IF NOT EXISTS last_release TEXT;
  `);
  await sql.exec(`
    ALTER TABLE watched_origins ADD COLUMN IF NOT EXISTS last_public_map BOOLEAN NOT NULL DEFAULT false;
  `);
  await sql.exec(`
    ALTER TABLE watched_packages ADD COLUMN IF NOT EXISTS last_debug_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await sql.exec(`
    ALTER TABLE watched_packages ADD COLUMN IF NOT EXISTS last_release TEXT;
  `);
  await sql.exec(`
    ALTER TABLE watched_packages ADD COLUMN IF NOT EXISTS last_public_map BOOLEAN NOT NULL DEFAULT false;
  `);
  await sql.exec(`
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
  `);
  await sql.exec(`
    CREATE INDEX IF NOT EXISTS map_destinations_install_idx
      ON map_destinations (installation_id);
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "023_map_destinations",
  ]);
  await migrateFairUseConcurrency(sql);
  await migrateHostedUsage(sql);
}

async function migrateFairUseConcurrency(sql: SqlClient): Promise<void> {
  await sql.exec(`
    CREATE INDEX IF NOT EXISTS jobs_running_heavy_install_idx
      ON jobs (installation_id)
      WHERE status = 'running' AND priority = 'heavy';
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "024_fair_use_concurrency",
  ]);
}

async function migrateHostedUsage(sql: SqlClient): Promise<void> {
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS hosted_usage_days (
      installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
      day DATE NOT NULL,
      heavy_jobs INTEGER NOT NULL DEFAULT 0 CHECK (heavy_jobs >= 0),
      PRIMARY KEY (installation_id, day)
    );
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "025_hosted_usage",
  ]);
  await migrateGithubResponseAudit(sql);
}

async function migrateGithubResponseAudit(sql: SqlClient): Promise<void> {
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "026_github_response",
  ]);
  await migrateTeamInvites(sql);
}

async function migrateTeamInvites(sql: SqlClient): Promise<void> {
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS installation_invites (
      id BIGSERIAL PRIMARY KEY,
      installation_id BIGINT NOT NULL REFERENCES installations (id) ON DELETE CASCADE,
      github_login TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
      created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (installation_id, github_login)
    );
  `);
  await sql.exec(`
    CREATE INDEX IF NOT EXISTS installation_invites_install_idx
      ON installation_invites (installation_id);
  `);
  const { rows: inviteMigration } = await sql.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = $1`,
    ["027_team_invites"],
  );
  if (!inviteMigration[0]) {
    await sql.exec(`
      ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
      ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
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
        'repo.disable_workflow'
      ));
    `);
    await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
      "027_team_invites",
    ]);
  }
  await sql.exec(`
    ALTER TABLE package_identity_snapshots
      ADD COLUMN IF NOT EXISTS dependency_names JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "028_identity_dependencies",
  ]);
  await sql.exec(`
    ALTER TABLE package_identity_snapshots
      ADD COLUMN IF NOT EXISTS unpacked_bytes BIGINT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "029_identity_unpacked_bytes",
  ]);
  await sql.exec(`
    ALTER TABLE package_identity_snapshots
      ADD COLUMN IF NOT EXISTS has_attestations BOOLEAN,
      ADD COLUMN IF NOT EXISTS attestation_predicate TEXT,
      ADD COLUMN IF NOT EXISTS signature_keyids JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "030_identity_provenance",
  ]);
  await sql.exec(`
    ALTER TABLE package_identity_snapshots
      ADD COLUMN IF NOT EXISTS publisher_name TEXT,
      ADD COLUMN IF NOT EXISTS trusted_publisher TEXT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "031_identity_publisher",
  ]);
  await sql.exec(`
    ALTER TABLE prospects
      ADD COLUMN IF NOT EXISTS workspace_members JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "032_prospect_workspaces",
  ]);
  await sql.exec(`
    ALTER TABLE prospects
      ADD COLUMN IF NOT EXISTS feed_checked_at TIMESTAMPTZ;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "033_prospect_npm_feed",
  ]);
  await migrateDeliveryVerify(sql);
  await migrateDeliveryVerifyChain(sql);
  await migrateReleaseSizeType(sql);
  await migrateReleaseGovernance(sql);
  await migrateDisclosureDesk(sql);
  await migrateInternalNotifications(sql);
  await migrateDisclosurePhase2(sql);
  await migrateDisclosureWorkflow(sql);
  await migrateDisclosureSlaBackfill(sql);
  await migrateReleasePublicPages(sql);
  await migratePagerDutyDestinations(sql);
  await migrateDestinationDeleteKeepsDeliveries(sql);
  await migrateIdentityEvidence(sql);
  await migrateProtectedNamespaces(sql);
  await migrateDisclosureEvidenceExpiry(sql);
  await migrateDiscoveryCampaigns(sql);
  await migrateDisclosureDestinations(sql);
  await migrateOperatorGrants(sql);
  await applyNotificationKindCheck(sql);
  await applyAuditEventsActionCheck(sql);
}

async function migrateDeliveryVerify(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "034_delivery_verify",
  ]);
}

async function migrateDeliveryVerifyChain(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE release_delivery_verifications
      ADD COLUMN IF NOT EXISTS redirect_hosts TEXT;
    ALTER TABLE release_delivery_verifications
      ADD COLUMN IF NOT EXISTS cache_state TEXT;
    ALTER TABLE release_delivery_verifications
      ADD COLUMN IF NOT EXISTS delivery_region TEXT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "035_delivery_verify_chain",
  ]);
}

async function migrateReleaseSizeType(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE release_revisions
      ADD COLUMN IF NOT EXISTS artifact_bytes BIGINT;
    ALTER TABLE release_revisions
      ADD COLUMN IF NOT EXISTS media_type TEXT;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "036_release_size_type",
  ]);
}

async function migrateReleaseGovernance(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "037_release_governance",
  ]);
}

async function migrateDisclosureDesk(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
      fingerprints JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "038_disclosure_desk",
  ]);
}

async function migrateInternalNotifications(sql: SqlClient): Promise<void> {
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS internal_notifications (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('verified_critical')),
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "039_internal_notifications",
  ]);
}

async function migrateDisclosurePhase2(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS vendor_channel TEXT
        CHECK (vendor_channel IS NULL OR vendor_channel IN (
          'security_email', 'form', 'security_txt', 'platform'
        ));
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS outcome_credit TEXT;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS outcome_cve TEXT;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS outcome_notes TEXT;
    CREATE TABLE IF NOT EXISTS disclosure_templates (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO disclosure_templates (name, subject, body)
    VALUES (
      'standard',
      'Coordinated disclosure: public artifact findings in {{coordinate}}',
      $std$This is a private coordinated disclosure. Nothing has been sent or published.

Target: {{coordinate}}
Artifact: {{package}}
Preferred channel: {{channel}}

Finding fingerprints (rule|severity|path|title):
{{fingerprints}}

Please acknowledge and tell us the fixed version. We will not name this publicly.$std$
    )
    ON CONFLICT (name) DO NOTHING;
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
    ALTER TABLE internal_notifications DROP CONSTRAINT IF EXISTS internal_notifications_kind_check;
    ALTER TABLE internal_notifications ADD CONSTRAINT internal_notifications_kind_check
      CHECK (kind IN ('verified_critical', 'deadline_missed'));
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "040_disclosure_phase2",
  ]);
}

async function migrateDisclosureWorkflow(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS assignee TEXT;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'none';
    ALTER TABLE disclosure_cases
      DROP CONSTRAINT IF EXISTS disclosure_cases_review_state_check;
    ALTER TABLE disclosure_cases
      ADD CONSTRAINT disclosure_cases_review_state_check
      CHECK (review_state IN ('none', 'pending', 'approved', 'rejected'));
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS review_note TEXT;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
    ALTER TABLE disclosure_cases
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "041_disclosure_workflow",
  ]);
}

async function migrateDisclosureSlaBackfill(sql: SqlClient): Promise<void> {
  await sql.exec(`
    UPDATE disclosure_cases c
    SET verified_at = COALESCE(
      c.verified_at,
      (
        SELECT MIN(e.created_at)
        FROM disclosure_events e
        WHERE e.case_id = c.id
          AND e.summary = 'Set case state to verified.'
      ),
      c.updated_at
    )
    WHERE c.state = 'verified' AND c.verified_at IS NULL;
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "042_disclosure_sla_backfill",
  ]);
}

async function migrateReleasePublicPages(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "043_release_public_pages",
  ]);
}

async function applyAuditEventsActionCheck(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
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
    ));
  `);
}

async function migratePagerDutyDestinations(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE notification_destinations DROP CONSTRAINT IF EXISTS notification_destinations_kind_check;
    ALTER TABLE notification_destinations ADD CONSTRAINT notification_destinations_kind_check
      CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty'));
    ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_kind_check;
    ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
      CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty'));
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "044_pagerduty_destinations",
  ]);
}

async function migrateDestinationDeleteKeepsDeliveries(sql: SqlClient): Promise<void> {
  const { rows: applied } = await sql.query<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = $1`,
    ["045_destination_delete_keeps_deliveries"],
  );
  if (applied[0]) return;
  await sql.exec(`
    ALTER TABLE notification_deliveries
      ALTER COLUMN destination_id DROP NOT NULL;
    ALTER TABLE notification_deliveries
      DROP CONSTRAINT IF EXISTS notification_deliveries_destination_id_fkey;
    ALTER TABLE notification_deliveries
      ADD CONSTRAINT notification_deliveries_destination_id_fkey
      FOREIGN KEY (destination_id) REFERENCES notification_destinations (id) ON DELETE SET NULL;
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "045_destination_delete_keeps_deliveries",
  ]);
}

async function migrateIdentityEvidence(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "046_identity_evidence",
  ]);
}

async function migrateProtectedNamespaces(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "047_protected_namespaces",
  ]);
}

async function migrateDisclosureEvidenceExpiry(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
    CREATE INDEX IF NOT EXISTS disclosure_attachments_expiry_idx
      ON disclosure_attachments (expires_at)
      WHERE ciphertext <> '';
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "048_disclosure_evidence_expiry",
  ]);
}

async function migrateDiscoveryCampaigns(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "049_discovery_campaigns",
  ]);
}

async function migrateDisclosureDestinations(sql: SqlClient): Promise<void> {
  await sql.exec(`
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
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "050_disclosure_destinations",
  ]);
}

async function migrateOperatorGrants(sql: SqlClient): Promise<void> {
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS operator_grants (
      id BIGSERIAL PRIMARY KEY,
      github_login TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS operator_grants_login_idx
      ON operator_grants (lower(github_login));
  `);
  await sql.query("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING", [
    "051_operator_grants",
  ]);
}

async function applyNotificationKindCheck(sql: SqlClient): Promise<void> {
  await sql.exec(`
    ALTER TABLE notification_destinations DROP CONSTRAINT IF EXISTS notification_destinations_kind_check;
    ALTER TABLE notification_destinations ADD CONSTRAINT notification_destinations_kind_check
      CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty'));
    ALTER TABLE notification_deliveries DROP CONSTRAINT IF EXISTS notification_deliveries_kind_check;
    ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_kind_check
      CHECK (kind IN ('slack', 'siem', 'jira', 'pagerduty'));
  `);
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value);
}
