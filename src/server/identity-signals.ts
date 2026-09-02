import { coverageFrom, type Coverage } from "../coverage.ts";
import { SIZE_JUMP_BYTES, SIZE_JUMP_RATIO } from "../release-diff.ts";
import {
  normalizePackageName,
  parseRegistryTimes,
  unpackedBytesFromClaim,
  type NpmAuth,
  type NpmPack,
  type NpmPort,
} from "./npm.ts";
import type { AlertNotifier } from "./notifier.ts";
import {
  diffPackageIdentity,
  publisherChangeAlertable,
  type PackageIdentityFacts,
  type PackagePublisherFacts,
} from "./package-identity.ts";
import type { IdentityCandidateRow, PackageIdentitySnapshotRow, Store, WatchedPackageRow } from "./store.ts";

export const IDENTITY_CANDIDATE_CAP = 40;
export const IDENTITY_CANDIDATES_PER_PASS = 8;
export const IDENTITY_CANDIDATE_STALE_MS = 60 * 60 * 1000;
export const DORMANT_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
export const BURST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const BURST_VERSION_COUNT = 5;
export const VERSION_JUMP_MAJOR = 3;
export const NEW_DEPENDENCY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const NEW_DEPENDENCY_CHECKS_PER_PASS = 8;
export const MAX_ALLOWLIST_REASON = 200;
export const IDENTITY_RISK_MAX = 100;
export const IDENTITY_RISK_LOOKALIKE_CAP = 3;
export const IDENTITY_RISK_NOT_MALWARE =
  "Identity signal total from current facts. Not a malware verdict.";

/** Event-only signals that snapshots cannot recompute without another registry fetch. */
export const IDENTITY_RISK_OPEN_ALERT_KINDS = [
  "identity_burst",
  "identity_lookalike_version",
  "identity_new_dependency",
  "package_unpublished",
] as const;

export const IDENTITY_RISK_POINTS: Record<string, number> = {
  identity_lookalike_registered: 12,
  identity_lookalike_version: 6,
  identity_dormant: 16,
  identity_burst: 8,
  identity_jump: 8,
  identity_new_dependency: 10,
  identity_size_jump: 8,
  identity_provenance_lost: 14,
  identity_provenance_changed: 8,
  identity_signature_changed: 8,
  package_maintainer_changed: 14,
  package_publisher_changed: 14,
  package_repository_mismatch: 10,
  package_homepage_mismatch: 6,
  package_shape_anomaly: 10,
  package_unpublished: 16,
};

export const IDENTITY_RISK_TITLES: Record<string, string> = {
  identity_lookalike_registered: "Registered lookalike names",
  identity_lookalike_version: "Lookalike published a new version",
  identity_dormant: "Dormant package published again",
  identity_burst: "Many versions in seven days",
  identity_jump: "Major version jumped",
  identity_new_dependency: "New dependency first published recently",
  identity_size_jump: "Packument unpacked size jumped",
  identity_provenance_lost: "npm provenance disappeared",
  identity_provenance_changed: "npm provenance predicate changed",
  identity_signature_changed: "Registry signature keyids changed",
  package_maintainer_changed: "Maintainer added or removed",
  package_publisher_changed: "Publishing identity changed",
  package_repository_mismatch: "Repository field changed",
  package_homepage_mismatch: "Homepage field changed",
  package_shape_anomaly: "New bin or install script",
  package_unpublished: "Package missing from the registry",
};

export type IdentityRiskSignal = {
  kind: string;
  count: number;
  points: number;
  title: string;
};

export type IdentityRiskScore = {
  total: number;
  max: typeof IDENTITY_RISK_MAX;
  malwareVerdict: false;
  note: typeof IDENTITY_RISK_NOT_MALWARE;
  signals: IdentityRiskSignal[];
};

export const IDENTITY_TRANSFORMATIONS = [
  "homoglyph",
  "adjacent_key",
  "separator",
  "token_order",
  "scope_confusion",
  "edit_distance",
] as const;

