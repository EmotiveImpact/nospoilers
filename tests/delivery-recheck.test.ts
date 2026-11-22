import { readFile } from "node:fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { createApp } from "./helpers/completed-scan-app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  DELIVERY_RECHECK_WINDOW_DAYS,
  artifactLine,
  runDeliveryRecheckPoll,
  runDeliveryVerifyJob,
} from "../src/server/delivery-verify.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const DIRTY = path.resolve("fixtures/sourcemap.tgz");
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

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

function bytesFetch(body: Buffer, status = 200) {
  return (async () =>
    new Response(status === 200 ? body : null, {
      status,
      headers: { "content-type": "application/gzip" },
    })) as unknown as typeof fetch;
}

async function setup() {
  const sql = await openSql("pglite://:memory:");
  await migrate(sql);
  const store = createStore(sql, { tokenSecret: "sess" });
  await store.upsertUser({ id: "u1", login: "octo" });
  await store.upsertInstallation({ id: 7, accountLogin: "octo", accountType: "User", accountId: 1 });
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
      receiptSecret: "receipt-test-secret",
    }),
    store,
    github: unusedGithub(),
    webhookLookup: publicLookup,
  });
  const minted = await app.request("/api/scan-tokens", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "CI", installationId: 7 }),
  });
  const token = ((await minted.json()) as { token: string }).token;
  const seal = async (bytes: Buffer) => {
    const scanned = await app.request("/api/v1/scan", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "x-filename": "app.tgz" },
      body: bytes,
    });
    return ((await scanned.json()) as { release: { id: number } }).release.id;
  };
  const attach = async (releaseId: number, url: string) => {
    const attached = await app.request(`/api/releases/${releaseId}/locations`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ url, installationId: 7 }),
    });
    return ((await attached.json()) as { location: { id: number } }).location.id;
  };
  return { sql, store, seal, attach, app, cookie };
}

describe("artifact line", () => {
  it("joins versions of one package or one named asset, and nothing else", () => {
    expect(artifactLine("npm:@acme/cli@2.4.1")).toBe(artifactLine("npm:@acme/cli@2.4.2"));
    expect(artifactLine("github:acme/cli@v1#cli.tgz")).toBe(artifactLine("github:acme/cli@v2#cli.tgz"));
    expect(artifactLine("github:acme/cli@v1#cli.tgz")).not.toBe(artifactLine("github:acme/cli@v2#docs.zip"));
    expect(artifactLine("npm:acme-cli@1.0.0")).not.toBe(artifactLine("npm:acme-cli-extra@1.0.0"));
  });
});

describe("hourly delivery recheck", () => {
  it("queues one check per attached URL per hour, only for recent releases", async () => {
    const { sql, store, seal, attach } = await setup();
    try {
      const release = await seal(await readFile(CLEAN));
      const location = await attach(release, "https://cdn.example.com/app.tgz");
      const now = new Date("2026-11-22T10:20:00Z");
      const count = async () =>
        (
          await sql.query<{ payload: { reason?: string; locationId: number } }>(
            `SELECT payload FROM jobs WHERE delivery_id LIKE 'delivery-recheck:%' ORDER BY id`,
          )
        ).rows;
      expect(await runDeliveryRecheckPoll({ store, now: () => now })).toEqual({ queued: 1 });
      expect(await runDeliveryRecheckPoll({ store, now: () => new Date("2026-11-22T10:55:00Z") })).toEqual({ queued: 0 });
      expect(await runDeliveryRecheckPoll({ store, now: () => new Date("2026-11-22T11:01:00Z") })).toEqual({ queued: 1 });
      const jobs = await count();
      expect(jobs).toHaveLength(2);
      expect(jobs[0]?.payload).toMatchObject({ reason: "poll", locationId: location, revisionId: release });
      const later = new Date(Date.now() + (DELIVERY_RECHECK_WINDOW_DAYS + 1) * 86_400_000);
      expect(await runDeliveryRecheckPoll({ store, now: () => later })).toEqual({ queued: 0 });
    } finally {
      await sql.close();
    }
  });

  it("alerts once when a copy still serves bytes that failed after a later release passed", async () => {
    const { sql, store, seal, attach } = await setup();
    try {
      const dirty = await readFile(DIRTY);
      const clean = await readFile(CLEAN);
      const exposed = await seal(dirty);
      const location = await attach(exposed, "https://cdn.example.com/app.tgz?token=secret");
      const notifier = createLogNotifier(store);
      const check = (body: Buffer, status = 200) =>
        runDeliveryVerifyJob({
          store,
          notifier,
          installationId: 7,
          locationId: location,
          revisionId: exposed,
          scheduled: true,
          fetch: bytesFetch(body, status),
          lookup: publicLookup,
        });
      const alerts = async () =>
        (await sql.query<{ id: number; kind: string; title: string; body: string }>(`SELECT id, kind, title, body FROM alerts WHERE kind LIKE 'delivery_%' ORDER BY id`)).rows;

      // Still serving the exposed bytes, but no fix has been recorded yet: nothing to announce.
      await check(dirty);
      expect(await alerts()).toHaveLength(0);

      const fixed = await seal(clean);
      await check(dirty);
      await check(dirty);
      const still = await alerts();
      expect(still).toHaveLength(1);
      expect(still[0]).toMatchObject({ kind: "delivery_still_exposed" });
      expect(still[0]?.title).toMatch(/cdn\.example\.com still serves .* after the fix/);
      expect(JSON.stringify(still)).not.toContain("token=secret");
      const links = await sql.query<{ revision_id: unknown }>(`SELECT revision_id FROM alert_release_links WHERE alert_id = $1 ORDER BY revision_id`, [still[0]?.id]);
      expect(links.rows.map((row) => Number(row.revision_id))).toEqual([exposed, fixed].sort((a, b) => a - b));

      // The copy now serves the release that passed: the fix landed, which is not a tamper alert.
      await check(clean);
      expect(await alerts()).toHaveLength(1);

      // Unknown bytes are still a fact worth one alert, however many hourly checks repeat it.
      const other = Buffer.from("something else entirely");
      await check(other);
      await check(other);
      expect((await alerts()).map((row) => row.kind)).toEqual(["delivery_still_exposed", "delivery_mismatch"]);

      const { rows: history } = await sql.query<{ status: string }>(`SELECT status FROM release_delivery_verifications ORDER BY id`);
      expect(history.map((row) => row.status)).toEqual(["matched", "matched", "matched", "mismatch", "mismatch", "mismatch"]);
    } finally {
      await sql.close();
    }
  });

  it("does not treat a passing release that is still served as exposed", async () => {
    const { sql, store, seal, attach } = await setup();
    try {
      const clean = await readFile(CLEAN);
      const release = await seal(clean);
      const location = await attach(release, "https://cdn.example.com/app.tgz");
      await runDeliveryVerifyJob({ store, notifier: createLogNotifier(store), installationId: 7, locationId: location, revisionId: release, scheduled: true, fetch: bytesFetch(clean), lookup: publicLookup });
      const { rows } = await sql.query(`SELECT id FROM alerts WHERE kind LIKE 'delivery_%'`);
      expect(rows).toHaveLength(0);
    } finally {
      await sql.close();
    }
  });
});

