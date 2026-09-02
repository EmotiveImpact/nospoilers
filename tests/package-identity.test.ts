import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, CONFIRM_MISSING_ERROR } from "../src/server/audit.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  ADVISORY_UNKNOWN_ERROR,
  EVIDENCE_NOT_MALWARE,
  EVIDENCE_UNPROTECTED_ERROR,
  MAX_ADVISORY_PAGES_PER_INSTALL,
  advisoryViewLeaksSecrets,
  assembleIdentityEvidence,
  identityEvidencePlanDenied,
  mintAdvisoryToken,
  parseAdvisoryToken,
  publicAdvisoryPath,
  publicHostFromUrl,
  type PublicAdvisoryView,
} from "../src/server/identity-evidence.ts";
import {
  generateIdentityCandidates,
  identityPlanDenied,
  unpackedSizeJump,
  IDENTITY_CANDIDATE_CAP,
} from "../src/server/identity-signals.ts";
import { ADMIN_REQUIRED_ERROR } from "../src/server/roles.ts";
import {
  emptyPackageIdentity,
  githubRepoFromNpmRepository,
  provenanceFromDist,
  publisherFromNpmUser,
  verifyPackageOwnership,
} from "../src/server/package-identity.ts";
import { packFromRegistry, unpackedBytesFromClaim, type NpmPack, type NpmPort } from "../src/server/npm.ts";
import {
  MAX_PROTECTION_IMPORT,
  parseProtectionImportNames,
} from "../src/server/npm-watch.ts";
import {
  NAMESPACE_NEW_KIND,
  NAMESPACE_OWNED_ERROR,
  NAMESPACE_SEARCH_SIZE,
  NAMESPACE_SOLO_ERROR,
  parseScopeSearchHits,
  runNamespaceCheck,
  verifyNamespaceOwnership,
  normalizeNpmScope,
} from "../src/server/namespace-watch.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { coverageFrom } from "../src/coverage.ts";

const TARBALL = "https://registry.npmjs.org/@octo/app/-/@octo/app-1.0.0.tgz";

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

function ownedPack(overrides: Partial<NpmPack> = {}): NpmPack {
  const { identity: identityOverride, ...rest } = overrides;
  return {
    name: "@octo/app",
    version: "1.0.0",
    distTags: { latest: "1.0.0" },
    tarballUrl: TARBALL,
    shasum: "abc123",
    integrity: null,
    bytes: 100,
    ...rest,
    identity: {
      ...emptyPackageIdentity(),
      maintainers: ["octo"],
      repositoryUrl: "https://github.com/octo/app",
      ...identityOverride,
    },
  };
}

function stubNpm(current: {
  pack: NpmPack | null;
  byName?: Record<string, NpmPack | null>;
  getPackNames?: string[];
  downloads?: string[];
  scopeNames?: Record<string, Array<{ name: string; version: string | null }>>;
  searchScopes?: string[];
}): NpmPort {
  return {
    getPack: async (name) => {
      current.getPackNames?.push(name);
      if (current.byName && Object.prototype.hasOwnProperty.call(current.byName, name)) {
        return current.byName[name];
      }
      if (current.pack && current.pack.name === name) return current.pack;
      return null;
    },
    downloadTarball: async (url) => {
      current.downloads?.push(url);
      throw new Error("identity tests do not download tarballs");
    },
    searchScope: async (scope) => {
      current.searchScopes?.push(scope);
      return current.scopeNames?.[scope] ?? [];
    },
  };
}