export type IdentityTransformation = (typeof IDENTITY_TRANSFORMATIONS)[number];

export type IdentityCandidate = {
  name: string;
  transformation: IdentityTransformation;
};

const TRANSFORM_RANK: Record<IdentityTransformation, number> = {
  homoglyph: 0,
  adjacent_key: 1,
  separator: 2,
  token_order: 3,
  scope_confusion: 4,
  edit_distance: 5,
};

const HOMOGLYPHS: Record<string, string[]> = {
  "0": ["o"],
  o: ["0"],
  "1": ["l", "i"],
  i: ["1", "l"],
  l: ["1", "i"],
  m: ["rn"],
};

const EDIT_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

function adjacentNeighbors(): Record<string, string> {
  const sets: Record<string, Set<string>> = {};
  const add = (a: string, b: string) => {
    (sets[a] ??= new Set()).add(b);
    (sets[b] ??= new Set()).add(a);
  };
  for (const row of ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"]) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) add(row[i], row[i - 1]);
      if (i + 1 < row.length) add(row[i], row[i + 1]);
    }
  }
  return Object.fromEntries(
    Object.entries(sets).map(([key, values]) => [key, [...values].sort().join("")]),
  );
}

const ADJACENT = adjacentNeighbors();

function splitScope(name: string): { prefix: string; rest: string } {
  if (name.startsWith("@")) {
    const slash = name.indexOf("/");
    if (slash > 1 && slash < name.length - 1) {
      return { prefix: name.slice(0, slash + 1), rest: name.slice(slash + 1) };
    }
  }
  return { prefix: "", rest: name };
}

function isSkippableNameChar(ch: string): boolean {
  return ch === "@" || ch === "/";
}

export function identityPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return {
      error:
        "Coverage ended. Subscribe to Team for lookalike, dormant, new-dependency, packument-size, provenance, and namespace package signals.",
      status: 402,
    };
  }
  if (coverage.plan === "solo") {
    return {
      error:
        "Lookalike, dormant, burst, new-dependency, packument-size, provenance, and namespace signals are on Team.",
      status: 403,
    };
  }
  return null;
}

export function identityPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return identityPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function parseAllowlistReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const reason = raw.trim();
  if (!reason || reason.length > MAX_ALLOWLIST_REASON) return null;
  return reason;
}

export { parseRegistryTimes };

export function scoreIdentityRisk(
  signals: Array<{ kind: string; count?: number }>,
): IdentityRiskScore {
  const byKind = new Map<string, number>();
  for (const signal of signals) {
    if (!(signal.kind in IDENTITY_RISK_POINTS)) continue;
    const add = Math.max(1, signal.count ?? 1);
    byKind.set(signal.kind, (byKind.get(signal.kind) ?? 0) + add);
  }
  const rows: IdentityRiskSignal[] = [...byKind.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => {
      const unit = IDENTITY_RISK_POINTS[kind] ?? 0;
      const used =
        kind === "identity_lookalike_registered"
          ? Math.min(count, IDENTITY_RISK_LOOKALIKE_CAP)
          : 1;
      return {
        kind,
        count: used,
        points: unit * used,
        title: IDENTITY_RISK_TITLES[kind] ?? kind,
      };
    })
    .filter((row) => row.points > 0);
  const total = Math.min(
    IDENTITY_RISK_MAX,
    rows.reduce((sum, row) => sum + row.points, 0),
  );
  return {
    total,
    max: IDENTITY_RISK_MAX,
    malwareVerdict: false,
    note: IDENTITY_RISK_NOT_MALWARE,
    signals: rows,
  };
}

function snapshotIdentityFacts(row: PackageIdentitySnapshotRow): PackageIdentityFacts {
  return {
    maintainers: row.maintainers,
    repositoryUrl: row.repository_url,
    homepage: row.homepage,
    binNames: row.bin_names,
    lifecycleScripts: row.lifecycle_scripts,
  };
}

