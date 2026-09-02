import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  attachCanonicalDeliveryUrl,
  isExpectedDeliveryRedirect,
  isExpectedGithubAssetRedirect,
  isSealedArtifactDigest,
  parseDeliveryUrl,
  publicGithubReleaseDownloadUrl,
  redactDeliveryUrl,
  runDeliveryVerifyJob,
  verifyDeliveryUrl,
} from "../src/server/delivery-verify.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { scan } from "../src/scanner/index.ts";
import type { NpmPort } from "../src/server/npm.ts";

const CLEAN = path.resolve("fixtures/clean.tgz");
const DIRTY = path.resolve("fixtures/sourcemap.tgz");

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

const publicLookup = async () => [{ address: "203.0.113.10", family: 4 }];
const privateLookup = async () => [{ address: "127.0.0.1", family: 4 }];

function bytesFetch(body: Buffer, init: { status?: number; type?: string; location?: string } = {}) {
  return (async () => {
    if (init.location) {
      return new Response(null, {
        status: init.status ?? 302,
        headers: { location: init.location },
      });
    }
    return new Response(body, {
      status: init.status ?? 200,
      headers: { "content-type": init.type ?? "application/gzip" },
    });
  }) as typeof fetch;
}

describe("delivery URL parsing", () => {
  it("keeps query strings for fetch and redacts them for display", () => {
    const parsed = parseDeliveryUrl("https://cdn.example.com/app.tgz?token=secret");
    expect(parsed?.url).toBe("https://cdn.example.com/app.tgz?token=secret");
    expect(parsed?.redacted).toBe("https://cdn.example.com/app.tgz");
    expect(redactDeliveryUrl("https://cdn.example.com/app.tgz?token=secret")).toBe(
      "https://cdn.example.com/app.tgz",
    );
  });

  it("rejects http, credentials, loopback, and IPs", () => {
    expect(parseDeliveryUrl("http://cdn.example.com/app.tgz")).toBeNull();
    expect(parseDeliveryUrl("https://user:pass@cdn.example.com/app.tgz")).toBeNull();
    expect(parseDeliveryUrl("https://localhost/app.tgz")).toBeNull();
    expect(parseDeliveryUrl("https://127.0.0.1/app.tgz")).toBeNull();
    expect(parseDeliveryUrl("https://192.168.1.4/app.tgz")).toBeNull();
  });
});

