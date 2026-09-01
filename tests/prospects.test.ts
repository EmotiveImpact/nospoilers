import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
import { skippedGithubWrites } from "../src/server/github.ts";
import { parseGithubRepository } from "../src/server/prospects.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

function unusedGithub(): GithubPort {
  const unused = async (): Promise<never> => {
    throw new Error("GitHub should not be called.");
  };
  return {
    exchangeCode: unused,
    getUser: unused,
    listUserInstallations: unused,
    getInstallation: unused,
    getRepo: unused,
    listReleaseAssets: unused,
    getLatestRelease: unused,
    downloadAsset: unused,
    ...skippedGithubWrites(),
  };
}

describe("Artifact Leads repository parsing", () => {
  it("accepts owner/repo and GitHub URLs only", () => {
    expect(parseGithubRepository("prettier/prettier")).toEqual({
      owner: "prettier",
      repo: "prettier",
    });
    expect(parseGithubRepository("https://github.com/prettier/prettier.git")).toEqual({
      owner: "prettier",
      repo: "prettier",
    });
    expect(parseGithubRepository("https://example.com/prettier/prettier")).toBeNull();
    expect(parseGithubRepository("owner/repo/extra")).toBeNull();
  });
});

describe("Artifact Leads persistence", () => {
  it("deduplicates artifacts and records metadata-only findings", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const input = {
        source: "npm" as const,
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      };
      const first = await store.upsertProspect(input);
      const duplicate = await store.upsertProspect(input);
      expect(first.inserted).toBe(true);
      expect(duplicate).toEqual({ id: first.id, inserted: false });

      await store.completeProspectScan(first.id, {
        fileCount: 2,
        findings: [
          {
            rule: "MAP-001",
            severity: "critical",
            path: "package/dist/app.js.map",
            title: "Source map ships in the artifact",
            detail: "A .map file is included in the packed artifact.",
          },
        ],
      });
      const row = await store.getProspect(first.id);
      expect(row?.scan_status).toBe("complete");
      expect(row?.critical_count).toBe(1);
      expect(row?.file_count).toBe(2);
      expect(row?.findings).toEqual([
        expect.objectContaining({ rule: "MAP-001", path: "package/dist/app.js.map" }),
      ]);
    } finally {
      await sql.close();
    }
  });

  it("requires an admin session or token for internal APIs", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const app = createApp({
        config: loadConfig({ adminToken: "test-admin-token", sessionSecret: "test-session" }),
        store,
        github: unusedGithub(),
      });

      const denied = await app.request("/api/internal/prospects");
      expect(denied.status).toBe(401);

      const allowed = await app.request("/api/internal/prospects", {
        headers: { authorization: "Bearer test-admin-token" },
      });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as {
        prospects: unknown[];
        policy: { publicArtifactsOnly: boolean; sourceRetained: boolean };
      };
      expect(body.prospects).toEqual([]);
      expect(body.policy).toEqual(
        expect.objectContaining({ publicArtifactsOnly: true, sourceRetained: false }),
      );
    } finally {
      await sql.close();
    }
  });

  it("does not let a customer session read or mutate Artifact Leads", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertProspect({
        source: "npm",
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const sessionId = await store.createSession("customer-1");
      const app = createApp({
        config: loadConfig({
          adminToken: "owner-only-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "test-session",
        }),
        store,
        github: unusedGithub(),
      });
      const cookie = `ns_session=${signSession("test-session", sessionId)}`;
      const list = await app.request("/api/internal/prospects", {
        headers: { cookie },
      });
      expect(list.status).toBe(401);
      const denied = (await list.json()) as { prospects?: unknown; error?: string };
      expect(denied.prospects).toBeUndefined();
      expect(denied.error).toBe("Admin access required.");

      const mutate = await app.request("/api/internal/prospects/1", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(mutate.status).toBe(401);

      const discover = await app.request("/api/internal/prospects/discover", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ query: "topic:electron" }),
      });
      expect(discover.status).toBe(401);

      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const ownerSession = await store.createSession("owner-1");
      const allowed = await app.request("/api/internal/prospects", {
        headers: { cookie: `ns_session=${signSession("test-session", ownerSession)}` },
      });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as { prospects: { artifact_name: string }[] };
      expect(body.prospects).toHaveLength(1);
      expect(body.prospects[0]?.artifact_name).toBe("prettier-3.9.6.tgz");
    } finally {
      await sql.close();
    }
  });

  it("lets the owner read queue counts and hides them from customers", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "acme",
        accountType: "User",
        accountId: 1,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          url: "https://github.com/acme/secret",
          token: "sk_live_exampletokenvalue12",
        },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "prospect_scan",
        payload: { prospectId: 1, artifactUrl: "https://registry.npmjs.org/prettier/-/x.tgz" },
      });
      await store.enqueueJob({
        priority: "light",
        kind: "repo_publicized",
        payload: { installationId: 7 },
      });
      await sql.query(
        `UPDATE jobs SET status = 'failed', error = 'https://evil.example/hook?token=ghu_secret' WHERE kind = 'release_scan'`,
      );
      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      await store.upsertUser({ id: "owner-1", login: "EmotiveImpact" });
      const app = createApp({
        config: loadConfig({
          adminToken: "owner-only-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "test-session",
        }),
        store,
        github: unusedGithub(),
      });
      const customer = `ns_session=${signSession("test-session", await store.createSession("customer-1"))}`;
      const owner = `ns_session=${signSession("test-session", await store.createSession("owner-1"))}`;

      const denied = await app.request("/api/internal/queue", { headers: { cookie: customer } });
      expect(denied.status).toBe(401);
      expect(JSON.stringify(await denied.json())).not.toMatch(/queued/);

      const allowed = await app.request("/api/internal/queue", { headers: { cookie: owner } });
      expect(allowed.status).toBe(200);
      const body = (await allowed.json()) as {
        customer: { queued: number; running: number; failed: number };
        prospect: { queued: number; running: number; failed: number };
        heavyQueued: number;
        lightQueued: number;
        staleRunning: number;
        oldestQueuedAgeMs: number | null;
      };
      expect(body.customer.failed).toBe(1);
      expect(body.prospect.queued).toBe(1);
      expect(body.lightQueued).toBe(1);
      expect(body.heavyQueued).toBe(1);
      const raw = JSON.stringify(body);
      expect(raw).not.toMatch(/sk_live_exampletokenvalue12/);
      expect(raw).not.toMatch(/ghu_secret/);
      expect(raw).not.toMatch(/github\.com\/acme/);
      expect(raw).not.toMatch(/prettier/);
      expect(body).not.toHaveProperty("jobs");
    } finally {
      await sql.close();
    }
  });
});
