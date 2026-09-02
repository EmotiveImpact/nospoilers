import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import {
  ADMINISTRATION_DENIED,
  deletePackAssetsConfirm,
  makePrivateConfirm,
  parseWorkflowPath,
  workflowIsNoSpoilersScan,
} from "../src/server/github-response.ts";
import { CONFIRM_MISMATCH_ERROR, CONFIRM_MISSING_ERROR } from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { GITHUB_SUSPENDED_ERROR } from "../src/server/install-health.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import { SETUP_WORKFLOW_PATH } from "../src/server/setup-workflow.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
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

function appFor(store: ReturnType<typeof createStore>, github: GithubPort = mockGithub()) {
  return createApp({
    config: loadConfig({
      databaseUrl: "pglite://:memory:",
      githubWebhookSecret: SECRET,
      githubAppId: "1",
      githubPrivateKey: "x",
      githubClientId: "c",
      githubClientSecret: "s",
      sessionSecret: "sess",
    }),
    store,
    github,
  });
}

function secretsLeak(value: unknown): string {
  return JSON.stringify(value);
}

async function seedOwner(sql: Awaited<ReturnType<typeof openSql>>, privateRepo = false) {
  const store = createStore(sql, { tokenSecret: "sess" });
  await store.upsertUser({ id: "u1", login: "octo" });
  await store.upsertUser({ id: "u2", login: "teammate" });
  await store.upsertUser({ id: "u3", login: "other" });
  await store.upsertInstallation({
    id: 7,
    accountLogin: "octo",
    accountType: "User",
    accountId: 1,
  });
  await store.upsertInstallation({
    id: 8,
    accountLogin: "acme",
    accountType: "Organization",
    accountId: 2,
  });
  await store.linkUserInstallation(7, "u1");
  await store.linkUserInstallation(7, "u2");
  await store.linkUserInstallation(8, "u3");
  await store.upsertRepo({
    id: 99,
    installationId: 7,
    owner: "octo",
    name: "app",
    fullName: "octo/app",
    private: privateRepo,
    htmlUrl: "https://github.com/octo/app",
  });
  const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
  const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
  const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
  return { store, cookie, memberCookie, otherCookie };
}

describe("GitHub response helpers", () => {
  it("parses workflow paths and refuses the NoSpoilers scanner", () => {
    expect(parseWorkflowPath(".github/workflows/release.yml")).toBe(".github/workflows/release.yml");
    expect(parseWorkflowPath("/.github/workflows/release.yaml")).toBe(".github/workflows/release.yaml");
    expect(parseWorkflowPath(".github/workflows/../secret.yml")).toBeNull();
    expect(parseWorkflowPath(".github/workflows/nested/dir.yml")).toBeNull();
    expect(parseWorkflowPath("release.yml")).toBeNull();
    expect(workflowIsNoSpoilersScan(SETUP_WORKFLOW_PATH)).toBe(true);
    expect(workflowIsNoSpoilersScan(".github/workflows/release.yml")).toBe(false);
    expect(makePrivateConfirm("octo/app")).not.toBe(deletePackAssetsConfirm("octo/app"));
  });

  it("keeps Administration off the setup PR path and Watch copy", () => {
    const github = readFileSync("src/server/github.ts", "utf8");
    expect(github).toMatch(/async makeRepoPrivate[\s\S]*hasWrite\(install\.permissions \?\? \{\}, "administration"\)/);
    expect(github).toMatch(
      /async deleteLatestPackAssets[\s\S]*hasWrite\(install\.permissions \?\? \{\}, "administration"\)/,
    );
    expect(github).toMatch(/async disableWorkflow[\s\S]*hasWrite\(install\.permissions \?\? \{\}, "administration"\)/);
    expect(ADMINISTRATION_DENIED).toMatch(/Contents write is not enough/);
    const page = readFileSync("src/pages/WatchPage.tsx", "utf8");
    expect(page).toMatch(/Make private/);
    expect(page).toMatch(/Remove pack assets/);
    expect(page).toMatch(/Disable workflow/);
    expect(page).toMatch(/do not need Administration/);
    expect(page).toMatch(/No invented incident/);
    expect(page).toMatch(/\.github\/workflows\/release\.yml/);
  });
});

