import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/server/app.ts";
import { databaseMode, loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort, type GithubRepo } from "../src/server/github.ts";
import { githubSignature } from "../src/server/hmac.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { runVisibilityPoll } from "../src/server/poller.ts";
import { migrate, openSql, type SqlClient } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { packAssetFingerprint, releaseScanDeliveryId } from "../src/server/webhooks.ts";
import { scan } from "../src/scanner/index.ts";
import { SOLO_HEAVY_FAIR_USE, TEAM_HEAVY_FAIR_USE } from "../src/server/fair-use.ts";

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

async function heavyUsage(store: Store, installationId = 7): Promise<number> {
  const { rows } = await store.sql.query<{ n: string }>(
    `SELECT COALESCE(heavy_jobs, 0)::text AS n
     FROM hosted_usage_days
     WHERE installation_id = $1 AND day = (timezone('utc', now()))::date`,
    [installationId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function withStore(
  run: (ctx: { sql: SqlClient; store: Store }) => Promise<void>,
  storeOpts?: { jobMaxAttempts?: number; jobRetryBaseMs?: number },
): Promise<void> {
  const sql = await openSql("pglite://:memory:");
  try {
    await migrate(sql);
    await run({ sql, store: createStore(sql, storeOpts) });
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

      const ready = await app.request("/api/ready");
      expect(ready.status).toBe(200);
      const readyBody = (await ready.json()) as {
        ready: boolean;
        database: { mode: string; ok: boolean };
      };
      expect(readyBody.ready).toBe(true);
      expect(readyBody.database.ok).toBe(true);
      expect(readyBody.database.mode).toBe("pglite");
      expect(JSON.stringify(readyBody)).not.toMatch(/postgres(?:ql)?:\/\//i);
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
      expect(rows).toEqual([{ kind: "release_scan", priority: "light", status: "queued" }]);
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

  it("removes a deleted repository instead of resurrecting it", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "repository", "d-del-pub", {
        action: "publicized",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      const deleted = await postWebhook(app, "repository", "d-del-1", {
        action: "deleted",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      expect(deleted.status).toBe(200);
      expect(((await deleted.json()) as { queued: boolean; kind: string }).kind).toBe("repo_deleted");
      const { rows: afterDelete } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM repos",
      );
      expect(Number(afterDelete[0]?.n)).toBe(0);

      const again = await postWebhook(app, "repository", "d-del-2", {
        action: "deleted",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      expect(again.status).toBe(200);
      const { rows: stillGone } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM repos",
      );
      expect(Number(stillGone[0]?.n)).toBe(0);
    });
  });

  it("updates a renamed repository without a second job", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "repository", "d-ren-1", {
        action: "publicized",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      const renamed = await postWebhook(app, "repository", "d-ren-2", {
        action: "renamed",
        installation: { id: 7 },
        repository: {
          ...sampleRepo,
          name: "renamed",
          full_name: "octo/renamed",
          html_url: "https://github.com/octo/renamed",
        },
      });
      expect(renamed.status).toBe(200);
      expect(((await renamed.json()) as { queued: boolean }).queued).toBe(false);
      const { rows } = await store.sql.query<{ full_name: string; html_url: string }>(
        "SELECT full_name, html_url FROM repos",
      );
      expect(rows).toEqual([
        { full_name: "octo/renamed", html_url: "https://github.com/octo/renamed" },
      ]);
      const { rows: jobs } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(jobs[0]?.n)).toBe(1);
    });
  });

  it("queues a light job when a repository is transferred", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "repository", "d-xfer-1", {
        action: "transferred",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(true);
      expect(body.kind).toBe("repo_transferred");
      const { rows } = await store.sql.query<{ kind: string; priority: string }>(
        "SELECT kind, priority FROM jobs",
      );
      expect(rows).toEqual([{ kind: "repo_transferred", priority: "light" }]);
    });
  });

  it("alerts when a transferred repository job runs", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "repository", "d-xfer-alert", {
        action: "transferred",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      expect(res.status).toBe(200);
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 4,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
      });
      await worker.tick();
      const started = Date.now();
      while (Date.now() - started < 4000) {
        const { rows } = await store.sql.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM alerts WHERE kind = 'repo_transferred'",
        );
        if (Number(rows[0]?.n) === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await worker.stop();
      const { rows: alerts } = await store.sql.query<{ title: string; body: string }>(
        "SELECT title, body FROM alerts WHERE kind = 'repo_transferred'",
      );
      expect(alerts).toHaveLength(1);
      expect(alerts[0]?.title).toMatch(/transferred/i);
      expect(alerts[0]?.body).toMatch(/visibility/i);
      expect(`${alerts[0]?.title} ${alerts[0]?.body}`).not.toMatch(/ghs_|token=/i);
    });
  });

  it("queues a light job for the GitHub public event", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "public", "d-public-1", {
        installation: { id: 7 },
        repository: { ...sampleRepo, private: false },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(true);
      expect(body.kind).toBe("repo_publicized");
      const { rows } = await store.sql.query<{ kind: string; priority: string }>(
        "SELECT kind, priority FROM jobs",
      );
      expect(rows).toEqual([{ kind: "repo_publicized", priority: "light" }]);
    });
  });

  it("updates a privatized repository in place and does not enqueue a job", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "repository", "d-pub-then-priv", {
        action: "publicized",
        installation: { id: 7 },
        repository: sampleRepo,
      });
      const privatized = await postWebhook(app, "repository", "d-priv-1", {
        action: "privatized",
        installation: { id: 7 },
        repository: { ...sampleRepo, private: true },
      });
      expect(privatized.status).toBe(200);
      const body = (await privatized.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(false);
      expect(body.kind).toBe("privatized");
      const { rows } = await store.sql.query<{ full_name: string; private: boolean | unknown }>(
        "SELECT full_name, private FROM repos",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.full_name).toBe("octo/throwaway");
      expect(Boolean(rows[0]?.private)).toBe(true);
      const { rows: jobs } = await store.sql.query<{ kind: string }>("SELECT kind FROM jobs");
      expect(jobs).toEqual([{ kind: "repo_publicized" }]);
    });
  });

  it("queues a light job when a collaborator is added", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "member", "d-member-1", {
        action: "added",
        installation: { id: 7 },
        repository: sampleRepo,
        member: { login: "new-collab" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(true);
      expect(body.kind).toBe("member_added");
      const { rows } = await store.sql.query<{
        kind: string;
        priority: string;
        payload: { login?: string };
      }>("SELECT kind, priority, payload FROM jobs");
      expect(rows).toEqual([
        { kind: "member_added", priority: "light", payload: expect.objectContaining({ login: "new-collab" }) },
      ]);
    });
  });

  it("does not queue work for other member actions", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "member", "d-member-removed", {
        action: "removed",
        installation: { id: 7 },
        repository: sampleRepo,
        member: { login: "new-collab" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(false);
      expect(body.kind).toBe("member");
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("queues a light job when a repository is forked", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const res = await postWebhook(app, "fork", "d-fork-1", {
        installation: { id: 7 },
        repository: sampleRepo,
        forkee: { full_name: "other/throwaway" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; kind: string };
      expect(body.queued).toBe(true);
      expect(body.kind).toBe("fork");
      const { rows } = await store.sql.query<{
        kind: string;
        priority: string;
        payload: { fork?: string };
      }>("SELECT kind, priority, payload FROM jobs");
      expect(rows).toEqual([
        { kind: "fork", priority: "light", payload: expect.objectContaining({ fork: "other/throwaway" }) },
      ]);
    });
  });

  it("queues a light job only for cheap *.map and .env push paths", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const ignored = await postWebhook(app, "push", "d-push-ignored", {
        ref: "refs/heads/main",
        installation: { id: 7 },
        repository: sampleRepo,
        commits: [
          {
            added: ["src/index.js", "secret.env"],
            modified: ["README.md"],
            removed: ["docs/notes.txt"],
          },
        ],
      });
      expect(ignored.status).toBe(200);
      const ignoredBody = (await ignored.json()) as { queued: boolean; kind: string };
      expect(ignoredBody.queued).toBe(false);
      expect(ignoredBody.kind).toBe("push_ignored");
      expect(Number((await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs")).rows[0]?.n)).toBe(
        0,
      );

      const hit = await postWebhook(app, "push", "d-push-map", {
        ref: "refs/heads/main",
        installation: { id: 7 },
        repository: sampleRepo,
        commits: [
          {
            added: ["dist/app.js.map", "src/index.js"],
            modified: [".env.local"],
            removed: ["secret.env"],
          },
        ],
      });
      expect(hit.status).toBe(200);
      const hitBody = (await hit.json()) as { queued: boolean; kind: string };
      expect(hitBody.queued).toBe(true);
      expect(hitBody.kind).toBe("push_sensitive_path");
      const { rows } = await store.sql.query<{
        kind: string;
        priority: string;
        payload: { paths?: string[] };
      }>("SELECT kind, priority, payload FROM jobs");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe("push_sensitive_path");
      expect(rows[0]?.priority).toBe("light");
      expect(rows[0]?.payload.paths?.sort()).toEqual([".env.local", "dist/app.js.map"]);
    });
  });

  it("returns 200 without queueing member, fork, or push work when unpaid", async () => {
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
      const member = await postWebhook(app, "member", "d-member-unpaid", {
        action: "added",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: sampleRepo,
        member: { login: "new-collab" },
      });
      const fork = await postWebhook(app, "fork", "d-fork-unpaid", {
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: sampleRepo,
        forkee: { full_name: "other/throwaway" },
      });
      const push = await postWebhook(app, "push", "d-push-unpaid", {
        ref: "refs/heads/main",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: sampleRepo,
        commits: [{ added: ["app.js.map"], modified: [], removed: [] }],
      });
      for (const res of [member, fork, push]) {
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; queued: boolean; skipped?: string };
        expect(body.ok).toBe(true);
        expect(body.queued).toBe(false);
        expect(body.skipped).toBe("uncovered");
      }
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("rejects member, fork, and push webhooks without HMAC", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      for (const event of ["member", "fork", "push"] as const) {
        const res = await postWebhook(app, event, `d-${event}-bad`, { installation: { id: 7 } }, "sha256=deadbeef");
        expect(res.status).toBe(401);
      }
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("alerts when member, fork, and cheap-push jobs run", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const member = await postWebhook(app, "member", "d-member-alert", {
        action: "added",
        installation: { id: 7 },
        repository: sampleRepo,
        member: { login: "new-collab" },
      });
      const fork = await postWebhook(app, "fork", "d-fork-alert", {
        installation: { id: 7 },
        repository: sampleRepo,
        forkee: { full_name: "other/throwaway" },
      });
      const push = await postWebhook(app, "push", "d-push-alert", {
        ref: "refs/heads/main",
        installation: { id: 7 },
        repository: sampleRepo,
        commits: [{ added: ["dist/app.js.map"], modified: [], removed: [] }],
      });
      expect(member.status).toBe(200);
      expect(fork.status).toBe(200);
      expect(push.status).toBe(200);

      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 4,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
      });
      await worker.tick();
      const started = Date.now();
      while (Date.now() - started < 4000) {
        const { rows } = await store.sql.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM alerts WHERE kind IN ('member_added', 'fork', 'push_sensitive_path')",
        );
        if (Number(rows[0]?.n) === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await worker.stop();
      const { rows: alerts } = await store.sql.query<{ kind: string; title: string; body: string }>(
        "SELECT kind, title, body FROM alerts ORDER BY id",
      );
      expect(alerts.map((row) => row.kind).sort()).toEqual(["fork", "member_added", "push_sensitive_path"]);
      const byKind = Object.fromEntries(alerts.map((row) => [row.kind, row]));
      expect(byKind.member_added?.title).toMatch(/new-collab/);
      expect(byKind.fork?.body).toMatch(/other\/throwaway/);
      expect(byKind.push_sensitive_path?.body).toMatch(/dist\/app\.js\.map/);
      expect(byKind.push_sensitive_path?.body).toMatch(/did not unpack the git tree/);
      expect(alerts.every((row) => !/ghs_|token=/i.test(`${row.title} ${row.body}`))).toBe(true);
    });
  });

  it("still drops a deleted repository when coverage has ended", async () => {
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
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const { app } = appFor(store);
      const res = await postWebhook(app, "repository", "d-del-unpaid", {
        action: "deleted",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: sampleRepo,
      });
      expect(res.status).toBe(200);
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM repos");
      expect(Number(rows[0]?.n)).toBe(0);
      const { rows: jobs } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(jobs[0]?.n)).toBe(0);
    });
  });

  it("rejects a GitHub App authorization revoke without HMAC", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "4242", login: "octo", accessToken: "ghu_keep" });
      const sessionId = await store.createSession("4242");
      const { app } = appFor(store);
      const res = await postWebhook(
        app,
        "github_app_authorization",
        "d-authz-bad",
        { action: "revoked", sender: { id: 4242, login: "octo" } },
        "sha256=deadbeef",
      );
      expect(res.status).toBe(401);
      expect(await store.getSession(sessionId)).not.toBeNull();
      expect(await store.getUserAccessToken("4242")).toBe("ghu_keep");
    });
  });

  it("drops that user's sessions and OAuth token when GitHub App authorization is revoked", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "4242", login: "octo", accessToken: "ghu_revoked" });
      await store.upsertUser({ id: "99", login: "other", accessToken: "ghu_other" });
      const revokedA = await store.createSession("4242");
      const revokedB = await store.createSession("4242");
      const otherSession = await store.createSession("99");
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 4242,
      });
      await store.linkUserInstallation(7, "4242");
      let wakes = 0;
      const { app } = appFor(store, mockGithub(), () => {
        wakes += 1;
      });
      const res = await postWebhook(app, "github_app_authorization", "d-authz-1", {
        action: "revoked",
        sender: { id: 4242, login: "octo", html_url: "https://github.com/octo" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; queued: boolean; kind: string };
      expect(body).toEqual({ ok: true, queued: false, kind: "github_app_authorization" });
      expect(JSON.stringify(body)).not.toMatch(/ghu_|token/i);
      expect(wakes).toBe(0);
      expect(await store.getSession(revokedA)).toBeNull();
      expect(await store.getSession(revokedB)).toBeNull();
      expect(await store.getSession(otherSession)).not.toBeNull();
      expect(await store.getUserAccessToken("4242")).toBeNull();
      expect(await store.getUserAccessToken("99")).toBe("ghu_other");
      const cookie = `ns_session=${signSession("sess", revokedA)}`;
      const me = await app.request("/api/me", { headers: { cookie } });
      expect(((await me.json()) as { user: unknown }).user).toBeNull();
      const { rows: jobs } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(jobs[0]?.n)).toBe(0);
      const { rows: installs } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM installations",
      );
      expect(Number(installs[0]?.n)).toBe(1);
    });
  });

  it("still drops sessions on authorization revoke when the install is unpaid", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "4242", login: "octo", accessToken: "ghu_unpaid" });
      const sessionId = await store.createSession("4242");
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 4242,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const { app } = appFor(store);
      const res = await postWebhook(app, "github_app_authorization", "d-authz-unpaid", {
        action: "revoked",
        sender: { id: 4242, login: "octo" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { queued: boolean; skipped?: string };
      expect(body.queued).toBe(false);
      expect(body.skipped).toBeUndefined();
      expect(await store.getSession(sessionId)).toBeNull();
      expect(await store.getUserAccessToken("4242")).toBeNull();
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("ignores an unknown sender and non-revoked GitHub App authorization actions", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "4242", login: "octo", accessToken: "ghu_keep" });
      const sessionId = await store.createSession("4242");
      const { app } = appFor(store);
      const unknown = await postWebhook(app, "github_app_authorization", "d-authz-unknown", {
        action: "revoked",
        sender: { id: 999001, login: "ghost" },
      });
      expect(unknown.status).toBe(200);
      expect(((await unknown.json()) as { queued: boolean }).queued).toBe(false);
      const otherAction = await postWebhook(app, "github_app_authorization", "d-authz-other", {
        action: "created",
        sender: { id: 4242, login: "octo" },
      });
      expect(otherAction.status).toBe(200);
      expect(await store.getSession(sessionId)).not.toBeNull();
      expect(await store.getUserAccessToken("4242")).toBe("ghu_keep");
      const { rows: users } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM users WHERE id = '999001'",
      );
      expect(Number(users[0]?.n)).toBe(0);
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("rejects an installation-target rename without HMAC", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 4242,
      });
      const { app } = appFor(store);
      const res = await postWebhook(
        app,
        "installation_target",
        "d-rename-bad",
        {
          action: "renamed",
          target_type: "User",
          account: { login: "octo-new", id: 4242, type: "User" },
          changes: { login: { from: "octo" } },
          installation: { id: 7, account: { login: "octo", id: 4242, type: "User" } },
        },
        "sha256=deadbeef",
      );
      expect(res.status).toBe(401);
      const row = await store.getInstallation(7);
      expect(row?.account_login).toBe("octo");
    });
  });

  it("updates the stored account login when the install target is renamed", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 4242,
      });
      let wakes = 0;
      const { app } = appFor(store, mockGithub(), () => {
        wakes += 1;
      });
      const res = await postWebhook(app, "installation_target", "d-rename-1", {
        action: "renamed",
        target_type: "User",
        account: { login: "octo-new", id: 4242, type: "User" },
        changes: { login: { from: "octo" } },
        installation: { id: 7, account: { login: "octo", id: 4242, type: "User" } },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; queued: boolean; kind: string };
      expect(body).toEqual({ ok: true, queued: false, kind: "installation_target" });
      expect(JSON.stringify(body)).not.toMatch(/octo-new|octo-old|from/i);
      expect(wakes).toBe(0);
      const row = await store.getInstallation(7);
      expect(row).toMatchObject({
        account_login: "octo-new",
        account_type: "User",
        account_id: 4242,
        suspended: false,
      });
      const { rows: jobs } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(jobs[0]?.n)).toBe(0);
      const { rows: alerts } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(Number(alerts[0]?.n)).toBe(0);
    });
  });

  it("still renames an unpaid install target and ignores other actions", async () => {
    await withStore(async ({ store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 4242,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const { app } = appFor(store);
      const renamed = await postWebhook(app, "installation_target", "d-rename-unpaid", {
        action: "renamed",
        target_type: "Organization",
        account: { slug: "octo-org", id: 99, type: "Organization" },
        changes: { login: { from: "octo" } },
        installation: { id: 7, account: { login: "octo", id: 4242, type: "User" } },
      });
      expect(renamed.status).toBe(200);
      expect(((await renamed.json()) as { queued: boolean; skipped?: string }).skipped).toBeUndefined();
      expect((await store.getInstallation(7))?.account_login).toBe("octo-org");
      expect((await store.getInstallation(7))?.account_type).toBe("Organization");
      expect((await store.getInstallation(7))?.account_id).toBe(99);
      const other = await postWebhook(app, "installation_target", "d-rename-other", {
        action: "created",
        account: { login: "should-ignore", id: 1, type: "User" },
        installation: { id: 7, account: { login: "octo-org", id: 99, type: "Organization" } },
      });
      expect(other.status).toBe(200);
      expect((await store.getInstallation(7))?.account_login).toBe("octo-org");
      const unknown = await postWebhook(app, "installation_target", "d-rename-unknown", {
        action: "renamed",
        account: { login: "ghost", id: 1, type: "User" },
        installation: { id: 404, account: { login: "ghost", id: 1, type: "User" } },
      });
      expect(unknown.status).toBe(200);
      expect(await store.getInstallation(404)).toBeNull();
      const { rows: installs } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM installations",
      );
      expect(Number(installs[0]?.n)).toBe(1);
      const { rows: jobs } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(jobs[0]?.n)).toBe(0);
    });
  });

  it("fingerprints pack assets without download URLs", () => {
    const withUrls = packAssetFingerprint([
      {
        id: 2,
        name: "app.tgz",
        size: 12,
        digest: "sha256:abc",
        url: "https://api.github.com/repos/octo/throwaway/releases/assets/2",
        browser_download_url: "https://github.com/octo/throwaway/releases/download/v1/app.tgz",
      },
      {
        id: 1,
        name: "README.md",
        size: 4,
        url: "https://api.github.com/repos/octo/throwaway/releases/assets/1",
      },
    ]);
    const withoutUrls = packAssetFingerprint([
      { id: 2, name: "app.tgz", size: 12, digest: "sha256:abc" },
    ]);
    expect(withUrls).toBe(withoutUrls);
    expect(withUrls).not.toBe("empty");
    expect(packAssetFingerprint([{ name: "notes.txt", size: 1 }])).toBe("empty");
    expect(
      packAssetFingerprint([{ id: 1, name: "Hearback-0.1.7-arm64-mac.zip", size: 138007237 }]),
    ).toBe("empty");
    expect(
      packAssetFingerprint([{ id: 2, name: "Hearback-0.1.7-x86_64.AppImage", size: 137102339 }]),
    ).toBe("empty");
    expect(
      packAssetFingerprint([
        { id: 3, name: "sourcemap.tgz", size: 401 },
        { id: 1, name: "Hearback-0.1.7-arm64-mac.zip", size: 138007237 },
      ]),
    ).toBe(packAssetFingerprint([{ id: 3, name: "sourcemap.tgz", size: 401 }]));
    expect(releaseScanDeliveryId(7, 55, withUrls)).toBe(`release-scan:7:55:${withUrls}`);
  });

  it("scans a release again only when pack assets change", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const pack = {
        id: 901,
        name: "app.tgz",
        size: 12,
        digest: "sha256:abc",
        url: "https://api.github.com/repos/octo/throwaway/releases/assets/901",
        browser_download_url: "https://github.com/octo/throwaway/releases/download/v1.2.0/app.tgz?token=ghs_secret",
      };
      const published = await postWebhook(app, "release", "d-rel-edit-1", {
        action: "published",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 80, tag_name: "v1.2.0", name: "v1.2.0", assets: [pack] },
      });
      const editedSame = await postWebhook(app, "release", "d-rel-edit-2", {
        action: "edited",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 80, tag_name: "v1.2.0", name: "v1.2.0 notes", assets: [pack] },
      });
      const editedNew = await postWebhook(app, "release", "d-rel-edit-3", {
        action: "edited",
        installation: { id: 7 },
        repository: sampleRepo,
        release: {
          id: 80,
          tag_name: "v1.2.0",
          name: "v1.2.0 notes",
          assets: [{ ...pack, id: 902, size: 24, digest: "sha256:def" }],
        },
      });
      expect(published.status).toBe(200);
      expect(editedSame.status).toBe(200);
      expect(editedNew.status).toBe(200);
      expect(((await editedSame.json()) as { queued: boolean }).queued).toBe(false);
      expect(((await editedNew.json()) as { queued: boolean }).queued).toBe(true);
      const { rows } = await store.sql.query<{
        kind: string;
        priority: string;
        delivery_id: string;
        payload: unknown;
      }>("SELECT kind, priority, delivery_id, payload FROM jobs ORDER BY id");
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.kind === "release_scan")).toBe(true);
      expect(rows.map((row) => row.priority)).toEqual(["heavy", "heavy"]);
      const firstFp = packAssetFingerprint([pack]);
      const secondFp = packAssetFingerprint([{ ...pack, id: 902, size: 24, digest: "sha256:def" }]);
      expect(rows.map((row) => row.delivery_id)).toEqual([
        releaseScanDeliveryId(7, 80, firstFp),
        releaseScanDeliveryId(7, 80, secondFp),
      ]);
      const payloads = JSON.stringify(rows.map((row) => row.payload));
      expect(payloads).not.toMatch(/browser_download_url|releases\/assets|ghs_secret|token=/i);
      expect(payloads).not.toContain('"assets"');
    });
  });

  it("does not rescan an edited release that only changes Electron installers", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const installer = {
        id: 1,
        name: "Hearback-0.1.7-arm64-mac.zip",
        size: 138007237,
      };
      const published = await postWebhook(app, "release", "d-rel-electron-pub", {
        action: "published",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 83, tag_name: "v0.1.7", name: "v0.1.7", assets: [installer] },
      });
      const edited = await postWebhook(app, "release", "d-rel-electron-edit", {
        action: "edited",
        installation: { id: 7 },
        repository: sampleRepo,
        release: {
          id: 83,
          tag_name: "v0.1.7",
          name: "v0.1.7",
          assets: [
            installer,
            { id: 2, name: "Hearback-0.1.7-x86_64.AppImage", size: 137102339 },
          ],
        },
      });
      expect(published.status).toBe(200);
      expect(((await published.json()) as { queued: boolean }).queued).toBe(true);
      expect(edited.status).toBe(200);
      expect(((await edited.json()) as { queued: boolean }).queued).toBe(false);
      const { rows } = await store.sql.query<{ delivery_id: string }>(
        "SELECT delivery_id FROM jobs ORDER BY id",
      );
      expect(rows).toEqual([{ delivery_id: releaseScanDeliveryId(7, 83, "empty") }]);
      const { rows: priorities } = await store.sql.query<{ priority: string }>(
        "SELECT priority FROM jobs",
      );
      expect(priorities).toEqual([{ priority: "light" }]);
      expect(await heavyUsage(store)).toBe(0);
    });
  });

  it("does not scan an edited release that still has no pack", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      const created = await postWebhook(app, "release", "d-rel-created", {
        action: "created",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 81, tag_name: "v1.2.1", name: "v1.2.1", assets: [] },
      });
      const edited = await postWebhook(app, "release", "d-rel-edited-empty", {
        action: "edited",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 81, tag_name: "v1.2.1", name: "v1.2.1", assets: [{ name: "notes.txt", size: 4 }] },
      });
      expect(created.status).toBe(200);
      expect(edited.status).toBe(200);
      const { rows } = await store.sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);
    });
  });

  it("queues a second scan when assets appear after publish", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "release", "d-rel-empty-pub", {
        action: "published",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 82, tag_name: "v1.2.2", name: "v1.2.2" },
      });
      const edited = await postWebhook(app, "release", "d-rel-later-asset", {
        action: "edited",
        installation: { id: 7 },
        repository: sampleRepo,
        release: {
          id: 82,
          tag_name: "v1.2.2",
          name: "v1.2.2",
          assets: [{ id: 910, name: "app.zip", size: 40 }],
        },
      });
      expect(((await edited.json()) as { queued: boolean; kind: string }).kind).toBe("release_scan");
      const { rows } = await store.sql.query<{ delivery_id: string }>(
        "SELECT delivery_id FROM jobs ORDER BY id",
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]?.delivery_id).toBe(releaseScanDeliveryId(7, 82, "empty"));
      expect(rows[1]?.delivery_id).toBe(
        releaseScanDeliveryId(7, 82, packAssetFingerprint([{ id: 910, name: "app.zip", size: 40 }])),
      );
      const { rows: priorities } = await store.sql.query<{ priority: string }>(
        "SELECT priority FROM jobs ORDER BY id",
      );
      expect(priorities.map((row) => row.priority)).toEqual(["light", "heavy"]);
    });
  });

  it("alerts when a release is unpublished or deleted without downloading", async () => {
    await withStore(async ({ store }) => {
      let downloads = 0;
      const github = mockGithub({
        listReleaseAssets: async () => {
          throw new Error("unpublished/deleted jobs must not list assets");
        },
        downloadAsset: async () => {
          downloads += 1;
          throw new Error("unpublished/deleted jobs must not download");
        },
      });
      const { app } = appFor(store, github);
      const unpublished = await postWebhook(app, "release", "d-rel-unpub", {
        action: "unpublished",
        installation: { id: 7 },
        repository: sampleRepo,
        release: {
          id: 83,
          tag_name: "v1.3.0",
          name: "v1.3.0",
          assets: [
            {
              name: "app.tgz",
              url: "https://api.github.com/repos/octo/throwaway/releases/assets/1",
            },
          ],
        },
      });
      const deleted = await postWebhook(app, "release", "d-rel-del", {
        action: "deleted",
        installation: { id: 7 },
        repository: sampleRepo,
        release: { id: 84, tag_name: "v1.3.1", name: "v1.3.1" },
      });
      expect(unpublished.status).toBe(200);
      expect(deleted.status).toBe(200);
      const { rows: jobs } = await store.sql.query<{
        kind: string;
        priority: string;
        payload: unknown;
      }>("SELECT kind, priority, payload FROM jobs ORDER BY id");
      expect(jobs).toEqual([
        { kind: "release_unpublished", priority: "light", payload: expect.any(Object) },
        { kind: "release_deleted", priority: "light", payload: expect.any(Object) },
      ]);
      expect(JSON.stringify(jobs.map((row) => row.payload))).not.toMatch(
        /browser_download_url|releases\/assets|ghs_secret|token=/i,
      );

      const worker = createWorker({
        store,
        github,
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 4,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
      });
      await worker.tick();
      const started = Date.now();
      while (Date.now() - started < 4000) {
        const { rows } = await store.sql.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM alerts WHERE kind IN ('release_unpublished', 'release_deleted')",
        );
        if (Number(rows[0]?.n) === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await worker.stop();
      const { rows: alerts } = await store.sql.query<{ kind: string; title: string; body: string }>(
        "SELECT kind, title, body FROM alerts ORDER BY id",
      );
      expect(alerts.map((row) => row.kind)).toEqual(["release_unpublished", "release_deleted"]);
      expect(alerts[0]?.title).toContain("unpublished");
      expect(alerts[1]?.title).toContain("deleted");
      expect(alerts.every((row) => !/github\.com|token=/i.test(`${row.title} ${row.body}`))).toBe(true);
      expect(downloads).toBe(0);
    });
  });
});

