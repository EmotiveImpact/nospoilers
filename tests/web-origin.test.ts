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
import {
  collectHtmlAssetUrls,
  crawlOrigin,
  parseWatchOrigin,
  WebCrawlError,
} from "../src/server/web-origin.ts";
import { runWebOriginPoll } from "../src/server/web-watch.ts";

const DIRTY = path.resolve("fixtures/web/dirty");
const CLEAN = path.resolve("fixtures/web/clean");
const ORIGIN = "https://app.example.com/";

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

async function siteFetch(root: string): Promise<typeof fetch> {
  const index = await readFile(path.join(root, "index.html"));
  const appJs = await readFile(path.join(root, "app.js"));
  const mapPath = path.join(root, "app.js.map");
  let map: Buffer | null = null;
  try {
    map = await readFile(mapPath);
  } catch {
    map = null;
  }
  const files: Record<string, Buffer> = {
    [ORIGIN]: index,
    "https://app.example.com/app.js": appJs,
  };
  if (map) files["https://app.example.com/app.js.map"] = map;
  return (async (input) => {
    const url = String(input);
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

describe("website origin parsing", () => {
  it("accepts public https URLs and rejects local, private, and http", () => {
    expect(parseWatchOrigin("https://app.example.com/app")?.url).toBe(
      "https://app.example.com/app",
    );
    expect(parseWatchOrigin("http://app.example.com/")).toBeNull();
    expect(parseWatchOrigin("https://localhost/")).toBeNull();
    expect(parseWatchOrigin("https://127.0.0.1/")).toBeNull();
    expect(parseWatchOrigin("https://169.254.169.254/latest")).toBeNull();
    expect(parseWatchOrigin("https://user:pass@app.example.com/")).toBeNull();
  });

  it("collects same-origin scripts and ignores off-origin hrefs", () => {
    const html =
      '<script src="/app.js"></script><script src="https://cdn.example.net/x.js"></script><link rel="stylesheet" href="/app.css">';
    const urls = collectHtmlAssetUrls(html, new URL(ORIGIN));
    expect(urls).toContain("https://app.example.com/app.js");
    expect(urls).toContain("https://app.example.com/app.css");
    expect(urls.some((url) => url.includes("cdn.example.net"))).toBe(false);
  });
});

describe("website crawl", () => {
  it("fetches HTML, JS, and an exposed sibling map without executing scripts", async () => {
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: await siteFetch(DIRTY),
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel).sort()).toEqual(
      ["app.js", "app.js.map", "index.html"].sort(),
    );
    expect(crawled.truncated).toBe(false);
  });

  it("does not invent a map when the site does not ship one", async () => {
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: await siteFetch(CLEAN),
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel).sort()).toEqual(["app.js", "index.html"].sort());
  });

  it("marks a private DNS answer as inconclusive, never a fetch to that address", async () => {
    let fetched = 0;
    await expect(
      crawlOrigin(ORIGIN, {
        fetch: (async () => {
          fetched += 1;
          return new Response("nope");
        }) as typeof fetch,
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      }),
    ).rejects.toBeInstanceOf(WebCrawlError);
    expect(fetched).toBe(0);
  });

  it("stops at the asset limit instead of claiming a clean crawl", async () => {
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: await siteFetch(DIRTY),
      lookup: publicLookup,
      maxAssets: 1,
    });
    expect(crawled.truncated).toBe(true);
    expect(crawled.files.length).toBe(1);
  });
});

describe("hosted website watch", () => {
  it("connects an origin, crawls, alerts on maps, and deletes bytes", async () => {
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
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      let woke = 0;
      const webFetch = await siteFetch(DIRTY);
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
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
      expect(woke).toBe(1);
      const worker = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        webFetch,
        webLookup: publicLookup,
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await worker.stop();
      const { rows: alerts } = await sql.query<{ title: string; body: string; findings: unknown }>(
        "SELECT title, body, findings FROM alerts",
      );
      expect(alerts[0]?.title).toMatch(/Spoilers on app.example.com/);
      expect(JSON.stringify(alerts[0]?.findings)).toMatch(/MAP-001/);
      expect(JSON.stringify(alerts)).not.toMatch(/this-is-the-plot-twist/);
      const { rows: origins } = await sql.query<{ last_scan_status: string | null }>(
        "SELECT last_scan_status FROM watched_origins",
      );
      expect(origins[0]?.last_scan_status).toBe("failed-policy");
      const listed = await app.request("/api/origins", { headers: { cookie } });
      const listedBody = (await listed.json()) as { origins: { origin_url: string }[] };
      expect(listedBody.origins.map((row) => row.origin_url)).toEqual([ORIGIN]);
    } finally {
      await sql.close();
    }
  });

  it("refuses unpaid installs and other tenants", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "intruder" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
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
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(402);
      const outsider = await app.request("/api/origins", { headers: { cookie: other } });
      const outsiderBody = (await outsider.json()) as { origins: unknown[] };
      expect(outsiderBody.origins).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("requires typing the origin URL to unwatch and records a host-only audit row", async () => {
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
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
      const body = (await created.json()) as { origin: { id: number } };
      const missing = await app.request(`/api/origins/${body.origin.id}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(missing.status).toBe(400);
      const removed = await app.request(`/api/origins/${body.origin.id}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: ORIGIN }),
      });
      expect(removed.status).toBe(200);
      const { rows } = await sql.query<{ action: string; summary: string; target_id: string | null }>(
        "SELECT action, summary, target_id FROM audit_events",
      );
      expect(rows[0]?.action).toBe("origin.unwatch");
      expect(rows[0]?.target_id).toBe("app.example.com");
      expect(JSON.stringify(rows)).not.toMatch(/https:\/\//);
    } finally {
      await sql.close();
    }
  });

  it("hourly poller enqueues covered origins and skips unpaid", async () => {
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
      await store.insertWatchedOrigin(7, ORIGIN, "app.example.com");
      const queued = await runWebOriginPoll({ store });
      expect(queued.queued).toBe(1);
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await runWebOriginPoll({ store });
      expect(unpaid.queued).toBe(0);
    } finally {
      await sql.close();
    }
  });
});
