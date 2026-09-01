import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildUnsignedReceipt,
  signReceipt,
  verifyReceipt,
} from "../src/receipt.ts";
import { diffManifests } from "../src/release-diff.ts";
import { scan, type ScanReport } from "../src/scanner/index.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { allowedNpmTarballUrl, type NpmPack, type NpmPort } from "../src/server/npm.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";

const SECRET = "receipt-test-secret";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(root, "fixtures/sourcemap.tgz");
const CLEAN = path.join(root, "fixtures/clean.tgz");
const TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.0.0.tgz";

async function waitUntil(fn: () => Promise<boolean>, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
}

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
    ...overrides,
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

describe("signed receipts", () => {
  it("signs and verifies a passing receipt against the artifact SHA-256", async () => {
    const report = await scan(CLEAN);
    const signed = signReceipt(buildUnsignedReceipt(report, "npm:clean@1.0.0"), SECRET);
    const verified = verifyReceipt(JSON.stringify(signed), SECRET, report.artifactSha256 ?? undefined);
    expect(verified.ok).toBe(true);
    expect(verified.receipt?.status).toBe("passed");
    expect(verified.receipt?.artifactSha256).toBe(report.artifactSha256);
    expect(verified.receipt?.workspaces).toEqual([]);
  });

  it("refuses to mint a passing receipt for an inconclusive scan", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-inconclusive-"));
    try {
      await writeFile(path.join(dir, "a.js"), "12345");
      await writeFile(path.join(dir, "b.js"), "67890");
      const report = await scan(dir, { maxFiles: 1 });
      expect(report.status).toBe("inconclusive");
      expect(report.ok).toBe(false);
      expect(() =>
        signReceipt(
          {
            ...buildUnsignedReceipt(report, "npm:too-big@1.0.0"),
            status: "passed",
            ok: true,
          },
          SECRET,
        ),
      ).toThrow(/inconclusive/);
      const honest = signReceipt(buildUnsignedReceipt(report, "npm:too-big@1.0.0"), SECRET);
      expect(honest.status).toBe("inconclusive");
      expect(honest.ok).toBe(false);
      const verified = verifyReceipt(JSON.stringify(honest), SECRET);
      expect(verified.ok).toBe(true);
      expect(verified.receipt?.status).toBe("inconclusive");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects a tampered signature and a SHA-256 mismatch", async () => {
    const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:demo@1.0.0"), SECRET);
    const tampered = { ...signed, findingCount: 99 };
    expect(verifyReceipt(JSON.stringify(tampered), SECRET).ok).toBe(false);
    expect(verifyReceipt(JSON.stringify(signed), SECRET, "00".repeat(32)).reason).toMatch(/SHA-256/);
  });
});

describe("release diff", () => {
  it("reports only added, removed, and changed paths plus size delta", () => {
    const diff = diffManifests(
      [
        { path: "a.js", size: 10, sha256: "a" },
        { path: "gone.js", size: 4, sha256: "g" },
      ],
      [
        { path: "a.js", size: 12, sha256: "a2" },
        { path: "new.js", size: 8, sha256: "n" },
      ],
    );
    expect(diff.added.map((row) => row.path)).toEqual(["new.js"]);
    expect(diff.removed.map((row) => row.path)).toEqual(["gone.js"]);
    expect(diff.changed.map((row) => row.path)).toEqual(["a.js"]);
    expect(diff.sizeDelta).toBe(6);
    expect(diff.unexpectedSizeJump).toBe(false);
  });
});

