import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { emptyPackageIdentity } from "../src/server/package-identity.ts";
import type { NpmPack, NpmPort } from "../src/server/npm.ts";
import {
  MAX_PROSPECT_FEED_QUEUE,
  runProspectNpmFeed,
  runScheduledProspectDiscovery,
} from "../src/server/prospect-feed.ts";
import {
  MAX_PROSPECT_WORKSPACE_PACKS,
  nestedNpmArtifactsFromGithub,
  parseGithubRepository,
  workspaceMemberNamesFromReport,
  workspaceParentDirs,
} from "../src/server/prospects.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";

function unusedGithub(): GithubPort {
  const unused = async (): Promise<never> => {
    throw new Error("GitHub should not be called.");
  };
  return {
    exchangeCode: unused,
    getUser: unused,
    listUserInstallations: unused,
    getInstallation: unused,
    getRepo: unused,
    listReleaseAssets: unused,
    getLatestRelease: unused,
    downloadAsset: unused,
    ...skippedGithubWrites(),
  };
}

describe("Artifact Leads repository parsing", () => {
  it("accepts owner/repo and GitHub URLs only", () => {
    expect(parseGithubRepository("prettier/prettier")).toEqual({
      owner: "prettier",
      repo: "prettier",
    });
    expect(parseGithubRepository("https://github.com/prettier/prettier.git")).toEqual({
      owner: "prettier",
      repo: "prettier",
    });
    expect(parseGithubRepository("https://example.com/prettier/prettier")).toBeNull();
    expect(parseGithubRepository("owner/repo/extra")).toBeNull();
  });
});

