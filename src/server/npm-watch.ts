import type { NpmAuth, NpmPack, NpmPort, WatchDelta } from "./npm.ts";
import { diffWatchedPack, normalizePackageName } from "./npm.ts";
import {
  isPublicNpmOrigin,
  parseRegistryOrigin,
  PUBLIC_NPM_ORIGIN,
} from "./npm-registry.ts";
import {
  checkIdentitySignals,
  identityPlanDeniedFromBilling,
  persistIdentityCandidates,
} from "./identity-signals.ts";
import type { AlertNotifier } from "./notifier.ts";
import {
  diffPackageIdentity,
  describeIdentityChange,
  emptyPackageIdentity,
  verifyPackageOwnership,
  type PackageIdentityFacts,
} from "./package-identity.ts";
import type { PackageIdentitySnapshotRow, PackageProtectionRow, Store, WatchedPackageRow } from "./store.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";

export const MAX_WATCHED_PACKAGES = 25;

export function npmScanDeliveryId(
  installationId: number,
  packageName: string,
  version: string,
  shasum: string | null,
  registryOrigin: string = PUBLIC_NPM_ORIGIN,
): string {
  return `npm-scan:${installationId}:${registryOrigin}:${packageName}:${version}:${shasum ?? "none"}`;
}

export function npmDistTagDeliveryId(
  installationId: number,
  packageName: string,
  tags: Record<string, string>,
  registryOrigin: string = PUBLIC_NPM_ORIGIN,
): string {
  const key = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, version]) => `${tag}=${version}`)
    .join(",");
  return `npm-dist-tag:${installationId}:${registryOrigin}:${packageName}:${key}`;
}

function factsFromSnapshot(row: PackageIdentitySnapshotRow): PackageIdentityFacts {
  return {
    maintainers: row.maintainers,
    repositoryUrl: row.repository_url,
    homepage: row.homepage,
    binNames: row.bin_names,
    lifecycleScripts: row.lifecycle_scripts,
  };
}

function identityOf(pack: NpmPack): PackageIdentityFacts {
  return pack.identity ?? emptyPackageIdentity();
}

export async function syncProtectedIdentity(
  store: Store,
  pkg: WatchedPackageRow,
  pack: NpmPack,
  notifier?: AlertNotifier,
): Promise<{ snapshot: boolean; alerts: number }> {
  const protection = await store.getPackageProtection(pkg.id);
  if (!protection) return { snapshot: false, alerts: 0 };
  const identity = identityOf(pack);
  const previous = await store.latestPackageIdentitySnapshot(pkg.id);
  const prevFacts = previous ? factsFromSnapshot(previous) : null;
  const changes = diffPackageIdentity(prevFacts, identity);
  const versionChanged = Boolean(previous?.version && previous.version !== pack.version);
  if (prevFacts && changes.length === 0 && !versionChanged) return { snapshot: false, alerts: 0 };
  await store.insertPackageIdentitySnapshot({
    installationId: pkg.installation_id,
    packageId: pkg.id,
    version: pack.version,
    maintainers: identity.maintainers,
    repositoryUrl: identity.repositoryUrl,
    homepage: identity.homepage,
    binNames: identity.binNames,
    lifecycleScripts: identity.lifecycleScripts,
    publishedAt: pack.publishedAt ?? null,
  });
  let alerts = 0;
  for (const change of changes) {
    const described = describeIdentityChange(pkg.package_name, change);
    const payload = {
      installationId: pkg.installation_id,
      packageName: pkg.package_name,
      kind: described.kind,
      title: described.title,
      body: described.body,
    };
    if (notifier) await notifier.send(payload);
    else await store.insertAlert(payload);
    alerts += 1;
  }
  return { snapshot: true, alerts };
}

async function requireHostedWork(
  store: Store,
  installationId: number,
  unpaidMessage: string,
): Promise<void> {
  const block = await store.installationWorkBlock(installationId);
  if (!block) return;
  const denied = httpErrorForWorkBlock(block, unpaidMessage);
  throw Object.assign(new Error(denied.message), { status: denied.status });
}