function snapshotPublisherFacts(row: PackageIdentitySnapshotRow): PackagePublisherFacts {
  return {
    publisherName: row.publisher_name,
    trustedPublisher: row.trusted_publisher,
  };
}

export function identityRiskSignalsFromFacts(input: {
  previous: PackageIdentitySnapshotRow | null;
  latest: PackageIdentitySnapshotRow | null;
  registeredLookalikes: number;
  openAlertKinds: string[];
}): Array<{ kind: string; count?: number }> {
  const signals: Array<{ kind: string; count?: number }> = [];
  if (input.registeredLookalikes > 0) {
    signals.push({
      kind: "identity_lookalike_registered",
      count: input.registeredLookalikes,
    });
  }
  const open = new Set(input.openAlertKinds);
  for (const kind of IDENTITY_RISK_OPEN_ALERT_KINDS) {
    if (open.has(kind)) signals.push({ kind });
  }
  if (!input.latest || !input.previous) return signals;
  const changes = diffPackageIdentity(
    snapshotIdentityFacts(input.previous),
    snapshotIdentityFacts(input.latest),
  );
  const seen = new Set<string>();
  for (const change of changes) {
    const kind =
      change.kind === "maintainers"
        ? "package_maintainer_changed"
        : change.kind === "repository"
          ? "package_repository_mismatch"
          : change.kind === "homepage"
            ? "package_homepage_mismatch"
            : "package_shape_anomaly";
    if (seen.has(kind)) continue;
    seen.add(kind);
    signals.push({ kind });
  }
  if (publisherChangeAlertable(snapshotPublisherFacts(input.previous), snapshotPublisherFacts(input.latest))) {
    signals.push({ kind: "package_publisher_changed" });
  }
  if (unpackedSizeJump(input.previous.unpacked_bytes, input.latest.unpacked_bytes)) {
    signals.push({ kind: "identity_size_jump" });
  }
  const previousHas = input.previous.has_attestations;
  const nextHas = input.latest.has_attestations;
  if (previousHas === true && nextHas === false) {
    signals.push({ kind: "identity_provenance_lost" });
  } else if (
    previousHas === true &&
    nextHas === true &&
    input.previous.attestation_predicate &&
    input.latest.attestation_predicate &&
    input.previous.attestation_predicate !== input.latest.attestation_predicate
  ) {
    signals.push({ kind: "identity_provenance_changed" });
  }
  const previousKeys = [...(input.previous.signature_keyids ?? [])].sort();
  const nextKeys = [...(input.latest.signature_keyids ?? [])].sort();
  if (previousKeys.length > 0 && !sameKeyids(previousKeys, nextKeys)) {
    signals.push({ kind: "identity_signature_changed" });
  }
  const previousPublished = snapshotPublishedAt(input.previous);
  const latestPublished = snapshotPublishedAt(input.latest);
  const versionChanged = Boolean(
    input.previous.version && input.latest.version && input.previous.version !== input.latest.version,
  );
  if (previousPublished && versionChanged) {
    const end = latestPublished ?? new Date(input.latest.created_at);
    if (end.getTime() - previousPublished.getTime() >= DORMANT_IDLE_MS) {
      signals.push({ kind: "identity_dormant" });
    }
  }
  if (input.previous.version && input.latest.version) {
    const fromMajor = majorVersion(input.previous.version);
    const toMajor = majorVersion(input.latest.version);
    if (fromMajor !== null && toMajor !== null && toMajor >= fromMajor + VERSION_JUMP_MAJOR) {
      signals.push({ kind: "identity_jump" });
    }
  }
  return signals;
}

export function registeredLookalikeCount(candidates: IdentityCandidateRow[]): number {
  return candidates.filter((row) => row.registered_at && !row.allowlisted_at).length;
}

