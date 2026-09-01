import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { githubSignature } from "../src/server/hmac.ts";
import {
  describeInstallHealth,
  namesFromRepoList,
} from "../src/server/install-health.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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
  const config = loadConfig({
    databaseUrl: "pglite://:memory:",
    githubWebhookSecret: SECRET,
    githubAppId: "1",
    githubPrivateKey: "x",
    githubClientId: "c",
    githubClientSecret: "s",
    sessionSecret: "sess",
  });
  return createApp({
    config,
    store,
    github: unusedGithub(),
  });
}

async function postWebhook(
  app: ReturnType<typeof createApp>,
  event: string,
  deliveryId: string,
  payload: unknown,
) {
  const body = JSON.stringify(payload);
  return await app.request("/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": githubSignature(SECRET, body),
    },
    body,
  });
}

const installation = {
  id: 7,
  account: { login: "octo", type: "User", id: 1 },
};

describe("install health copy", () => {
  it("explains GitHub suspend without calling it a billing or compromise event", () => {
    const described = describeInstallHealth({
      kind: "app_suspended",
      accountLogin: "octo",
    });
    expect(described.title).toContain("octo");
    expect(described.body.toLowerCase()).toContain("not a coverage or billing change");
    expect(described.body.toLowerCase()).not.toContain("compromis");
    expect(described.body.toLowerCase()).not.toContain("malware");
  });

  it("lists repository names from GitHub payloads", () => {
    expect(
      namesFromRepoList([{ full_name: "octo/app" }, { full_name: "octo/cli" }, { id: 1 }]),
    ).toEqual(["octo/app", "octo/cli"]);
  });
});

describe("installation health alerts", () => {
  it("records suspend, unsuspend, permission, and repository health alerts when covered", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      const app = appFor(store);
      await postWebhook(app, "installation", "d-create", {
        action: "created",
        installation,
        repositories: [{ id: 99, full_name: "octo/throwaway", private: true }],
      });
      await store.linkUserInstallation(7, "u1");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;

      const suspended = await postWebhook(app, "installation", "d-suspend", {
        action: "suspend",
        installation: { ...installation, suspended: true },
      });
      expect(suspended.status).toBe(200);
      expect(await store.installationWorkAllowed(7)).toBe(false);
      expect(await store.installationHasCoverage(7)).toBe(true);

      const me = await app.request("/api/me", { headers: { cookie } });
      const meBody = (await me.json()) as {
        coverage: { status: string };
        installations: { suspended: boolean }[];
      };
      expect(meBody.coverage.status).toBe("trial");
      expect(meBody.installations[0]?.suspended).toBe(true);

      const scan = await app.request("/api/repos/99/scan-latest-release", {
        method: "POST",
        headers: { cookie },
      });
      expect(scan.status).toBe(409);
      const scanBody = (await scan.json()) as { error: string };
      expect(scanBody.error).toMatch(/suspended/i);
      expect(scanBody.error.toLowerCase()).not.toContain("subscribe");

      const unsuspended = await postWebhook(app, "installation", "d-unsuspend", {
        action: "unsuspend",
        installation: { ...installation, suspended: false },
      });
      expect(unsuspended.status).toBe(200);
      expect(await store.installationWorkAllowed(7)).toBe(true);

      await postWebhook(app, "installation", "d-perms", {
        action: "new_permissions_accepted",
        installation,
      });
      await postWebhook(app, "installation_repositories", "d-repos", {
        action: "added",
        installation,
        repositories_added: [{ id: 100, full_name: "octo/new-pack", private: true }],
        repositories_removed: [{ id: 99, full_name: "octo/throwaway" }],
      });

      const replay = await postWebhook(app, "installation", "d-suspend", {
        action: "suspend",
        installation: { ...installation, suspended: true },
      });
      expect(replay.status).toBe(200);

      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; body: string }[] };
      const kinds = alertBody.alerts.map((row) => row.kind).sort();
      expect(kinds).toEqual([
        "app_permissions_updated",
        "app_suspended",
        "app_unsuspended",
        "repos_added",
        "repos_removed",
      ]);
      expect(alertBody.alerts.every((row) => !/compromis|malware/i.test(row.body))).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("does not alert when coverage has ended, and drops the tenant on uninstall", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const app = appFor(store);
      await postWebhook(app, "installation", "d-create", {
        action: "created",
        installation,
      });
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      await postWebhook(app, "installation", "d-suspend-unpaid", {
        action: "suspend",
        installation: { ...installation, suspended: true },
      });
      const { rows: alerts } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM alerts");
      expect(Number(alerts[0]?.n)).toBe(0);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      await postWebhook(app, "installation", "d-unsuspend-again", {
        action: "unsuspend",
        installation: { ...installation, suspended: false },
      });
      await store.enqueueJob({
        priority: "light",
        kind: "fork",
        payload: { installationId: 7, secret: "must-not-leak" },
      });
      const removed = await postWebhook(app, "installation", "d-deleted", {
        action: "deleted",
        installation,
      });
      expect(removed.status).toBe(200);
      const { rows: installs } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM installations",
      );
      const { rows: jobs } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM jobs");
      const { rows: leftoverAlerts } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM alerts",
      );
      expect(Number(installs[0]?.n)).toBe(0);
      expect(Number(jobs[0]?.n)).toBe(0);
      expect(Number(leftoverAlerts[0]?.n)).toBe(0);
    } finally {
      await sql.close();
    }
  });
});

