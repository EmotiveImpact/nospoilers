import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { emptyPackageIdentity } from "../src/server/package-identity.ts";
import {
  allowedNpmTarballUrl,
  channelScansForDelta,
  diffWatchedPack,
  MAX_CHANNEL_SCANS,
  normalizePackageName,
  packFromRegistry,
  type NpmAuth,
  type NpmPack,
  type NpmPort,
} from "../src/server/npm.ts";
import { parseRegistryOrigin } from "../src/server/npm-registry.ts";
import { checkWatchedPackage, connectWatchedPackage, runNpmWatchPoll } from "../src/server/npm-watch.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { looksEncrypted } from "../src/server/secret-box.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";

const FIXTURE = path.resolve("fixtures/sourcemap.tgz");
const TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.0.0.tgz";
const BETA_TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-2.0.0-beta.1.tgz";
const NEXT_TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.1.0-next.0.tgz";

function pack(overrides: Partial<NpmPack> = {}): NpmPack {
  return {
    name: "demo-pack",
    version: "1.0.0",
    distTags: { latest: "1.0.0" },
    tarballUrl: TARBALL,
    shasum: "abc123",
    integrity: null,
    bytes: 100,
    identity: emptyPackageIdentity(),
    ...overrides,
  };
}

function stubNpm(
  current: { pack: NpmPack | null; error?: Error },
  downloads: string[] = [],
  auths: Array<NpmAuth | undefined> = [],
): NpmPort {
  return {
    getPack: async (_name, auth) => {
      auths.push(auth);
      if (current.error) throw current.error;
      return current.pack;
    },
    downloadTarball: async (url, _max, auth) => {
      auths.push(auth);
      const host = auth
        ? (parseRegistryOrigin(auth.registryOrigin)?.host ?? "registry.npmjs.org")
        : "registry.npmjs.org";
      allowedNpmTarballUrl(url, host);
      downloads.push(url);
      return await readFile(FIXTURE);
    },
  };
}

