import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  generateIdentityCandidates,
  identityPlanDenied,
  unpackedSizeJump,
  IDENTITY_CANDIDATE_CAP,
} from "../src/server/identity-signals.ts";
import {
  emptyPackageIdentity,
  githubRepoFromNpmRepository,
  verifyPackageOwnership,
} from "../src/server/package-identity.ts";
import { packFromRegistry, unpackedBytesFromClaim, type NpmPack, type NpmPort } from "../src/server/npm.ts";
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
          dist: { tarball: TARBALL, shasum: "abc123", unpackedSize: 4096 },
          bin: { app: "bin/app.js" },
          scripts: { postinstall: "node scripts/leak.js", test: "echo ok" },
          dependencies: { lodash: "^4.17.21" },
          optionalDependencies: { "left-pad": "1.3.0" },
          devDependencies: { typescript: "^5.0.0" },
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
        };
      };
      expect(identityBody.snapshot.maintainers).toEqual(["octo"]);
      expect(identityBody.snapshot.dependencyNames).toEqual([]);
      expect(identityBody.snapshot.unpackedBytes).toBe(100);
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
});