describe("tenant job health", () => {
  it("lists this install's jobs without payloads or prospect scans, and hides other tenants", async () => {
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
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(9, "u2");
      await store.enqueueJob({
        priority: "light",
        kind: "fork",
        payload: { installationId: 7, token: "ghu_must_not_appear" },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: { installationId: 9, token: "ghu_other" },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 1, artifactUrl: "https://github.com/acme/app/releases/download/x/a.tgz" },
      });
      const failed = await store.enqueueJob({
        priority: "light",
        kind: "member_added",
        payload: { installationId: 7 },
      });
      await sql.query(
        `UPDATE jobs SET status = 'failed', error = 'boom', attempts = 2 WHERE id = $1`,
        [failed.id],
      );

      const app = appFor(store);
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;

      const anonymous = await app.request("/api/jobs");
      expect(anonymous.status).toBe(401);

      const mine = await app.request("/api/jobs", { headers: { cookie } });
      expect(mine.status).toBe(200);
      const mineBody = (await mine.json()) as {
        jobs: { kind: string; status: string; error?: string | null }[];
        summary: { queued: number; running: number; done: number; failed: number };
      };
      expect(JSON.stringify(mineBody)).not.toContain("ghu_must_not_appear");
      expect(JSON.stringify(mineBody)).not.toContain("ghu_other");
      expect(JSON.stringify(mineBody)).not.toMatch(/credit/i);
      expect(mineBody.summary).toEqual({
        queued: expect.any(Number),
        running: expect.any(Number),
        done: expect.any(Number),
        failed: expect.any(Number),
      });
      expect(mineBody.jobs.every((row) => row.kind !== "prospect_scan")).toBe(true);
      expect(mineBody.jobs.map((row) => row.kind).sort()).toEqual(["fork", "member_added"]);
      expect(mineBody.summary.failed).toBe(1);
      expect(mineBody.summary.queued).toBe(1);
      expect(mineBody.jobs.some((row) => row.status === "failed" && row.error === "boom")).toBe(true);

      const theirs = await app.request("/api/jobs", { headers: { cookie: other } });
      const theirsBody = (await theirs.json()) as { jobs: { kind: string }[] };
      expect(theirsBody.jobs.map((row) => row.kind)).toEqual(["release_scan"]);

      const patched = await app.request("/api/jobs/1", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      expect(patched.status).toBe(404);
    } finally {
      await sql.close();
    }
  });
});
