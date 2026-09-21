import assert from 'node:assert/strict';
import { analyse, median, unusual } from '../src/release-intelligence/analyse.ts';
import { validate, reference, uuid, revision, text, metrics, clean, compatible, sameContext } from '../src/release-intelligence/model.ts';
import { fixture, history, baseline, hash, id, NOW, WORKSPACE } from './release-intelligence-fixtures.ts';
import type { Evidence } from '../src/release-intelligence/model.ts';
export type Register = (name: string, fn: () => void | Promise<void>) => unknown;
export function registerIntelligenceTests(test: Register) {
  const run = (current: Evidence, previous: Evidence[] = []) => analyse({ current, history: history(...previous), now: NOW });
  test('median handles odd, even and empty samples', () => { assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5); assert.equal(median([]), null); });
  test('median does not mutate the input', () => { const values = [3, 1, 2]; median(values); assert.deepEqual(values, [3, 1, 2]); });
  test('non-finite median samples fail closed', () => { assert.equal(median([1, NaN]), null); assert.equal(median([Infinity]), null); });
  test('statistics need at least five samples', () => assert.equal(unusual(1000, [1, 1, 1, 1], 20), null));
  test('flat samples have an absolute floor', () => { assert.equal(unusual(11, [1, 1, 1, 1, 1], 20), null); assert.equal(unusual(40, [1, 1, 1, 1, 1], 20), 1); });
  test('relative floor avoids ordinary variation', () => assert.equal(unusual(125, [100, 100, 100, 100, 100], 1), null));
  test('both unusually large and small values can be reviewed', () => { assert.equal(unusual(1000, [100, 100, 100, 100, 100], 20), 100); assert.equal(unusual(1, [100, 100, 100, 100, 100], 20), 100); });
  test('current time must be finite', () => assert.throws(() => validate(fixture(1), NaN)));
  test('a valid fixture passes semantic validation', () => assert.doesNotThrow(() => validate(fixture(1), NOW)));
  test('UUIDs are normalised but not guessed', () => { assert.equal(uuid(WORKSPACE.toUpperCase()), WORKSPACE); assert.throws(() => uuid('workspace')); });
  test('upload references require UUIDs', () => { assert.deepEqual(reference({ kind: 'upload', id: id(1) }), { kind: 'upload', id: id(1) }); assert.throws(() => reference({ kind: 'upload', id: 'a.tgz' })); });
  test('release references require safe positive string integers', () => { assert.deepEqual(reference({ kind: 'release', id: '12' }), { kind: 'release', id: '12' }); for (const value of ['0', '-1', '12x', 12, '9999999999999999']) assert.throws(() => reference({ kind: 'release', id: value })); });
  test('reference input rejects arrays and unknown kinds', () => { assert.throws(() => reference([])); assert.throws(() => reference({ kind: 'file', id: '12' })); });
  test('revisions are explicit integers', () => { assert.equal(revision(0), 0); for (const n of [-1, 1.5, NaN, '1']) assert.throws(() => revision(n)); });
  test('human text is bounded and free of controls', () => { assert.equal(text(' reviewed ', 'Reason'), 'reviewed'); assert.throws(() => text('bad\nreason', 'Reason')); assert.throws(() => text('', 'Reason')); });
  const invalid: Array<[string, Partial<Evidence>]> = [
    ['digest', { digest: 'invalid' }], ['fingerprint', { fingerprint: '' }],
    ['scope', { workspaceId: '' }], ['source', { source: '' }], ['format', { format: '' }],
    ['timestamp', { scannedAt: 'not-a-date' }], ['future time', { scannedAt: '2027-01-01T00:00:00Z' }],
    ['engine', { engine: '' }], ['suppression count', { suppressed: -1 }], ['policy', { policy: 'bad' }],
    ['negative bytes', { bytes: -1 }], ['non-finite bytes', { bytes: Infinity }],
    ['failed scan without findings', { status: 'failed-policy', findings: [] }],
    ['duplicate manifest paths', { manifest: [{ path: 'a', size: 1, sha256: hash(1) }, { path: 'a', size: 2, sha256: hash(2) }] }],
    ['control characters in paths', { manifest: [{ path: 'a\nb', size: 1, sha256: hash(1) }] }],
    ['negative file size', { manifest: [{ path: 'a', size: -1, sha256: hash(1) }] }],
    ['invalid file digest', { manifest: [{ path: 'a', size: 1, sha256: 'bad' }] }],
    ['excessively long finding', { findings: ['x'.repeat(4097)] }],
  ];
  for (const [label, patch] of invalid) test(`rejects invalid ${label}`, () => assert.throws(() => validate(fixture(1, patch), NOW)));
  test('manifest entry budget is enforced', () => assert.throws(() => validate(fixture(1, { manifest: Array.from({ length: 25001 }, (_, n) => ({ path: `f${n}`, size: 0, sha256: hash(1) })) }), NOW)));
  test('aggregate sizes must remain safe integers', () => assert.throws(() => metrics(fixture(1, { manifest: [{ path: 'a', size: Number.MAX_SAFE_INTEGER, sha256: hash(1) }, { path: 'b', size: 1, sha256: hash(1) }] }))));
  test('metrics distinguish map and executable-like extensions', () => { const m = metrics(fixture(1, { manifest: [{ path: 'app.js.map', size: 5, sha256: hash(1) }, { path: 'worker.wasm', size: 7, sha256: hash(2) }] })); assert.equal(m.maps, 1); assert.equal(m.executables, 1); assert.equal(m.unpackedBytes, 12); });
  test('clean eligibility excludes warnings, exceptions and holds', () => { assert.ok(clean(fixture(1))); for (const patch of [{ findings: ['MAP-001|warn|a|map'] }, { suppressed: 1 }, { held: true }] as Partial<Evidence>[]) assert.equal(clean(fixture(1, patch)), false); });
  test('source dimensions and policy context are distinct', () => { assert.ok(compatible(fixture(1), fixture(2, { policy: null }))); assert.equal(sameContext(fixture(1), fixture(2, { policy: null })), false); });
  test('first release does not invent historical knowledge', () => { const a = run(fixture(5)); assert.equal(a.state, 'first_release'); assert.equal(a.history, 0); assert.deepEqual(a.signals, []); assert.equal(a.advisory, true); });
  test('five unique eligible records enable statistical context', () => { const a = run(fixture(10), [1, 2, 3, 4, 5].map(n => fixture(n))); assert.equal(a.state, 'comparison_available'); assert.equal(a.eligible, 5); });
  test('four eligible records remain a building-history state', () => assert.equal(run(fixture(10), [1, 2, 3, 4].map(n => fixture(n))).state, 'building_history'));
  test('same record, equal-time and future records do not become history', () => { const c = fixture(5); const a = run(c, [c, fixture(2, { scannedAt: c.scannedAt }), fixture(6)]); assert.equal(a.history, 0); });
  for (const [label, patch] of [['workspace', { workspaceId: id(99) }], ['source', { source: 'another-product' }], ['channel', { channel: 'beta' }], ['format', { format: 'scan:zip' }]] as Array<[string, Partial<Evidence>]>) {
    test(`does not mix a different ${label}`, () => { const a = run(fixture(10), [fixture(1, patch)]); assert.equal(a.history, 0); assert.equal(a.incompatible, 1); });
  }
  test('identical bytes do not inflate sample count', () => { const a = run(fixture(10), [1, 2, 3, 4, 5].map(n => fixture(n, { digest: hash(500) }))); assert.equal(a.history, 1); assert.equal(a.duplicates, 4); assert.equal(a.eligible, 1); });
  test('duplicate references count only once', () => assert.equal(run(fixture(10), [fixture(1), fixture(1)]).history, 1));
  test('the historical window is bounded to thirty distinct records', () => assert.equal(run(fixture(60), Array.from({ length: 50 }, (_, i) => fixture(i + 1))).history, 30));
  test('excluded history is visible but never trains the profile', () => { const a = analyse({ current: fixture(10), history: [{ evidence: fixture(1), excluded: true }], now: NOW }); assert.equal(a.history, 0); assert.equal(a.excluded, 1); });
  test('engine changes exclude statistical peers', () => { const a = run(fixture(10), [fixture(1, { engine: '0.9' })]); assert.equal(a.eligible, 0); assert.ok(a.signals.some(s => s.code === 'context_changed')); });
  test('policy changes exclude statistical peers', () => assert.equal(run(fixture(10), [fixture(1, { policy: null })]).eligible, 0));
  test('warning and exception-covered history is not a clean statistical baseline', () => { const a = run(fixture(10), [fixture(1, { findings: ['MAP-001|warn|a|map'] }), fixture(2, { suppressed: 1 })]); assert.equal(a.history, 2); assert.equal(a.eligible, 0); });
  test('inconclusive current evidence yields no historical verdict', () => { const a = run(fixture(10, { status: 'inconclusive' }), [fixture(1)]); assert.equal(a.state, 'unavailable'); assert.deepEqual(a.signals, []); });
  test('new paths report factual novelty and bounded examples', () => { const paths = Array.from({ length: 40 }, (_, i) => ({ path: `new/${i}.js`, size: 1, sha256: hash(i + 1) })); const a = run(fixture(10, { manifest: paths }), [fixture(1)]); const s = a.signals.find(s => s.code === 'new_files')!; assert.equal(s.count, 40); assert.equal(s.examples.length, 20); });
  test('source-map novelty is not labelled a proven leak', () => { const a = run(fixture(10, { manifest: [{ path: 'app.js.map', size: 1, sha256: hash(1) }] }), [fixture(1)]); assert.match(a.signals.find(s => s.code === 'first_source_maps')!.detail, /not automatically/); });
  test('returned paths are not first-seen paths', () => { const file = { path: 'debug.js', size: 1, sha256: hash(1) }; const a = run(fixture(10, { manifest: [file] }), [fixture(2), fixture(1, { manifest: [file] })]); assert.ok(a.signals.some(s => s.code === 'returned_files')); assert.ok(!a.signals.some(s => s.code === 'new_files')); });
  test('reappearing findings differ from first-seen findings', () => { const finding = 'DBG-001|warn|debug.js|Debug content'; const a = run(fixture(10, { findings: [finding] }), [fixture(2), fixture(1, { findings: [finding] })]); assert.ok(a.signals.some(s => s.code === 'finding_reappeared')); assert.ok(!a.signals.some(s => s.code === 'finding_regression')); });
  test('size drift requires clean eligible history', () => { const a = run(fixture(10, { bytes: 100 * 1024 * 1024 }), [1, 2, 3, 4, 5].map(n => fixture(n))); assert.ok(a.signals.some(s => s.code === 'size_drift')); });
  test('missing current size is not a zero-byte anomaly', () => assert.ok(!run(fixture(10, { bytes: null }), [1, 2, 3, 4, 5].map(n => fixture(n))).signals.some(s => s.code === 'size_drift')));
  test('adopted reference is compared independently of rolling history', () => { const b = fixture(1); const a = analyse({ current: fixture(10, { manifest: [] }), history: [], baseline: baseline(b), baselineEvidence: b, now: NOW }); assert.equal(a.baseline.state, 'available'); assert.ok(a.signals.some(s => s.code === 'baseline_drift')); });
  test('adoption after a scan does not rewrite the historical decision', () => { const b = fixture(1); const a = analyse({ current: fixture(10), history: [], baseline: baseline(b, { created_at: fixture(11).scannedAt }), baselineEvidence: b, now: NOW }); assert.equal(a.baseline.state, 'incompatible'); });
  test('revoked reference does not fall back silently', () => { const b = fixture(1); const a = analyse({ current: fixture(10), history: [], baseline: baseline(b, { action: 'revoke', digest: null, snapshot_ref: null }), baselineEvidence: b, now: NOW }); assert.equal(a.baseline.state, 'revoked'); });
  test('missing reference evidence stays unavailable', () => { const b = fixture(1); assert.equal(analyse({ current: fixture(10), history: [], baseline: baseline(b), now: NOW }).baseline.state, 'unavailable'); });
  test('changed reference digest cannot pass', () => { const b = fixture(1); assert.equal(analyse({ current: fixture(10), history: [], baseline: baseline(b, { digest: hash(999) }), baselineEvidence: b, now: NOW }).baseline.state, 'unavailable'); });
  test('new hold makes an adopted reference ineligible', () => { const b = fixture(1, { held: true }); assert.equal(analyse({ current: fixture(10), history: [], baseline: baseline(b), baselineEvidence: b, now: NOW }).baseline.state, 'unavailable'); });
  test('analysis never mutates either receipt', () => { const c = fixture(10), p = fixture(1), original = JSON.stringify([c, p]); run(c, [p]); assert.equal(JSON.stringify([c, p]), original); });
}
