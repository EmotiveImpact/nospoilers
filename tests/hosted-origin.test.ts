import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  githubRunnersCanReachOrigin,
  hostedScanOrigin,
} from "../src/server/hosted-origin.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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

describe("hosted scan origin", () => {
  it("treats loopback and http as unreachable from GitHub-hosted runners", () => {
    expect(githubRunnersCanReachOrigin("http://127.0.0.1:4347")).toBe(false);
    expect(githubRunnersCanReachOrigin("https://localhost")).toBe(false);
    expect(githubRunnersCanReachOrigin("https://127.0.0.1")).toBe(false);
    expect(githubRunnersCanReachOrigin("not a url")).toBe(false);
    expect(hostedScanOrigin("http://127.0.0.1:4347/").githubRunnersReachable).toBe(false);
  });

  it("treats public HTTPS hosts as reachable from GitHub-hosted runners", () => {
    expect(githubRunnersCanReachOrigin("https://example.trycloudflare.com")).toBe(true);
    expect(hostedScanOrigin("https://app.example.com/").origin).toBe("https://app.example.com");
    expect(hostedScanOrigin("https://app.example.com/").githubRunnersReachable).toBe(true);
  });
});

describe("hosted origin on session and setup APIs", () => {
  it("omits the origin from anonymous /api/me and includes it when signed in", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      const loopback = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          appBaseUrl: "http://127.0.0.1:4347",
        }),
        store,
        github: unusedGithub(),
      });
      const anon = await loopback.request("/api/me");
      expect(anon.status).toBe(200);
      const anonBody = (await anon.json()) as Record<string, unknown>;
      expect(anonBody.user).toBeNull();
      expect(anonBody).not.toHaveProperty("hostedOrigin");
      expect(anonBody).not.toHaveProperty("githubRunnersReachable");

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const signed = await loopback.request("/api/me", { headers: { cookie } });
      const signedBody = (await signed.json()) as {
        hostedOrigin: string;
        githubRunnersReachable: boolean;
      };
      expect(signedBody.hostedOrigin).toBe("http://127.0.0.1:4347");
      expect(signedBody.githubRunnersReachable).toBe(false);

      const publicApp = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          appBaseUrl: "https://example.trycloudflare.com",
        }),
        store,
        github: unusedGithub(),
      });
      const publicMe = await publicApp.request("/api/me", { headers: { cookie } });
      const publicBody = (await publicMe.json()) as {
        hostedOrigin: string;
        githubRunnersReachable: boolean;
      };
      expect(publicBody.hostedOrigin).toBe("https://example.trycloudflare.com");
      expect(publicBody.githubRunnersReachable).toBe(true);
    } finally {
      await sql.close();
    }
  });

  it("returns the origin on setup-workflow for the owning member", async () => {
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
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          appBaseUrl: "https://app.example.com",
        }),
        store,
        github: unusedGithub(),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const owned = await app.request("/api/repos/99/setup-workflow", { headers: { cookie } });
      expect(owned.status).toBe(200);
      const body = (await owned.json()) as {
        hostedOrigin: string;
        githubRunnersReachable: boolean;
      };
      expect(body.hostedOrigin).toBe("https://app.example.com");
      expect(body.githubRunnersReachable).toBe(true);
    } finally {
      await sql.close();
    }
  });
});
