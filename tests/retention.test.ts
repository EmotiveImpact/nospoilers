import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import {
  CONFIRM_MISMATCH_ERROR,
  CONFIRM_MISSING_ERROR,
} from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  parseRetentionDays,
  retentionConfirmToken,
  retentionPlanDenied,
  RETENTION_DEFAULT_DAYS,
} from "../src/server/retention.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { coverageFrom } from "../src/coverage.ts";

const SECRET = "test-webhook-secret";
const json = { "content-type": "application/json" };

function unusedGithub(): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub mock: unexpected call");
  };
  return {
    exchangeCode: fail,
    getUser: fail,
    listUserInstallations: fail,
    getInstallation: fail,
    getRepo: fail,
    listReleaseAssets: fail,
    getLatestRelease: fail,
    downloadAsset: fail,
    ...skippedGithubWrites(),
  };
}

function appFor(store: ReturnType<typeof createStore>) {
  return createApp({
    config: loadConfig({
      databaseUrl: "pglite://:memory:",
      githubWebhookSecret: SECRET,
      githubAppId: "1",
      githubPrivateKey: "x",
      githubClientId: "c",
      githubClientSecret: "s",
      sessionSecret: "sess",
    }),
    store,
    github: unusedGithub(),
  });
}

describe("configurable retention", () => {
  it("parses windows and allows Solo writes while unpaid coverage is denied", () => {
    expect(parseRetentionDays(90)).toBe(90);
    expect(parseRetentionDays("180")).toBe(180);
    expect(parseRetentionDays(365)).toBe(365);
    expect(parseRetentionDays(0)).toBe(0);
    expect(parseRetentionDays(14)).toBeNull();
    expect(retentionConfirmToken(90)).toBe("90");
    expect(retentionConfirmToken(0)).toBe("keep");
    expect(retentionPlanDenied(coverageFrom(null, "solo"))).toBeNull();
    expect(retentionPlanDenied(coverageFrom(new Date(Date.now() + 86400000).toISOString(), "trial"))).toBeNull();
    expect(retentionPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(RETENTION_DEFAULT_DAYS).toBe(90);
  });

  it("hides old list rows without deleting append-only evidence", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertUser({ id: "u3", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "acme",
        accountType: "Organization",
        accountId: 2,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(8, "u1");
      await store.linkUserInstallation(11, "u3");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });

      const oldAlertId = await store.insertAlert({
        installationId: 7,
        repoId: 99,
        kind: "repo_publicized",
        title: "octo/old flipped to public",
        body: "Too old for the default window.",
      });
      await sql.query(`UPDATE alerts SET created_at = now() - interval '100 days' WHERE id = $1`, [
        oldAlertId,
      ]);
      await sql.query(
        `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail, created_at)
         VALUES ($1, 7, 'octo', 'acknowledged', NULL, now() - interval '100 days')`,
        [oldAlertId],
      );

      const recentId = await store.insertAlert({
        installationId: 7,
        repoId: 99,
        kind: "repo_created_public",
        title: "octo/throwaway was created public",
        body: "Recent.",
      });
      expect(recentId).toBeGreaterThan(0);

      await sql.query(
        `INSERT INTO audit_events (
           installation_id, actor_login, action, summary, target_kind, target_id, created_at
         )
         VALUES (
           7, 'octo', 'destination.save', 'Saved Slack destination', 'destination',
           'hooks.slack.com', now() - interval '100 days'
         )`,
      );

      await sql.query(
        `INSERT INTO notification_destinations (installation_id, kind, host, webhook_ciphertext)
         VALUES (7, 'slack', 'hooks.slack.com', 'ns1.dummy')`,
      );
      const { rows: destRows } = await sql.query<{ id: unknown }>(
        `SELECT id FROM notification_destinations WHERE installation_id = 7`,
      );
      await sql.query(
        `INSERT INTO notification_deliveries (
           installation_id, destination_id, alert_id, kind, status, created_at
         )
         VALUES (7, $1, $2, 'slack', 'sent', now() - interval '100 days')`,
        [destRows[0]?.id, oldAlertId],
      );

      await sql.query(
        `INSERT INTO scan_receipts (
           installation_id, coordinate, status, engine_version, manifest, finding_fingerprints, signature, receipt
         )
         VALUES (7, 'npm:left-pad@1.0.0', 'passed', 'test', '{}'::jsonb, '[]'::jsonb, 'sig', '{}'::jsonb)`,
      );
      await sql.query(
        `UPDATE scan_receipts SET created_at = now() - interval '100 days' WHERE installation_id = 7`,
      );

      const queued = await store.enqueueJob({
        priority: "light",
        kind: "repo_created_public",
        payload: { installationId: 7 },
        installationId: 7,
      });
      const done = await store.enqueueJob({
        priority: "light",
        kind: "release_scan",
        payload: { installationId: 7 },
        installationId: 7,
      });
      expect(queued.id).toBeTruthy();
      expect(done.id).toBeTruthy();
      const queuedId = queued.id as number;
      const doneId = done.id as number;
      await sql.query(`UPDATE jobs SET created_at = now() - interval '100 days' WHERE id = $1`, [
        queuedId,
      ]);
      await sql.query(
        `UPDATE jobs SET status = 'done', created_at = now() - interval '100 days' WHERE id = $1`,
        [doneId],
      );

      const { rows: within } = await sql.query<{ ok: boolean }>(
        `SELECT row_within_retention(7, now() - interval '100 days') AS ok`,
      );
      expect(within[0]?.ok).toBe(false);

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const member = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u3"))}`;

      const anon = await app.request("/api/retention");
      expect(anon.status).toBe(401);

      const missing = await app.request("/api/retention", { headers: { cookie } });
      expect(missing.status).toBe(400);

      const listed = await app.request("/api/alerts?installationId=7", { headers: { cookie } });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as { alerts: { id: number; title: string }[] };
      expect(listedBody.alerts.map((row) => row.id)).toEqual([recentId]);
      expect(JSON.stringify(listedBody)).not.toContain("old flipped");

      const { rows: alertCount } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM alerts WHERE installation_id = 7`,
      );
      expect(alertCount[0]?.n).toBe("2");

      const events = await app.request(`/api/alerts/${oldAlertId}/events`, { headers: { cookie } });
      expect(events.status).toBe(200);

      const jobs = await app.request("/api/jobs?installationId=7", { headers: { cookie } });
      const jobsBody = (await jobs.json()) as { jobs: { id: number; status: string }[] };
      expect(jobsBody.jobs.some((row) => row.id === queuedId && row.status === "queued")).toBe(true);
      expect(jobsBody.jobs.some((row) => row.id === doneId)).toBe(false);

      const receipts = await app.request("/api/receipts?installationId=7", { headers: { cookie } });
      const receiptBody = (await receipts.json()) as { receipts: { id: number }[] };
      expect(receiptBody.receipts).toEqual([]);
      const { rows: receiptCount } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM scan_receipts WHERE installation_id = 7`,
      );
      expect(receiptCount[0]?.n).toBe("1");
      const { rows: receiptIds } = await sql.query<{ id: unknown }>(
        `SELECT id FROM scan_receipts WHERE installation_id = 7`,
      );
      const receiptGet = await app.request(`/api/receipts/${Number(receiptIds[0]?.id)}`, {
        headers: { cookie },
      });
      expect(receiptGet.status).toBe(200);

      const timeline = await app.request("/api/timeline?installationId=7", { headers: { cookie } });
      expect(timeline.status).toBe(200);
      const timelineBody = (await timeline.json()) as { days: number; entries: { title: string | null }[] };
      expect(timelineBody.days).toBe(90);
      expect(JSON.stringify(timelineBody)).not.toContain("old flipped");

      const audit = await app.request("/api/audit?installationId=7", { headers: { cookie: member } });
      expect(audit.status).toBe(200);
      const auditBody = (await audit.json()) as { rows: { summary: string }[] };
      expect(JSON.stringify(auditBody)).not.toContain("Saved Slack destination");

      const memberGet = await app.request("/api/retention?installationId=7", { headers: { cookie: member } });
      expect(memberGet.status).toBe(200);
      expect(((await memberGet.json()) as { days: number }).days).toBe(90);

      const memberPut = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie: member, ...json },
        body: JSON.stringify({ installationId: 7, days: 180, confirm: "180" }),
      });
      expect(memberPut.status).toBe(403);
      expect(((await memberPut.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      await store.setRetentionDays(7, 365);
      const stolen = await app.request("/api/retention?installationId=7", { headers: { cookie: other } });
      expect(stolen.status).toBe(200);
      expect(((await stolen.json()) as { days: number }).days).toBe(90);
      await store.setRetentionDays(7, 90);

      const stolenPut = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie: other, ...json },
        body: JSON.stringify({ installationId: 7, days: 180, confirm: "180" }),
      });
      expect(stolenPut.status).toBe(403);

      const missingConfirm = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 180 }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const mismatch = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 180, confirm: "keep" }),
      });
      expect(mismatch.status).toBe(400);
      expect(((await mismatch.json()) as { error: string }).error).toBe(CONFIRM_MISMATCH_ERROR);

      const saved180 = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 180, confirm: "180" }),
      });
      expect(saved180.status).toBe(200);
      expect(((await saved180.json()) as { days: number }).days).toBe(180);

      const { rows: after180 } = await sql.query<{ ok: boolean }>(
        `SELECT row_within_retention(7, now() - interval '100 days') AS ok`,
      );
      expect(after180[0]?.ok).toBe(true);

      const listed180 = await app.request("/api/alerts?installationId=7", { headers: { cookie } });
      const listed180Body = (await listed180.json()) as { alerts: { id: number }[] };
      expect(listed180Body.alerts.map((row) => row.id).sort((a, b) => a - b)).toEqual(
        [oldAlertId, recentId].sort((a, b) => a - b),
      );

      const timeline180 = await app.request("/api/timeline?installationId=7", { headers: { cookie } });
      const timeline180Body = (await timeline180.json()) as {
        days: number;
        entries: { title: string | null }[];
      };
      expect(timeline180Body.days).toBe(180);
      expect(JSON.stringify(timeline180Body)).toContain("old flipped");

      const export180 = await app.request("/api/audit/export?installationId=7", { headers: { cookie } });
      expect(export180.status).toBe(200);
      const exportBody = (await export180.json()) as {
        audit: { action: string; summary: string }[];
        alerts: { title: string }[];
      };
      expect(exportBody.audit.some((row) => row.action === "retention.save")).toBe(true);
      expect(exportBody.audit.some((row) => row.summary.includes("180 days"))).toBe(true);
      expect(JSON.stringify(exportBody.audit)).not.toContain("ghu_");
      expect(exportBody.alerts.some((row) => row.title.includes("old flipped"))).toBe(true);

      const savedKeep = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 0, confirm: "keep" }),
      });
      expect(savedKeep.status).toBe(200);
      expect(((await savedKeep.json()) as { days: number }).days).toBe(0);

      const saved365 = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 365, confirm: "365" }),
      });
      expect(saved365.status).toBe(200);

      await expect(sql.query("DELETE FROM alert_events WHERE alert_id = $1", [oldAlertId])).rejects.toThrow(
        /append-only/,
      );
      await expect(sql.query("DELETE FROM notification_deliveries WHERE installation_id = 7")).rejects.toThrow(
        /append-only/,
      );
      await expect(sql.query("DELETE FROM audit_events WHERE installation_id = 7")).rejects.toThrow(
        /append-only/,
      );
      const { rows: receiptAfter } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM scan_receipts WHERE installation_id = 7`,
      );
      expect(receiptAfter[0]?.n).toBe("1");
      const { rows: alertAfter } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM alerts WHERE installation_id = 7`,
      );
      expect(alertAfter[0]?.n).toBe("2");
    } finally {
      await sql.close();
    }
  });

  it("allows Solo paid writes and returns 402 when coverage has ended", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "acme",
        accountType: "Organization",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u1");
      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 9`,
      );

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;

      const unpaidGet = await app.request("/api/retention?installationId=9", { headers: { cookie } });
      expect(unpaidGet.status).toBe(200);
      expect(((await unpaidGet.json()) as { days: number }).days).toBe(90);

      const unpaidPut = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 9, days: 180, confirm: "180" }),
      });
      expect(unpaidPut.status).toBe(402);

      const soloGet = await app.request("/api/retention?installationId=7", { headers: { cookie } });
      expect(soloGet.status).toBe(200);

      const soloPut = await app.request("/api/retention", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, days: 180, confirm: "180" }),
      });
      expect(soloPut.status).toBe(200);
      expect(((await soloPut.json()) as { days: number }).days).toBe(180);
    } finally {
      await sql.close();
    }
  });
});