describe("npm names and diffs", () => {
  it("normalizes public package names and rejects junk", () => {
    expect(normalizePackageName("Left-Pad")).toBe("left-pad");
    expect(normalizePackageName("@Scope/Name")).toBe("@scope/name");
    expect(normalizePackageName("../etc/passwd")).toBeNull();
    expect(normalizePackageName("http://registry.npmjs.org/x")).toBeNull();
    expect(normalizePackageName("")).toBeNull();
  });

  it("only allows https registry.npmjs.org tarball URLs", () => {
    expect(() => allowedNpmTarballUrl("http://registry.npmjs.org/x.tgz")).toThrow(/https/);
    expect(() => allowedNpmTarballUrl("https://evil.example/x.tgz")).toThrow(/registry.npmjs.org/);
    expect(allowedNpmTarballUrl(TARBALL).hostname).toBe("registry.npmjs.org");
  });

  it("reads latest tarball metadata from a registry document", () => {
    const parsed = packFromRegistry("demo-pack", {
      name: "demo-pack",
      "dist-tags": { latest: "1.0.0", beta: "2.0.0-beta.1" },
      versions: {
        "1.0.0": { dist: { tarball: TARBALL, shasum: "abc123" } },
      },
    });
    expect(parsed?.version).toBe("1.0.0");
    expect(parsed?.shasum).toBe("abc123");
    expect(parsed?.channelTarballs).toEqual([]);
  });

  it("extracts next/beta/canary tarballs that are not latest, skips bad hosts, and caps extras", () => {
    const parsed = packFromRegistry("demo-pack", {
      name: "demo-pack",
      "dist-tags": {
        latest: "1.0.0",
        next: "1.1.0-next.0",
        beta: "2.0.0-beta.1",
        canary: "1.0.0",
        nightly: "9.0.0",
        rc: "3.0.0-rc.1",
        alpha: "0.9.0-alpha.1",
        preview: "4.0.0-preview.1",
      },
      versions: {
        "1.0.0": { dist: { tarball: TARBALL, shasum: "abc123" } },
        "1.1.0-next.0": { dist: { tarball: NEXT_TARBALL, shasum: "next" } },
        "2.0.0-beta.1": { dist: { tarball: BETA_TARBALL, shasum: "beta" } },
        "3.0.0-rc.1": {
          dist: { tarball: "https://evil.example/demo-pack-3.0.0-rc.1.tgz", shasum: "rc" },
        },
        "0.9.0-alpha.1": {
          dist: {
            tarball: "https://registry.npmjs.org/demo-pack/-/demo-pack-0.9.0-alpha.1.tgz",
            shasum: "alpha",
          },
        },
        "4.0.0-preview.1": {
          dist: {
            tarball: "https://registry.npmjs.org/demo-pack/-/demo-pack-4.0.0-preview.1.tgz",
            shasum: "preview",
          },
        },
      },
    });
    expect(parsed?.channelTarballs).toEqual([
      { tag: "next", version: "1.1.0-next.0", tarballUrl: NEXT_TARBALL, shasum: "next" },
      { tag: "beta", version: "2.0.0-beta.1", tarballUrl: BETA_TARBALL, shasum: "beta" },
      {
        tag: "alpha",
        version: "0.9.0-alpha.1",
        tarballUrl: "https://registry.npmjs.org/demo-pack/-/demo-pack-0.9.0-alpha.1.tgz",
        shasum: "alpha",
      },
    ]);
    expect(parsed?.channelTarballs).toHaveLength(MAX_CHANNEL_SCANS);
    expect(channelScansForDelta(null, parsed!)).toHaveLength(MAX_CHANNEL_SCANS);
    expect(
      channelScansForDelta(
        {
          latest: "1.0.0",
          next: "1.1.0-next.0",
          beta: "1.0.0-beta.0",
          alpha: "0.9.0-alpha.1",
        },
        parsed!,
      ),
    ).toEqual([
      { tag: "beta", version: "2.0.0-beta.1", tarballUrl: BETA_TARBALL, shasum: "beta" },
    ]);
    expect(
      channelScansForDelta(
        {
          latest: "1.0.0",
          next: "1.1.0-next.0",
          beta: "2.0.0-beta.1",
          alpha: "0.9.0-alpha.1",
        },
        parsed!,
      ),
    ).toEqual([]);
  });

  it("detects first scan, new version, mutated bytes, and dist-tag moves", () => {
    expect(diffWatchedPack(null, pack())[0]?.type).toBe("first");
    expect(
      diffWatchedPack(
        { version: "1.0.0", shasum: "abc123", distTags: { latest: "1.0.0" } },
        pack({ version: "1.1.0", distTags: { latest: "1.1.0" }, shasum: "def" }),
      )[0]?.type,
    ).toBe("new_version");
    expect(
      diffWatchedPack(
        { version: "1.0.0", shasum: "abc123", distTags: { latest: "1.0.0" } },
        pack({ shasum: "mutated" }),
      )[0]?.type,
    ).toBe("mutated_tarball");
    expect(
      diffWatchedPack(
        { version: "1.0.0", shasum: "abc123", distTags: { latest: "1.0.0" } },
        pack({ distTags: { latest: "1.0.0", beta: "1.0.1-beta" } }),
      )[0]?.type,
    ).toBe("dist_tags");
    expect(
      diffWatchedPack(
        { version: "1.0.0", shasum: "abc123", distTags: { latest: "1.0.0" } },
        pack(),
      )[0]?.type,
    ).toBe("unchanged");
  });
});

