import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import {
  AUDIT_ACTIONS,
  CONFIRM_MISMATCH_ERROR,
  CONFIRM_MISSING_ERROR,
  auditPlanDenied,
  typedConfirm,
} from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { coverageFrom } from "../src/coverage.ts";

const SECRET = "test-webhook-secret";
const HOOK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";
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

describe("Team audit log", () => {
  it("parses typed confirmation and gates Solo and unpaid coverage", () => {
    expect(typedConfirm({}, "hooks.slack.com")?.error).toBe(CONFIRM_MISSING_ERROR);
    expect(typedConfirm({ confirm: "nope" }, "hooks.slack.com")?.error).toBe(CONFIRM_MISMATCH_ERROR);
    expect(typedConfirm({ confirm: "hooks.slack.com" }, "hooks.slack.com")).toBeNull();
    expect(auditPlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(auditPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(auditPlanDenied(coverageFrom(new Date(Date.now() + 86400000).toISOString(), "trial"))).toBeNull();
    expect(AUDIT_ACTIONS).toContain("destination.delete");
    expect(AUDIT_ACTIONS).toContain("map_destination.save");
    expect(AUDIT_ACTIONS).toContain("map_destination.delete");
    expect(AUDIT_ACTIONS).toContain("repo.make_private");
    expect(AUDIT_ACTIONS).toContain("repo.delete_pack_assets");
    expect(AUDIT_ACTIONS).toContain("repo.disable_workflow");
    expect(AUDIT_ACTIONS).toContain("invite.create");
    expect(AUDIT_ACTIONS).toContain("invite.revoke");
    expect(AUDIT_ACTIONS).toContain("delivery_location.save");
    expect(AUDIT_ACTIONS).toContain("release.approve");
    expect(AUDIT_ACTIONS).toContain("release.reject");
    expect(AUDIT_ACTIONS).toContain("release.hold");
    expect(AUDIT_ACTIONS).toContain("release.release_hold");
    expect(AUDIT_ACTIONS).toContain("release.publish_verify");
    expect(AUDIT_ACTIONS).toContain("release.unpublish_verify");
    expect(AUDIT_ACTIONS).toContain("release.attest");
    expect(AUDIT_ACTIONS).toContain("signing_policy.save");
    expect(AUDIT_ACTIONS).toContain("signing_policy.clear");
    expect(AUDIT_ACTIONS).toContain("identity.evidence");
    expect(AUDIT_ACTIONS).toContain("identity.publish_advisory");
    expect(AUDIT_ACTIONS).toContain("identity.unpublish_advisory");
    expect(AUDIT_ACTIONS).toContain("namespace.protect");
    expect(AUDIT_ACTIONS).toContain("namespace.unprotect");
    expect(AUDIT_ACTIONS).toContain("billing.checkout");
    expect(AUDIT_ACTIONS).toContain("billing.portal");
  });

  it("records admin writes, requires typed confirmation, exports titles only, and hides other tenants", async () => {
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
      const alertId = await store.insertAlert({
        installationId: 7,
        repoId: 99,
        kind: "repo_created_public",
        title: "octo/throwaway was created public",
        body: "secret-body-should-not-export",
      });
      await store.acknowledgeAlertForUser(alertId, "u1", "octo");
      await store.insertAlert({
        installationId: 11,
        kind: "fork",
        title: "other/app was forked",
        body: "Other tenant.",
      });

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const member = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u3"))}`;

      const anon = await app.request("/api/audit");
      expect(anon.status).toBe(401);

      const missing = await app.request("/api/audit", { headers: { cookie } });
      expect(missing.status).toBe(400);

      const stolen = await app.request("/api/audit?installationId=7", { headers: { cookie: other } });
      expect(stolen.status).toBe(200);
      expect(((await stolen.json()) as { rows: unknown[] }).rows).toEqual([]);

      const saved = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ installationId: 7, webhookUrl: HOOK }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as { destination: { id: number; host: string } };
      expect(savedBody.destination.host).toBe("hooks.slack.com");

      const listed = await app.request("/api/audit?installationId=7", { headers: { cookie: member } });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        rows: { action: string; summary: string; actorLogin: string }[];
      };
      expect(listedBody.rows.some((row) => row.action === "destination.save")).toBe(true);
      expect(listedBody.rows[0]?.actorLogin).toBe("octo");
      expect(JSON.stringify(listedBody)).not.toContain("/services/");
      expect(JSON.stringify(listedBody)).not.toContain(HOOK);

      const noConfirm = await app.request(`/api/destinations/${savedBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie, ...json },
        body: JSON.stringify({}),
      });
      expect(noConfirm.status).toBe(400);
      expect(((await noConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const wrong = await app.request(`/api/destinations/${savedBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "wrong.host" }),
      });
      expect(wrong.status).toBe(400);
      expect(((await wrong.json()) as { error: string }).error).toBe(CONFIRM_MISMATCH_ERROR);

      const memberDelete = await app.request(`/api/destinations/${savedBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie: member, ...json },
        body: JSON.stringify({ confirm: "hooks.slack.com" }),
      });
      expect(memberDelete.status).toBe(403);

      const removed = await app.request(`/api/destinations/${savedBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "hooks.slack.com" }),
      });
      expect(removed.status).toBe(200);

      const exported = await app.request("/api/audit/export?installationId=7", {
        headers: { cookie: member },
      });
      expect(exported.status).toBe(200);
      const exportBody = (await exported.json()) as {
        installationId: number;
        audit: { action: string; summary: string }[];
        alerts: { title: string; body?: string }[];
        alertEvents: { action: string; detail?: string }[];
        notificationDeliveries: { inventedIncident: boolean }[];
      };
      expect(exportBody.installationId).toBe(7);
      expect(exportBody.audit.some((row) => row.action === "destination.delete")).toBe(true);
      expect(exportBody.alerts.some((row) => row.title.includes("created public"))).toBe(true);
      expect(exportBody.alertEvents.some((row) => row.action === "acknowledged")).toBe(true);
      expect(JSON.stringify(exportBody)).not.toContain("secret-body-should-not-export");
      expect(JSON.stringify(exportBody)).not.toContain("/services/");
      expect(JSON.stringify(exportBody)).not.toContain(HOOK);
      expect(JSON.stringify(exportBody)).not.toContain("other/app");
      expect(JSON.stringify(exportBody)).not.toContain("webhook_ciphertext");
      expect(exportBody.alerts[0]?.body).toBeUndefined();
      expect(exportBody.alertEvents[0]?.detail).toBeUndefined();

      const stolenExport = await app.request("/api/audit/export?installationId=7", {
        headers: { cookie: other },
      });
      expect(stolenExport.status).toBe(200);
      const stolenExportBody = (await stolenExport.json()) as { audit: unknown[]; alerts: unknown[] };
      expect(stolenExportBody.audit).toEqual([]);
      expect(stolenExportBody.alerts).toEqual([]);

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM audit_events",
      );
      await expect(
        sql.query("UPDATE audit_events SET summary = 'x' WHERE installation_id = 7"),
      ).rejects.toThrow(/append-only/);
      await expect(sql.query("DELETE FROM audit_events WHERE installation_id = 7")).rejects.toThrow(
        /append-only/,
      );
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM audit_events",
      );
      expect(after[0]?.n).toBe(before[0]?.n);
    } finally {
      await sql.close();
    }
  });

  it("returns 403 for Solo and 402 when coverage has ended", async () => {
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
      const solo = await app.request("/api/audit?installationId=7", { headers: { cookie } });
      expect(solo.status).toBe(403);
      const unpaid = await app.request("/api/audit?installationId=9", { headers: { cookie } });
      expect(unpaid.status).toBe(402);
      const soloExport = await app.request("/api/audit/export?installationId=7", {
        headers: { cookie },
      });
      expect(soloExport.status).toBe(403);
      const unpaidExport = await app.request("/api/audit/export?installationId=9", {
        headers: { cookie },
      });
      expect(unpaidExport.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("remigrates after a publish_verify row without rewriting a stale action list", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.insertAuditEvent({
        installationId: 7,
        actorLogin: "octo",
        action: "release.publish_verify",
        summary: "Published verification for owner/name@tag#file",
        targetKind: "release",
        targetId: "owner/name@tag#file",
      });
      await store.insertAuditEvent({
        installationId: 7,
        actorLogin: "octo",
        action: "identity.evidence",
        summary: "Assembled identity evidence for @octo/app",
        targetKind: "package",
        targetId: "@octo/app",
      });
      await store.insertAuditEvent({
        installationId: 7,
        actorLogin: "octo",
        action: "namespace.protect",
        summary: "Watched npm scope @octo",
        targetKind: "namespace",
        targetId: "@octo",
      });
      await migrate(sql);
      const { rows } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit_events
         WHERE action IN ('release.publish_verify', 'identity.evidence', 'namespace.protect')`,
      );
      expect(rows[0]?.n).toBe("3");
    } finally {
      await sql.close();
    }
  });
});
