import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort, type GithubRepo } from "../src/server/github.ts";
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

const repoA: GithubRepo = {
  id: 11,
  name: "alpha",
  full_name: "octo/alpha",
  private: true,
  html_url: "https://github.com/octo/alpha",
  owner: { login: "octo" },
};

describe("multiple GitHub organizations", () => {
  it("scopes Watch lists per install and never leaks another tenant", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 9,
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
      await store.linkUserInstallation(9, "u1");
      await store.linkUserInstallation(11, "u2");
      await store.upsertRepo({
        id: 11,
        installationId: 7,
        owner: "octo",
        name: "alpha",
        fullName: "octo/alpha",
        private: true,
        htmlUrl: "https://github.com/octo/alpha",
      });
      await store.upsertRepo({
        id: 22,
        installationId: 9,
        owner: "acme",
        name: "beta",
        fullName: "acme/beta",
        private: true,
        htmlUrl: "https://github.com/acme/beta",
      });
      await store.upsertRepo({
        id: 33,
        installationId: 11,
        owner: "other",
        name: "secret",
        fullName: "other/secret",
        private: true,
        htmlUrl: "https://github.com/other/secret",
      });
      const mineA = await store.insertAlert({
        installationId: 7,
        kind: "repo_created_public",
        title: "octo/alpha was created public",
        body: "A public create event.",
      });
      const mineB = await store.insertAlert({
        installationId: 9,
        kind: "fork",
        title: "acme/beta was forked",
        body: "A fork event.",
      });
      await store.insertAlert({
        installationId: 11,
        kind: "member_added",
        title: "other/secret gained a collaborator",
        body: "A collaborator event.",
      });
      await store.enqueueJob({
        priority: "light",
        kind: "repo_created_public",
        installationId: 7,
        payload: { installationId: 7, secret: "must-not-leak" },
      });
      await store.enqueueJob({
        priority: "light",
        kind: "fork",
        installationId: 9,
        payload: { installationId: 9 },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        installationId: 7,
        payload: { installationId: 7, url: "https://github.com/public/example" },
      });

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const seven = await app.request("/api/repos?installationId=7", { headers: { cookie } });
      expect(seven.status).toBe(200);
      const sevenBody = (await seven.json()) as { repos: { full_name: string }[] };
      expect(sevenBody.repos.map((row) => row.full_name)).toEqual(["octo/alpha"]);

      const nine = await app.request("/api/repos?installationId=9", { headers: { cookie } });
      expect(nine.status).toBe(200);
      const nineBody = (await nine.json()) as { repos: { full_name: string }[] };
      expect(nineBody.repos.map((row) => row.full_name)).toEqual(["acme/beta"]);

      const stolenList = await app.request("/api/repos?installationId=11", { headers: { cookie } });
      expect(stolenList.status).toBe(200);
      const stolenListBody = (await stolenList.json()) as { repos: unknown[] };
      expect(stolenListBody.repos).toEqual([]);

      const otherSeesMine = await app.request("/api/repos?installationId=7", {
        headers: { cookie: other },
      });
      expect(otherSeesMine.status).toBe(200);
      expect(((await otherSeesMine.json()) as { repos: unknown[] }).repos).toEqual([]);

      const alertsSeven = await app.request("/api/alerts?installationId=7", { headers: { cookie } });
      const alertsSevenBody = (await alertsSeven.json()) as { alerts: { id: number; title: string }[] };
      expect(alertsSevenBody.alerts.map((row) => row.id)).toEqual([mineA]);
      expect(JSON.stringify(alertsSevenBody)).not.toContain("acme/beta");
      expect(JSON.stringify(alertsSevenBody)).not.toContain("other/secret");

      const alertsNine = await app.request("/api/alerts?installationId=9", { headers: { cookie } });
      const alertsNineBody = (await alertsNine.json()) as { alerts: { id: number }[] };
      expect(alertsNineBody.alerts.map((row) => row.id)).toEqual([mineB]);

      const jobsSeven = await app.request("/api/jobs?installationId=7", { headers: { cookie } });
      const jobsSevenBody = (await jobsSeven.json()) as {
        jobs: { kind: string; payload?: unknown }[];
      };
      expect(jobsSevenBody.jobs.map((row) => row.kind)).toEqual(["repo_created_public"]);
      expect(JSON.stringify(jobsSevenBody)).not.toContain("must-not-leak");
      expect(JSON.stringify(jobsSevenBody)).not.toContain("prospect_scan");
      expect(JSON.stringify(jobsSevenBody)).not.toContain("payload");

      const missingInstall = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack" }),
      });
      expect(missingInstall.status).toBe(400);
      const missingBody = (await missingInstall.json()) as { error: string };
      expect(missingBody.error.toLowerCase()).toContain("installation");

      const stolenWrite = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack", installationId: 11 }),
      });
      expect(stolenWrite.status).toBe(403);
    } finally {
      await sql.close();
    }
  });

  it("enforces coverage and GitHub suspend per install, not across a user's orgs", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
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
      await store.upsertRepo({
        id: 11,
        installationId: 7,
        owner: "octo",
        name: "alpha",
        fullName: "octo/alpha",
        private: true,
        htmlUrl: "https://github.com/octo/alpha",
      });
      await store.upsertRepo({
        id: 22,
        installationId: 9,
        owner: "acme",
        name: "beta",
        fullName: "acme/beta",
        private: true,
        htmlUrl: "https://github.com/acme/beta",
      });
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;

      const unpaid = await app.request("/api/repos/11/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaid.status).toBe(402);

      const trial = await app.request("/api/repos/22/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(trial.status).toBe(200);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
        suspended: true,
      });

      const suspended = await app.request("/api/repos/11/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(suspended.status).toBe(409);

      const sibling = await app.request("/api/repos/22/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(sibling.status).toBe(200);
    } finally {
      await sql.close();
    }
  });

  it("reports the last customer job on a live permission test without inserting an alert", async () => {
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
      await store.upsertRepo({
        id: 11,
        installationId: 7,
        owner: "octo",
        name: "alpha",
        fullName: "octo/alpha",
        private: true,
        htmlUrl: "https://github.com/octo/alpha",
      });
      await store.enqueueJob({
        deliveryId: "d-old",
        priority: "light",
        kind: "repo_created_public",
        installationId: 7,
        payload: { installationId: 7, token: "ghu_must_not_appear" },
      });
      await store.enqueueJob({
        deliveryId: "d-prospect",
        priority: "heavy",
        kind: "prospect_scan",
        installationId: 7,
        payload: { installationId: 7 },
      });

      const app = appFor(
        store,
        mockGithub({
          getInstallation: async (installationId) => ({
            id: installationId,
            account: { login: "octo", type: "User", id: 1 },
            suspended_at: null,
            permissions: { contents: "read", metadata: "read" },
            repository_selection: "selected",
          }),
          getRepo: async () => repoA,
        }),
      );
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );

      const tested = await app.request("/api/installations/7/test", {
        method: "POST",
        headers: { cookie },
      });
      expect(tested.status).toBe(200);
      const body = (await tested.json()) as {
        inventedIncident: boolean;
        test: {
          inventedIncident: boolean;
          lastDelivery: { kind: string; status: string; at: string } | null;
          detail: string;
        };
      };
      expect(body.inventedIncident).toBe(false);
      expect(body.test.inventedIncident).toBe(false);
      expect(body.test.lastDelivery?.kind).toBe("repo_created_public");
      expect(body.test.lastDelivery?.status).toBe("queued");
      expect(body.test.detail).toContain("Last GitHub job: repo_created_public (queued).");
      expect(body.test.detail.toLowerCase()).toContain("not a security incident");
      expect(JSON.stringify(body)).not.toContain("ghu_must_not_appear");
      expect(JSON.stringify(body)).not.toContain("prospect_scan");

      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(after[0]?.n).toBe(before[0]?.n);
    } finally {
      await sql.close();
    }
  });
});

describe("public status", () => {
  it("serves /api/health without a connection string or tenant data", async () => {
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
      await store.insertAlert({
        installationId: 7,
        kind: "fork",
        title: "octo/alpha was forked",
        body: "A fork event.",
      });
      const app = appFor(store);
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        githubApp: boolean;
        database: { mode: string };
        worker: { recoveryIntervalMs: number; visibilityPollIntervalMs: number };
      };
      expect(body.ok).toBe(true);
      expect(body.database.mode).toBe("pglite");
      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/DATABASE_URL/i);
      expect(raw).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(raw).not.toMatch(/pglite:\/\//i);
      expect(raw).not.toContain("octo/alpha");
      expect(raw).not.toContain("fork");
    } finally {
      await sql.close();
    }
  });
});
