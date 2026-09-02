import type { NpmAuth, NpmDistTags, NpmPack, NpmPort, WatchDelta } from "./npm.ts";
import { channelScansForDelta, diffWatchedPack, normalizePackageName } from "./npm.ts";
import {
  isPublicNpmOrigin,
  parseRegistryOrigin,
  PUBLIC_NPM_ORIGIN,
} from "./npm-registry.ts";
import {
  checkIdentitySignals,
  IDENTITY_CANDIDATE_STALE_MS,
  identityPlanDeniedFromBilling,
  persistIdentityCandidates,
} from "./identity-signals.ts";
import type { AlertNotifier } from "./notifier.ts";
import {
  diffPackageIdentity,
  describeIdentityChange,
  describePublisherChange,
  emptyPackageIdentity,
  emptyPackageProvenance,
  emptyPackagePublisher,
  provenanceFactsChanged,
  publisherChangeAlertable,
  publisherFactsChanged,
  verifyPackageOwnership,
  type PackageIdentityFacts,
} from "./package-identity.ts";
import type { PackageIdentitySnapshotRow, PackageProtectionRow, Store, WatchedPackageRow } from "./store.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";

export const MAX_WATCHED_PACKAGES = 25;
export const MAX_PROTECTION_IMPORT = 20;

export const PROTECTION_IMPORT_STATUSES = [
  "protected",
  "already_protected",
  "not_owned",
  "not_found",
  "invalid",
  "watch_cap",
] as const;

export type ProtectionImportStatus = (typeof PROTECTION_IMPORT_STATUSES)[number];

export type ProtectionImportRow = {
  name: string;
  status: ProtectionImportStatus;
  packageId: number | null;
  verifiedVia: PackageProtectionRow["verified_via"] | null;
  githubRepo: string | null;
  watched: boolean;
};

export function parseProtectionImportNames(raw: unknown): { input: string; name: string | null }[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\n,]+/)
      : [];
  const seen = new Set<string>();
  const names: { input: string; name: string | null }[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const input = value.trim();
    if (!input) continue;
    const name = normalizePackageName(input);
    if (!name) {
      names.push({ input, name: null });
      if (names.length >= MAX_PROTECTION_IMPORT) break;
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    names.push({ input: name, name });
    if (names.length >= MAX_PROTECTION_IMPORT) break;
  }
  return names;
}

export function npmScanDeliveryId(
  installationId: number,
  packageName: string,
  version: string,
  shasum: string | null,
  registryOrigin: string = PUBLIC_NPM_ORIGIN,
): string {
  return `npm-scan:${installationId}:${registryOrigin}:${packageName}:${version}:${shasum ?? "none"}`;
}

