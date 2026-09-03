import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { coverageFrom } from "../src/coverage.ts";
import { createApp } from "../src/server/app.ts";
import {
  ATTESTATION_NO_SOURCE_ERROR,
  ATTESTATION_SOLO_ERROR,
  ATTESTATION_UNPAID_ERROR,
  diffAttestationFacts,
  factsFromAttestationDocument,
  fetchPublicNpmAttestationFacts,
  githubRepoFromReleaseCoordinate,
  npmNameVersionFromCoordinate,
  publicNpmAttestationUrl,
  refreshReleaseAttestations,
  attestationPlanDenied,
} from "../src/server/attestations.ts";
import { AUDIT_ACTIONS, CONFIRM_MISSING_ERROR } from "../src/server/audit.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { persistHostedReceipt } from "../src/server/receipts.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import type { ScanReport } from "../src/scanner/types.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const SECRET = "attestation-receipt-secret";
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

function statement(input: { sha256: string; predicate?: string; builder?: string }) {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: "app.tgz", digest: { sha256: input.sha256 } }],
    predicateType: input.predicate ?? "https://slsa.dev/provenance/v1",
    predicate: {
      runDetails: {
        builder: { id: input.builder ?? "https://github.com/actions/runner" },
      },
    },
  };
}

function bundle(doc: ReturnType<typeof statement>) {
  return {
    attestations: [
      {
        bundle: {
          dsseEnvelope: {
            payloadType: "application/vnd.in-toto+json",
            payload: Buffer.from(JSON.stringify(doc)).toString("base64"),
            signatures: [{ sig: "do-not-store" }],
          },
        },
      },
    ],
  };
}