export async function loadIdentityRiskScore(
  store: Store,
  pkg: Pick<WatchedPackageRow, "id" | "installation_id" | "package_name">,
): Promise<IdentityRiskScore | null> {
  const protection = await store.getPackageProtection(pkg.id);
  if (!protection) return null;
  const snapshots = await store.listRecentPackageIdentitySnapshots(pkg.id, 2);
  const candidates = await store.listIdentityCandidates(pkg.id);
  const openAlertKinds = await store.listOpenIdentityAlertsForPackage(
    pkg.installation_id,
    pkg.package_name,
    IDENTITY_RISK_OPEN_ALERT_KINDS,
  );
  return scoreIdentityRisk(
    identityRiskSignalsFromFacts({
      latest: snapshots[0] ?? null,
      previous: snapshots[1] ?? null,
      registeredLookalikes: registeredLookalikeCount(candidates),
      openAlertKinds,
    }),
  );
}

export function majorVersion(version: string): number | null {
  const match = version.trim().replace(/^v/i, "").match(/^(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function addCandidate(
  byName: Map<string, IdentityCandidate>,
  original: string,
  raw: string,
  transformation: IdentityTransformation,
): void {
  const name = normalizePackageName(raw);
  if (!name || name === original) return;
  if (byName.has(name)) return;
  byName.set(name, { name, transformation });
}

function homoglyphCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  for (let i = 0; i < original.length - 1; i++) {
    if (isSkippableNameChar(original[i]) || isSkippableNameChar(original[i + 1])) continue;
    if (original[i] === "r" && original[i + 1] === "n") {
      addCandidate(byName, original, `${original.slice(0, i)}m${original.slice(i + 2)}`, "homoglyph");
    }
  }
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (isSkippableNameChar(ch)) continue;
    for (const replacement of HOMOGLYPHS[ch] ?? []) {
      addCandidate(
        byName,
        original,
        `${original.slice(0, i)}${replacement}${original.slice(i + 1)}`,
        "homoglyph",
      );
    }
  }
}

function adjacentKeyCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (isSkippableNameChar(ch)) continue;
    const neighbors = ADJACENT[ch] ?? "";
    for (const next of neighbors) {
      addCandidate(
        byName,
        original,
        `${original.slice(0, i)}${next}${original.slice(i + 1)}`,
        "adjacent_key",
      );
    }
  }
}

function separatorCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  for (let i = 0; i < original.length; i++) {
    const ch = original[i];
    if (ch !== "-" && ch !== "_" && ch !== ".") continue;
    for (const next of ["-", "_", "."]) {
      if (next === ch) continue;
      addCandidate(
        byName,
        original,
        `${original.slice(0, i)}${next}${original.slice(i + 1)}`,
        "separator",
      );
    }
    addCandidate(byName, original, `${original.slice(0, i)}${original.slice(i + 1)}`, "separator");
  }
}

function tokenOrderCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  const { prefix, rest } = splitScope(original);
  const parts = rest.split(/[-_.]/).filter(Boolean);
  if (parts.length < 2) return;
  const seps = rest.match(/[-_.]/g) ?? [];
  if (seps.length !== parts.length - 1) return;
  for (let i = 0; i < parts.length - 1; i++) {
    const swapped = [...parts];
    const left = swapped[i];
    const right = swapped[i + 1];
    swapped[i] = right;
    swapped[i + 1] = left;
    let rebuilt = swapped[0];
    for (let j = 0; j < seps.length; j++) {
      rebuilt += seps[j] + swapped[j + 1];
    }
    addCandidate(byName, original, `${prefix}${rebuilt}`, "token_order");
  }
}

function scopeConfusionCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  if (!original.startsWith("@")) return;
  const slash = original.indexOf("/");
  if (slash < 2 || slash === original.length - 1) return;
  const scope = original.slice(1, slash);
  const pkg = original.slice(slash + 1);
  if (!scope || !pkg) return;
  addCandidate(byName, original, `${scope}-${pkg}`, "scope_confusion");
  addCandidate(byName, original, `${scope}.${pkg}`, "scope_confusion");
  addCandidate(byName, original, `${scope}_${pkg}`, "scope_confusion");
  addCandidate(byName, original, `@${pkg}/${scope}`, "scope_confusion");
}