describe("hosted npm watch", () => {
  it("connects a package, scans the current tarball, and alerts without keeping source", async () => {
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
      const sessionId = await store.createSession("u1");
      const cookie = `ns_session=${signSession("sess", sessionId)}`;
      const downloads: string[] = [];
      const npm = stubNpm({ pack: pack() }, downloads);
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
        github: {
          exchangeCode: async () => {
            throw new Error("unused");
          },
          getUser: async () => {
            throw new Error("unused");
          },
          listUserInstallations: async () => [],
          getInstallation: async () => {
            throw new Error("unused");
          },
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
          ...skippedGithubWrites(),
        },
        npm,
        wakeWorker: () => {
          woke += 1;
        },
      });
      const created = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack", installationId: 7 }),
      });
      expect(created.status).toBe(201);
      expect(woke).toBe(1);
      const listed = await app.request("/api/packages", { headers: { cookie } });
      const listedBody = (await listed.json()) as { packages: { package_name: string }[] };
      expect(listedBody.packages.map((row) => row.package_name)).toEqual(["demo-pack"]);

      const worker = createWorker({
        store,
        github: {
          exchangeCode: async () => {
            throw new Error("unused");
          },
          getUser: async () => {
            throw new Error("unused");
          },
          listUserInstallations: async () => [],
          getInstallation: async () => {
            throw new Error("unused");
          },
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
          ...skippedGithubWrites(),
        },
        npm,
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 80));
      await worker.stop();
      expect(downloads).toEqual([TARBALL]);
      const { rows: alerts } = await sql.query<{ title: string; body: string; findings: unknown }>(
        "SELECT title, body, findings FROM alerts",
      );
      expect(alerts[0]?.title).toMatch(/Spoilers in npm demo-pack@1.0.0/);
      expect(alerts[0]?.body).toMatch(/sha256 /);
      expect(JSON.stringify(alerts[0]?.findings)).not.toMatch(/BEGIN PRIVATE|AKIA|sk_live/);
      const { rows: bytes } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM watched_packages WHERE last_sha256 IS NOT NULL",
      );
      expect(Number(bytes[0]?.n)).toBe(1);
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
      const npm = stubNpm({ pack: pack() });
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
        github: {
          exchangeCode: async () => {
            throw new Error("unused");
          },
          getUser: async () => {
            throw new Error("unused");
          },
          listUserInstallations: async () => [],
          getInstallation: async () => {
            throw new Error("unused");
          },
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
          ...skippedGithubWrites(),
        },
        npm,
      });
      const unpaid = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack", installationId: 7 }),
      });
      expect(unpaid.status).toBe(402);
      const { rows } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      expect(Number(rows[0]?.n)).toBe(0);

      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      const created = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack", installationId: 7 }),
      });
      expect(created.status).toBe(201);
      const stolen = await app.request("/api/packages", { headers: { cookie: other } });
      const stolenBody = (await stolen.json()) as { packages: unknown[] };
      expect(stolenBody.packages).toEqual([]);
      const removed = await app.request("/api/packages/1", {
        method: "DELETE",
        headers: { cookie: other },
      });
      expect(removed.status).toBe(404);
    } finally {
      await sql.close();
    }
  });

  it("queues a new version from the hourly check and skips unpaid packages", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "ended",
        accountType: "User",
        accountId: 2,
      });
      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 8`,
      );
      const current = { pack: pack() };
      const npm = stubNpm(current);
      const first = await connectWatchedPackage(store, npm, {
        installationId: 7,
        packageName: "demo-pack",
      });
      await store.insertWatchedPackage(8, "demo-pack");
      current.pack = pack({
        version: "1.2.0",
        distTags: { latest: "1.2.0" },
        shasum: "newhash",
        tarballUrl: "https://registry.npmjs.org/demo-pack/-/demo-pack-1.2.0.tgz",
      });
      const polled = await runNpmWatchPoll({ store, npm });
      expect(polled.queued).toBe(1);
      const { rows } = await sql.query<{ kind: string; payload: unknown }>(
        "SELECT kind, payload FROM jobs ORDER BY id",
      );
      const versions = rows.map((row) => {
        const payload =
          typeof row.payload === "string"
            ? (JSON.parse(row.payload) as { version?: string })
            : (row.payload as { version?: string });
        return { kind: row.kind, version: payload.version };
      });
      expect(versions.some((row) => row.kind === "npm_scan" && row.version === "1.2.0")).toBe(true);
      const fresh = await store.getWatchedPackage(first.package.id);
      expect(fresh).not.toBeNull();
      const check = await checkWatchedPackage(store, npm, fresh!);
      expect(check.deltas[0]?.type).toBe("unchanged");
    } finally {
      await sql.close();
    }
  });

  it("alerts when a recorded pack is gone from the registry, without downloading", async () => {
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
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u2");
      const downloads: string[] = [];
      const current: { pack: NpmPack | null; error?: Error } = { pack: pack() };
      const npm = stubNpm(current, downloads);
      const connected = await connectWatchedPackage(store, npm, {
        installationId: 7,
        packageName: "demo-pack",
      });
      current.pack = null;
      const recorded = await store.getWatchedPackage(connected.package.id);
      const gone = await checkWatchedPackage(store, npm, recorded!);
      expect(gone.queued).toBe(false);
      expect(gone.deltas[0]?.type).toBe("unpublished");
      expect(downloads).toEqual([]);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
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
        npm,
      });
      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; body: string }[] };
      const unpublished = alertBody.alerts.filter((row) => row.kind === "package_unpublished");
      expect(unpublished).toHaveLength(1);
      expect(unpublished[0]?.body).toMatch(/1\.0\.0/);
      expect(unpublished[0]?.body).toMatch(/not a malware verdict/);
      const again = await checkWatchedPackage(store, npm, (await store.getWatchedPackage(connected.package.id))!);
      expect(again.deltas[0]?.type).toBe("unpublished");
      const after = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await after.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "package_unpublished",
        ),
      ).toHaveLength(1);
      const foreign = await app.request("/api/alerts", { headers: { cookie: otherCookie } });
      expect(
        ((await foreign.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("package_unpublished");

      current.error = new Error("npm registry returned 503.");
      const blip = await checkWatchedPackage(store, npm, (await store.getWatchedPackage(connected.package.id))!);
      expect(blip.deltas[0]?.type).toBe("unchanged");
      delete current.error;
      expect(downloads).toEqual([]);

      const unpaidPkg = await store.insertWatchedPackage(7, "unpaid-pack");
      await store.touchWatchedPackage(unpaidPkg!.id, {
        version: "9.9.9",
        distTags: { latest: "9.9.9" },
        tarballUrl: TARBALL,
        shasum: "x",
      });
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await checkWatchedPackage(store, npm, (await store.getWatchedPackage(unpaidPkg!.id))!);
      expect(unpaid.deltas[0]?.type).toBe("unchanged");
      const afterUnpaid = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterUnpaid.json()) as { alerts: { kind: string; body: string }[] }).alerts.filter(
          (row) => row.kind === "package_unpublished" && /unpaid-pack/.test(row.body),
        ),
      ).toHaveLength(0);
    } finally {
      await sql.close();
    }
  });

  it("scans a beta tarball on connect and when that dist-tag moves, not as a tag-only alert", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      const betaPack = pack({
        distTags: { latest: "1.0.0", beta: "2.0.0-beta.1" },
        channelTarballs: [
          { tag: "beta", version: "2.0.0-beta.1", tarballUrl: BETA_TARBALL, shasum: "beta" },
        ],
      });
      const current = { pack: betaPack };
      const downloads: string[] = [];
      const npm = stubNpm(current, downloads);
      const connected = await connectWatchedPackage(store, npm, {
        installationId: 7,
        packageName: "demo-pack",
      });
      const { rows: firstJobs } = await sql.query<{ kind: string; payload: unknown }>(
        "SELECT kind, payload FROM jobs ORDER BY id",
      );
      const firstPayloads = firstJobs.map((row) => {
        const payload =
          typeof row.payload === "string"
            ? (JSON.parse(row.payload) as { version?: string; distTag?: string; tarballUrl?: string })
            : (row.payload as { version?: string; distTag?: string; tarballUrl?: string });
        return { kind: row.kind, ...payload };
      });
      expect(firstPayloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "npm_scan", version: "1.0.0" }),
          expect.objectContaining({ kind: "npm_scan", version: "2.0.0-beta.1", distTag: "beta" }),
        ]),
      );
      expect(firstPayloads.every((row) => row.kind !== "npm_dist_tag")).toBe(true);
      expect(JSON.stringify(firstPayloads)).not.toMatch(/ghp_|token/i);

      const worker = createWorker({
        store,
        github: unusedGithub(),
        npm,
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        receiptSecret: "receipt-test-secret",
      });
      await worker.tick();
      const start = Date.now();
      while (Date.now() - start < 4000) {
        if (downloads.length >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await worker.stop();
      expect(downloads.sort()).toEqual([TARBALL, BETA_TARBALL].sort());
      const { rows: alerts } = await sql.query<{ title: string }>("SELECT title FROM alerts ORDER BY id");
      expect(alerts.some((row) => /demo-pack@2\.0\.0-beta\.1 \(beta\)/.test(row.title))).toBe(true);
      const { rows: revisions } = await sql.query<{ channel: string; coordinate: string }>(
        "SELECT channel, coordinate FROM release_revisions ORDER BY id",
      );
      expect(revisions.some((row) => row.coordinate.includes("2.0.0-beta.1") && row.channel === "beta")).toBe(
        true,
      );

      current.pack = pack({
        distTags: { latest: "1.0.0", beta: "2.0.0-beta.2" },
        channelTarballs: [
          {
            tag: "beta",
            version: "2.0.0-beta.2",
            tarballUrl: "https://registry.npmjs.org/demo-pack/-/demo-pack-2.0.0-beta.2.tgz",
            shasum: "beta2",
          },
        ],
      });
      const moved = await checkWatchedPackage(store, npm, (await store.getWatchedPackage(connected.package.id))!);
      expect(moved.queued).toBe(true);
      const { rows: later } = await sql.query<{ kind: string; payload: unknown }>(
        "SELECT kind, payload FROM jobs ORDER BY id DESC LIMIT 3",
      );
      const kinds = later.map((row) => {
        const payload =
          typeof row.payload === "string"
            ? (JSON.parse(row.payload) as { version?: string; distTag?: string })
            : (row.payload as { version?: string; distTag?: string });
        return { kind: row.kind, version: payload.version, distTag: payload.distTag };
      });
      expect(kinds.some((row) => row.kind === "npm_scan" && row.version === "2.0.0-beta.2" && row.distTag === "beta")).toBe(
        true,
      );
      expect(kinds.every((row) => row.kind !== "npm_dist_tag")).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("keeps a light dist-tag alert when only a custom tag moves", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      const npm = stubNpm({ pack: pack() });
      const connected = await connectWatchedPackage(store, npm, {
        installationId: 7,
        packageName: "demo-pack",
      });
      const npmMoved = stubNpm({
        pack: pack({ distTags: { latest: "1.0.0", nightly: "9.9.9" } }),
      });
      const moved = await checkWatchedPackage(
        store,
        npmMoved,
        (await store.getWatchedPackage(connected.package.id))!,
      );
      expect(moved.deltas[0]?.type).toBe("dist_tags");
      expect(moved.queued).toBe(true);
      const { rows } = await sql.query<{ kind: string }>("SELECT kind FROM jobs ORDER BY id");
      expect(rows.some((row) => row.kind === "npm_dist_tag")).toBe(true);
      expect(rows.filter((row) => row.kind === "npm_scan")).toHaveLength(1);
    } finally {
      await sql.close();
    }
  });
});

const PRIVATE_TARBALL = "https://npm.pkg.github.com/@acme/pack/-/pack-1.0.0.tgz";
const PRIVATE_TOKEN = "ghp_private_registry_token_value";

function unusedGithub() {
  return {
    exchangeCode: async () => {
      throw new Error("unused");
    },
    getUser: async () => {
      throw new Error("unused");
    },
    listUserInstallations: async () => [],
    getInstallation: async () => {
      throw new Error("unused");
    },
    getRepo: async () => {
      throw new Error("unused");
    },
    listReleaseAssets: async () => [],
    getLatestRelease: async () => null,
    downloadAsset: async () => Buffer.alloc(0),
    ...skippedGithubWrites(),
  };
}

describe("private npm registries", () => {
  it("encrypts tokens, never returns them, and blocks SSRF and other tenants", async () => {
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
        id: 8,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(8, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
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
        npm: stubNpm({ pack: pack() }),
      });

      expect((await app.request("/api/registries")).status).toBe(401);
      const ssrf = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          origin: "https://127.0.0.1/npm",
          token: PRIVATE_TOKEN,
          installationId: 7,
        }),
      });
      expect(ssrf.status).toBe(400);
      const publicToken = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          origin: "https://registry.npmjs.org",
          token: PRIVATE_TOKEN,
          installationId: 7,
        }),
      });
      expect(publicToken.status).toBe(400);

      const saved = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          origin: "https://npm.pkg.github.com",
          token: PRIVATE_TOKEN,
          installationId: 7,
        }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as { registry: { origin: string; token?: string } };
      expect(savedBody.registry.origin).toBe("https://npm.pkg.github.com");
      expect(JSON.stringify(savedBody)).not.toContain(PRIVATE_TOKEN);
      expect(savedBody.registry.token).toBeUndefined();

      const { rows } = await sql.query<{ token_ciphertext: string }>(
        "SELECT token_ciphertext FROM npm_registries",
      );
      expect(looksEncrypted(rows[0]?.token_ciphertext ?? "")).toBe(true);
      expect(rows[0]?.token_ciphertext).not.toContain(PRIVATE_TOKEN);

      const listed = await app.request("/api/registries", { headers: { cookie } });
      const listBody = (await listed.json()) as { registries: Record<string, unknown>[] };
      expect(listBody.registries).toHaveLength(1);
      expect(JSON.stringify(listBody)).not.toContain(PRIVATE_TOKEN);
      expect(JSON.stringify(listBody)).not.toContain("token_ciphertext");

      const stolen = await app.request("/api/registries", { headers: { cookie: other } });
      expect(((await stolen.json()) as { registries: unknown[] }).registries).toEqual([]);
      const stolenDelete = await app.request("/api/registries/1", {
        method: "DELETE",
        headers: { cookie: other },
      });
      expect(stolenDelete.status).toBe(404);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          origin: "https://npm.pkg.github.com",
          token: PRIVATE_TOKEN,
          installationId: 7,
        }),
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("watches a private pack with the saved token and never writes the token onto the job", async () => {
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
      const auths: Array<NpmAuth | undefined> = [];
      const npm = stubNpm(
        {
          pack: pack({
            name: "@acme/pack",
            tarballUrl: PRIVATE_TARBALL,
          }),
        },
        [],
        auths,
      );
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: "receipt-secret",
        }),
        store,
        github: unusedGithub(),
        npm,
      });
      const saved = await app.request("/api/registries", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          origin: "https://npm.pkg.github.com",
          token: PRIVATE_TOKEN,
          installationId: 7,
        }),
      });
      expect(saved.status).toBe(201);
      const created = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          packageName: "@acme/pack",
          installationId: 7,
          registryOrigin: "https://npm.pkg.github.com",
        }),
      });
      expect(created.status).toBe(201);
      expect(auths.some((auth) => auth?.token === PRIVATE_TOKEN)).toBe(true);

      const { rows: jobs } = await sql.query<{ payload: unknown }>("SELECT payload FROM jobs");
      expect(JSON.stringify(jobs)).not.toContain(PRIVATE_TOKEN);
      const payload =
        typeof jobs[0]?.payload === "string"
          ? (JSON.parse(jobs[0].payload) as { registryOrigin?: string; tarballUrl?: string })
          : (jobs[0]?.payload as { registryOrigin?: string; tarballUrl?: string });
      expect(payload.registryOrigin).toBe("https://npm.pkg.github.com");
      expect(payload.tarballUrl).toBe(PRIVATE_TARBALL);

      const downloadAuths: Array<NpmAuth | undefined> = [];
      const workerNpm = stubNpm(
        { pack: pack({ tarballUrl: PRIVATE_TARBALL }) },
        [],
        downloadAuths,
      );
      const worker = createWorker({
        store,
        github: unusedGithub(),
        npm: workerNpm,
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await worker.tick();
      const start = Date.now();
      while (Date.now() - start < 4000) {
        const { rows } = await sql.query<{ status: string }>("SELECT status FROM jobs");
        if (rows[0]?.status === "done") break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await worker.stop();
      expect(downloadAuths.some((auth) => auth?.token === PRIVATE_TOKEN)).toBe(true);
      const { rows: done } = await sql.query<{ status: string }>("SELECT status FROM jobs");
      expect(done[0]?.status).toBe("done");
    } finally {
      await sql.close();
    }
  });
});