describe("scan latest release", () => {
  const FIXTURE = path.resolve("fixtures/sourcemap.tgz");
  const RECEIPT_SECRET = "receipt-test-secret";

  async function seedWatch(store: Store): Promise<string> {
    await store.upsertUser({ id: "u1", login: "octo" });
    await store.upsertInstallation({
      id: 7,
      accountLogin: "octo",
      accountType: "User",
      accountId: 1,
    });
    await store.linkUserInstallation(7, "u1");
    await store.upsertRepo({
      id: 99,
      installationId: 7,
      owner: "octo",
      name: "throwaway",
      fullName: "octo/throwaway",
      private: false,
      htmlUrl: "https://github.com/octo/throwaway",
    });
    return `ns_session=${signSession("sess", await store.createSession("u1"))}`;
  }

  async function waitFor(store: Store, sql: string, n: number, label: string): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < 4000) {
      const { rows } = await store.sql.query<{ n: string }>(sql);
      if (Number(rows[0]?.n) >= n) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`timed out waiting for ${label}`);
  }

  it("refuses anonymous, unknown, and stolen repository scans", async () => {
    await withStore(async ({ store }) => {
      const cookie = await seedWatch(store);
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(9, "u2");
      const stolen = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const { app } = appFor(store);
      expect((await app.request("/api/repos/99/scan-latest-release", { method: "POST" })).status).toBe(
        401,
      );
      expect(
        (await app.request("/api/repos/404/scan-latest-release", { method: "POST", headers: { cookie } }))
          .status,
      ).toBe(404);
      expect(
        (await app.request("/api/repos/99/scan-latest-release", { method: "POST", headers: { cookie: stolen } }))
          .status,
      ).toBe(403);
    });
  });

  it("queues a heavy job and wakes the worker without downloading yet", async () => {
    await withStore(async ({ store }) => {
      const cookie = await seedWatch(store);
      let wakes = 0;
      const { app } = appFor(store, mockGithub(), () => {
        wakes += 1;
      });
      const res = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; queued: boolean };
      expect(body.ok).toBe(true);
      expect(body.queued).toBe(true);
      expect(wakes).toBe(1);
      const { rows } = await store.sql.query<{ kind: string; priority: string; status: string }>(
        "SELECT kind, priority, status FROM jobs",
      );
      expect(rows).toEqual([{ kind: "scan_latest_release", priority: "heavy", status: "queued" }]);
    });
  });

  it("alerts when the latest GitHub Release does not exist, without downloading", async () => {
    await withStore(async ({ store }) => {
      await seedWatch(store);
      let downloads = 0;
      await store.enqueueJob({
        priority: "heavy",
        kind: "scan_latest_release",
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
        github: mockGithub({
          getLatestRelease: async () => null,
          downloadAsset: async () => {
            downloads += 1;
            throw new Error("no-release jobs must not download");
          },
        }),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 10_000,
      });
      await worker.tick();
      await waitFor(store, "SELECT count(*)::text AS n FROM alerts", 1, "no-release alert");
      await worker.stop();
      const { rows } = await store.sql.query<{ kind: string; title: string }>(
        "SELECT kind, title FROM alerts",
      );
      expect(rows[0]?.kind).toBe("scan_latest_release");
      expect(rows[0]?.title).toMatch(/No release on octo\/throwaway/);
      expect(rows[0]?.title).not.toMatch(/allowed to ship/);
      expect(downloads).toBe(0);
      expect(await heavyUsage(store)).toBe(0);
    });
  });

  it("alerts when the latest Release has no packed asset, without downloading", async () => {
    await withStore(async ({ store }) => {
      await seedWatch(store);
      let downloads = 0;
      await store.enqueueJob({
        priority: "heavy",
        kind: "scan_latest_release",
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
        github: mockGithub({
          getLatestRelease: async () => ({
            id: 55,
            tag_name: "v1.0.0",
            name: "v1.0.0",
            target_commitish: "main",
          }),
          listReleaseAssets: async () => [
            { id: 1, name: "notes.txt", size: 12, url: "https://api.github.com/asset/1" },
          ],
          downloadAsset: async () => {
            downloads += 1;
            throw new Error("non-pack assets must not download");
          },
        }),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 10_000,
      });
      await worker.tick();
      await waitFor(store, "SELECT count(*)::text AS n FROM alerts", 1, "no-pack alert");
      await worker.stop();
      const { rows } = await store.sql.query<{ kind: string; title: string; body: string }>(
        "SELECT kind, title, body FROM alerts",
      );
      expect(rows[0]?.kind).toBe("release_scan");
      expect(rows[0]?.title).toMatch(/no pack we can scan/i);
      expect(rows[0]?.body).toMatch(/Source trees are not scanned on push/);
      expect(downloads).toBe(0);
      expect(await heavyUsage(store)).toBe(0);
    });
  });

  it("alerts when the latest Release is only Electron installers, without downloading", async () => {
    await withStore(async ({ store }) => {
      await seedWatch(store);
      let downloads = 0;
      await store.enqueueJob({
        priority: "heavy",
        kind: "scan_latest_release",
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
        github: mockGithub({
          getLatestRelease: async () => ({
            id: 55,
            tag_name: "v0.1.7",
            name: "v0.1.7",
            target_commitish: "main",
          }),
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "Hearback-0.1.7-arm64-mac.zip",
              size: 138007237,
              url: "https://api.github.com/asset/1",
            },
            {
              id: 2,
              name: "Hearback-0.1.7-x64-mac.zip",
              size: 141717155,
              url: "https://api.github.com/asset/2",
            },
            {
              id: 3,
              name: "Hearback-0.1.7-x86_64.AppImage",
              size: 137102339,
              url: "https://api.github.com/asset/3",
            },
          ],
          downloadAsset: async () => {
            downloads += 1;
            throw new Error("Electron installer assets must not download");
          },
        }),
        notifier: createLogNotifier(store),
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 10_000,
      });
      await worker.tick();
      await waitFor(store, "SELECT count(*)::text AS n FROM alerts", 1, "electron skip alert");
      await worker.stop();
      const { rows } = await store.sql.query<{ kind: string; title: string; body: string }>(
        "SELECT kind, title, body FROM alerts",
      );
      expect(rows[0]?.kind).toBe("release_scan");
      expect(rows[0]?.title).toMatch(/Electron installer assets we do not scan/i);
      expect(rows[0]?.title).not.toMatch(/Inconclusive scan/i);
      expect(rows[0]?.title).not.toMatch(/allowed to ship/i);
      expect(rows[0]?.body).toMatch(/Hearback-0\.1\.7-arm64-mac\.zip/);
      expect(rows[0]?.body).toMatch(/Hearback-0\.1\.7-x86_64\.AppImage/);
      expect(rows[0]?.body).toMatch(/isolated installer worker/i);
      expect(downloads).toBe(0);
      const { rows: receipts } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM scan_receipts",
      );
      expect(Number(receipts[0]?.n)).toBe(0);
      expect(await heavyUsage(store)).toBe(0);
    });
  });

  it("scans a packed asset and skips Electron installers on the same Release", async () => {
    await withStore(async ({ store }) => {
      await seedWatch(store);
      const bytes = await readFile(FIXTURE);
      const downloaded: string[] = [];
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 55,
          tag: "v0.1.7",
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
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/tgz",
            },
            {
              id: 2,
              name: "Hearback-0.1.7-arm64-mac.zip",
              size: 138007237,
              url: "https://api.github.com/asset/mac",
            },
          ],
          downloadAsset: async (_installationId, url) => {
            downloaded.push(url);
            if (url.includes("mac")) throw new Error("Electron installer assets must not download");
            return bytes;
          },
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 10_000,
        receiptSecret: RECEIPT_SECRET,
      });
      await worker.tick();
      await waitFor(
        store,
        "SELECT count(*)::text AS n FROM scan_receipts WHERE status = 'failed-policy'",
        1,
        "packed receipt",
      );
      await worker.stop();
      expect(downloaded).toEqual(["https://api.github.com/asset/tgz"]);
      const { rows: alerts } = await store.sql.query<{ title: string; body: string }>(
        "SELECT title, body FROM alerts",
      );
      expect(alerts[0]?.title).toMatch(/Spoilers in octo\/throwaway v0\.1\.7/);
      expect(alerts[0]?.body).toMatch(/Hearback-0\.1\.7-arm64-mac\.zip/);
      expect(alerts[0]?.body).toMatch(/isolated worker/);
      const { rows: receipts } = await store.sql.query<{ coordinate: string }>(
        "SELECT coordinate FROM scan_receipts",
      );
      expect(receipts).toHaveLength(1);
      expect(receipts[0]?.coordinate).toMatch(/sourcemap\.tgz/);
      expect(await heavyUsage(store)).toBe(1);
    });
  });

  it("scans the latest packed Release asset and does not call it clean", async () => {
    await withStore(async ({ store }) => {
      await seedWatch(store);
      const bytes = await readFile(FIXTURE);
      let downloads = 0;
      await store.enqueueJob({
        priority: "heavy",
        kind: "scan_latest_release",
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
        github: mockGithub({
          getLatestRelease: async () => ({
            id: 55,
            tag_name: "phase1-fixture",
            name: "phase1-fixture",
            target_commitish: "main",
          }),
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/1",
            },
          ],
          downloadAsset: async () => {
            downloads += 1;
            return bytes;
          },
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 10_000,
        receiptSecret: RECEIPT_SECRET,
      });
      await worker.tick();
      await waitFor(
        store,
        "SELECT count(*)::text AS n FROM scan_receipts WHERE status = 'failed-policy'",
        1,
        "failed-policy receipt",
      );
      await worker.stop();
      const { rows: jobs } = await store.sql.query<{ kind: string; status: string }>(
        "SELECT kind, status FROM jobs",
      );
      expect(jobs).toEqual([{ kind: "scan_latest_release", status: "done" }]);
      const { rows: alerts } = await store.sql.query<{ kind: string; title: string }>(
        "SELECT kind, title FROM alerts",
      );
      expect(alerts[0]?.kind).toBe("release_scan");
      expect(alerts[0]?.title).toMatch(/Spoilers in octo\/throwaway phase1-fixture/);
      expect(alerts[0]?.title).not.toMatch(/allowed to ship/);
      expect(downloads).toBe(1);
      const { rows: receipts } = await store.sql.query<{ status: string; coordinate: string }>(
        "SELECT status, coordinate FROM scan_receipts",
      );
      expect(receipts[0]?.status).toBe("failed-policy");
      expect(receipts[0]?.coordinate).toMatch(/sourcemap\.tgz/);
      const { rows: locations } = await store.sql.query<{ url: string; created_by_login: string }>(
        "SELECT url, created_by_login FROM release_delivery_locations",
      );
      expect(locations).toEqual([
        {
          url: "https://github.com/octo/throwaway/releases/download/phase1-fixture/sourcemap.tgz",
          created_by_login: "nospoilers",
        },
      ]);
      const { rows: verifyJobs } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM jobs WHERE kind = 'delivery_verify'",
      );
      expect(Number(verifyJobs[0]?.n)).toBe(0);
    });
  });

  it("says Scan latest release unpacks the Release pack, not git, and is not the hourly poller", () => {
    const page = readFileSync(path.resolve("src/components/watch/screens/SourcesScreen.tsx"), "utf8");
    expect(page).toMatch(/Scan latest release/);
    expect(page).toMatch(/current Release pack, not the git tree/);
    expect(page).toMatch(/hourly poller does\s+not download every latest release/);
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

  it("deletes only the current session on logout", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "4242", login: "octo", accessToken: "ghu_keep" });
      const leaving = await store.createSession("4242");
      const staying = await store.createSession("4242");
      const { app } = appFor(store);
      const res = await app.request("/api/auth/logout", {
        method: "POST",
        headers: { cookie: `ns_session=${signSession("sess", leaving)}` },
      });
      expect(res.status).toBe(200);
      expect(await store.getSession(leaving)).toBeNull();
      expect(await store.getSession(staying)).not.toBeNull();
      expect(await store.getUserAccessToken("4242")).toBe("ghu_keep");
      const me = await app.request("/api/me", {
        headers: { cookie: `ns_session=${signSession("sess", leaving)}` },
      });
      expect(((await me.json()) as { user: unknown }).user).toBeNull();
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

  it("caps heavy unpacks per Solo install and lets another tenant run", async () => {
    await withStore(async ({ store, sql }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "solo-co",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "team-co",
        accountType: "Organization",
        accountId: 2,
      });
      await sql.query(
        `UPDATE billing_accounts SET plan = 'solo', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`,
      );
      await sql.query(
        `UPDATE billing_accounts SET plan = 'team', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 8`,
      );
      for (let i = 0; i < 4; i += 1) {
        await store.enqueueJob({
          priority: "heavy",
          kind: "release_scan",
          payload: { installationId: 7, i },
        });
      }
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 8, i: 0 },
      });
      let maxSolo = 0;
      let maxTeam = 0;
      const started: number[] = [];
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 8,
        lightConcurrency: 2,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        onJob: async (job) => {
          const install = Number((job.payload as { installationId?: number }).installationId);
          started.push(install);
          const { rows } = await sql.query<{ installation_id: string; n: unknown }>(
            `SELECT installation_id::text, count(*)::int AS n
             FROM jobs
             WHERE status = 'running' AND priority = 'heavy'
             GROUP BY installation_id`,
          );
          for (const row of rows) {
            const n = Number(row.n);
            if (row.installation_id === "7") maxSolo = Math.max(maxSolo, n);
            if (row.installation_id === "8") maxTeam = Math.max(maxTeam, n);
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(maxSolo).toBe(SOLO_HEAVY_FAIR_USE);
      expect(started).toContain(8);
      expect(maxTeam).toBeGreaterThan(0);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await worker.stop();
      expect(maxSolo).toBe(SOLO_HEAVY_FAIR_USE);
    });
  });

  it("gives Team a higher concurrent unpack cap than Solo", async () => {
    await withStore(async ({ store, sql }) => {
      await store.upsertInstallation({
        id: 9,
        accountLogin: "team-co",
        accountType: "Organization",
        accountId: 9,
      });
      await sql.query(
        `UPDATE billing_accounts SET plan = 'team' WHERE installation_id = 9`,
      );
      for (let i = 0; i < 6; i += 1) {
        await store.enqueueJob({
          priority: "heavy",
          kind: "release_scan",
          payload: { installationId: 9, i },
        });
      }
      let maxTeam = 0;
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 8,
        lightConcurrency: 2,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        onJob: async () => {
          const { rows } = await sql.query<{ n: unknown }>(
            `SELECT count(*)::int AS n FROM jobs WHERE status = 'running' AND priority = 'heavy' AND installation_id = 9`,
          );
          maxTeam = Math.max(maxTeam, Number(rows[0]?.n ?? 0));
          await new Promise((resolve) => setTimeout(resolve, 40));
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(maxTeam).toBe(TEAM_HEAVY_FAIR_USE);
      expect(maxTeam).toBeGreaterThan(SOLO_HEAVY_FAIR_USE);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await worker.stop();
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

describe("installation lifecycle", () => {
  it("deletes an uninstalled GitHub App so no billing or repos remain", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "installation", "d-install", {
        action: "created",
        installation: {
          id: 7,
          account: { login: "octo", type: "User", id: 1 },
        },
        repositories: [{ id: 99, full_name: "octo/throwaway", private: true }],
      });
      const removed = await postWebhook(app, "installation", "d-uninstall", {
        action: "deleted",
        installation: {
          id: 7,
          account: { login: "octo", type: "User", id: 1 },
        },
      });
      expect(removed.status).toBe(200);
      const { rows: installs } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM installations",
      );
      const { rows: billing } = await store.sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM billing_accounts",
      );
      expect(Number(installs[0]?.n)).toBe(0);
      expect(Number(billing[0]?.n)).toBe(0);
    });
  });

  it("stops hosted work after the App is suspended", async () => {
    await withStore(async ({ store }) => {
      const { app } = appFor(store);
      await postWebhook(app, "installation", "d-up", {
        action: "created",
        installation: {
          id: 7,
          account: { login: "octo", type: "User", id: 1 },
        },
      });
      const suspended = await postWebhook(app, "installation", "d-suspend", {
        action: "suspend",
        installation: {
          id: 7,
          account: { login: "octo", type: "User", id: 1 },
          suspended: true,
        },
      });
      expect(suspended.status).toBe(200);
      expect(await store.installationWorkAllowed(7)).toBe(false);
      const publicized = await postWebhook(app, "repository", "d-pub-suspended", {
        action: "publicized",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: { ...sampleRepo, private: false },
      });
      const body = (await publicized.json()) as { queued: boolean; skipped?: string };
      expect(publicized.status).toBe(200);
      expect(body.queued).toBe(false);
      expect(body.skipped).toBe("uncovered");
    });
  });
});