describe("hosted receipts", () => {
  it("stores append-only receipts, diffs last two, and isolates tenants", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "intruder" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const npm: NpmPort = {
        getPack: async () =>
          ({
            name: "demo-pack",
            version: "1.0.0",
            distTags: { latest: "1.0.0" },
            tarballUrl: TARBALL,
            shasum: "abc123",
            integrity: null,
            bytes: 100,
          }) satisfies NpmPack,
        downloadTarball: async (url) => {
          allowedNpmTarballUrl(url);
          downloads.push(url);
          return await readFile(downloads.length === 1 ? FIXTURE : CLEAN);
        },
      };
      const config = loadConfig({
        githubWebhookSecret: "wh",
        githubAppId: "1",
        githubPrivateKey: "x",
        githubClientId: "c",
        githubClientSecret: "s",
        sessionSecret: "sess",
        receiptSecret: SECRET,
      });
      const app = createApp({
        config,
        store,
        github: mockGithub(),
        npm,
      });
      const worker = createWorker({
        store,
        github: mockGithub(),
        npm,
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        receiptSecret: SECRET,
      });

      const created = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "demo-pack", installationId: 7 }),
      });
      expect(created.status).toBe(201);
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM scan_receipts");
        return Number(rows[0]?.n) >= 1;
      }, "first receipt");

      const firstList = await app.request("/api/receipts", { headers: { cookie } });
      const firstBody = (await firstList.json()) as { receipts: { id: number; status: string }[] };
      expect(firstBody.receipts).toHaveLength(1);
      expect(firstBody.receipts[0]?.status).toBe("failed-policy");

      await store.enqueueJob({
        priority: "heavy",
        kind: "npm_scan",
        payload: {
          installationId: 7,
          packageId: 1,
          packageName: "demo-pack",
          version: "1.1.0",
          tarballUrl: "https://registry.npmjs.org/demo-pack/-/demo-pack-1.1.0.tgz",
        },
      });
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM scan_receipts");
        return Number(rows[0]?.n) >= 2;
      }, "second receipt");
      await worker.stop();

      const { rows: alerts } = await sql.query<{ title: string }>("SELECT title FROM alerts ORDER BY id");
      expect(alerts[0]?.title).toMatch(/Spoilers in npm demo-pack@1.0.0/);
      expect(alerts.some((row) => /allowed to ship/.test(row.title))).toBe(true);

      const listed = await app.request("/api/receipts?packageId=1", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        receipts: { id: number; status: string; artifactSha256: string }[];
      };
      expect(listedBody.receipts).toHaveLength(2);
      expect(listedBody.receipts.map((row) => row.status).sort()).toEqual(["failed-policy", "passed"]);

      const stolen = await app.request("/api/receipts", { headers: { cookie: other } });
      const stolenBody = (await stolen.json()) as { receipts: unknown[] };
      expect(stolenBody.receipts).toEqual([]);
      const stolenOne = await app.request(`/api/receipts/${listedBody.receipts[0]?.id}`, {
        headers: { cookie: other },
      });
      expect(stolenOne.status).toBe(404);

      const mine = await app.request(`/api/receipts/${listedBody.receipts[0]?.id}`, {
        headers: { cookie },
      });
      expect(mine.status).toBe(200);
      const mineBody = (await mine.json()) as { receipt: { signature: string; status: string } };
      expect(mineBody.receipt.signature).toMatch(/^[a-f0-9]{64}$/);

      const verified = await app.request("/api/receipts/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          receipt: mineBody.receipt,
          sha256: listedBody.receipts[0]?.artifactSha256,
        }),
      });
      expect(verified.status).toBe(200);

      const diff = await app.request("/api/packages/1/diff", { headers: { cookie } });
      expect(diff.status).toBe(200);
      const diffBody = (await diff.json()) as {
        diff: { added: { path: string }[]; removed: { path: string }[]; changed: { path: string }[] } | null;
      };
      expect(diffBody.diff).not.toBeNull();
      const paths = [
        ...(diffBody.diff?.added ?? []).map((row) => row.path),
        ...(diffBody.diff?.removed ?? []).map((row) => row.path),
        ...(diffBody.diff?.changed ?? []).map((row) => row.path),
      ];
      expect(paths.length).toBeGreaterThan(0);

      const patched = await app.request("/api/receipts/1", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "passed" }),
      });
      expect(patched.status).toBe(404);
      const { rows: count } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM scan_receipts",
      );
      expect(Number(count[0]?.n)).toBe(2);
    } finally {
      await sql.close();
    }
  });

  it("titles an oversize GitHub release asset inconclusive, not allowed to ship", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 55,
          tag: "v1.0.0",
          repo: {
            id: 99,
            owner: "octo",
            name: "throwaway",
            fullName: "octo/throwaway",
            private: false,
            htmlUrl: "https://github.com/octo/throwaway",
          },
        },
      });
      const worker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "app.tgz",
              size: 5000,
              url: "https://example.invalid/app.tgz",
            },
          ],
        }),
        notifier: createLogNotifier(store),
        heavyConcurrency: 1,
        lightConcurrency: 1,
        maxAssetBytes: 100,
        intervalMs: 60_000,
        receiptSecret: SECRET,
      });
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM alerts");
        return Number(rows[0]?.n) >= 1;
      }, "inconclusive alert");
      await worker.stop();
      const { rows } = await sql.query<{ title: string }>("SELECT title FROM alerts");
      expect(rows[0]?.title).toMatch(/Inconclusive scan of octo\/throwaway v1.0.0/);
      expect(rows[0]?.title).not.toMatch(/allowed to ship/);
      const { rows: receipts } = await sql.query<{ status: string }>(
        "SELECT status FROM scan_receipts",
      );
      expect(receipts[0]?.status).toBe("inconclusive");
    } finally {
      await sql.close();
    }
  });
});

describe("cli verify", () => {
  function run(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
      const child = spawn(process.execPath, [tsx, path.join(root, "src/cli.ts"), ...args], {
        cwd: root,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? 2, stdout, stderr }));
    });
  }

  it("exits 0 when the file matches a passing receipt", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-verify-"));
    try {
      const report = await scan(CLEAN);
      const signed = signReceipt(buildUnsignedReceipt(report, "npm:clean@1.0.0"), SECRET);
      const receiptPath = path.join(dir, "receipt.json");
      await writeFile(receiptPath, `${JSON.stringify(signed, null, 2)}\n`);
      const result = await run(["verify", CLEAN, "--receipt", receiptPath], {
        RECEIPT_SECRET: SECRET,
      });
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/passing receipt/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
