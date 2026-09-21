import type {EvidenceSnapshot, ReceiptEvidence, ReleaseEvidence} from './types.ts';

export const MAX_MANIFEST = 25_000;
export const MAX_FINDINGS = 25_000;
export const MAX_CLOCK_SKEW_MS = 60_000;
const SHA256 = /^[a-f0-9]{64}$/i;
const CHANNELS = new Set(['stable', 'beta', 'canary']);
export const isDigest = (value: unknown): value is string => typeof value === 'string' && SHA256.test(value);
export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export function recordedTime(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
}
function boundedStrings(value: unknown, max = MAX_FINDINGS): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' && item.length <= 4096);
}
/** Verify signature separately on the server. This validator checks semantic consistency too. */
export function readReceipt(value: unknown): ReceiptEvidence | null {
  if (!isRecord(value) || !isDigest(value.artifactSha256) || typeof value.coordinate !== 'string' || !value.coordinate || value.coordinate.length > 2048) return null;
  if (typeof value.engineVersion !== 'string' || !value.engineVersion || value.engineVersion.length > 100 || recordedTime(value.scannedAt) === null) return null;
  if (!['passed', 'failed-policy', 'inconclusive'].includes(String(value.status)) || typeof value.ok !== 'boolean') return null;
  if ((value.status === 'passed') !== value.ok || (value.status === 'passed' && value.inconclusiveReason)) return null;
  if (value.inconclusiveReason !== null && typeof value.inconclusiveReason !== 'string') return null;
  if (value.policyHash !== null && !isDigest(value.policyHash)) return null;
  if (!isCount(value.findingCount) || !isCount(value.suppressedCount) || !boundedStrings(value.findingFingerprints) || !boundedStrings(value.suppressedFingerprints)) return null;
  if (!boundedStrings(value.findingRuleIds, 1000) || !value.findingRuleIds.every(rule => /^[A-Z][A-Z0-9_-]{1,39}$/.test(rule))) return null;
  if (value.findingCount !== value.findingFingerprints.length || value.suppressedCount !== value.suppressedFingerprints.length) return null;
  if (value.status === 'failed-policy' && value.findingCount === 0) return null;
  if (value.artifactBytes !== null && !isCount(value.artifactBytes)) return null;
  if (value.channel !== undefined && !CHANNELS.has(String(value.channel))) return null;
  if (!Array.isArray(value.manifest) || value.manifest.length > MAX_MANIFEST) return null;
  const paths = new Set<string>();
  for (const file of value.manifest) {
    if (!isRecord(file) || typeof file.path !== 'string' || !file.path || file.path.length > 4096 || /[\x00-\x1f\x7f]/.test(file.path) || !isCount(file.size) || !isDigest(file.sha256)) return null;
    if (paths.has(file.path)) return null;
    paths.add(file.path);
  }
  return value as unknown as ReceiptEvidence;
}
/** A file name or arbitrary CI coordinate does not establish a stable product identity. */
export function sourceKey(coordinate: string): string | null {
  if (coordinate.startsWith('web:')) {
    try {
      const url = new URL(coordinate.slice(4));
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
      return `web:${url.href}`;
    } catch { return null; }
  }
  if (/[\x00-\x1f\x7f]/.test(coordinate) || coordinate.length > 2048) return null;
  const github = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:@[^#]+)?(#.+)?$/.exec(coordinate);
  if (github) return `github:${github[1].toLowerCase()}${github[2] ?? ''}`;
  const npm = /^npm:((?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)(?:@[^#]+)?(#.+)?$/.exec(coordinate);
  return npm ? `npm:${npm[1]}${npm[2] ?? ''}` : null;
}
export function evidenceProblem(snapshot: EvidenceSnapshot, now: number): string | null {
  const {receipt, release} = snapshot;
  if (!Number.isFinite(now) || !snapshot.scopeKey || snapshot.scopeKey.length > 256) return 'Evidence scope or evaluation time is unavailable.';
  if (snapshot.signature !== 'verified') return snapshot.signature === 'invalid' ? 'The receipt signature could not be verified.' : 'Receipt verification is unavailable.';
  if (!receipt || !readReceipt(receipt)) return 'The recorded receipt is incomplete or inconsistent.';
  if (!isDigest(release.artifactSha256) || release.artifactSha256.toLowerCase() !== receipt.artifactSha256.toLowerCase()) return 'The receipt is not bound to this artefact digest.';
  if (release.coordinate !== receipt.coordinate || (receipt.channel && release.channel !== receipt.channel)) return 'The receipt belongs to a different release identity or channel.';
  if (release.receiptStatus !== receipt.status || typeof release.mismatch !== 'boolean') return 'The release and its receipt disagree.';
  const at = recordedTime(receipt.scannedAt)!;
  if (at > now + MAX_CLOCK_SKEW_MS) return 'The receipt timestamp is ahead of the evaluation clock.';
  return null;
}
export function comparisonProblem(current: EvidenceSnapshot, previous: EvidenceSnapshot, now: number): string | null {
  if (evidenceProblem(current, now) || evidenceProblem(previous, now)) return 'Both releases need valid, matching receipt evidence.';
  if (current.scopeKey !== previous.scopeKey) return 'Releases belong to different authorised scopes.';
  if (current.receipt!.status === 'inconclusive') return 'An inconclusive inspection cannot establish a complete release comparison.';
  const key = sourceKey(current.release.coordinate);
  if (!key || key !== sourceKey(previous.release.coordinate)) return 'A matching, stable source identity is required; file names alone are not enough.';
  if (current.release.channel !== previous.release.channel) return 'Release channels differ.';
  if (!current.release.mediaType || current.release.mediaType !== previous.release.mediaType) return 'Artefact formats are different or not recorded.';
  if (current.release.id === previous.release.id || recordedTime(previous.receipt!.scannedAt)! >= recordedTime(current.receipt!.scannedAt)!) return 'The comparison must refer to an earlier release.';
  if (previous.receipt!.status !== 'passed' || previous.receipt!.suppressedCount || previous.release.mismatch || previous.release.legalHold?.active || previous.release.approval?.decision === 'rejected') return 'The previous release is not an eligible passing reference without exceptions.';
  return null;
}
export function eligiblePredecessors(current: ReleaseEvidence, candidates: ReleaseEvidence[]): ReleaseEvidence[] {
  const key = sourceKey(current.coordinate), at = recordedTime(current.createdAt);
  if (!key || at === null || !current.mediaType) return [];
  return candidates.filter(row => row.id !== current.id && sourceKey(row.coordinate) === key && row.channel === current.channel && row.mediaType === current.mediaType && row.receiptStatus === 'passed' && row.mismatch === false && !row.legalHold?.active && row.approval?.decision !== 'rejected' && recordedTime(row.createdAt) !== null && recordedTime(row.createdAt)! < at)
    .sort((a,b) => recordedTime(b.createdAt)! - recordedTime(a.createdAt)! || String(b.id).localeCompare(String(a.id)));
}
