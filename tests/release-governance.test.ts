import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverageFrom } from "../src/coverage.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  GOVERNANCE_DIRTY_ERROR,
  GOVERNANCE_DUPLICATE_ERROR,
  GOVERNANCE_HELD_ERROR,
  GOVERNANCE_MISMATCH_ERROR,
  GOVERNANCE_NOT_HELD_ERROR,
  GOVERNANCE_REASON_ERROR,
  GOVERNANCE_SOD_ATTACH_ERROR,
  GOVERNANCE_SOD_HOLD_ERROR,
  governancePlanDenied,
  parseGovernanceReason,
  shippingBlockedReason,
} from "../src/server/release-governance.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { CONFIRM_MISSING_ERROR, AUDIT_ACTIONS } from "../src/server/audit.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const DIRTY = path.resolve("fixtures/sourcemap.tgz");
const SECRET = "governance-receipt-secret";
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

describe("release governance helpers", () => {
  it("gates Solo and unpaid coverage and blocks dirty shipping", () => {
    expect(governancePlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(governancePlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(
      governancePlanDenied(coverageFrom(new Date(Date.now() + 86400000).toISOString(), "trial")),
    ).toBeNull();
    expect(() => parseGovernanceReason("short")).toThrow(GOVERNANCE_REASON_ERROR);
    expect(parseGovernanceReason("Ship this passing revision.")).toBe("Ship this passing revision.");
    expect(
      shippingBlockedReason({ mismatch: false, receipt_status: "failed-policy" }),
    ).toBe(GOVERNANCE_DIRTY_ERROR);
    expect(shippingBlockedReason({ mismatch: true, receipt_status: "passed" })).toBe(
      GOVERNANCE_MISMATCH_ERROR,
    );
    expect(shippingBlockedReason({ mismatch: false, receipt_status: "passed" })).toBeNull();
    expect(AUDIT_ACTIONS).toContain("release.approve");
    expect(AUDIT_ACTIONS).toContain("release.reject");
    expect(AUDIT_ACTIONS).toContain("release.hold");
    expect(AUDIT_ACTIONS).toContain("release.release_hold");
  });
});

describe("release approval, legal hold, and ledger export", () => {
  it("enforces SoD, refuses dirty shipping, holds past retention, and exports without query strings", async () => {
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
      });

      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const cleanBytes = await readFileAsync(CLEAN);
      const sealed = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.0",
        },
        body: cleanBytes,
      });
      expect(sealed.status).toBe(200);
      const sealedBody = (await sealed.json()) as {
        release: { id: number; coordinate: string; receiptStatus: string; mismatch: boolean };
      };
      expect(sealedBody.release.receiptStatus).toBe("passed");
      expect(sealedBody.release.mismatch).toBe(false);
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
        release: { id: number; coordinate: string; receiptStatus: string; mismatch: boolean };
      };
      expect(dirtyBody.release.receiptStatus).toBe("failed-policy");
      expect(dirtyBody.release.mismatch).toBe(true);

      expect((await app.request("/api/releases/export")).status).toBe(401);

      const missingConfirm = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
        }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const memberApprove = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
          confirm: coordinate,
        }),
      });
      expect(memberApprove.status).toBe(403);

      const dirtyApprove = await app.request(`/api/releases/${dirtyBody.release.id}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
          confirm: dirtyBody.release.coordinate,
        }),
      });
      expect(dirtyApprove.status).toBe(409);
      expect(((await dirtyApprove.json()) as { error: string }).error).toBe(GOVERNANCE_MISMATCH_ERROR);

      const dirtyReject = await app.request(`/api/releases/${dirtyBody.release.id}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "rejected",
          reason: "Spoilers are not allowed to ship.",
          confirm: dirtyBody.release.coordinate,
        }),
      });
      expect(dirtyReject.status).toBe(201);

      const attach = await app.request(`/api/releases/${releaseId}/locations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ url: "https://cdn.example.com/app.tgz?token=secret" }),
      });
      expect(attach.status).toBe(201);

      const attacherApprove = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
          confirm: coordinate,
        }),
      });
      expect(attacherApprove.status).toBe(409);
      expect(((await attacherApprove.json()) as { error: string }).error).toBe(
        GOVERNANCE_SOD_ATTACH_ERROR,
      );

      await sql.query(`UPDATE installation_users SET role = 'admin' WHERE user_id = 'u2'`);
      const approved = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Second admin approved shipping.",
          confirm: coordinate,
        }),
      });
      expect(approved.status).toBe(201);

      const duplicate = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Second admin approved shipping.",
          confirm: coordinate,
        }),
      });
      expect(duplicate.status).toBe(409);
      expect(((await duplicate.json()) as { error: string }).error).toBe(GOVERNANCE_DUPLICATE_ERROR);

      const listed = await app.request("/api/releases", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        releases: {
          id: number;
          approval: { decision: string; actorLogin: string } | null;
          legalHold: { active: true } | null;
          locations: { url: string }[];
        }[];
      };
      const listedClean = listedBody.releases.find((row) => row.id === releaseId);
      expect(listedClean?.approval?.decision).toBe("approved");
      expect(listedClean?.approval?.actorLogin).toBe("teammate");
      expect(listedClean?.locations.some((row) => row.url.includes("token="))).toBe(false);

      const hold = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          action: "place",
          reason: "Preserve this revision for counsel.",
          confirm: coordinate,
        }),
      });
      expect(hold.status).toBe(201);
      const heldAgain = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          action: "place",
          reason: "Preserve this revision for counsel.",
          confirm: coordinate,
        }),
      });
      expect(heldAgain.status).toBe(409);
      expect(((await heldAgain.json()) as { error: string }).error).toBe(GOVERNANCE_HELD_ERROR);

      const selfRelease = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          action: "release",
          reason: "Counsel no longer needs this row.",
          confirm: coordinate,
        }),
      });
      expect(selfRelease.status).toBe(409);
      expect(((await selfRelease.json()) as { error: string }).error).toBe(GOVERNANCE_SOD_HOLD_ERROR);

      await sql.exec("ALTER TABLE release_revisions DISABLE TRIGGER release_revisions_no_update");
      await sql.query(`UPDATE release_revisions SET created_at = now() - interval '200 days' WHERE id = $1`, [
        releaseId,
      ]);
      await sql.exec("ALTER TABLE release_revisions ENABLE TRIGGER release_revisions_no_update");
      await store.setRetentionDays(7, 90);
      const heldList = await app.request("/api/releases", { headers: { cookie } });
      const heldListBody = (await heldList.json()) as { releases: { id: number; legalHold: { active: true } | null }[] };
      expect(heldListBody.releases.some((row) => row.id === releaseId && row.legalHold?.active)).toBe(
        true,
      );

      const lifted = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          action: "release",
          reason: "Counsel no longer needs this row.",
          confirm: coordinate,
        }),
      });
      expect(lifted.status).toBe(201);
      const notHeld = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          action: "release",
          reason: "Counsel no longer needs this row.",
          confirm: coordinate,
        }),
      });
      expect(notHeld.status).toBe(400);
      expect(((await notHeld.json()) as { error: string }).error).toBe(GOVERNANCE_NOT_HELD_ERROR);

      const hidden = await app.request("/api/releases", { headers: { cookie } });
      const hiddenBody = (await hidden.json()) as { releases: { id: number }[] };
      expect(hiddenBody.releases.some((row) => row.id === releaseId)).toBe(false);
      const stillDirect = await app.request(`/api/releases/${releaseId}`, { headers: { cookie } });
      expect(stillDirect.status).toBe(200);

      await store.setRetentionDays(7, 0);
      const exportRes = await app.request("/api/releases/export?installationId=7", {
        headers: { cookie: memberCookie },
      });
      expect(exportRes.status).toBe(200);
      const exportBody = (await exportRes.json()) as {
        installationId: number;
        releases: {
          id: number;
          approvals: { decision: string }[];
          holds: { action: string }[];
          locations: { url: string }[];
          approval: { decision: string } | null;
        }[];
      };
      expect(exportBody.installationId).toBe(7);
      const exported = exportBody.releases.find((row) => row.id === releaseId);
      expect(exported?.approval?.decision).toBe("approved");
      expect(exported?.approvals.some((row) => row.decision === "approved")).toBe(true);
      expect(exported?.holds.map((row) => row.action)).toEqual(["place", "release"]);
      expect(JSON.stringify(exportBody)).not.toContain("token=secret");
      expect(exported?.locations.some((row) => row.url === "https://cdn.example.com/app.tgz")).toBe(
        true,
      );

      const stolen = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({
          decision: "rejected",
          reason: "Trying another tenant.",
          confirm: coordinate,
        }),
      });
      expect(stolen.status).toBe(404);
      const stolenExport = await app.request("/api/releases/export?installationId=7", {
        headers: { cookie: otherCookie },
      });
      expect(stolenExport.status).toBe(200);
      expect(((await stolenExport.json()) as { releases: unknown[] }).releases).toEqual([]);

      await expect(
        sql.query("UPDATE release_approvals SET reason = 'nope' WHERE revision_id = $1", [releaseId]),
      ).rejects.toThrow(/append-only/);
      await expect(
        sql.query("DELETE FROM release_legal_holds WHERE revision_id = $1", [releaseId]),
      ).rejects.toThrow(/append-only/);

      const { rows: auditRows } = await sql.query<{ action: string }>(
        `SELECT action FROM audit_events
         WHERE action IN ('release.approve', 'release.reject', 'release.hold', 'release.release_hold')
         ORDER BY id ASC`,
      );
      expect(auditRows.map((row) => row.action)).toEqual([
        "release.reject",
        "release.approve",
        "release.hold",
        "release.release_hold",
      ]);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const solo = await app.request(`/api/releases/${releaseId}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "rejected",
          reason: "Solo should not govern this.",
          confirm: coordinate,
        }),
      });
      expect(solo.status).toBe(403);
      const soloExport = await app.request("/api/releases/export?installationId=7", {
        headers: { cookie },
      });
      expect(soloExport.status).toBe(403);

      await sql.query(
        `UPDATE billing_accounts SET plan = 'trial', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`,
      );
      const unpaid = await app.request(`/api/releases/${releaseId}/holds`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          action: "place",
          reason: "Unpaid should not govern this.",
          confirm: coordinate,
        }),
      });
      expect(unpaid.status).toBe(402);
      const unpaidExport = await app.request("/api/releases/export?installationId=7", {
        headers: { cookie },
      });
      expect(unpaidExport.status).toBe(402);
      const unpaidList = await app.request("/api/releases", { headers: { cookie } });
      expect(unpaidList.status).toBe(200);
    } finally {
      await sql.close();
    }
  });

  it("shows Watch copy for approval, legal hold, and ledger export", () => {
    const page = readFileSync(path.resolve("src/pages/WatchPage.tsx"), "utf8");
    expect(page).toMatch(/Approve to ship/);
    expect(page).toMatch(/Legal hold/);
    expect(page).toMatch(/Export ledger/);
    expect(page).toMatch(/another admin must release/);
    expect(page).toMatch(/Failed-policy, inconclusive, and digest-changed/);
  });
});
