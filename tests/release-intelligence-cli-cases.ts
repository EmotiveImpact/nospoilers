import assert from 'node:assert/strict';
import { scanReleaseStream } from '../scripts/scan-release-stream.mjs';
import type { Register } from './release-intelligence-cases.ts';
import { STREAM, id } from './release-intelligence-fixtures.ts';
const SUBMISSION = id(1);
export function registerIntelligenceCliTests(test: Register) {
  function harness(options: { passed?: boolean; state?: string; captureCode?: number; ackId?: string; statusUrl?: string; resultId?: string; canWrite?: boolean; failCode?: number; captureRecord?: string } = {}) {
    const calls: Array<{ url: string; init?: RequestInit }> = [], logs: string[] = [];
    let clock = 0;
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init }); const path = new URL(String(url)).pathname;
      if (options.failCode) return Response.json({ error: 'sensitive remote detail' }, { status: options.failCode });
      if (path.endsWith('/records')) return Response.json({ snapshot: { record_id: options.captureRecord ?? SUBMISSION, stream_id: STREAM } }, { status: options.captureCode ?? 200 });
      if (path === '/api/v1/scan') return Response.json({ uploadId: options.ackId ?? SUBMISSION, statusUrl: options.statusUrl ?? `/api/v1/scans/${SUBMISSION}` }, { status: 202 });
      if (path.startsWith('/api/v1/scans/')) return Response.json({ uploadId: options.resultId ?? SUBMISSION, status: options.state ?? 'done',
        receipt: { signature: 'fixture-only' }, report: { status: options.passed === false ? 'failed-policy' : 'passed', ok: options.passed !== false } });
      return Response.json({ stream: { id: STREAM, channel: 'stable' }, canWrite: options.canWrite ?? true });
    };
    const input = { baseUrl: 'https://review.example', token: 'fixture-token', streamId: STREAM, file: 'build.tgz', timeoutMs: 3000 };
    const deps = { fetch: fetcher, now: () => clock, sleep: async (ms: number) => { clock += ms; },
      randomUUID: () => SUBMISSION, stat: async () => ({ size: 1, isFile: () => true }), readFile: async () => new Uint8Array([1]), log: (message: string) => { logs.push(message); } };
    return { input, deps, calls, logs };
  }
  test('passing scan records history and exits zero', async () => { const h = harness(); assert.equal(await scanReleaseStream(h.input, h.deps), 0); assert.ok(h.calls.some(c => c.url.endsWith('/records'))); });
  test('failed policy remains failed after recording history', async () => { const h = harness({ passed: false }); assert.equal(await scanReleaseStream(h.input, h.deps), 1); assert.ok(h.calls.some(c => c.url.endsWith('/records'))); });
  test('read-only stream does not start a scan', async () => { const h = harness({ canWrite: false }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.equal(h.calls.length, 1); });
  test('an acknowledgement for another submission is rejected', async () => { const h = harness({ ackId: id(2) }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.ok(!h.calls.some(c => c.url.endsWith('/records'))); });
  test('off-origin polling URL is never followed', async () => { const h = harness({ statusUrl: 'https://foreign.example/steal' }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.ok(h.calls.every(c => c.url.startsWith('https://review.example/'))); });
  test('another scan result cannot be recorded', async () => { const h = harness({ resultId: id(2) }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.ok(!h.calls.some(c => c.url.endsWith('/records'))); });
  test('scan failure remains a workflow failure', async () => { const h = harness({ state: 'failed' }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.ok(!h.calls.some(c => c.url.endsWith('/records'))); });
  test('unfinished scan reaches the bounded timeout', async () => { const h = harness({ state: 'running' }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.ok(h.calls.length < 10); });
  test('failed evidence capture cannot appear successful', async () => { const h = harness({ captureCode: 422 }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); });
  test('capture acknowledgement must name the exact record', async () => { const h = harness({ captureRecord: id(2) }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); });
  test('HTTP failure does not print arbitrary remote detail or bearer token', async () => { const h = harness({ failCode: 500 }); assert.equal(await scanReleaseStream(h.input, h.deps), 2); assert.doesNotMatch(h.logs.join(' '), /sensitive remote detail|fixture-token/); });
  test('remote HTTP origins are refused before networking', async () => { const h = harness(); assert.equal(await scanReleaseStream({ ...h.input, baseUrl: 'http://remote.example' }, h.deps), 2); assert.equal(h.calls.length, 0); });
  test('credentials in origin are refused', async () => { const h = harness(); assert.equal(await scanReleaseStream({ ...h.input, baseUrl: 'https://user:pass@review.example' }, h.deps), 2); assert.equal(h.calls.length, 0); });
  test('oversized file is rejected before networking', async () => { const h = harness(); assert.equal(await scanReleaseStream(h.input, { ...h.deps, stat: async () => ({ size: 81 * 1024 * 1024, isFile: () => true }) }), 2); assert.equal(h.calls.length, 0); });
  test('directory input is rejected', async () => { const h = harness(); assert.equal(await scanReleaseStream(h.input, { ...h.deps, stat: async () => ({ size: 1, isFile: () => false }) }), 2); assert.equal(h.calls.length, 0); });
  test('fetch rejects redirects and uses the same bearer only at the selected origin', async () => { const h = harness(); await scanReleaseStream(h.input, h.deps); for (const c of h.calls) { assert.equal(c.init?.redirect, 'error'); assert.equal(new Headers(c.init?.headers).get('authorization'), 'Bearer fixture-token'); } });
  test('CI never adopts or revokes a baseline', async () => { const h = harness(); await scanReleaseStream(h.input, h.deps); assert.ok(h.calls.every(c => !c.url.includes('/baseline') && !c.url.includes('/exclusions'))); });
}
