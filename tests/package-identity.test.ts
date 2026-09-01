import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  emptyPackageIdentity,
  githubRepoFromNpmRepository,
  verifyPackageOwnership,
} from "../src/server/package-identity.ts";
import { packFromRegistry, type NpmPack, type NpmPort } from "../src/server/npm.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

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

function stubNpm(current: { pack: NpmPack | null }): NpmPort {
  return {
    getPack: async () => current.pack,
    downloadTarball: async () => {
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
      versions: {
        "1.0.0": {
          dist: { tarball: TARBALL, shasum: "abc123" },
          bin: { app: "bin/app.js" },
          scripts: { postinstall: "node scripts/leak.js", test: "echo ok" },
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
        snapshot: { maintainers: string[]; binNames: string[] };
      };
      expect(identityBody.snapshot.maintainers).toEqual(["octo"]);
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
