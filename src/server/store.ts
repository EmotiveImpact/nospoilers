import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { coverageFrom, coverageIsOn } from "../coverage.ts";
import type { SignedReceipt } from "../receipt.ts";
import type { ManifestEntry, ScanStatus } from "../scanner/types.ts";
import type { ReleaseChannel } from "./release-ledger.ts";
import { decryptSecret, encryptSecret, looksEncrypted } from "./secret-box.ts";
import { PUBLIC_NPM_ORIGIN } from "./npm-registry.ts";
import { hashScanToken, hashesMatch, mintScanToken } from "./scan-api.ts";
import { num, type SqlClient } from "./sql.ts";
import type { PermissionTestResult } from "./install-test.ts";

export type JobPriority = "light" | "heavy";

export type JobRow = {
  id: number;
  delivery_id: string | null;
  priority: JobPriority;
  kind: string;
  payload: unknown;
  status: string;
  attempts: number;
};

export type TenantJobRow = {
  id: number;
  installationId: number;
  kind: string;
  status: string;
  priority: string;
  attempts: number;
  error: string | null;
  createdAt: string;
  runAfter: string;
};

export type JobSummary = {
  queued: number;
  running: number;
  done: number;
  failed: number;
};

export type RepoRow = {
  id: number;
  installation_id: number;
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  last_checked_at: string | null;
  last_private: boolean | null;
};

export type AlertRow = {
  id: number;
  installation_id: number;
  repo_id: number | null;
  kind: string;
  title: string;
  body: string;
  findings: unknown;
  github_delivery_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by_login: string | null;
  assigned_to_login: string | null;
  resolved_at: string | null;
  resolved_by_login: string | null;
  resolution_note: string | null;
  created_at: string;
  full_name?: string | null;
};

export type AlertEventRow = {
  id: number;
  alert_id: number;
  installation_id: number;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export type AlertEventAction = "acknowledged" | "assigned" | "resolved" | "reopened" | "note";

export type WatchedPackageRow = {
  id: number;
  installation_id: number;
  package_name: string;
  registry_origin: string;
  last_version: string | null;
  last_dist_tags: Record<string, string> | null;
  last_tarball_url: string | null;
  last_shasum: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
};

export type NpmRegistryRow = {
  id: number;
  installation_id: number;
  origin: string;
  host: string;
  updated_at: string;
};

export type NotificationKind = "slack" | "siem";

export type NotificationDestinationRow = {
  id: number;
  installationId: number;
  kind: NotificationKind;
  host: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryError: string | null;
  updatedAt: string;
};

export type NotificationDeliveryRow = {
  id: number;
  installationId: number;
  destinationId: number;
  alertId: number | null;
  kind: NotificationKind;
  status: "sent" | "failed";
  inventedIncident: false;
  error: string | null;
  createdAt: string;
};

export type ScanApiTokenRow = {
  id: number;
  installation_id: number;
  name: string;
  token_prefix: string;
  created_by_login: string;
  last_used_at: string | null;
  created_at: string;
};

export type ScanReceiptRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes: number | null;
  status: ScanStatus;
  engine_version: string;
  manifest: ManifestEntry[];
  finding_fingerprints: string[];
  signature: string;
  receipt: SignedReceipt;
  created_at: string;
};

export type PolicyExceptionRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  rule: string;
  path_pattern: string | null;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
};

export type ScanBaselineRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  receipt_id: number;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  created_at: string;
  superseded_at: string | null;
};

export type ReleaseRevisionRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  receipt_id: number;
  channel: ReleaseChannel;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  source_revision: string | null;
  ci_run_url: string | null;
  previous_sha256: string | null;
  mismatch: boolean;
  created_at: string;
};

export type PackageProtectionRow = {
  id: number;
  installation_id: number;
  package_id: number;
  verified_via: "scope_match" | "github_repository";
  github_repo: string | null;
  created_at: string;
};

export type PackageIdentitySnapshotRow = {
  id: number;
  installation_id: number;
  package_id: number;
  version: string | null;
  maintainers: string[];
  repository_url: string | null;
  homepage: string | null;
  bin_names: string[];
  lifecycle_scripts: string[];
  created_at: string;
};

export type ProspectStatus = "new" | "contacted" | "fixed" | "ignored";
export type ProspectScanStatus = "queued" | "scanning" | "complete" | "failed";

export type ProspectRow = {
  id: number;
  source: "github_release" | "npm";
  owner: string;
  repo: string;
  repository_url: string;
  package_name: string | null;
  release_tag: string | null;
  artifact_name: string;
  artifact_url: string;
  artifact_bytes: number | null;
  status: ProspectStatus;
  scan_status: ProspectScanStatus;
  file_count: number | null;
  critical_count: number | null;
  warning_count: number | null;
  findings: unknown;
  error: string | null;
  discovered_at: string;
  scanned_at: string | null;
  contacted_at: string | null;
  updated_at: string;
};

function packageProtectionRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  verified_via: string;
  github_repo: string | null;
  created_at: string | Date;
}): PackageProtectionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    verified_via: row.verified_via as PackageProtectionRow["verified_via"],
    github_repo: row.github_repo,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function packageIdentitySnapshotRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  version: string | null;
  maintainers: unknown;
  repository_url: string | null;
  homepage: string | null;
  bin_names: unknown;
  lifecycle_scripts: unknown;
  created_at: string | Date;
}): PackageIdentitySnapshotRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    version: row.version,
    maintainers: asStringArray(row.maintainers),
    repository_url: row.repository_url,
    homepage: row.homepage,
    bin_names: asStringArray(row.bin_names),
    lifecycle_scripts: asStringArray(row.lifecycle_scripts),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function parsePayload(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

function permissionTestFromDb(value: unknown): PermissionTestResult | null {
  const parsed = parsePayload(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.inventedIncident === true) return null;
  return parsed as PermissionTestResult;
}

function optionalInstallId(id?: number | null): number | null {
  return id && Number.isFinite(id) && id > 0 ? id : null;
}

function asNotificationKind(value: string): NotificationKind {
  return value === "siem" ? "siem" : "slack";
}

function destinationRow(row: {
  id: unknown;
  installation_id: unknown;
  kind: string;
  host: string;
  last_delivery_at: string | Date | null;
  last_delivery_status: string | null;
  last_delivery_error: string | null;
  updated_at: string | Date;
}): NotificationDestinationRow {
  return {
    id: num(row.id),
    installationId: num(row.installation_id),
    kind: asNotificationKind(row.kind),
    host: row.host,
    lastDeliveryAt: iso(row.last_delivery_at),
    lastDeliveryStatus: row.last_delivery_status,
    lastDeliveryError: row.last_delivery_error,
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function alertRow(row: {
  id: unknown;
  installation_id: unknown;
  repo_id: unknown;
  kind: string;
  title: string;
  body: string;
  findings: unknown;
  github_delivery_id: string | null;
  acknowledged_at?: string | Date | null;
  acknowledged_by_login?: string | null;
  assigned_to_login?: string | null;
  resolved_at?: string | Date | null;
  resolved_by_login?: string | null;
  resolution_note?: string | null;
  created_at: string | Date;
  full_name?: string | null;
}): AlertRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    kind: row.kind,
    title: row.title,
    body: row.body,
    findings: parsePayload(row.findings),
    github_delivery_id: row.github_delivery_id,
    acknowledged_at: iso(row.acknowledged_at ?? null),
    acknowledged_by_login: row.acknowledged_by_login ?? null,
    assigned_to_login: row.assigned_to_login ?? null,
    resolved_at: iso(row.resolved_at ?? null),
    resolved_by_login: row.resolved_by_login ?? null,
    resolution_note: row.resolution_note ?? null,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    full_name: row.full_name ?? null,
  };
}

function installationIdFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = (payload as { installationId?: unknown }).installationId;
  const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function prospectRow(row: ProspectRow): ProspectRow {
  return {
    ...row,
    id: num(row.id),
    artifact_bytes: row.artifact_bytes === null ? null : num(row.artifact_bytes),
    file_count: row.file_count === null ? null : num(row.file_count),
    critical_count: row.critical_count === null ? null : num(row.critical_count),
    warning_count: row.warning_count === null ? null : num(row.warning_count),
    findings: parsePayload(row.findings),
  };
}

function asStringArray(value: unknown): string[] {
  const raw = parsePayload(value);
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function asManifest(value: unknown): ManifestEntry[] {
  const raw = parsePayload(value);
  if (!Array.isArray(raw)) return [];
  const out: ManifestEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.path !== "string" || typeof row.sha256 !== "string") continue;
    const size = typeof row.size === "number" ? row.size : Number(row.size);
    if (!Number.isFinite(size)) continue;
    out.push({ path: row.path, size, sha256: row.sha256 });
  }
  return out;
}

function releaseRevisionRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  receipt_id: unknown;
  channel: string;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  source_revision: string | null;
  ci_run_url: string | null;
  previous_sha256: string | null;
  mismatch: boolean | unknown;
  created_at: string | Date;
}): ReleaseRevisionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id === null || row.package_id === undefined ? null : num(row.package_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    receipt_id: num(row.receipt_id),
    channel: row.channel as ReleaseChannel,
    coordinate: row.coordinate,
    artifact_sha256: row.artifact_sha256,
    artifact_sha512: row.artifact_sha512,
    source_revision: row.source_revision,
    ci_run_url: row.ci_run_url,
    previous_sha256: row.previous_sha256,
    mismatch: Boolean(row.mismatch),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function scanReceiptRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes: unknown;
  status: string;
  engine_version: string;
  manifest: unknown;
  finding_fingerprints: unknown;
  signature: string;
  receipt: unknown;
  created_at: string | Date;
}): ScanReceiptRow {
  const parsedReceipt = parsePayload(row.receipt);
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id === null || row.package_id === undefined ? null : num(row.package_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    coordinate: row.coordinate,
    artifact_sha256: row.artifact_sha256,
    artifact_sha512: row.artifact_sha512,
    artifact_bytes: row.artifact_bytes === null || row.artifact_bytes === undefined ? null : num(row.artifact_bytes),
    status: row.status as ScanStatus,
    engine_version: row.engine_version,
    manifest: asManifest(row.manifest),
    finding_fingerprints: asStringArray(row.finding_fingerprints),
    signature: row.signature,
    receipt: parsedReceipt as SignedReceipt,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function parseDistTags(value: unknown): Record<string, string> | null {
  const raw = parsePayload(value);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function watchedPackageRow(row: {
  id: unknown;
  installation_id: unknown;
  package_name: string;
  registry_origin?: string | null;
  last_version: string | null;
  last_dist_tags: unknown;
  last_tarball_url: string | null;
  last_shasum: string | null;
  last_sha256: string | null;
  last_checked_at: string | Date | null;
  last_scanned_at: string | Date | null;
  last_scan_status: string | null;
}): WatchedPackageRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_name: row.package_name,
    registry_origin: row.registry_origin?.trim() || PUBLIC_NPM_ORIGIN,
    last_version: row.last_version,
    last_dist_tags: parseDistTags(row.last_dist_tags),
    last_tarball_url: row.last_tarball_url,
    last_shasum: row.last_shasum,
    last_sha256: row.last_sha256,
    last_checked_at: iso(row.last_checked_at),
    last_scanned_at: iso(row.last_scanned_at),
    last_scan_status: row.last_scan_status,
  };
}

function policyExceptionRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  rule: string;
  path_pattern: string | null;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  revoked_by: string | null;
  created_at: string | Date;
}): PolicyExceptionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id == null ? null : num(row.package_id),
    rule: row.rule,
    path_pattern: row.path_pattern,
    reason: row.reason,
    actor_user_id: row.actor_user_id,
    actor_login: row.actor_login,
    expires_at: iso(row.expires_at) ?? new Date().toISOString(),
    revoked_at: iso(row.revoked_at),
    revoked_by: row.revoked_by,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function scanBaselineRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  receipt_id: unknown;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  created_at: string | Date;
  superseded_at: string | Date | null;
}): ScanBaselineRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id == null ? null : num(row.package_id),
    repo_id: row.repo_id == null ? null : num(row.repo_id),
    receipt_id: num(row.receipt_id),
    reason: row.reason,
    actor_user_id: row.actor_user_id,
    actor_login: row.actor_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    superseded_at: iso(row.superseded_at),
  };
}

