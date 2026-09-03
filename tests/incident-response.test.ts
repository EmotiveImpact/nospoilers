import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort, type GithubRepo } from "../src/server/github.ts";
import {
  exposureMs,
  pendingAccepts,
  rotationChecklist,
  summarizePermissionTest,
} from "../src/server/install-test.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const SECRET = "test-webhook-secret";

function mockGithub(overrides: Partial<GithubPort> = {}): GithubPort {
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
    ...overrides,
  };
}

function appFor(store: ReturnType<typeof createStore>, github: GithubPort = mockGithub()) {
  const config = loadConfig({
    databaseUrl: "pglite://:memory:",
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
  });
  return createApp({ config, store, github });
}

const repo: GithubRepo = {
  id: 99,
  name: "app",
  full_name: "octo/app",
  private: true,
  html_url: "https://github.com/octo/app",
  owner: { login: "octo" },
};

describe("permission test copy", () => {
  it("never invents a security incident and lists missing reads", () => {
    const ok = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read" },
    });
    expect(ok.inventedIncident).toBe(false);
    expect(ok.ok).toBe(true);
    expect(ok.lastDelivery).toBeNull();
    expect(ok.detail).toContain("No webhook jobs recorded yet.");
    expect(ok.detail.toLowerCase()).toContain("not a security incident");
    expect(ok.detail).toMatch(/Members read is off/);
    expect(ok.detail).toMatch(/Contents write is off/);
    expect(ok.detail).toMatch(/Pull requests write is off/);
    expect(ok.detail).toMatch(/Checks write is off/);
    expect(ok.optionalReads).toEqual([{ name: "members", granted: false }]);
    expect(ok.administrationGranted).toBe(false);
    expect(ok.pendingAccepts).toEqual([]);
    expect(ok.installUrl).toBeNull();

    const full = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: {
        contents: "write",
        metadata: "read",
        members: "read",
        pull_requests: "write",
        checks: "write",
      },
    });
    expect(full.ok).toBe(true);
    expect(full.optionalReads).toEqual([{ name: "members", granted: true }]);
    expect(full.optionalWrites.every((row) => row.granted)).toBe(true);
    expect(full.detail).not.toMatch(/Members read is off/);
    expect(full.detail).not.toMatch(/Contents write is off/);

    const admin = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read", administration: "write" },
    });
    expect(admin.ok).toBe(true);
    expect(admin.administrationGranted).toBe(true);
    expect(admin.detail).toMatch(/Administration is granted/);
    expect(admin.detail).toMatch(/Do not keep that permission/);

    const delivered = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read" },
      lastDelivery: { kind: "repo_created_public", status: "done", at: "2026-09-01T00:00:00.000Z" },
    });
    expect(delivered.lastDelivery?.kind).toBe("repo_created_public");
    expect(delivered.detail).toContain("Last GitHub job: repo_created_public (done).");
    expect(delivered.inventedIncident).toBe(false);

    const missing = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { metadata: "read" },
    });
    expect(missing.ok).toBe(false);
    expect(missing.missingReads).toEqual(["contents"]);
    expect(missing.inventedIncident).toBe(false);
    expect(missing.detail.toLowerCase()).toContain("not a security incident");
  });

  it("names App-requested permissions the install has not accepted and never asks for Administration", () => {
    expect(
      pendingAccepts(
        { contents: "read", metadata: "read", members: "read", administration: "write" },
        { contents: "read", metadata: "read" },
      ),
    ).toEqual(["members"]);
    expect(
      pendingAccepts(
        {
          contents: "write",
          metadata: "read",
          workflows: "write",
          administration: "write",
        },
        { contents: "write", metadata: "read" },
      ),
    ).toEqual([]);

    const pending = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read" },
      appPermissions: { contents: "read", metadata: "read", members: "read" },
      installUrl: "https://github.com/settings/installations/7",
    });
    expect(pending.pendingAccepts).toEqual(["members"]);
    expect(pending.installUrl).toBe("https://github.com/settings/installations/7");
    expect(pending.ok).toBe(true);
    expect(pending.inventedIncident).toBe(false);
    expect(pending.detail).toMatch(/Members read is requested on the App/);
    expect(pending.detail).toMatch(/Accept it at the GitHub install page/);
    expect(pending.detail).not.toMatch(/Members read is off/);
    expect(pending.detail.toLowerCase()).not.toContain("administration is requested");
    expect(pending.detail.toLowerCase()).toContain("not a security incident");

    const writes = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read", members: "read" },
      appPermissions: {
        contents: "write",
        metadata: "read",
        members: "read",
        pull_requests: "write",
        checks: "write",
      },
    });
    expect(writes.pendingAccepts).toEqual(["checks", "contents", "pull_requests"]);
    expect(writes.detail).toMatch(/Checks write, Contents write, and Pull requests write are requested/);
    expect(writes.detail).not.toMatch(/Contents write is off/);
    expect(writes.detail).not.toMatch(/Pull requests write is off/);
    expect(writes.detail).not.toMatch(/Checks write is off/);

    const adminOnly = summarizePermissionTest({
      accountLogin: "octo",
      suspended: false,
      permissions: { contents: "read", metadata: "read" },
      appPermissions: { contents: "read", metadata: "read", administration: "write" },
    });
    expect(adminOnly.pendingAccepts).toEqual([]);
    expect(adminOnly.detail).not.toMatch(/Administration is requested/);
    expect(adminOnly.detail).toMatch(/Members read is off/);
  });

  it("says Test install reports Members read and that Administration should not be granted", () => {
    const page = readFileSync("src/pages/WatchWorkspace.tsx", "utf8");
    expect(page).toMatch(/Members read \(collaborator alerts\)/);
    expect(page).toMatch(/Administration was granted/);
    expect(page).toMatch(/it should\s+not be/);
    expect(page).toMatch(/links to GitHub’s Accept page/);
    expect(page).toMatch(/It does not ask for Administration/);
    expect(page).toMatch(/Accept requested permissions/);
  });

  it("builds rotation checklists without secret values and measures exposure", () => {
    const items = rotationChecklist(["SEC-001", "MAP-001"]);
    expect(items.some((row) => /rotate/i.test(row))).toBe(true);
    expect(items.some((row) => /source maps/i.test(row))).toBe(true);
    expect(items.join(" ")).not.toMatch(/ghp_|sk-live|AKIA/);
    expect(
      exposureMs("2026-09-01T00:00:00.000Z", "2026-09-01T01:00:00.000Z"),
    ).toBe(60 * 60 * 1000);
  });
});