describe("streaming verify", () => {
  it("matches, mismatches, and refuses cross-host redirects", async () => {
    const bytes = await readFile(CLEAN);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const matched = await verifyDeliveryUrl({
      url: "https://cdn.example.com/app.tgz",
      expectedSha256: sha256,
      fetch: bytesFetch(bytes),
      lookup: publicLookup,
    });
    expect(matched.status).toBe("matched");
    expect(matched.observedSha256).toBe(sha256);
    expect(matched.observedBytes).toBe(bytes.length);

    const mismatch = await verifyDeliveryUrl({
      url: "https://cdn.example.com/app.tgz",
      expectedSha256: sha256,
      fetch: bytesFetch(await readFile(DIRTY)),
      lookup: publicLookup,
    });
    expect(mismatch.status).toBe("mismatch");
    expect(mismatch.observedSha256).not.toBe(sha256);

    const fetched: string[] = [];
    const redirected = await verifyDeliveryUrl({
      url: "https://cdn.example.com/app.tgz",
      expectedSha256: sha256,
      fetch: (async (input) => {
        fetched.push(String(input));
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.net/app.tgz" },
        });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(redirected.status).toBe("redirect");
    expect(redirected.finalHost).toBe("evil.example.net");
    expect(fetched).toEqual(["https://cdn.example.com/app.tgz"]);
  });

  it("follows a GitHub Release download hop to the asset CDN and still blocks other hosts", async () => {
    expect(isExpectedGithubAssetRedirect("github.com", "release-assets.githubusercontent.com")).toBe(
      true,
    );
    expect(isExpectedGithubAssetRedirect("github.com", "objects.githubusercontent.com")).toBe(true);
    expect(isExpectedGithubAssetRedirect("cdn.example.com", "release-assets.githubusercontent.com")).toBe(
      false,
    );
    expect(isExpectedGithubAssetRedirect("github.com", "evil.example.net")).toBe(false);

    const bytes = await readFile(CLEAN);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const fetched: string[] = [];
    const hop = await verifyDeliveryUrl({
      url: "https://github.com/octo/app/releases/download/v1/app.tgz",
      expectedSha256: sha256,
      fetch: (async (input) => {
        const url = String(input);
        fetched.push(url);
        if (url.startsWith("https://github.com/")) {
          return new Response(null, {
            status: 302,
            headers: {
              location:
                "https://release-assets.githubusercontent.com/github-production-release-asset/1/app.tgz?token=secret",
            },
          });
        }
        return new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/octet-stream" },
        });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(hop.status).toBe("matched");
    expect(hop.observedSha256).toBe(sha256);
    expect(hop.redirectCount).toBe(1);
    expect(hop.finalHost).toBe("release-assets.githubusercontent.com");
    expect(fetched).toEqual([
      "https://github.com/octo/app/releases/download/v1/app.tgz",
      "https://release-assets.githubusercontent.com/github-production-release-asset/1/app.tgz?token=secret",
    ]);

    const offGithub = await verifyDeliveryUrl({
      url: "https://cdn.example.com/app.tgz",
      expectedSha256: sha256,
      fetch: (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://release-assets.githubusercontent.com/app.tgz" },
        })) as typeof fetch,
      lookup: publicLookup,
    });
    expect(offGithub.status).toBe("redirect");
    expect(offGithub.finalHost).toBe("release-assets.githubusercontent.com");
  });

  it("follows same-bucket S3 and same-account R2 hops and still blocks other hosts", async () => {
    const account = "0123456789abcdef0123456789abcdef";
    expect(
      isExpectedDeliveryRedirect(
        "https://s3.amazonaws.com/ship-bucket/app.tgz",
        "https://ship-bucket.s3.us-east-1.amazonaws.com/app.tgz",
      ),
    ).toBe(true);
    expect(
      isExpectedDeliveryRedirect(
        "https://ship-bucket.s3.amazonaws.com/app.tgz",
        "https://s3.eu-west-1.amazonaws.com/ship-bucket/app.tgz",
      ),
    ).toBe(true);
    expect(
      isExpectedDeliveryRedirect(
        `https://${account}.r2.cloudflarestorage.com/ship-bucket/app.tgz`,
        `https://ship-bucket.${account}.r2.cloudflarestorage.com/app.tgz`,
      ),
    ).toBe(true);
    expect(
      isExpectedDeliveryRedirect(
        "https://cdn.example.com/app.tgz",
        "https://ship-bucket.s3.amazonaws.com/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        "https://s3.amazonaws.com/ship-bucket/app.tgz",
        "https://other-bucket.s3.amazonaws.com/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        "https://s3.amazonaws.com/ship-bucket/app.tgz",
        "https://d111111abcdef8.cloudfront.net/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        `https://${account}.r2.cloudflarestorage.com/ship-bucket/app.tgz`,
        "https://ship-bucket.ffffffffffffffffffffffffffffffff.r2.cloudflarestorage.com/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        `https://${account}.r2.cloudflarestorage.com/ship-bucket/app.tgz`,
        "https://pub-0123456789abcdef0123456789abcdef.r2.dev/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        "https://s3.amazonaws.com/ship-bucket/app.tgz",
        "https://ship-bucket.s3-website-us-east-1.amazonaws.com/app.tgz",
      ),
    ).toBe(false);
    expect(
      isExpectedDeliveryRedirect(
        "https://s3.amazonaws.com/ship-bucket/app.tgz",
        "https://ship-bucket.s3-accelerate.amazonaws.com/app.tgz",
      ),
    ).toBe(false);

    const bytes = await readFile(CLEAN);
    const sha256 = createHash("sha256").update(bytes).digest("hex");

    const s3Fetched: string[] = [];
    const s3Hop = await verifyDeliveryUrl({
      url: "https://s3.amazonaws.com/ship-bucket/app.tgz",
      expectedSha256: sha256,
      fetch: (async (input) => {
        const url = String(input);
        s3Fetched.push(url);
        if (url === "https://s3.amazonaws.com/ship-bucket/app.tgz") {
          return new Response(null, {
            status: 301,
            headers: { location: "https://ship-bucket.s3.us-east-1.amazonaws.com/app.tgz" },
          });
        }
        return new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/gzip" },
        });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(s3Hop.status).toBe("matched");
    expect(s3Hop.redirectCount).toBe(1);
    expect(s3Hop.finalHost).toBe("ship-bucket.s3.us-east-1.amazonaws.com");
    expect(s3Fetched).toEqual([
      "https://s3.amazonaws.com/ship-bucket/app.tgz",
      "https://ship-bucket.s3.us-east-1.amazonaws.com/app.tgz",
    ]);

    const r2Fetched: string[] = [];
    const r2Hop = await verifyDeliveryUrl({
      url: `https://${account}.r2.cloudflarestorage.com/ship-bucket/app.tgz`,
      expectedSha256: sha256,
      fetch: (async (input) => {
        const url = String(input);
        r2Fetched.push(url);
        if (url.endsWith(".r2.cloudflarestorage.com/ship-bucket/app.tgz")) {
          return new Response(null, {
            status: 302,
            headers: {
              location: `https://ship-bucket.${account}.r2.cloudflarestorage.com/app.tgz`,
            },
          });
        }
        return new Response(bytes, {
          status: 200,
          headers: { "content-type": "application/gzip" },
        });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(r2Hop.status).toBe("matched");
    expect(r2Hop.finalHost).toBe(`ship-bucket.${account}.r2.cloudflarestorage.com`);
    expect(r2Fetched).toHaveLength(2);

    const fromCdn = await verifyDeliveryUrl({
      url: "https://cdn.example.com/app.tgz",
      expectedSha256: sha256,
      fetch: (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://ship-bucket.s3.amazonaws.com/app.tgz" },
        })) as typeof fetch,
      lookup: publicLookup,
    });
    expect(fromCdn.status).toBe("redirect");
    expect(fromCdn.finalHost).toBe("ship-bucket.s3.amazonaws.com");

    const bucketSwapFetched: string[] = [];
    const bucketSwap = await verifyDeliveryUrl({
      url: "https://s3.amazonaws.com/ship-bucket/app.tgz",
      expectedSha256: sha256,
      fetch: (async (input) => {
        bucketSwapFetched.push(String(input));
        return new Response(null, {
          status: 302,
          headers: { location: "https://other-bucket.s3.amazonaws.com/app.tgz" },
        });
      }) as typeof fetch,
      lookup: publicLookup,
    });
    expect(bucketSwap.status).toBe("redirect");
    expect(bucketSwap.finalHost).toBe("other-bucket.s3.amazonaws.com");
    expect(bucketSwapFetched).toEqual(["https://s3.amazonaws.com/ship-bucket/app.tgz"]);

    const toEvil = await verifyDeliveryUrl({
      url: "https://ship-bucket.s3.amazonaws.com/app.tgz",
      expectedSha256: sha256,
      fetch: (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://evil.example.net/app.tgz" },
        })) as typeof fetch,
      lookup: publicLookup,
    });
    expect(toEvil.status).toBe("redirect");
    expect(toEvil.finalHost).toBe("evil.example.net");
  });
});

describe("hosted delivery verify", () => {
  it("attaches a URL, hashes matching bytes, and isolates tenants", async () => {
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
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 9,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(9, "u3");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      let woke = 0;
      const bytes = await readFile(CLEAN);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: "receipt-test-secret",
        }),
        store,
        github: unusedGithub(),
        webhookLookup: publicLookup,
        wakeWorker: () => {
          woke += 1;
        },
      });

      expect((await app.request("/api/releases/1/locations", { method: "POST" })).status).toBe(401);

      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const scanned = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
        },
        body: bytes,
      });
      expect(scanned.status).toBe(200);
      const scannedBody = (await scanned.json()) as {
        release: { id: number; artifactSha256: string };
      };
      expect(scannedBody.release.artifactSha256).toBe(sha256);

      const privateDns = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://cdn.example.com/app.tgz",
          installationId: 7,
        }),
      });
      expect(privateDns.status).toBe(201);
      const created = (await privateDns.json()) as {
        queued: boolean;
        location: { id: number; url: string };
      };
      expect(created.queued).toBe(true);
      expect(woke).toBe(1);
      expect(created.location.url).toBe("https://cdn.example.com/app.tgz");
      expect(JSON.stringify(created)).not.toContain("token=secret");

      const signed = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://cdn.example.com/app.tgz?token=secret",
          installationId: 7,
        }),
      });
      expect(signed.status).toBe(201);
      const signedBody = (await signed.json()) as { location: { id: number; url: string } };
      expect(signedBody.location.url).toBe("https://cdn.example.com/app.tgz");
      expect(JSON.stringify(signedBody)).not.toContain("token=secret");

      await runDeliveryVerifyJob({
        store,
        notifier: createLogNotifier(store),
        installationId: 7,
        locationId: created.location.id,
        revisionId: scannedBody.release.id,
        fetch: bytesFetch(bytes),
        lookup: publicLookup,
      });

      const listed = await app.request("/api/releases", { headers: { cookie } });
      const listedBody = (await listed.json()) as {
        releases: { id: number; locations: { url: string; lastStatus: string | null }[] }[];
      };
      const row = listedBody.releases.find((item) => item.id === scannedBody.release.id);
      expect(row?.locations[0]?.lastStatus).toBe("matched");
      expect(JSON.stringify(listedBody)).not.toContain("token=secret");

      const { rows: alerts } = await sql.query<{ kind: string }>("SELECT kind FROM alerts");
      expect(alerts.map((item) => item.kind)).not.toContain("delivery_mismatch");

      const memberAttach = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie: memberCookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/other.tgz", installationId: 7 }),
      });
      expect(memberAttach.status).toBe(403);
      const memberList = await app.request("/api/releases", { headers: { cookie: memberCookie } });
      expect(memberList.status).toBe(200);
      expect(((await memberList.json()) as { releases: unknown[] }).releases.length).toBeGreaterThan(0);

      const stolen = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie: otherCookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/stolen.tgz", installationId: 9 }),
      });
      expect(stolen.status).toBe(404);

      const { rows: audit } = await sql.query<{ action: string; target_id: string }>(
        `SELECT action, target_id FROM audit_events WHERE action = 'delivery_location.save'`,
      );
      expect(audit[0]?.target_id).toBe("https://cdn.example.com/app.tgz");
      expect(JSON.stringify(audit)).not.toContain("token=secret");

      await expect(
        sql.query("UPDATE release_delivery_verifications SET status = 'error'"),
      ).rejects.toThrow(/append-only/);
      await migrate(sql);
    } finally {
      await sql.close();
    }
  });

  it("alerts on digest mismatch and disappearance without storing bytes", async () => {
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
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const bytes = await readFile(CLEAN);
      const dirty = await readFile(DIRTY);
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: "receipt-test-secret",
        }),
        store,
        github: unusedGithub(),
        webhookLookup: publicLookup,
      });
      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const scanned = await app.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
        },
        body: bytes,
      });
      const scannedBody = (await scanned.json()) as { release: { id: number } };
      const attached = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://cdn.example.com/app.tgz?token=secret",
          installationId: 7,
        }),
      });
      const attachedBody = (await attached.json()) as { location: { id: number } };
      await runDeliveryVerifyJob({
        store,
        notifier: createLogNotifier(store),
        installationId: 7,
        locationId: attachedBody.location.id,
        revisionId: scannedBody.release.id,
        fetch: bytesFetch(dirty),
        lookup: publicLookup,
      });
      const { rows: mismatch } = await sql.query<{ kind: string; body: string }>(
        `SELECT kind, body FROM alerts WHERE kind = 'delivery_mismatch'`,
      );
      expect(mismatch).toHaveLength(1);
      expect(mismatch[0]?.body).toMatch(/delivery fact/);
      expect(JSON.stringify(mismatch)).not.toContain("token=secret");

      await runDeliveryVerifyJob({
        store,
        notifier: createLogNotifier(store),
        installationId: 7,
        locationId: attachedBody.location.id,
        revisionId: scannedBody.release.id,
        fetch: bytesFetch(Buffer.alloc(0), { status: 404 }),
        lookup: publicLookup,
      });
      const { rows: missing } = await sql.query<{ kind: string }>(
        `SELECT kind FROM alerts WHERE kind = 'delivery_missing'`,
      );
      expect(missing).toHaveLength(1);

      const { rows: verifications } = await sql.query<{
        status: string;
        observed_bytes: unknown;
      }>(`SELECT status, observed_bytes FROM release_delivery_verifications ORDER BY id`);
      expect(verifications.map((row) => row.status)).toEqual(["mismatch", "missing"]);
      expect(verifications[0]?.observed_bytes).toBe(dirty.length);
    } finally {
      await sql.close();
    }
  });

  it("refuses unpaid writes and private DNS, and keeps list after coverage ends", async () => {
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
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const bytes = await readFile(CLEAN);
      const privateApp = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: "receipt-test-secret",
        }),
        store,
        github: unusedGithub(),
        webhookLookup: privateLookup,
      });
      const minted = await privateApp.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      const mintedBody = (await minted.json()) as { token: string };
      const scanned = await privateApp.request("/api/v1/scan", {
        method: "POST",
        headers: {
          authorization: `Bearer ${mintedBody.token}`,
          "x-filename": "app.tgz",
        },
        body: bytes,
      });
      const scannedBody = (await scanned.json()) as { release: { id: number } };
      const blocked = await privateApp.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/app.tgz", installationId: 7 }),
      });
      expect(blocked.status).toBe(400);
      expect(((await blocked.json()) as { error: string }).error).toMatch(/private address/);

      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          receiptSecret: "receipt-test-secret",
        }),
        store,
        github: unusedGithub(),
        webhookLookup: publicLookup,
      });
      const attached = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/app.tgz", installationId: 7 }),
      });
      expect(attached.status).toBe(201);
      const attachedBody = (await attached.json()) as { location: { id: number } };
      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaidAttach = await app.request(`/api/releases/${scannedBody.release.id}/locations`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "https://cdn.example.com/other.tgz", installationId: 7 }),
      });
      expect(unpaidAttach.status).toBe(402);
      const unpaidVerify = await app.request(
        `/api/releases/${scannedBody.release.id}/locations/${attachedBody.location.id}/verify`,
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ installationId: 7 }),
        },
      );
      expect(unpaidVerify.status).toBe(402);
      const unpaidList = await app.request("/api/releases", { headers: { cookie } });
      expect(unpaidList.status).toBe(200);
      const unpaidBody = (await unpaidList.json()) as {
        releases: { locations: { url: string }[] }[];
      };
      expect(unpaidBody.releases[0]?.locations[0]?.url).toBe("https://cdn.example.com/app.tgz");
    } finally {
      await sql.close();
    }
  });
});

