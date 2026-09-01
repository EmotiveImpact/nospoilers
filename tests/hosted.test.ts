import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort, GithubRepo } from "../src/server/github.ts";
import { githubSignature } from "../src/server/hmac.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { runVisibilityPoll, startPoller } from "../src/server/poller.ts";
import { migrate, openSql, describeDatabaseUrl, splitSql, type SqlClient } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";

const SECRET = "test-webhook-secret";

function mockGithub(overrides: Partial<GithubPort> = {}): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub mock: unexpected call");
  };
  return {
    exchangeCode: fail,
    getUser: fail,
    listUserInstallations: fail,
    getRepo: fail,
    listReleaseAssets: fail,
    getLatestRelease: fail,
    downloadAsset: fail,
    ...overrides,
  };
}

async function withStore(
  run: (ctx: { sql: SqlClient; store: Store }) => Promise<void>,
): Promise<void> {
  const sql = await openSql("pglite://:memory:");
  try {
    await migrate(sql);
    await run({ sql, store: createStore(sql) });
  } finally {
    await sql.close();
  }
}

function appFor(
  store: Store,
  github: GithubPort = mockGithub(),
  wakeWorker?: () => void,
) {
  const scans: string[] = [];
  const config = loadConfig({
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
    databaseUrl: "pglite://:memory:",
    workerIntervalMs: 15 * 60 * 1000,
    pollIntervalMs: 60 * 60 * 1000,
  });
  const app = createApp({
    config,
    store,
    github,
    wakeWorker,
    scan: async (target: string) => {
      scans.push(target);
      return scan(target);
    },
  });
  return { app, scans };
}

async function postWebhook(
  app: ReturnType<typeof createApp>,
  event: string,
  deliveryId: string,
  payload: unknown,
  signature?: string,
) {
  const body = JSON.stringify(payload);
  return await app.request("/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signature ?? githubSignature(SECRET, body),
    },
    body,
  });
}

const sampleRepo = {
  id: 99,
  name: "throwaway",
  full_name: "octo/throwaway",
  private: false,
  html_url: "https://github.com/octo/throwaway",
  owner: { login: "octo" },
};

describe("GitHub webhooks", () => {
  it("rejects a bad HMAC", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "ping", "d-bad", { zen: "ok" }, "sha256=deadbeef");
      expect(res.status).toBe(401);
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("returns 200 and queues a release scan without calling scan", async () => {
    await withStore(async ({ store }) => {
      const { app, scans } = appFor(store);
      const res = await postWebhook(app, "release", "d-rel-1", {
        action: "published",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 55, tag_name: "v1.0.0", name: "v1.0.0" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; queued: boolean; kind: string };
      expect(body.ok).toBe(true);
      expect(body.queued).toBe(true);
      expect(body.kind).toBe("release_scan");
      expect(scans).toEqual([]);
      const { rows } = await store.sql.query<{ kind: string; priority: string; status: string }>(
        "SELECT kind, priority, status FROM jobs",
      );
      expect(rows).toEqual([{ kind: "release_scan", priority: "heavy", status: "queued" }]);
    });
  });

  it("wakes the worker immediately when a webhook queues work", async () => {
    await withStore(async ({ store }) => {
      let wakes = 0;
      const { app } = appFor(store, mockGithub(), () => {
        wakes += 1;
      });
      const res = await postWebhook(app, "release", "d-rel-wake", {
        action: "published",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 56, tag_name: "v1.0.1", name: "v1.0.1" },
      });
      expect(res.status).toBe(200);
      expect(wakes).toBe(1);
    });
  });

  it("is idempotent on GitHub delivery_id", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const payload = {
        action: "publicized",
        installation: { id: 7 },
        repository: { ...sampleRepo, private: false },
      };
      const first = await postWebhook(app, "repository", "same-delivery", payload);
      const second = await postWebhook(app, "repository", "same-delivery", payload);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(1);
    });
  });
});

