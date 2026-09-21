import assert from 'node:assert/strict';
import { withReleaseIntelligence } from '../src/server/release-intelligence-app.ts';
import { IntelligenceError } from '../src/release-intelligence/model.ts';
import type { SqlClient } from '../src/server/sql.ts';
import type { IntelligenceAppOptions } from '../src/server/release-intelligence-app.ts';
import type { Register } from './release-intelligence-cases.ts';
import { WORKSPACE, STREAM, id } from './release-intelligence-fixtures.ts';
const BASE = 'https://review.example';
const PREFIX = `${BASE}/api/release-intelligence`;
export function registerIntelligenceApiTests(test: Register) {
  function harness(patch: Partial<IntelligenceAppOptions> = {}) {
    const sql: SqlClient = {
      async query() { throw new Error('Unexpected SQL execution in a request-boundary test.'); },
      async exec() { throw new Error('Unexpected migration execution.'); },
      async transaction(fn) { return fn(sql); }, async close() {},
    };
    return withReleaseIntelligence({ fetch: async request => new Response(`original:${new URL(request.url).pathname}`, { status: 207 }) }, {
      sql, appBaseUrl: BASE, reserve: async () => true,
      ports: () => ({ access: async () => { throw new IntelligenceError('Denied.', 403); }, evidence: async () => { throw new IntelligenceError('Unavailable.', 404); } }),
      context: async (_request, ref) => { assert.ok(ref.id); return { workspaceId: WORKSPACE }; }, ...patch,
    });
  }
  const post = (path: string, payload: unknown, headers: Record<string, string> = {}) => new Request(`${PREFIX}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload),
  });
  test('original routes are forwarded unchanged', async () => { const r = await harness().fetch(new Request(`${BASE}/api/releases`)); assert.equal(r.status, 207); assert.equal(await r.text(), 'original:/api/releases'); });
  test('similar prefixes are not intercepted', async () => assert.equal((await harness().fetch(new Request(`${BASE}/api/release-intelligence-other`))).status, 207));
  test('unknown intelligence route returns 404', async () => assert.equal((await harness().fetch(new Request(`${PREFIX}/unknown`))).status, 404));
  for (const method of ['DELETE', 'PATCH', 'PUT']) test(`rejects ${method}`, async () => assert.equal((await harness().fetch(new Request(`${PREFIX}/streams`, { method }))).status, 405));
  test('rate limit returns retry metadata', async () => { const r = await harness({ reserve: async () => false }).fetch(new Request(`${PREFIX}/streams`)); assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '60'); });
  test('authentication failures are not turned into empty history', async () => { const r = await harness({ reserve: async () => { throw new IntelligenceError('Sign in.', 401); } }).fetch(new Request(`${PREFIX}/streams`)); assert.equal(r.status, 401); });
  test('cookie writes require exact application origin', async () => assert.equal((await harness().fetch(post('/streams', {}, { cookie: 'ns_session=fixture' }))).status, 403));
  test('foreign origins are rejected', async () => assert.equal((await harness().fetch(post('/streams', {}, { origin: 'https://foreign.example' }))).status, 403));
  test('cross-site metadata is rejected', async () => assert.equal((await harness().fetch(post('/streams', {}, { origin: BASE, 'sec-fetch-site': 'cross-site' }))).status, 403));
  test('same-origin cookie request reaches body validation', async () => assert.equal((await harness().fetch(post('/streams', {}, { cookie: 'ns_session=fixture', origin: BASE, 'sec-fetch-site': 'same-origin' }))).status, 400));
  test('bearer requests without browser origin may reach validation', async () => assert.equal((await harness().fetch(post('/streams', {}, { authorization: 'Bearer fixture' }))).status, 400));
  test('non-JSON metadata is rejected', async () => { const r = await harness().fetch(new Request(`${PREFIX}/streams`, { method: 'POST', body: 'bad', headers: { 'content-type': 'text/plain' } })); assert.equal(r.status, 415); });
  test('malformed JSON returns 400', async () => { const r = await harness().fetch(new Request(`${PREFIX}/streams`, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })); assert.equal(r.status, 400); });
  test('arrays are not metadata objects', async () => assert.equal((await harness().fetch(post('/streams', []))).status, 400));
  test('metadata body limit is enforced', async () => assert.equal((await harness().fetch(post('/streams', { name: 'x'.repeat(17000) }))).status, 413));
  test('missing workspace does not become a default tenant', async () => assert.equal((await harness().fetch(new Request(`${PREFIX}/streams`))).status, 400));
  test('record context validates the supplied reference', async () => assert.equal((await harness().fetch(new Request(`${PREFIX}/record-context/upload/not-a-uuid`))).status, 400));
  test('authorised record context returns workspace identity', async () => { const r = await harness().fetch(new Request(`${PREFIX}/record-context/upload/${id(1)}`)); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { workspaceId: WORKSPACE }); });
  test('context authorisation denial is preserved', async () => { const r = await harness({ context: async () => { throw new IntelligenceError('Unavailable.', 404); } }).fetch(new Request(`${PREFIX}/record-context/release/1`)); assert.equal(r.status, 404); });
  test('responses explicitly prohibit caching and indexing', async () => { const r = await harness().fetch(new Request(`${PREFIX}/unknown`)); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('referrer-policy'), 'no-referrer'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('x-robots-tag')!, /noindex/); });
  test('unknown server errors do not expose SQL or secrets', async () => { const r = await harness({ reserve: async () => { throw new Error('SELECT secret_token FROM users'); } }).fetch(new Request(`${PREFIX}/streams`)); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /SELECT|secret_token/); });
  test('record-capture references are validated before SQL', async () => assert.equal((await harness().fetch(post(`/streams/${STREAM}/records`, { record: { kind: 'upload', id: 'a.zip' } }))).status, 400));
  test('mutating an export endpoint is not permitted', async () => assert.equal((await harness().fetch(post(`/streams/${STREAM}/export`, {}))).status, 405));
}
