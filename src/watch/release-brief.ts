import type { ReleaseRevision } from "./types.ts";

export type ReleaseProofTone = "clean" | "blocked" | "waiting" | "not-configured";

export type ReleaseProofStep = {
  key: "artifact" | "identity" | "delivery" | "governance";
  label: string;
  summary: string;
  status: string;
  tone: ReleaseProofTone;
  applicable: boolean;
  evidenceLabel: string;
  evidence: string;
};

export type ReleaseBriefModel = {
  blocked: boolean;
  ready: boolean;
  title: string;
  detail: string;
  status: import('../assurance/types.ts').Decision;
  applicableChecks: number;
  cleanChecks: number;
  steps: ReleaseProofStep[];
};

/** Present the server assessment; raw receipt status is execution evidence, not readiness. */
export function buildReleaseBriefModel(release: ReleaseRevision): ReleaseBriefModel {
  const candidate = release.readiness;
  const assessment = candidate?.version === 1 && candidate.releaseId === release.id && candidate.receiptId === release.receiptId && !candidate.preview ? candidate : undefined;
  const state = assessment?.beforeDeploy ?? 'unknown';
  const definitions = [
    ['artifact', 'scan', 'Artifact scanned', 'Packed bytes and recorded policy'],
    ['identity', 'attestations', 'Source identity', 'Recorded attestation metadata'],
    ['delivery', 'delivery', 'After-deployment observation', 'Attached URLs, scope and freshness'],
    ['governance', 'governance', 'Release governance', 'Approval decision and legal hold'],
  ] as const;
  const steps: ReleaseProofStep[] = definitions.map(([key, id, label, summary]) => {
    const check = assessment?.checks.find(item => item.id === id);
    const checkState = check?.state ?? 'unknown';
    return {
      key, label, summary,
      status: checkState === 'passed' ? 'Recorded pass' : checkState === 'failed' ? 'Needs action' : checkState === 'review' ? 'Review metadata' : checkState === 'stale' ? 'Stale' : checkState === 'not-configured' ? 'Not configured' : 'Unknown',
      tone: checkState === 'passed' ? 'clean' : checkState === 'failed' ? 'blocked' : checkState === 'not-configured' ? 'not-configured' : 'waiting',
      applicable: Boolean(check && checkState !== 'not-configured' && key !== 'identity' && key !== 'delivery'),
      evidenceLabel: label,
      evidence: check?.detail ?? 'A verified server assessment is unavailable. The saved scan status alone does not establish readiness.',
    };
  });
  const before = assessment?.checks.filter(check => check.phase === 'before-deploy' && check.id !== 'attestations' && check.state !== 'not-configured') ?? [];
  return {
    blocked: state === 'blocked', ready: state === 'ready', status: state,
    title: assessment?.title ?? 'Evidence is incomplete',
    detail: assessment?.summary ?? 'No verified release assessment is available. Unknown is not a passing decision.',
    applicableChecks: before.length,
    cleanChecks: before.filter(check => check.state === 'passed').length,
    steps,
  };
}

export function releaseFamily(coordinate: string): string {
  const hash = coordinate.indexOf("#");
  const withoutSuffix = hash >= 0 ? coordinate.slice(0, hash) : coordinate;
  const at = withoutSuffix.lastIndexOf("@");
  return at > 0 ? withoutSuffix.slice(0, at) : withoutSuffix;
}

/** Match the scanner's typed source coordinate, never a substring of another source. */
export function latestSourceRelease(
  source: { kind: string; name: string },
  releases: ReleaseRevision[],
): ReleaseRevision | null {
  const prefix = source.kind === "github" ? "github:" : source.kind === "npm" ? "npm:" : source.kind === "website" ? "web:" : null;
  if (!prefix) return null;
  const expected = `${prefix}${source.name}`;
  const matches = releases.filter((release) => {
    if (source.kind === "website") {
      try {
        if (!release.coordinate.startsWith(prefix)) return false;
        return new URL(release.coordinate.slice(prefix.length)).href === new URL(source.name).href;
      } catch { return false; }
    }
    return releaseFamily(release.coordinate).toLowerCase() === expected.toLowerCase();
  });
  return matches.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id - a.id)[0] ?? null;
}
