import { readFile as readFileAsync } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverageFrom } from "../src/coverage.ts";
import { createApp } from "../src/server/app.ts";
import { persistHostedReceipt } from "../src/server/receipts.ts";
import {
  factsFromAttestationDocument,
  refreshReleaseAttestations,
} from "../src/server/attestations.ts";
import { AUDIT_ACTIONS, CONFIRM_MISSING_ERROR } from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import {
  SIGNING_POLICY_BUILDER_ERROR,
  SIGNING_POLICY_CLEAR_CONFIRM,
  SIGNING_POLICY_CONFIRM,
  SIGNING_POLICY_EMPTY_ERROR,
  SIGNING_POLICY_GITHUB_ERROR,
  SIGNING_POLICY_SOLO_ERROR,
  SIGNING_POLICY_UNPAID_ERROR,
  parseSigningPolicyInput,
  signingPolicyBlocksApprove,
  signingPolicyIsActive,
  signingPolicyPlanDenied,
} from "../src/server/signing-policy.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import type { ScanReport } from "../src/scanner/types.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const SECRET = "signing-policy-receipt-secret";
const DIGEST = "ab".repeat(32);
const json = { "content-type": "application/json" };

function unusedGithub(list?: GithubPort["listAttestations"]): GithubPort {
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
    listAttestations: list,
    ...skippedGithubWrites(),
  };
}

function passedReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    target: "/tmp/clean.tgz",
    kind: "tarball",
    fileCount: 1,
    findings: [],
    ok: true,
    status: "passed",
    inconclusiveReason: null,
    manifest: [{ path: "package/index.js", size: 12, sha256: "aa".repeat(32) }],
    engineVersion: "0.1.0",
    artifactSha256: DIGEST,
    artifactSha512: "cc".repeat(64),
    artifactBytes: 12,
    scannedAt: "2026-09-01T00:00:00.000Z",
    suppressed: [],
    policyHash: null,
    ...overrides,
  };
}

function statement() {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: "app.tgz", digest: { sha256: DIGEST } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      runDetails: {
        builder: { id: "https://github.com/actions/runner" },
      },
    },
  };
}

function bundle() {
  return {
    attestations: [
      {
        bundle: {
          dsseEnvelope: {
            payloadType: "application/vnd.in-toto+json",
            payload: Buffer.from(JSON.stringify(statement())).toString("base64"),
            signatures: [{ sig: "do-not-store" }],
          },
        },
      },
    ],
  };
}

