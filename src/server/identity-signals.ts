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
import type { PackageIdentitySnapshotRow, Store, WatchedPackageRow } from "./store.ts";

export const IDENTITY_CANDIDATE_CAP = 40;
export const IDENTITY_CANDIDATES_PER_PASS = 8;
export const DORMANT_IDLE_MS = 180 * 24 * 60 * 60 * 1000;
export const BURST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const BURST_VERSION_COUNT = 5;
export const VERSION_JUMP_MAJOR = 3;
export const NEW_DEPENDENCY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const NEW_DEPENDENCY_CHECKS_PER_PASS = 8;
export const MAX_ALLOWLIST_REASON = 200;

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
        "Coverage ended. Subscribe to Team for lookalike, dormant, new-dependency, and packument-size package signals.",
      status: 402,
    };
  }
  if (coverage.plan === "solo") {
    return {
      error: "Lookalike, dormant, burst, new-dependency, and packument-size signals are on Team.",
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
}): Promise<number> {
  const due = await input.store.listDueIdentityCandidates(input.pkg.id, IDENTITY_CANDIDATES_PER_PASS);
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
  alerts += await checkPackumentSize(input);
  alerts += await checkNewDependencies(input);
  alerts += await checkLookalikeCandidates(input);
  return alerts;
}