describe("attestation parsers", () => {
  it("reads github and npm coordinates and ignores private-registry fetch hosts", () => {
    expect(githubRepoFromReleaseCoordinate("github:EmotiveImpact/nospoilers-throwaway@v1#a.tgz")).toEqual({
      owner: "EmotiveImpact",
      name: "nospoilers-throwaway",
    });
    expect(npmNameVersionFromCoordinate("npm:@scope/pack@1.2.3")).toEqual({
      name: "@scope/pack",
      version: "1.2.3",
    });
    expect(publicNpmAttestationUrl("sigstore", "3.1.0")).toBe(
      "https://registry.npmjs.org/-/npm/v1/attestations/sigstore@3.1.0",
    );
    expect(attestationPlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(attestationPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(AUDIT_ACTIONS).toContain("release.attest");
  });

  it("extracts subject, predicate, and builder without keeping signatures", () => {
    const present = factsFromAttestationDocument("github", bundle(statement({ sha256: DIGEST })), DIGEST);
    expect(present).toMatchObject({
      source: "github",
      status: "present",
      predicateType: "https://slsa.dev/provenance/v1",
      subjectDigest: DIGEST,
      builderId: "https://github.com/actions/runner",
      issuer: "github.com",
    });
    const mismatch = factsFromAttestationDocument(
      "npm",
      bundle(statement({ sha256: "cd".repeat(32) })),
      DIGEST,
    );
    expect(mismatch.status).toBe("subject_mismatch");
    expect(factsFromAttestationDocument("github", { attestations: [] }, DIGEST).status).toBe("missing");
    expect(JSON.stringify(present)).not.toContain("do-not-store");
  });

  it("alerts only after a present baseline disappears or changes", () => {
    const present = factsFromAttestationDocument("github", bundle(statement({ sha256: DIGEST })), DIGEST);
    const missing = factsFromAttestationDocument("github", { attestations: [] }, DIGEST);
    expect(diffAttestationFacts(null, present)).toEqual([]);
    expect(diffAttestationFacts(present, missing)).toEqual([{ kind: "lost", source: "github" }]);
    expect(
      diffAttestationFacts(
        present,
        factsFromAttestationDocument(
          "github",
          bundle(statement({ sha256: DIGEST, predicate: "https://slsa.dev/provenance/v0.2" })),
          DIGEST,
        ),
      ),
    ).toEqual([{ kind: "changed", source: "github" }]);
  });
});

describe("release attestation adapters", () => {
  it("gates refresh, stores append-only missing/present facts, and alerts on loss", async () => {
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
      const noSource = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        coordinate: "api:7#app.tgz",
        report: passedReport({ artifactSha256: "ef".repeat(32) }),
      });

      let githubHits = 0;
      const github = unusedGithub(async () => {
        githubHits += 1;
        if (githubHits === 1) return { attestations: [] };
        if (githubHits === 2) return bundle(statement({ sha256: DIGEST }));
        return { attestations: [] };
      });
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

      const unauth = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(unauth.status).toBe(401);

      const missingConfirm = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({}),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const member = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie: memberCookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(member.status).toBe(403);
      expect(((await member.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const other = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie: otherCookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(other.status).toBe(404);

      const noTarget = await app.request(`/api/releases/${noSource.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: noSource.revision.coordinate }),
      });
      expect(noTarget.status).toBe(400);
      expect(((await noTarget.json()) as { error: string }).error).toBe(ATTESTATION_NO_SOURCE_ERROR);

      const first = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(first.status).toBe(201);
      const firstBody = (await first.json()) as {
        attestations: { source: string; status: string }[];
        changes: unknown[];
      };
      expect(firstBody.attestations).toEqual([
        expect.objectContaining({ source: "github", status: "missing" }),
      ]);
      expect(firstBody.changes).toEqual([]);

      const present = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(present.status).toBe(201);
      expect(((await present.json()) as { attestations: { status: string }[] }).attestations[0]?.status).toBe(
        "present",
      );

      const lost = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(lost.status).toBe(201);
      expect(((await lost.json()) as { changes: { kind: string }[] }).changes).toEqual([
        { kind: "lost", source: "github" },
      ]);

      const listed = await app.request(`/api/releases/${sealed.revision.id}`, { headers: { cookie } });
      expect(listed.status).toBe(200);
      expect(
        ((await listed.json()) as { release: { attestations: { status: string }[] } }).release.attestations,
      ).toEqual([expect.objectContaining({ source: "github", status: "missing" })]);

      const memberRead = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        headers: { cookie: memberCookie },
      });
      expect(memberRead.status).toBe(200);

      const alerts = await store.listAlertsForUser("u1", 7);
      expect(alerts.filter((row) => row.kind === "release_attestation_lost")).toHaveLength(1);
      expect(alerts[0]?.title).toContain("github:octo/app@v1#app.tgz");
      expect(JSON.stringify(alerts[0]?.findings)).not.toContain("do-not-store");

      const { rows: audits } = await sql.query<{ action: string; target_id: string }>(
        `SELECT action, target_id FROM audit_events WHERE action = 'release.attest'`,
      );
      expect(audits.length).toBe(3);
      expect(audits[0]?.target_id).toBe("github:octo/app@v1#app.tgz");

      await expect(
        sql.query(`UPDATE release_attestations SET status = 'present' WHERE id = 1`),
      ).rejects.toThrow(/append-only/);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const solo = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(solo.status).toBe(403);
      expect(((await solo.json()) as { error: string }).error).toBe(ATTESTATION_SOLO_ERROR);

      await sql.query(
        `UPDATE billing_accounts SET plan = 'trial', trial_ends_at = '2000-01-01T00:00:00Z' WHERE installation_id = 7`,
      );
      const unpaid = await app.request(`/api/releases/${sealed.revision.id}/attestations`, {
        method: "POST",
        headers: { cookie, ...json },
        body: JSON.stringify({ confirm: sealed.revision.coordinate }),
      });
      expect(unpaid.status).toBe(402);
      expect(((await unpaid.json()) as { error: string }).error).toBe(ATTESTATION_UNPAID_ERROR);

      const bytes = await readFile(CLEAN);
      expect(bytes.byteLength).toBeGreaterThan(0);
    } finally {
      await sql.close();
    }
  });

  it("fetches public npm attestation documents and stores private-registry facts as missing", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "Organization",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      const publicSealed = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        coordinate: "npm:@scope/pack@1.2.3",
        report: passedReport(),
      });
      const privatePkg = await store.insertWatchedPackage(7, "left-pad", "https://npm.pkg.github.com");
      expect(privatePkg?.id).toBeTruthy();
      const privateSealed = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        packageId: privatePkg!.id,
        coordinate: "npm:left-pad@1.3.0",
        report: passedReport({ artifactSha256: "ef".repeat(32) }),
      });

      let npmHits = 0;
      const fetchImpl: typeof fetch = async (url) => {
        npmHits += 1;
        expect(String(url)).toBe(publicNpmAttestationUrl("@scope/pack", "1.2.3"));
        return new Response(JSON.stringify(bundle(statement({ sha256: DIGEST }))), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };

      const present = await refreshReleaseAttestations({
        store,
        github: unusedGithub(),
        revision: publicSealed.revision,
        actorLogin: "octo",
        fetchImpl,
      });
      expect(present.rows).toEqual([expect.objectContaining({ source: "npm", status: "present" })]);
      expect(present.changes).toEqual([]);
      expect(npmHits).toBe(1);

      const missing = await fetchPublicNpmAttestationFacts("left-pad", "1.3.0", DIGEST, async () => {
        return new Response("", { status: 404 });
      });
      expect(missing.status).toBe("missing");

      let privateHits = 0;
      const privateRefresh = await refreshReleaseAttestations({
        store,
        github: unusedGithub(),
        revision: privateSealed.revision,
        actorLogin: "octo",
        fetchImpl: async () => {
          privateHits += 1;
          throw new Error("private registry must not be fetched");
        },
      });
      expect(privateRefresh.rows).toEqual([
        expect.objectContaining({ source: "npm", status: "missing" }),
      ]);
      expect(privateHits).toBe(0);
    } finally {
      await sql.close();
    }
  });
});
