import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { coverageFrom, coverageIsOn } from "../coverage.ts";
import type { SignedReceipt } from "../receipt.ts";
import type { ManifestEntry, ScanStatus } from "../scanner/types.ts";
import { decryptSecret, encryptSecret, looksEncrypted } from "./secret-box.ts";
import { num, type SqlClient } from "./sql.ts";

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
  created_at: string;
  full_name?: string | null;
};

export type WatchedPackageRow = {
  id: number;
  installation_id: number;
  package_name: string;
  last_version: string | null;
  last_dist_tags: Record<string, string> | null;
  last_tarball_url: string | null;
  last_shasum: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
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

    async installationWorkAllowed(installationId: number): Promise<boolean> {
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
      if (!row || row.suspended) return false;
      return coverageIsOn(coverageFrom(iso(row.trial_ends_at), row.plan));
    },

    async deleteInstallation(id: number): Promise<void> {
      await sql.query(`DELETE FROM installations WHERE id = $1`, [id]);
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

    async listReposForUser(userId: string): Promise<RepoRow[]> {
      const { rows } = await sql.query<RepoRow>(
        `SELECT r.*
         FROM repos r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
         ORDER BY r.full_name`,
        [userId],
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
    }): Promise<{ id: number | null; inserted: boolean }> {
      const { rows } = await sql.query<{ id: unknown }>(
        `INSERT INTO jobs (delivery_id, priority, kind, payload)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (delivery_id) WHERE delivery_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          input.deliveryId ?? null,
          input.priority,
          input.kind,
          JSON.stringify(input.payload),
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
    },

    async listAlertsForUser(userId: string): Promise<AlertRow[]> {
      const { rows } = await sql.query<AlertRow>(
        `SELECT a.*, r.full_name
         FROM alerts a
         LEFT JOIN repos r ON r.id = a.repo_id
         WHERE a.installation_id IN (
           SELECT installation_id FROM installation_users WHERE user_id = $1
         )
         ORDER BY a.created_at DESC
         LIMIT 100`,
        [userId],
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
        repo_id: row.repo_id === null ? null : num(row.repo_id),
        findings: parsePayload(row.findings),
      }));
    },

    async hasRecentAlert(repoId: number, kind: string, sinceIso: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM alerts
         WHERE repo_id = $1 AND kind = $2 AND created_at > $3::timestamptz`,
        [repoId, kind, sinceIso],
      );
      return num(rows[0]?.n ?? 0) > 0;
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
      }[]
    > {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
        suspended: boolean;
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT i.id, i.account_login, i.account_type, i.suspended,
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

    async listWatchedPackagesForUser(userId: string): Promise<WatchedPackageRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
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
         ORDER BY wp.package_name`,
        [userId],
      );
      return rows.map(watchedPackageRow);
    },

    async listAllWatchedPackages(): Promise<WatchedPackageRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
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
    ): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `INSERT INTO watched_packages (installation_id, package_name)
         VALUES ($1, $2)
         ON CONFLICT (installation_id, package_name) DO NOTHING
         RETURNING *`,
        [installationId, packageName],
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
