import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { githubSignature } from "../src/server/hmac.ts";
import { migrate, openSql, type SqlClient } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";
import {
  FAIR_USE_ALERT_KIND,
  FAIR_USE_EXHAUSTED,
  SOLO_HEAVY_PER_UTC_DAY,
  TEAM_HEAVY_PER_UTC_DAY,
  fairUseDeliveryId,
  heavyUsageCap,
  secondsUntilUtcMidnight,
  usageIsExhausted,
  usageIsWarning,
} from "../src/server/usage.ts";

const SECRET = "test-webhook-secret";
const CLEAN = path.resolve("fixtures/clean.tgz");

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

async function withStore(run: (ctx: { sql: SqlClient; store: Store }) => Promise<void>): Promise<void> {
  const sql = await openSql("pglite://:memory:");
  try {
    await migrate(sql);
    await run({ sql, store: createStore(sql) });
  } finally {
    await sql.close();
  }
}

function appFor(store: Store) {
  return createApp({
    config: loadConfig({
      databaseUrl: "pglite://:memory:",
      githubWebhookSecret: SECRET,
      githubAppId: "1",
      githubPrivateKey: "x",
      githubClientId: "c",
      githubClientSecret: "s",
      sessionSecret: "sess",
      adminGithubLogin: "EmotiveImpact",
    }),
    store,
    github: unusedGithub(),
  });
}

async function postWebhook(
  app: ReturnType<typeof createApp>,
  event: string,
  deliveryId: string,
  payload: unknown,
) {
  const body = JSON.stringify(payload);
  return await app.request("/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": githubSignature(SECRET, body),
    },
    body,
  });
}