export async function protectWatchedPackage(
  store: Store,
  npm: NpmPort,
  pkg: WatchedPackageRow,
): Promise<{ protection: PackageProtectionRow; snapshot: boolean }> {
  await requireHostedWork(
    store,
    pkg.installation_id,
    "Coverage ended. Subscribe to protect package identity.",
  );
  const existing = await store.getPackageProtection(pkg.id);
  if (existing) {
    throw Object.assign(new Error("That package is already protected on this install."), {
      status: 409,
    });
  }
  const installation = await store.getInstallation(pkg.installation_id);
  if (!installation) {
    throw Object.assign(new Error("Unknown GitHub installation."), { status: 404 });
  }
  const auth = await authForPackage(store, pkg);
  const pack = await npm.getPack(pkg.package_name, auth);
  if (!pack) {
    throw Object.assign(new Error(`npm has no package named ${pkg.package_name}.`), { status: 404 });
  }
  const repos = await store.listReposForInstallation(pkg.installation_id);
  const proof = verifyPackageOwnership({
    packageName: pkg.package_name,
    repositoryUrl: identityOf(pack).repositoryUrl,
    installationAccountLogin: installation.account_login,
    installationRepos: repos,
  });
  if (!proof) {
    throw Object.assign(
      new Error(
        "Protect only packages whose npm scope or GitHub repository field matches this install. Naming an arbitrary pack is not ownership.",
      ),
      { status: 403 },
    );
  }
  const protection = await store.insertPackageProtection({
    installationId: pkg.installation_id,
    packageId: pkg.id,
    verifiedVia: proof.via,
    githubRepo: proof.githubRepo,
  });
  if (!protection) {
    throw Object.assign(new Error("That package is already protected on this install."), {
      status: 409,
    });
  }
  const synced = await syncProtectedIdentity(store, pkg, pack);
  const billing = await store.installationBilling(pkg.installation_id);
  if (!identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan)) {
    await persistIdentityCandidates(store, pkg);
  }
  return { protection, snapshot: synced.snapshot };
}

async function authForPackage(
  store: Store,
  pkg: Pick<WatchedPackageRow, "installation_id" | "registry_origin">,
): Promise<NpmAuth | undefined> {
  const origin = pkg.registry_origin || PUBLIC_NPM_ORIGIN;
  if (isPublicNpmOrigin(origin)) return undefined;
  const saved = await store.getNpmRegistryAuth(pkg.installation_id, origin);
  if (!saved) {
    throw Object.assign(
      new Error("Save an encrypted token for that private registry before watching a pack."),
      { status: 400 },
    );
  }
  return { registryOrigin: saved.origin, token: saved.token };
}

async function enqueueFromDelta(
  store: Store,
  pkg: WatchedPackageRow,
  pack: NpmPack,
  delta: WatchDelta,
): Promise<boolean> {
  if (delta.type === "unchanged") return false;
  if (delta.type === "dist_tags") {
    const result = await store.enqueueJob({
      deliveryId: npmDistTagDeliveryId(
        pkg.installation_id,
        pkg.package_name,
        pack.distTags,
        pkg.registry_origin,
      ),
      priority: "light",
      kind: "npm_dist_tag",
      payload: {
        installationId: pkg.installation_id,
        packageId: pkg.id,
        packageName: pkg.package_name,
        registryOrigin: pkg.registry_origin,
        distTags: pack.distTags,
        previousDistTags: delta.from,
      },
    });
    return result.inserted;
  }
  const result = await store.enqueueJob({
    deliveryId: npmScanDeliveryId(
      pkg.installation_id,
      pkg.package_name,
      pack.version,
      pack.shasum,
      pkg.registry_origin,
    ),
    priority: "heavy",
    kind: "npm_scan",
    payload: {
      installationId: pkg.installation_id,
      packageId: pkg.id,
      packageName: pkg.package_name,
      registryOrigin: pkg.registry_origin,
      version: pack.version,
      tarballUrl: pack.tarballUrl,
      shasum: pack.shasum,
      reason: delta.type,
    },
  });
  return result.inserted;
}