describe("package identity parsing", () => {
  it("reads maintainers, repository, bin, and lifecycle scripts from an npm document", () => {
    const parsed = packFromRegistry("@octo/app", {
      name: "@octo/app",
      maintainers: [{ name: "Octo", email: "secret@example.com" }],
      repository: { type: "git", url: "git+https://github.com/octo/app.git" },
      homepage: "https://octo.example/app",
      "dist-tags": { latest: "1.0.0" },
      time: {
        created: "2024-01-01T00:00:00.000Z",
        modified: "2024-01-02T00:00:00.000Z",
        "1.0.0": "2024-01-02T00:00:00.000Z",
      },
      versions: {
        "1.0.0": {
          dist: {
            tarball: TARBALL,
            shasum: "abc123",
            unpackedSize: 4096,
            attestations: {
              url: "https://registry.npmjs.org/-/npm/v1/attestations/@octo/app@1.0.0",
              provenance: { predicateType: "https://slsa.dev/provenance/v1" },
            },
            signatures: [
              {
                keyid: "SHA256:test-key",
                sig: "super-secret-signature-value",
              },
            ],
          },
          bin: { app: "bin/app.js" },
          scripts: { postinstall: "node scripts/leak.js", test: "echo ok" },
          dependencies: { lodash: "^4.17.21" },
          optionalDependencies: { "left-pad": "1.3.0" },
          devDependencies: { typescript: "^5.0.0" },
          _npmUser: {
            name: "GitHub Actions",
            email: "npm-oidc-no-reply@github.com",
            trustedPublisher: {
              id: "github",
              oidcConfigId: "oidc:secret-config-id",
            },
          },
        },
      },
    });
    expect(parsed?.identity.maintainers).toEqual(["octo"]);
    expect(JSON.stringify(parsed)).not.toContain("secret@example.com");
    expect(githubRepoFromNpmRepository(parsed?.identity.repositoryUrl ?? null)?.fullName).toBe(
      "octo/app",
    );
    expect(parsed?.identity.binNames).toEqual(["app"]);
    expect(parsed?.identity.lifecycleScripts).toEqual(["postinstall"]);
    expect(parsed?.publishedAt?.toISOString()).toBe("2024-01-02T00:00:00.000Z");
    expect(parsed?.createdAt?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(parsed?.dependencyNames).toEqual(["left-pad", "lodash"]);
    expect(parsed?.dependencyNames).not.toContain("typescript");
    expect(parsed?.bytes).toBe(4096);
    expect(unpackedBytesFromClaim(-1)).toBeNull();
    expect(unpackedBytesFromClaim(Number.NaN)).toBeNull();
    expect(unpackedBytesFromClaim(Number.POSITIVE_INFINITY)).toBeNull();
    expect(unpackedSizeJump(100, 200)).toBeNull();
    expect(unpackedSizeJump(100, 201)).toEqual({ from: 100, to: 201, delta: 101 });
    expect(unpackedSizeJump(100, 100 + 5 * 1024 * 1024)).toEqual({
      from: 100,
      to: 100 + 5 * 1024 * 1024,
      delta: 5 * 1024 * 1024,
    });
    expect(unpackedSizeJump(null, 10_000)).toBeNull();
    expect(unpackedSizeJump(100, null)).toBeNull();
    expect(parsed?.hasAttestations).toBe(true);
    expect(parsed?.attestationPredicate).toBe("https://slsa.dev/provenance/v1");
    expect(parsed?.signatureKeyids).toEqual(["SHA256:test-key"]);
    expect(parsed?.publisherName).toBe("GitHub Actions");
    expect(parsed?.trustedPublisher).toBe("github");
    expect(JSON.stringify(parsed)).not.toContain("super-secret-signature-value");
    expect(JSON.stringify(parsed)).not.toContain("/-/npm/v1/attestations/");
    expect(JSON.stringify(parsed)).not.toContain("npm-oidc-no-reply@github.com");
    expect(JSON.stringify(parsed)).not.toContain("oidc:secret-config-id");
    expect(provenanceFromDist(undefined)).toEqual({
      hasAttestations: false,
      attestationPredicate: null,
      signatureKeyids: [],
    });
    expect(publisherFromNpmUser(undefined)).toEqual({
      publisherName: null,
      trustedPublisher: null,
    });
    expect(publisherFromNpmUser({ name: "Octo\nLeak", trustedPublisher: { id: "github" } })).toEqual({
      publisherName: null,
      trustedPublisher: "github",
    });
    expect(publisherFromNpmUser({ name: "Octo", trustedPublisher: { id: "GITHUB" } })).toEqual({
      publisherName: "Octo",
      trustedPublisher: "github",
    });
    expect(parsed?.recentVersions?.map((row) => row.version)).not.toContain("created");
  });

  it("rejects protecting a pack that is not this install's scope or GitHub repo", () => {
    expect(
      verifyPackageOwnership({
        packageName: "left-pad",
        repositoryUrl: "https://github.com/stevemao/left-pad",
        installationAccountLogin: "octo",
        installationRepos: [],
      }),
    ).toBeNull();
    expect(
      verifyPackageOwnership({
        packageName: "@octo/app",
        repositoryUrl: null,
        installationAccountLogin: "octo",
        installationRepos: [],
      })?.via,
    ).toBe("scope_match");
    expect(
      verifyPackageOwnership({
        packageName: "app",
        repositoryUrl: "https://github.com/octo/app.git",
        installationAccountLogin: "octo",
        installationRepos: [],
      })?.via,
    ).toBe("github_repository");
  });

  it("parses a batch of protection import names without inventing packs", () => {
    expect(parseProtectionImportNames("@octo/app\nleft-pad, @octo/app\nNOT A NAME!!!")).toEqual([
      { input: "@octo/app", name: "@octo/app" },
      { input: "left-pad", name: "left-pad" },
      { input: "NOT A NAME!!!", name: null },
    ]);
    expect(parseProtectionImportNames(["@octo/app", "left-pad", "../evil", "foo.js"])).toEqual([
      { input: "@octo/app", name: "@octo/app" },
      { input: "left-pad", name: "left-pad" },
      { input: "../evil", name: null },
      { input: "foo.js", name: null },
    ]);
    const overflow = Array.from({ length: MAX_PROTECTION_IMPORT + 5 }, (_, index) => `pack-${index}`);
    expect(parseProtectionImportNames(overflow)).toHaveLength(MAX_PROTECTION_IMPORT);
    expect(parseProtectionImportNames({ names: ["@octo/app"] })).toEqual([]);
    expect(normalizeNpmScope("@Octo")).toBe("@octo");
    expect(normalizeNpmScope("octo/*")).toBe("@octo");
    expect(normalizeNpmScope("@prettier")).toBe("@prettier");
    expect(normalizeNpmScope("left-pad")).toBe("@left-pad");
    expect(normalizeNpmScope("@octo/app")).toBeNull();
    expect(verifyNamespaceOwnership("@octo", "octo")).toBe(true);
    expect(verifyNamespaceOwnership("@prettier", "octo")).toBe(false);
    expect(parseScopeSearchHits("@octo", {
      objects: [
        { package: { name: "@octo/app", version: "1.0.0" } },
        { package: { name: "left-pad", version: "1.3.0" } },
        { package: { name: "@prettier/plugin", version: "3.0.0" } },
        { package: { name: "@octo/cli", version: "2.0.0" } },
      ],
    })).toEqual([
      { name: "@octo/app", version: "1.0.0" },
      { name: "@octo/cli", version: "2.0.0" },
    ]);
    expect(NAMESPACE_SEARCH_SIZE).toBe(20);
  });
});

describe("protected package identity", () => {
  it("requires ownership, snapshots identity, and alerts on maintainer and shape changes", async () => {
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
      const current = { pack: ownedPack() };
      const npm: NpmPort = stubNpm(current);
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
        npm,
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      expect(connected.status).toBe(201);
      const connectedBody = (await connected.json()) as { package: { id: number } };
      const packageId = connectedBody.package.id;

      current.pack = ownedPack({
        name: "left-pad",
        identity: {
          ...emptyPackageIdentity(),
          repositoryUrl: "https://github.com/stevemao/left-pad",
        },
      });
      const foreignPack = await store.insertWatchedPackage(7, "left-pad");
      const stolen = await app.request(`/api/packages/${foreignPack?.id}/protect`, {
        method: "POST",
        headers: { cookie },
      });
      expect(stolen.status).toBe(403);

      current.pack = ownedPack();
      const protectedRes = await app.request(`/api/packages/${packageId}/protect`, {
        method: "POST",
        headers: { cookie },
      });
      expect(protectedRes.status).toBe(201);
      const protectedBody = (await protectedRes.json()) as {
        protection: { verifiedVia: string; githubRepo: string | null };
      };
      expect(protectedBody.protection.verifiedVia).toBe("scope_match");

      const foreignProtect = await app.request(`/api/packages/${packageId}/protect`, {
        method: "POST",
        headers: { cookie: otherCookie },
      });
      expect(foreignProtect.status).toBe(404);

      const identity = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      const identityBody = (await identity.json()) as {
        snapshot: {
          maintainers: string[];
          binNames: string[];
          dependencyNames: string[];
          unpackedBytes: number | null;
          hasAttestations: boolean | null;
          signatureKeyids: string[];
          publisherName: string | null;
          trustedPublisher: string | null;
        };
      };
      expect(identityBody.snapshot.maintainers).toEqual(["octo"]);
      expect(identityBody.snapshot.dependencyNames).toEqual([]);
      expect(identityBody.snapshot.unpackedBytes).toBe(100);
      expect(identityBody.snapshot.hasAttestations).toBe(false);
      expect(identityBody.snapshot.signatureKeyids).toEqual([]);
      expect(identityBody.snapshot.publisherName).toBeNull();
      expect(identityBody.snapshot.trustedPublisher).toBeNull();
      const foreignIdentity = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie: otherCookie },
      });
      expect(foreignIdentity.status).toBe(404);

      current.pack = ownedPack({
        identity: {
          maintainers: ["octo", "intruder"],
          repositoryUrl: "https://github.com/evil/app",
          homepage: "https://evil.example",
          binNames: ["app"],
          lifecycleScripts: ["postinstall"],
        },
      });
      const checked = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(checked.status).toBe(200);

      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; body: string }[] };
      const kinds = alertBody.alerts.map((row) => row.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          "package_maintainer_changed",
          "package_repository_mismatch",
          "package_homepage_mismatch",
          "package_shape_anomaly",
        ]),
      );
      expect(alertBody.alerts.every((row) => !/malware/i.test(row.body) || /not a malware/.test(row.body))).toBe(
        true,
      );
      expect(JSON.stringify(alertBody)).not.toContain("secret@");

      const { rows: before } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM package_identity_snapshots",
      );
      await expect(
        sql.query("UPDATE package_identity_snapshots SET homepage = 'x' WHERE package_id = $1", [
          packageId,
        ]),
      ).rejects.toThrow(/append-only/);
      const { rows: after } = await sql.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM package_identity_snapshots",
      );
      expect(after[0]?.n).toBe(before[0]?.n);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const otherPkg = await store.insertWatchedPackage(7, "@octo/other");
      current.pack = ownedPack({ name: "@octo/other" });
      const unpaid = await app.request(`/api/packages/${otherPkg?.id}/protect`, {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});