describe("job concurrency", () => {
  it("caps heavy jobs at the configured global limit", async () => {
    await withStore(async ({ store }) => {
      for (let i = 0; i < 10; i += 1) {
        await store.enqueueJob({
          priority: "heavy",
          kind: "release_scan",
          payload: { i },
        });
      }
      let maxHeavy = 0;
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 3,
        lightConcurrency: 8,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        onJob: async () => {
          maxHeavy = Math.max(maxHeavy, worker.running.heavy);
          await new Promise((resolve) => setTimeout(resolve, 60));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(worker.running.heavy).toBeLessThanOrEqual(3);
      expect(maxHeavy).toBeLessThanOrEqual(3);
      expect(maxHeavy).toBeGreaterThan(0);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await worker.stop();
    });
  });

  it("still claims light jobs when heavy is at cap", async () => {
    await withStore(async ({ store }) => {
      for (let i = 0; i < 4; i += 1) {
        await store.enqueueJob({ priority: "heavy", kind: "release_scan", payload: { i } });
      }
      await store.enqueueJob({ priority: "light", kind: "repo_publicized", payload: { n: 1 } });
      await store.enqueueJob({ priority: "light", kind: "fork", payload: { n: 2 } });
      const kinds: string[] = [];
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 1,
        lightConcurrency: 2,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        onJob: async (job) => {
          kinds.push(job.kind);
          await new Promise((resolve) => setTimeout(resolve, 40));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(worker.running.heavy).toBe(1);
      expect(worker.running.light).toBeGreaterThan(0);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await worker.stop();
      expect(kinds.some((k) => k === "repo_publicized" || k === "fork")).toBe(true);
    });
  });

  it("prioritizes customer release jobs and caps internal prospect scans at one", async () => {
    await withStore(async ({ store }) => {
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 1 },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 2 },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 7 },
      });
      const started: string[] = [];
      let maxProspects = 0;
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 3,
        lightConcurrency: 2,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        onJob: async (job) => {
          started.push(job.kind);
          maxProspects = Math.max(maxProspects, worker.running.prospect);
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(started[0]).toBe("release_scan");
      expect(maxProspects).toBeLessThanOrEqual(1);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await worker.stop();
    });
  });

  it("drains queued work when a running job frees a slot", async () => {
    await withStore(async ({ store }) => {
      for (let i = 0; i < 3; i += 1) {
        await store.enqueueJob({
          priority: "heavy",
          kind: "release_scan",
          payload: { i },
        });
      }
      const handled: number[] = [];
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 1000,
        intervalMs: 60_000,
        onJob: async (job) => {
          handled.push(job.id);
          await new Promise((resolve) => setTimeout(resolve, 15));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();
      expect(handled).toHaveLength(3);
    });
  });
});

describe("visibility poller", () => {
  it("creates an alert when GitHub says a watched private repo is now public", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const github = mockGithub({
        getRepo: async () =>
          ({
            id: 99,
            name: "throwaway",
            full_name: "octo/throwaway",
            private: false,
            html_url: "https://github.com/octo/throwaway",
            owner: { login: "octo" },
          }) satisfies GithubRepo,
      });
      const n = await runVisibilityPoll({
        store,
        github,
        notifier: createLogNotifier(store),
      });
      expect(n).toBe(1);
      const { rows } = await store.sql.query<{ kind: string; title: string }>(
        "SELECT kind, title FROM alerts",
      );
      expect(rows[0]?.kind).toBe("repo_publicized");
      expect(rows[0]?.title).toContain("octo/throwaway");
    });
  });
});

