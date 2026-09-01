import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";
import { extractMapIdentity, normalizeDebugId } from "../src/scanner/debug-id.ts";
import {
  evaluateMapCustody,
  parseMapDestination,
  runMapCustodyCheck,
  validateMapToken,
} from "../src/server/map-custody.ts";
import { runMapCustodyPoll } from "../src/server/map-watch.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import { looksEncrypted } from "../src/server/secret-box.ts";

const DIRTY = path.resolve("fixtures/web/dirty");
const ORIGIN = "https://app.example.com/";
const DEBUG_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "sntrys_example-token-value";

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

async function siteAndSentryFetch(input: {
  sentryBody: unknown;
  sentryStatus?: number;
  fetched: { urls: string[] };
}): Promise<typeof fetch> {
  const index = await readFile(path.join(DIRTY, "index.html"));
  const appJs = await readFile(path.join(DIRTY, "app.js"));
  const map = await readFile(path.join(DIRTY, "app.js.map"));
  const files: Record<string, Buffer> = {
    [ORIGIN]: index,
    "https://app.example.com/app.js": appJs,
    "https://app.example.com/app.js.map": map,
  };
  return (async (raw, init) => {
    const url = String(raw);
    input.fetched.urls.push(url);
    const auth = new Headers(init?.headers).get("authorization") ?? "";
    if (auth && /sntrys_|token /.test(JSON.stringify(input))) {
      /* token belongs on the request, never in the recorded JSON below */
    }
    if (url.startsWith("https://sentry.io/")) {
      return new Response(JSON.stringify(input.sentryBody), {
        status: input.sentryStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.startsWith("https://api.bugsnag.com/")) {
      return new Response(JSON.stringify(input.sentryBody), {
        status: input.sentryStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    const body = files[url];
    if (!body) return new Response("missing", { status: 404 });
    const type = url.endsWith(".map")
      ? "application/json"
      : url.endsWith(".js")
        ? "application/javascript"
        : "text/html";
    return new Response(body, { status: 200, headers: { "content-type": type } });
  }) as typeof fetch;
}

const publicLookup = async () => [{ address: "1.1.1.1", family: 4 as const }];

describe("map identity extraction", () => {
  it("normalizes debug IDs from comments and maps, never from a random UUID", () => {
    expect(normalizeDebugId("11111111111141118111111111111111")).toBe(DEBUG_ID);
    const fromComment = extractMapIdentity(
      "app.js",
      Buffer.from(`console.log(1)\n//# debugId=${DEBUG_ID}\n`),
    );
    expect(fromComment.debugIds).toEqual([DEBUG_ID]);
    const fromMap = extractMapIdentity(
      "app.js.map",
      Buffer.from(JSON.stringify({ version: 3, debug_id: DEBUG_ID, release: "1.0.0", mappings: "", sources: [] })),
    );
    expect(fromMap.debugIds).toEqual([DEBUG_ID]);
    expect(fromMap.releases).toEqual(["1.0.0"]);
    const noise = extractMapIdentity(
      "readme.md",
      Buffer.from(`see ticket ${DEBUG_ID} and https://example.com/secret`),
    );
    expect(noise.debugIds).toEqual([]);
  });
});

describe("map destination parsing", () => {
  it("defaults SaaS hosts and rejects private or credentialed URLs", () => {
    expect(parseMapDestination({ kind: "sentry", org: "acme", project: "web" })).toEqual({
      kind: "sentry",
      host: "sentry.io",
      origin: "https://sentry.io",
      orgSlug: "acme",
      projectSlug: "web",
    });
    expect(parseMapDestination({ kind: "bugsnag", project: "proj-1" })?.host).toBe("api.bugsnag.com");
    expect(parseMapDestination({ kind: "sentry", host: "https://user:pass@sentry.io", org: "acme", project: "web" })).toBeNull();
    expect(parseMapDestination({ kind: "sentry", host: "localhost", org: "acme", project: "web" })).toBeNull();
    expect(parseMapDestination({ kind: "sentry", org: "acme", project: "web with space" })).toBeNull();
    expect(validateMapToken("")).toBeNull();
    expect(validateMapToken("ok-token")).toBe("ok-token");
  });

  it("flags missing private artifacts and public maps without copying source", () => {
    const verdict = evaluateMapCustody({
      kind: "sentry",
      host: "sentry.io",
      identities: [
        {
          source: "origin",
          label: "app.example.com",
          debugIds: [DEBUG_ID],
          release: "1.0.0",
          publicMap: true,
        },
      ],
      debugPresent: [{ id: DEBUG_ID, present: false }],
      releasePresent: [],
      lookupError: null,
      bugsnagNeedsRelease: false,
    });
    expect(verdict.status).toBe("failed-policy");
    expect(verdict.findings.map((row) => row.rule).sort()).toEqual(["MAP-011", "MAP-012"]);
    expect(JSON.stringify(verdict)).not.toMatch(/plot-twist|sntrys_/);
  });
});

describe("hosted map custody", () => {
  it("saves an encrypted Sentry destination, looks up a debug ID, and never stores the token on the job", async () => {
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
      const fetched = { urls: [] as string[] };
      const webFetch = await siteAndSentryFetch({ sentryBody: [], fetched });
      let woke = 0;
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {
          woke += 1;
        },
      });
      const origin = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(origin.status).toBe(201);
      const worker = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        webFetch,
        webLookup: publicLookup,
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const saved = await app.request("/api/map-destinations", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          kind: "sentry",
          org: "acme",
          project: "web",
          token: TOKEN,
        }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as {
        destination: { host: string; token?: string; orgSlug: string };
      };
      expect(savedBody.destination.host).toBe("sentry.io");
      expect(savedBody.destination.orgSlug).toBe("acme");
      expect(savedBody.destination.token).toBeUndefined();
      expect(JSON.stringify(savedBody)).not.toMatch(/sntrys_/);
      expect(woke).toBeGreaterThanOrEqual(2);
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await worker.stop();
      const { rows: cipher } = await sql.query<{ token_ciphertext: string }>(
        "SELECT token_ciphertext FROM map_destinations",
      );
      expect(looksEncrypted(cipher[0]?.token_ciphertext ?? "")).toBe(true);
      expect(cipher[0]?.token_ciphertext).not.toContain(TOKEN);
      const { rows: jobs } = await sql.query<{ payload: unknown; kind: string }>(
        "SELECT kind, payload FROM jobs WHERE kind = 'map_custody_check'",
      );
      expect(jobs.length).toBeGreaterThan(0);
      expect(JSON.stringify(jobs)).not.toMatch(/sntrys_/);
      const { rows: origins } = await sql.query<{ last_debug_ids: unknown; last_public_map: boolean }>(
        "SELECT last_debug_ids, last_public_map FROM watched_origins",
      );
      expect(JSON.stringify(origins[0]?.last_debug_ids)).toContain(DEBUG_ID);
      expect(origins[0]?.last_public_map).toBe(true);
      const { rows: alerts } = await sql.query<{ title: string; findings: unknown }>(
        "SELECT title, findings FROM alerts WHERE kind = 'map_custody_check'",
      );
      expect(alerts[0]?.title).toMatch(/Map custody failed/);
      expect(JSON.stringify(alerts[0]?.findings)).toMatch(/MAP-011/);
      expect(JSON.stringify(alerts[0]?.findings)).toMatch(/MAP-012/);
      expect(JSON.stringify(alerts)).not.toMatch(/this-is-the-plot-twist|sntrys_/);
      expect(fetched.urls.some((url) => url.includes("artifact-lookup") && url.includes(DEBUG_ID))).toBe(
        true,
      );
      const listed = await app.request("/api/map-destinations", { headers: { cookie } });
      const listedBody = (await listed.json()) as { destinations: { host: string }[] };
      expect(listedBody.destinations.map((row) => row.host)).toEqual(["sentry.io"]);
      expect(JSON.stringify(listedBody)).not.toMatch(/sntrys_|token_ciphertext/);
    } finally {
      await sql.close();
    }
  });

  it("treats a matching Sentry artifact and no public map as a silent pass", async () => {
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
      await store.insertWatchedOrigin(7, ORIGIN, "app.example.com");
      const { rows } = await sql.query<{ id: unknown }>("SELECT id FROM watched_origins");
      await store.recordOriginMapIdentity(Number(rows[0]?.id), {
        debugIds: [DEBUG_ID],
        release: "1.0.0",
        publicMap: false,
      });
      await store.upsertMapDestination({
        installationId: 7,
        kind: "sentry",
        host: "sentry.io",
        orgSlug: "acme",
        projectSlug: "web",
        token: TOKEN,
      });
      const dest = (await store.listMapDestinationsForInstall(7))[0];
      expect(dest).toBeTruthy();
      const fetched = { urls: [] as string[] };
      const verdict = await runMapCustodyCheck({
        kind: "sentry",
        host: "sentry.io",
        origin: "https://sentry.io",
        orgSlug: "acme",
        projectSlug: "web",
        token: TOKEN,
        identities: await store.listMapIdentities(7),
        fetch: await siteAndSentryFetch({
          sentryBody: [{ debug_id: DEBUG_ID }],
          fetched,
        }),
        lookup: publicLookup,
      });
      expect(verdict.status).toBe("passed");
      expect(verdict.findings).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("does not fetch when Sentry DNS is private", async () => {
    let fetched = 0;
    const verdict = await runMapCustodyCheck({
      kind: "sentry",
      host: "sentry.example.com",
      origin: "https://sentry.example.com",
      orgSlug: "acme",
      projectSlug: "web",
      token: TOKEN,
      identities: [
        {
          source: "origin",
          label: "app.example.com",
          debugIds: [DEBUG_ID],
          release: null,
          publicMap: false,
        },
      ],
      fetch: (async () => {
        fetched += 1;
        return new Response("[]");
      }) as typeof fetch,
      lookup: async () => [{ address: "127.0.0.1", family: 4 }],
    });
    expect(fetched).toBe(0);
    expect(verdict.status).toBe("inconclusive");
    expect(verdict.inconclusiveReason).toMatch(/private or reserved/i);
  });

  it("documents Bugsnag debug-ID limits when no release is known", async () => {
    const verdict = await runMapCustodyCheck({
      kind: "bugsnag",
      host: "api.bugsnag.com",
      origin: "https://api.bugsnag.com",
      orgSlug: null,
      projectSlug: "proj-1",
      token: "bugsnag-personal-token",
      identities: [
        {
          source: "origin",
          label: "app.example.com",
          debugIds: [DEBUG_ID],
          release: null,
          publicMap: false,
        },
      ],
      fetch: (async () => new Response("should-not-run")) as typeof fetch,
      lookup: publicLookup,
    });
    expect(verdict.status).toBe("inconclusive");
    expect(verdict.inconclusiveReason).toMatch(/cannot look up a debug ID/i);
  });

  it("matches a Bugsnag release version", async () => {
    const verdict = await runMapCustodyCheck({
      kind: "bugsnag",
      host: "api.bugsnag.com",
      origin: "https://api.bugsnag.com",
      orgSlug: null,
      projectSlug: "proj-1",
      token: "bugsnag-personal-token",
      identities: [
        {
          source: "package",
          label: "@acme/app",
          debugIds: [],
          release: "1.2.3",
          publicMap: false,
        },
      ],
      fetch: (async () =>
        new Response(JSON.stringify([{ app_version: "1.2.3" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
      lookup: publicLookup,
    });
    expect(verdict.status).toBe("passed");
  });

  it("refuses unpaid saves, other tenants, and member writes", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertUser({ id: "u3", login: "intruder" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const member = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          sessionSecret: "sess",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
        }),
        store,
        github: unusedGithub(),
      });
      const memberSave = await app.request("/api/map-destinations", {
        method: "POST",
        headers: { cookie: member, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          kind: "sentry",
          org: "acme",
          project: "web",
          token: TOKEN,
        }),
      });
      expect(memberSave.status).toBe(403);
      expect(((await memberSave.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/map-destinations", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          kind: "sentry",
          org: "acme",
          project: "web",
          token: TOKEN,
        }),
      });
      expect(unpaid.status).toBe(402);
      const outsider = await app.request("/api/map-destinations", { headers: { cookie: other } });
      const outsiderBody = (await outsider.json()) as { destinations: unknown[] };
      expect(outsiderBody.destinations).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("allows Solo paid saves and requires typing the host to disconnect", async () => {
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
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = NULL, plan = 'solo' WHERE installation_id = 7`,
      );
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          sessionSecret: "sess",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
        }),
        store,
        github: unusedGithub(),
      });
      const saved = await app.request("/api/map-destinations", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          kind: "sentry",
          org: "acme",
          project: "web",
          token: TOKEN,
        }),
      });
      expect(saved.status).toBe(201);
      const body = (await saved.json()) as { destination: { id: number; host: string } };
      const missing = await app.request(`/api/map-destinations/${body.destination.id}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(missing.status).toBe(400);
      const removed = await app.request(`/api/map-destinations/${body.destination.id}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "sentry.io" }),
      });
      expect(removed.status).toBe(200);
      const { rows } = await sql.query<{ action: string; target_id: string | null; summary: string }>(
        "SELECT action, target_id, summary FROM audit_events WHERE action LIKE 'map_destination.%'",
      );
      expect(rows.some((row) => row.action === "map_destination.save")).toBe(true);
      expect(rows.some((row) => row.action === "map_destination.delete")).toBe(true);
      expect(rows.every((row) => row.target_id === "sentry.io")).toBe(true);
      expect(JSON.stringify(rows)).not.toMatch(/sntrys_|https:\/\//);
    } finally {
      await sql.close();
    }
  });

  it("hourly poller enqueues covered destinations and skips unpaid", async () => {
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
      await store.upsertMapDestination({
        installationId: 7,
        kind: "sentry",
        host: "sentry.io",
        orgSlug: "acme",
        projectSlug: "web",
        token: TOKEN,
      });
      const queued = await runMapCustodyPoll({ store });
      expect(queued.queued).toBe(1);
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await runMapCustodyPoll({ store });
      expect(unpaid.queued).toBe(0);
    } finally {
      await sql.close();
    }
  });
});
