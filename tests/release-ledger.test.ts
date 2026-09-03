import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildUnsignedReceipt,
  signReceipt,
  verifyReceipt,
} from "../src/receipt.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  inferReleaseChannel,
  inferReleaseChannelFromCoordinate,
  inferSealedMediaType,
  mediaTypeFromPackName,
  parseCiRunUrl,
  parseReleaseScanMeta,
  parseSealedArtifactBytes,
  parseSourceRevision,
} from "../src/server/release-ledger.ts";
import { persistHostedReceipt } from "../src/server/receipts.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import type { ScanReport } from "../src/scanner/types.ts";

const FIXTURE = path.resolve("fixtures/sourcemap.tgz");
const CLEAN = path.resolve("fixtures/clean.tgz");
const SECRET = "receipt-test-secret";

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
    artifactSha256: "bb".repeat(32),
    artifactSha512: "cc".repeat(64),
    artifactBytes: 12,
    scannedAt: "2026-09-01T00:00:00.000Z",
    suppressed: [],
    policyHash: null,
    ...overrides,
  };
}

describe("sealed size and media type", () => {
  it("infers pack media types and rejects junk sizes", () => {
    expect(mediaTypeFromPackName("app.tgz")).toBe("application/gzip");
    expect(mediaTypeFromPackName("layer.tar.gz")).toBe("application/gzip");
    expect(mediaTypeFromPackName("image.tar")).toBe("application/x-tar");
    expect(mediaTypeFromPackName("ext.vsix")).toBe("application/zip");
    expect(mediaTypeFromPackName("app.asar")).toBe("application/octet-stream");
    expect(inferSealedMediaType({ coordinate: "npm:demo-pack@1.0.0" })).toBe("application/gzip");
    expect(
      inferSealedMediaType({
        coordinate: "github:octo/app@v1#app.tgz",
        filename: "ignored.zip",
      }),
    ).toBe("application/zip");
    expect(parseSealedArtifactBytes(12)).toBe(12);
    expect(parseSealedArtifactBytes(-1)).toBeNull();
    expect(parseSealedArtifactBytes("nope")).toBeNull();
  });
});

describe("release channel inference", () => {
  it("maps tags and versions onto stable, beta, or canary", () => {
    expect(inferReleaseChannel("1.0.0")).toBe("stable");
    expect(inferReleaseChannel("v1.2.3")).toBe("stable");
    expect(inferReleaseChannel("phase1-fixture")).toBe("stable");
    expect(inferReleaseChannel("1.0.0-beta.1")).toBe("beta");
    expect(inferReleaseChannel("1.0.0-rc.1")).toBe("beta");
    expect(inferReleaseChannel("2.0.0-alpha.4")).toBe("beta");
    expect(inferReleaseChannel("1.0.0-canary.3")).toBe("canary");
    expect(inferReleaseChannelFromCoordinate("github:octo/app@v1.0.0-beta.1#app.tgz")).toBe("beta");
    expect(inferReleaseChannelFromCoordinate("npm:@scope/pack@2.0.0-canary.1")).toBe("canary");
    expect(inferReleaseChannelFromCoordinate("api:7#upload.bin")).toBe("stable");
  });

  it("rejects private, loopback, and http CI run URLs without fetching them", () => {
    expect(parseCiRunUrl("https://github.com/octo/app/actions/runs/12")).toBe(
      "https://github.com/octo/app/actions/runs/12",
    );
    expect(() => parseCiRunUrl("http://github.com/octo/app/actions/runs/12")).toThrow(/https/);
    expect(() => parseCiRunUrl("https://localhost/run")).toThrow(/not allowed/);
    expect(() => parseCiRunUrl("https://127.0.0.1/run")).toThrow(/not allowed/);
    expect(() => parseCiRunUrl("https://user:pass@github.com/octo/app/actions/runs/12")).toThrow(
      /credentials/,
    );
    expect(parseSourceRevision("abc123def")).toBe("abc123def");
    expect(() => parseSourceRevision("has space")).toThrow(/Source revision/);
  });
});