describe("Artifact Leads persistence", () => {
  it("deduplicates artifacts and records metadata-only findings", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const input = {
        source: "npm" as const,
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      };
      const first = await store.upsertProspect(input);
      const duplicate = await store.upsertProspect(input);
      expect(first.inserted).toBe(true);
      expect(duplicate).toEqual({ id: first.id, inserted: false });

      await store.completeProspectScan(first.id, {
        fileCount: 2,
        findings: [
          {
            rule: "MAP-001",
            severity: "critical",
            path: "package/dist/app.js.map",
            title: "Source map ships in the artifact",
            detail: "A .map file is included in the packed artifact.",
          },
        ],
      });
      const row = await store.getProspect(first.id);
      expect(row?.scan_status).toBe("complete");
      expect(row?.critical_count).toBe(1);
      expect(row?.file_count).toBe(2);
      expect(row?.findings).toEqual([
        expect.objectContaining({ rule: "MAP-001", path: "package/dist/app.js.map" }),
      ]);
      expect(row?.workspace_members).toEqual([]);

      await store.completeProspectScan(first.id, {
        fileCount: 3,
        findings: [],
        workspaceMembers: ["@octo/cli", "@octo/core"],
      });
      expect((await store.getProspect(first.id))?.workspace_members).toEqual([
        "@octo/cli",
        "@octo/core",
      ]);
    } finally {
      await sql.close();
    }
  });

  it("lists public workspace member packs from repo workspace config, without auto-watching", async () => {
    expect(workspaceParentDirs(["packages/*", "!packages/test", "apps/web", "packages/**"])).toEqual([
      "apps/web",
      "packages",
    ]);
    expect(
      workspaceMemberNamesFromReport([
        {
          kind: "npm",
          root: ".",
          configPath: "package.json",
          globs: ["packages/*"],
          members: [
            { name: "@octo/core", path: "packages/core", private: false },
            { name: "@octo/cli", path: "packages/cli", private: false },
          ],
        },
      ]),
    ).toEqual(["@octo/cli", "@octo/core"]);

    const files: Record<string, string> = {
      "package.json": JSON.stringify({ name: "@octo/root", workspaces: ["packages/*"] }),
      "packages/core/package.json": JSON.stringify({ name: "@octo/core" }),
      "packages/cli/package.json": JSON.stringify({ name: "@octo/cli" }),
      "packages/secret/package.json": JSON.stringify({ name: "@octo/secret", private: true }),
    };
    const npm: Record<string, { version: string; tarball: string }> = {
      "@octo/core": {
        version: "1.0.0",
        tarball: "https://registry.npmjs.org/@octo/core/-/core-1.0.0.tgz",
      },
      "@octo/cli": {
        version: "2.0.0",
        tarball: "https://registry.npmjs.org/@octo/cli/-/cli-2.0.0.tgz",
      },
    };
    const artifacts = await nestedNpmArtifactsFromGithub({
      owner: "octo",
      repo: "app",
      repositoryUrl: "https://github.com/octo/app",
      rootPackageName: "@octo/root",
      readFile: async (filePath) => files[filePath] ?? null,
      listDir: async (dirPath) => {
        if (dirPath !== "packages") return [];
        return [
          { name: "core", type: "dir" },
          { name: "cli", type: "dir" },
          { name: "secret", type: "dir" },
        ];
      },
      npmLatest: async (packageName) => npm[packageName] ?? null,
    });
    expect(artifacts.map((row) => row.packageName).sort()).toEqual(["@octo/cli", "@octo/core"]);
    expect(artifacts.every((row) => row.source === "npm")).toBe(true);
    expect(artifacts).toHaveLength(2);

    const manyFiles: Record<string, string> = {
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    };
    const manyNpm: Record<string, { version: string; tarball: string }> = {};
    for (let i = 0; i < 12; i += 1) {
      manyFiles[`packages/pkg-${i}/package.json`] = JSON.stringify({ name: `@octo/pkg-${i}` });
      manyNpm[`@octo/pkg-${i}`] = {
        version: "1.0.0",
        tarball: `https://registry.npmjs.org/@octo/pkg-${i}/-/pkg-${i}-1.0.0.tgz`,
      };
    }
    const capped = await nestedNpmArtifactsFromGithub({
      owner: "octo",
      repo: "app",
      repositoryUrl: "https://github.com/octo/app",
      readFile: async (filePath) => manyFiles[filePath] ?? null,
      listDir: async () =>
        Array.from({ length: 12 }, (_, i) => ({ name: `pkg-${i}`, type: "dir" as const })),
      npmLatest: async (packageName) => manyNpm[packageName] ?? null,
    });
    expect(capped).toHaveLength(MAX_PROSPECT_WORKSPACE_PACKS);
  });

  it("requires an admin session or token for internal APIs", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const app = createApp({
        config: loadConfig({ adminToken: "test-admin-token", sessionSecret: "test-session" }),
        store,
        github: unusedGithub(),
      });

      const denied = await app.request("/api/internal/prospects");
      expect(denied.status).toBe(401);

      const allowed = await app.request("/api/internal/prospects", {
        headers: { authorization: "Bearer test-admin-token" },
      });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as {
        prospects: unknown[];
        policy: { publicArtifactsOnly: boolean; sourceRetained: boolean };
      };
      expect(body.prospects).toEqual([]);
      expect(body.policy).toEqual(
        expect.objectContaining({ publicArtifactsOnly: true, sourceRetained: false }),
      );
    } finally {
      await sql.close();
    }
  });

  it("does not let a customer session read or mutate Artifact Leads", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertProspect({
        source: "npm",
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const sessionId = await store.createSession("customer-1");
      const app = createApp({
        config: loadConfig({
          adminToken: "owner-only-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "test-session",
        }),
        store,
        github: unusedGithub(),
      });
      const cookie = `ns_session=${signSession("test-session", sessionId)}`;
      const list = await app.request("/api/internal/prospects", {
        headers: { cookie },
      });
      expect(list.status).toBe(401);
      const denied = (await list.json()) as { prospects?: unknown; error?: string };
      expect(denied.prospects).toBeUndefined();
      expect(denied.error).toBe("Admin access required.");

      const mutate = await app.request("/api/internal/prospects/1", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(mutate.status).toBe(401);

      const discover = await app.request("/api/internal/prospects/discover", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ query: "topic:electron" }),
      });
      expect(discover.status).toBe(401);

      const feed = await app.request("/api/internal/prospects/feed", {
        method: "POST",
        headers: { cookie },
      });
      expect(feed.status).toBe(401);

      const desk = await app.request("/api/internal/prospects/1/disclosure", {
        headers: { cookie },
      });
      expect(desk.status).toBe(401);
      const deskBody = (await desk.json()) as { case?: unknown };
      expect(deskBody.case).toBeUndefined();

      const openDesk = await app.request("/api/internal/prospects/1/disclosure", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(openDesk.status).toBe(401);

      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const ownerSession = await store.createSession("owner-1");
      const allowed = await app.request("/api/internal/prospects", {
        headers: { cookie: `ns_session=${signSession("test-session", ownerSession)}` },
      });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as { prospects: { artifact_name: string }[] };
      expect(body.prospects).toHaveLength(1);
      expect(body.prospects[0]?.artifact_name).toBe("prettier-3.9.6.tgz");
    } finally {
      await sql.close();
    }
  });

  it("lets the owner read queue counts and hides them from customers", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "acme",
        accountType: "User",
        accountId: 1,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          url: "https://github.com/acme/secret",
          token: "sk_live_exampletokenvalue12",
        },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 1, artifactUrl: "https://registry.npmjs.org/prettier/-/x.tgz" },
      });
      await store.enqueueJob({
        priority: "light",
        kind: "repo_publicized",
        payload: { installationId: 7 },
      });
      await sql.query(
        `UPDATE jobs SET status = 'failed', error = 'https://evil.example/hook?token=ghu_secret' WHERE kind = 'release_scan'`,
      );
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const app = createApp({
        config: loadConfig({
          adminToken: "owner-only-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "test-session",
        }),
        store,
        github: unusedGithub(),
      });
      const customer = `ns_session=${signSession("test-session", await store.createSession("customer-1"))}`;
      const owner = `ns_session=${signSession("test-session", await store.createSession("owner-1"))}`;

      const denied = await app.request("/api/internal/queue", { headers: { cookie: customer } });
      expect(denied.status).toBe(401);
      expect(JSON.stringify(await denied.json())).not.toMatch(/queued/);

      const allowed = await app.request("/api/internal/queue", { headers: { cookie: owner } });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as {
        customer: { queued: number; running: number; failed: number };
        prospect: { queued: number; running: number; failed: number };
        heavyQueued: number;
        lightQueued: number;
        staleRunning: number;
        oldestQueuedAgeMs: number | null;
        usage: {
          customerHeavyToday: number;
          installsWarning: number;
          installsExhausted: number;
        };
      };
      expect(body.customer.failed).toBe(1);
      expect(body.prospect.queued).toBe(1);
      expect(body.lightQueued).toBe(1);
      expect(body.heavyQueued).toBe(1);
      expect(body.usage).toEqual({
        customerHeavyToday: 1,
        installsWarning: 0,
        installsExhausted: 0,
      });
      expect(Object.keys(body.usage).sort()).toEqual([
        "customerHeavyToday",
        "installsExhausted",
        "installsWarning",
      ]);
      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/sk_live_exampletokenvalue12/);
      expect(raw).not.toMatch(/ghu_secret/);
      expect(raw).not.toMatch(/github\.com\/acme/);
      expect(raw).not.toMatch(/prettier/);
      expect(raw).not.toMatch(/credit/i);
      expect(body).not.toHaveProperty("jobs");
    } finally {
      await sql.close();
    }
  });
});

