import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, CONFIRM_MISSING_ERROR } from "../src/server/audit.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  PUBLIC_PAGE_ALREADY_ERROR,
  PUBLIC_PAGE_MISSING_ERROR,
  PUBLIC_PAGE_UNKNOWN_ERROR,
  PUBLIC_PAGE_UNPAID_ERROR,
  mintPublicToken,
  parsePublicToken,
  publicViewLeaksSecrets,
  publicVerifyPath,
} from "../src/server/release-public.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const DIRTY = path.resolve("fixtures/sourcemap.tgz");
const SECRET = "public-page-receipt-secret";
const json = { "content-type": "application/json" };

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

const publicLookup = async () => [{ address: "203.0.113.10", family: 4 }];

describe("public verification helpers", () => {
  it("mints unguessable tokens and rejects short or punctuated ones", () => {
    const token = mintPublicToken();
    expect(parsePublicToken(token)).toBe(token);
    expect(token).toHaveLength(32);
    expect(parsePublicToken("short")).toBeNull();
    expect(parsePublicToken("1")).toBeNull();
    expect(parsePublicToken(`${token}?next=1`)).toBeNull();
    expect(publicVerifyPath(token)).toBe(`/verify/${token}`);
    expect(AUDIT_ACTIONS).toContain("release.publish_verify");
    expect(AUDIT_ACTIONS).toContain("release.unpublish_verify");
    expect(
      publicViewLeaksSecrets({
        path: `/verify/${token}`,
        coordinate: "api:1#app.tgz",
        channel: "stable",
        artifactSha256: "aa".repeat(32),
        artifactSha512: null,
        artifactBytes: 12,
        mediaType: "application/gzip",
        sourceRevision: "v1",
        receiptStatus: "passed",
        mismatch: false,
        passingReceipt: true,
        approval: null,
        createdAt: "2026-09-02T00:00:00.000Z",
        deliveries: [{ host: "cdn.example.com", lastStatus: "matched", lastCheckedAt: null, lastSha256: null }],
      }),
    ).toBe(false);
  });
});