export async function connectWatchedPackage(
  store: Store,
  npm: NpmPort,
  input: { installationId: number; packageName: string; registryOrigin?: string },
): Promise<{ package: WatchedPackageRow; queued: boolean }> {
  const packageName = normalizePackageName(input.packageName);
  if (!packageName) {
    throw new Error("Use an npm package name, like left-pad or @scope/name.");
  }
  const parsed = parseRegistryOrigin(input.registryOrigin?.trim() || PUBLIC_NPM_ORIGIN);
  if (!parsed) {
    throw Object.assign(new Error("That registry origin is not allowed."), { status: 400 });
  }
  await requireHostedWork(
    store,
    input.installationId,
    "Coverage ended. Subscribe to keep watching npm packages.",
  );
  const count = await store.countWatchedPackages(input.installationId);
  if (count >= MAX_WATCHED_PACKAGES) {
    throw Object.assign(
      new Error(`This install already watches ${MAX_WATCHED_PACKAGES} packages.`),
      { status: 400 },
    );
  }
  const auth = await authForPackage(store, {
    installation_id: input.installationId,
    registry_origin: parsed.origin,
  });
  const pack = await npm.getPack(packageName, auth);
  if (!pack) {
    throw Object.assign(
      new Error(
        isPublicNpmOrigin(parsed.origin)
          ? `npm has no public package named ${packageName}.`
          : `That registry has no package named ${packageName}.`,
      ),
      { status: 404 },
    );
  }
  const inserted = await store.insertWatchedPackage(input.installationId, packageName, parsed.origin);
  if (!inserted) {
    throw Object.assign(new Error("That package is already on this install."), { status: 409 });
  }
  await store.touchWatchedPackage(inserted.id, {
    version: pack.version,
    distTags: pack.distTags,
    tarballUrl: pack.tarballUrl,
    shasum: pack.shasum,
  });
  const queued = await enqueueFromDelta(store, inserted, pack, { type: "first" });
  return { package: inserted, queued };
}

export async function checkWatchedPackage(
  store: Store,
  npm: NpmPort,
  pkg: WatchedPackageRow,
  notifier?: AlertNotifier,
): Promise<{ queued: boolean; deltas: WatchDelta[] }> {
  if (!(await store.installationWorkAllowed(pkg.installation_id))) {
    await store.touchWatchedPackage(pkg.id, {});
    return { queued: false, deltas: [{ type: "unchanged" }] };
  }
  let auth: NpmAuth | undefined;
  try {
    auth = await authForPackage(store, pkg);
  } catch {
    await store.touchWatchedPackage(pkg.id, {});
    return { queued: false, deltas: [{ type: "unchanged" }] };
  }
  const pack = await npm.getPack(pkg.package_name, auth);
  if (!pack) {
    await store.touchWatchedPackage(pkg.id, {});
    return { queued: false, deltas: [{ type: "unchanged" }] };
  }
  const deltas = diffWatchedPack(
    {
      version: pkg.last_version,
      shasum: pkg.last_shasum,
      distTags: pkg.last_dist_tags,
    },
    pack,
  );
  await store.touchWatchedPackage(pkg.id, {
    version: pack.version,
    distTags: pack.distTags,
    tarballUrl: pack.tarballUrl,
    shasum: pack.shasum,
  });
  const previous = await store.latestPackageIdentitySnapshot(pkg.id);
  await syncProtectedIdentity(store, pkg, pack, notifier);
  await checkIdentitySignals({ store, npm, notifier, pkg, pack, previous, auth });
  let queued = false;
  for (const delta of deltas) {
    if (await enqueueFromDelta(store, pkg, pack, delta)) queued = true;
  }
  return { queued, deltas };
}

export async function runNpmWatchPoll(deps: {
  store: Store;
  npm: NpmPort;
  notifier?: AlertNotifier;
}): Promise<{ checked: number; queued: number }> {
  const packages = await deps.store.listAllWatchedPackages();
  let checked = 0;
  let queued = 0;
  for (const pkg of packages) {
    checked += 1;
    const result = await checkWatchedPackage(deps.store, deps.npm, pkg, deps.notifier);
    if (result.queued) queued += 1;
  }
  return { checked, queued };
}
