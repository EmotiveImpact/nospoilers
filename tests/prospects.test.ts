import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
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
});
