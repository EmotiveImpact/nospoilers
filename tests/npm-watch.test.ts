import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import {
  allowedNpmTarballUrl,
  diffWatchedPack,
  normalizePackageName,
  packFromRegistry,
  type NpmPack,
  type NpmPort,
} from "../src/server/npm.ts";
import { checkWatchedPackage, connectWatchedPackage, runNpmWatchPoll } from "../src/server/npm-watch.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";

const FIXTURE = path.resolve("fixtures/sourcemap.tgz");
const TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.0.0.tgz";

function pack(overrides: Partial<NpmPack> = {}): NpmPack {
  return {
    name: "demo-pack",
    version: "1.0.0",
    distTags: { latest: "1.0.0" },
    tarballUrl: TARBALL,
    shasum: "abc123",
    integrity: null,
    bytes: 100,
    ...overrides,
  };
}

function stubNpm(current: { pack: NpmPack | null }, downloads: string[] = []): NpmPort {
  return {
    getPack: async () => current.pack,
    downloadTarball: async (url) => {
      allowedNpmTarballUrl(url);
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
});
