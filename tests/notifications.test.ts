import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { looksEncrypted } from "../src/server/secret-box.ts";
import { parseSlackWebhook } from "../src/server/slack.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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

function appFor(
  store: ReturnType<typeof createStore>,
  slackFetch?: typeof fetch,
) {
  const config = loadConfig({
    databaseUrl: "pglite://:memory:",
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
  });
  return createApp({
    config,
    store,
    github: unusedGithub(),
    slackFetch,
  });
}

describe("Slack webhook URL", () => {
  it("accepts hooks.slack.com and rejects other hosts", () => {
    expect(parseSlackWebhook(HOOK)?.host).toBe("hooks.slack.com");
    expect(parseSlackWebhook("http://hooks.slack.com/services/T1/B1/x")).toBeNull();
    expect(parseSlackWebhook("https://hooks.slack.com/services/T1/B1/x?next=1")).toBeNull();
    expect(parseSlackWebhook("https://example.com/services/T1/B1/x")).toBeNull();
    expect(parseSlackWebhook("https://127.0.0.1/services/T1/B1/x")).toBeNull();
    expect(parseSlackWebhook("https://hooks.slack.com.evil.test/services/T1/B1/x")).toBeNull();
  });
});

describe("Slack destinations", () => {
  it("encrypts the webhook, scopes it to the install, and never returns it", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
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

      const posts: { url: string; body: string }[] = [];
      const slackFetch: typeof fetch = (async (input, init) => {
        posts.push({
          url: String(input),
          body: typeof init?.body === "string" ? init.body : "",
        });
        return new Response("ok", { status: 200 });
      }) as typeof fetch;

      const app = appFor(store, slackFetch);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const missing = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK }),
      });
      expect(missing.status).toBe(400);

      const saved = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 7 }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as {
        destination: { id: number; host: string; kind: string };
      };
      expect(savedBody.destination.host).toBe("hooks.slack.com");
      expect(JSON.stringify(savedBody)).not.toContain("T00000000");
      expect(JSON.stringify(savedBody)).not.toContain("XXXXXXXX");

      const { rows } = await sql.query<{ webhook_ciphertext: string }>(
        "SELECT webhook_ciphertext FROM notification_destinations WHERE installation_id = 7",
      );
      expect(looksEncrypted(rows[0]?.webhook_ciphertext ?? "")).toBe(true);
      expect(rows[0]?.webhook_ciphertext).not.toContain("T00000000");

      const listed = await app.request("/api/destinations?installationId=7", { headers: { cookie } });
      const listedBody = (await listed.json()) as { destinations: { host: string }[] };
      expect(listedBody.destinations.map((row) => row.host)).toEqual(["hooks.slack.com"]);
      expect(JSON.stringify(listedBody)).not.toContain("services/");

      const nine = await app.request("/api/destinations?installationId=9", { headers: { cookie } });
      expect(((await nine.json()) as { destinations: unknown[] }).destinations).toEqual([]);

      const stolen = await app.request("/api/destinations?installationId=7", {
        headers: { cookie: other },
      });
      expect(((await stolen.json()) as { destinations: unknown[] }).destinations).toEqual([]);

      const stolenWrite = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 11 }),
      });
      expect(stolenWrite.status).toBe(403);

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      const tested = await app.request(`/api/destinations/${savedBody.destination.id}/test`, {
        method: "POST",
        headers: { cookie },
      });
      expect(tested.status).toBe(200);
      const testBody = (await tested.json()) as {
        inventedIncident: boolean;
        ok: boolean;
        detail: string;
      };
      expect(testBody.inventedIncident).toBe(false);
      expect(testBody.ok).toBe(true);
      expect(testBody.detail.toLowerCase()).toContain("not a security incident");
      expect(posts).toHaveLength(1);
      expect(posts[0]?.url).toBe(HOOK);
      expect(posts[0]?.body).toContain("not a security incident");
      expect(posts[0]?.body).not.toContain("ghu_");
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(after[0]?.n).toBe(before[0]?.n);

      const deliveries = await app.request("/api/destinations/deliveries?installationId=7", {
        headers: { cookie },
      });
      const deliveryBody = (await deliveries.json()) as {
        deliveries: { inventedIncident: boolean; status: string }[];
      };
      expect(deliveryBody.deliveries[0]?.inventedIncident).toBe(false);
      expect(deliveryBody.deliveries[0]?.status).toBe("sent");
      expect(JSON.stringify(deliveryBody)).not.toContain("T00000000");

      await expect(
        sql.query("UPDATE notification_deliveries SET error = 'x'"),
      ).rejects.toThrow(/append-only/);
    } finally {
      await sql.close();
    }
  });

  it("blocks unpaid and Solo saves, delivers a real alert, and ignores a sibling org", async () => {
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
      await store.upsertInstallation({
        id: 9,
        accountLogin: "acme",
        accountType: "Organization",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u1");
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 9`);

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;

      const unpaid = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 7 }),
      });
      expect(unpaid.status).toBe(402);

      const solo = await app.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 9 }),
      });
      expect(solo.status).toBe(403);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      await sql.query(`UPDATE billing_accounts SET plan = 'team' WHERE installation_id = 9`);

      const posts: string[] = [];
      const slackFetch: typeof fetch = (async (_input, init) => {
        posts.push(typeof init?.body === "string" ? init.body : "");
        return new Response("ok", { status: 200 });
      }) as typeof fetch;
      const live = appFor(store, slackFetch);
      const team = await live.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 9 }),
      });
      expect(team.status).toBe(201);

      const notifier = createLogNotifier(store, { fetch: slackFetch });
      await notifier.send({
        installationId: 9,
        kind: "repo_created_public",
        title: "acme/app was created public",
        body: "A public create event. Values are not stored.",
      });
      expect(posts.some((row) => row.includes("created public"))).toBe(true);
      expect(posts.join("")).not.toContain(HOOK.split("/").pop());

      const sevenHook = await live.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 7 }),
      });
      expect(sevenHook.status).toBe(201);

      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
        suspended: true,
      });
      const whileSuspended = await live.request("/api/destinations/slack", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ webhookUrl: HOOK, installationId: 7 }),
      });
      expect(whileSuspended.status).toBe(201);
    } finally {
      await sql.close();
    }
  });
});