function feedPack(overrides: Partial<NpmPack> = {}): NpmPack {
  return {
    name: "prettier",
    version: "3.9.6",
    distTags: { latest: "3.9.6" },
    tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
    shasum: "abc123",
    integrity: null,
    bytes: 100,
    identity: emptyPackageIdentity(),
    ...overrides,
  };
}

function stubFeedNpm(input: {
  packs?: Record<string, NpmPack | null>;
  error?: Error;
  names?: string[];
}): NpmPort {
  return {
    getPack: async (name) => {
      input.names?.push(name);
      if (input.error) throw input.error;
      if (input.packs && name in input.packs) return input.packs[name] ?? null;
      return null;
    },
    downloadTarball: async () => {
      throw new Error("Feed must not download a tarball.");
    },
  };
}

async function seedCompleteNpmProspect(
  store: Store,
  input: {
    packageName: string;
    version: string;
    tarballUrl: string;
    status?: "new" | "contacted" | "fixed" | "ignored";
  },
): Promise<number> {
  const row = await store.upsertProspect({
    source: "npm",
    owner: "prettier",
    repo: "prettier",
    repositoryUrl: "https://github.com/prettier/prettier",
    packageName: input.packageName,
    releaseTag: input.version,
    artifactName: `${input.packageName}-${input.version}.tgz`,
    artifactUrl: input.tarballUrl,
  });
  await store.completeProspectScan(row.id, { fileCount: 1, findings: [] });
  if (input.status && input.status !== "new") {
    await store.updateProspectStatus(row.id, input.status);
  }
  return row.id;
}

