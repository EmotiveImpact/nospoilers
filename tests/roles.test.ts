import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  ADMIN_REQUIRED_ERROR,
  LAST_ADMIN_ERROR,
  parseInstallationRole,
  rolesPlanDenied,
} from "../src/server/roles.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { coverageFrom } from "../src/coverage.ts";

const SECRET = "test-webhook-secret";
const HOOK = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";

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

function appFor(store: ReturnType<typeof createStore>, slackFetch?: typeof fetch) {
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
    slackFetch,
    webhookLookup: async () => [{ address: "1.1.1.1", family: 4 }],
  });
}

describe("installation roles", () => {
  it("parses roles and gates Solo and unpaid coverage", () => {
    expect(parseInstallationRole("admin")).toBe("admin");
    expect(parseInstallationRole("member")).toBe("member");
    expect(parseInstallationRole("owner")).toBeNull();
    expect(rolesPlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(rolesPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(rolesPlanDenied(coverageFrom(new Date(Date.now() + 86400000).toISOString(), "trial"))).toBeNull();
  });

  it("makes the first linked user admin and later users members, and keeps that on re-link", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      expect(await store.getInstallationRole("u1", 7)).toBe("admin");
      expect(await store.getInstallationRole("u2", 7)).toBe("member");
    } finally {
      await sql.close();
    }
  });

  it("lists members for this install, hides other tenants, and puts role on /api/me", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo", avatarUrl: "https://example.com/octo.png" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertUser({ id: "u3", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(11, "u3");

      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;

      const anon = await app.request("/api/installations/7/members");
      expect(anon.status).toBe(401);

      const listed = await app.request("/api/installations/7/members", {
        headers: { cookie: adminCookie },
      });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        members: { userId: string; login: string; role: string; avatarUrl: string | null }[];
        invites: unknown[];
      };
      expect(listedBody.members.map((row) => `${row.login}:${row.role}`)).toEqual([
        "octo:admin",
        "teammate:member",
      ]);
      expect(listedBody.members[0]?.avatarUrl).toBe("https://example.com/octo.png");
      expect(listedBody.invites).toEqual([]);

      const asMember = await app.request("/api/installations/7/members", {
        headers: { cookie: memberCookie },
      });
      expect(asMember.status).toBe(200);
      const asMemberBody = (await asMember.json()) as { members: unknown[]; invites: unknown[] };
      expect(asMemberBody.members).toHaveLength(2);
      expect(asMemberBody.invites).toEqual([]);

      const otherTenant = await app.request("/api/installations/7/members", {
        headers: { cookie: otherCookie },
      });
      expect(otherTenant.status).toBe(200);
      const otherBody = (await otherTenant.json()) as { members: unknown[]; invites: unknown[] };
      expect(otherBody.members).toEqual([]);
      expect(otherBody.invites).toEqual([]);

      const me = await app.request("/api/me", { headers: { cookie: memberCookie } });
      expect(me.status).toBe(200);
      const meBody = (await me.json()) as { installations: { id: number; role: string }[] };
      expect(meBody.installations[0]?.role).toBe("member");
    } finally {
      await sql.close();
    }
  });

  it("lets members watch and test, and blocks admin-only writes", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
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
        body: "A public create event. Values are not stored.",
      });

      const slackFetch: typeof fetch = async () =>
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      const app = appFor(store, slackFetch);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const json = { "content-type": "application/json" };

      const slack = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ installationId: 7, webhookUrl: HOOK }),
      });
      expect(slack.status).toBe(201);
      const slackBody = (await slack.json()) as { destination: { id: number } };

      const memberSlack = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ installationId: 7, webhookUrl: HOOK }),
      });
      expect(memberSlack.status).toBe(403);
      expect(((await memberSlack.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const memberSiem = await app.request("/api/destinations/siem", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          webhookUrl: "https://siem.example.com/hooks/nospoilers",
        }),
      });
      expect(memberSiem.status).toBe(403);

      const jira = await app.request("/api/destinations/jira", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          site: "acme.atlassian.net",
          email: "bot@example.com",
          token: "ATATT3xFfGF0-jira-api-token",
          projectKey: "NOS",
        }),
      });
      expect(jira.status).toBe(201);
      const jiraBody = (await jira.json()) as { destination: { id: number } };

      const memberJira = await app.request("/api/destinations/jira", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          site: "acme.atlassian.net",
          email: "bot@example.com",
          token: "ATATT3xFfGF0-jira-api-token",
          projectKey: "NOS",
        }),
      });
      expect(memberJira.status).toBe(403);
      expect(((await memberJira.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const memberDeleteJira = await app.request(`/api/destinations/${jiraBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie: memberCookie },
      });
      expect(memberDeleteJira.status).toBe(403);

      const testJira = await app.request(`/api/destinations/${jiraBody.destination.id}/test`, {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(testJira.status).toBe(200);
      expect(((await testJira.json()) as { inventedIncident: boolean }).inventedIncident).toBe(false);

      const memberRoute = await app.request("/api/destinations/routes", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          destinationId: slackBody.destination.id,
          minSeverity: "critical",
        }),
      });
      expect(memberRoute.status).toBe(403);

      const adminRoute = await app.request("/api/destinations/routes", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          destinationId: slackBody.destination.id,
          minSeverity: "critical",
        }),
      });
      expect(adminRoute.status).toBe(201);
      const routeBody = (await adminRoute.json()) as { route: { id: number } };

      const memberDeleteRoute = await app.request(`/api/destinations/routes/${routeBody.route.id}`, {
        method: "DELETE",
        headers: { cookie: memberCookie },
      });
      expect(memberDeleteRoute.status).toBe(403);

      const memberRouteTest = await app.request("/api/destinations/route-test", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ installationId: 7, severity: "critical" }),
      });
      expect(memberRouteTest.status).toBe(200);
      expect(((await memberRouteTest.json()) as { inventedIncident: boolean }).inventedIncident).toBe(
        false,
      );

      const memberDelete = await app.request(`/api/destinations/${slackBody.destination.id}`, {
        method: "DELETE",
        headers: { cookie: memberCookie },
      });
      expect(memberDelete.status).toBe(403);

      const memberMap = await app.request("/api/map-destinations", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          kind: "sentry",
          org: "acme",
          project: "web",
          token: "sntrys_member-should-not-save",
        }),
      });
      expect(memberMap.status).toBe(403);
      expect(((await memberMap.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const testDelivery = await app.request(`/api/destinations/${slackBody.destination.id}/test`, {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(testDelivery.status).toBe(200);
      expect(((await testDelivery.json()) as { inventedIncident: boolean }).inventedIncident).toBe(
        false,
      );

      const ack = await app.request(`/api/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(ack.status).toBe(200);

      const timeline = await app.request("/api/timeline?installationId=7", {
        headers: { cookie: memberCookie },
      });
      expect(timeline.status).toBe(200);

      const scanLatest = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(scanLatest.status).toBe(200);

      const setup = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(setup.status).toBe(403);

      const remediation = await app.request("/api/repos/99/remediation-pr", {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(remediation.status).toBe(403);

      const yaml = await app.request("/api/repos/99/setup-workflow", {
        headers: { cookie: memberCookie },
      });
      expect(yaml.status).toBe(200);

      const registry = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          origin: "https://npm.pkg.github.com",
          token: "ghp_exampletokenvalue",
        }),
      });
      expect(registry.status).toBe(403);

      const token = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ installationId: 7, name: "CI" }),
      });
      expect(token.status).toBe(403);

      const exception = await app.request("/api/exceptions", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          rule: "SRC-001",
          reason: "Need this path for a known generated file.",
          expires: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
      });
      expect(exception.status).toBe(403);

      const adminSetup = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: adminCookie },
      });
      expect(adminSetup.status).toBe(409);
    } finally {
      await sql.close();
    }
  });

  it("lets an admin change roles, refuses the last admin, Solo, unpaid, and ignores GitHub suspend", async () => {
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
        accountLogin: "solo-co",
        accountType: "User",
        accountId: 2,
      });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "ended-co",
        accountType: "Organization",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(8, "u1");
      await store.linkUserInstallation(9, "u1");
      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 8`);
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 9`,
      );
      await sql.query(`UPDATE installations SET suspended = true WHERE id = 7`);

      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const json = { "content-type": "application/json" };

      const selfPromote = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ userId: "u2", role: "admin" }),
      });
      expect(selfPromote.status).toBe(403);
      expect(((await selfPromote.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const otherTenant = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({ userId: "u2", role: "admin" }),
      });
      expect(otherTenant.status).toBe(403);

      const promoted = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u2", role: "admin", confirm: "teammate" }),
      });
      expect(promoted.status).toBe(200);
      expect(((await promoted.json()) as { member: { role: string } }).member.role).toBe("admin");
      expect(await store.getInstallationRole("u2", 7)).toBe("admin");

      const demoted = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u2", role: "member", confirm: "teammate" }),
      });
      expect(demoted.status).toBe(200);
      expect(((await demoted.json()) as { member: { role: string } }).member.role).toBe("member");

      const lastAdmin = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u1", role: "member", confirm: "octo" }),
      });
      expect(lastAdmin.status).toBe(409);
      expect(((await lastAdmin.json()) as { error: string }).error).toBe(LAST_ADMIN_ERROR);

      const removeLast = await app.request("/api/installations/7/members/u1", {
        method: "DELETE",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ confirm: "octo" }),
      });
      expect(removeLast.status).toBe(409);

      const removed = await app.request("/api/installations/7/members/u2", {
        method: "DELETE",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ confirm: "teammate" }),
      });
      expect(removed.status).toBe(200);
      expect(await store.getInstallationRole("u2", 7)).toBeNull();

      const solo = await app.request("/api/installations/8/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u1", role: "admin" }),
      });
      expect(solo.status).toBe(403);

      const unpaid = await app.request("/api/installations/9/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u1", role: "admin" }),
      });
      expect(unpaid.status).toBe(402);

      const badRole = await app.request("/api/installations/7/members", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ userId: "u2", role: "owner" }),
      });
      expect(badRole.status).toBe(400);
    } finally {
      await sql.close();
    }
  });
});
