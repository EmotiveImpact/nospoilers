import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { SETUP_ACTION_PATH, SETUP_BRANCH, SETUP_WORKFLOW_PATH } from "../src/server/setup-workflow.ts";
import {
  NOSPOILERS_CHECK_NAME,
  probeRepoSetupStatus,
  SETUP_STATUS_REQUIRED_UNKNOWN,
} from "../src/server/setup-status.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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
    pathExists: async () => false,
    listCheckRuns: async () => [],
    ...overrides,
  };
}

describe("setup status copy", () => {
  it("keeps Watch setup guidance off branch protection writes", () => {
    const page = readFileSync("src/components/watch/screens/SourcesScreen.tsx", "utf8") + readFileSync("src/watch/useWatchWorkspaceController.tsx", "utf8");
    expect(page).toMatch(/Setup status/);
    expect(page).toMatch(/cannot see whether a check is required/);
    expect(page).toMatch(/never invents an alert/);
    expect(page).not.toMatch(/set branch protection/);
  });
});

describe("setup status probe", () => {
  it("reports Action/workflow presence and a NoSpoilers check without inventing an incident", async () => {
    const paths: string[] = [];
    const status = await probeRepoSetupStatus(
      mockGithub({
        getRepo: async () => ({
          id: 99,
          name: "throwaway",
          full_name: "octo/throwaway",
          private: false,
          html_url: "https://github.com/octo/throwaway",
          owner: { login: "octo" },
          default_branch: "main",
        }),
        pathExists: async (_id, _owner, _repo, filePath, ref) => {
          paths.push(`${ref ?? "default"}:${filePath}`);
          return filePath === SETUP_ACTION_PATH && ref === SETUP_BRANCH;
        },
        getRefSha: async () => "abc123",
        listCheckRuns: async () => [
          {
            name: NOSPOILERS_CHECK_NAME,
            conclusion: "failure",
            htmlUrl: "https://github.com/octo/throwaway/runs/1",
          },
        ],
      }),
      { installationId: 7, owner: "octo", repo: "throwaway" },
    );
    expect(status.inventedIncident).toBe(false);
    expect(status.requiredCheck).toBe("unknown");
    expect(status.actionOnSetup).toBe(true);
    expect(status.actionOnDefault).toBe(false);
    expect(status.workflowOnDefault).toBe(false);
    expect(status.workflowOnSetup).toBe(false);
    expect(status.check).toEqual({
      name: NOSPOILERS_CHECK_NAME,
      conclusion: "failure",
      htmlUrl: "https://github.com/octo/throwaway/runs/1",
      ref: "abc123",
    });
    expect(status.detail).toContain(`vendored Action is on ${SETUP_BRANCH}`);
    expect(status.detail).toMatch(/workflow YAML is missing/i);
    expect(status.detail).toContain(SETUP_STATUS_REQUIRED_UNKNOWN);
    expect(paths).toEqual([
      `main:${SETUP_ACTION_PATH}`,
      `${SETUP_BRANCH}:${SETUP_ACTION_PATH}`,
      `main:${SETUP_WORKFLOW_PATH}`,
      `${SETUP_BRANCH}:${SETUP_WORKFLOW_PATH}`,
    ]);
  });
});

describe("setup status API", () => {
  it("is a signed-in Watch read: 401/404/403, unpaid still 200, never inserts an alert", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "member" });
      await store.upsertUser({ id: "u3", login: "other" });
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
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(9, "u3");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
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
          getRepo: async () => ({
            id: 99,
            name: "throwaway",
            full_name: "octo/throwaway",
            private: false,
            html_url: "https://github.com/octo/throwaway",
            owner: { login: "octo" },
            default_branch: "main",
          }),
          pathExists: async (_id, _owner, _repo, filePath, ref) =>
            filePath === SETUP_ACTION_PATH && ref === SETUP_BRANCH,
          getRefSha: async () => "def456",
          listCheckRuns: async () => [],
        }),
      });

      expect((await app.request("/api/repos/99/setup-status")).status).toBe(401);
      expect((await app.request("/api/repos/404/setup-status", {
        headers: { cookie: `ns_session=${signSession("sess", await store.createSession("u1"))}` },
      })).status).toBe(404);
      expect((await app.request("/api/repos/99/setup-status", {
        headers: { cookie: `ns_session=${signSession("sess", await store.createSession("u3"))}` },
      })).status).toBe(403);

      const member = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const probed = await app.request("/api/repos/99/setup-status", { headers: { cookie: member } });
      expect(probed.status).toBe(200);
      const body = (await probed.json()) as {
        status: { inventedIncident: false; actionOnSetup: boolean; check: null; requiredCheck: string };
      };
      expect(body.status.inventedIncident).toBe(false);
      expect(body.status.actionOnSetup).toBe(true);
      expect(body.status.check).toBeNull();
      expect(body.status.requiredCheck).toBe("unknown");

      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/repos/99/setup-status", {
        headers: { cookie: `ns_session=${signSession("sess", await store.createSession("u1"))}` },
      });
      expect(unpaid.status).toBe(200);
      const { rows } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM alerts");
      expect(Number(rows[0]?.n)).toBe(0);
    } finally {
      await sql.close();
    }
  });

  it("returns 503 when this instance cannot probe GitHub files", async () => {
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
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub({
          pathExists: undefined,
          listCheckRuns: undefined,
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const missing = await app.request("/api/repos/99/setup-status", { headers: { cookie } });
      expect(missing.status).toBe(503);
    } finally {
      await sql.close();
    }
  });
});
