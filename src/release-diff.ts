import type { Finding, ManifestEntry } from "./scanner/types.ts";
import { findingFingerprint } from "./receipt.ts";

export type ManifestChange = {
  path: string;
  previousSize: number | null;
  nextSize: number | null;
  previousSha256: string | null;
  nextSha256: string | null;
};

export type ReleaseDiff = {
  added: ManifestChange[];
  removed: ManifestChange[];
  changed: ManifestChange[];
  sizeDelta: number;
  unexpectedSizeJump: boolean;
  newFindings: string[];
  resolvedFindings: string[];
};

const SIZE_JUMP_RATIO = 2;
const SIZE_JUMP_BYTES = 5 * 1024 * 1024;

export function diffManifests(previous: ManifestEntry[], next: ManifestEntry[]): ReleaseDiff {
  const prevMap = new Map(previous.map((entry) => [entry.path, entry]));
  const nextMap = new Map(next.map((entry) => [entry.path, entry]));
  const added: ManifestChange[] = [];
  const removed: ManifestChange[] = [];
  const changed: ManifestChange[] = [];

  for (const entry of next) {
    const prior = prevMap.get(entry.path);
    if (!prior) {
      added.push({
        path: entry.path,
        previousSize: null,
        nextSize: entry.size,
        previousSha256: null,
        nextSha256: entry.sha256,
      });
      continue;
    }
    if (prior.sha256 !== entry.sha256 || prior.size !== entry.size) {
      changed.push({
        path: entry.path,
        previousSize: prior.size,
        nextSize: entry.size,
        previousSha256: prior.sha256,
        nextSha256: entry.sha256,
      });
    }
  }

  for (const entry of previous) {
    if (!nextMap.has(entry.path)) {
      removed.push({
        path: entry.path,
        previousSize: entry.size,
        nextSize: null,
        previousSha256: entry.sha256,
        nextSha256: null,
      });
    }
  }

  added.sort((left, right) => left.path.localeCompare(right.path));
  removed.sort((left, right) => left.path.localeCompare(right.path));
  changed.sort((left, right) => left.path.localeCompare(right.path));

  const previousBytes = previous.reduce((sum, entry) => sum + entry.size, 0);
  const nextBytes = next.reduce((sum, entry) => sum + entry.size, 0);
  const sizeDelta = nextBytes - previousBytes;
  const unexpectedSizeJump =
    previousBytes > 0 &&
    (nextBytes > previousBytes * SIZE_JUMP_RATIO || sizeDelta >= SIZE_JUMP_BYTES);

  return {
    added,
    removed,
    changed,
    sizeDelta,
    unexpectedSizeJump,
    newFindings: [],
    resolvedFindings: [],
  };
}

export function diffFingerprints(
  previous: string[],
  next: string[],
): Pick<ReleaseDiff, "newFindings" | "resolvedFindings"> {
  const prevSet = new Set(previous);
  const nextSet = new Set(next);
  return {
    newFindings: [...nextSet].filter((fingerprint) => !prevSet.has(fingerprint)).sort(),
    resolvedFindings: [...prevSet].filter((fingerprint) => !nextSet.has(fingerprint)).sort(),
  };
}

export function diffFindings(
  previous: Finding[],
  next: Finding[],
): Pick<ReleaseDiff, "newFindings" | "resolvedFindings"> {
  return diffFingerprints(previous.map(findingFingerprint), next.map(findingFingerprint));
}

export function mergeReleaseDiff(
  manifests: ReleaseDiff,
  findings: Pick<ReleaseDiff, "newFindings" | "resolvedFindings">,
): ReleaseDiff {
  return { ...manifests, ...findings };
}