describe("where it went", () => {
  it("returns the recorded trail of a blocked release to workspace members only", async () => {
    const { sql, store, seal, attach, app, cookie } = await setup();
    try {
      const dirty = await readFile(DIRTY);
      const clean = await readFile(CLEAN);
      const exposed = await seal(dirty);
      const location = await attach(exposed, "https://cdn.example.com/app.tgz?token=secret");
      const notifier = createLogNotifier(store);
      const read = (body: Buffer) =>
        runDeliveryVerifyJob({ store, notifier, installationId: 7, locationId: location, revisionId: exposed, scheduled: true, fetch: bytesFetch(body), lookup: publicLookup });
      await read(dirty);
      const fixed = await seal(clean);
      await read(dirty);

      expect((await app.request(`/api/releases/${exposed}/trail`)).status).toBe(401);
      const response = await app.request(`/api/releases/${exposed}/trail`, { headers: { cookie } });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const { trail } = (await response.json()) as { trail: import("../src/watch/release-trail.ts").ReleaseTrailModel };
      expect(trail.release).toMatchObject({ id: exposed, status: "failed" });
      expect(trail.fix?.id).toBe(fixed);
      expect(trail.sources).toHaveLength(1);
      expect(trail.sources[0]).toMatchObject({ kind: "copy", scope: "release", name: "cdn.example.com", state: "exposed", label: "Still serving this build" });
      expect(trail.sources[0].cells.at(-1)).toBe("exposed");
      expect(trail.summary).toMatchObject({ tone: "bad", headline: "1 source is still serving this build", copies: 1 });
      expect(trail.alerts.some((alert) => alert.title.includes("still serves"))).toBe(true);
      expect(trail.events.some((event) => event.text.startsWith("Alert sent:"))).toBe(true);
      expect(JSON.stringify(trail)).not.toContain("secret");

      await read(clean);
      const cleared = (await (await app.request(`/api/releases/${exposed}/trail`, { headers: { cookie } })).json()) as {
        trail: import("../src/watch/release-trail.ts").ReleaseTrailModel;
      };
      expect(cleared.trail.sources[0]).toMatchObject({ state: "clear" });
      expect(cleared.trail.summary).toMatchObject({ tone: "good", headline: "No source serves this build" });

      await store.upsertUser({ id: "u2", login: "outsider" });
      const outsider = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      expect((await app.request(`/api/releases/${exposed}/trail`, { headers: { cookie: outsider } })).status).toBe(404);
      expect((await app.request(`/api/releases/not-a-number/trail`, { headers: { cookie } })).status).toBe(404);
    } finally {
      await sql.close();
    }
  });
});