describe("Watch GitHub response APIs", () => {
  it("returns copy without secrets and 409s until Administration, without writing GitHub or audit", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const { store, cookie } = await seedOwner(sql);
      let writes = 0;
      const app = appFor(
        store,
        mockGithub({
          getInstallation: async () => ({
            id: 7,
            account: { login: "octo", type: "User", id: 1 },
            suspended_at: null,
            permissions: { contents: "write", metadata: "read" },
          }),
          makeRepoPrivate: async () => {
            writes += 1;
            return { skipped: "permission", reason: ADMINISTRATION_DENIED };
          },
          deleteLatestPackAssets: async () => {
            writes += 1;
            return { skipped: "permission", reason: ADMINISTRATION_DENIED };
          },
          disableWorkflow: async () => {
            writes += 1;
            return { skipped: "permission", reason: ADMINISTRATION_DENIED };
          },
        }),
      );

      const anon = await app.request("/api/repos/99/github-response");
      expect(anon.status).toBe(401);

      const meta = await app.request("/api/repos/99/github-response", { headers: { cookie } });
      expect(meta.status).toBe(200);
      const metaBody = (await meta.json()) as {
        administrationGranted: boolean;
        confirm: { makePrivate: string; deletePackAssets: string };
        reason: string;
      };
      expect(metaBody.administrationGranted).toBe(false);
      expect(metaBody.confirm.makePrivate).toBe("octo/app");
      expect(metaBody.confirm.deletePackAssets).toBe("delete pack assets on octo/app");
      expect(metaBody.reason).toBe(ADMINISTRATION_DENIED);
      expect(secretsLeak(metaBody)).not.toMatch(/ghp_|sk_live|BEGIN RSA|DATABASE_URL|postgres:\/\//i);

      const make = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(make.status).toBe(409);
      const makeBody = (await make.json()) as { skipped?: string; reason?: string };
      expect(makeBody.skipped).toBe("permission");
      expect(makeBody.reason).toBe(ADMINISTRATION_DENIED);
      expect(writes).toBe(1);

      const assets = await app.request("/api/repos/99/delete-pack-assets", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "delete pack assets on octo/app" }),
      });
      expect(assets.status).toBe(409);
      expect(writes).toBe(2);

      const workflow = await app.request("/api/repos/99/disable-workflow", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          confirm: ".github/workflows/release.yml",
          workflow: ".github/workflows/release.yml",
        }),
      });
      expect(workflow.status).toBe(409);
      expect(writes).toBe(3);

      expect(await store.listAuditEventsForUser("u1", 7)).toEqual([]);
      expect(await store.listAlertsForUser("u1", 7)).toEqual([]);
      const repo = await store.getRepo(99);
      expect(repo?.private).toBe(false);
    } finally {
      await sql.close();
    }
  });

  it("rejects typed-confirm mismatches, the scanner workflow, members, other tenants, unpaid, and suspend without GitHub writes", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const { store, cookie, memberCookie, otherCookie } = await seedOwner(sql);
      let writes = 0;
      const denyWrite = async (): Promise<never> => {
        writes += 1;
        throw new Error("GitHub mock: unexpected call");
      };
      const app = appFor(
        store,
        mockGithub({
          makeRepoPrivate: denyWrite,
          deleteLatestPackAssets: denyWrite,
          disableWorkflow: denyWrite,
        }),
      );

      const missing = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({}),
      });
      expect(missing.status).toBe(400);
      expect(((await missing.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const mismatch = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "delete pack assets on octo/app" }),
      });
      expect(mismatch.status).toBe(400);
      expect(((await mismatch.json()) as { error: string }).error).toBe(CONFIRM_MISMATCH_ERROR);

      const wrongAsset = await app.request("/api/repos/99/delete-pack-assets", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(wrongAsset.status).toBe(400);

      const scanner = await app.request("/api/repos/99/disable-workflow", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          confirm: SETUP_WORKFLOW_PATH,
          workflow: SETUP_WORKFLOW_PATH,
        }),
      });
      expect(scanner.status).toBe(400);
      expect(((await scanner.json()) as { error: string }).error).toMatch(/NoSpoilers packed scan/);

      const member = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(member.status).toBe(403);
      expect(((await member.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const memberGet = await app.request("/api/repos/99/github-response", {
        headers: { cookie: memberCookie },
      });
      expect(memberGet.status).toBe(200);

      const other = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(other.status).toBe(403);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaidGet = await app.request("/api/repos/99/github-response", { headers: { cookie } });
      expect(unpaidGet.status).toBe(200);
      const unpaid = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(unpaid.status).toBe(402);
      expect(secretsLeak(await unpaid.json())).not.toMatch(/ghp_|BEGIN RSA|DATABASE_URL/i);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
        suspended: true,
      });
      const suspended = await app.request("/api/repos/99/delete-pack-assets", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "delete pack assets on octo/app" }),
      });
      expect(suspended.status).toBe(409);
      expect(((await suspended.json()) as { error: string }).error).toBe(GITHUB_SUSPENDED_ERROR);

      expect(writes).toBe(0);
      expect(await store.listAuditEventsForUser("u1", 7)).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("writes audit and a confirmed Watch alert when Administration is mocked, and sets private", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const { store, cookie } = await seedOwner(sql, false);
      const app = appFor(
        store,
        mockGithub({
          makeRepoPrivate: async () => ({ ok: true, detail: "Made octo/app private." }),
          deleteLatestPackAssets: async () => ({
            ok: true,
            detail: "Removed sourcemap.tgz from octo/app phase1-fixture.",
            names: ["sourcemap.tgz"],
          }),
          disableWorkflow: async () => ({
            ok: true,
            detail: "Disabled .github/workflows/release.yml on octo/app.",
            names: [".github/workflows/release.yml"],
          }),
        }),
      );

      const made = await app.request("/api/repos/99/make-private", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "octo/app" }),
      });
      expect(made.status).toBe(200);
      const madeBody = (await made.json()) as { ok: boolean; private: boolean; detail: string };
      expect(madeBody.ok).toBe(true);
      expect(madeBody.private).toBe(true);
      expect(secretsLeak(madeBody)).not.toMatch(/ghp_|BEGIN RSA|DATABASE_URL/i);
      expect((await store.getRepo(99))?.private).toBe(true);

      const assets = await app.request("/api/repos/99/delete-pack-assets", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: "delete pack assets on octo/app" }),
      });
      expect(assets.status).toBe(200);

      const workflow = await app.request("/api/repos/99/disable-workflow", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          confirm: ".github/workflows/release.yml",
          workflow: ".github/workflows/release.yml",
        }),
      });
      expect(workflow.status).toBe(200);

      const audit = await store.listAuditEventsForUser("u1", 7);
      expect(audit.map((row) => row.action).sort()).toEqual([
        "repo.delete_pack_assets",
        "repo.disable_workflow",
        "repo.make_private",
      ]);
      const alerts = await store.listAlertsForUser("u1", 7);
      expect(alerts.map((row) => row.kind).sort()).toEqual([
        "release_assets_removed",
        "repo_made_private",
        "workflow_disabled",
      ]);
      expect(alerts.every((row) => /not a discovered incident/i.test(row.body))).toBe(true);
      expect(JSON.stringify(alerts)).not.toMatch(/ghp_|sk_live|BEGIN RSA|this-is-the-plot-twist/);
    } finally {
      await sql.close();
    }
  });
});
