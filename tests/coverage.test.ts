import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { coverageFrom, bestCoverage } from "../src/coverage.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { createStore, signSession } from "../src/server/store.ts";

describe("coverageFrom", () => {
  it("treats a future trial_ends_at as trial", () => {
    const inElevenDays = new Date(Date.now() + 11 * 86_400_000).toISOString();
    const coverage = coverageFrom(inElevenDays, "trial");
    expect(coverage.status).toBe("trial");
    expect(coverage.daysLeft).toBe(11);
    expect(coverage.label).toContain("11 days left");
  });

  it("treats an expired trial as ended", () => {
    const coverage = coverageFrom("2000-01-01T00:00:00.000Z", null);
    expect(coverage.status).toBe("ended");
    expect(coverage.label).toBe("Coverage ended");
  });

  it("treats solo and team as active even if the trial date is in the past", () => {
    expect(coverageFrom("2000-01-01T00:00:00.000Z", "solo").status).toBe("active");
    expect(coverageFrom(null, "team").label).toBe("Team");
  });
});

describe("bestCoverage", () => {
  it("prefers an active plan over a trial or ended account", () => {
    expect(
      bestCoverage([
        coverageFrom("2000-01-01T00:00:00.000Z", null),
        coverageFrom(new Date(Date.now() + 86400000).toISOString(), "trial"),
        coverageFrom(null, "solo"),
      ]).status,
    ).toBe("active");
  });
});

describe("hosted coverage", () => {
  beforeEach(()=>vi.stubEnv('NOSPOILERS_INTERNAL_LOCAL_SCAN','1'));
  afterEach(()=>vi.unstubAllEnvs());
  it("returns 402 for a signed-in user whose trial has ended", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await sql.query(`UPDATE users SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE id = $1`, [
        "u1",
      ]);
      const sessionId = await store.createSession("u1");
      const config = loadConfig({
        githubWebhookSecret: "wh",
        githubAppId: "1",
        githubPrivateKey: "x",
        githubClientId: "c",
        githubClientSecret: "s",
        sessionSecret: "sess",
      });
      const app = createApp({
        config,
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
      });
      const cookie = `ns_session=${signSession("sess", sessionId)}`;
      const me = await app.request("/api/me", { headers: { cookie } });
      expect(me.status).toBe(200);
      const meBody = (await me.json()) as { coverage: { status: string } };
      expect(meBody.coverage.status).toBe("ended");

      const scan = await app.request("/api/scan", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      expect(scan.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("uses the GitHub installation billing account, not the user row", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await sql.query(`UPDATE users SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE id = $1`, [
        "u1",
      ]);
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
      const sessionId = await store.createSession("u1");
      const config = loadConfig({
        githubWebhookSecret: "wh",
        githubAppId: "1",
        githubPrivateKey: "x",
        githubClientId: "c",
        githubClientSecret: "s",
        sessionSecret: "sess",
      });
      const app = createApp({
        config,
        store,
        github: {
          exchangeCode: async () => {
            throw new Error("unused");
          },
          getUser: async () => {
            throw new Error("unused");
          },
          listUserInstallations: async () => [7],
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
      });
      const cookie = `ns_session=${signSession("sess", sessionId)}`;
      const me = await app.request("/api/me", { headers: { cookie } });
      const meBody = (await me.json()) as { coverage: { status: string } };
      expect(meBody.coverage.status).toBe("trial");

      const scan = await app.request("/api/scan?installationId=7", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      expect(scan.status).toBe(202);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      await sql.query(`UPDATE users SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE id = $1`, [
        "u1",
      ]);
      const endedMe = await app.request("/api/me", { headers: { cookie } });
      const endedBody = (await endedMe.json()) as { coverage: { status: string } };
      expect(endedBody.coverage.status).toBe("ended");
      const lockedScan = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(lockedScan.status).toBe(402);
    } finally {
      await sql.close();
    }
  });

  it("stages an anonymous request without returning scan evidence", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const config = loadConfig({
        githubWebhookSecret: "wh",
        sessionSecret: "sess",
      });
      const app = createApp({
        config,
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
      });
      const scan = await app.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      expect(scan.status).toBe(202);
      const body = (await scan.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ pending: true });
      expect(body).not.toHaveProperty("findings");
    } finally {
      await sql.close();
    }
  });
});
