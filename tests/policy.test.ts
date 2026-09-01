import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyPolicy,
  parsePolicyYaml,
  validateExceptionInput,
} from "../src/policy.ts";
import { persistHostedReceipt } from "../src/server/receipts.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { allowedNpmTarballUrl, type NpmPack, type NpmPort } from "../src/server/npm.ts";
import { scan, type ScanReport } from "../src/scanner/index.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";

const SECRET = "policy-test-secret";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(root, "fixtures/sourcemap.tgz");
const TARBALL = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.0.0.tgz";
const FUTURE = "2027-12-01";

function mockGithub(): GithubPort {
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

async function waitUntil(fn: () => Promise<boolean>, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
}

describe("policy parser and apply", () => {
  it("parses constrained YAML allow entries", () => {
    const policy = parsePolicyYaml(`
version: 1
strict: false
allow:
  - rule: SRC-001
    path: "**/*.d.ts"
    reason: Published TypeScript types
    expires: ${FUTURE}
`);
    expect(policy.exceptions).toHaveLength(1);
    expect(policy.exceptions[0]?.rule).toBe("SRC-001");
    expect(policy.exceptions[0]?.pathPattern).toBe("**/*.d.ts");
    expect(policy.exceptions[0]?.expiresAt.startsWith("2027-12-01")).toBe(true);
  });

  it("rejects a missing reason", () => {
    expect(() =>
      validateExceptionInput({
        rule: "SRC-001",
        reason: "short",
        expiresAt: FUTURE,
        actor: "octo",
      }),
    ).toThrow(/at least 8/);
    expect(() =>
      parsePolicyYaml(`
allow:
  - rule: SRC-001
    path: "**/*.ts"
    expires: ${FUTURE}
`),
    ).toThrow(/reason/);
  });

  it("suppresses only the exact rule and matching glob", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-policy-"));
    try {
      await writeFile(path.join(dir, "app.ts"), "export const x = 1\n");
      await writeFile(
        path.join(dir, "app.js.map"),
        JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" }),
      );
      const raw = await scan(dir);
      expect(raw.findings.some((row) => row.rule === "SRC-001")).toBe(true);
      expect(raw.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      const policy = parsePolicyYaml(`
allow:
  - rule: SRC-001
    path: "**/*.ts"
    reason: Types we ship on purpose
    expires: ${FUTURE}
`);
      const applied = applyPolicy(raw, policy);
      expect(applied.findings.some((row) => row.rule === "SRC-001")).toBe(false);
      expect(applied.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      expect(applied.suppressed).toHaveLength(1);
      expect(applied.ok).toBe(false);
      expect(applied.status).toBe("failed-policy");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores expired exceptions even if the rule matches", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-expired-"));
    try {
      await writeFile(
        path.join(dir, "app.js.map"),
        JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" }),
      );
      const raw = await scan(dir);
      const applied = applyPolicy(raw, {
        version: 1,
        strict: false,
        exceptions: [
          {
            rule: "MAP-001",
            pathPattern: "**/*.map",
            reason: "Old exception that must not apply",
            expiresAt: "2020-01-01T00:00:00.000Z",
            actor: "octo",
          },
        ],
      });
      expect(applied.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      expect(applied.suppressed).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("hosted allowlist and baseline", () => {
  it("isolates tenants, refuses unpaid writes, and never deletes exception rows", async () => {
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
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub(),
      });

      const created = await app.request("/api/exceptions", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          rule: "SRC-001",
          path: "**/*.d.ts",
          reason: "Published TypeScript types",
          expires: FUTURE,
        }),
      });
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as { exception: { id: number; rule: string } };
      expect(createdBody.exception.rule).toBe("SRC-001");

      const stolen = await app.request("/api/exceptions", { headers: { cookie: other } });
      const stolenBody = (await stolen.json()) as { exceptions: unknown[] };
      expect(stolenBody.exceptions).toEqual([]);

      const stolenWrite = await app.request("/api/exceptions", {
        method: "POST",
        headers: { cookie: other, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          rule: "MAP-001",
          path: "**/*.map",
          reason: "Trying to suppress another tenant",
          expires: FUTURE,
        }),
      });
      expect(stolenWrite.status).toBe(403);

      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/exceptions", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          rule: "MAP-001",
          path: "**/*.map",
          reason: "Should be blocked when coverage ended",
          expires: FUTURE,
        }),
      });
      expect(unpaid.status).toBe(402);

      await store.sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      const listed = await app.request("/api/exceptions", { headers: { cookie } });
      const listedBody = (await listed.json()) as { exceptions: { id: number }[] };
      expect(listedBody.exceptions).toHaveLength(1);

      const deleted = await app.request(`/api/exceptions/${createdBody.exception.id}`, {
        method: "DELETE",
        headers: { cookie },
      });
      expect(deleted.status).toBe(404);

      const revoked = await app.request(`/api/exceptions/${createdBody.exception.id}/revoke`, {
        method: "POST",
        headers: { cookie },
      });
      expect(revoked.status).toBe(200);
      const { rows } = await sql.query<{ n: string; revoked: string | null }>(
        `SELECT count(*)::text AS n, max(revoked_at)::text AS revoked FROM policy_exceptions`,
      );
      expect(Number(rows[0]?.n)).toBe(1);
      expect(rows[0]?.revoked).toBeTruthy();
    } finally {
      await sql.close();
    }
  });

  it("applies hosted exceptions on npm scans without suppressing unrelated rules", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.insertPolicyException({
        installationId: 7,
        packageId: null,
        rule: "MAP-001",
        pathPattern: "**/*.map",
        reason: "Map file is expected; other map rules still apply",
        actorUserId: "u1",
        actorLogin: "octo",
        expiresAt: `${FUTURE}T23:59:59.000Z`,
      });
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
          return await readFile(FIXTURE);
        },
      };
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
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
      }, "policy receipt");
      await worker.stop();
      const { rows } = await sql.query<{
        status: string;
        receipt: unknown;
      }>("SELECT status, receipt FROM scan_receipts");
      const receiptRaw = rows[0]?.receipt;
      const receipt =
        typeof receiptRaw === "string"
          ? (JSON.parse(receiptRaw) as { suppressedCount?: number; findingRuleIds?: string[] })
          : (receiptRaw as { suppressedCount?: number; findingRuleIds?: string[] });
      expect(rows[0]?.status).toBe("failed-policy");
      expect(receipt.suppressedCount).toBeGreaterThan(0);
      expect(receipt.findingRuleIds).not.toContain("MAP-001");
      expect(receipt.findingRuleIds).toEqual(expect.arrayContaining(["MAP-002", "MAP-003"]));
    } finally {
      await sql.close();
    }
  });

  it("diffs later receipts against the approved baseline, not the previous scan", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      const pkg = await store.insertWatchedPackage(7, "demo-pack");
      if (!pkg) throw new Error("expected watched package");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
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
        github: mockGithub(),
      });

      const first = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        packageId: pkg.id,
        coordinate: "npm:demo-pack@1.0.0",
        report: passedReport({
          artifactSha256: "11".repeat(32),
          manifest: [{ path: "package/old.js", size: 10, sha256: "a1".repeat(32) }],
        }),
      });
      await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        packageId: pkg.id,
        coordinate: "npm:demo-pack@1.1.0",
        report: passedReport({
          artifactSha256: "22".repeat(32),
          manifest: [{ path: "package/mid.js", size: 10, sha256: "a2".repeat(32) }],
        }),
      });
      const approved = await app.request(`/api/packages/${pkg.id}/baseline`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ receiptId: first.row.id, reason: "Ship this packed artifact." }),
      });
      expect(approved.status).toBe(201);

      const third = await persistHostedReceipt({
        store,
        secret: SECRET,
        installationId: 7,
        packageId: pkg.id,
        coordinate: "npm:demo-pack@2.0.0",
        report: passedReport({
          artifactSha256: "33".repeat(32),
          manifest: [{ path: "package/new.js", size: 10, sha256: "a3".repeat(32) }],
        }),
      });
      expect(third.comparedTo).toBe("baseline");
      expect(third.diff?.added.map((row) => row.path)).toEqual(["package/new.js"]);
      expect(third.diff?.removed.map((row) => row.path)).toEqual(["package/old.js"]);

      const diff = await app.request(`/api/packages/${pkg.id}/diff`, { headers: { cookie } });
      const diffBody = (await diff.json()) as {
        versus: string;
        diff: { added: { path: string }[]; removed: { path: string }[] };
      };
      expect(diffBody.versus).toBe("baseline");
      expect(diffBody.diff.added.map((row) => row.path)).toEqual(["package/new.js"]);
      expect(diffBody.diff.removed.map((row) => row.path)).toEqual(["package/old.js"]);

      await store.upsertUser({ id: "u2", login: "intruder" });
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const stolen = await app.request(`/api/packages/${pkg.id}/baseline`, { headers: { cookie: other } });
      expect(stolen.status).toBe(404);
    } finally {
      await sql.close();
    }
  });
});

describe("cli --policy", () => {
  function run(
    args: string[],
    cwd: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
      const child = spawn(process.execPath, [tsx, path.join(root, "src/cli.ts"), ...args], {
        cwd,
        env: process.env,
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

  it("loads --policy and can skip cwd .nospoilers.yml with --no-policy", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-cli-policy-"));
    try {
      await writeFile(
        path.join(dir, "app.js.map"),
        JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" }),
      );
      const yml = path.join(dir, ".nospoilers.yml");
      await writeFile(
        yml,
        `version: 1
allow:
  - rule: MAP-001
    path: "**/*.map"
    reason: Local map we keep out of the pack later
    expires: ${FUTURE}
`,
      );
      const withPolicy = await run(["scan", dir, "--policy", yml], dir);
      expect(withPolicy.code).toBe(0);
      expect(withPolicy.stdout).toMatch(/Suppressed by policy/);
      const skipped = await run(["scan", dir, "--no-policy"], dir);
      expect(skipped.code).toBe(1);
      expect(skipped.stdout).toMatch(/MAP-001/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
