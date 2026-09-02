import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  EMAIL_ADDRESS_ERROR,
  EMAIL_NOT_LIVE_ERROR,
  parseEmailAddress,
  postResendEmail,
} from "../src/server/email.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { looksEncrypted } from "../src/server/secret-box.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const SECRET = "test-webhook-secret";
const TO = "alerts@acme.example";

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

function appFor(
  store: ReturnType<typeof createStore>,
  opts: { slackFetch?: typeof fetch; resendKey?: string; from?: string } = {},
) {
  const config = loadConfig({
    databaseUrl: "pglite://:memory:",
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
    resendApiKey: opts.resendKey ?? "",
    resendFromEmail: opts.from ?? "",
  });
  return createApp({
    config,
    store,
    github: unusedGithub(),
    slackFetch: opts.slackFetch,
  });
}

describe("email addresses", () => {
  it("accepts a public address and redacts the local part", () => {
    expect(parseEmailAddress(TO)).toEqual({
      address: TO,
      domain: "acme.example",
      redacted: "a***@acme.example",
    });
    expect(parseEmailAddress("not-an-email")).toBeNull();
    expect(parseEmailAddress("root@localhost")).toBeNull();
    expect(parseEmailAddress("Ada <alerts@acme.example>")).toBeNull();
    expect(parseEmailAddress("alerts@127.0.0.1")).toBeNull();
  });
});

