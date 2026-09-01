import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { setupPullRequestBody, setupWorkflowYaml } from "../src/server/setup-workflow.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(root, "fixtures/sourcemap.tgz");

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

async function waitUntil(fn: () => Promise<boolean>, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
}

describe("generated setup workflow", () => {
  it("is reviewable, never auto-merged, and only gates packed artifacts", () => {
    const yaml = setupWorkflowYaml();
    expect(yaml).toContain("never merged automatically");
    expect(yaml).toContain("package.tgz");
    expect(yaml).toContain("dist/*.tgz");
    expect(yaml).toContain("dist/*.zip");
    expect(yaml).toContain("dist/*.asar");
    expect(yaml).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches/);
    const body = setupPullRequestBody();
    expect(body).toContain("**not** merged automatically");
    expect(body).toContain("packed");
    expect(body).toContain("Do **not** grant Administration");
    expect(body).toContain("Optionally mark the **NoSpoilers** check as required");
  });

  it("never calls the GitHub merge API", async () => {
    const source = await readFile(path.join(root, "src/server/github.ts"), "utf8");
    expect(source).not.toMatch(/\/merge\b/);
    expect(source).not.toMatch(/mergePullRequest|merge_pull|putMerge|POST merge/i);
    expect(source).toContain("createSetupPullRequest");
  });
});

describe("setup workflow and PR APIs", () => {
  it("returns YAML to the owning member and 401 when anonymous", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
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
        github: mockGithub(),
      });
      const anon = await app.request("/api/repos/99/setup-workflow");
      expect(anon.status).toBe(401);

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const owned = await app.request("/api/repos/99/setup-workflow", { headers: { cookie } });
      expect(owned.status).toBe(200);
      const body = (await owned.json()) as { workflow: string; path: string };
      expect(body.path).toBe(".github/workflows/nospoilers.yml");
      expect(body.workflow).toContain("never merged automatically");
      expect(body.workflow).toContain("packed artifact");
    } finally {
      await sql.close();
    }
  });

  it("opens a reviewable setup PR and never reports it merged", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      let opened = 0;
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
        github: mockGithub({
          createSetupPullRequest: async () => {
            opened += 1;
            return {
              htmlUrl: "https://github.com/octo/throwaway/pull/12",
              number: 12,
              existing: false,
            };
          },
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const created = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie },
      });
      expect(created.status).toBe(201);
      expect(opened).toBe(1);
      const body = (await created.json()) as {
        ok: boolean;
        htmlUrl: string;
        number: number;
        existing: boolean;
        merged: boolean;
      };
      expect(body.ok).toBe(true);
      expect(body.htmlUrl).toContain("/pull/12");
      expect(body.number).toBe(12);
      expect(body.existing).toBe(false);
      expect(body.merged).toBe(false);
    } finally {
      await sql.close();
    }
  });

  it("returns 409 with copy-paste YAML when GitHub write is denied", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
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
        github: mockGithub({
          createSetupPullRequest: async () => ({
            skipped: "permission",
            reason: "Grant Contents write and Pull requests write to open a setup PR. Do not grant Administration.",
          }),
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const denied = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie },
      });
      expect(denied.status).toBe(409);
      const body = (await denied.json()) as {
        skipped: string;
        reason: string;
        workflow: string;
      };
      expect(body.skipped).toBe("permission");
      expect(body.reason).toContain("Do not grant Administration");
      expect(body.workflow).toContain("never merged automatically");
      expect(body.workflow).toContain("package.tgz");
    } finally {
      await sql.close();
    }
  });

  it("hides another tenant's repo and refuses unpaid writes", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
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
        github: mockGithub({
          createSetupPullRequest: async () => {
            throw new Error("must not open a PR for another tenant");
          },
        }),
      });
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const hidden = await app.request("/api/repos/99/setup-workflow", { headers: { cookie: other } });
      expect(hidden.status).toBe(403);
      const hiddenPr = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(hiddenPr.status).toBe(403);
      const missing = await app.request("/api/repos/404404/setup-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(missing.status).toBe(404);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const owner = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const unpaid = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: owner },
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});

describe("release_scan GitHub Checks", () => {
  it("posts a failing check with MAP annotations and still finishes if Checks write is skipped", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const bytes = await readFile(FIXTURE);
      const checks: Array<{
        conclusion: string;
        title: string;
        annotations?: { title?: string; path: string }[];
      }> = [];
      const worker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/1",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async () => "a".repeat(40),
          createCheckRun: async (_installationId, _owner, _repo, input) => {
            checks.push(input);
            return { id: 88, htmlUrl: "https://github.com/octo/throwaway/runs/88" };
          },
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 1,
          tag: "phase1-fixture",
          targetCommitish: "main",
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
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ status: string }>("SELECT status FROM jobs");
        return rows[0]?.status === "done";
      }, "first release_scan");
      await worker.stop();
      expect(checks).toHaveLength(1);
      expect(checks[0]?.conclusion).toBe("failure");
      expect(checks[0]?.title).not.toContain("allowed to ship");
      const rules = (checks[0]?.annotations ?? []).map((row) => row.title);
      expect(rules.some((rule) => rule?.startsWith("MAP-"))).toBe(true);

      const skippedWorker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 2,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/2",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async () => "b".repeat(40),
          createCheckRun: async () => ({
            skipped: "permission",
            reason: "Grant Checks write to report release scans. Do not grant Administration.",
          }),
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 2,
          tag: "phase1-fixture-2",
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
      await skippedWorker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM jobs WHERE status = 'done'`,
        );
        return Number(rows[0]?.n) === 2;
      }, "skipped check still done");
      await skippedWorker.stop();
      const { rows: alerts } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM alerts");
      expect(Number(alerts[0]?.n)).toBeGreaterThanOrEqual(2);
    } finally {
      await sql.close();
    }
  });
});
