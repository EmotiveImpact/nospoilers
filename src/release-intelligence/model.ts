/** Historical context is advisory. It never changes a signed scan or deployment policy. */
export const VERSION = '1.0.0';
export const HISTORY_LIMIT = 30;
export const MIN_SAMPLES = 5;
export type Ref = { kind: 'upload' | 'release'; id: string };
export type Evidence = {
  /** Server-derived canonical pre-deploy assessment; never supplied by the caller. */
  readiness?: 'ready' | 'review' | 'blocked' | 'unknown';
  ref: Ref; workspaceId: string; source: string; channel: 'stable' | 'beta' | 'canary'; format: string;
  digest: string; fingerprint: string; scannedAt: string; engine: string; policy: string | null;
  status: 'passed' | 'failed-policy' | 'inconclusive'; suppressed: number; findings: string[];
  manifest: Array<{ path: string; size: number; sha256: string }>;
  bytes: number | null; held: boolean;
};
export type Stream = {
  id: string; workspace_id: string; name: string; stream_key: string; artifact_role: string;
  source_binding: string; channel: Evidence['channel']; format: string; revision: number;
  archived_at: string | null; created_at: string;
};
export type Metrics = { bytes: number | null; files: number; unpackedBytes: number; maps: number; executables: number; findings: number; suppressed: number };
export type Snapshot = {
  id: string; stream_id: string; workspace_id: string; record_kind: Ref['kind']; record_id: string;
  digest: string; receipt_fingerprint: string; scanned_at: string; metrics: Metrics;
  created_at: string; excluded: boolean;
};
export type Baseline = {
  id: string; stream_id: string; revision: number; action: 'adopt' | 'revoke'; snapshot_ref: string | null;
  digest: string | null; reason: string; actor_login: string; created_at: string;
};
export type Signal = { code: string; title: string; detail: string; count: number; samples: number; examples: string[] };
export type Analysis = {
  version: string; advisory: true; state: 'unavailable' | 'first_release' | 'building_history' | 'comparison_available';
  history: number; eligible: number; excluded: number; duplicates: number; incompatible: number;
  windowStart: string | null; windowEnd: string | null; metrics: Metrics; signals: Signal[];
  baseline: { state: 'not_adopted' | 'revoked' | 'unavailable' | 'incompatible' | 'available'; revision: number };
  notice: string;
};
export class IntelligenceError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'IntelligenceError'; this.status = status; }
}
export function fail(message: string, status = 400): never { throw new IntelligenceError(message, status); }
export function uuid(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(raw)) return fail('Invalid identifier.');
  return raw.toLowerCase();
}
export function reference(raw: unknown): Ref {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Choose a saved release.');
  const r = raw as Record<string, unknown>;
  if (r.kind === 'upload') return { kind: 'upload', id: uuid(r.id) };
  if (r.kind === 'release' && typeof r.id === 'string' && /^[1-9]\d{0,14}$/.test(r.id) && Number.isSafeInteger(Number(r.id))) return { kind: 'release', id: r.id };
  return fail('Invalid release reference.');
}
export function text(raw: unknown, label: string, min = 1, max = 100): string {
  if (typeof raw !== 'string' || /[\x00-\x1f\x7f]/.test(raw) || raw.trim().length < min || raw.trim().length > max) return fail(`${label} must contain ${min} to ${max} characters without control characters.`);
  return raw.trim();
}
export function revision(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) return fail('Reload the current revision before saving.');
  return raw;
}
export const keyOf = (r: Ref): string => `${r.kind}:${r.id}`;
export const clean = (e: Evidence): boolean => e.status === 'passed' && !e.findings.length && !e.suppressed && !e.held;
export const compatible = (a: Evidence, b: Evidence): boolean => a.workspaceId === b.workspaceId && a.source === b.source && a.channel === b.channel && a.format === b.format;
export const sameContext = (a: Evidence, b: Evidence): boolean => compatible(a, b) && a.engine === b.engine && a.policy === b.policy;
export function metrics(e: Evidence): Metrics {
  const unpackedBytes = e.manifest.reduce((sum, f) => sum + f.size, 0);
  if (!Number.isSafeInteger(unpackedBytes)) return fail('Manifest size exceeds the analysis budget.', 422);
  return { bytes: e.bytes, files: e.manifest.length, unpackedBytes,
    maps: e.manifest.filter(f => /\.map$/i.test(f.path)).length,
    executables: e.manifest.filter(f => /\.(exe|dll|so|dylib|wasm|sh|bat|ps1)$/i.test(f.path)).length,
    findings: e.findings.length, suppressed: e.suppressed };
}
export function validate(e: Evidence, now = Date.now()): void {
  if (!Number.isFinite(now)) fail('Evaluation time is invalid.', 422);
  const digest = /^[a-f0-9]{64}$/;
  if (!digest.test(e.digest) || !digest.test(e.fingerprint)) fail('Evidence identity is invalid.', 422);
  if (!e.workspaceId || !e.source || !e.format || !['stable', 'beta', 'canary'].includes(e.channel)) fail('Evidence scope is incomplete.', 422);
  if (!Number.isFinite(Date.parse(e.scannedAt)) || Date.parse(e.scannedAt) > now + 60_000) fail('Evidence timestamp is invalid.', 422);
  if (!e.engine || typeof e.held !== 'boolean' || !['passed', 'failed-policy', 'inconclusive'].includes(e.status)) fail('Evidence context is invalid.', 422);
  if (!Number.isSafeInteger(e.suppressed) || e.suppressed < 0 || e.policy !== null && !digest.test(e.policy)) fail('Policy evidence is invalid.', 422);
  if (e.bytes !== null && (!Number.isSafeInteger(e.bytes) || e.bytes < 0)) fail('Artefact size is invalid.', 422);
  if (!Array.isArray(e.manifest) || e.manifest.length > 25_000 || !Array.isArray(e.findings) || e.findings.length > 25_000) fail('Evidence exceeds the analysis budget.', 422);
  if (e.findings.some(f => typeof f !== 'string' || f.length > 4096) || e.status === 'failed-policy' && !e.findings.length) fail('Finding evidence is invalid.', 422);
  const seen = new Set<string>();
  for (const f of e.manifest) {
    if (!f.path || f.path.length > 4096 || /[\x00-\x1f\x7f]/.test(f.path) || seen.has(f.path) || !digest.test(f.sha256) || !Number.isSafeInteger(f.size) || f.size < 0) fail('Manifest entry is invalid.', 422);
    seen.add(f.path);
  }
  metrics(e);
}
