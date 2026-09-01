import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

export function createStore(sql: SqlClient) {
  return {
    sql,

    async upsertUser(input: {
      id: string;
      login: string;
      avatarUrl?: string;
      accessToken?: string;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO users (id, login, avatar_url, access_token, trial_ends_at, plan)
         VALUES ($1, $2, $3, $4, now() + interval '14 days', 'trial')
         ON CONFLICT (id) DO UPDATE SET
           login = excluded.login,
           avatar_url = excluded.avatar_url,
           access_token = COALESCE(excluded.access_token, users.access_token),
           trial_ends_at = COALESCE(users.trial_ends_at, now() + interval '14 days'),
           plan = COALESCE(users.plan, 'trial')`,
        [input.id, input.login, input.avatarUrl ?? null, input.accessToken ?? null],
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

    async upsertInstallation(input: {
      id: number;
      accountLogin: string;
      accountType: string;
      accountId: number;
      suspended?: boolean;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO installations (id, account_login, account_type, account_id, suspended)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           account_login = excluded.account_login,
           account_type = excluded.account_type,
           account_id = excluded.account_id,
           suspended = excluded.suspended`,
        [input.id, input.accountLogin, input.accountType, input.accountId, input.suspended ?? false],
      );
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
      if (error) {
        await sql.query(
          `UPDATE jobs SET status = 'failed', error = $2, locked_at = NULL, locked_by = NULL WHERE id = $1`,
          [id, error],
        );
        return;
      }
      await sql.query(
        `UPDATE jobs SET status = 'done', error = NULL, locked_at = NULL, locked_by = NULL WHERE id = $1`,
        [id],
      );
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
      { id: number; account_login: string; account_type: string }[]
    > {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
      }>(
        `SELECT i.id, i.account_login, i.account_type
         FROM installations i
         JOIN installation_users iu ON iu.installation_id = i.id
         WHERE iu.user_id = $1
         ORDER BY i.account_login`,
        [userId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        account_login: row.account_login,
        account_type: row.account_type,
      }));
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