describe("canonical delivery URLs", () => {
  it("builds a public GitHub Release download URL and rejects junk", () => {
    expect(
      publicGithubReleaseDownloadUrl({
        owner: "octo",
        repo: "throwaway",
        tag: "phase1-fixture",
        name: "sourcemap.tgz",
      }),
    ).toBe("https://github.com/octo/throwaway/releases/download/phase1-fixture/sourcemap.tgz");
    expect(
      publicGithubReleaseDownloadUrl({
        owner: "octo/evil",
        repo: "throwaway",
        tag: "v1",
        name: "app.tgz",
      }),
    ).toBeNull();
    expect(
      publicGithubReleaseDownloadUrl({
        owner: "octo",
        repo: "throwaway",
        tag: "../v1",
        name: "app.tgz",
      }),
    ).toBeNull();
    expect(isSealedArtifactDigest("c".repeat(64))).toBe(true);
    expect(isSealedArtifactDigest("")).toBe(false);
    expect(isSealedArtifactDigest("not-a-digest")).toBe(false);
  });

  it("attaches public GitHub and npm URLs on seal and skips private ones without a verify job", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
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
      await store.upsertRepo({
        id: 100,
        installationId: 7,
        owner: "octo",
        name: "private-app",
        fullName: "octo/private-app",
        private: true,
        htmlUrl: "https://github.com/octo/private-app",
      });
      const bytes = await readFile(DIRTY);
      const tarballUrl = "https://registry.npmjs.org/demo-pack/-/demo-pack-1.0.0.tgz";
      const privateTarball = "https://npm.pkg.github.com/download/@acme/pack/1.0.0/deadbeef";
      const npm: NpmPort = {
        getPack: async () => {
          throw new Error("unused");
        },
        downloadTarball: async () => bytes,
      };
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 55,
          tag: "phase1-fixture",
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
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 56,
          tag: "v1",
          repo: {
            id: 100,
            owner: "octo",
            name: "private-app",
            fullName: "octo/private-app",
            private: true,
            htmlUrl: "https://github.com/octo/private-app",
          },
        },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "npm_scan",
        payload: {
          installationId: 7,
          packageName: "demo-pack",
          version: "1.0.0",
          tarballUrl,
          registryOrigin: "https://registry.npmjs.org",
        },
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "npm_scan",
        payload: {
          installationId: 7,
          packageName: "@acme/pack",
          version: "1.0.0",
          tarballUrl: privateTarball,
          registryOrigin: "https://npm.pkg.github.com",
        },
      });
      const worker = createWorker({
        store,
        github: {
          ...unusedGithub(),
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/repos/octo/app/releases/assets/1",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async () => null,
        },
        npm,
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 4,
        lightConcurrency: 4,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
        receiptSecret: "receipt-test-secret",
      });
      const started = Date.now();
      while (Date.now() - started < 20_000) {
        await worker.tick();
        const { rows } = await sql.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM jobs WHERE status = 'done'",
        );
        if (Number(rows[0]?.n) >= 4) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await worker.stop();

      const { rows: locations } = await sql.query<{ url: string; created_by_login: string }>(
        "SELECT url, created_by_login FROM release_delivery_locations ORDER BY url ASC",
      );
      expect(locations).toEqual([
        {
          url: "https://github.com/octo/throwaway/releases/download/phase1-fixture/sourcemap.tgz",
          created_by_login: "nospoilers",
        },
        {
          url: tarballUrl,
          created_by_login: "nospoilers",
        },
      ]);
      const { rows: verifyJobs } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM jobs WHERE kind = 'delivery_verify'",
      );
      expect(Number(verifyJobs[0]?.n)).toBe(0);

      const { rows: revisions } = await sql.query<{ id: unknown }>(
        "SELECT id FROM release_revisions WHERE coordinate LIKE 'github:%throwaway%' LIMIT 1",
      );
      const revisionId = Number(revisions[0]?.id);
      const again = await attachCanonicalDeliveryUrl(store, {
        installationId: 7,
        revisionId,
        url: "https://github.com/octo/throwaway/releases/download/phase1-fixture/sourcemap.tgz",
      });
      expect(again?.id).toBeGreaterThan(0);
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM release_delivery_locations",
      );
      expect(Number(after[0]?.n)).toBe(2);
    } finally {
      await sql.close();
    }
  });
});
