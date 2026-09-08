import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./helpers/completed-scan-app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { hashScanToken, isScanToken, mintScanToken, parseScanBearer } from "../src/server/scan-api.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const FIXTURE = path.resolve("fixtures/sourcemap.tgz");
const CLEAN = path.resolve("fixtures/clean.tgz");

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

describe("scan API token format", () => {
  it("mints nsp_ secrets and hashes them", () => {
    const minted = mintScanToken();
    expect(isScanToken(minted.token)).toBe(true);
    expect(minted.tokenPrefix).toBe(minted.token.slice(0, 12));
    expect(hashScanToken(minted.token)).toHaveLength(64);
    expect(parseScanBearer(`Bearer ${minted.token}`)).toBe(minted.token);
    expect(parseScanBearer("Bearer not-a-token")).toBeNull();
  });
});

describe("hosted scan API", () => {
  it("mints a hashed token, scans a pack, mints a receipt, and never stores the secret or source", async () => {
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
        }),
        store,
        github: unusedGithub(),
      });

      expect((await app.request("/api/scan-tokens")).status).toBe(401);
      expect((await app.request("/api/v1/scan", { method: "POST", body: "x" })).status).toBe(401);

      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "Jenkins", installationId: 7 }),
      });
      expect(minted.status).toBe(201);
      const mintedBody = (await minted.json()) as {
        token: string;
        scanToken: { id: number; token_prefix: string; name: string };
      };
      expect(isScanToken(mintedBody.token)).toBe(true);
      expect(mintedBody.scanToken.name).toBe("Jenkins");

      const listed = await app.request("/api/scan-tokens", { headers: { cookie } });
      const listedBody = (await listed.json()) as { tokens: Record<string, unknown>[] };
      expect(JSON.stringify(listedBody)).not.toContain(mintedBody.token);
      expect(JSON.stringify(listedBody)).not.toContain("token_hash");
      expect(listedBody.tokens[0]?.token_prefix).toBe(mintedBody.scanToken.token_prefix);

      const { rows: stored } = await sql.query<{ token_hash: string; token_prefix: string }>(
        "SELECT token_hash, token_prefix FROM scan_api_tokens",
      );
      expect(stored[0]?.token_hash).toBe(hashScanToken(mintedBody.token));
      expect(stored[0]?.token_hash).not.toBe(mintedBody.token);

      const otherList = await app.request("/api/scan-tokens", { headers: { cookie: otherCookie } });
      const otherBody = (await otherList.json()) as { tokens: unknown[] };
      expect(otherBody.tokens).toEqual([]);

      const stolenRevoke = await app.request(`/api/scan-tokens/${mintedBody.scanToken.id}`, {
        method: "DELETE",
        headers: { cookie: otherCookie },
      });
      expect(stolenRevoke.status).toBe(404);

      const dirty = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "sourcemap.tgz",
        },
        body: await readFile(FIXTURE),
      });
      expect(dirty.status).toBe(200);
      const dirtyBody = (await dirty.json()) as {
        report: { ok: boolean; status: string; findings: { rule: string }[] };
        receipt: { status: string; artifactSha256: string; coordinate: string };
        receiptId: number;
      };
      expect(dirtyBody.report.ok).toBe(false);
      expect(dirtyBody.report.status).toBe("failed-policy");
      expect(dirtyBody.report.findings.map((row) => row.rule)).toEqual(
        expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
      );
      expect(dirtyBody.receipt.coordinate).toBe("api:7#sourcemap.tgz");
      expect(dirtyBody.receiptId).toBeGreaterThan(0);
      expect(JSON.stringify(dirtyBody)).not.toContain("this-is-the-plot-twist");

      const receipts = await app.request("/api/receipts", { headers: { cookie } });
      const receiptList = (await receipts.json()) as { receipts: { id: number; coordinate: string }[] };
      expect(receiptList.receipts[0]?.coordinate).toBe("api:7#sourcemap.tgz");
      const foreign = await app.request(`/api/receipts/${dirtyBody.receiptId}`, {
        headers: { cookie: otherCookie },
      });
      expect(foreign.status).toBe(404);

      const clean = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "clean.tgz",
        },
        body: await readFile(CLEAN),
      });
      const cleanBody = (await clean.json()) as { report: { ok: boolean; status: string } };
      expect(clean.status).toBe(200);
      expect(cleanBody.report.ok).toBe(true);
      expect(cleanBody.report.status).toBe("passed");

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaidMint = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "later", installationId: 7 }),
      });
      expect(unpaidMint.status).toBe(402);
      const unpaidScan = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "clean.tgz",
        },
        body: await readFile(CLEAN),
      });
      expect(unpaidScan.status).toBe(402);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = now() + interval '14 days', plan = 'trial' WHERE installation_id = 7`,
      );
      const revoked = await app.request(`/api/scan-tokens/${mintedBody.scanToken.id}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "Jenkins" }),
      });
      expect(revoked.status).toBe(200);
      const afterRevoke = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "clean.tgz",
        },
        body: await readFile(CLEAN),
      });
      expect(afterRevoke.status).toBe(401);
      const { rows: leftover } = await sql.query<{ revoked_at: string | Date | null }>(
        "SELECT revoked_at FROM scan_api_tokens WHERE id = $1",
        [mintedBody.scanToken.id],
      );
      expect(leftover[0]?.revoked_at).toBeTruthy();
    } finally {
      await sql.close();
    }
  });
});