describe("customer-controlled public verification page", () => {
  it("publishes redacted pages, isolates tenants, and does not enqueue verify jobs", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "teammate" });
      await store.upsertUser({ id: "u3", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(11, "u3");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      let woke = 0;
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: SECRET,
        }),
        store,
        github: unusedGithub(),
        webhookLookup: publicLookup,
        wakeWorker: () => {
          woke += 1;
        },
      });

      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const sealed = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.0",
          "x-nospoilers-ci-run": "https://github.com/octo/app/actions/runs/12",
        },
        body: await readFileAsync(CLEAN),
      });
      expect(sealed.status).toBe(200);
      const sealedBody = (await sealed.json()) as {
        release: { id: number; coordinate: string; receiptStatus: string };
      };
      const releaseId = sealedBody.release.id;
      const coordinate = sealedBody.release.coordinate;

      const dirty = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.1",
        },
        body: await readFileAsync(DIRTY),
      });
      const dirtyBody = (await dirty.json()) as {
        release: { id: number; coordinate: string; receiptStatus: string };
      };
      expect(dirtyBody.release.receiptStatus).toBe("failed-policy");

      const attached = await app.request(`/api/releases/${releaseId}/locations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          url: "https://cdn.example.com/app.tgz?token=secret",
          installationId: 7,
        }),
      });
      expect(attached.status).toBe(201);
      const jobsAfterAttach = await sql.query<{ n: unknown }>(`SELECT count(*)::int AS n FROM jobs`);
      const attachJobCount = Number(jobsAfterAttach.rows[0]?.n ?? 0);
      expect(attachJobCount).toBeGreaterThan(0);
      const wokeAfterAttach = woke;

      expect((await app.request(`/api/releases/${releaseId}/public`, { method: "POST" })).status).toBe(
        401,
      );
      const missingConfirm = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: true }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const memberPublish = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: coordinate }),
      });
      expect(memberPublish.status).toBe(403);

      const stolen = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: coordinate }),
      });
      expect(stolen.status).toBe(404);

      const published = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: coordinate }),
      });
      expect(published.status).toBe(201);
      const publishedBody = (await published.json()) as {
        publicPage: { enabled: boolean; path: string };
      };
      expect(publishedBody.publicPage.enabled).toBe(true);
      expect(publishedBody.publicPage.path.startsWith("/verify/")).toBe(true);
      const token = publishedBody.publicPage.path.slice("/verify/".length);
      expect(parsePublicToken(token)).toBe(token);
      expect(token).not.toBe(String(releaseId));

      const again = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: coordinate }),
      });
      expect(again.status).toBe(409);
      expect(((await again.json()) as { error: string }).error).toBe(PUBLIC_PAGE_ALREADY_ERROR);

      const listed = await app.request("/api/releases", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        releases: { id: number; publicPage: { enabled: boolean; path: string } | null }[];
      };
      expect(listedBody.releases.find((row) => row.id === releaseId)?.publicPage?.path).toBe(
        publishedBody.publicPage.path,
      );

      const memberList = await app.request("/api/releases", { headers: { cookie: memberCookie } });
      expect(memberList.status).toBe(200);
      const memberListBody = (await memberList.json()) as {
        releases: { id: number; publicPage: { path: string } | null }[];
      };
      expect(memberListBody.releases.find((row) => row.id === releaseId)?.publicPage?.path).toBe(
        publishedBody.publicPage.path,
      );

      const page = await app.request(`/api/verify/${token}`);
      expect(page.status).toBe(200);
      const pageBody = (await page.json()) as {
        verification: {
          coordinate: string;
          artifactSha256: string;
          receiptStatus: string;
          passingReceipt: boolean;
          deliveries: { host: string; lastStatus: string | null }[];
          path: string;
        };
      };
      expect(pageBody.verification.coordinate).toBe(coordinate);
      expect(pageBody.verification.passingReceipt).toBe(true);
      expect(pageBody.verification.receiptStatus).toBe("passed");
      expect(pageBody.verification.deliveries[0]?.host).toBe("cdn.example.com");
      const serialized = JSON.stringify(pageBody);
      expect(serialized).not.toContain("token=secret");
      expect(serialized).not.toContain("github.com/octo/app/actions");
      expect(serialized).not.toContain("?");
      expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(pageBody.verification.path).toBe(publishedBody.publicPage.path);

      const jobsAfterRead = await sql.query<{ n: unknown }>(`SELECT count(*)::int AS n FROM jobs`);
      expect(Number(jobsAfterRead.rows[0]?.n ?? 0)).toBe(attachJobCount);
      expect(woke).toBe(wokeAfterAttach);

      expect((await app.request("/api/verify/short")).status).toBe(404);
      expect((await app.request("/api/verify/1")).status).toBe(404);
      const missing = await app.request(`/api/verify/${mintPublicToken()}`);
      expect(missing.status).toBe(404);
      expect(((await missing.json()) as { error: string }).error).toBe(PUBLIC_PAGE_UNKNOWN_ERROR);

      const dirtyPublish = await app.request(`/api/releases/${dirtyBody.release.id}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: dirtyBody.release.coordinate }),
      });
      expect(dirtyPublish.status).toBe(201);
      const dirtyPath = ((await dirtyPublish.json()) as { publicPage: { path: string } }).publicPage
        .path;
      const dirtyPage = await app.request(`/api/verify/${dirtyPath.slice("/verify/".length)}`);
      const dirtyView = (await dirtyPage.json()) as {
        verification: { passingReceipt: boolean; receiptStatus: string };
      };
      expect(dirtyView.verification.receiptStatus).toBe("failed-policy");
      expect(dirtyView.verification.passingReceipt).toBe(false);

      const unpublished = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: false, confirm: coordinate }),
      });
      expect(unpublished.status).toBe(200);
      expect((await app.request(`/api/verify/${token}`)).status).toBe(404);
      const missingUnpublish = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: false, confirm: coordinate }),
      });
      expect(missingUnpublish.status).toBe(400);
      expect(((await missingUnpublish.json()) as { error: string }).error).toBe(
        PUBLIC_PAGE_MISSING_ERROR,
      );

      const republished = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: true, confirm: coordinate }),
      });
      expect(republished.status).toBe(200);
      const republishedBody = (await republished.json()) as { publicPage: { path: string } };
      expect(republishedBody.publicPage.path).toBe(publishedBody.publicPage.path);
      expect((await app.request(`/api/verify/${token}`)).status).toBe(200);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const soloRepublish = await app.request(`/api/releases/${dirtyBody.release.id}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: false, confirm: dirtyBody.release.coordinate }),
      });
      expect(soloRepublish.status).toBe(200);

      const { rows: audit } = await sql.query<{ action: string; summary: string; target_id: string }>(
        `SELECT action, summary, target_id FROM audit_events
         WHERE action IN ('release.publish_verify', 'release.unpublish_verify')
         ORDER BY id ASC`,
      );
      expect(audit.length).toBeGreaterThanOrEqual(3);
      expect(audit.every((row) => row.target_id === coordinate || row.target_id === dirtyBody.release.coordinate)).toBe(
        true,
      );
      expect(JSON.stringify(audit)).not.toContain(token);
      expect(JSON.stringify(audit)).not.toContain("/verify/");

      await sql.query(
        `UPDATE billing_accounts SET plan = NULL, trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`,
      );
      const unpaid = await app.request(`/api/releases/${releaseId}/public`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ enabled: false, confirm: coordinate }),
      });
      expect(unpaid.status).toBe(402);
      expect(((await unpaid.json()) as { error: string }).error).toBe(PUBLIC_PAGE_UNPAID_ERROR);
      expect((await app.request(`/api/verify/${token}`)).status).toBe(200);
    } finally {
      await sql.close();
    }
  });

  it("shows Watch copy for publish and unpublish", () => {
    const page = readFileSync(path.resolve("src/pages/WatchWorkspace.tsx"), "utf8");
    expect(page).toMatch(/Publish verification/);
    expect(page).toMatch(/Unpublish verification/);
    expect(page).toMatch(/Solo may publish/);
    expect(page).toMatch(/not scheduled CDN verification/);
  });
});
