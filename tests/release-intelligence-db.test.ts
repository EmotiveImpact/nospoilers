import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { releaseIntelligence } from '../src/server/release-intelligence-service.ts';
import { migrateReleaseIntelligence, INTELLIGENCE_MIGRATION } from '../src/server/release-intelligence-schema.ts';
import { IntelligenceError, keyOf } from '../src/release-intelligence/model.ts';
import type { Evidence } from '../src/release-intelligence/model.ts';
import type { SqlClient } from '../src/server/sql.ts';
import type { IntelligencePorts } from '../src/server/release-intelligence-service.ts';
import { fixture, WORKSPACE, hash } from './release-intelligence-fixtures.ts';

/** Real SQL/schema/service tests. The auth and signed-evidence ports are deliberately injected.
 * These are not proof of the real Hono/session/HMAC adapter or production PostgreSQL concurrency. */
describe('persistent release intelligence', () => {
  let db: PGlite, sql: SqlClient, service: ReturnType<typeof releaseIntelligence>;
  let records: Map<string, Evidence>, ports: IntelligencePorts;
  let role: 'owner' | 'viewer' | 'member', revoked: boolean, paid: boolean;
  beforeEach(async () => {
    db = new PGlite(); await db.waitReady;
    sql = {
      query: async <T>(query: string, params: unknown[] = []) => ({ rows: (await db.query<T>(query, params)).rows }),
      exec: async query => { await db.exec(query); },
      transaction: async fn => db.transaction(async tx => {
        const inner: SqlClient = {
          query: async <T>(query: string, params: unknown[] = []) => ({ rows: (await tx.query<T>(query, params)).rows }),
          exec: async query => { await tx.exec(query); }, transaction: async nested => nested(inner), close: async () => {},
        };
        return fn(inner);
      }),
      close: async () => { await db.close(); },
    };
    await sql.exec(`CREATE TABLE schema_migrations(id TEXT PRIMARY KEY);
      CREATE TABLE users(id TEXT PRIMARY KEY);
      CREATE TABLE jobs(id BIGINT PRIMARY KEY);
      CREATE TABLE watched_origins(id BIGINT PRIMARY KEY);
      CREATE TABLE product_workspaces(id UUID PRIMARY KEY);
      CREATE TABLE uploaded_scans(id TEXT PRIMARY KEY);
      CREATE TABLE release_revisions(id BIGINT PRIMARY KEY);`);
    await sql.query('INSERT INTO product_workspaces(id) VALUES($1)', [WORKSPACE]);
    await migrateReleaseIntelligence(sql);
    records = new Map(); role = 'owner'; revoked = false; paid = true;
    ports = {
      access: async (_tx, workspace, mode) => {
        if (revoked || workspace !== WORKSPACE) throw new IntelligenceError('Workspace unavailable.', 404);
        if (mode !== 'read' && role === 'viewer' || mode === 'manage' && role !== 'owner') throw new IntelligenceError('Read-only.', 403);
        if (mode !== 'read' && !paid) throw new IntelligenceError('Coverage ended.', 402);
        return { actorLogin: 'fixture-reviewer', canManage: role === 'owner' && paid, canWrite: role !== 'viewer' && paid };
      },
      evidence: async (_tx, workspace, ref) => {
        if (revoked || workspace !== WORKSPACE) throw new IntelligenceError('Evidence unavailable.', 404);
        const e = records.get(keyOf(ref));
        if (!e) throw new IntelligenceError('Evidence unavailable.', 404);
        return e;
      },
    };
    service = releaseIntelligence(sql, ports);
  }, 30_000);
  afterEach(async () => { await db?.close(); });
  async function seed(n: number, patch: Partial<Evidence> = {}) {
    const e = fixture(n, patch); records.set(keyOf(e.ref), e);
    if (e.ref.kind === 'upload') await sql.query('INSERT INTO uploaded_scans(id) VALUES($1) ON CONFLICT DO NOTHING', [e.ref.id]);
    else await sql.query('INSERT INTO release_revisions(id) VALUES($1) ON CONFLICT DO NOTHING', [e.ref.id]);
    return e;
  }
  async function create(key = 'web-build') {
    const e = await seed(1);
    return service.create({ workspaceId: WORKSPACE, name: 'Web build', key, role: 'Browser bundle', record: e.ref });
  }
  const adopt = (streamId: string, snapshotId: string, expectedRevision = 0) => service.baseline(streamId, {
    action: 'adopt', snapshotId, expectedRevision, reason: 'Reviewed this release as a reference.',
  });
  test('migration is idempotent and records its own marker', async () => {
    await migrateReleaseIntelligence(sql);
    expect((await sql.query('SELECT id FROM schema_migrations WHERE id=$1', [INTELLIGENCE_MIGRATION])).rows).toHaveLength(1);
  });
  test('creates a real stream and compact snapshot without copying manifests', async () => {
    const created = await create();
    expect(created.inserted).toBe(true);
    const rows = (await sql.query<{ metrics: unknown; analysis_summary: unknown }>('SELECT metrics,analysis_summary FROM release_intelligence_snapshots')).rows;
    expect(rows).toHaveLength(1); expect(JSON.stringify(rows)).not.toContain('dist/index.js');
    expect((await service.view(created.stream.id)).currentBaselineState).toBe('not_adopted');
  });
  test('same record capture is idempotent', async () => {
    const c = await create(); const again = await service.capture(c.stream.id, fixture(1).ref);
    expect(again.inserted).toBe(false); expect(again.snapshot.id).toBe(c.snapshot.id);
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots')).rows).toHaveLength(1);
  });
  test('same create request is idempotent but role changes conflict', async () => {
    const c = await create(), again = await create(); expect(again.stream.id).toBe(c.stream.id);
    await expect(service.create({ workspaceId: WORKSPACE, name: 'Web build', key: 'web-build', role: 'Another role', record: fixture(1).ref })).rejects.toMatchObject({ status: 409 });
  });
  test('stream identity cannot be updated directly', async () => {
    const c = await create(); await expect(sql.query('UPDATE release_intelligence_streams SET source_binding=$2 WHERE id=$1', [c.stream.id, 'other'])).rejects.toThrow();
  });
  test('saved snapshots cannot be rewritten or directly deleted', async () => {
    const c = await create(); await expect(sql.query("UPDATE release_intelligence_snapshots SET metrics='{}' WHERE id=$1", [c.snapshot.id])).rejects.toThrow();
    await expect(sql.query('DELETE FROM release_intelligence_snapshots WHERE id=$1', [c.snapshot.id])).rejects.toThrow();
  });
  test('new service instance reads previously stored history', async () => {
    const c = await create(), other = releaseIntelligence(sql, ports);
    expect((await other.view(c.stream.id)).snapshots[0].id).toBe(c.snapshot.id);
  });
  test('distinct captures accumulate actual statistical context', async () => {
    const c = await create();
    for (let n = 2; n <= 7; n++) { const e = await seed(n); await service.capture(c.stream.id, e.ref); }
    const v = await service.view(c.stream.id); expect(v.snapshots).toHaveLength(7); expect(v.analysis?.eligible).toBe(6);
  });
  test('another source channel is rejected', async () => {
    const c = await create(), e = await seed(2, { channel: 'beta' }); await expect(service.capture(c.stream.id, e.ref)).rejects.toMatchObject({ status: 409 });
  });
  test('viewer can read but cannot capture or adopt', async () => {
    const c = await create(); role = 'viewer'; expect((await service.view(c.stream.id)).canWrite).toBe(false);
    await expect(service.capture(c.stream.id, fixture(1).ref)).rejects.toMatchObject({ status: 403 });
    await expect(adopt(c.stream.id, c.snapshot.id)).rejects.toMatchObject({ status: 403 });
  });
  test('expired coverage retains reads but denies new writes', async () => {
    const c = await create(); paid = false; expect((await service.view(c.stream.id)).snapshots).toHaveLength(1);
    await expect(service.capture(c.stream.id, fixture(1).ref)).rejects.toMatchObject({ status: 402 });
  });
  test('revoked access does not expose saved metadata', async () => {
    const c = await create(); revoked = true; await expect(service.view(c.stream.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.export(c.stream.id)).rejects.toMatchObject({ status: 404 });
  });
  test('adoption records a reason and revision without rewriting the scan', async () => {
    const c = await create(), before = JSON.stringify(records.get(keyOf(fixture(1).ref)));
    expect(await adopt(c.stream.id, c.snapshot.id)).toEqual({ revision: 1 });
    const v = await service.view(c.stream.id); expect(v.currentBaselineState).toBe('available'); expect(v.baselines[0].reason).toContain('Reviewed');
    expect(v.analysis?.baseline.state).toBe('not_adopted'); expect(JSON.stringify(records.get(keyOf(fixture(1).ref)))).toBe(before);
  });
  test('stale reference revisions conflict rather than silently replacing', async () => {
    const c = await create(); await adopt(c.stream.id, c.snapshot.id);
    await expect(adopt(c.stream.id, c.snapshot.id, 0)).rejects.toMatchObject({ status: 409 });
  });
  test('failed and exception-covered records cannot become approved references', async () => {
    const c = await create(); const e = await seed(2, { suppressed: 1 }); const captured = await service.capture(c.stream.id, e.ref);
    await expect(adopt(c.stream.id, captured.snapshot.id)).rejects.toMatchObject({ status: 409 });
    const bad = await seed(3, { status: 'failed-policy', findings: ['SEC-001|critical|.env|Environment'] }); const b = await service.capture(c.stream.id, bad.ref);
    await expect(adopt(c.stream.id, b.snapshot.id)).rejects.toMatchObject({ status: 409 });
  });
  test('revocation is a new event and does not reinstate an earlier reference', async () => {
    const c = await create(); await adopt(c.stream.id, c.snapshot.id);
    await service.baseline(c.stream.id, { action: 'revoke', expectedRevision: 1, reason: 'Reference no longer reflects the product.' });
    const v = await service.view(c.stream.id); expect(v.currentBaselineState).toBe('revoked'); expect(v.baselines).toHaveLength(2);
    await expect(sql.query("UPDATE release_intelligence_baselines SET reason='rewritten' WHERE stream_id=$1", [c.stream.id])).rejects.toThrow();
  });
  test('exclusion and restoration leave original evidence intact', async () => {
    const c = await create(); await service.exclude(c.stream.id, { snapshotId: c.snapshot.id, excluded: true, expectedRevision: 0, reason: 'This was an unusual migration release.' });
    expect((await service.view(c.stream.id)).selected?.excluded).toBe(true);
    await service.exclude(c.stream.id, { snapshotId: c.snapshot.id, excluded: false, expectedRevision: 1, reason: 'Reviewed and restored to comparison history.' });
    expect((await service.view(c.stream.id)).selected?.excluded).toBe(false);
    expect((await sql.query('SELECT id FROM release_intelligence_exclusions')).rows).toHaveLength(2);
  });
  test('original evidence deletion cascades snapshots but leaves an unavailable reference tombstone', async () => {
    const c = await create(); await adopt(c.stream.id, c.snapshot.id);
    records.delete(keyOf(fixture(1).ref)); await sql.query('DELETE FROM uploaded_scans WHERE id=$1', [fixture(1).ref.id]);
    const v = await service.view(c.stream.id); expect(v.snapshots).toHaveLength(0); expect(v.currentBaselineState).toBe('unavailable'); expect(v.baselines).toHaveLength(1);
  });
  test('changed original receipt fingerprint invalidates current interpretation', async () => {
    const c = await create(); const e = records.get(keyOf(fixture(1).ref))!; records.set(keyOf(e.ref), { ...e, fingerprint: hash(12345) });
    expect((await service.view(c.stream.id)).unavailable).toBe(true);
    await expect(service.capture(c.stream.id, e.ref)).rejects.toMatchObject({ status: 409 });
  });
  test('private export is bounded metadata, not a signature or source dump', async () => {
    const c = await create(); await adopt(c.stream.id, c.snapshot.id); const exported = await service.export(c.stream.id);
    expect(exported.signed).toBe(false); expect(exported.snapshots).toHaveLength(1);
    const text = JSON.stringify(exported); expect(text).not.toContain('dist/index.js'); expect(text).not.toContain('fixture-reviewer'); expect(text).not.toContain('Reviewed this release');
  });
  test('snapshot IDs cannot cross stream boundaries', async () => {
    const a = await create('first-build'), b = await create('second-build');
    await expect(service.view(a.stream.id, b.snapshot.id)).rejects.toMatchObject({ status: 404 });
  });
  test('inconclusive evidence never becomes historical training data', async () => {
    const c = await create(), e = await seed(2, { status: 'inconclusive' });
    await expect(service.capture(c.stream.id, e.ref)).rejects.toMatchObject({ status: 409 });
  });
});