function editDistanceCandidates(original: string, byName: Map<string, IdentityCandidate>): void {
  for (let i = 0; i < original.length; i++) {
    if (isSkippableNameChar(original[i])) continue;
    addCandidate(
      byName,
      original,
      `${original.slice(0, i)}${original.slice(i + 1)}`,
      "edit_distance",
    );
  }
  let substituted = 0;
  for (let i = 0; i < original.length && substituted < 4; i++) {
    const ch = original[i];
    if (isSkippableNameChar(ch) || !EDIT_CHARSET.includes(ch)) continue;
    substituted += 1;
    for (const next of EDIT_CHARSET) {
      if (next === ch) continue;
      addCandidate(
        byName,
        original,
        `${original.slice(0, i)}${next}${original.slice(i + 1)}`,
        "edit_distance",
      );
    }
  }
}

export function generateIdentityCandidates(packageName: string): IdentityCandidate[] {
  const original = normalizePackageName(packageName);
  if (!original) return [];
  const byName = new Map<string, IdentityCandidate>();
  homoglyphCandidates(original, byName);
  adjacentKeyCandidates(original, byName);
  separatorCandidates(original, byName);
  tokenOrderCandidates(original, byName);
  scopeConfusionCandidates(original, byName);
  editDistanceCandidates(original, byName);
  return [...byName.values()]
    .sort(
      (left, right) =>
        TRANSFORM_RANK[left.transformation] - TRANSFORM_RANK[right.transformation] ||
        left.name.localeCompare(right.name),
    )
    .slice(0, IDENTITY_CANDIDATE_CAP);
}

export async function persistIdentityCandidates(
  store: Store,
  pkg: Pick<WatchedPackageRow, "id" | "installation_id" | "package_name">,
): Promise<number> {
  const candidates = generateIdentityCandidates(pkg.package_name);
  if (candidates.length === 0) return 0;
  return await store.insertIdentityCandidates({
    installationId: pkg.installation_id,
    packageId: pkg.id,
    candidates,
  });
}

async function emitAlert(
  store: Store,
  notifier: AlertNotifier | undefined,
  alert: {
    installationId: number;
    packageName: string;
    kind: string;
    title: string;
    body: string;
    githubDeliveryId: string;
  },
): Promise<void> {
  const payload = {
    installationId: alert.installationId,
    packageName: alert.packageName,
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    githubDeliveryId: alert.githubDeliveryId,
  };
  if (notifier) {
    await notifier.send(payload);
    return;
  }
  await store.insertAlert(payload);
}

function snapshotPublishedAt(row: PackageIdentitySnapshotRow | null): Date | null {
  if (!row?.published_at) return null;
  const at = new Date(row.published_at);
  return Number.isNaN(at.getTime()) ? null : at;
}

function snapshotDependencyNames(row: PackageIdentitySnapshotRow | null): string[] {
  return row?.dependency_names ?? [];
}

export function unpackedSizeJump(
  previousBytes: number | null | undefined,
  nextBytes: number | null | undefined,
): { from: number; to: number; delta: number } | null {
  const from = unpackedBytesFromClaim(previousBytes);
  const to = unpackedBytesFromClaim(nextBytes);
  if (from === null || to === null || from <= 0) return null;
  const delta = to - from;
  if (to > from * SIZE_JUMP_RATIO || delta >= SIZE_JUMP_BYTES) {
    return { from, to, delta };
  }
  return null;
}

function addedDependencyNames(previous: string[], current: string[]): string[] {
  const seen = new Set(previous);
  return current.filter((name) => !seen.has(name)).sort();
}

function sameKeyids(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((keyid, index) => keyid === right[index]);
}