describe("database identity", () => {
  it("classifies PGlite, Neon, and generic Postgres URLs without leaking secrets", () => {
    expect(describeDatabaseUrl("pglite://./data/nospoilers")).toEqual({
      driver: "pglite",
      host: "./data/nospoilers",
      database: null,
    });
    expect(
      describeDatabaseUrl(
        "postgresql://neondb_owner:secret@ep-example-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toEqual({
      driver: "neon",
      host: "ep-example-pooler.c-4.us-east-2.aws.neon.tech",
      database: "neondb",
    });
    expect(describeDatabaseUrl("postgres://nospoilers:nospoilers@127.0.0.1:5433/nospoilers")).toEqual({
      driver: "postgres",
      host: "127.0.0.1",
      database: "nospoilers",
    });
  });

  it("splits schema SQL so Neon pooler can apply statements one at a time", () => {
    const statements = splitSql(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);
      -- comment
      CREATE TABLE IF NOT EXISTS jobs (id BIGSERIAL PRIMARY KEY);
    `);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("users");
    expect(statements[1]).toContain("jobs");
  });
});

describe("health", () => {
  it("reports the live database driver and worker intervals", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        database: { driver: string; name: string };
        worker: { recoveryIntervalMs: number; visibilityPollIntervalMs: number };
      };
      expect(body.ok).toBe(true);
      expect(body.database.driver).toBe("pglite");
      expect(body.database.name).toBeTruthy();
      expect(body.worker.recoveryIntervalMs).toBe(15 * 60 * 1000);
      expect(body.worker.visibilityPollIntervalMs).toBe(60 * 60 * 1000);
    });
  });
});

describe("queue pickup", () => {
  it("wakes the worker immediately when scan-latest-release enqueues a job", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      await store.linkUserInstallation(7, "u1");
      const sessionId = await store.createSession("u1");
      let wakes = 0;
      const { app } = appFor(store, mockGithub(), () => {
        wakes += 1;
      });
      const res = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie: `ns_session=${signSession("sess", sessionId)}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean };
      expect(body.queued).toBe(true);
      expect(wakes).toBe(1);
    });
  });

  it("schedules a 15-minute recovery check instead of polling every 500ms", async () => {
    await withStore(async ({ store }) => {
      const intervals: number[] = [];
      const original = globalThis.setInterval.bind(globalThis);
      const spy = vi.spyOn(globalThis, "setInterval").mockImplementation((handler, timeout) => {
        if (typeof timeout === "number") intervals.push(timeout);
        return original(handler as never, timeout as never);
      });
      try {
        const worker = createWorker({
          store,
          github: mockGithub(),
          notifier: createLogNotifier(store),
          heavyConcurrency: 2,
          lightConcurrency: 2,
          maxAssetBytes: 1000,
          intervalMs: 15 * 60 * 1000,
        });
        worker.start();
        expect(intervals).toEqual([15 * 60 * 1000]);
        expect(intervals).not.toContain(500);
        await new Promise((resolve) => setTimeout(resolve, 40));
        await worker.stop();
      } finally {
        spy.mockRestore();
      }
    });
  });

  it("defaults recovery to 15 minutes and the visibility backstop to one hour", () => {
    const previousWorker = process.env.WORKER_INTERVAL_MS;
    const previousPoll = process.env.POLL_INTERVAL_MS;
    delete process.env.WORKER_INTERVAL_MS;
    delete process.env.POLL_INTERVAL_MS;
    try {
      const config = loadConfig({ databaseUrl: "pglite://:memory:" });
      expect(config.workerIntervalMs).toBe(15 * 60 * 1000);
      expect(config.pollIntervalMs).toBe(60 * 60 * 1000);
    } finally {
      if (previousWorker === undefined) delete process.env.WORKER_INTERVAL_MS;
      else process.env.WORKER_INTERVAL_MS = previousWorker;
      if (previousPoll === undefined) delete process.env.POLL_INTERVAL_MS;
      else process.env.POLL_INTERVAL_MS = previousPoll;
    }
  });

  it("registers the hourly visibility poller on the configured interval", () => {
    const intervals: number[] = [];
    const original = globalThis.setInterval.bind(globalThis);
    const spy = vi.spyOn(globalThis, "setInterval").mockImplementation((handler, timeout) => {
      if (typeof timeout === "number") intervals.push(timeout);
      return original(handler as never, timeout as never);
    });
    try {
      const poller = startPoller(
        {
          store: {} as never,
          github: mockGithub(),
          notifier: { send: async () => undefined },
        },
        60 * 60 * 1000,
      );
      expect(intervals).toEqual([60 * 60 * 1000]);
      poller.stop();
    } finally {
      spy.mockRestore();
    }
  });
});
