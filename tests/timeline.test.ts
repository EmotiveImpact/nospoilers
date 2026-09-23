import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { TIMELINE_DAYS } from "../src/server/timeline.ts";

const SECRET = "test-webhook-secret";

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

function appFor(store: ReturnType<typeof createStore>) {
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
    github: unusedGithub(),
  });
}

describe("90-day timeline", () => {
  it("lists this install's recent alerts and events, hides other tenants, and skips rows older than 90 days", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "acme",
        accountType: "Organization",
        accountId: 2,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(8, "u1");
      await store.linkUserInstallation(11, "u2");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });

      const recentId = await store.insertAlert({
        installationId: 7,
        repoId: 99,
        kind: "repo_created_public",
        title: "octo/throwaway was created public",
        body: "A public create event. Values are not stored.",
      });
      await store.acknowledgeAlertForUser(recentId, "u1", "octo");

      const oldId = await store.insertAlert({
        installationId: 7,
        kind: "repo_publicized",
        title: "octo/old flipped to public",
        body: "Too old for the timeline.",
      });
      await sql.query(`UPDATE alerts SET created_at = now() - interval '100 days' WHERE id = $1`, [
        oldId,
      ]);

      const futureId = await store.insertAlert({
        installationId: 7,
        kind: "repo_publicized",
        title: "octo/future event",
        body: "This clock-skewed row must not appear before it happens.",
      });
      await sql.query(`UPDATE alerts SET created_at = now() + interval '1 day' WHERE id = $1`, [
        futureId,
      ]);

      const siblingId = await store.insertAlert({
        installationId: 8,
        kind: "fork",
        title: "acme/app was forked",
        body: "Sibling org.",
      });
      expect(siblingId).toBeGreaterThan(0);

      const otherId = await store.insertAlert({
        installationId: 11,
        kind: "member_added",
        title: "other/app added a collaborator",
        body: "Other tenant.",
      });
      expect(otherId).toBeGreaterThan(0);

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const anon = await app.request("/api/timeline");
      expect(anon.status).toBe(401);

      const missing = await app.request("/api/timeline", { headers: { cookie } });
      expect(missing.status).toBe(400);

      const stolen = await app.request("/api/timeline?installationId=7", {
        headers: { cookie: other },
      });
      expect(stolen.status).toBe(200);
      const stolenBody = (await stolen.json()) as { entries: unknown[] };
      expect(stolenBody.entries).toEqual([]);

      const owned = await app.request("/api/timeline?installationId=7", { headers: { cookie } });
      expect(owned.status).toBe(200);
      const body = (await owned.json()) as {
        days: number;
        entries: {
          type: string;
          title: string | null;
          action: string | null;
          fullName: string | null;
          repoId: number | null;
          inventedIncident: boolean | null;
        }[];
      };
      expect(body.days).toBe(TIMELINE_DAYS);
      expect(JSON.stringify(body)).not.toContain("ghu_");
      expect(JSON.stringify(body)).not.toContain("Other tenant");
      expect(JSON.stringify(body)).not.toContain("Sibling org");
      expect(JSON.stringify(body)).not.toContain("Too old for the timeline");
      expect(JSON.stringify(body)).not.toContain("future event");
      expect(body.entries.some((row) => row.type === "alert" && row.title?.includes("created public"))).toBe(
        true,
      );
      expect(body.entries.some((row) => row.type === "alert_event" && row.action === "acknowledged")).toBe(
        true,
      );
      expect(body.entries.some((row) => row.fullName === "octo/throwaway")).toBe(true);
      expect(body.entries.some((row) => row.type === "alert" && row.repoId === 99)).toBe(true);
      expect(body.entries.some((row) => row.title?.includes("old flipped"))).toBe(false);
    } finally {
      await sql.close();
    }
  });

  it("returns 403 for Solo and 402 when coverage has ended", async () => {
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
      await store.upsertInstallation({
        id: 9,
        accountLogin: "acme",
        accountType: "Organization",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u1");
      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 9`,
      );

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const solo = await app.request("/api/timeline?installationId=7", { headers: { cookie } });
      expect(solo.status).toBe(403);
      const unpaid = await app.request("/api/timeline?installationId=9", { headers: { cookie } });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});
