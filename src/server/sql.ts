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
        'package.unwatch'
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
}

export function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value);
}