describe("release ledger", () => {
  it("appends revisions, flags digest mismatch, and isolates tenants", async () => {
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
      await store.linkUserInstallation(7, "u1");
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
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
      });

      expect((await app.request("/api/releases")).status).toBe(401);

      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const bytes = await readFile(CLEAN);
      const first = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.0",
          "x-nospoilers-ci-run": "https://github.com/octo/app/actions/runs/99",
        },
        body: bytes,
      });
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as {
        receipt: { channel?: string; sourceRevision?: string; ciRunUrl?: string; signature: string };
        release: {
          id: number;
          receiptId: number;
          channel: string;
          mismatch: boolean;
          artifactSha256: string;
          artifactBytes: number | null;
          mediaType: string | null;
          sourceRevision: string | null;
          ciRunUrl: string | null;
          receiptStatus: "passed" | "failed-policy" | "inconclusive" | null;
        };
      };
      expect(firstBody.release.channel).toBe("stable");
      expect(firstBody.release.mismatch).toBe(false);
      expect(firstBody.release.receiptId).toBeGreaterThan(0);
      expect(firstBody.release.receiptStatus).toBe("passed");
      expect(firstBody.release.artifactBytes).toBe(bytes.length);
      expect(firstBody.release.mediaType).toBe("application/gzip");
      expect(firstBody.release.sourceRevision).toBe("v1.0.0");
      expect(firstBody.release.ciRunUrl).toBe("https://github.com/octo/app/actions/runs/99");
      expect(firstBody.receipt.channel).toBe("stable");
      const verified = verifyReceipt(JSON.stringify(firstBody.receipt), SECRET, firstBody.release.artifactSha256);
      expect(verified.ok).toBe(true);

      const sameBytes = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.1",
        },
        body: bytes,
      });
      const sameBody = (await sameBytes.json()) as { release: { mismatch: boolean } };
      expect(sameBytes.status).toBe(200);
      expect(sameBody.release.mismatch).toBe(false);

      const beta = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "beta",
        },
        body: bytes,
      });
      const betaBody = (await beta.json()) as { release: { channel: string; mismatch: boolean } };
      expect(beta.status).toBe(200);
      expect(betaBody.release.channel).toBe("beta");
      expect(betaBody.release.mismatch).toBe(false);

      const dirty = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
          "x-nospoilers-source-revision": "v1.0.2",
        },
        body: await readFile(FIXTURE),
      });
      expect(dirty.status).toBe(200);
      const dirtyBody = (await dirty.json()) as {
        release: {
          id: number;
          mismatch: boolean;
          previousSha256: string | null;
          artifactSha256: string;
          receiptStatus: "passed" | "failed-policy" | "inconclusive" | null;
        };
      };
      expect(dirtyBody.release.mismatch).toBe(true);
      expect(dirtyBody.release.receiptStatus).toBe("failed-policy");
      expect(dirtyBody.release.receiptStatus).not.toBe("passed");
      expect(dirtyBody.release.previousSha256).toBe(firstBody.release.artifactSha256);
      expect(dirtyBody.release.artifactSha256).not.toBe(firstBody.release.artifactSha256);

      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; title: string; body: string }[] };
      const mismatch = alertBody.alerts.find((row) => row.kind === "release_digest_mismatch");
      expect(mismatch?.title).toMatch(/Digest mismatch/);
      expect(mismatch?.body).toMatch(/not a compromise claim/);

      const listed = await app.request("/api/releases", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        releases: {
          id: number;
          receiptId: number;
          mismatch: boolean;
          receiptStatus: "passed" | "failed-policy" | "inconclusive" | null;
        }[];
      };
      expect(listedBody.releases.length).toBeGreaterThanOrEqual(4);
      expect(listedBody.releases.some((row) => row.mismatch)).toBe(true);
      expect(listedBody.releases.every((row) => row.receiptId > 0)).toBe(true);
      const listedClean = listedBody.releases.find((row) => row.id === firstBody.release.id);
      const listedDirty = listedBody.releases.find((row) => row.id === dirtyBody.release.id);
      expect(listedClean?.receiptStatus).toBe("passed");
      expect(listedDirty?.receiptStatus).toBe("failed-policy");
      expect(listedDirty?.receiptStatus).not.toBe("passed");

      const one = await app.request(`/api/releases/${dirtyBody.release.id}`, { headers: { cookie } });
      expect(one.status).toBe(200);
      const oneBody = (await one.json()) as {
        release: { receiptStatus: "passed" | "failed-policy" | "inconclusive" | null };
      };
      expect(oneBody.release.receiptStatus).toBe("failed-policy");
      expect(oneBody.release.receiptStatus).not.toBe("passed");

      const downloaded = await app.request(`/api/receipts/${firstBody.release.receiptId}`, {
        headers: { cookie },
      });
      expect(downloaded.status).toBe(200);
      const downloadedBody = (await downloaded.json()) as {
        receipt: { signature: string; coordinate: string; artifactSha256: string };
      };
      expect(downloadedBody.receipt.signature).toMatch(/^[a-f0-9]{64}$/);
      expect(
        verifyReceipt(
          JSON.stringify(downloadedBody.receipt),
          SECRET,
          firstBody.release.artifactSha256,
        ).ok,
      ).toBe(true);
      const stolenReceipt = await app.request(`/api/receipts/${firstBody.release.receiptId}`, {
        headers: { cookie: otherCookie },
      });
      expect(stolenReceipt.status).toBe(404);

      const otherList = await app.request("/api/releases", { headers: { cookie: otherCookie } });
      const otherBody = (await otherList.json()) as { releases: unknown[] };
      expect(otherBody.releases).toEqual([]);

      const stolen = await app.request(`/api/releases/${firstBody.release.id}`, {
        headers: { cookie: otherCookie },
      });
      expect(stolen.status).toBe(404);

      const patched = await app.request(`/api/releases/${firstBody.release.id}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ mismatch: false }),
      });
      expect(patched.status).toBe(404);

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM release_revisions",
      );
      await expect(
        sql.query("UPDATE release_revisions SET mismatch = false WHERE id = $1", [firstBody.release.id]),
      ).rejects.toThrow(/append-only/);
      await expect(
        sql.query("DELETE FROM release_revisions WHERE id = $1", [firstBody.release.id]),
      ).rejects.toThrow(/append-only/);
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM release_revisions",
      );
      expect(after[0]?.n).toBe(before[0]?.n);

      const loopback = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-ci-run": "https://127.0.0.1/run",
        },
        body: bytes,
      });
      expect(loopback.status).toBe(400);
      const loopBody = (await loopback.json()) as { error: string };
      expect(loopBody.error).toMatch(/not allowed/);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
          "x-nospoilers-channel": "stable",
        },
        body: bytes,
      });
      expect(unpaid.status).toBe(402);
      const unpaidReceipt = await app.request(`/api/receipts/${firstBody.release.receiptId}`, {
        headers: { cookie },
      });
      expect(unpaidReceipt.status).toBe(200);
      const unpaidReleases = await app.request("/api/releases", { headers: { cookie } });
      expect(unpaidReleases.status).toBe(200);
      const unpaidList = (await unpaidReleases.json()) as {
        releases: { id: number; receiptStatus: "passed" | "failed-policy" | "inconclusive" | null }[];
      };
      expect(unpaidList.releases.find((row) => row.id === firstBody.release.id)?.receiptStatus).toBe(
        "passed",
      );
      expect(unpaidList.releases.find((row) => row.id === dirtyBody.release.id)?.receiptStatus).toBe(
        "failed-policy",
      );
    } finally {
      await sql.close();
    }
  });

  it("keeps older HMAC receipts verifiable after optional ledger fields exist", () => {
    const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:demo@1.0.0"), SECRET);
    expect("channel" in signed).toBe(false);
    expect(verifyReceipt(JSON.stringify(signed), SECRET).ok).toBe(true);
    const withChannel = signReceipt(
      buildUnsignedReceipt(passedReport(), "npm:demo@1.0.0", {
        channel: "stable",
        sourceRevision: "abc123",
        ciRunUrl: "https://github.com/octo/app/actions/runs/1",
      }),
      SECRET,
    );
    expect(withChannel.channel).toBe("stable");
    expect(verifyReceipt(JSON.stringify(withChannel), SECRET).ok).toBe(true);
    expect(verifyReceipt(JSON.stringify(signed), SECRET).ok).toBe(true);
  });

  it("records a revision when persistHostedReceipt mints a receipt", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      const persisted = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        coordinate: "npm:demo-pack@1.0.0-beta.1",
        report: passedReport({ artifactSha256: "11".repeat(32) }),
      });
      expect(persisted.revision.channel).toBe("beta");
      expect(persisted.revision.mismatch).toBe(false);
      expect(persisted.revision.receipt_status).toBe("passed");
      expect(persisted.revision.source_revision).toBe("1.0.0-beta.1");
      expect(persisted.revision.artifact_bytes).toBe(12);
      expect(persisted.revision.media_type).toBe("application/gzip");
      expect(parseReleaseScanMeta({ coordinate: "npm:demo-pack@1.0.0-beta.1" }).channel).toBe("beta");
    } finally {
      await sql.close();
    }
  });

  it("shows linked receipt status on Watch Releases, not a clean label for spoilers", () => {
    const page = readFileSync(path.resolve("src/components/watch/screens/ReleasesScreen.tsx"), "utf8") + readFileSync("src/watch/useWatchWorkspaceController.tsx", "utf8");
    expect(page).toMatch(/receiptStatusMark/);
    expect(page).toMatch(/failed policy/);
    expect(page).toMatch(/Failed-policy and/);
    expect(page).toMatch(/inconclusive are not clean/);
    expect(page).not.toMatch(/failed-policy is clean/);
    expect(page).not.toMatch(/Authentic · allowed to ship/);
  });
});