async function checkProvenancePresence(input: {
  store: Store;
  notifier?: AlertNotifier;
  pkg: WatchedPackageRow;
  pack: NpmPack;
  previous: PackageIdentitySnapshotRow | null;
}): Promise<number> {
  if (!input.previous) return 0;
  let alerts = 0;
  const previousHas = input.previous.has_attestations;
  const nextHas = input.pack.hasAttestations ?? false;
  const previousPredicate = input.previous.attestation_predicate ?? null;
  const nextPredicate = input.pack.attestationPredicate ?? null;
  if (previousHas === true && nextHas === false) {
    await emitAlert(input.store, input.notifier, {
      installationId: input.pkg.installation_id,
      packageName: input.pkg.package_name,
      kind: "identity_provenance_lost",
      title: `npm provenance disappeared from ${input.pkg.package_name}`,
      body: `${input.pkg.package_name} ${input.pack.version} no longer lists npm attestations on the packument. This is a presence fact, not a signature verification or malware verdict. The attestation URL was not fetched.`,
      githubDeliveryId: `identity-provenance-lost:${input.pkg.installation_id}:${input.pkg.package_name}:${input.pack.version}`,
    });
    alerts += 1;
  } else if (
    previousHas === true &&
    nextHas === true &&
    previousPredicate &&
    nextPredicate &&
    previousPredicate !== nextPredicate
  ) {
    await emitAlert(input.store, input.notifier, {
      installationId: input.pkg.installation_id,
      packageName: input.pkg.package_name,
      kind: "identity_provenance_changed",
      title: `npm provenance predicate changed on ${input.pkg.package_name}`,
      body: `${input.pkg.package_name} packument provenance predicate was ${previousPredicate} and is now ${nextPredicate}. This is a metadata fact, not a signature verification or malware verdict. The attestation URL was not fetched.`,
      githubDeliveryId: `identity-provenance:${input.pkg.installation_id}:${input.pkg.package_name}:${previousPredicate}->${nextPredicate}`,
    });
    alerts += 1;
  }
  const previousKeys = [...(input.previous.signature_keyids ?? [])].sort();
  const nextKeys = [...(input.pack.signatureKeyids ?? [])].sort();
  if (previousKeys.length > 0 && !sameKeyids(previousKeys, nextKeys)) {
    await emitAlert(input.store, input.notifier, {
      installationId: input.pkg.installation_id,
      packageName: input.pkg.package_name,
      kind: "identity_signature_changed",
      title: `npm registry signature key changed on ${input.pkg.package_name}`,
      body: `${input.pkg.package_name} packument signature keyids were ${previousKeys.join(", ")} and are now ${nextKeys.length > 0 ? nextKeys.join(", ") : "(none)"}. This is a keyid presence fact, not a signature verification or malware verdict. Signature values were not stored.`,
      githubDeliveryId: `identity-sig:${input.pkg.installation_id}:${input.pkg.package_name}:${previousKeys.join(",") || "none"}->${nextKeys.join(",") || "none"}`,
    });
    alerts += 1;
  }
  return alerts;
}

async function checkPackumentSize(input: {
  store: Store;
  notifier?: AlertNotifier;
  pkg: WatchedPackageRow;
  pack: NpmPack;
  previous: PackageIdentitySnapshotRow | null;
}): Promise<number> {
  const jump = unpackedSizeJump(input.previous?.unpacked_bytes, input.pack.bytes);
  if (!jump) return 0;
  await emitAlert(input.store, input.notifier, {
    installationId: input.pkg.installation_id,
    packageName: input.pkg.package_name,
    kind: "identity_size_jump",
    title: `npm ${input.pkg.package_name} unpacked size jumped`,
    body: `${input.pkg.package_name} registry unpacked size went from ${jump.from} to ${jump.to} bytes (${jump.delta >= 0 ? "+" : ""}${jump.delta}). This is the packument dist.unpackedSize claim, not a downloaded measurement. This is not a malware verdict.`,
    githubDeliveryId: `identity-size:${input.pkg.installation_id}:${input.pkg.package_name}:${jump.from}->${jump.to}`,
  });
  return 1;
}