describe("email destinations", () => {
  it("applies migration 060_email_destinations", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const { rows } = await sql.query<{ id: string }>(
        `SELECT id FROM schema_migrations WHERE id = '060_email_destinations'`,
      );
      expect(rows.map((row) => row.id)).toEqual(["060_email_destinations"]);
    } finally {
      await sql.close();
    }
  });

  it("encrypts the address, allows Solo, and never returns the mailbox", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(11, "u2");
      await store.sql.query(`UPDATE billing_accounts SET plan = 'solo', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`);

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const app = appFor(store);

      const health = await app.request("/api/health");
      expect(((await health.json()) as { resend: boolean }).resend).toBe(false);

      const unauth = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: TO, installationId: 7 }),
      });
      expect(unauth.status).toBe(401);

      const saved = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: TO, installationId: 7 }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as {
        destination: { kind: string; host: string; projectKey: string | null };
      };
      expect(savedBody.destination.kind).toBe("email");
      expect(savedBody.destination.host).toBe("acme.example");
      expect(savedBody.destination.projectKey).toBe("a***@acme.example");
      expect(JSON.stringify(savedBody)).not.toContain(TO);

      const { rows } = await store.sql.query<{ webhook_ciphertext: string; host: string }>(
        `SELECT webhook_ciphertext, host FROM notification_destinations WHERE installation_id = 7 AND kind = 'email'`,
      );
      expect(rows[0]?.host).toBe("acme.example");
      expect(looksEncrypted(rows[0]?.webhook_ciphertext ?? "")).toBe(true);
      expect(rows[0]?.webhook_ciphertext).not.toContain(TO);
      const { rows: audit } = await store.sql.query<{ target_id: string; summary: string }>(
        `SELECT target_id, summary FROM audit_events WHERE installation_id = 7 AND action = 'destination.save'`,
      );
      expect(audit[0]?.target_id).toBe("acme.example");
      expect(JSON.stringify(audit)).not.toContain(TO);

      const listed = await app.request("/api/destinations?installationId=7", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        destinations: { kind: string; host: string; projectKey: string | null }[];
      };
      expect(listedBody.destinations[0]).toMatchObject({
        kind: "email",
        host: "acme.example",
        projectKey: "a***@acme.example",
      });
      expect(JSON.stringify(listedBody)).not.toContain(TO);

      const stolen = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie: other, "content-type": "application/json" },
        body: JSON.stringify({ email: TO, installationId: 7 }),
      });
      expect(stolen.status).toBe(403);

      const test = await app.request(
        `/api/destinations/${(await store.listNotificationDestinationsForUser("u1", 7))[0]?.id}/test`,
        { method: "POST", headers: { cookie } },
      );
      expect(test.status).toBe(503);
      const testBody = (await test.json()) as { inventedIncident: boolean; error: string };
      expect(testBody.inventedIncident).toBe(false);
      expect(testBody.error).toBe(EMAIL_NOT_LIVE_ERROR);

      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: "ops@acme.example", installationId: 7 }),
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("sends a real alert through Resend when keys exist and skips inventing mail without keys", async () => {
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
      await store.linkUserInstallation(7, "u1");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const posts: { url: string; body: string }[] = [];
      const fetchImpl: typeof fetch = async (input, init) => {
        posts.push({ url: String(input), body: String(init?.body ?? "") });
        return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
      };
      const dark = appFor(store);
      await dark.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: TO, installationId: 7 }),
      });
      const darkNotifier = createLogNotifier(store);
      await darkNotifier.send({
        installationId: 7,
        kind: "repo_created_public",
        title: "Public repo",
        body: "octo/throwaway is public.",
      });
      expect(posts).toEqual([]);
      const { rows: darkRows } = await store.sql.query<{ status: string; error: string | null }>(
        `SELECT status, error FROM notification_deliveries WHERE kind = 'email'`,
      );
      expect(darkRows[0]?.status).toBe("failed");
      expect(darkRows[0]?.error).toBe(EMAIL_NOT_LIVE_ERROR);

      const live = appFor(store, {
        slackFetch: fetchImpl,
        resendKey: "re_test_123",
        from: "NoSpoilers <alerts@nospoilers.dev>",
      });
      const dest = (await store.listNotificationDestinationsForUser("u1", 7))[0];
      const tested = await live.request(`/api/destinations/${dest?.id}/test`, {
        method: "POST",
        headers: { cookie },
      });
      expect(tested.status).toBe(200);
      expect(((await tested.json()) as { inventedIncident: boolean }).inventedIncident).toBe(false);
      expect(posts[0]?.url).toBe("https://api.resend.com/emails");
      expect(posts[0]?.body).toContain(TO);
      expect(posts[0]?.body).not.toContain("re_test_123");

      const liveNotifier = createLogNotifier(store, {
        fetch: fetchImpl,
        resend: { apiKey: "re_test_123", fromEmail: "alerts@nospoilers.dev" },
      });
      await liveNotifier.send({
        installationId: 7,
        kind: "repo_publicized",
        title: "Repo went public",
        body: "octo/throwaway changed visibility.",
      });
      expect(posts.length).toBe(2);
      expect(posts[1]?.body).toContain("Repo went public");
      const { rows } = await store.sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM notification_deliveries WHERE kind = 'email' AND status = 'sent'`,
      );
      expect(Number(rows[0]?.n ?? 0)).toBe(2);
    } finally {
      await sql.close();
    }
  });

  it("refuses a member write and an invalid address", async () => {
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
      const member = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const admin = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const app = appFor(store);
      const asMember = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie: member, "content-type": "application/json" },
        body: JSON.stringify({ email: TO, installationId: 7 }),
      });
      expect(asMember.status).toBe(403);
      const bad = await app.request("/api/destinations/email", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ email: "not-valid", installationId: 7 }),
      });
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: string }).error).toBe(EMAIL_ADDRESS_ERROR);
    } finally {
      await sql.close();
    }
  });

  it("treats a missing from address as not live", async () => {
    const posted = await postResendEmail({
      apiKey: "",
      from: "",
      to: TO,
      subject: "Test",
      text: "Hello",
    });
    expect(posted).toMatchObject({ ok: false, status: 503, error: EMAIL_NOT_LIVE_ERROR });
  });

  it("does not put the API key in a Resend body", async () => {
    const calls: string[] = [];
    const posted = await postResendEmail(
      {
        apiKey: "re_secret",
        from: "alerts@nospoilers.dev",
        to: TO,
        subject: "Test",
        text: "Hello",
      },
      async (_input, init) => {
        calls.push(String(init?.body ?? ""));
        return new Response("{}", { status: 200 });
      },
    );
    expect(posted.ok).toBe(true);
    expect(calls[0]).toContain(TO);
    expect(calls[0]).not.toContain("re_secret");
  });
});