export function createStore(
  sql: SqlClient,
  opts: { jobMaxAttempts?: number; jobRetryBaseMs?: number; tokenSecret?: string } = {},
) {
  const jobMaxAttempts = opts.jobMaxAttempts ?? 5;
  const jobRetryBaseMs = opts.jobRetryBaseMs ?? 15_000;
  const tokenSecret = opts.tokenSecret?.trim() ?? "";
  return {
    sql,

    async ping(): Promise<boolean> {
      const { rows } = await sql.query<{ ok: string | number }>("SELECT 1 AS ok");
      return Number(rows[0]?.ok) === 1;
    },

    async upsertUser(input: {
      id: string;
      login: string;
      avatarUrl?: string;
      accessToken?: string;
    }): Promise<void> {
      const accessToken =
        input.accessToken && tokenSecret
          ? encryptSecret(input.accessToken, tokenSecret)
          : (input.accessToken ?? null);
      await sql.query(
        `INSERT INTO users (id, login, avatar_url, access_token, trial_ends_at, plan)
         VALUES ($1, $2, $3, $4, now() + interval '14 days', 'trial')
         ON CONFLICT (id) DO UPDATE SET
           login = excluded.login,
           avatar_url = excluded.avatar_url,
           access_token = COALESCE(excluded.access_token, users.access_token),
           trial_ends_at = COALESCE(users.trial_ends_at, now() + interval '14 days'),
           plan = COALESCE(users.plan, 'trial')`,
        [input.id, input.login, input.avatarUrl ?? null, accessToken],
      );
    },

    async createSession(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): Promise<string> {
      const id = randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + ttlMs).toISOString();
      await sql.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [id, userId, expires],
      );
      return id;
    },

    async getSession(id: string): Promise<{
      userId: string
      login: string
      avatarUrl: string | null
      trialEndsAt: string | null
      plan: string | null
    } | null> {
      const { rows } = await sql.query<{
        user_id: string
        login: string
        avatar_url: string | null
        trial_ends_at: string | Date | null
        plan: string | null
      }>(
        `SELECT s.user_id, u.login, u.avatar_url, u.trial_ends_at, u.plan
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > now()`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      const trialEndsAt =
        row.trial_ends_at instanceof Date ? row.trial_ends_at.toISOString() : row.trial_ends_at
      return {
        userId: row.user_id,
        login: row.login,
        avatarUrl: row.avatar_url,
        trialEndsAt,
        plan: row.plan,
      }
    },

    async getUserAccessToken(userId: string): Promise<string | null> {
      const { rows } = await sql.query<{ access_token: string | null }>(
        `SELECT access_token FROM users WHERE id = $1`,
        [userId],
      );
      const stored = rows[0]?.access_token?.trim();
      if (!stored) return null;
      if (!tokenSecret) return stored;
      const plain = decryptSecret(stored, tokenSecret);
      if (!looksEncrypted(stored)) {
        await sql.query(`UPDATE users SET access_token = $2 WHERE id = $1`, [
          userId,
          encryptSecret(plain, tokenSecret),
        ]);
      }
      return plain;
    },

    async upsertInstallation(input: {
      id: number;
      accountLogin: string;
      accountType: string;
      accountId: number;
      suspended?: boolean;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO installations (id, account_login, account_type, account_id, suspended)
         VALUES ($1, $2, $3, $4, COALESCE($5, false))
         ON CONFLICT (id) DO UPDATE SET
           account_login = excluded.account_login,
           account_type = excluded.account_type,
           account_id = excluded.account_id,
           suspended = COALESCE($5, installations.suspended)`,
        [
          input.id,
          input.accountLogin,
          input.accountType,
          input.accountId,
          input.suspended ?? null,
        ],
      );
      await sql.query(
        `INSERT INTO billing_accounts (installation_id, trial_ends_at, plan)
         VALUES ($1, now() + interval '14 days', 'trial')
         ON CONFLICT (installation_id) DO NOTHING`,
        [input.id],
      );
    },

    async installationWorkBlock(
      installationId: number,
    ): Promise<{ reason: "suspended" | "unpaid" } | null> {
      const { rows } = await sql.query<{
        suspended: boolean;
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT i.suspended, b.trial_ends_at, b.plan
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return { reason: "unpaid" };
      if (row.suspended) return { reason: "suspended" };
      if (!coverageIsOn(coverageFrom(iso(row.trial_ends_at), row.plan))) return { reason: "unpaid" };
      return null;
    },

    async installationWorkAllowed(installationId: number): Promise<boolean> {
      return (await this.installationWorkBlock(installationId)) === null;
    },

    async installationHasCoverage(installationId: number): Promise<boolean> {
      const { rows } = await sql.query<{
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT b.trial_ends_at, b.plan
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return false;
      return coverageIsOn(coverageFrom(iso(row.trial_ends_at), row.plan));
    },

    async installationBilling(
      installationId: number,
    ): Promise<{ trialEndsAt: string | null; plan: string | null } | null> {
      const { rows } = await sql.query<{
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT b.trial_ends_at, b.plan
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return null;
      return { trialEndsAt: iso(row.trial_ends_at), plan: row.plan };
    },

    async deleteInstallation(id: number): Promise<void> {
      await sql.query(`DELETE FROM jobs WHERE installation_id = $1`, [id]);
      await sql.query(`DELETE FROM installations WHERE id = $1`, [id]);
    },

    async getInstallation(id: number): Promise<{
      id: number;
      account_login: string;
      account_type: string;
      suspended: boolean;
    } | null> {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
        suspended: boolean;
      }>(`SELECT id, account_login, account_type, suspended FROM installations WHERE id = $1`, [id]);
      const row = rows[0];
      if (!row) return null;
      return {
        id: num(row.id),
        account_login: row.account_login,
        account_type: row.account_type,
        suspended: Boolean(row.suspended),
      };
    },

    async linkUserInstallation(installationId: number, userId: string): Promise<void> {
      await sql.query(
        `INSERT INTO installation_users (installation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [installationId, userId],
      );
    },

    async linkUserToAccountInstallations(userId: string, githubUserId: number): Promise<void> {
      await sql.query(
        `INSERT INTO installation_users (installation_id, user_id)
         SELECT id, $1 FROM installations
         WHERE account_type = 'User' AND account_id = $2
         ON CONFLICT DO NOTHING`,
        [userId, githubUserId],
      );
    },

    async upsertRepo(input: {
      id: number;
      installationId: number;
      owner: string;
      name: string;
      fullName: string;
      private: boolean;
      htmlUrl: string;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO repos (id, installation_id, owner, name, full_name, private, html_url, last_private, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $6, now())
         ON CONFLICT (id) DO UPDATE SET
           installation_id = excluded.installation_id,
           owner = excluded.owner,
           name = excluded.name,
           full_name = excluded.full_name,
           private = excluded.private,
           html_url = excluded.html_url`,
        [
          input.id,
          input.installationId,
          input.owner,
          input.name,
          input.fullName,
          input.private,
          input.htmlUrl,
        ],
      );
    },

    async removeRepo(id: number): Promise<void> {
      await sql.query(`DELETE FROM repos WHERE id = $1`, [id]);
    },

    async getRepo(id: number): Promise<RepoRow | null> {
      const { rows } = await sql.query<RepoRow>(`SELECT * FROM repos WHERE id = $1`, [id]);
      const row = rows[0];
      if (!row) return null;
      return { ...row, id: num(row.id), installation_id: num(row.installation_id) };
    },

    async listReposForInstallation(installationId: number): Promise<RepoRow[]> {
      const { rows } = await sql.query<RepoRow>(
        `SELECT * FROM repos WHERE installation_id = $1 ORDER BY full_name`,
        [installationId],
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async listReposForUser(userId: string, installationId?: number | null): Promise<RepoRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<RepoRow>(
        `SELECT r.*
         FROM repos r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR r.installation_id = $2)
         ORDER BY r.full_name`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async listAllRepos(): Promise<RepoRow[]> {
      const { rows } = await sql.query<RepoRow>(
        `SELECT r.* FROM repos r
         JOIN installations i ON i.id = r.installation_id
         WHERE i.suspended = false
         ORDER BY r.id`,
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async updateRepoCheck(id: number, isPrivate: boolean): Promise<void> {
      await sql.query(
        `UPDATE repos SET private = $2, last_private = $2, last_checked_at = now() WHERE id = $1`,
        [id, isPrivate],
      );
    },

    async enqueueJob(input: {
      deliveryId?: string | null;
      priority: JobPriority;
      kind: string;
      payload: unknown;
      installationId?: number | null;
    }): Promise<{ id: number | null; inserted: boolean }> {
      const installationId = input.installationId ?? installationIdFromPayload(input.payload);
      const { rows } = await sql.query<{ id: unknown }>(
        `INSERT INTO jobs (delivery_id, installation_id, priority, kind, payload)
         VALUES (
           $1,
           CASE
             WHEN $5::bigint IS NULL THEN NULL
             WHEN EXISTS (SELECT 1 FROM installations WHERE id = $5::bigint) THEN $5::bigint
             ELSE NULL
           END,
           $2, $3, $4::jsonb
         )
         ON CONFLICT (delivery_id) WHERE delivery_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          input.deliveryId ?? null,
          input.priority,
          input.kind,
          JSON.stringify(input.payload),
          installationId,
        ],
      );
      const id = rows[0] ? num(rows[0].id) : null;
      return { id, inserted: id !== null };
    },

    async countRunning(priority: JobPriority): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM jobs WHERE status = 'running' AND priority = $1`,
        [priority],
      );
      return num(rows[0]?.n ?? 0);
    },

    async claimJob(
      priority: JobPriority,
      cap: number,
      workerId: string,
      includeProspectScans = true,
    ): Promise<JobRow | null> {
      return await sql.transaction(async (tx) => {
        const { rows: countRows } = await tx.query<{ n: unknown }>(
          `SELECT count(*)::int AS n FROM jobs WHERE status = 'running' AND priority = $1`,
          [priority],
        );
        if (num(countRows[0]?.n ?? 0) >= cap) return null;

        const { rows: picked } = await tx.query<{ id: unknown }>(
          `SELECT id FROM jobs
           WHERE status = 'queued' AND priority = $1 AND run_after <= now()
             AND ($2::boolean OR kind <> 'prospect_scan')
           ORDER BY CASE WHEN kind = 'prospect_scan' THEN 1 ELSE 0 END, id
           FOR UPDATE SKIP LOCKED
           LIMIT 1`,
          [priority, includeProspectScans],
        );
        const pickedId = picked[0]?.id;
        if (pickedId === undefined) return null;

        const { rows } = await tx.query<JobRow>(
          `UPDATE jobs
           SET status = 'running', locked_at = now(), locked_by = $2, attempts = attempts + 1
           WHERE id = $1
           RETURNING id, delivery_id, priority, kind, payload, status, attempts`,
          [pickedId, workerId],
        );
        const row = rows[0];
        if (!row) return null;
        return {
          ...row,
          id: num(row.id),
          payload: parsePayload(row.payload),
        };
      });
    },

    async finishJob(id: number, error?: string): Promise<void> {
      if (!error) {
        await sql.query(
          `UPDATE jobs SET status = 'done', error = NULL, locked_at = NULL, locked_by = NULL WHERE id = $1`,
          [id],
        );
        return;
      }
      const { rows } = await sql.query<{ attempts: unknown }>(
        `SELECT attempts FROM jobs WHERE id = $1`,
        [id],
      );
      const attempts = num(rows[0]?.attempts ?? 0);
      if (attempts >= jobMaxAttempts) {
        await sql.query(
          `UPDATE jobs SET status = 'failed', error = $2, locked_at = NULL, locked_by = NULL WHERE id = $1`,
          [id, error],
        );
        return;
      }
      const delayMs = Math.min(900_000, jobRetryBaseMs * 2 ** Math.max(attempts - 1, 0));
      const runAfter = new Date(Date.now() + delayMs).toISOString();
      await sql.query(
        `UPDATE jobs SET status = 'queued', error = $2, run_after = $3::timestamptz, locked_at = NULL, locked_by = NULL WHERE id = $1`,
        [id, error, runAfter],
      );
    },

    async recoverStaleJobs(staleAfterMs: number): Promise<number> {
      const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
      const { rows } = await sql.query<{ n: unknown }>(
        `WITH recovered AS (
           UPDATE jobs
           SET status = 'queued', locked_at = NULL, locked_by = NULL,
               error = COALESCE(error, 'stale lock recovered')
           WHERE status = 'running' AND locked_at < $1::timestamptz
           RETURNING id
         )
         SELECT count(*)::int AS n FROM recovered`,
        [cutoff],
      );
      return num(rows[0]?.n ?? 0);
    },

    async insertAlert(input: {
      installationId: number;
      repoId?: number | null;
      kind: string;
      title: string;
      body: string;
      findings?: unknown;
      githubDeliveryId?: string | null;
    }): Promise<number> {
      if (input.githubDeliveryId) {
        const { rows: existing } = await sql.query<{ id: unknown }>(
          `SELECT id FROM alerts WHERE github_delivery_id = $1 LIMIT 1`,
          [input.githubDeliveryId],
        );
        if (existing[0]) return num(existing[0].id);
      }
      try {
        const inserted = await sql.query<{ id: unknown }>(
          `INSERT INTO alerts (installation_id, repo_id, kind, title, body, findings, github_delivery_id)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING id`,
          [
            input.installationId,
            input.repoId ?? null,
            input.kind,
            input.title,
            input.body,
            input.findings ? JSON.stringify(input.findings) : null,
            input.githubDeliveryId ?? null,
          ],
        );
        return num(inserted.rows[0]?.id);
      } catch (error) {
        if (input.githubDeliveryId) {
          const { rows: again } = await sql.query<{ id: unknown }>(
            `SELECT id FROM alerts WHERE github_delivery_id = $1 LIMIT 1`,
            [input.githubDeliveryId],
          );
          if (again[0]) return num(again[0].id);
        }
        throw error;
      }
    },

    async listAlertsForUser(userId: string, installationId?: number | null): Promise<AlertRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<AlertRow>(
        `SELECT a.*, r.full_name
         FROM alerts a
         LEFT JOIN repos r ON r.id = a.repo_id
         WHERE a.installation_id IN (
           SELECT installation_id FROM installation_users WHERE user_id = $1
         )
           AND ($2::bigint IS NULL OR a.installation_id = $2)
         ORDER BY a.created_at DESC
         LIMIT 100`,
        [userId, scoped],
      );
      return rows.map((row) => alertRow(row));
    },

    async listJobsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<{ jobs: TenantJobRow[]; summary: JobSummary }> {
      const scoped = optionalInstallId(installationId);
      const tenant = `SELECT installation_id FROM installation_users WHERE user_id = $1`;
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        status: string;
        priority: string;
        attempts: unknown;
        error: string | null;
        created_at: string | Date;
        run_after: string | Date;
      }>(
        `SELECT id, installation_id, kind, status, priority, attempts, error, created_at, run_after
         FROM jobs
         WHERE installation_id IN (${tenant})
           AND kind <> 'prospect_scan'
           AND ($2::bigint IS NULL OR installation_id = $2)
         ORDER BY created_at DESC, id DESC
         LIMIT 50`,
        [userId, scoped],
      );
      const { rows: counts } = await sql.query<{ status: string; n: unknown }>(
        `SELECT status, count(*)::int AS n
         FROM jobs
         WHERE installation_id IN (${tenant})
           AND kind <> 'prospect_scan'
           AND ($2::bigint IS NULL OR installation_id = $2)
         GROUP BY status`,
        [userId, scoped],
      );
      const summary: JobSummary = { queued: 0, running: 0, done: 0, failed: 0 };
      for (const row of counts) {
        if (row.status === "queued" || row.status === "running" || row.status === "done" || row.status === "failed") {
          summary[row.status] = num(row.n);
        }
      }
      return {
        jobs: rows.map((row) => ({
          id: num(row.id),
          installationId: num(row.installation_id),
          kind: row.kind,
          status: row.status,
          priority: row.priority,
          attempts: num(row.attempts),
          error: row.error,
          createdAt: iso(row.created_at) ?? new Date().toISOString(),
          runAfter: iso(row.run_after) ?? new Date().toISOString(),
        })),
        summary,
      };
    },

    async latestCustomerJob(
      installationId: number,
    ): Promise<{ kind: string; status: string; createdAt: string } | null> {
      const { rows } = await sql.query<{
        kind: string;
        status: string;
        created_at: string | Date;
      }>(
        `SELECT kind, status, created_at
         FROM jobs
         WHERE installation_id = $1 AND kind <> 'prospect_scan'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        kind: row.kind,
        status: row.status,
        createdAt: iso(row.created_at) ?? new Date().toISOString(),
      };
    },

    async hasRecentAlert(repoId: number, kind: string, sinceIso: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM alerts
         WHERE repo_id = $1 AND kind = $2 AND created_at > $3::timestamptz`,
        [repoId, kind, sinceIso],
      );
      return num(rows[0]?.n ?? 0) > 0;
    },

    async getAlertForUser(id: number, userId: string): Promise<AlertRow | null> {
      const { rows } = await sql.query<Parameters<typeof alertRow>[0]>(
        `SELECT a.*, r.full_name
         FROM alerts a
         LEFT JOIN repos r ON r.id = a.repo_id
         WHERE a.id = $1 AND a.installation_id IN (
           SELECT installation_id FROM installation_users WHERE user_id = $2
         )`,
        [id, userId],
      );
      return rows[0] ? alertRow(rows[0]) : null;
    },

    async listInstallationMemberLogins(installationId: number): Promise<string[]> {
      const { rows } = await sql.query<{ login: string }>(
        `SELECT u.login
         FROM installation_users iu
         JOIN users u ON u.id = iu.user_id
         WHERE iu.installation_id = $1
         ORDER BY u.login`,
        [installationId],
      );
      return rows.map((row) => row.login);
    },

    async listAlertEventsForUser(alertId: number, userId: string): Promise<AlertEventRow[]> {
      const alert = await this.getAlertForUser(alertId, userId);
      if (!alert) return [];
      const { rows } = await sql.query<{
        id: unknown;
        alert_id: unknown;
        installation_id: unknown;
        actor_login: string;
        action: string;
        detail: string | null;
        created_at: string | Date;
      }>(
        `SELECT id, alert_id, installation_id, actor_login, action, detail, created_at
         FROM alert_events
         WHERE alert_id = $1
         ORDER BY id`,
        [alertId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        alert_id: num(row.alert_id),
        installation_id: num(row.installation_id),
        actor_login: row.actor_login,
        action: row.action,
        detail: row.detail,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async acknowledgeAlertForUser(
      id: number,
      userId: string,
      login: string,
    ): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (current.acknowledged_at) return current;
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET acknowledged_at = now(), acknowledged_by_login = $2
           WHERE id = $1 AND acknowledged_at IS NULL`,
          [id, login],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'acknowledged', NULL)`,
          [id, current.installation_id, login],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async assignAlertForUser(
      id: number,
      userId: string,
      actorLogin: string,
      assigneeLogin: string,
    ): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      const members = await this.listInstallationMemberLogins(current.installation_id);
      const match = members.find((row) => row.toLowerCase() === assigneeLogin.toLowerCase());
      if (!match) {
        throw Object.assign(new Error("Assign only to someone on this GitHub install."), {
          status: 400,
        });
      }
      if (current.assigned_to_login === match) return current;
      await sql.transaction(async (tx) => {
        await tx.query(`UPDATE alerts SET assigned_to_login = $2 WHERE id = $1`, [id, match]);
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'assigned', $4)`,
          [id, current.installation_id, actorLogin, match],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async resolveAlertForUser(
      id: number,
      userId: string,
      login: string,
      note: string,
    ): Promise<AlertRow | null> {
      const trimmed = note.trim();
      if (trimmed.length < 8) {
        throw Object.assign(new Error("Resolution note must be at least 8 characters."), {
          status: 400,
        });
      }
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (current.resolved_at) {
        throw Object.assign(new Error("That alert is already resolved."), { status: 409 });
      }
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET resolved_at = now(),
               resolved_by_login = $2,
               resolution_note = $3,
               acknowledged_at = COALESCE(acknowledged_at, now()),
               acknowledged_by_login = COALESCE(acknowledged_by_login, $2)
           WHERE id = $1 AND resolved_at IS NULL`,
          [id, login, trimmed],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'resolved', $4)`,
          [id, current.installation_id, login, trimmed],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async reopenAlertForUser(id: number, userId: string, login: string): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (!current.resolved_at) {
        throw Object.assign(new Error("That alert is not resolved."), { status: 400 });
      }
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET resolved_at = NULL, resolved_by_login = NULL, resolution_note = NULL
           WHERE id = $1`,
          [id],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'reopened', NULL)`,
          [id, current.installation_id, login],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async savePermissionTest(
      installationId: number,
      result: PermissionTestResult,
    ): Promise<void> {
      await sql.query(
        `UPDATE installations
         SET last_permission_test_at = $2::timestamptz,
             last_permission_test = $3::jsonb
         WHERE id = $1`,
        [installationId, result.testedAt, JSON.stringify(result)],
      );
    },

    async upsertProspect(input: {
      source: "github_release" | "npm";
      owner: string;
      repo: string;
      repositoryUrl: string;
      packageName?: string | null;
      releaseTag?: string | null;
      artifactName: string;
      artifactUrl: string;
      artifactBytes?: number | null;
    }): Promise<{ id: number; inserted: boolean }> {
      const inserted = await sql.query<{ id: unknown }>(
        `INSERT INTO prospects (
           source, owner, repo, repository_url, package_name, release_tag,
           artifact_name, artifact_url, artifact_bytes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (artifact_url) DO NOTHING
         RETURNING id`,
        [
          input.source,
          input.owner,
          input.repo,
          input.repositoryUrl,
          input.packageName ?? null,
          input.releaseTag ?? null,
          input.artifactName,
          input.artifactUrl,
          input.artifactBytes ?? null,
        ],
      );
      if (inserted.rows[0]) return { id: num(inserted.rows[0].id), inserted: true };
      const existing = await sql.query<{ id: unknown }>(
        `SELECT id FROM prospects WHERE artifact_url = $1`,
        [input.artifactUrl],
      );
      if (!existing.rows[0]) throw new Error("Prospect artifact disappeared during insert.");
      return { id: num(existing.rows[0].id), inserted: false };
    },

    async getProspect(id: number): Promise<ProspectRow | null> {
      const { rows } = await sql.query<ProspectRow>(`SELECT * FROM prospects WHERE id = $1`, [id]);
      return rows[0] ? prospectRow(rows[0]) : null;
    },

    async listProspects(limit = 100): Promise<ProspectRow[]> {
      const { rows } = await sql.query<ProspectRow>(
        `SELECT * FROM prospects
         ORDER BY
           CASE scan_status
             WHEN 'complete' THEN 0
             WHEN 'scanning' THEN 1
             WHEN 'queued' THEN 2
             ELSE 3
           END,
           COALESCE(critical_count, -1) DESC,
           discovered_at DESC
         LIMIT $1`,
        [Math.min(500, Math.max(1, limit))],
      );
      return rows.map(prospectRow);
    },

    async prospectStats(): Promise<{
      total: number;
      actionable: number;
      queued: number;
      contacted: number;
    }> {
      const { rows } = await sql.query<{
        total: unknown;
        actionable: unknown;
        queued: unknown;
        contacted: unknown;
      }>(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE scan_status = 'complete' AND critical_count > 0)::int AS actionable,
           count(*) FILTER (WHERE scan_status IN ('queued', 'scanning'))::int AS queued,
           count(*) FILTER (WHERE status = 'contacted')::int AS contacted
         FROM prospects`,
      );
      return {
        total: num(rows[0]?.total ?? 0),
        actionable: num(rows[0]?.actionable ?? 0),
        queued: num(rows[0]?.queued ?? 0),
        contacted: num(rows[0]?.contacted ?? 0),
      };
    },

    async startProspectScan(id: number): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'scanning', error = NULL, updated_at = now()
         WHERE id = $1`,
        [id],
      );
    },

    async queueProspectScan(id: number): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'queued', error = NULL, updated_at = now()
         WHERE id = $1`,
        [id],
      );
    },

    async completeProspectScan(
      id: number,
      report: { fileCount: number; findings: unknown[] },
    ): Promise<void> {
      const critical = report.findings.filter(
        (finding) =>
          finding &&
          typeof finding === "object" &&
          "severity" in finding &&
          finding.severity === "critical",
      ).length;
      const warnings = report.findings.length - critical;
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'complete',
             file_count = $2,
             critical_count = $3,
             warning_count = $4,
             findings = $5::jsonb,
             error = NULL,
             scanned_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [id, report.fileCount, critical, warnings, JSON.stringify(report.findings)],
      );
    },

    async failProspectScan(id: number, error: string): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'failed', error = $2, updated_at = now()
         WHERE id = $1`,
        [id, error.slice(0, 2000)],
      );
    },

    async updateProspectStatus(id: number, status: ProspectStatus): Promise<ProspectRow | null> {
      const { rows } = await sql.query<ProspectRow>(
        `UPDATE prospects
         SET status = $2,
             contacted_at = CASE WHEN $2 = 'contacted' THEN COALESCE(contacted_at, now()) ELSE contacted_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id, status],
      );
      return rows[0] ? prospectRow(rows[0]) : null;
    },

    async listInstallationsForUser(userId: string): Promise<
      {
        id: number;
        account_login: string;
        account_type: string;
        suspended: boolean;
        trialEndsAt: string | null;
        plan: string | null;
        lastPermissionTestAt: string | null;
        lastPermissionTest: PermissionTestResult | null;
      }[]
    > {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
        suspended: boolean;
        trial_ends_at: string | Date | null;
        plan: string | null;
        last_permission_test_at: string | Date | null;
        last_permission_test: unknown;
      }>(
        `SELECT i.id, i.account_login, i.account_type, i.suspended,
                i.last_permission_test_at, i.last_permission_test,
                b.trial_ends_at, b.plan
         FROM installations i
         JOIN installation_users iu ON iu.installation_id = i.id
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE iu.user_id = $1
         ORDER BY i.account_login`,
        [userId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        account_login: row.account_login,
        account_type: row.account_type,
        suspended: Boolean(row.suspended),
        trialEndsAt: iso(row.trial_ends_at),
        plan: row.plan,
        lastPermissionTestAt: iso(row.last_permission_test_at),
        lastPermissionTest: permissionTestFromDb(row.last_permission_test),
      }));
    },

    async userOwnsInstallation(userId: string, installationId: number): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM installation_users
         WHERE user_id = $1 AND installation_id = $2`,
        [userId, installationId],
      );
      return num(rows[0]?.n ?? 0) > 0;
    },

    async listWatchedPackagesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<WatchedPackageRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `SELECT wp.*
         FROM watched_packages wp
         JOIN installation_users iu ON iu.installation_id = wp.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR wp.installation_id = $2)
         ORDER BY wp.package_name`,
        [userId, scoped],
      );
      return rows.map(watchedPackageRow);
    },

    async listAllWatchedPackages(): Promise<WatchedPackageRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_packages ORDER BY id`);
      return rows.map(watchedPackageRow);
    },

    async getWatchedPackage(id: number): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_packages WHERE id = $1`, [id]);
      return rows[0] ? watchedPackageRow(rows[0]) : null;
    },

    async insertPackageProtection(input: {
      installationId: number;
      packageId: number;
      verifiedVia: PackageProtectionRow["verified_via"];
      githubRepo?: string | null;
    }): Promise<PackageProtectionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO package_protections (installation_id, package_id, verified_via, github_repo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (package_id) DO NOTHING
         RETURNING *`,
        [input.installationId, input.packageId, input.verifiedVia, input.githubRepo ?? null],
      );
      return rows[0] ? packageProtectionRow(rows[0]) : null;
    },

    async getPackageProtection(packageId: number): Promise<PackageProtectionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(`SELECT * FROM package_protections WHERE package_id = $1`, [packageId]);
      return rows[0] ? packageProtectionRow(rows[0]) : null;
    },

    async listPackageProtectionsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<PackageProtectionRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(
        `SELECT p.*
         FROM package_protections p
         JOIN installation_users iu ON iu.installation_id = p.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR p.installation_id = $2)
         ORDER BY p.created_at DESC`,
        [userId, scoped],
      );
      return rows.map(packageProtectionRow);
    },

    async latestPackageIdentitySnapshot(
      packageId: number,
    ): Promise<PackageIdentitySnapshotRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        version: string | null;
        maintainers: unknown;
        repository_url: string | null;
        homepage: string | null;
        bin_names: unknown;
        lifecycle_scripts: unknown;
        created_at: string | Date;
      }>(
        `SELECT * FROM package_identity_snapshots WHERE package_id = $1 ORDER BY id DESC LIMIT 1`,
        [packageId],
      );
      return rows[0] ? packageIdentitySnapshotRow(rows[0]) : null;
    },

    async insertPackageIdentitySnapshot(input: {
      installationId: number;
      packageId: number;
      version?: string | null;
      maintainers: string[];
      repositoryUrl?: string | null;
      homepage?: string | null;
      binNames: string[];
      lifecycleScripts: string[];
    }): Promise<PackageIdentitySnapshotRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        version: string | null;
        maintainers: unknown;
        repository_url: string | null;
        homepage: string | null;
        bin_names: unknown;
        lifecycle_scripts: unknown;
        created_at: string | Date;
      }>(
        `INSERT INTO package_identity_snapshots (
           installation_id, package_id, version, maintainers, repository_url, homepage,
           bin_names, lifecycle_scripts
         )
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb)
         RETURNING *`,
        [
          input.installationId,
          input.packageId,
          input.version ?? null,
          JSON.stringify(input.maintainers),
          input.repositoryUrl ?? null,
          input.homepage ?? null,
          JSON.stringify(input.binNames),
          JSON.stringify(input.lifecycleScripts),
        ],
      );
      if (!rows[0]) throw new Error("package identity snapshot insert returned no row");
      return packageIdentitySnapshotRow(rows[0]);
    },

    async countWatchedPackages(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM watched_packages WHERE installation_id = $1`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async insertWatchedPackage(
      installationId: number,
      packageName: string,
      registryOrigin: string = PUBLIC_NPM_ORIGIN,
    ): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `INSERT INTO watched_packages (installation_id, package_name, registry_origin)
         VALUES ($1, $2, $3)
         ON CONFLICT (installation_id, package_name, registry_origin) DO NOTHING
         RETURNING *`,
        [installationId, packageName, registryOrigin],
      );
      return rows[0] ? watchedPackageRow(rows[0]) : null;
    },

    async deleteWatchedPackageForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM watched_packages wp
         USING installation_users iu
         WHERE wp.id = $1
           AND wp.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING wp.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async countNpmRegistries(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM npm_registries WHERE installation_id = $1`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async listNpmRegistriesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NpmRegistryRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin: string;
        host: string;
        updated_at: string | Date;
      }>(
        `SELECT r.id, r.installation_id, r.origin, r.host, r.updated_at
         FROM npm_registries r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR r.installation_id = $2)
         ORDER BY r.host`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installation_id: num(row.installation_id),
        origin: row.origin,
        host: row.host,
        updated_at: iso(row.updated_at) ?? new Date().toISOString(),
      }));
    },

    async upsertNpmRegistry(input: {
      installationId: number;
      origin: string;
      host: string;
      token: string;
    }): Promise<NpmRegistryRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt registry tokens."), { status: 400 });
      }
      const ciphertext = encryptSecret(input.token, tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin: string;
        host: string;
        updated_at: string | Date;
      }>(
        `INSERT INTO npm_registries (installation_id, origin, host, token_ciphertext)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (installation_id, origin) DO UPDATE SET
           host = excluded.host,
           token_ciphertext = excluded.token_ciphertext,
           updated_at = now()
         RETURNING id, installation_id, origin, host, updated_at`,
        [input.installationId, input.origin, input.host, ciphertext],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save the registry token.");
      return {
        id: num(row.id),
        installation_id: num(row.installation_id),
        origin: row.origin,
        host: row.host,
        updated_at: iso(row.updated_at) ?? new Date().toISOString(),
      };
    },

    async deleteNpmRegistryForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM npm_registries r
         USING installation_users iu
         WHERE r.id = $1
           AND r.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING r.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getNpmRegistryAuth(
      installationId: number,
      origin: string,
    ): Promise<{ origin: string; host: string; token: string } | null> {
      const { rows } = await sql.query<{ origin: string; host: string; token_ciphertext: string }>(
        `SELECT origin, host, token_ciphertext
         FROM npm_registries
         WHERE installation_id = $1 AND origin = $2`,
        [installationId, origin],
      );
      const row = rows[0];
      if (!row || !tokenSecret) return null;
      return {
        origin: row.origin,
        host: row.host,
        token: decryptSecret(row.token_ciphertext, tokenSecret),
      };
    },

    async listNotificationDestinationsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NotificationDestinationRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.kind, d.host, d.last_delivery_at,
                d.last_delivery_status, d.last_delivery_error, d.updated_at
         FROM notification_destinations d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR d.installation_id = $2)
         ORDER BY d.kind`,
        [userId, scoped],
      );
      return rows.map((row) => destinationRow(row));
    },

    async getNotificationDestinationForUser(
      id: number,
      userId: string,
    ): Promise<NotificationDestinationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.kind, d.host, d.last_delivery_at,
                d.last_delivery_status, d.last_delivery_error, d.updated_at
         FROM notification_destinations d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE d.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      const row = rows[0];
      if (!row) return null;
      return destinationRow(row);
    },

    async upsertSlackDestination(input: {
      installationId: number;
      webhookUrl: string;
      host: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({ ...input, kind: "slack" });
    },

    async upsertSiemDestination(input: {
      installationId: number;
      webhookUrl: string;
      host: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({ ...input, kind: "siem" });
    },

    async upsertNotificationDestination(input: {
      installationId: number;
      kind: NotificationKind;
      webhookUrl: string;
      host: string;
    }): Promise<NotificationDestinationRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt notification webhooks."), {
          status: 400,
        });
      }
      const ciphertext = encryptSecret(input.webhookUrl, tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `INSERT INTO notification_destinations (
           installation_id, kind, host, webhook_ciphertext
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (installation_id, kind) DO UPDATE SET
           host = excluded.host,
           webhook_ciphertext = excluded.webhook_ciphertext,
           updated_at = now()
         RETURNING id, installation_id, kind, host, last_delivery_at,
                   last_delivery_status, last_delivery_error, updated_at`,
        [input.installationId, input.kind, input.host, ciphertext],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save that webhook.");
      return destinationRow(row);
    },

    async deleteNotificationDestinationForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM notification_destinations d
         USING installation_users iu
         WHERE d.id = $1
           AND d.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING d.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getSlackWebhookForInstallation(installationId: number): Promise<{
      id: number;
      url: string;
    } | null> {
      return await this.getDestinationWebhookForInstallation(installationId, "slack");
    },

    async getSiemWebhookForInstallation(installationId: number): Promise<{
      id: number;
      url: string;
    } | null> {
      return await this.getDestinationWebhookForInstallation(installationId, "siem");
    },

    async getDestinationWebhookForInstallation(
      installationId: number,
      kind: NotificationKind,
    ): Promise<{
      id: number;
      url: string;
    } | null> {
      const { rows } = await sql.query<{ id: unknown; webhook_ciphertext: string }>(
        `SELECT id, webhook_ciphertext
         FROM notification_destinations
         WHERE installation_id = $1 AND kind = $2`,
        [installationId, kind],
      );
      const row = rows[0];
      if (!row || !tokenSecret) return null;
      return { id: num(row.id), url: decryptSecret(row.webhook_ciphertext, tokenSecret) };
    },

    async recordNotificationDelivery(input: {
      installationId: number;
      destinationId: number;
      alertId?: number | null;
      kind: NotificationKind;
      status: "sent" | "failed";
      error?: string | null;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO notification_deliveries (
           installation_id, destination_id, alert_id, kind, status, invented_incident, error
         )
         VALUES ($1, $2, $3, $4, $5, false, $6)`,
        [
          input.installationId,
          input.destinationId,
          input.alertId ?? null,
          input.kind,
          input.status,
          input.error ?? null,
        ],
      );
      await sql.query(
        `UPDATE notification_destinations
         SET last_delivery_at = now(),
             last_delivery_status = $2,
             last_delivery_error = $3,
             updated_at = now()
         WHERE id = $1`,
        [input.destinationId, input.status, input.error ?? null],
      );
    },

    async listNotificationDeliveriesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NotificationDeliveryRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        alert_id: unknown;
        kind: string;
        status: "sent" | "failed";
        error: string | null;
        created_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.destination_id, d.alert_id, d.kind, d.status,
                d.error, d.created_at
         FROM notification_deliveries d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR d.installation_id = $2)
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT 50`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installationId: num(row.installation_id),
        destinationId: num(row.destination_id),
        alertId: row.alert_id === null || row.alert_id === undefined ? null : num(row.alert_id),
        kind: asNotificationKind(row.kind),
        status: row.status,
        inventedIncident: false,
        error: row.error,
        createdAt: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async countScanApiTokens(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM scan_api_tokens
         WHERE installation_id = $1 AND revoked_at IS NULL`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async listScanApiTokensForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<ScanApiTokenRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        name: string;
        token_prefix: string;
        created_by_login: string;
        last_used_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT t.id, t.installation_id, t.name, t.token_prefix, t.created_by_login,
                t.last_used_at, t.created_at
         FROM scan_api_tokens t
         JOIN installation_users iu ON iu.installation_id = t.installation_id
         WHERE iu.user_id = $1 AND t.revoked_at IS NULL
           AND ($2::bigint IS NULL OR t.installation_id = $2)
         ORDER BY t.created_at DESC`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installation_id: num(row.installation_id),
        name: row.name,
        token_prefix: row.token_prefix,
        created_by_login: row.created_by_login,
        last_used_at: iso(row.last_used_at),
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async insertScanApiToken(input: {
      installationId: number;
      name: string;
      createdByLogin: string;
    }): Promise<ScanApiTokenRow & { token: string }> {
      const minted = mintScanToken();
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        name: string;
        token_prefix: string;
        created_by_login: string;
        last_used_at: string | Date | null;
        created_at: string | Date;
      }>(
        `INSERT INTO scan_api_tokens (
           installation_id, name, token_prefix, token_hash, created_by_login
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, installation_id, name, token_prefix, created_by_login, last_used_at, created_at`,
        [input.installationId, input.name, minted.tokenPrefix, minted.tokenHash, input.createdByLogin],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not mint a scan API token.");
      return {
        id: num(row.id),
        installation_id: num(row.installation_id),
        name: row.name,
        token_prefix: row.token_prefix,
        created_by_login: row.created_by_login,
        last_used_at: iso(row.last_used_at),
        created_at: iso(row.created_at) ?? new Date().toISOString(),
        token: minted.token,
      };
    },

    async revokeScanApiTokenForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `UPDATE scan_api_tokens t
         SET revoked_at = now()
         FROM installation_users iu
         WHERE t.id = $1
           AND t.revoked_at IS NULL
           AND t.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING t.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async authenticateScanToken(
      token: string,
    ): Promise<{ id: number; installationId: number } | null> {
      const hash = hashScanToken(token);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        token_hash: string;
      }>(
        `SELECT id, installation_id, token_hash
         FROM scan_api_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hash],
      );
      const row = rows[0];
      if (!row || !hashesMatch(row.token_hash, hash)) return null;
      return { id: num(row.id), installationId: num(row.installation_id) };
    },

    async touchScanApiToken(id: number): Promise<void> {
      await sql.query(`UPDATE scan_api_tokens SET last_used_at = now() WHERE id = $1`, [id]);
    },

    async touchWatchedPackage(
      id: number,
      input: {
        version?: string | null;
        distTags?: Record<string, string> | null;
        tarballUrl?: string | null;
        shasum?: string | null;
      },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_packages SET
           last_checked_at = now(),
           last_version = COALESCE($2, last_version),
           last_dist_tags = COALESCE($3::jsonb, last_dist_tags),
           last_tarball_url = COALESCE($4, last_tarball_url),
           last_shasum = COALESCE($5, last_shasum)
         WHERE id = $1`,
        [
          id,
          input.version ?? null,
          input.distTags ? JSON.stringify(input.distTags) : null,
          input.tarballUrl ?? null,
          input.shasum ?? null,
        ],
      );
    },

    async recordWatchedPackageScan(
      id: number,
      input: { sha256: string | null; status: string },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_packages SET
           last_scanned_at = now(),
           last_scan_status = $2,
           last_sha256 = COALESCE($3, last_sha256)
         WHERE id = $1`,
        [id, input.status, input.sha256],
      );
    },

    async insertScanReceipt(input: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      receipt: SignedReceipt;
    }): Promise<ScanReceiptRow> {
      const signed = input.receipt;
      if (signed.status === "passed" && signed.ok !== true) {
        throw new Error("cannot mint a passing receipt for a failed scan");
      }
      if (signed.status === "inconclusive" && signed.ok) {
        throw new Error("inconclusive receipts cannot be marked ok");
      }
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `INSERT INTO scan_receipts (
           installation_id, package_id, repo_id, coordinate,
           artifact_sha256, artifact_sha512, artifact_bytes,
           status, engine_version, manifest, finding_fingerprints,
           signature, receipt
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb
         )
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.repoId ?? null,
          signed.coordinate,
          signed.artifactSha256,
          signed.artifactSha512,
          signed.artifactBytes,
          signed.status,
          signed.engineVersion,
          JSON.stringify(signed.manifest),
          JSON.stringify(signed.findingFingerprints),
          signed.signature,
          JSON.stringify(signed),
        ],
      );
      if (!rows[0]) throw new Error("scan receipt insert returned no row");
      return scanReceiptRow(rows[0]);
    },

    async getScanReceiptForUser(id: number, userId: string): Promise<ScanReceiptRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT sr.*
         FROM scan_receipts sr
         JOIN installation_users iu ON iu.installation_id = sr.installation_id
         WHERE sr.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      return rows[0] ? scanReceiptRow(rows[0]) : null;
    },

    async listScanReceiptsForUser(
      userId: string,
      opts: { packageId?: number; repoId?: number; limit?: number } = {},
    ): Promise<ScanReceiptRow[]> {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT sr.*
         FROM scan_receipts sr
         JOIN installation_users iu ON iu.installation_id = sr.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR sr.package_id = $2)
           AND ($3::bigint IS NULL OR sr.repo_id = $3)
         ORDER BY sr.created_at DESC, sr.id DESC
         LIMIT $4`,
        [userId, opts.packageId ?? null, opts.repoId ?? null, limit],
      );
      return rows.map(scanReceiptRow);
    },

    async latestScanReceipts(opts: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      coordinate?: string | null;
      limit?: number;
    }): Promise<ScanReceiptRow[]> {
      const limit = Math.min(10, Math.max(1, opts.limit ?? 2));
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM scan_receipts
         WHERE installation_id = $1
           AND (
             ($2::bigint IS NOT NULL AND package_id = $2)
             OR ($2::bigint IS NULL AND $3::bigint IS NOT NULL AND repo_id = $3 AND ($4::text IS NULL OR coordinate = $4))
             OR ($2::bigint IS NULL AND $3::bigint IS NULL AND $4::text IS NOT NULL AND coordinate = $4)
           )
         ORDER BY id DESC
         LIMIT $5`,
        [
          opts.installationId,
          opts.packageId ?? null,
          opts.repoId ?? null,
          opts.coordinate ?? null,
          limit,
        ],
      );
      return rows.map(scanReceiptRow);
    },

    async getScanReceipt(id: number): Promise<ScanReceiptRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(`SELECT * FROM scan_receipts WHERE id = $1`, [id]);
      return rows[0] ? scanReceiptRow(rows[0]) : null;
    },

    async latestReleaseRevision(
      installationId: number,
      coordinate: string,
      channel: ReleaseChannel,
    ): Promise<ReleaseRevisionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        channel: string;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        source_revision: string | null;
        ci_run_url: string | null;
        previous_sha256: string | null;
        mismatch: boolean | unknown;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM release_revisions
         WHERE installation_id = $1 AND coordinate = $2 AND channel = $3
         ORDER BY id DESC
         LIMIT 1`,
        [installationId, coordinate, channel],
      );
      return rows[0] ? releaseRevisionRow(rows[0]) : null;
    },

    async insertReleaseRevision(input: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      receiptId: number;
      channel: ReleaseChannel;
      coordinate: string;
      artifactSha256: string;
      artifactSha512?: string | null;
      sourceRevision?: string | null;
      ciRunUrl?: string | null;
      previousSha256?: string | null;
      mismatch: boolean;
    }): Promise<ReleaseRevisionRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        channel: string;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        source_revision: string | null;
        ci_run_url: string | null;
        previous_sha256: string | null;
        mismatch: boolean | unknown;
        created_at: string | Date;
      }>(
        `INSERT INTO release_revisions (
           installation_id, package_id, repo_id, receipt_id, channel, coordinate,
           artifact_sha256, artifact_sha512, source_revision, ci_run_url,
           previous_sha256, mismatch
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.repoId ?? null,
          input.receiptId,
          input.channel,
          input.coordinate,
          input.artifactSha256,
          input.artifactSha512 ?? null,
          input.sourceRevision ?? null,
          input.ciRunUrl ?? null,
          input.previousSha256 ?? null,
          input.mismatch,
        ],
      );
      if (!rows[0]) throw new Error("release revision insert returned no row");
      return releaseRevisionRow(rows[0]);
    },

    async listReleaseRevisionsForUser(
      userId: string,
      opts: { limit?: number; installationId?: number | null } = {},
    ): Promise<ReleaseRevisionRow[]> {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const scoped = optionalInstallId(opts.installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        channel: string;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        source_revision: string | null;
        ci_run_url: string | null;
        previous_sha256: string | null;
        mismatch: boolean | unknown;
        created_at: string | Date;
      }>(
        `SELECT rr.*
         FROM release_revisions rr
         JOIN installation_users iu ON iu.installation_id = rr.installation_id
         WHERE iu.user_id = $1
           AND ($3::bigint IS NULL OR rr.installation_id = $3)
         ORDER BY rr.created_at DESC, rr.id DESC
         LIMIT $2`,
        [userId, limit, scoped],
      );
      return rows.map(releaseRevisionRow);
    },

    async getReleaseRevisionForUser(
      id: number,
      userId: string,
    ): Promise<ReleaseRevisionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        channel: string;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        source_revision: string | null;
        ci_run_url: string | null;
        previous_sha256: string | null;
        mismatch: boolean | unknown;
        created_at: string | Date;
      }>(
        `SELECT rr.*
         FROM release_revisions rr
         JOIN installation_users iu ON iu.installation_id = rr.installation_id
         WHERE rr.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      return rows[0] ? releaseRevisionRow(rows[0]) : null;
    },

    async listActiveExceptions(
      installationId: number,
      packageId?: number | null,
    ): Promise<PolicyExceptionRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM policy_exceptions
         WHERE installation_id = $1
           AND revoked_at IS NULL
           AND expires_at > now()
           AND (package_id IS NULL OR ($2::bigint IS NOT NULL AND package_id = $2))
         ORDER BY id ASC`,
        [installationId, packageId ?? null],
      );
      return rows.map(policyExceptionRow);
    },

    async listExceptionsForUser(
      userId: string,
      opts: { installationId?: number; packageId?: number | null } = {},
    ): Promise<PolicyExceptionRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `SELECT pe.*
         FROM policy_exceptions pe
         JOIN installation_users iu ON iu.installation_id = pe.installation_id
         WHERE iu.user_id = $1
           AND pe.revoked_at IS NULL
           AND ($2::bigint IS NULL OR pe.installation_id = $2)
           AND (
             $3::bigint IS NULL
             OR pe.package_id IS NULL
             OR pe.package_id = $3
           )
         ORDER BY pe.created_at DESC, pe.id DESC`,
        [userId, opts.installationId ?? null, opts.packageId ?? null],
      );
      return rows.map(policyExceptionRow);
    },

    async insertPolicyException(input: {
      installationId: number;
      packageId?: number | null;
      rule: string;
      pathPattern: string | null;
      reason: string;
      actorUserId: string;
      actorLogin: string;
      expiresAt: Date | string;
    }): Promise<PolicyExceptionRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO policy_exceptions (
           installation_id, package_id, rule, path_pattern, reason,
           actor_user_id, actor_login, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.rule,
          input.pathPattern,
          input.reason,
          input.actorUserId,
          input.actorLogin,
          input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt,
        ],
      );
      if (!rows[0]) throw new Error("policy exception insert returned no row");
      return policyExceptionRow(rows[0]);
    },

    async revokePolicyExceptionForUser(
      id: number,
      userId: string,
      revokedBy: string,
    ): Promise<PolicyExceptionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `UPDATE policy_exceptions pe
         SET revoked_at = now(), revoked_by = $3
         FROM installation_users iu
         WHERE pe.id = $1
           AND pe.revoked_at IS NULL
           AND pe.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING pe.*`,
        [id, userId, revokedBy],
      );
      return rows[0] ? policyExceptionRow(rows[0]) : null;
    },

    async getActiveBaseline(
      installationId: number,
      packageId: number,
    ): Promise<ScanBaselineRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        created_at: string | Date;
        superseded_at: string | Date | null;
      }>(
        `SELECT *
         FROM scan_baselines
         WHERE installation_id = $1
           AND package_id = $2
           AND superseded_at IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [installationId, packageId],
      );
      return rows[0] ? scanBaselineRow(rows[0]) : null;
    },

    async insertScanBaseline(input: {
      installationId: number;
      packageId: number;
      repoId?: number | null;
      receiptId: number;
      reason: string;
      actorUserId: string;
      actorLogin: string;
    }): Promise<ScanBaselineRow> {
      return await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE scan_baselines
           SET superseded_at = now()
           WHERE installation_id = $1
             AND package_id = $2
             AND superseded_at IS NULL`,
          [input.installationId, input.packageId],
        );
        const { rows } = await tx.query<{
          id: unknown;
          installation_id: unknown;
          package_id: unknown;
          repo_id: unknown;
          receipt_id: unknown;
          reason: string;
          actor_user_id: string;
          actor_login: string;
          created_at: string | Date;
          superseded_at: string | Date | null;
        }>(
          `INSERT INTO scan_baselines (
             installation_id, package_id, repo_id, receipt_id, reason,
             actor_user_id, actor_login
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.installationId,
            input.packageId,
            input.repoId ?? null,
            input.receiptId,
            input.reason,
            input.actorUserId,
            input.actorLogin,
          ],
        );
        if (!rows[0]) throw new Error("scan baseline insert returned no row");
        return scanBaselineRow(rows[0]);
      });
    },
  };
}

export type Store = ReturnType<typeof createStore>;

export function signSession(secret: string, sessionId: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${mac}`;
}

export function readSignedSession(secret: string, cookie: string | undefined): string | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return id;
}