async function checkNewDependencies(input: {
  store: Store;
  npm: NpmPort;
  notifier?: AlertNotifier;
  pkg: WatchedPackageRow;
  pack: NpmPack;
  previous: PackageIdentitySnapshotRow | null;
  auth?: NpmAuth;
}): Promise<number> {
  const previousNames = snapshotDependencyNames(input.previous);
  if (previousNames.length === 0) return 0;
  const currentNames = (input.pack.dependencyNames ?? [])
    .map((name) => normalizePackageName(name))
    .filter((name): name is string => Boolean(name));
  const added = addedDependencyNames(previousNames, currentNames).slice(
    0,
    NEW_DEPENDENCY_CHECKS_PER_PASS,
  );
  let alerts = 0;
  for (const dependencyName of added) {
    let pack: NpmPack | null = null;
    try {
      pack = await input.npm.getPack(dependencyName, input.auth);
    } catch {
      pack = null;
    }
    if (!pack?.createdAt) continue;
    const createdMs = pack.createdAt.getTime();
    if (Number.isNaN(createdMs)) continue;
    if (Date.now() - createdMs > NEW_DEPENDENCY_MAX_AGE_MS) continue;
    await emitAlert(input.store, input.notifier, {
      installationId: input.pkg.installation_id,
      packageName: input.pkg.package_name,
      kind: "identity_new_dependency",
      title: `npm ${input.pkg.package_name} added newly created dependency ${dependencyName}`,
      body: `${input.pkg.package_name} now depends on ${dependencyName}, first published on npm within 14 days. This is a dependency-graph fact, not a malware verdict.`,
      githubDeliveryId: `identity-new-dep:${input.pkg.installation_id}:${input.pkg.package_name}:${dependencyName}`,
    });
    alerts += 1;
  }
  return alerts;
}

async function checkLookalikeCandidates(input: {
  store: Store;
  npm: NpmPort;
  notifier?: AlertNotifier;
  pkg: WatchedPackageRow;
  auth?: NpmAuth;
  candidateStaleMs?: number;
}): Promise<number> {
  const staleBefore =
    input.candidateStaleMs && input.candidateStaleMs > 0
      ? new Date(Date.now() - input.candidateStaleMs)
      : null;
  const due = await input.store.listDueIdentityCandidates(
    input.pkg.id,
    IDENTITY_CANDIDATES_PER_PASS,
    staleBefore,
  );
  let alerts = 0;
  for (const row of due) {
    let pack: NpmPack | null = null;
    try {
      pack = await input.npm.getPack(row.candidate_name, input.auth);
    } catch {
      pack = null;
    }
    if (!pack) {
      await input.store.touchIdentityCandidateCheck(row.id);
      continue;
    }
    const publishedAt = pack.publishedAt ?? null;
    const firstSeen = !row.registered_at;
    const newVersion = Boolean(row.last_version && row.last_version !== pack.version);
    await input.store.recordIdentityCandidatePack({
      id: row.id,
      registeredAt: row.registered_at ?? new Date().toISOString(),
      lastVersion: pack.version,
      lastPublishedAt: publishedAt,
    });
    if (firstSeen) {
      await emitAlert(input.store, input.notifier, {
        installationId: input.pkg.installation_id,
        packageName: input.pkg.package_name,
        kind: "identity_lookalike_registered",
        title: `Lookalike npm name registered: ${row.candidate_name}`,
        body: `${row.candidate_name} is registered on npm (transformation ${row.transformation} of ${input.pkg.package_name}). This is a fact, not a malware verdict. Human review is required before any advisory or takedown.`,
        githubDeliveryId: `identity-lookalike:${input.pkg.installation_id}:${row.candidate_name}:${pack.version}`,
      });
      alerts += 1;
    } else if (newVersion) {
      await emitAlert(input.store, input.notifier, {
        installationId: input.pkg.installation_id,
        packageName: input.pkg.package_name,
        kind: "identity_lookalike_version",
        title: `Lookalike npm ${row.candidate_name} published ${pack.version}`,
        body: `${row.candidate_name} published ${pack.version} (transformation ${row.transformation} of ${input.pkg.package_name}). This is a fact, not a malware verdict. Human review is required before any advisory or takedown.`,
        githubDeliveryId: `identity-lookalike-ver:${input.pkg.installation_id}:${row.candidate_name}:${pack.version}`,
      });
      alerts += 1;
    }
  }
  return alerts;
}

