import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort, type GithubRepo } from "../src/server/github.ts";
import {
  exposureMs,
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
    expect(ok.detail.toLowerCase()).toContain("not a security incident");

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
      const app = appFor(
        store,
        mockGithub({
          getInstallation: async (installationId) => {
            getInstallationCalls += 1;
            return {
              id: installationId,
              account: { login: "octo", type: "User", id: 1 },
              suspended_at: null,
              permissions: { contents: "read", metadata: "read", checks: "write" },
              repository_selection: "selected",
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
          detail: string;
        };
      };
      expect(testBody.inventedIncident).toBe(false);
      expect(testBody.test.inventedIncident).toBe(false);
      expect(testBody.test.ok).toBe(true);
      expect(testBody.test.repoProbe).toEqual({ fullName: "octo/app", ok: true });
      expect(testBody.test.optionalWrites.find((row) => row.name === "checks")?.granted).toBe(true);
      expect(testBody.test.detail.toLowerCase()).toContain("not a security incident");
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
});