describe("job retry and stale locks", () => {
  it("requeues a failed job until the attempt cap, then marks it failed", async () => {
    await withStore(
      async ({ store }) => {
        await store.enqueueJob({ priority: "light", kind: "fork", payload: { n: 1 } });
        let throws = 0;
        const worker = createWorker({
          store,
          github: mockGithub(),
          notifier: createLogNotifier(store),
          heavyConcurrency: 1,
          lightConcurrency: 1,
          maxAssetBytes: 1000,
          intervalMs: 10_000,
          onJob: async () => {
            throws += 1;
            throw new Error("boom");
          },
        });
        await worker.tick();
        await new Promise((resolve) => setTimeout(resolve, 40));
        await worker.tick();
        await new Promise((resolve) => setTimeout(resolve, 40));
        await worker.stop();
        const { rows } = await store.sql.query<{ status: string; attempts: string }>(
          "SELECT status, attempts::text FROM jobs",
        );
        expect(throws).toBe(2);
        expect(rows[0]?.status).toBe("failed");
        expect(Number(rows[0]?.attempts)).toBe(2);
      },
      { jobMaxAttempts: 2, jobRetryBaseMs: 0 },
    );
  });

  it("recovers a crashed running job on the next tick", async () => {
    await withStore(async ({ store }) => {
      const inserted = await store.enqueueJob({
        priority: "light",
        kind: "fork",
        payload: { n: 1 },
      });
      await store.sql.query(
        `UPDATE jobs SET status = 'running', locked_at = now() - interval '10 minutes', locked_by = 'dead' WHERE id = $1`,
        [inserted.id],
      );
      const kinds: string[] = [];
      const worker = createWorker({
        store,
        github: mockGithub(),
        notifier: createLogNotifier(store),
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 1000,
        intervalMs: 10_000,
        staleAfterMs: 1_000,
        onJob: async (job) => {
          kinds.push(job.kind);
        },
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 40));
      await worker.stop();
      expect(kinds).toEqual(["fork"]);
      const { rows } = await store.sql.query<{ status: string }>("SELECT status FROM jobs");
      expect(rows[0]?.status).toBe("done");
    });
  });
});
