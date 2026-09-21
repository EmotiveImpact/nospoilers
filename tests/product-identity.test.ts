import { describe, expect, it } from "vitest";
import {
  PRODUCT_IDENTITY_ISSUER_GITHUB,
  resolveTrustedProductIdentity,
} from "../src/server/product-identity.ts";
import { CURRENT_SCHEMA_MIGRATION, migrate, openSql } from "../src/server/sql.ts";
import { createStore } from "../src/server/store.ts";

describe("provider-neutral product identity", () => {
  it("keeps a stable internal user per trusted issuer and subject without email matching", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      await migrate(sql);
      const store = createStore(sql);

      const first = await resolveTrustedProductIdentity(store, {
        issuer: "https://auth.example.test",
        subject: "managed-auth-user-1",
        login: "person@example.test",
      });
      expect(first.created).toBe(true);
      expect(first.userId).toMatch(/^[0-9a-f-]{36}$/);

      const repeat = await resolveTrustedProductIdentity(store, {
        issuer: "https://auth.example.test",
        subject: "managed-auth-user-1",
        login: "Person renamed",
      });
      expect(repeat).toEqual({ userId: first.userId, created: false });

      const sameDisplayName = await resolveTrustedProductIdentity(store, {
        issuer: "https://another-issuer.example.test",
        subject: "managed-auth-user-1",
        login: "person@example.test",
      });
      expect(sameDisplayName.userId).not.toBe(first.userId);
      expect(await store.listProductIdentities(first.userId)).toEqual([
        { issuer: "https://auth.example.test", subject: "managed-auth-user-1" },
      ]);
      expect(
        (await sql.query<{ id: string }>("SELECT id FROM schema_migrations WHERE id = $1", [
          CURRENT_SCHEMA_MIGRATION,
        ])).rows,
      ).toHaveLength(1);
    } finally {
      await sql.close();
    }
  });

  it("refuses to move an identity or GitHub account between product users", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "connector-secret" });
      await store.upsertUser({ id: "user-a", login: "A" });
      await store.upsertUser({ id: "user-b", login: "B" });
      await store.linkProductIdentity({
        userId: "user-a",
        issuer: PRODUCT_IDENTITY_ISSUER_GITHUB,
        subject: "42",
      });
      await expect(
        store.linkProductIdentity({
          userId: "user-b",
          issuer: PRODUCT_IDENTITY_ISSUER_GITHUB,
          subject: "42",
        }),
      ).rejects.toMatchObject({ status: 409 });

      await store.upsertGithubConnectorAccount({
        userId: "user-a",
        githubAccountId: 42,
        login: "octocat",
        accessToken: "github-token",
      });
      expect(await store.getUserAccessToken("user-a")).toBe("github-token");
      expect(
        (await sql.query<{ access_token: string | null }>("SELECT access_token FROM users WHERE id = 'user-a'"))
          .rows[0]?.access_token,
      ).toBeNull();
      await expect(
        store.upsertGithubConnectorAccount({
          userId: "user-b",
          githubAccountId: 42,
          login: "octocat",
          accessToken: "other-token",
        }),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await sql.close();
    }
  });

  it("keeps provider-neutral sessions when only a connected GitHub authorization is cleared", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      const identity = await resolveTrustedProductIdentity(store, {
        issuer: "https://auth.example.test",
        subject: "managed-user",
        login: "Managed user",
      });
      await store.upsertGithubConnectorAccount({
        userId: identity.userId,
        githubAccountId: 77,
        login: "connector-account",
        accessToken: "connector-token",
      });
      const session = await store.createSession(identity.userId);
      expect(await store.clearGithubConnectorAccessToken(77)).toBe(identity.userId);
      expect(await store.getUserAccessToken(identity.userId)).toBeNull();
      expect(await store.getSession(session)).not.toBeNull();
    } finally {
      await sql.close();
    }
  });
});
