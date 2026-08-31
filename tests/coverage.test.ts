import { describe, expect, it } from "vitest";
import { coverageFrom, coverageFromQuery } from "../src/coverage.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { migrate, openSql } from "../src/server/sql.ts";
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

describe("coverageFromQuery", () => {
  it("maps ?as=trial and ?as=ended", () => {
    expect(coverageFromQuery("?as=trial")?.status).toBe("trial");
    expect(coverageFromQuery("?as=ended")?.status).toBe("ended");
    expect(coverageFromQuery("")).toBeNull();
  });
});

describe("hosted coverage", () => {
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
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
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

  it("still scans for an anonymous request", async () => {
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
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
        },
      });
      const scan = await app.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      expect(scan.status).toBe(200);
      const body = (await scan.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    } finally {
      await sql.close();
    }
  });
});
