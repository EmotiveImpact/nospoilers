import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import {
  CONFIRM_MISMATCH_ERROR,
  CONFIRM_MISSING_ERROR,
} from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  ADMIN_REQUIRED_ERROR,
  ALREADY_MEMBER_ERROR,
  GITHUB_LOGIN_ERROR,
} from "../src/server/roles.ts";
import { githubLoginKey, parseGithubLogin } from "../src/server/routing.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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

describe("GitHub-login Team invites", () => {
  it("parses GitHub logins and stores them lowercase", () => {
    expect(parseGithubLogin("octocat")).toBe("octocat");
    expect(parseGithubLogin("Octo-Cat")).toBe("Octo-Cat");
    expect(githubLoginKey("Octo-Cat")).toBe("octo-cat");
    expect(parseGithubLogin("-octo")).toBeNull();
    expect(parseGithubLogin("octo-")).toBeNull();
    expect(parseGithubLogin("a".repeat(40))).toBeNull();
    expect(parseGithubLogin("octo cat")).toBeNull();
  });

  it("invites by GitHub login, applies on link, and never auto-links outsiders", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "Teammate" });
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
      await store.linkUserInstallation(11, "u3");

      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;

      const created = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "Teammate", role: "admin", confirm: "Teammate" }),
      });
      expect(created.status).toBe(200);
      const createdBody = (await created.json()) as {
        invite: { id: number; githubLogin: string; role: string };
      };
      expect(createdBody.invite.githubLogin).toBe("teammate");
      expect(createdBody.invite.role).toBe("admin");

      const listed = await app.request("/api/installations/7/members", {
        headers: { cookie: adminCookie },
      });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        members: { login: string }[];
        invites: { githubLogin: string; role: string }[];
      };
      expect(listedBody.members.map((row) => row.login)).toEqual(["octo"]);
      expect(listedBody.invites.map((row) => `${row.githubLogin}:${row.role}`)).toEqual([
        "teammate:admin",
      ]);

      const outsider = await app.request("/api/installations/7/members", {
        headers: { cookie: otherCookie },
      });
      expect(((await outsider.json()) as { invites: unknown[] }).invites).toEqual([]);

      expect(await store.getInstallationRole("u2", 7)).toBeNull();
      await store.linkUserInstallation(7, "u2");
      expect(await store.getInstallationRole("u2", 7)).toBe("admin");
      const afterLink = await app.request("/api/installations/7/members", {
        headers: { cookie: adminCookie },
      });
      expect(((await afterLink.json()) as { invites: unknown[] }).invites).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("applies a member invite to a later linked user", async () => {
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
      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const invited = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "teammate", role: "member", confirm: "teammate" }),
      });
      expect(invited.status).toBe(200);
      await store.linkUserInstallation(7, "u2");
      expect(await store.getInstallationRole("u1", 7)).toBe("admin");
      expect(await store.getInstallationRole("u2", 7)).toBe("member");
    } finally {
      await sql.close();
    }
  });

  it("keeps the first linked user admin when a member invite would leave zero admins", async () => {
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
      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const invited = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "teammate", role: "member", confirm: "teammate" }),
      });
      expect(invited.status).toBe(200);
      await migrate(sql);
      await sql.query(`DELETE FROM installation_users WHERE installation_id = 7`);
      expect(await store.getInstallationRole("u1", 7)).toBeNull();
      await store.linkUserInstallation(7, "u2");
      expect(await store.getInstallationRole("u2", 7)).toBe("admin");
      const listed = await app.request("/api/installations/7/members", {
        headers: { cookie: `ns_session=${signSession("sess", await store.createSession("u2"))}` },
      });
      expect(((await listed.json()) as { invites: unknown[] }).invites).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("blocks members, Solo, unpaid, already-members, and bad input, and ignores GitHub suspend", async () => {
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

      const memberInvite = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member", confirm: "newhire" }),
      });
      expect(memberInvite.status).toBe(403);
      expect(((await memberInvite.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const already = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "teammate", role: "member", confirm: "teammate" }),
      });
      expect(already.status).toBe(409);
      expect(((await already.json()) as { error: string }).error).toBe(ALREADY_MEMBER_ERROR);

      const missingConfirm = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member" }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const mismatch = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member", confirm: "nope" }),
      });
      expect(mismatch.status).toBe(400);
      expect(((await mismatch.json()) as { error: string }).error).toBe(CONFIRM_MISMATCH_ERROR);

      const badLogin = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "-nope", role: "member", confirm: "-nope" }),
      });
      expect(badLogin.status).toBe(400);
      expect(((await badLogin.json()) as { error: string }).error).toBe(GITHUB_LOGIN_ERROR);

      const pending = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member", confirm: "newhire" }),
      });
      expect(pending.status).toBe(200);
      const pendingBody = (await pending.json()) as { invite: { id: number } };

      const upserted = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "NewHire", role: "admin", confirm: "NewHire" }),
      });
      expect(upserted.status).toBe(200);
      expect(((await upserted.json()) as { invite: { role: string } }).invite.role).toBe("admin");

      const memberRevoke = await app.request(
        `/api/installations/7/invites/${pendingBody.invite.id}`,
        {
          method: "DELETE",
          headers: { cookie: memberCookie, ...json },
          body: JSON.stringify({ confirm: "newhire" }),
        },
      );
      expect(memberRevoke.status).toBe(403);

      const revoked = await app.request(`/api/installations/7/invites/${pendingBody.invite.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ confirm: "newhire" }),
      });
      expect(revoked.status).toBe(200);
      const afterRevoke = await app.request("/api/installations/7/members", {
        headers: { cookie: adminCookie },
      });
      expect(((await afterRevoke.json()) as { invites: unknown[] }).invites).toEqual([]);

      const solo = await app.request("/api/installations/8/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member", confirm: "newhire" }),
      });
      expect(solo.status).toBe(403);

      const unpaid = await app.request("/api/installations/9/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "newhire", role: "member", confirm: "newhire" }),
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("does not auto-link a GitHub login GitHub has not listed on this App", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "42", login: "octo" });
      await store.upsertUser({ id: "99", login: "teammate" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 42,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "teammate",
        accountType: "User",
        accountId: 99,
      });
      await store.linkUserInstallation(7, "42");
      const app = appFor(store);
      const adminCookie = `ns_session=${signSession("sess", await store.createSession("42"))}`;
      const invited = await app.request("/api/installations/7/invites", {
        method: "POST",
        headers: { cookie: adminCookie, ...json },
        body: JSON.stringify({ login: "teammate", role: "admin", confirm: "teammate" }),
      });
      expect(invited.status).toBe(200);
      await store.linkUserToAccountInstallations("99", 99);
      expect(await store.getInstallationRole("99", 7)).toBeNull();
      expect(await store.getInstallationRole("99", 8)).toBe("admin");
      const still = await app.request("/api/installations/7/members", {
        headers: { cookie: adminCookie },
      });
      expect(
        ((await still.json()) as { invites: { githubLogin: string }[] }).invites.map(
          (row) => row.githubLogin,
        ),
      ).toEqual(["teammate"]);
    } finally {
      await sql.close();
    }
  });
});