describe("batch protected-package import", () => {
  it("protects owned names, refuses arbitrary packs, and never downloads", async () => {
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
      const getPackNames: string[] = [];
      const downloads: string[] = [];
      const current = {
        pack: ownedPack(),
        byName: {
          "@octo/app": ownedPack(),
          "@octo/other": ownedPack({ name: "@octo/other" }),
          "@octo/cap": ownedPack({ name: "@octo/cap" }),
          "left-pad": ownedPack({
            name: "left-pad",
            identity: {
              ...emptyPackageIdentity(),
              repositoryUrl: "https://github.com/stevemao/left-pad",
            },
          }),
        } as Record<string, NpmPack | null>,
        getPackNames,
        downloads,
      };
      const npm: NpmPort = stubNpm(current);
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
        npm,
      });

      const unauth = await app.request("/api/protections/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: ["@octo/app"], installationId: 7 }),
      });
      expect(unauth.status).toBe(401);

      const imported = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          installationId: 7,
          names: ["@octo/app", "left-pad", "no-such-octo-pack-zzzz", "NOT A NAME!!!", "@octo/app"],
        }),
      });
      expect(imported.status).toBe(200);
      const importedBody = (await imported.json()) as {
        queued: boolean;
        results: Array<{
          name: string;
          status: string;
          packageId: number | null;
          verifiedVia: string | null;
          watched: boolean;
        }>;
      };
      expect(importedBody.queued).toBe(false);
      expect(importedBody.results).toEqual([
        expect.objectContaining({
          name: "@octo/app",
          status: "protected",
          verifiedVia: "scope_match",
          watched: true,
        }),
        expect.objectContaining({
          name: "left-pad",
          status: "not_owned",
          packageId: null,
          watched: false,
        }),
        expect.objectContaining({
          name: "no-such-octo-pack-zzzz",
          status: "not_found",
          packageId: null,
          watched: false,
        }),
        expect.objectContaining({
          name: "NOT A NAME!!!",
          status: "invalid",
          packageId: null,
          watched: false,
        }),
      ]);
      expect(downloads).toEqual([]);
      expect(await store.getWatchedPackageByName(7, "left-pad")).toBeNull();
      expect(await store.getWatchedPackageByName(7, "no-such-octo-pack-zzzz")).toBeNull();
      const owned = await store.getWatchedPackageByName(7, "@octo/app");
      expect(owned).not.toBeNull();
      const { rows: scanJobs } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM jobs WHERE kind = 'npm_scan'`,
      );
      expect(scanJobs[0]?.n).toBe("0");

      const identity = await app.request(`/api/packages/${owned?.id}/identity`, {
        headers: { cookie },
      });
      const identityBody = (await identity.json()) as {
        snapshot: { maintainers: string[]; unpackedBytes: number | null };
      };
      expect(identityBody.snapshot.maintainers).toEqual(["octo"]);
      expect(identityBody.snapshot.unpackedBytes).toBe(100);

      const again = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, names: ["@octo/app"] }),
      });
      expect(again.status).toBe(200);
      const againBody = (await again.json()) as { queued: boolean; results: Array<{ status: string }> };
      expect(againBody.queued).toBe(false);
      expect(againBody.results[0]?.status).toBe("already_protected");

      const existing = await store.insertWatchedPackage(7, "@octo/other");
      const inPlace = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, names: ["@octo/other"] }),
      });
      expect(inPlace.status).toBe(200);
      const inPlaceBody = (await inPlace.json()) as {
        results: Array<{ status: string; packageId: number | null }>;
      };
      expect(inPlaceBody.results[0]).toEqual(
        expect.objectContaining({
          status: "protected",
          packageId: existing?.id,
        }),
      );

      const foreign = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie: otherCookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, names: ["@octo/app"] }),
      });
      expect(foreign.status).toBe(403);

      for (let index = 0; index < 23; index += 1) {
        await store.insertWatchedPackage(7, `@octo/fill-${index}`);
      }
      const capped = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, names: ["@octo/cap"] }),
      });
      expect(capped.status).toBe(200);
      const cappedBody = (await capped.json()) as { results: Array<{ status: string; watched: boolean }> };
      expect(cappedBody.results[0]).toEqual(
        expect.objectContaining({ status: "watch_cap", watched: false }),
      );
      expect(await store.getWatchedPackageByName(7, "@octo/cap")).toBeNull();
      expect(downloads).toEqual([]);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/protections/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, names: ["@octo/app"] }),
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});

const OCTO_APP_CANDIDATES = [
  ["homoglyph", "@0cto/app"],
  ["homoglyph", "@oct0/app"],
  ["adjacent_key", "@icto/app"],
  ["adjacent_key", "@ocro/app"],
  ["adjacent_key", "@octi/app"],
  ["adjacent_key", "@octo/aop"],
  ["adjacent_key", "@octo/apo"],
  ["adjacent_key", "@octo/spp"],
  ["adjacent_key", "@octp/app"],
  ["adjacent_key", "@ocyo/app"],
  ["adjacent_key", "@ovto/app"],
  ["adjacent_key", "@oxto/app"],
  ["adjacent_key", "@pcto/app"],
  ["scope_confusion", "@app/octo"],
  ["scope_confusion", "octo_app"],
  ["scope_confusion", "octo-app"],
  ["scope_confusion", "octo.app"],
  ["edit_distance", "@1cto/app"],
  ["edit_distance", "@2cto/app"],
  ["edit_distance", "@3cto/app"],
  ["edit_distance", "@4cto/app"],
  ["edit_distance", "@5cto/app"],
  ["edit_distance", "@6cto/app"],
  ["edit_distance", "@7cto/app"],
  ["edit_distance", "@8cto/app"],
  ["edit_distance", "@9cto/app"],
  ["edit_distance", "@acto/app"],
  ["edit_distance", "@bcto/app"],
  ["edit_distance", "@ccto/app"],
  ["edit_distance", "@cto/app"],
  ["edit_distance", "@dcto/app"],
  ["edit_distance", "@ecto/app"],
  ["edit_distance", "@fcto/app"],
  ["edit_distance", "@gcto/app"],
  ["edit_distance", "@hcto/app"],
  ["edit_distance", "@jcto/app"],
  ["edit_distance", "@kcto/app"],
  ["edit_distance", "@lcto/app"],
  ["edit_distance", "@mcto/app"],
  ["edit_distance", "@ncto/app"],
] as const;

const LEFT_PAD_CANDIDATES = [
  ["homoglyph", "1eft-pad"],
  ["homoglyph", "ieft-pad"],
  ["adjacent_key", "keft-pad"],
  ["adjacent_key", "ledt-pad"],
  ["adjacent_key", "lefr-pad"],
  ["adjacent_key", "left-oad"],
  ["adjacent_key", "left-paf"],
  ["adjacent_key", "left-pas"],
  ["adjacent_key", "left-psd"],
  ["adjacent_key", "lefy-pad"],
  ["adjacent_key", "legt-pad"],
  ["adjacent_key", "lrft-pad"],
  ["adjacent_key", "lwft-pad"],
  ["separator", "left_pad"],
  ["separator", "left.pad"],
  ["separator", "leftpad"],
  ["token_order", "pad-left"],
  ["edit_distance", "0eft-pad"],
  ["edit_distance", "2eft-pad"],
  ["edit_distance", "3eft-pad"],
  ["edit_distance", "4eft-pad"],
  ["edit_distance", "5eft-pad"],
  ["edit_distance", "6eft-pad"],
  ["edit_distance", "7eft-pad"],
  ["edit_distance", "8eft-pad"],
  ["edit_distance", "9eft-pad"],
  ["edit_distance", "aeft-pad"],
  ["edit_distance", "beft-pad"],
  ["edit_distance", "ceft-pad"],
  ["edit_distance", "deft-pad"],
  ["edit_distance", "eeft-pad"],
  ["edit_distance", "eft-pad"],
  ["edit_distance", "feft-pad"],
  ["edit_distance", "geft-pad"],
  ["edit_distance", "heft-pad"],
  ["edit_distance", "jeft-pad"],
  ["edit_distance", "l0ft-pad"],
  ["edit_distance", "l1ft-pad"],
  ["edit_distance", "l2ft-pad"],
  ["edit_distance", "l3ft-pad"],
] as const;

describe("bounded identity candidates", () => {
  it("generates a deterministic capped set for @octo/app and left-pad", () => {
    const octo = generateIdentityCandidates("@octo/app");
    const left = generateIdentityCandidates("left-pad");
    expect(octo).toHaveLength(IDENTITY_CANDIDATE_CAP);
    expect(left).toHaveLength(IDENTITY_CANDIDATE_CAP);
    expect(octo.map((row) => [row.transformation, row.name])).toEqual([...OCTO_APP_CANDIDATES]);
    expect(left.map((row) => [row.transformation, row.name])).toEqual([...LEFT_PAD_CANDIDATES]);
    expect(generateIdentityCandidates("@Octo/App")).toEqual(octo);
    expect(new Set(octo.map((row) => row.name)).size).toBe(octo.length);
    expect(octo.some((row) => row.name === "@octo/app")).toBe(false);
    expect(identityPlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    expect(identityPlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
  });
});

describe("Team identity signals", () => {
  it("persists lookalikes, alerts without downloading, allowlists, and gates Solo/unpaid", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u-member", login: "teammate" });
      await store.upsertUser({ id: "u2", login: "other" });
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
      await store.linkUserInstallation(7, "u-member");
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u-member"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const getPackNames: string[] = [];
      const current: {
        pack: NpmPack | null;
        byName: Record<string, NpmPack | null>;
        getPackNames: string[];
        downloads: string[];
      } = {
        pack: ownedPack(),
        byName: {},
        getPackNames,
        downloads,
      };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      expect(connected.status).toBe(201);
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;

      const protectedRes = await app.request(`/api/packages/${packageId}/protect`, {
        method: "POST",
        headers: { cookie },
      });
      expect(protectedRes.status).toBe(201);

      const listed = await app.request(`/api/packages/${packageId}/candidates`, { headers: { cookie } });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        candidates: { id: number; candidateName: string; transformation: string }[];
      };
      expect(listedBody.candidates).toHaveLength(IDENTITY_CANDIDATE_CAP);
      expect(listedBody.candidates[0]?.candidateName).toBe("@0cto/app");
      const lookalike = listedBody.candidates.find((row) => row.candidateName === "@0cto/app");
      expect(lookalike?.transformation).toBe("homoglyph");

      const memberList = await app.request(`/api/packages/${packageId}/candidates`, {
        headers: { cookie: memberCookie },
      });
      expect(memberList.status).toBe(200);

      const foreign = await app.request(`/api/packages/${packageId}/candidates`, {
        headers: { cookie: otherCookie },
      });
      expect(foreign.status).toBe(404);

      current.byName["@0cto/app"] = ownedPack({ name: "@0cto/app", version: "0.0.1" });
      getPackNames.length = 0;
      const checked = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(checked.status).toBe(200);
      expect(downloads).toEqual([]);
      expect(getPackNames).toContain("@0cto/app");
      expect(getPackNames).not.toContain("https://registry.npmjs.org/@0cto/app/-/@0cto/app-0.0.1.tgz");

      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; title: string; body: string }[] };
      expect(alertBody.alerts.map((row) => row.kind)).toContain("identity_lookalike_registered");
      expect(alertBody.alerts.some((row) => /malware verdict/i.test(row.body))).toBe(true);
      expect(alertBody.alerts.every((row) => !/is malware/i.test(row.body))).toBe(true);
      expect(JSON.stringify(alertBody)).not.toContain("secret@");

      const memberAllow = await app.request(
        `/api/packages/${packageId}/candidates/${lookalike?.id}/allowlist`,
        {
          method: "POST",
          headers: { cookie: memberCookie, "content-type": "application/json" },
          body: JSON.stringify({ reason: "known sibling", confirm: "@0cto/app" }),
        },
      );
      expect(memberAllow.status).toBe(403);

      const mismatch = await app.request(
        `/api/packages/${packageId}/candidates/${lookalike?.id}/allowlist`,
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ reason: "known sibling", confirm: "wrong" }),
        },
      );
      expect(mismatch.status).toBe(400);

      const allowlisted = await app.request(
        `/api/packages/${packageId}/candidates/${lookalike?.id}/allowlist`,
        {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ reason: "known sibling we already ship", confirm: "@0cto/app" }),
        },
      );
      expect(allowlisted.status).toBe(200);

      current.byName["@0cto/app"] = ownedPack({ name: "@0cto/app", version: "0.0.2" });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterAllow = await app.request("/api/alerts", { headers: { cookie } });
      const afterAllowBody = (await afterAllow.json()) as { alerts: { kind: string }[] };
      expect(afterAllowBody.alerts.map((row) => row.kind)).not.toContain("identity_lookalike_version");

      const audit = await app.request("/api/audit?installationId=7", { headers: { cookie } });
      const auditBody = (await audit.json()) as { rows: { action: string; summary: string }[] };
      expect(auditBody.rows.map((row) => row.action)).toContain("identity.allowlist");
      expect(JSON.stringify(auditBody)).not.toContain("secret@");

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const solo = await app.request(`/api/packages/${packageId}/candidates`, { headers: { cookie } });
      expect(solo.status).toBe(403);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request(`/api/packages/${packageId}/candidates`, { headers: { cookie } });
      expect(unpaid.status).toBe(402);
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("alerts on dormant resurrection, release bursts, and version jumps without a malware verdict", async () => {
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
      const downloads: string[] = [];
      const current: {
        pack: NpmPack | null;
        byName: Record<string, NpmPack | null>;
        downloads: string[];
      } = { pack: ownedPack(), byName: {}, downloads };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const stale = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
      await store.insertPackageIdentitySnapshot({
        installationId: 7,
        packageId,
        version: "1.0.0",
        maintainers: ["octo"],
        repositoryUrl: "https://github.com/octo/app",
        homepage: null,
        binNames: [],
        lifecycleScripts: [],
        publishedAt: stale,
      });

      const now = Date.now();
      current.pack = ownedPack({
        version: "4.0.0",
        distTags: { latest: "4.0.0" },
        publishedAt: new Date(now),
        recentVersions: [
          { version: "1.1.0", publishedAt: new Date(now - 6 * 24 * 60 * 60 * 1000) },
          { version: "2.0.0", publishedAt: new Date(now - 5 * 24 * 60 * 60 * 1000) },
          { version: "3.0.0", publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000) },
          { version: "3.1.0", publishedAt: new Date(now - 1 * 24 * 60 * 60 * 1000) },
          { version: "4.0.0", publishedAt: new Date(now) },
        ],
      });
      const checked = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(checked.status).toBe(200);
      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; body: string }[] };
      const kinds = alertBody.alerts.map((row) => row.kind);
      expect(kinds).toEqual(
        expect.arrayContaining(["identity_dormant", "identity_burst", "identity_jump"]),
      );
      expect(alertBody.alerts.every((row) => !/malware/i.test(row.body) || /not a malware/.test(row.body))).toBe(
        true,
      );
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("alerts when a new dependency is a newly created package, not an old one", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
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
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const getPackNames: string[] = [];
      const now = Date.now();
      const current: {
        pack: NpmPack | null;
        byName: Record<string, NpmPack | null>;
        getPackNames: string[];
        downloads: string[];
      } = {
        pack: ownedPack({
          dependencyNames: ["brand-new-typo"],
        }),
        byName: {
          "brand-new-typo": ownedPack({
            name: "brand-new-typo",
            createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
          }),
        },
        getPackNames,
        downloads,
      };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const identity = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      expect(
        ((await identity.json()) as { snapshot: { dependencyNames: string[] } }).snapshot
          .dependencyNames,
      ).toEqual(["brand-new-typo"]);

      getPackNames.length = 0;
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterBaseline = await app.request("/api/alerts", { headers: { cookie } });
      const afterBaselineBody = (await afterBaseline.json()) as { alerts: { kind: string }[] };
      expect(afterBaselineBody.alerts.map((row) => row.kind)).not.toContain("identity_new_dependency");
      expect(getPackNames).not.toContain("brand-new-typo");

      current.pack = ownedPack({
        version: "1.0.1",
        distTags: { latest: "1.0.1" },
        dependencyNames: ["brand-new-typo", "lodash"],
      });
      current.byName.lodash = ownedPack({
        name: "lodash",
        createdAt: new Date(now - 400 * 24 * 60 * 60 * 1000),
      });
      getPackNames.length = 0;
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterOld = await app.request("/api/alerts", { headers: { cookie } });
      expect(((await afterOld.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind)).not.toContain(
        "identity_new_dependency",
      );
      expect(getPackNames).toContain("lodash");
      expect(downloads).toEqual([]);

      current.pack = ownedPack({
        version: "1.0.2",
        distTags: { latest: "1.0.2" },
        dependencyNames: ["brand-new-typo", "lodash", "missing-dep", "fresh-impersonator"],
      });
      current.byName["missing-dep"] = null;
      current.byName["fresh-impersonator"] = ownedPack({
        name: "fresh-impersonator",
        createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      });
      getPackNames.length = 0;
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; body: string }[] };
      const newDep = alertBody.alerts.filter((row) => row.kind === "identity_new_dependency");
      expect(newDep).toHaveLength(1);
      expect(newDep[0]?.body).toMatch(/fresh-impersonator/);
      expect(newDep[0]?.body).toMatch(/not a malware verdict/);
      expect(getPackNames).toEqual(expect.arrayContaining(["fresh-impersonator", "missing-dep"]));
      expect(downloads).toEqual([]);

      const foreign = await app.request("/api/alerts", { headers: { cookie: otherCookie } });
      const foreignBody = (await foreign.json()) as { alerts: { kind: string }[] };
      expect(foreignBody.alerts.map((row) => row.kind)).not.toContain("identity_new_dependency");

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      current.pack = ownedPack({
        version: "1.0.3",
        distTags: { latest: "1.0.3" },
        dependencyNames: ["brand-new-typo", "lodash", "solo-new"],
      });
      current.byName["solo-new"] = ownedPack({
        name: "solo-new",
        createdAt: new Date(now),
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterSolo = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterSolo.json()) as { alerts: { kind: string; body: string }[] }).alerts.filter(
          (row) => row.kind === "identity_new_dependency" && /solo-new/.test(row.body),
        ),
      ).toHaveLength(0);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      current.pack = ownedPack({
        version: "1.0.4",
        distTags: { latest: "1.0.4" },
        dependencyNames: ["brand-new-typo", "lodash", "unpaid-new"],
      });
      current.byName["unpaid-new"] = ownedPack({
        name: "unpaid-new",
        createdAt: new Date(now),
      });
      const unpaidCheck = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaidCheck.status).toBe(402);
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("alerts on a packument unpacked-size jump without downloading", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
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
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const current: {
        pack: NpmPack | null;
        downloads: string[];
      } = {
        pack: ownedPack({ bytes: 100 }),
        downloads,
      };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const baseline = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      expect(
        ((await baseline.json()) as { snapshot: { unpackedBytes: number | null } }).snapshot
          .unpackedBytes,
      ).toBe(100);

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterBaseline = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterBaseline.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("identity_size_jump");

      current.pack = ownedPack({ bytes: 150 });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterSmall = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterSmall.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("identity_size_jump");

      current.pack = ownedPack({ bytes: 301 });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const alerts = await app.request("/api/alerts", { headers: { cookie } });
      const sizeAlerts = (
        (await alerts.json()) as { alerts: { kind: string; body: string }[] }
      ).alerts.filter((row) => row.kind === "identity_size_jump");
      expect(sizeAlerts).toHaveLength(1);
      expect(sizeAlerts[0]?.body).toMatch(/301/);
      expect(sizeAlerts[0]?.body).toMatch(/not a malware verdict/);
      expect(sizeAlerts[0]?.body).toMatch(/unpackedSize/);
      expect(downloads).toEqual([]);

      const identity = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      expect(
        ((await identity.json()) as { snapshot: { unpackedBytes: number | null } }).snapshot
          .unpackedBytes,
      ).toBe(301);

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterDedup = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterDedup.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "identity_size_jump",
        ),
      ).toHaveLength(1);

      current.pack = ownedPack({ bytes: null });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterMissing = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterMissing.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "identity_size_jump",
        ),
      ).toHaveLength(1);

      current.pack = ownedPack({ bytes: 301 });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterRestore = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterRestore.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "identity_size_jump",
        ),
      ).toHaveLength(1);

      const foreign = await app.request("/api/alerts", { headers: { cookie: otherCookie } });
      expect(
        ((await foreign.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("identity_size_jump");

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      current.pack = ownedPack({ bytes: 201 + 5 * 1024 * 1024 });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterSolo = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterSolo.json()) as { alerts: { kind: string; body: string }[] }).alerts.filter(
          (row) => row.kind === "identity_size_jump" && /5243085|5242880/.test(row.body),
        ),
      ).toHaveLength(0);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      current.pack = ownedPack({ bytes: 201 + 5 * 1024 * 1024 });
      const unpaidCheck = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaidCheck.status).toBe(402);
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("alerts when npm attestations disappear or signature keyids change, without fetching", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
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
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const current: { pack: NpmPack | null; downloads: string[] } = {
        pack: ownedPack({
          hasAttestations: true,
          attestationPredicate: "https://slsa.dev/provenance/v1",
          signatureKeyids: ["SHA256:old-key"],
        }),
        downloads,
      };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const baseline = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      const baselineSnap = (
        (await baseline.json()) as {
          snapshot: {
            hasAttestations: boolean | null;
            attestationPredicate: string | null;
            signatureKeyids: string[];
          };
        }
      ).snapshot;
      expect(baselineSnap.hasAttestations).toBe(true);
      expect(baselineSnap.attestationPredicate).toBe("https://slsa.dev/provenance/v1");
      expect(baselineSnap.signatureKeyids).toEqual(["SHA256:old-key"]);

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterBaseline = await app.request("/api/alerts", { headers: { cookie } });
      const afterBaselineKinds = (
        (await afterBaseline.json()) as { alerts: { kind: string }[] }
      ).alerts.map((row) => row.kind);
      expect(afterBaselineKinds).not.toContain("identity_provenance_lost");
      expect(afterBaselineKinds).not.toContain("identity_provenance_changed");
      expect(afterBaselineKinds).not.toContain("identity_signature_changed");

      current.pack = ownedPack({
        hasAttestations: true,
        attestationPredicate: "https://slsa.dev/provenance/v0.2",
        signatureKeyids: ["SHA256:old-key"],
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterPredicate = await app.request("/api/alerts", { headers: { cookie } });
      const predicateAlerts = (
        (await afterPredicate.json()) as { alerts: { kind: string; body: string }[] }
      ).alerts.filter((row) => row.kind === "identity_provenance_changed");
      expect(predicateAlerts).toHaveLength(1);
      expect(predicateAlerts[0]?.body).toMatch(/v0\.2/);
      expect(predicateAlerts[0]?.body).toMatch(/not a signature verification/);

      current.pack = ownedPack({
        hasAttestations: true,
        attestationPredicate: "https://slsa.dev/provenance/v0.2",
        signatureKeyids: ["SHA256:new-key"],
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterKey = await app.request("/api/alerts", { headers: { cookie } });
      const keyAlerts = (
        (await afterKey.json()) as { alerts: { kind: string; body: string }[] }
      ).alerts.filter((row) => row.kind === "identity_signature_changed");
      expect(keyAlerts).toHaveLength(1);
      expect(keyAlerts[0]?.body).toMatch(/SHA256:new-key/);
      expect(keyAlerts[0]?.body).toMatch(/not a signature verification or malware verdict/);

      current.pack = ownedPack({
        version: "1.0.1",
        distTags: { latest: "1.0.1" },
        hasAttestations: false,
        attestationPredicate: null,
        signatureKeyids: ["SHA256:new-key"],
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterLost = await app.request("/api/alerts", { headers: { cookie } });
      const lost = (
        (await afterLost.json()) as { alerts: { kind: string; body: string }[] }
      ).alerts.filter((row) => row.kind === "identity_provenance_lost");
      expect(lost).toHaveLength(1);
      expect(lost[0]?.body).toMatch(/not fetched/);
      expect(lost[0]?.body).toMatch(/not a signature verification or malware verdict/);
      expect(downloads).toEqual([]);

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterDedup = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterDedup.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "identity_provenance_lost",
        ),
      ).toHaveLength(1);

      const foreign = await app.request("/api/alerts", { headers: { cookie: otherCookie } });
      expect(
        ((await foreign.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("identity_provenance_lost");

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      current.pack = ownedPack({
        version: "1.0.2",
        distTags: { latest: "1.0.2" },
        hasAttestations: true,
        attestationPredicate: "https://slsa.dev/provenance/v1",
        signatureKeyids: ["SHA256:solo-key"],
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      current.pack = ownedPack({
        version: "1.0.3",
        distTags: { latest: "1.0.3" },
        hasAttestations: false,
        attestationPredicate: null,
        signatureKeyids: ["SHA256:solo-key"],
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterSolo = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterSolo.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "identity_provenance_lost",
        ),
      ).toHaveLength(1);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaidCheck = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaidCheck.status).toBe(402);
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });

  it("alerts when the npm publisher or trusted publisher changes, without storing email", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
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
      await store.linkUserInstallation(9, "u2");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const downloads: string[] = [];
      const current: { pack: NpmPack | null; downloads: string[] } = {
        pack: ownedPack({ publisherName: "octo", trustedPublisher: null }),
        downloads,
      };
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
        npm: stubNpm(current),
      });

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const baseline = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      const baselineSnap = (
        (await baseline.json()) as {
          snapshot: { publisherName: string | null; trustedPublisher: string | null };
        }
      ).snapshot;
      expect(baselineSnap.publisherName).toBe("octo");
      expect(baselineSnap.trustedPublisher).toBeNull();

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterBaseline = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterBaseline.json()) as { alerts: { kind: string }[] }).alerts.map(
          (row) => row.kind,
        ),
      ).not.toContain("package_publisher_changed");

      current.pack = ownedPack({
        publisherName: "GitHub Actions",
        trustedPublisher: "github",
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterChange = await app.request("/api/alerts", { headers: { cookie } });
      const publisherAlerts = (
        (await afterChange.json()) as { alerts: { kind: string; body: string }[] }
      ).alerts.filter((row) => row.kind === "package_publisher_changed");
      expect(publisherAlerts).toHaveLength(1);
      expect(publisherAlerts[0]?.body).toMatch(/octo/);
      expect(publisherAlerts[0]?.body).toMatch(/GitHub Actions via github/);
      expect(publisherAlerts[0]?.body).toMatch(/not a malware verdict/);
      expect(publisherAlerts[0]?.body).not.toMatch(/npm-oidc-no-reply|@github\.com/);
      expect(downloads).toEqual([]);

      const identity = await app.request(`/api/packages/${packageId}/identity`, {
        headers: { cookie },
      });
      const identitySnap = (
        (await identity.json()) as {
          snapshot: { publisherName: string | null; trustedPublisher: string | null };
        }
      ).snapshot;
      expect(identitySnap.publisherName).toBe("GitHub Actions");
      expect(identitySnap.trustedPublisher).toBe("github");

      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterDedup = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterDedup.json()) as { alerts: { kind: string }[] }).alerts.filter(
          (row) => row.kind === "package_publisher_changed",
        ),
      ).toHaveLength(1);

      const foreign = await app.request("/api/alerts", { headers: { cookie: otherCookie } });
      expect(
        ((await foreign.json()) as { alerts: { kind: string }[] }).alerts.map((row) => row.kind),
      ).not.toContain("package_publisher_changed");

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      current.pack = ownedPack({
        publisherName: "other-maintainer",
        trustedPublisher: null,
      });
      await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      const afterSolo = await app.request("/api/alerts", { headers: { cookie } });
      expect(
        ((await afterSolo.json()) as { alerts: { kind: string; body: string }[] }).alerts.filter(
          (row) => row.kind === "package_publisher_changed" && /other-maintainer/.test(row.body),
        ),
      ).toHaveLength(1);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      current.pack = ownedPack({
        publisherName: "after-unpaid",
        trustedPublisher: "github",
      });
      const unpaidCheck = await app.request(`/api/packages/${packageId}/check`, {
        method: "POST",
        headers: { cookie },
      });
      expect(unpaidCheck.status).toBe(402);
      expect(downloads).toEqual([]);
    } finally {
      await sql.close();
    }
  });
});

describe("identity evidence and consumer advisory", () => {
  it("mints unguessable tokens and redacts public advisory facts", () => {
    const token = mintAdvisoryToken();
    expect(parseAdvisoryToken(token)).toBe(token);
    expect(token).toHaveLength(32);
    expect(parseAdvisoryToken("short")).toBeNull();
    expect(publicAdvisoryPath(token)).toBe(`/advisory/${token}`);
    expect(publicHostFromUrl("git+https://github.com/octo/app.git")).toBe("github.com");
    expect(publicHostFromUrl("https://octo.example/app")).toBe("octo.example");
    expect(publicHostFromUrl("https://127.0.0.1/secret")).toBeNull();
    expect(AUDIT_ACTIONS).toContain("identity.evidence");
    expect(AUDIT_ACTIONS).toContain("identity.publish_advisory");
    expect(AUDIT_ACTIONS).toContain("identity.unpublish_advisory");
    expect(identityEvidencePlanDenied(coverageFrom("2000-01-01T00:00:00Z", null))?.status).toBe(402);
    expect(identityEvidencePlanDenied(coverageFrom(null, "solo"))?.status).toBe(403);
    const assembled = assembleIdentityEvidence({
      packageName: "@octo/app",
      actorLogin: "octo",
      protection: {
        id: 1,
        installation_id: 7,
        package_id: 1,
        verified_via: "scope_match",
        github_repo: "octo/app",
        created_at: "2026-09-02T00:00:00.000Z",
      },
      snapshot: {
        id: 1,
        installation_id: 7,
        package_id: 1,
        version: "1.0.0",
        maintainers: ["octo"],
        repository_url: "https://github.com/octo/app",
        homepage: "https://octo.example/app",
        bin_names: ["app"],
        lifecycle_scripts: [],
        published_at: null,
        dependency_names: [],
        unpacked_bytes: 100,
        has_attestations: false,
        attestation_predicate: null,
        signature_keyids: [],
        publisher_name: "octo",
        trusted_publisher: "github",
        created_at: "2026-09-02T00:00:00.000Z",
      },
      candidates: [
        {
          id: 1,
          installation_id: 7,
          package_id: 1,
          candidate_name: "@oct0/app",
          transformation: "homoglyph",
          first_seen_at: "2026-09-01T00:00:00.000Z",
          last_checked_at: null,
          registered_at: "2026-09-01T00:00:00.000Z",
          last_version: "9.9.9",
          last_published_at: "2026-09-01T00:00:00.000Z",
          allowlisted_at: null,
          allowlist_reason: null,
          allowlisted_by_login: null,
        },
      ],
      alerts: [
        {
          kind: "identity_lookalike_registered",
          title: "Lookalike @oct0/app registered against @octo/app",
        },
      ],
      assembledAt: "2026-09-02T00:00:00.000Z",
    });
    expect(assembled.sent).toBe(false);
    expect(assembled.malwareVerdict).toBe(false);
    expect(assembled.repositoryHost).toBe("github.com");
    expect(assembled.lookalikes[0]?.lastVersion).toBe("9.9.9");
    expect(
      advisoryViewLeaksSecrets({
        path: `/advisory/${token}`,
        packageName: "@octo/app",
        repositoryHost: "github.com",
        homepageHost: "octo.example",
        lookalikes: [{ name: "@oct0/app", transformation: "homoglyph" }],
        assembledAt: "2026-09-02T00:00:00.000Z",
        malwareVerdict: false,
        sent: false,
        disclaimer: EVIDENCE_NOT_MALWARE,
      }),
    ).toBe(false);
    expect(MAX_ADVISORY_PAGES_PER_INSTALL).toBe(40);
  });

  it("assembles redacted evidence, publishes a customer advisory, and never sends it", async () => {
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
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(11, "u3");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const downloads: string[] = [];
      const current = {
        pack: ownedPack({
          identity: {
            ...emptyPackageIdentity(),
            maintainers: ["octo"],
            repositoryUrl: "https://github.com/octo/app",
            homepage: "https://octo.example/app",
          },
          publisherName: "octo",
          trustedPublisher: "github",
        }),
        downloads,
      };
      let woke = 0;
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
        npm: stubNpm(current),
        wakeWorker: () => {
          woke += 1;
        },
      });

      expect((await app.request("/api/packages/1/evidence")).status).toBe(401);
      expect((await app.request("/api/packages/1/evidence", { method: "POST" })).status).toBe(401);
      expect((await app.request("/api/advisory/short")).status).toBe(404);

      const connected = await app.request("/api/packages", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ packageName: "@octo/app", installationId: 7 }),
      });
      const packageId = ((await connected.json()) as { package: { id: number } }).package.id;
      expect(
        (
          await app.request(`/api/packages/${packageId}/protect`, {
            method: "POST",
            headers: { cookie },
          })
        ).status,
      ).toBe(201);

      const unprotected = await store.insertWatchedPackage(7, "left-pad");
      const beforeProtect = await app.request(`/api/packages/${unprotected?.id}/evidence`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "left-pad" }),
      });
      expect(beforeProtect.status).toBe(409);
      expect(((await beforeProtect.json()) as { error: string }).error).toBe(EVIDENCE_UNPROTECTED_ERROR);

      const candidates = await store.listIdentityCandidates(packageId);
      const lookalike = candidates[0];
      expect(lookalike).toBeTruthy();
      await store.recordIdentityCandidatePack({
        id: lookalike!.id,
        registeredAt: "2026-08-01T00:00:00.000Z",
        lastVersion: "9.9.9",
        lastPublishedAt: "2026-08-01T00:00:00.000Z",
      });
      await store.insertAlert({
        installationId: 7,
        kind: "identity_lookalike_registered",
        title: `Lookalike ${lookalike!.candidate_name} registered against @octo/app`,
        body: `Secret tarball ${TARBALL} and email secret@example.com must not appear.`,
      });

      const empty = await app.request(`/api/packages/${packageId}/evidence`, { headers: { cookie } });
      expect(empty.status).toBe(200);
      expect(((await empty.json()) as { evidence: null }).evidence).toBeNull();

      const missingConfirm = await app.request(`/api/packages/${packageId}/evidence`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const memberWrite = await app.request(`/api/packages/${packageId}/evidence`, {
        method: "POST",
        headers: { cookie: memberCookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "@octo/app" }),
      });
      expect(memberWrite.status).toBe(403);
      expect(((await memberWrite.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const otherWrite = await app.request(`/api/packages/${packageId}/evidence`, {
        method: "POST",
        headers: { cookie: otherCookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "@octo/app" }),
      });
      expect(otherWrite.status).toBe(404);

      const assembled = await app.request(`/api/packages/${packageId}/evidence`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "@octo/app" }),
      });
      expect(assembled.status).toBe(201);
      const assembledBody = (await assembled.json()) as {
        evidence: {
          packageName: string;
          sent: false;
          malwareVerdict: false;
          advisory: { enabled: boolean; path: string | null };
          takedown: {
            maintainers: string[];
            publisherName: string | null;
            trustedPublisher: string | null;
            repositoryHost: string | null;
            lookalikes: Array<{ name: string; lastVersion: string | null }>;
            alerts: Array<{ kind: string; title: string; body?: string }>;
            sent: false;
          };
        };
      };
      expect(assembledBody.evidence.packageName).toBe("@octo/app");
      expect(assembledBody.evidence.sent).toBe(false);
      expect(assembledBody.evidence.malwareVerdict).toBe(false);
      expect(assembledBody.evidence.advisory.enabled).toBe(false);
      expect(assembledBody.evidence.takedown.maintainers).toEqual(["octo"]);
      expect(assembledBody.evidence.takedown.publisherName).toBe("octo");
      expect(assembledBody.evidence.takedown.trustedPublisher).toBe("github");
      expect(assembledBody.evidence.takedown.repositoryHost).toBe("github.com");
      expect(assembledBody.evidence.takedown.lookalikes[0]?.lastVersion).toBe("9.9.9");
      expect(assembledBody.evidence.takedown.alerts[0]?.kind).toBe("identity_lookalike_registered");
      expect(assembledBody.evidence.takedown.alerts[0]?.body).toBeUndefined();
      expect(JSON.stringify(assembledBody)).not.toContain(TARBALL);
      expect(JSON.stringify(assembledBody)).not.toContain("secret@example.com");
      expect(downloads).toEqual([]);

      const memberRead = await app.request(`/api/packages/${packageId}/evidence`, {
        headers: { cookie: memberCookie },
      });
      expect(memberRead.status).toBe(200);
      expect(
        ((await memberRead.json()) as { evidence: { packageName: string } }).evidence.packageName,
      ).toBe("@octo/app");
      expect(
        (await app.request(`/api/packages/${packageId}/evidence`, { headers: { cookie: otherCookie } }))
          .status,
      ).toBe(404);

      const publishMissing = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(publishMissing.status).toBe(400);

      const memberPublish = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie: memberCookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: true, confirm: "@octo/app" }),
      });
      expect(memberPublish.status).toBe(403);

      const wokeBeforePublish = woke;
      const published = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: true, confirm: "@octo/app" }),
      });
      expect(published.status).toBe(201);
      const publishedBody = (await published.json()) as {
        evidence: { advisory: { enabled: boolean; path: string | null } };
      };
      const path = publishedBody.evidence.advisory.path;
      expect(path?.startsWith("/advisory/")).toBe(true);
      const token = path!.slice("/advisory/".length);
      expect(woke).toBe(wokeBeforePublish);

      const publicPage = await app.request(`/api/advisory/${token}`);
      expect(publicPage.status).toBe(200);
      const publicBody = (await publicPage.json()) as { advisory: PublicAdvisoryView };
      expect(publicBody.advisory.packageName).toBe("@octo/app");
      expect(publicBody.advisory.repositoryHost).toBe("github.com");
      expect(publicBody.advisory.lookalikes[0]?.name).toBe(lookalike!.candidate_name);
      expect(publicBody.advisory.malwareVerdict).toBe(false);
      expect(publicBody.advisory.sent).toBe(false);
      expect(publicBody.advisory.disclaimer).toBe(EVIDENCE_NOT_MALWARE);
      expect(JSON.stringify(publicBody)).not.toContain(TARBALL);
      expect(JSON.stringify(publicBody)).not.toContain("://");
      expect(JSON.stringify(publicBody)).not.toContain("secret@example.com");
      expect(JSON.stringify(publicBody)).not.toContain("9.9.9");
      expect(advisoryViewLeaksSecrets(publicBody.advisory)).toBe(false);
      expect(woke).toBe(wokeBeforePublish);
      expect((await app.request(`/api/advisory/${mintAdvisoryToken()}`)).status).toBe(404);
      expect(((await (await app.request("/api/advisory/1")).json()) as { error: string }).error).toBe(
        ADVISORY_UNKNOWN_ERROR,
      );

      const unpublished = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: false, confirm: "@octo/app" }),
      });
      expect(unpublished.status).toBe(200);
      expect((await app.request(`/api/advisory/${token}`)).status).toBe(404);

      const republished = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: true, confirm: "@octo/app" }),
      });
      expect(republished.status).toBe(201);
      expect(
        ((await republished.json()) as { evidence: { advisory: { path: string | null } } }).evidence
          .advisory.path,
      ).toBe(path);
      expect((await app.request(`/api/advisory/${token}`)).status).toBe(200);

      const audit = await app.request("/api/audit?installationId=7", { headers: { cookie } });
      const auditBody = (await audit.json()) as {
        rows: Array<{ action: string; targetId: string | null; summary: string }>;
      };
      const actions = auditBody.rows.map((row) => row.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "identity.evidence",
          "identity.publish_advisory",
          "identity.unpublish_advisory",
        ]),
      );
      expect(auditBody.rows.every((row) => row.targetId !== token && !row.summary.includes(token))).toBe(
        true,
      );

      await migrate(sql);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      expect(
        (
          await app.request(`/api/packages/${packageId}/evidence`, {
            method: "POST",
            headers: { cookie, "content-type": "application/json" },
            body: JSON.stringify({ confirm: "@octo/app" }),
          })
        ).status,
      ).toBe(403);
      expect((await app.request(`/api/packages/${packageId}/evidence`, { headers: { cookie } })).status).toBe(
        403,
      );
      expect((await app.request(`/api/advisory/${token}`)).status).toBe(200);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request(`/api/packages/${packageId}/advisory`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ enabled: false, confirm: "@octo/app" }),
      });
      expect(unpaid.status).toBe(402);
      expect((await app.request(`/api/advisory/${token}`)).status).toBe(200);
      expect(downloads).toEqual([]);
      expect(woke).toBe(wokeBeforePublish);
    } finally {
      await sql.close();
    }
  });
});

describe("npm namespace watchlists", () => {
  it("watches an owned npm scope without downloading or auto-watching packs", async () => {
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
        accountType: "Organization",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 3,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(7, "u2");
      await store.linkUserInstallation(11, "u3");
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const memberCookie = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const otherCookie = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const downloads: string[] = [];
      const searchScopes: string[] = [];
      const current = {
        pack: ownedPack(),
        downloads,
        searchScopes,
        scopeNames: {
          "@octo": [{ name: "@octo/app", version: "1.0.0" }],
        },
      };
      let woke = 0;
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
        npm: stubNpm(current),
        wakeWorker: () => {
          woke += 1;
        },
      });

      expect((await app.request("/api/namespaces")).status).toBe(401);
      expect((await app.request("/api/namespaces", { method: "POST" })).status).toBe(401);

      const invalid = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "NOT A SCOPE", confirm: "NOT A SCOPE" }),
      });
      expect(invalid.status).toBe(400);

      const stolen = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@prettier", confirm: "@prettier" }),
      });
      expect(stolen.status).toBe(403);
      expect(((await stolen.json()) as { error: string }).error).toBe(NAMESPACE_OWNED_ERROR);

      const memberProtect = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie: memberCookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@octo", confirm: "@octo" }),
      });
      expect(memberProtect.status).toBe(403);
      expect(((await memberProtect.json()) as { error: string }).error).toBe(ADMIN_REQUIRED_ERROR);

      const otherProtect = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie: otherCookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@octo", confirm: "@octo" }),
      });
      expect(otherProtect.status).toBe(403);

      const created = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@octo", confirm: "@octo" }),
      });
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as {
        queued: boolean;
        namespace: { id: number; scope: string; names: string[] };
      };
      expect(createdBody.queued).toBe(true);
      expect(createdBody.namespace.scope).toBe("@octo");
      expect(createdBody.namespace.names).toEqual([]);
      expect(woke).toBe(1);
      const namespaceId = createdBody.namespace.id;

      const listed = await app.request("/api/namespaces?installationId=7", { headers: { cookie: memberCookie } });
      expect(listed.status).toBe(200);
      expect(((await listed.json()) as { namespaces: { scope: string }[] }).namespaces.map((row) => row.scope)).toEqual([
        "@octo",
      ]);

      const otherList = await app.request("/api/namespaces?installationId=7", {
        headers: { cookie: otherCookie },
      });
      expect(otherList.status).toBe(200);
      expect(((await otherList.json()) as { namespaces: unknown[] }).namespaces).toEqual([]);

      const duplicate = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@octo", confirm: "@octo" }),
      });
      expect(duplicate.status).toBe(409);

      const first = await runNamespaceCheck({
        store,
        npm: stubNpm(current),
        namespaceId,
      });
      expect(first.alerts).toBe(0);
      expect(first.names).toEqual(["@octo/app"]);
      expect(searchScopes).toEqual(["@octo"]);

      current.scopeNames["@octo"] = [
        { name: "@octo/app", version: "1.0.0" },
        { name: "@octo/cli", version: "2.0.0" },
      ];
      const second = await runNamespaceCheck({
        store,
        npm: stubNpm(current),
        namespaceId,
      });
      expect(second.alerts).toBe(1);
      expect(second.names).toEqual(["@octo/app", "@octo/cli"]);

      const alerts = await app.request("/api/alerts?installationId=7", { headers: { cookie } });
      const alertBody = (await alerts.json()) as { alerts: { kind: string; title: string; body: string }[] };
      expect(alertBody.alerts.map((row) => row.kind)).toContain(NAMESPACE_NEW_KIND);
      expect(alertBody.alerts.some((row) => /@octo\/cli/.test(row.title))).toBe(true);
      expect(JSON.stringify(alertBody)).not.toContain("is malware");
      expect(alertBody.alerts.some((row) => /not a malware verdict/.test(row.body))).toBe(true);

      const watched = await app.request("/api/packages?installationId=7", { headers: { cookie } });
      expect(((await watched.json()) as { packages: unknown[] }).packages).toEqual([]);

      const jobs = await sql.query<{ kind: string }>(
        `SELECT kind FROM jobs WHERE kind IN ('namespace_check', 'npm_scan')`,
      );
      expect(jobs.rows.every((row) => row.kind === "namespace_check")).toBe(true);
      expect(jobs.rows.some((row) => row.kind === "npm_scan")).toBe(false);

      await sql.query(`UPDATE jobs SET status = 'done' WHERE kind = 'namespace_check'`);
      const checkNow = await app.request(`/api/namespaces/${namespaceId}/check`, {
        method: "POST",
        headers: { cookie: memberCookie },
      });
      expect(checkNow.status).toBe(200);
      expect(((await checkNow.json()) as { queued: boolean }).queued).toBe(true);

      const missingConfirm = await app.request(`/api/namespaces/${namespaceId}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(CONFIRM_MISSING_ERROR);

      const removed = await app.request(`/api/namespaces/${namespaceId}`, {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "@octo" }),
      });
      expect(removed.status).toBe(200);

      const after = await app.request("/api/namespaces?installationId=7", { headers: { cookie } });
      expect(((await after.json()) as { namespaces: unknown[] }).namespaces).toEqual([]);

      const recreate = await app.request("/api/namespaces", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, scope: "@octo", confirm: "@octo" }),
      });
      expect(recreate.status).toBe(201);

      await sql.query(`UPDATE billing_accounts SET plan = 'solo' WHERE installation_id = 7`);
      const solo = await app.request("/api/namespaces?installationId=7", { headers: { cookie } });
      expect(solo.status).toBe(403);
      expect(((await solo.json()) as { error: string }).error).toBe(NAMESPACE_SOLO_ERROR);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const unpaid = await app.request("/api/namespaces?installationId=7", { headers: { cookie } });
      expect(unpaid.status).toBe(402);
      expect(downloads).toEqual([]);

      const audit = await app.request("/api/audit?installationId=7", { headers: { cookie } });
      expect(audit.status).toBe(402);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = $1, plan = NULL WHERE installation_id = 7`,
        [new Date(Date.now() + 86400000).toISOString()],
      );
      const auditOk = await app.request("/api/audit?installationId=7", { headers: { cookie } });
      const auditBody = (await auditOk.json()) as { rows: { action: string }[] };
      expect(auditBody.rows.map((row) => row.action)).toEqual(
        expect.arrayContaining(["namespace.protect", "namespace.unprotect"]),
      );

      await store.insertAuditEvent({
        installationId: 7,
        actorLogin: "octo",
        action: "namespace.protect",
        summary: "Watched npm scope @octo",
        targetKind: "namespace",
        targetId: "@octo",
      });
      await migrate(sql);
      const remigrated = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM audit_events WHERE action = 'namespace.protect'`,
      );
      expect(Number(remigrated.rows[0]?.n ?? 0)).toBeGreaterThan(0);
    } finally {
      await sql.close();
    }
  });
});