async function seedSoloInstall(
  store: Store,
  sql: SqlClient,
  input: { id: number; login: string; userId: string; accountId: number },
): Promise<void> {
  await store.upsertUser({ id: input.userId, login: input.login });
  await store.upsertInstallation({
    id: input.id,
    accountLogin: input.login,
    accountType: "User",
    accountId: input.accountId,
  });
  await store.linkUserInstallation(input.id, input.userId);
  await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = $1`, [input.id]);
}

async function fillHeavyJobs(store: Store, installationId: number, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const result = await store.enqueueJob({
      deliveryId: `heavy:${installationId}:${crypto.randomUUID()}`,
      priority: "heavy",
      kind: "release_scan",
      payload: { installationId, release: i },
    });
    expect(result.inserted).toBe(true);
    expect(result.skipped).toBeUndefined();
  }
}

describe("daily hosted unpack cap", () => {
  it("gives Team and trial more unpacks per UTC day than Solo, never a credit count", () => {
    expect(SOLO_HEAVY_PER_UTC_DAY).toBe(8);
    expect(TEAM_HEAVY_PER_UTC_DAY).toBeGreaterThan(SOLO_HEAVY_PER_UTC_DAY);
    expect(heavyUsageCap("solo", null)).toBe(SOLO_HEAVY_PER_UTC_DAY);
    expect(heavyUsageCap("team", null)).toBe(TEAM_HEAVY_PER_UTC_DAY);
    expect(heavyUsageCap("trial", new Date(Date.now() + 86_400_000).toISOString())).toBe(
      TEAM_HEAVY_PER_UTC_DAY,
    );
    expect(heavyUsageCap(null, "2000-01-01T00:00:00Z")).toBe(SOLO_HEAVY_PER_UTC_DAY);
    expect(usageIsWarning(6, 8)).toBe(false);
    expect(usageIsWarning(7, 8)).toBe(true);
    expect(usageIsWarning(8, 8)).toBe(false);
    expect(usageIsExhausted(7, 8)).toBe(false);
    expect(usageIsExhausted(8, 8)).toBe(true);
    expect(secondsUntilUtcMidnight()).toBeGreaterThan(0);
    expect(fairUseDeliveryId(7)).toMatch(/^fair-use:7:\d{4}-\d{2}-\d{2}$/);
  });

  it("applies migration 025_hosted_usage", async () => {
    await withStore(async ({ sql }) => {
      const { rows } = await sql.query<{ id: string }>(
        `SELECT id FROM schema_migrations WHERE id = '025_hosted_usage'`,
      );
      expect(rows.map((row) => row.id)).toEqual(["025_hosted_usage"]);
    });
  });

  it("stops the ninth Solo heavy job, keeps webhooks at 200, and writes one Watch alert per UTC day", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      await fillHeavyJobs(store, 7, SOLO_HEAVY_PER_UTC_DAY);
      const app = appFor(store);
      const ninth = await postWebhook(app, "release", "d-ninth", {
        action: "published",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: {
          id: 99,
          name: "throwaway",
          full_name: "octo/throwaway",
          private: false,
          html_url: "https://github.com/octo/throwaway",
          owner: { login: "octo" },
        },
        release: { id: 55, tag_name: "v1.0.0", name: "v1.0.0" },
      });
      expect(ninth.status).toBe(200);
      const ninthBody = (await ninth.json()) as {
        ok: boolean;
        queued: boolean;
        kind: string;
        skipped?: string;
      };
      expect(ninthBody).toEqual({
        ok: true,
        queued: false,
        kind: "release_scan",
        skipped: "fair_use",
      });
      const tenth = await postWebhook(app, "release", "d-tenth", {
        action: "published",
        installation: { id: 7, account: { login: "octo", type: "User", id: 1 } },
        repository: {
          id: 99,
          name: "throwaway",
          full_name: "octo/throwaway",
          private: false,
          html_url: "https://github.com/octo/throwaway",
          owner: { login: "octo" },
        },
        release: { id: 56, tag_name: "v1.0.1", name: "v1.0.1" },
      });
      expect(tenth.status).toBe(200);
      expect(((await tenth.json()) as { skipped?: string }).skipped).toBe("fair_use");

      const { rows: jobs } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM jobs WHERE kind = 'release_scan'`,
      );
      expect(Number(jobs[0]?.n)).toBe(SOLO_HEAVY_PER_UTC_DAY);

      const { rows: alerts } = await sql.query<{ kind: string; github_delivery_id: string | null }>(
        `SELECT kind, github_delivery_id FROM alerts WHERE kind = $1`,
        [FAIR_USE_ALERT_KIND],
      );
      expect(alerts).toEqual([
        { kind: FAIR_USE_ALERT_KIND, github_delivery_id: fairUseDeliveryId(7) },
      ]);

      const light = await store.enqueueJob({
        deliveryId: "light-after-cap",
        priority: "light",
        kind: "fork",
        payload: { installationId: 7 },
      });
      expect(light.inserted).toBe(true);

      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 9`);
      const other = await store.enqueueJob({
        deliveryId: "other-heavy",
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 9 },
      });
      expect(other.inserted).toBe(true);
    });
  });

  it("does not count light jobs, prospect scans, or duplicate deliveries toward the cap", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      const first = await store.enqueueJob({
        deliveryId: "same-delivery",
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 7 },
      });
      const duplicate = await store.enqueueJob({
        deliveryId: "same-delivery",
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 7 },
      });
      expect(first.inserted).toBe(true);
      expect(duplicate.inserted).toBe(false);
      expect(duplicate.skipped).toBeUndefined();
      await store.enqueueJob({
        priority: "light",
        kind: "fork",
        payload: { installationId: 7 },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 1, artifactUrl: "https://github.com/acme/app/releases/download/x/a.tgz" },
      });
      const { rows } = await sql.query<{ heavy_jobs: unknown }>(
        `SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id = 7`,
      );
      expect(Number(rows[0]?.heavy_jobs)).toBe(1);
      const status = await store.hostedUsageStatus(7);
      expect(status.warning).toBe(false);
      expect(status.exhausted).toBe(false);
    });
  });

  it("warns at 80% and refunds a consumed slot so work can resume", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      await fillHeavyJobs(store, 7, 7);
      expect(await store.hostedUsageStatus(7)).toMatchObject({ warning: true, exhausted: false });
      await fillHeavyJobs(store, 7, 1);
      expect(await store.hostedUsageStatus(7)).toMatchObject({ warning: false, exhausted: true });
      expect(await store.consumeHostedUnpack(7)).toBe(false);
      await store.refundHostedUnpack(7);
      expect(await store.consumeHostedUnpack(7)).toBe(true);
      expect(await store.hostedUsageStatus(7)).toMatchObject({ exhausted: true });
    });
  });

  it("lets Team enqueue more than the Solo daily cap", async () => {
    await withStore(async ({ sql, store }) => {
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await sql.query(`UPDATE billing_accounts SET plan = 'team' WHERE installation_id = 7`);
      await fillHeavyJobs(store, 7, SOLO_HEAVY_PER_UTC_DAY + 1);
      const status = await store.hostedUsageStatus(7);
      expect(status.exhausted).toBe(false);
      expect(status.warning).toBe(false);
    });
  });

  it("returns 429 with Retry-After on Scan latest, and still 402 when unpaid", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      await fillHeavyJobs(store, 7, SOLO_HEAVY_PER_UTC_DAY);
      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const paused = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(paused.status).toBe(429);
      expect(paused.headers.get("retry-after")).toMatch(/^\d+$/);
      expect(Number(paused.headers.get("retry-after"))).toBeGreaterThan(0);
      const pausedBody = (await paused.json()) as { error: string };
      expect(pausedBody.error).toBe(FAIR_USE_EXHAUSTED);
      expect(JSON.stringify(pausedBody)).not.toMatch(/\bremaining\b/i);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaid.status).toBe(402);
    });
  });

  it("exposes warning/exhausted/resetsAt on /api/jobs without a remaining balance", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      await fillHeavyJobs(store, 7, 7);
      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const warning = await app.request("/api/jobs", { headers: { cookie } });
      expect(warning.status).toBe(200);
      const warningBody = (await warning.json()) as {
        summary: Record<string, unknown>;
        fairUse: { warning: boolean; exhausted: boolean; resetsAt: string };
      };
      expect(Object.keys(warningBody.summary).sort()).toEqual(["done", "failed", "queued", "running"]);
      expect(warningBody.fairUse.warning).toBe(true);
      expect(warningBody.fairUse.exhausted).toBe(false);
      expect(warningBody.fairUse.resetsAt).toMatch(/T/);
      expect(Object.keys(warningBody.fairUse).sort()).toEqual(["exhausted", "resetsAt", "warning"]);
      expect(JSON.stringify(warningBody)).not.toMatch(/credit/i);
      expect(JSON.stringify(warningBody)).not.toMatch(/\bremaining\b/i);
      expect(warningBody).not.toHaveProperty("credit");

      await fillHeavyJobs(store, 7, 1);
      const exhausted = await app.request("/api/jobs", { headers: { cookie } });
      const exhaustedBody = (await exhausted.json()) as {
        fairUse: { warning: boolean; exhausted: boolean };
      };
      expect(exhaustedBody.fairUse.exhausted).toBe(true);
      expect(exhaustedBody.fairUse.warning).toBe(false);
    });
  });

  it("shows owner usage counts without tenant names, and 429s hosted v1 scans at the cap", async () => {
    await withStore(async ({ sql, store }) => {
      await seedSoloInstall(store, sql, { id: 7, login: "octo", userId: "u1", accountId: 1 });
      await seedSoloInstall(store, sql, { id: 9, login: "other", userId: "u2", accountId: 2 });
      await fillHeavyJobs(store, 7, SOLO_HEAVY_PER_UTC_DAY);
      await fillHeavyJobs(store, 9, 7);
      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const app = appFor(store);
      const owner = `ns_session=${signSession("sess", await store.createSession("owner-1"))}`;
      const queue = await app.request("/api/internal/queue", { headers: { cookie: owner } });
      expect(queue.status).toBe(200);
      const body = (await queue.json()) as {
        usage: { customerHeavyToday: number; installsWarning: number; installsExhausted: number };
      };
      expect(body.usage).toEqual({
        customerHeavyToday: SOLO_HEAVY_PER_UTC_DAY + 7,
        installsWarning: 1,
        installsExhausted: 1,
      });
      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/octo|other|EmotiveImpact|throwaway|github\.com/i);
      expect(raw).not.toMatch(/credit/i);
      expect(body).not.toHaveProperty("jobs");

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "ci", installationId: 7 }),
      });
      expect(minted.status).toBe(201);
      const mintedBody = (await minted.json()) as { token: string };
      const scan = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "clean.tgz",
        },
        body: await readFile(CLEAN),
      });
      expect(scan.status).toBe(429);
      expect(((await scan.json()) as { error: string }).error).toBe(FAIR_USE_EXHAUSTED);
    });
  });
});