export async function checkIdentitySignals(input: {
  store: Store;
  npm: NpmPort;
  notifier?: AlertNotifier;
  pkg: WatchedPackageRow;
  pack: NpmPack;
  previous: PackageIdentitySnapshotRow | null;
  auth?: NpmAuth;
  candidateStaleMs?: number;
}): Promise<number> {
  const protection = await input.store.getPackageProtection(input.pkg.id);
  if (!protection) return 0;
  const billing = await input.store.installationBilling(input.pkg.installation_id);
  if (identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan)) return 0;
  await persistIdentityCandidates(input.store, input.pkg);
  let alerts = 0;
  const previousPublished = snapshotPublishedAt(input.previous);
  const versionChanged = Boolean(
    input.previous?.version && input.previous.version !== input.pack.version,
  );
  if (previousPublished && versionChanged) {
    const idleMs = Date.now() - previousPublished.getTime();
    if (idleMs >= DORMANT_IDLE_MS) {
      const days = Math.floor(idleMs / (24 * 60 * 60 * 1000));
      await emitAlert(input.store, input.notifier, {
        installationId: input.pkg.installation_id,
        packageName: input.pkg.package_name,
        kind: "identity_dormant",
        title: `Dormant npm ${input.pkg.package_name} published ${input.pack.version}`,
        body: `${input.pkg.package_name} published ${input.pack.version} after ${days} days without a recorded publish. This is a resurrection signal, not a malware verdict.`,
        githubDeliveryId: `identity-dormant:${input.pkg.installation_id}:${input.pkg.package_name}:${input.pack.version}`,
      });
      alerts += 1;
    }
  }
  const recent = input.pack.recentVersions ?? [];
  if (recent.length >= BURST_VERSION_COUNT) {
    const newest = recent[recent.length - 1]?.version ?? input.pack.version;
    await emitAlert(input.store, input.notifier, {
      installationId: input.pkg.installation_id,
      packageName: input.pkg.package_name,
      kind: "identity_burst",
      title: `npm ${input.pkg.package_name} published ${recent.length} versions in 7 days`,
      body: `${input.pkg.package_name} has ${recent.length} versions with registry timestamps in the last 7 days. This is a cadence fact, not a malware verdict.`,
      githubDeliveryId: `identity-burst:${input.pkg.installation_id}:${input.pkg.package_name}:${newest}:${recent.length}`,
    });
    alerts += 1;
  }
  if (input.previous?.version) {
    const fromMajor = majorVersion(input.previous.version);
    const toMajor = majorVersion(input.pack.version);
    if (
      fromMajor !== null &&
      toMajor !== null &&
      toMajor >= fromMajor + VERSION_JUMP_MAJOR
    ) {
      await emitAlert(input.store, input.notifier, {
        installationId: input.pkg.installation_id,
        packageName: input.pkg.package_name,
        kind: "identity_jump",
        title: `npm ${input.pkg.package_name} version jumped from ${input.previous.version} to ${input.pack.version}`,
        body: `${input.pkg.package_name} latest moved from ${input.previous.version} to ${input.pack.version} (major increased by ${VERSION_JUMP_MAJOR} or more). This is a cadence fact, not a malware verdict.`,
        githubDeliveryId: `identity-jump:${input.pkg.installation_id}:${input.pkg.package_name}:${input.previous.version}->${input.pack.version}`,
      });
      alerts += 1;
    }
  }
  alerts += await checkProvenancePresence(input);
  alerts += await checkPackumentSize(input);
  alerts += await checkNewDependencies(input);
  alerts += await checkLookalikeCandidates(input);
  return alerts;
}
