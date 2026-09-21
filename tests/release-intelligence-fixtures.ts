import type { Evidence, Baseline } from '../src/release-intelligence/model.ts';
export const WORKSPACE = '11111111-1111-4111-8111-111111111111';
export const STREAM = '22222222-2222-4222-8222-222222222222';
export const NOW = Date.parse('2026-09-08T00:00:00Z');
export const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, '0')}`;
export const hash = (n: number) => n.toString(16).padStart(64, '0');
export function fixture(n: number, patch: Partial<Evidence> = {}): Evidence {
  return {
    ref: { kind: 'upload', id: id(n) }, workspaceId: WORKSPACE, source: 'manual-upload', channel: 'stable',
    format: 'scan:tarball', digest: hash(n), fingerprint: hash(n + 1000),
    scannedAt: new Date(Date.UTC(2026, 0, n + 1)).toISOString(), engine: '1.0.0', policy: hash(9000),
    status: 'passed', suppressed: 0, findings: [], bytes: 40 * 1024 * 1024, held: false,
    manifest: [{ path: 'dist/index.js', size: 1024, sha256: hash(500) }], ...patch,
  };
}
export const history = (...rows: Evidence[]) => rows.map(evidence => ({ evidence, excluded: false }));
export function baseline(e: Evidence, patch: Partial<Baseline> = {}): Baseline {
  return { id: id(700), stream_id: STREAM, revision: 1, action: 'adopt', snapshot_ref: id(701), digest: e.digest,
    reason: 'Reviewed the reference build.', actor_login: 'reviewer',
    created_at: new Date(Date.parse(e.scannedAt) + 1000).toISOString(), ...patch };
}