export function npmGoneDeliveryId(
  installationId: number,
  packageName: string,
  lastVersion: string,
  registryOrigin: string = PUBLIC_NPM_ORIGIN,
): string {
  return `npm-gone:${installationId}:${registryOrigin}:${packageName}:${lastVersion}`;
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
  const dependencyNames = pack.dependencyNames ?? [];
  const prevDeps = previous?.dependency_names ?? [];
  const depsChanged =
    prevDeps.length !== dependencyNames.length ||
    dependencyNames.some((name) => !prevDeps.includes(name));
  const unpackedBytes = pack.bytes ?? null;
  const prevBytes = previous?.unpacked_bytes ?? null;
  const sizeChanged = unpackedBytes !== prevBytes;
  const provenance = {
    hasAttestations: pack.hasAttestations ?? false,
    attestationPredicate: pack.attestationPredicate ?? null,
    signatureKeyids: pack.signatureKeyids ?? emptyPackageProvenance().signatureKeyids,
  };
  const provenanceChanged = provenanceFactsChanged(
    previous
      ? {
          hasAttestations: previous.has_attestations,
          attestationPredicate: previous.attestation_predicate,
          signatureKeyids: previous.signature_keyids,
        }
      : null,
    provenance,
  );
  const publisher = {
    publisherName: pack.publisherName ?? emptyPackagePublisher().publisherName,
    trustedPublisher: pack.trustedPublisher ?? emptyPackagePublisher().trustedPublisher,
  };
  const previousPublisher = previous
    ? {
        publisherName: previous.publisher_name,
        trustedPublisher: previous.trusted_publisher,
      }
    : null;
  const publisherChanged = publisherFactsChanged(previousPublisher, publisher);
  if (
    prevFacts &&
    changes.length === 0 &&
    !versionChanged &&
    !depsChanged &&
    !sizeChanged &&
    !provenanceChanged &&
    !publisherChanged
  ) {
    return { snapshot: false, alerts: 0 };
  }
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
    dependencyNames,
    unpackedBytes,
    hasAttestations: provenance.hasAttestations,
    attestationPredicate: provenance.attestationPredicate,
    signatureKeyids: provenance.signatureKeyids,
    publisherName: publisher.publisherName,
    trustedPublisher: publisher.trustedPublisher,
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
  if (previousPublisher && publisherChangeAlertable(previousPublisher, publisher)) {
    const described = describePublisherChange(pkg.package_name, previousPublisher, publisher);
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
  const pack = await npm.getPack(pkg.package_name, auth, { fresh: true });
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

export async function importProtectedPackages(
  store: Store,
  npm: NpmPort,
  input: { installationId: number; names: unknown; registryOrigin?: string },
): Promise<{ results: ProtectionImportRow[]; queued: false }> {
  await requireHostedWork(
    store,
    input.installationId,
    "Coverage ended. Subscribe to protect package identity.",
  );
  const parsed = parseRegistryOrigin(input.registryOrigin?.trim() || PUBLIC_NPM_ORIGIN);
  if (!parsed) {
    throw Object.assign(new Error("That registry origin is not allowed."), { status: 400 });
  }
  const requested = parseProtectionImportNames(input.names);
  if (requested.length === 0) {
    throw Object.assign(new Error("Provide npm package names to protect."), { status: 400 });
  }
  const installation = await store.getInstallation(input.installationId);
  if (!installation) {
    throw Object.assign(new Error("Unknown GitHub installation."), { status: 404 });
  }
  const repos = await store.listReposForInstallation(input.installationId);
  const auth = await authForPackage(store, {
    installation_id: input.installationId,
    registry_origin: parsed.origin,
  });
  const billing = await store.installationBilling(input.installationId);
  const teamSignals = !identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
  let watchedCount = await store.countWatchedPackages(input.installationId);
  const results: ProtectionImportRow[] = [];
  for (const request of requested) {
    const name = request.name;
    if (!name) {
      results.push({
        name: request.input,
        status: "invalid",
        packageId: null,
        verifiedVia: null,
        githubRepo: null,
        watched: false,
      });
      continue;
    }
    const existing = await store.getWatchedPackageByName(input.installationId, name, parsed.origin);
    if (existing) {
      const already = await store.getPackageProtection(existing.id);
      if (already) {
        results.push({
          name,
          status: "already_protected",
          packageId: existing.id,
          verifiedVia: already.verified_via,
          githubRepo: already.github_repo,
          watched: true,
        });
        continue;
      }
    }
    let pack: NpmPack | null = null;
    try {
      pack = await npm.getPack(name, auth, { fresh: true });
    } catch {
      pack = null;
    }
    if (!pack) {
      results.push({
        name,
        status: "not_found",
        packageId: existing?.id ?? null,
        verifiedVia: null,
        githubRepo: null,
        watched: Boolean(existing),
      });
      continue;
    }
    const proof = verifyPackageOwnership({
      packageName: name,
      repositoryUrl: identityOf(pack).repositoryUrl,
      installationAccountLogin: installation.account_login,
      installationRepos: repos,
    });
    if (!proof) {
      results.push({
        name,
        status: "not_owned",
        packageId: existing?.id ?? null,
        verifiedVia: null,
        githubRepo: null,
        watched: Boolean(existing),
      });
      continue;
    }
    let pkg = existing;
    if (!pkg) {
      if (watchedCount >= MAX_WATCHED_PACKAGES) {
        results.push({
          name,
          status: "watch_cap",
          packageId: null,
          verifiedVia: null,
          githubRepo: null,
          watched: false,
        });
        continue;
      }
      pkg = await store.insertWatchedPackage(input.installationId, name, parsed.origin);
      if (!pkg) {
        pkg = await store.getWatchedPackageByName(input.installationId, name, parsed.origin);
      }
      if (!pkg) {
        results.push({
          name,
          status: "invalid",
          packageId: null,
          verifiedVia: null,
          githubRepo: null,
          watched: false,
        });
        continue;
      }
      watchedCount += 1;
      await store.touchWatchedPackage(pkg.id, {
        version: pack.version,
        distTags: pack.distTags,
        tarballUrl: pack.tarballUrl,
        shasum: pack.shasum,
      });
    }
    const protection = await store.insertPackageProtection({
      installationId: input.installationId,
      packageId: pkg.id,
      verifiedVia: proof.via,
      githubRepo: proof.githubRepo,
    });
    if (!protection) {
      const already = await store.getPackageProtection(pkg.id);
      results.push({
        name,
        status: "already_protected",
        packageId: pkg.id,
        verifiedVia: already?.verified_via ?? proof.via,
        githubRepo: already?.github_repo ?? proof.githubRepo,
        watched: true,
      });
      continue;
    }
    await syncProtectedIdentity(store, pkg, pack);
    if (teamSignals) await persistIdentityCandidates(store, pkg);
    results.push({
      name,
      status: "protected",
      packageId: pkg.id,
      verifiedVia: protection.verified_via,
      githubRepo: protection.github_repo,
      watched: true,
    });
  }
  return { results, queued: false };
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

async function enqueueNpmScan(
  store: Store,
  pkg: WatchedPackageRow,
  input: {
    version: string;
    tarballUrl: string;
    shasum: string | null;
    reason: string;
    distTag?: string;
  },
): Promise<boolean> {
  const result = await store.enqueueJob({
    deliveryId: npmScanDeliveryId(
      pkg.installation_id,
      pkg.package_name,
      input.version,
      input.shasum,
      pkg.registry_origin,
    ),
    priority: "heavy",
    kind: "npm_scan",
    payload: {
      installationId: pkg.installation_id,
      packageId: pkg.id,
      packageName: pkg.package_name,
      registryOrigin: pkg.registry_origin,
      version: input.version,
      tarballUrl: input.tarballUrl,
      shasum: input.shasum,
      reason: input.reason,
      ...(input.distTag ? { distTag: input.distTag } : {}),
    },
  });
  return result.inserted;
}

async function enqueueChannelScans(
  store: Store,
  pkg: WatchedPackageRow,
  pack: NpmPack,
  previousTags: NpmDistTags | null | undefined,
): Promise<boolean> {
  let queued = false;
  for (const row of channelScansForDelta(previousTags, pack)) {
    if (
      await enqueueNpmScan(store, pkg, {
        version: row.version,
        tarballUrl: row.tarballUrl,
        shasum: row.shasum,
        reason: "channel_tarball",
        distTag: row.tag,
      })
    ) {
      queued = true;
    }
  }
  return queued;
}

async function enqueueFromDelta(
  store: Store,
  pkg: WatchedPackageRow,
  pack: NpmPack,
  delta: WatchDelta,
  previousTags: NpmDistTags | null | undefined,
): Promise<boolean> {
  if (delta.type === "unchanged" || delta.type === "unpublished") return false;
  if (delta.type === "dist_tags") {
    const scanned = await enqueueChannelScans(store, pkg, pack, delta.from);
    if (scanned) return true;
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
  const latest = await enqueueNpmScan(store, pkg, {
    version: pack.version,
    tarballUrl: pack.tarballUrl,
    shasum: pack.shasum,
    reason: delta.type,
  });
  const extra = await enqueueChannelScans(
    store,
    pkg,
    pack,
    delta.type === "first" ? null : previousTags,
  );
  return latest || extra;
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
  const pack = await npm.getPack(packageName, auth, { fresh: true });
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
  const queued = await enqueueFromDelta(store, inserted, pack, { type: "first" }, null);
  return { package: inserted, queued };
}

async function noteMissingWatchedPack(
  store: Store,
  pkg: WatchedPackageRow,
  notifier?: AlertNotifier,
): Promise<{ queued: boolean; deltas: WatchDelta[] }> {
  const lastVersion = pkg.last_version?.trim();
  if (!lastVersion) {
    await store.touchWatchedPackage(pkg.id, {});
    return { queued: false, deltas: [{ type: "unchanged" }] };
  }
  const origin = pkg.registry_origin || PUBLIC_NPM_ORIGIN;
  const payload = {
    installationId: pkg.installation_id,
    packageName: pkg.package_name,
    kind: "package_unpublished",
    title: `npm ${pkg.package_name} is no longer on the registry`,
    body: `${pkg.package_name} last recorded as ${lastVersion} is gone from ${origin}. This is a registry fact, not a malware verdict.`,
    githubDeliveryId: npmGoneDeliveryId(
      pkg.installation_id,
      pkg.package_name,
      lastVersion,
      origin,
    ),
  };
  if (notifier) await notifier.send(payload);
  else await store.insertAlert(payload);
  await store.touchWatchedPackage(pkg.id, {});
  return { queued: false, deltas: [{ type: "unpublished" }] };
}

export async function checkWatchedPackage(
  store: Store,
  npm: NpmPort,
  pkg: WatchedPackageRow,
  notifier?: AlertNotifier,
  opts?: { candidateStaleMs?: number },
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
  let pack: NpmPack | null = null;
  try {
    pack = await npm.getPack(pkg.package_name, auth, { fresh: true });
  } catch {
    await store.touchWatchedPackage(pkg.id, {});
    return { queued: false, deltas: [{ type: "unchanged" }] };
  }
  if (!pack) {
    return await noteMissingWatchedPack(store, pkg, notifier);
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
  await checkIdentitySignals({
    store,
    npm,
    notifier,
    pkg,
    pack,
    previous,
    auth,
    candidateStaleMs: opts?.candidateStaleMs,
  });
  let queued = false;
  for (const delta of deltas) {
    if (await enqueueFromDelta(store, pkg, pack, delta, pkg.last_dist_tags)) queued = true;
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
    const result = await checkWatchedPackage(deps.store, deps.npm, pkg, deps.notifier, {
      candidateStaleMs: IDENTITY_CANDIDATE_STALE_MS,
    });
    if (result.queued) queued += 1;
  }
  return { checked, queued };
}
