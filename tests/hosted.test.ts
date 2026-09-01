import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { databaseMode, loadConfig } from "../src/server/config.ts";
import type { GithubPort, GithubRepo } from "../src/server/github.ts";
import { githubSignature } from "../src/server/hmac.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { runVisibilityPoll } from "../src/server/poller.ts";
import { migrate, openSql, type SqlClient } from "../src/server/sql.ts";
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
    getInstallation: fail,
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
    databaseUrl: "pglite://:memory:",
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
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

describe("runtime health", () => {
  it("classifies neon hosts without exposing a connection string", () => {
    expect(databaseMode("pglite://./data/nospoilers")).toBe("pglite");
    expect(databaseMode("postgresql://u:p@ep-x.c-4.us-east-2.aws.neon.tech/neondb")).toBe("neon");
    expect(databaseMode("postgres://nospoilers:nospoilers@127.0.0.1:5433/nospoilers")).toBe(
      "postgres",
    );
  });

  it("reports database mode and recovery interval, never a URL", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        ok: boolean;
        database: { mode: string };
        worker: { recoveryIntervalMs: number; visibilityPollIntervalMs: number };
      };
      expect(body.ok).toBe(true);
      expect(body.database.mode).toBe("pglite");
      expect(body.worker.recoveryIntervalMs).toBeGreaterThanOrEqual(60_000);
      expect(body.worker.visibilityPollIntervalMs).toBeGreaterThanOrEqual(60_000);
      expect(JSON.stringify(body)).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(JSON.stringify(body)).not.toMatch(/pglite:\/\//i);
    });
  });
});

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

  it("returns 200 without queueing work for an unpaid installation", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const { app } = appFor(store);
      const res = await postWebhook(app, "repository", "d-unpaid-public", {
        action: "publicized",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: { ...sampleRepo, private: false },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; queued: boolean; skipped?: string };
      expect(body.ok).toBe(true);
      expect(body.queued).toBe(false);
      expect(body.skipped).toBe("uncovered");
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });
});

describe("installation ownership", () => {
  it("refuses to link a GitHub install the signed-in user does not own", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "u-customer", login: "acme-founder", accessToken: "ghu_customer" });
      const sessionId = await store.createSession("u-customer");
      const github = mockGithub({
        listUserInstallations: async () => [7],
        getInstallation: async (id) => ({
          id,
          account: { login: "octo", type: "User", id: 1 },
          suspended_at: null,
        }),
      });
      const { app } = appFor(store, github);
      const cookie = `ns_session=${signSession("sess", sessionId)}`;
      const denied = await app.request("/api/github/setup?installation_id=99", {
        headers: { cookie },
      });
      expect(denied.status).toBe(403);
      const { rows } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM installation_users",
      );
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("links only an install GitHub says the user has, for this App", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "u-owner", login: "octo", accessToken: "ghu_owner" });
      const sessionId = await store.createSession("u-owner");
      const github = mockGithub({
        listUserInstallations: async () => [7],
        getInstallation: async (id) => ({
          id,
          account: { login: "octo", type: "User", id: 22 },
          suspended_at: null,
        }),
      });
      const { app } = appFor(store, github);
      const cookie = `ns_session=${signSession("sess", sessionId)}`;
      const allowed = await app.request("/api/github/setup?installation_id=7", {
        headers: { cookie },
      });
      expect(allowed.status).toBe(302);
      expect(allowed.headers.get("location")).toBe("/watch");
      const { rows } = await store.sql.query<{ installation_id: string; user_id: string }>(
        "SELECT installation_id::text, user_id FROM installation_users",
      );
      expect(rows).toEqual([{ installation_id: "7", user_id: "u-owner" }]);
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

  it("finishes uncovered customer jobs without creating alerts", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      await store.enqueueJob({
        priority: "light",
        kind: "repo_publicized",
        payload: {
          installationId: 7,
          repo: {
            id: 99,
            owner: "octo",
            name: "throwaway",
            fullName: "octo/throwaway",
            private: false,
            htmlUrl: "https://github.com/octo/throwaway",
          },
        },
      });
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 40));
      await worker.stop();
      const { rows: alerts } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      const { rows: jobs } = await store.sql.query<{ status: string }>("SELECT status FROM jobs");
      expect(Number(alerts[0]?.n)).toBe(0);
      expect(jobs[0]?.status).toBe("done");
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

  it("does not poll or alert for an unpaid installation", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      let fetched = 0;
      const n = await runVisibilityPoll({
        store,
        github: mockGithub({
          getRepo: async () => {
            fetched += 1;
            throw new Error("unpaid poller must not call GitHub");
          },
        }),
        notifier: createLogNotifier(store),
      });
      expect(n).toBe(0);
      expect(fetched).toBe(0);
    });
  });
});