describe("Artifact Leads npm feed", () => {
  it("queues a new latest tarball and leaves the same version untouched", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const firstId = await seedCompleteNpmProspect(store, {
        packageName: "prettier",
        version: "3.9.6",
        tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      const names: string[] = [];
      const first = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({
          names,
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              distTags: { latest: "3.9.7" },
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      expect(first).toEqual({ checked: 1, queued: 1 });
      expect(names).toEqual(["prettier"]);
      const afterNew = await store.listProspects();
      expect(afterNew).toHaveLength(2);
      expect(afterNew.some((row) => row.artifact_url.endsWith("prettier-3.9.7.tgz"))).toBe(true);
      expect((await store.getProspect(firstId))?.feed_checked_at).toBeTruthy();
      expect((await store.ownerQueueHealth(60_000)).prospect.queued).toBe(1);

      const same = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              distTags: { latest: "3.9.7" },
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      expect(same).toEqual({ checked: 1, queued: 0 });
      expect(await store.listProspects()).toHaveLength(2);
    } finally {
      await sql.close();
    }
  });

  it("treats a registry 404 or network error as a touch, not an unpublish", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedCompleteNpmProspect(store, {
        packageName: "prettier",
        version: "3.9.6",
        tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      const missing = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({ packs: { prettier: null } }),
      });
      expect(missing).toEqual({ checked: 1, queued: 0 });
      expect(await store.listProspects()).toHaveLength(1);
      expect((await store.ownerQueueHealth(60_000)).prospect.queued).toBe(0);

      await seedCompleteNpmProspect(store, {
        packageName: "left-pad",
        version: "1.3.0",
        tarballUrl: "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
      });
      const failed = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({ error: new Error("registry unreachable") }),
      });
      expect(failed).toEqual({ checked: 2, queued: 0 });
      expect(await store.listProspects()).toHaveLength(2);
      expect((await store.listProspects()).every((row) => row.status === "new")).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("skips ignored and fixed leads", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedCompleteNpmProspect(store, {
        packageName: "prettier",
        version: "3.9.6",
        tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await seedCompleteNpmProspect(store, {
        packageName: "left-pad",
        version: "1.3.0",
        tarballUrl: "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
        status: "ignored",
      });
      await seedCompleteNpmProspect(store, {
        packageName: "once",
        version: "1.4.0",
        tarballUrl: "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
        status: "fixed",
      });
      const names: string[] = [];
      const result = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({
          names,
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              distTags: { latest: "3.9.7" },
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      expect(result).toEqual({ checked: 1, queued: 1 });
      expect(names).toEqual(["prettier"]);
    } finally {
      await sql.close();
    }
  });

  it("yields when customer jobs are out or the prospect queue is at the cap", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "acme",
        accountType: "User",
        accountId: 1,
      });
      await seedCompleteNpmProspect(store, {
        packageName: "prettier",
        version: "3.9.6",
        tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 7 },
      });
      const names: string[] = [];
      const busy = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({
          names,
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      expect(busy).toEqual({ checked: 0, queued: 0, skipped: "customer_busy" });
      expect(names).toEqual([]);

      await sql.query(`UPDATE jobs SET status = 'done' WHERE kind = 'release_scan'`);
      for (let i = 0; i < MAX_PROSPECT_FEED_QUEUE; i += 1) {
        await store.enqueueJob({
          priority: "heavy",
          kind: "prospect_scan",
          payload: { prospectId: i + 1 },
        });
      }
      const saturated = await runProspectNpmFeed({
        store,
        npm: stubFeedNpm({
          names,
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      expect(saturated).toEqual({ checked: 0, queued: 0, skipped: "prospect_queue" });
      expect(names).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("does not search GitHub when scheduled discovery has no token", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const result = await runScheduledProspectDiscovery({
        store,
        maxAssetBytes: 1024,
      });
      expect(result).toEqual({
        repositories: 0,
        found: 0,
        queued: 0,
        existing: 0,
        errors: [],
        skipped: "no_token",
      });
    } finally {
      await sql.close();
    }
  });

  it("lets the owner POST the feed and rejects a customer session", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedCompleteNpmProspect(store, {
        packageName: "prettier",
        version: "3.9.6",
        tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const app = createApp({
        config: loadConfig({
          adminToken: "owner-only-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "test-session",
        }),
        store,
        github: unusedGithub(),
        npm: stubFeedNpm({
          packs: {
            prettier: feedPack({
              version: "3.9.7",
              distTags: { latest: "3.9.7" },
              tarballUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.7.tgz",
            }),
          },
        }),
      });
      const customer = `ns_session=${signSession("test-session", await store.createSession("customer-1"))}`;
      const owner = `ns_session=${signSession("test-session", await store.createSession("owner-1"))}`;

      const denied = await app.request("/api/internal/prospects/feed", {
        method: "POST",
        headers: { cookie: customer },
      });
      expect(denied.status).toBe(401);

      const allowed = await app.request("/api/internal/prospects/feed", {
        method: "POST",
        headers: { cookie: owner },
      });
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ checked: 1, queued: 1 });
    } finally {
      await sql.close();
    }
  });
});
