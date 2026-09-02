import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  REMEDIATION_BRANCH,
  REMEDIATION_PERMISSIONS,
  remediationBundle,
  remediationCommitWrites,
  remediationPackageFilesSnippet,
  remediationPolicyYaml,
  remediationPullRequestBody,
  remediationWrites,
} from "../src/server/remediation.ts";
import { SETUP_ACTION_PATH, SETUP_WORKFLOW_PATH } from "../src/server/setup-workflow.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

async function seedRepo(
  store: ReturnType<typeof createStore>,
  input: { userId: string; login: string; installationId: number; repoId: number },
) {
  await store.upsertUser({ id: input.userId, login: input.login });
  await store.upsertInstallation({
    id: input.installationId,
    accountLogin: input.login,
    accountType: "User",
    accountId: input.installationId,
  });
  await store.linkUserInstallation(input.installationId, input.userId);
  await store.upsertRepo({
    id: input.repoId,
    installationId: input.installationId,
    owner: input.login,
    name: "throwaway",
    fullName: `${input.login}/throwaway`,
    private: true,
    htmlUrl: `https://github.com/${input.login}/throwaway`,
  });
}

describe("generated remediation files", () => {
  it("is additive, reviewable, never auto-merged, and does not allowlist criticals", () => {
    const files = remediationBundle();
    const paths = files.map((file) => file.path);
    expect(paths).toContain(".gitignore");
    expect(paths).toContain(".npmignore");
    expect(paths).toContain(".nospoilers.yml");
    expect(paths).toContain(".nospoilers/bundler-hints.md");
    expect(paths).toContain(".nospoilers/package-files.snippet.json");
    expect(paths).toContain(SETUP_WORKFLOW_PATH);
    expect(paths).toContain(SETUP_ACTION_PATH);

    const gitignore = files.find((file) => file.path === ".gitignore")?.content ?? "";
    expect(gitignore).toContain("never merged automatically");
    expect(gitignore).toContain("*.map");
    expect(gitignore).toContain(".env");

    const policy = remediationPolicyYaml();
    expect(policy).toMatch(/^version:\s*1$/m);
    expect(policy).toMatch(/^strict:\s*false$/m);
    expect(policy).not.toMatch(/^\s*-\s+rule:/m);
    expect(policy).not.toMatch(/^allow:/m);
    expect(policy.toLowerCase()).toContain("empty policy");

    const snippet = JSON.parse(remediationPackageFilesSnippet()) as { files: string[] };
    expect(snippet.files).not.toContain("*.map");
    expect(snippet.files).not.toContain(".env");

    const body = remediationPullRequestBody();
    expect(body).toContain("**not** merged automatically");
    expect(body).toContain("Do **not** grant Administration");
    expect(body).toContain("does **not** make the repository private");
    expect(body).toContain("does not request Workflows write");
    expect(body).toContain("empty");
    expect(remediationCommitWrites([], false).map((file) => file.path)).not.toContain(
      SETUP_WORKFLOW_PATH,
    );
    expect(remediationCommitWrites([], false).map((file) => file.path)).toContain(SETUP_ACTION_PATH);
    expect(remediationCommitWrites([], true).map((file) => file.path)).toContain(SETUP_WORKFLOW_PATH);
  });

  it("does not overwrite customer ignore, policy, or workflow files", () => {
    const writes = remediationWrites([
      ".gitignore",
      ".npmignore",
      ".nospoilers.yml",
      SETUP_WORKFLOW_PATH,
      SETUP_ACTION_PATH,
    ]);
    const paths = writes.map((file) => file.path);
    expect(paths).not.toContain(".gitignore");
    expect(paths).not.toContain(".npmignore");
    expect(paths).not.toContain(".nospoilers.yml");
    expect(paths).not.toContain(SETUP_WORKFLOW_PATH);
    expect(paths).not.toContain(SETUP_ACTION_PATH);
    expect(paths).toContain(".nospoilers/gitignore.append");
    expect(paths).toContain(".nospoilers/npmignore.append");
    expect(paths).toContain(".nospoilers/bundler-hints.md");
  });

  it("never calls the GitHub merge API", async () => {
    const source = await readFile(path.join(root, "src/server/github.ts"), "utf8");
    expect(source).not.toMatch(/\/merge\b/);
    expect(source).not.toMatch(/mergePullRequest|merge_pull|putMerge|POST merge/i);
    expect(source).toContain("createRemediationPullRequest");
    expect(source).toContain("REMEDIATION_BRANCH");
    expect(REMEDIATION_BRANCH).toBe("nospoilers/remediate");
  });
});

