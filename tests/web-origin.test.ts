import { readdir, readFile } from "node:fs/promises";
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
  collectSensitiveUrls,
  crawlOrigin,
  parseWatchOrigin,
  WebCrawlError,
} from "../src/server/web-origin.ts";
import { runWebOriginPoll } from "../src/server/web-watch.ts";

const DIRTY = path.resolve("fixtures/web/dirty");
const CLEAN = path.resolve("fixtures/web/clean");
const ORIGIN = "https://app.example.com/";

const FIXTURE_PUBLIC_PATH: Record<string, string> = {
  "exposed.env": ".env",
  "exposed.git-HEAD": ".git/HEAD",
};

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

function mimeFor(rel: string): string {
  if (rel.endsWith(".map")) return "application/json";
  if (/\.(?:js|mjs|cjs)$/i.test(rel)) return "application/javascript";
  if (rel.endsWith(".css")) return "text/css";
  if (/\.(?:html|htm|php)$/i.test(rel) || rel === "internal/debug") return "text/html";
  return "text/plain";
}

async function loadSiteFiles(root: string): Promise<Record<string, Buffer>> {
  const out: Record<string, Buffer> = {};
  async function walk(dir: string, rel: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), nextRel);
      } else if (entry.isFile()) {
        out[nextRel] = await readFile(path.join(dir, entry.name));
      }
    }
  }
  await walk(root, "");
  for (const [from, to] of Object.entries(FIXTURE_PUBLIC_PATH)) {
    if (out[from]) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

async function siteFetch(root: string): Promise<typeof fetch> {
  const disk = await loadSiteFiles(root);
  const files: Record<string, { body: Buffer; type: string }> = {};
  for (const [rel, body] of Object.entries(disk)) {
    files[`https://app.example.com/${rel}`] = { body, type: mimeFor(rel) };
  }
  if (disk["index.html"]) {
    files[ORIGIN] = { body: disk["index.html"], type: "text/html" };
  }
  return (async (input) => {
    const url = String(input);
    const hit = files[url];
    if (!hit) return new Response("missing", { status: 404 });
    return new Response(hit.body, { status: 200, headers: { "content-type": hit.type } });
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

  it("collects same-origin exposed paths and ignores off-origin credential hrefs", () => {
    const html =
      '<a href="/.env">env</a><a href="/internal/debug">debug</a><a href="https://evil.com/.env">nope</a><a href="javascript:alert(1)">js</a> fetch("/.git/HEAD")';
    const urls = collectSensitiveUrls(html, new URL(ORIGIN));
    expect(urls).toContain("https://app.example.com/.env");
    expect(urls).toContain("https://app.example.com/internal/debug");
    expect(urls).toContain("https://app.example.com/.git/HEAD");
    expect(urls.some((url) => url.includes("evil.com"))).toBe(false);
    expect(urls.some((url) => url.startsWith("javascript:"))).toBe(false);
  });
});

describe("website crawl", () => {
  it("fetches HTML, JS, maps, exposed files, and linked internal paths without executing scripts", async () => {
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: await siteFetch(DIRTY),
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel).sort()).toEqual(
      [".env", ".git/HEAD", "app.js", "app.js.map", "index.html", "internal/debug"].sort(),
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

  it("skips missing exposed probes instead of failing the crawl", async () => {
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: await siteFetch(CLEAN),
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel).sort()).toEqual(["app.js", "index.html"].sort());
    expect(crawled.truncated).toBe(false);
  });

  it("does not treat SPA catch-all HTML on /.env as an environment file", async () => {
    const home = Buffer.from("<!doctype html><html><body>spa</body></html>");
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: (async () =>
        new Response(home, { status: 200, headers: { "content-type": "text/html" } })) as typeof fetch,
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel)).toEqual(["index.html"]);
  });

  it("does not treat a distinct HTML 404 page on a secret path as an environment file", async () => {
    const home = Buffer.from("<!doctype html><html><body>home</body></html>");
    const missing = Buffer.from("<!doctype html><html><body>not found</body></html>");
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: (async (input) => {
        const url = String(input);
        if (url === ORIGIN) {
          return new Response(home, { status: 200, headers: { "content-type": "text/html" } });
        }
        return new Response(missing, { status: 200, headers: { "content-type": "text/html" } });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(crawled.files.map((row) => row.rel)).toEqual(["index.html"]);
  });

  it("never fetches an off-origin credential href", async () => {
    const html = Buffer.from(
      '<!doctype html><html><body><a href="https://evil.com/.env">x</a></body></html>',
    );
    const fetched: string[] = [];
    const crawled = await crawlOrigin(ORIGIN, {
      fetch: (async (input) => {
        const url = String(input);
        fetched.push(url);
        if (url === ORIGIN) {
          return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
        }
        return new Response("missing", { status: 404 });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(fetched.some((url) => url.includes("evil.com"))).toBe(false);
    expect(crawled.files.map((row) => row.rel)).toEqual(["index.html"]);
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
      const findings = JSON.stringify(alerts[0]?.findings);
      expect(findings).toMatch(/MAP-001/);
      expect(findings).toMatch(/SEC-001/);
      expect(findings).toMatch(/GIT-001/);
      expect(JSON.stringify(alerts)).not.toMatch(/this-is-the-plot-twist/);
      expect(JSON.stringify(alerts)).not.toMatch(/sk_live_example/);
      expect(JSON.stringify(alerts)).not.toMatch(/ghp_exampletoken/);
      const { rows: origins } = await sql.query<{ last_scan_status: string | null }>(
        "SELECT last_scan_status FROM watched_origins",
      );
      expect(origins[0]?.last_scan_status).toBe("failed-policy");
      const listed = await app.request("/api/origins", { headers: { cookie } });
      const listedBody = (await listed.json()) as { origins: { origin_url: string }[] };
      expect(listedBody.origins.map((row) => row.origin_url)).toEqual([ORIGIN]);
      const { rows: usage } = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usage[0]?.n ?? 0)).toBe(1);
    } finally {
      await sql.close();
    }
  });

  it("refunds an unchanged website crawl that never scans", async () => {
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
      const webFetch = await siteFetch(CLEAN);
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
        wakeWorker: () => {},
      });
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
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
      await worker.stop();
      const usageAfterFirst = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usageAfterFirst.rows[0]?.n ?? 0)).toBe(1);
      const queued = await runWebOriginPoll({ store });
      expect(queued.queued).toBe(1);
      const usageAfterPoll = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usageAfterPoll.rows[0]?.n ?? 0)).toBe(2);
      const again = createWorker({
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
      await again.tick();
      await again.stop();
      const usageAfterUnchanged = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usageAfterUnchanged.rows[0]?.n ?? 0)).toBe(1);
      const { rows: alerts } = await sql.query<{ title: string }>("SELECT title FROM alerts");
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.title).toMatch(/app.example.com is allowed to ship/);
    } finally {
      await sql.close();
    }
  });

  it("refunds a website crawl that fails before scan", async () => {
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
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {},
      });
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
      const worker = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        receiptSecret: "web-origin-receipt-secret",
        webFetch: (async () => {
          throw new Error("website mock: unexpected fetch");
        }) as typeof fetch,
        webLookup: async () => [{ address: "127.0.0.1", family: 4 }],
      });
      await worker.tick();
      await worker.stop();
      const { rows: usage } = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usage[0]?.n ?? 0)).toBe(0);
      const { rows: alerts } = await sql.query<{ title: string; body: string }>(
        "SELECT title, body FROM alerts",
      );
      expect(alerts[0]?.title).toMatch(/Inconclusive crawl of app.example.com/);
      expect(alerts[0]?.body).toMatch(/private or reserved/);
    } finally {
      await sql.close();
    }
  });

  it("keeps the unpack slot when a website crawl scans", async () => {
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
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {},
      });
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
      const worker = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan: async () => {
          throw new Error("scanner exploded after the crawl wrote files");
        },
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        webFetch: await siteFetch(CLEAN),
        webLookup: publicLookup,
      });
      await worker.tick();
      await worker.stop();
      const { rows: usage } = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usage[0]?.n ?? 0)).toBe(1);
      const { rows: jobs } = await sql.query<{ error: string | null }>(
        "SELECT error FROM jobs WHERE kind = 'web_origin_scan'",
      );
      expect(jobs[0]?.error).toMatch(/scanner exploded/);
    } finally {
      await sql.close();
    }
  });

  it("keeps the unpack slot when a later website crawl finds new bytes", async () => {
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
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {},
      });
      const created = await app.request("/api/origins", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: ORIGIN, installationId: 7 }),
      });
      expect(created.status).toBe(201);
      const first = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        webFetch: await siteFetch(CLEAN),
        webLookup: publicLookup,
      });
      await first.tick();
      await first.stop();
      const queued = await runWebOriginPoll({ store });
      expect(queued.queued).toBe(1);
      const second = createWorker({
        store,
        github: unusedGithub(),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        webFetch: await siteFetch(DIRTY),
        webLookup: publicLookup,
      });
      await second.tick();
      await second.stop();
      const { rows: usage } = await sql.query<{ n: string }>(
        `SELECT COALESCE(heavy_jobs, 0)::text AS n FROM hosted_usage_days
         WHERE installation_id = 7 AND day = (timezone('utc', now()))::date`,
      );
      expect(Number(usage[0]?.n ?? 0)).toBe(2);
      const { rows: alerts } = await sql.query<{ title: string }>(
        "SELECT title FROM alerts ORDER BY id",
      );
      expect(alerts).toHaveLength(2);
      expect(alerts[1]?.title).toMatch(/Spoilers on app.example.com/);
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
