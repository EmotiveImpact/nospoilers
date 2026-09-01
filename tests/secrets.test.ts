import { describe, expect, it, vi } from "vitest";
import { cookieSettings } from "../src/server/cookies.ts";
import { logJson, sanitizeFields } from "../src/server/log.ts";
import { clientKey, createRateLimiter } from "../src/server/rate-limit.ts";
import { decryptSecret, encryptSecret, looksEncrypted } from "../src/server/secret-box.ts";
import {
  assertProductionSecrets,
  productionSecretsRequired,
  secretIsStrong,
} from "../src/server/secrets.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore } from "../src/server/store.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites } from "../src/server/github.ts";

describe("secret box", () => {
  it("round-trips a GitHub token and refuses to leave it in plaintext", () => {
    const secret = "session-secret-for-tests";
    const token = "ghu_example_token_value";
    const stored = encryptSecret(token, secret);
    expect(looksEncrypted(stored)).toBe(true);
    expect(stored).not.toContain(token);
    expect(decryptSecret(stored, secret)).toBe(token);
    expect(decryptSecret(token, secret)).toBe(token);
  });
});

describe("rate limiter", () => {
  it("allows a burst then blocks the same key", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.allow("1.1.1.1", 1)).toBe(true);
    expect(limiter.allow("1.1.1.1", 2)).toBe(true);
    expect(limiter.allow("1.1.1.1", 3)).toBe(false);
    expect(limiter.allow("2.2.2.2", 3)).toBe(true);
  });

  it("reads the first forwarded address", () => {
    expect(clientKey("10.0.0.2, 10.0.0.1", "9.9.9.9")).toBe("10.0.0.2");
    expect(clientKey(undefined, "9.9.9.9")).toBe("9.9.9.9");
    expect(clientKey(undefined, undefined)).toBe("local");
  });
});

describe("cookies", () => {
  it("marks cookies Secure only on https origins", () => {
    expect(cookieSettings("https://app.example", 60).secure).toBe(true);
    expect(cookieSettings("http://127.0.0.1:4347", 60).secure).toBe(false);
  });
});

describe("token encryption in the store", () => {
  it("stores ciphertext and returns plaintext, migrating old rows", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "box-secret" });
      await store.upsertUser({ id: "u1", login: "octo", accessToken: "ghu_fresh" });
      const { rows } = await sql.query<{ access_token: string }>(
        "SELECT access_token FROM users WHERE id = 'u1'",
      );
      expect(looksEncrypted(rows[0]?.access_token ?? "")).toBe(true);
      expect(await store.getUserAccessToken("u1")).toBe("ghu_fresh");

      await sql.query(`UPDATE users SET access_token = 'ghu_legacy' WHERE id = 'u1'`);
      expect(await store.getUserAccessToken("u1")).toBe("ghu_legacy");
      const { rows: migrated } = await sql.query<{ access_token: string }>(
        "SELECT access_token FROM users WHERE id = 'u1'",
      );
      expect(looksEncrypted(migrated[0]?.access_token ?? "")).toBe(true);
    } finally {
      await sql.close();
    }
  });
});

describe("hosted scan rate limit", () => {
  it("returns 429 after the configured cap", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const config = loadConfig({
        githubWebhookSecret: "wh",
        sessionSecret: "sess",
        scanRateLimit: 1,
        scanRateWindowMs: 60_000,
      });
      const app = createApp({
        config,
        store,
        github: {
          exchangeCode: async () => {
            throw new Error("unused");
          },
          getUser: async () => {
            throw new Error("unused");
          },
          listUserInstallations: async () => [],
          getInstallation: async () => {
            throw new Error("unused");
          },
          getRepo: async () => {
            throw new Error("unused");
          },
          listReleaseAssets: async () => [],
          getLatestRelease: async () => null,
          downloadAsset: async () => Buffer.alloc(0),
          ...skippedGithubWrites(),
        },
      });
      const first = await app.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      const second = await app.request("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "fixtures/clean.tgz" }),
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(429);
    } finally {
      await sql.close();
    }
  });
});

describe("strong secrets", () => {
  it("rejects short, default, and repeated secrets", () => {
    expect(secretIsStrong("short")).toBe(false);
    expect(secretIsStrong("dev-session-not-for-production")).toBe(false);
    expect(secretIsStrong("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(secretIsStrong("a".repeat(32))).toBe(false);
    expect(secretIsStrong("n0spoilers-session-secret-value!!")).toBe(true);
  });

  it("allows weak secrets only on local PGlite http", () => {
    const local = loadConfig({
      databaseUrl: "pglite://:memory:",
      appBaseUrl: "http://127.0.0.1:4347",
      sessionSecret: "sess",
      githubWebhookSecret: "wh",
    });
    expect(productionSecretsRequired(local)).toBe(false);
    expect(() => assertProductionSecrets(local)).not.toThrow();
  });

  it("refuses to boot Neon or https with a weak session secret", () => {
    const neon = loadConfig({
      databaseUrl: "postgresql://u:p@ep-x.c-4.us-east-2.aws.neon.tech/neondb",
      appBaseUrl: "http://127.0.0.1:4347",
      sessionSecret: "sess",
      githubWebhookSecret: "wh",
    });
    expect(productionSecretsRequired(neon)).toBe(true);
    expect(() => assertProductionSecrets(neon)).toThrow(/SESSION_SECRET/);

    const httpsLocal = loadConfig({
      databaseUrl: "pglite://:memory:",
      appBaseUrl: "https://example.trycloudflare.com",
      sessionSecret: "sess",
    });
    expect(() => assertProductionSecrets(httpsLocal)).toThrow(/SESSION_SECRET/);
  });

  it("requires webhook and session secrets to differ when the GitHub App is configured", () => {
    const shared = "n0spoilers-shared-secret-value-ok";
    const config = loadConfig({
      databaseUrl: "postgresql://u:p@ep-x.c-4.us-east-2.aws.neon.tech/neondb",
      appBaseUrl: "https://app.example",
      sessionSecret: shared,
      githubWebhookSecret: shared,
      githubClientSecret: "n0spoilers-github-client-secret-ok",
      githubAppId: "1",
      githubPrivateKey: "-----BEGIN FAKE-----",
      githubClientId: "client",
    });
    expect(() => assertProductionSecrets(config)).toThrow(/distinct/);
  });
});

describe("structured logs", () => {
  it("redacts secrets and connection strings", () => {
    const line = sanitizeFields({
      sessionSecret: "abc",
      databaseUrl: "postgres://u:p@host/db",
      dsn: "postgres://u:p@host/db",
      pglite: "pglite://./data/nospoilers",
      repo: "EmotiveImpact/nospoilers-throwaway",
    });
    expect(line.sessionSecret).toBe("[redacted]");
    expect(line.databaseUrl).toBe("[redacted]");
    expect(line.dsn).toBe("[redacted-url]");
    expect(line.pglite).toBe("[redacted-url]");
    expect(line.repo).toBe("EmotiveImpact/nospoilers-throwaway");

    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((value: unknown) => {
      logged.push(String(value));
    });
    logJson("info", "runtime.start", {
      database: "neon",
      token: "ghu_should_not_print",
    });
    spy.mockRestore();
    expect(logged).toHaveLength(1);
    const parsed = JSON.parse(logged[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.event).toBe("runtime.start");
    expect(parsed.level).toBe("info");
    expect(parsed.database).toBe("neon");
    expect(parsed.token).toBe("[redacted]");
    expect(JSON.stringify(parsed)).not.toContain("ghu_");
  });
});