describe("remediation PR APIs", () => {
  it("returns the file bundle and required permissions to the owning member", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedRepo(store, { userId: "u1", login: "octo", installationId: 7, repoId: 99 });
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
      const anon = await app.request("/api/repos/99/remediation");
      expect(anon.status).toBe(401);

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const owned = await app.request("/api/repos/99/remediation", { headers: { cookie } });
      expect(owned.status).toBe(200);
      const body = (await owned.json()) as {
        branch: string;
        files: { path: string; content: string }[];
        permissions: string[];
        merged: boolean;
      };
      expect(body.branch).toBe(REMEDIATION_BRANCH);
      expect(body.merged).toBe(false);
      expect(body.permissions).toEqual([...REMEDIATION_PERMISSIONS]);
      expect(body.permissions.some((row) => row.includes("Administration"))).toBe(true);
      expect(body.files.some((file) => file.path === ".nospoilers.yml")).toBe(true);
      expect(body.files.some((file) => file.content.includes("never merged automatically"))).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("opens a reviewable remediation PR and never reports it merged", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedRepo(store, { userId: "u1", login: "octo", installationId: 7, repoId: 99 });
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
          createRemediationPullRequest: async () => {
            opened += 1;
            return {
              htmlUrl: "https://github.com/octo/throwaway/pull/21",
              number: 21,
              existing: false,
            };
          },
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const created = await app.request("/api/repos/99/remediation-pr", {
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
      expect(body.htmlUrl).toContain("/pull/21");
      expect(body.number).toBe(21);
      expect(body.existing).toBe(false);
      expect(body.merged).toBe(false);
    } finally {
      await sql.close();
    }
  });

  it("returns 409 with copy-paste files when GitHub write is denied", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedRepo(store, { userId: "u1", login: "octo", installationId: 7, repoId: 99 });
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
          createRemediationPullRequest: async () => ({
            skipped: "permission",
            reason:
              "Grant Contents write and Pull requests write to open a remediation PR. Do not grant Administration.",
          }),
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const denied = await app.request("/api/repos/99/remediation-pr", {
        method: "POST",
        headers: { cookie },
      });
      expect(denied.status).toBe(409);
      const body = (await denied.json()) as {
        skipped: string;
        reason: string;
        files: { path: string; content: string }[];
        permissions: string[];
        merged: boolean;
      };
      expect(body.skipped).toBe("permission");
      expect(body.reason).toContain("Do not grant Administration");
      expect(body.merged).toBe(false);
      expect(body.permissions).toEqual([...REMEDIATION_PERMISSIONS]);
      expect(body.files.some((file) => file.path === ".gitignore")).toBe(true);
      expect(body.files.some((file) => file.content.includes("*.map"))).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("hides another tenant's repo, refuses unpaid writes, and returns 409 when GitHub is suspended", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await seedRepo(store, { userId: "u1", login: "octo", installationId: 7, repoId: 99 });
      await seedRepo(store, { userId: "u2", login: "other", installationId: 8, repoId: 100 });
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
          createRemediationPullRequest: async () => {
            throw new Error("must not open a PR for another tenant, unpaid, or suspended install");
          },
        }),
      });
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const hidden = await app.request("/api/repos/99/remediation", { headers: { cookie: other } });
      expect(hidden.status).toBe(403);
      const hiddenPr = await app.request("/api/repos/99/remediation-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(hiddenPr.status).toBe(403);
      const missing = await app.request("/api/repos/404404/remediation-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(missing.status).toBe(404);

      const owner = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 7,
        suspended: true,
      });
      const suspended = await app.request("/api/repos/99/remediation-pr", {
        method: "POST",
        headers: { cookie: owner },
      });
      expect(suspended.status).toBe(409);
      const suspendedBody = (await suspended.json()) as { error: string };
      expect(suspendedBody.error).toContain("suspended");

      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 7,
        suspended: false,
      });
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/repos/99/remediation-pr", {
        method: "POST",
        headers: { cookie: owner },
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});
