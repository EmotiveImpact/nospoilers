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
  previousBytes: number;
  nextBytes: number;
  sizeDelta: number;
  unexpectedSizeJump: boolean;
  newFindings: string[];
  resolvedFindings: string[];
};

export const SIZE_JUMP_RATIO = 2;
export const SIZE_JUMP_BYTES = 5 * 1024 * 1024;
export const SIZE_JUMP_RULE = "SIZE-003";

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
    previousBytes,
    nextBytes,
    sizeDelta,
    unexpectedSizeJump,
    newFindings: [],
    resolvedFindings: [],
  };
}

export function sizeJumpFinding(input: {
  previousBytes: number;
  nextBytes: number;
  sizeDelta: number;
  comparedTo: "baseline" | "previous";
  path: string;
}): Finding {
  const label = input.comparedTo === "baseline" ? "approved baseline" : "previous scan";
  const delta = `${input.sizeDelta >= 0 ? "+" : ""}${input.sizeDelta}`;
  return {
    rule: SIZE_JUMP_RULE,
    severity: "warn",
    path: input.path,
    title: "Unpacked size jumped versus the last approved or previous scan",
    detail: `Unpacked payload is ${input.nextBytes} bytes versus ${input.previousBytes} on the ${label} (${delta} bytes). A 2× or 5 MiB jump is how a source map ships.`,
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