describe("incident response", () => {
  it("acks, assigns, resolves, and reopens tenant alerts with append-only events", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u2");
      const mine = await store.insertAlert({
        installationId: 7,
        kind: "release_scan",
        title: "Pack shipped a credential",
        body: "SEC-001 on .env. Values are not stored.",
        findings: [
          {
            rule: "SEC-001",
            severity: "critical",
            path: ".env",
            title: "Environment file shipped",
            detail: "Does not belong in a public package.",
          },
        ],
      });
      const theirs = await store.insertAlert({
        installationId: 9,
        kind: "fork",
        title: "other/app was forked",
        body: "A fork event.",
      });

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const listed = await app.request("/api/alerts", { headers: { cookie } });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        alerts: {
          id: number;
          exposure_ms: number;
          rotation_checklist: string[];
          title: string;
        }[];
      };
      expect(listedBody.alerts.map((row) => row.id)).toEqual([mine]);
      expect(listedBody.alerts[0]?.exposure_ms).toBeGreaterThanOrEqual(0);
      expect(listedBody.alerts[0]?.rotation_checklist.some((row) => /rotate/i.test(row))).toBe(true);
      expect(JSON.stringify(listedBody)).not.toContain("ghu_");

      const stolen = await app.request(`/api/alerts/${theirs}/acknowledge`, {
        method: "POST",
        headers: { cookie },
      });
      expect(stolen.status).toBe(404);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const ack = await app.request(`/api/alerts/${mine}/acknowledge`, {
        method: "POST",
        headers: { cookie },
      });
      expect(ack.status).toBe(200);
      const ackAgain = await app.request(`/api/alerts/${mine}/acknowledge`, {
        method: "POST",
        headers: { cookie },
      });
      expect(ackAgain.status).toBe(200);

      const badAssign = await app.request(`/api/alerts/${mine}/assign`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ login: "other" }),
      });
      expect(badAssign.status).toBe(400);

      const assign = await app.request(`/api/alerts/${mine}/assign`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ login: "OCTO" }),
      });
      expect(assign.status).toBe(200);
      const assigned = (await assign.json()) as { alert: { assigned_to_login: string } };
      expect(assigned.alert.assigned_to_login).toBe("octo");

      const shortNote = await app.request(`/api/alerts/${mine}/resolve`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ note: "done" }),
      });
      expect(shortNote.status).toBe(400);

      const resolved = await app.request(`/api/alerts/${mine}/resolve`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ note: "Rotated the token at the provider." }),
      });
      expect(resolved.status).toBe(200);
      const resolvedBody = (await resolved.json()) as {
        alert: { resolved_at: string | null; resolution_note: string; exposure_ms: number };
      };
      expect(resolvedBody.alert.resolved_at).toBeTruthy();
      expect(resolvedBody.alert.resolution_note).toContain("Rotated");
      expect(resolvedBody.alert.exposure_ms).toBeGreaterThanOrEqual(0);

      const resolveAgain = await app.request(`/api/alerts/${mine}/resolve`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ note: "Rotated the token at the provider." }),
      });
      expect(resolveAgain.status).toBe(409);

      const events = await app.request(`/api/alerts/${mine}/events`, { headers: { cookie } });
      const eventBody = (await events.json()) as {
        events: { action: string; actor_login: string; detail: string | null }[];
      };
      expect(eventBody.events.map((row) => row.action)).toEqual([
        "acknowledged",
        "assigned",
        "resolved",
      ]);
      expect(eventBody.events.filter((row) => row.action === "acknowledged")).toHaveLength(1);

      const otherEvents = await app.request(`/api/alerts/${mine}/events`, {
        headers: { cookie: other },
      });
      expect(otherEvents.status).toBe(404);

      const reopened = await app.request(`/api/alerts/${mine}/reopen`, {
        method: "POST",
        headers: { cookie },
      });
      expect(reopened.status).toBe(200);
      const reopenBody = (await reopened.json()) as { alert: { resolved_at: string | null } };
      expect(reopenBody.alert.resolved_at).toBeNull();

      const anonymousExport = await app.request("/api/alerts/export");
      expect(anonymousExport.status).toBe(401);
      const exported = await app.request("/api/alerts/export", { headers: { cookie } });
      expect(exported.status).toBe(200);
      const exportBody = (await exported.json()) as {
        alerts: { id: number; title: string; events: { action: string }[] }[];
      };
      expect(exportBody.alerts.map((row) => row.id)).toEqual([mine]);
      expect(exportBody.alerts[0]?.events.map((row) => row.action)).toContain("reopened");
      expect(JSON.stringify(exportBody)).not.toContain("other/app");
      const theirsExport = await app.request("/api/alerts/export", { headers: { cookie: other } });
      const theirsBody = (await theirsExport.json()) as { alerts: { id: number; title: string }[] };
      expect(theirsBody.alerts.map((row) => row.id)).toEqual([theirs]);
      expect(theirsBody.alerts[0]?.title).toContain("forked");

      const patched = await app.request(`/api/alerts/${mine}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ title: "rewritten" }),
      });
      expect(patched.status).toBe(404);

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alert_events",
      );
      await expect(
        sql.query("UPDATE alert_events SET detail = 'x' WHERE alert_id = $1", [mine]),
      ).rejects.toThrow(/append-only/);
      await expect(sql.query("DELETE FROM alert_events WHERE alert_id = $1", [mine])).rejects.toThrow(
        /append-only/,
      );
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alert_events",
      );
      expect(after[0]?.n).toBe(before[0]?.n);
    } finally {
      await sql.close();
    }
  });

  it("runs a live permission test without inserting an alert, including unpaid and suspended installs", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u2");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "app",
        fullName: "octo/app",
        private: true,
        htmlUrl: "https://github.com/octo/app",
      });

      let getInstallationCalls = 0;
      let getRepoCalls = 0;
      let getAppCalls = 0;
      const app = appFor(
        store,
        mockGithub({
          getApp: async () => {
            getAppCalls += 1;
            return {
              permissions: {
                contents: "read",
                metadata: "read",
                members: "read",
                administration: "write",
              },
            };
          },
          getInstallation: async (installationId) => {
            getInstallationCalls += 1;
            return {
              id: installationId,
              account: { login: "octo", type: "User", id: 1 },
              suspended_at: null,
              permissions: { contents: "read", metadata: "read", checks: "write" },
              repository_selection: "selected",
              html_url: "https://github.com/settings/installations/7",
            };
          },
          getRepo: async () => {
            getRepoCalls += 1;
            return repo;
          },
        }),
      );
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      const tested = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(tested.status).toBe(200);
      const testBody = (await tested.json()) as {
        inventedIncident: boolean;
        test: {
          ok: boolean;
          inventedIncident: boolean;
          missingReads: string[];
          repoProbe: { ok: boolean; fullName: string } | null;
          optionalWrites: { name: string; granted: boolean }[];
          pendingAccepts: string[];
          installUrl: string | null;
          lastDelivery: { kind: string; status: string; at: string } | null;
          detail: string;
        };
      };
      expect(testBody.inventedIncident).toBe(false);
      expect(testBody.test.inventedIncident).toBe(false);
      expect(testBody.test.ok).toBe(true);
      expect(testBody.test.repoProbe).toEqual({ fullName: "octo/app", ok: true });
      expect(testBody.test.optionalWrites.find((row) => row.name === "checks")?.granted).toBe(true);
      expect(testBody.test.pendingAccepts).toEqual(["members"]);
      expect(testBody.test.installUrl).toBe("https://github.com/settings/installations/7");
      expect(testBody.test.lastDelivery).toBeNull();
      expect(testBody.test.detail).toContain("Members read is requested on the App");
      expect(testBody.test.detail).not.toContain("Members read is off");
      expect(testBody.test.detail.toLowerCase()).not.toContain("administration is requested");
      expect(testBody.test.detail).toContain("No webhook jobs recorded yet.");
      expect(testBody.test.detail.toLowerCase()).toContain("not a security incident");
      expect(getAppCalls).toBe(1);
      expect(getInstallationCalls).toBe(1);
      expect(getRepoCalls).toBe(1);

      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(after[0]?.n).toBe(before[0]?.n);

      const me = await app.request("/api/me", { headers: { cookie } });
      const meBody = (await me.json()) as {
        installations: { lastPermissionTest: { inventedIncident: boolean } | null }[];
      };
      expect(meBody.installations[0]?.lastPermissionTest?.inventedIncident).toBe(false);

      const stolen = await app.request("/api/installations/9/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(stolen.status).toBe(404);
      expect(getInstallationCalls).toBe(1);

      const otherTest = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(otherTest.status).toBe(404);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaid.status).toBe(200);
      const unpaidBody = (await unpaid.json()) as { inventedIncident: boolean };
      expect(unpaidBody.inventedIncident).toBe(false);

      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
        suspended: true,
      });
      const suspended = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(suspended.status).toBe(200);
      const suspendedBody = (await suspended.json()) as {
        test: { ok: boolean; suspended: boolean; inventedIncident: boolean };
      };
      expect(suspendedBody.test.suspended).toBe(true);
      expect(suspendedBody.test.ok).toBe(false);
      expect(suspendedBody.test.inventedIncident).toBe(false);

      const { rows: finalAlerts } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(finalAlerts[0]?.n).toBe(before[0]?.n);
    } finally {
      await sql.close();
    }
  });

  it("still tests an install when GitHub GET /app fails", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      const app = appFor(
        store,
        mockGithub({
          getApp: async () => {
            throw new Error("GitHub GET /app failed");
          },
          getInstallation: async (installationId) => ({
            id: installationId,
            account: { login: "octo", type: "User", id: 1 },
            suspended_at: null,
            permissions: { contents: "read", metadata: "read" },
            repository_selection: "all",
            html_url: "https://github.com/settings/installations/7",
          }),
        }),
      );
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const tested = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(tested.status).toBe(200);
      const body = (await tested.json()) as {
        inventedIncident: boolean;
        test: { pendingAccepts: string[]; detail: string; inventedIncident: boolean };
      };
      expect(body.inventedIncident).toBe(false);
      expect(body.test.inventedIncident).toBe(false);
      expect(body.test.pendingAccepts).toEqual([]);
      expect(body.test.detail).toMatch(/Members read is off/);
    } finally {
      await sql.close();
    }
  });
});