describe("signing policy helpers", () => {
  it("gates Solo/unpaid and evaluates required attestation facts", () => {
    expect(signingPolicyPlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(signingPolicyPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(AUDIT_ACTIONS).toContain("signing_policy.save");
    expect(AUDIT_ACTIONS).toContain("signing_policy.clear");
    expect(() => parseSigningPolicyInput({})).toThrow(SIGNING_POLICY_EMPTY_ERROR);
    const policy = parseSigningPolicyInput({ requireGithub: true });
    expect(signingPolicyIsActive(policy)).toBe(true);
    expect(signingPolicyIsActive({ ...policy, expiresAt: "2000-01-01T00:00:00.000Z" })).toBe(false);
    const present = factsFromAttestationDocument("github", bundle(), DIGEST);
    expect(signingPolicyBlocksApprove(policy, new Map())).toBe(SIGNING_POLICY_GITHUB_ERROR);
    expect(signingPolicyBlocksApprove(policy, new Map([["github", present]]))).toBeNull();
    expect(
      signingPolicyBlocksApprove(
        { requireGithub: true, requireNpm: false, builderPrefix: "https://github.com/actions", expiresAt: null },
        new Map([["github", present]]),
      ),
    ).toBeNull();
    expect(
      signingPolicyBlocksApprove(
        { requireGithub: true, requireNpm: false, builderPrefix: "https://gitlab.com/", expiresAt: null },
        new Map([["github", present]]),
      ),
    ).toBe(SIGNING_POLICY_BUILDER_ERROR);
  });
});

describe("customer signing policies", () => {
  it("saves a Team policy, blocks approve until attestations match, and clears leftover rows", async () => {
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
      await store.setInstallationRoleForUser({
        actorUserId: "u1",
        installationId: 7,
        targetUserId: "u2",
        role: "member",
      });

      const sealed = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        coordinate: "github:octo/app@v1#app.tgz",
        report: passedReport(),
      });

      const github = unusedGithub(async () => bundle());
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
        github,
      });

      const unauth = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: json,
        body: JSON.stringify({ requireGithub: true, confirm: SIGNING_POLICY_CONFIRM }),
      });
      expect(unauth.status).toBe(401);

      const missingConfirm = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({ requireGithub: true, installationId: 7 }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const member = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({
          requireGithub: true,
          installationId: 7,
          confirm: SIGNING_POLICY_CONFIRM,
        }),
      });
      expect(member.status).toBe(403);
      expect(((await member.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const other = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({
          requireGithub: true,
          installationId: 7,
          confirm: SIGNING_POLICY_CONFIRM,
        }),
      });
      expect(other.status).toBe(403);

      const otherGet = await app.request("/api/signing-policy?installationId=7", {
        headers: { cookie: otherCookie },
      });
      expect(otherGet.status).toBe(200);
      expect(((await otherGet.json()) as { policy: unknown }).policy).toBeNull();

      const saved = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({
          requireGithub: true,
          builderPrefix: "https://github.com/actions",
          installationId: 7,
          confirm: SIGNING_POLICY_CONFIRM,
        }),
      });
      expect(saved.status).toBe(200);
      expect(((await saved.json()) as { policy: { requireGithub: boolean } }).policy.requireGithub).toBe(
        true,
      );

      const memberRead = await app.request("/api/signing-policy?installationId=7", {
        headers: { cookie: memberCookie },
      });
      expect(memberRead.status).toBe(200);
      expect(
        ((await memberRead.json()) as { policy: { requireGithub: boolean } }).policy.requireGithub,
      ).toBe(true);

      const blocked = await app.request(`/api/releases/${sealed.revision.id}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
          confirm: sealed.revision.coordinate,
        }),
      });
      expect(blocked.status).toBe(409);
      expect(((await blocked.json()) as { error: string }).error).toBe(SIGNING_POLICY_GITHUB_ERROR);

      await refreshReleaseAttestations({
        store,
        github,
        revision: sealed.revision,
        actorLogin: "octo",
      });

      const allowed = await app.request(`/api/releases/${sealed.revision.id}/approvals`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({
          decision: "approved",
          reason: "Ship this passing revision.",
          confirm: sealed.revision.coordinate,
        }),
      });
      expect(allowed.status).toBe(201);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const solo = await app.request("/api/signing-policy", {
        method: "PUT",
        headers: { cookie, ...json },
        body: JSON.stringify({
          requireGithub: true,
          installationId: 7,
          confirm: SIGNING_POLICY_CONFIRM,
        }),
      });
      expect(solo.status).toBe(403);
      expect(((await solo.json()) as { error: string }).error).toBe(SIGNING_POLICY_SOLO_ERROR);

      await sql.query(
        `UPDATE billing_accounts SET plan = 'trial', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/signing-policy", {
        method: "DELETE",
        headers: { cookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          confirm: SIGNING_POLICY_CLEAR_CONFIRM,
        }),
      });
      expect(unpaid.status).toBe(402);
      expect(((await unpaid.json()) as { error: string }).error).toBe(SIGNING_POLICY_UNPAID_ERROR);

      await sql.query(
        `UPDATE billing_accounts SET plan = 'trial', trial_ends_at = now() + interval '14 days' WHERE installation_id = 7`,
      );
      const cleared = await app.request("/api/signing-policy", {
        method: "DELETE",
        headers: { cookie, ...json },
        body: JSON.stringify({
          installationId: 7,
          confirm: SIGNING_POLICY_CLEAR_CONFIRM,
        }),
      });
      expect(cleared.status).toBe(200);
      const leftover = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM release_signing_policies`,
      );
      expect(Number(leftover.rows[0]?.n ?? 1)).toBe(0);
      const { rows: audits } = await sql.query<{ action: string }>(
        `SELECT action FROM audit_events WHERE action IN ('signing_policy.save', 'signing_policy.clear')`,
      );
      expect(audits.map((row) => row.action)).toEqual(["signing_policy.save", "signing_policy.clear"]);

      const bytes = await readFileAsync(CLEAN);
      expect(bytes.byteLength).toBeGreaterThan(0);
    } finally {
      await sql.close();
    }
  });
});
