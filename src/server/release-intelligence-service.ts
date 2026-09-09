import { randomUUID } from 'node:crypto';
import type { SqlClient } from './sql.ts';
import { analyse } from '../release-intelligence/analyse.ts';
import { clean, fail, IntelligenceError, metrics, reference, revision, text, uuid, validate, VERSION } from '../release-intelligence/model.ts';
import type { Baseline, Evidence, Ref, Snapshot, Stream } from '../release-intelligence/model.ts';
export type Permission = { actorLogin: string; canManage: boolean; canWrite: boolean; actorUserId?:string; canAdminister?:boolean;capabilityKey?:string };
export type IntelligencePorts = {
  delegateUser?: (userId:string)=>IntelligencePorts;
  gate?: (streamId:string)=>IntelligencePorts;
  access: (sql: SqlClient, workspace: string, mode: 'read' | 'write' | 'manage', source?: string) => Promise<Permission>;
  evidence: (sql: SqlClient, workspace: string, ref: Ref) => Promise<Evidence>;
};
const missingEvidence = (e: unknown) => e instanceof IntelligenceError && [403, 404, 409, 422].includes(e.status);
const snapSelect = `SELECT s.*,COALESCE((SELECT e.excluded FROM release_intelligence_exclusions e WHERE e.stream_id=s.stream_id AND e.snapshot_ref=s.id ORDER BY e.revision DESC LIMIT 1),false) AS excluded FROM release_intelligence_snapshots s`;
const iso = (v: string | Date) => new Date(v).toISOString();
const snapshotRow = (s: Snapshot): Snapshot => ({ ...s, scanned_at: iso(s.scanned_at), created_at: iso(s.created_at) });
const baselineRow = (b: Baseline): Baseline => ({ ...b, revision: Number(b.revision), created_at: iso(b.created_at) });
export function releaseIntelligence(sql: SqlClient, ports: IntelligencePorts) {
  async function access(tx: SqlClient, workspace: string, mode: 'read' | 'write' | 'manage', source?: string) {
    const id = uuid(workspace);
    await ports.access(tx, id, mode, source);
    if (mode !== 'read') await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE', [id]);
    return ports.access(tx, id, mode, source);
  }
  async function stream(tx: SqlClient, id: string, mode: 'read' | 'write' | 'manage') {
    const found = (await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1', [uuid(id)])).rows[0];
    if (!found) return fail('Release stream unavailable.', 404);
    const permission = await access(tx, found.workspace_id, mode, found.source_binding);
    const current = mode === 'read' ? found : (await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1 FOR UPDATE', [found.id])).rows[0];
    if (!current) return fail('Release stream unavailable.', 404);
    if (mode !== 'read' && current.archived_at) fail('This release stream is archived.', 409);
    return { stream: { ...current, revision: Number(current.revision), created_at: iso(current.created_at) }, permission };
  }
  async function audit(tx: SqlClient, s: Stream, actor: string, action: string, detail: object) {
    await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)', [randomUUID(), s.id, action, actor, JSON.stringify(detail)]);
  }
  function dimensions(s: Stream, e: Evidence) {
    validate(e);
    if (s.workspace_id !== e.workspaceId || s.source_binding !== e.source || s.channel !== e.channel || s.format !== e.format) fail('This record belongs to a different workspace, source, channel or format.', 409);
  }
  async function saved(tx: SqlClient, s: Stream, id: string): Promise<Snapshot> {
    const row = (await tx.query<Snapshot>(`${snapSelect} WHERE s.stream_id=$1 AND s.id=$2`, [s.id, uuid(id)])).rows[0];
    if (!row) return fail('Saved history is unavailable in this stream.', 404);
    return snapshotRow(row);
  }
  async function evidence(tx: SqlClient, s: Stream, snap: Snapshot) {
    const e = await ports.evidence(tx, s.workspace_id, { kind: snap.record_kind, id: snap.record_id });
    dimensions(s, e);
    if (e.digest !== snap.digest || e.fingerprint !== snap.receipt_fingerprint) fail('The original signed evidence no longer matches this snapshot.', 409);
    return e;
  }
  async function review(tx: SqlClient, s: Stream, current: Evidence) {
    const candidates = (await tx.query<Snapshot>(`${snapSelect} WHERE s.stream_id=$1 AND s.scanned_at<$2 ORDER BY s.scanned_at DESC,s.id DESC LIMIT 60`, [s.id, current.scannedAt])).rows.map(snapshotRow);
    const history: Array<{ evidence: Evidence; excluded: boolean }> = [];
    let unavailable = 0, historyBytes = 0, manifestEntries = 0, budgetLimited = false;
    for (const candidate of candidates) {
      try {
        const loaded = await evidence(tx, s, candidate);
        const bytes = Buffer.byteLength(JSON.stringify(loaded), 'utf8');
        if (historyBytes + bytes > 16 * 1024 * 1024 || manifestEntries + loaded.manifest.length > 100_000) { budgetLimited = true; break; }
        historyBytes += bytes; manifestEntries += loaded.manifest.length;
        history.push({ evidence: loaded, excluded: candidate.excluded });
      }
      catch (e) { if (!missingEvidence(e)) throw e; unavailable++; }
    }
    const raw = (await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 AND created_at<=$2 ORDER BY revision DESC LIMIT 1', [s.id, current.scannedAt])).rows[0];
    const baseline = raw ? baselineRow(raw) : null;
    let baselineEvidence: Evidence | null = null;
    if (baseline?.action === 'adopt' && baseline.snapshot_ref) {
      try { const candidate = await saved(tx, s, baseline.snapshot_ref); if (!candidate.excluded) baselineEvidence = await evidence(tx, s, candidate); }
      catch (e) { if (!missingEvidence(e)) throw e; }
    }
    return { ...analyse({ current, history, baseline, baselineEvidence }), unavailable, inspectedHistoryRows: history.length + unavailable, budgetLimited, historyBytes, manifestEntries };
  }
  async function capture(tx: SqlClient, s: Stream, permission: Permission, ref: Ref) {
    const e = await ports.evidence(tx, s.workspace_id, ref);
    dimensions(s, e);
    if (e.status === 'inconclusive') fail('An inconclusive scan cannot establish a complete historical snapshot.', 409);
    const existing = (await tx.query<Snapshot>(`${snapSelect} WHERE s.stream_id=$1 AND s.record_kind=$2 AND s.record_id=$3`, [s.id, ref.kind, ref.id])).rows[0];
    if (existing) {
      if (existing.digest !== e.digest || existing.receipt_fingerprint !== e.fingerprint) fail('This record was already captured with different evidence.', 409);
      return { snapshot: snapshotRow(existing), inserted: false };
    }
    const id = randomUUID();
    // Keep the original manifest/receipt in its original retention and authorisation boundary.
    await tx.query(`INSERT INTO release_intelligence_snapshots(id,stream_id,workspace_id,record_kind,record_id,upload_id,release_id,digest,receipt_fingerprint,scanned_at,metrics,analysis_summary)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)`,
      [id, s.id, s.workspace_id, ref.kind, ref.id, ref.kind === 'upload' ? ref.id : null, ref.kind === 'release' ? ref.id : null,
        e.digest, e.fingerprint, e.scannedAt, JSON.stringify(metrics(e)), JSON.stringify({ version: VERSION, status: 'historical_analysis_on_read', engine: e.engine, policy: e.policy, referenceEligibleAtCapture: clean(e) })]);
    await audit(tx, s, permission.actorLogin, 'snapshot_recorded', { snapshotId: id, record: ref });
    await ports.access(tx, s.workspace_id, 'write', s.source_binding);
    return { snapshot: await saved(tx, s, id), inserted: true };
  }
  return {
    async list(workspaceId: string, record?: Ref) {
      return sql.transaction(async tx => {
        const permission = await access(tx, workspaceId, 'read');
        if (record) await ports.evidence(tx, workspaceId, record);
        const all = (await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE workspace_id=$1 ORDER BY created_at,id LIMIT 100', [uuid(workspaceId)])).rows;
        const streams: Stream[] = [];
        for (const s of all) {
          try { await ports.access(tx, workspaceId, 'read', s.source_binding); streams.push({ ...s, revision: Number(s.revision), created_at: iso(s.created_at) }); }
          catch (e) { if (!missingEvidence(e)) throw e; }
        }
        const links = record ? (await tx.query<{ stream_id: string; snapshot_id: string }>('SELECT stream_id,id AS snapshot_id FROM release_intelligence_snapshots WHERE workspace_id=$1 AND record_kind=$2 AND record_id=$3', [workspaceId, record.kind, record.id])).rows.filter(r => streams.some(s => s.id === r.stream_id)) : [];
        await ports.access(tx, workspaceId, 'read');
        return { streams, links, canManage: permission.canManage, canWrite: permission.canWrite };
      });
    },
    async create(input: { workspaceId: unknown; name: unknown; key: unknown; role: unknown; record: unknown }) {
      const workspaceId = uuid(input.workspaceId), name = text(input.name, 'Stream name'), role = text(input.role, 'Artefact role', 1, 80), key = text(input.key, 'Stream key', 2, 64);
      if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key)) fail('Use a lower-case stream key containing letters, digits, underscores or hyphens.');
      const ref = reference(input.record);
      return sql.transaction(async tx => {
        const permission = await access(tx, workspaceId, 'manage');
        const e = await ports.evidence(tx, workspaceId, ref); validate(e);
        if (e.status === 'inconclusive') fail('Complete a conclusive scan before creating its stream.', 409);
        await ports.access(tx, workspaceId, 'manage', e.source);
        let s = (await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE workspace_id=$1 AND stream_key=$2', [workspaceId, key])).rows[0];
        if (s) {
          if (s.name !== name || s.artifact_role !== role || s.archived_at) fail('That stream key already has a different identity.', 409);
          dimensions(s, e);
        } else {
          const count = (await tx.query<{ n: string }>('SELECT count(*) AS n FROM release_intelligence_streams WHERE workspace_id=$1', [workspaceId])).rows[0];
          if (Number(count.n) >= 100) fail('Workspace stream safety limit reached.', 409);
          s = (await tx.query<Stream>(`INSERT INTO release_intelligence_streams(id,workspace_id,name,stream_key,artifact_role,source_binding,channel,format) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [randomUUID(), workspaceId, name, key, role, e.source, e.channel, e.format])).rows[0];
          await audit(tx, s, permission.actorLogin, 'stream_created', { key, role });
        }
        const result = await capture(tx, s, permission, ref);
        return { stream: { ...s, created_at: iso(s.created_at), revision: Number(s.revision) }, ...result };
      });
    },
    async capture(id: string, raw: unknown) {
      const ref = reference(raw);
      return sql.transaction(async tx => { const { stream: s, permission } = await stream(tx, id, 'write'); return capture(tx, s, permission, ref); });
    },
    async view(id: string, selectedId?: string, before?: string) {
      return sql.transaction(async tx => {
        const { stream: s, permission } = await stream(tx, id, 'read');
        const cursor = before ? await saved(tx, s, before) : null;
        const page = (await tx.query<Snapshot>(`${snapSelect} WHERE s.stream_id=$1 AND ($2::timestamptz IS NULL OR (s.scanned_at,s.id)<($2::timestamptz,$3::uuid)) ORDER BY s.scanned_at DESC,s.id DESC LIMIT 31`, [s.id, cursor?.scanned_at ?? null, cursor?.id ?? null])).rows.map(snapshotRow);
        const snapshots = page.slice(0, 30), selected = selectedId ? await saved(tx, s, selectedId) : snapshots[0] ?? null;
        let analysis: Awaited<ReturnType<typeof review>> | null = null, unavailable = false, baselineEligible = false;
        if (selected) {
          try { const e = await evidence(tx, s, selected); analysis = await review(tx, s, e); baselineEligible = !selected.excluded && clean(e); }
          catch (e) { if (!missingEvidence(e)) throw e; unavailable = true; }
        }
        const baselines = (await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 30', [s.id])).rows.map(baselineRow);
        let currentBaselineState = !baselines.length ? 'not_adopted' : baselines[0].action === 'revoke' ? 'revoked' : 'unavailable';
        const latest = baselines[0];
        if (latest?.action === 'adopt' && latest.snapshot_ref) {
          try { const snap = await saved(tx, s, latest.snapshot_ref); const e = await evidence(tx, s, snap); if (!snap.excluded && clean(e) && e.digest === latest.digest) currentBaselineState = 'available'; }
          catch (e) { if (!missingEvidence(e)) throw e; }
        }
        const events = (await tx.query<{ id: string; action: string; actor_login: string; created_at: string }>('SELECT id,action,actor_login,created_at FROM release_intelligence_events WHERE stream_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30', [s.id])).rows;
        await ports.access(tx, s.workspace_id, 'read', s.source_binding);
        return { stream: s, canManage: permission.canManage, canAdminister: permission.canAdminister===true, canWrite: permission.canWrite, snapshots,
          nextCursor: page.length > 30 ? snapshots.at(-1)!.id : null, selected, analysis, unavailable, baselineEligible,
          baselines, currentBaselineState, events, notice: 'Reference adoption affects later scans, not earlier decisions. Data follows original evidence retention; this is not an indefinite archive.' };
      });
    },
    async baseline(id: string, input: { action: unknown; snapshotId?: unknown; expectedRevision: unknown; reason: unknown }) {
      const expected = revision(input.expectedRevision), reason = text(input.reason, 'Reason', 8, 1000);
      if (input.action !== 'adopt' && input.action !== 'revoke') fail('Choose adopt or revoke.');
      return sql.transaction(async tx => {
        const { stream: s, permission } = await stream(tx, id, 'manage');
        if (s.revision !== expected) fail('The stream changed. Reload before saving.', 409);
        let snap: Snapshot | null = null;
        if (input.action === 'adopt') {
          snap = await saved(tx, s, uuid(input.snapshotId)); const e = await evidence(tx, s, snap);
          if (snap.excluded || !clean(e)) fail('References require passing evidence without findings, exceptions, rejection or hold.', 409);
        }
        const next = s.revision + 1;
        await tx.query('INSERT INTO release_intelligence_baselines(id,stream_id,revision,action,snapshot_ref,digest,reason,actor_login) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), s.id, next, input.action, snap?.id ?? null, snap?.digest ?? null, reason, permission.actorLogin]);
        await tx.query('UPDATE release_intelligence_streams SET revision=$2 WHERE id=$1', [s.id, next]);
        await audit(tx, s, permission.actorLogin, `baseline_${input.action}`, { revision: next, snapshotId: snap?.id ?? null, reason });
        await ports.access(tx, s.workspace_id, 'manage', s.source_binding);
        return { revision: next };
      });
    },
    async exclude(id: string, input: { snapshotId: unknown; excluded: unknown; expectedRevision: unknown; reason: unknown }) {
      const expected = revision(input.expectedRevision), reason = text(input.reason, 'Reason', 8, 1000);
      if (typeof input.excluded !== 'boolean') fail('Choose whether to exclude this record.');
      return sql.transaction(async tx => {
        const { stream: s, permission } = await stream(tx, id, 'manage');
        if (s.revision !== expected) fail('The stream changed. Reload before saving.', 409);
        const snap = await saved(tx, s, uuid(input.snapshotId)); await evidence(tx, s, snap);
        if (snap.excluded === input.excluded) return { revision: s.revision };
        const next = s.revision + 1;
        await tx.query('INSERT INTO release_intelligence_exclusions(id,stream_id,snapshot_ref,revision,excluded,reason,actor_login) VALUES($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.id, snap.id, next, input.excluded, reason, permission.actorLogin]);
        await tx.query('UPDATE release_intelligence_streams SET revision=$2 WHERE id=$1', [s.id, next]);
        await audit(tx, s, permission.actorLogin, input.excluded ? 'history_excluded' : 'history_restored', { revision: next, snapshotId: snap.id, reason });
        await ports.access(tx, s.workspace_id, 'manage', s.source_binding);
        return { revision: next };
      });
    },
    async export(id: string) {
      return sql.transaction(async tx => {
        const { stream: s } = await stream(tx, id, 'read');
        const rows = (await tx.query<Snapshot>(`${snapSelect} WHERE s.stream_id=$1 ORDER BY s.scanned_at DESC,s.id DESC LIMIT 1001`, [s.id])).rows.map(snapshotRow);
        const baselines = (await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1001', [s.id])).rows.map(baselineRow);
        await ports.access(tx, s.workspace_id, 'read', s.source_binding);
        return { type: 'nospoilers-private-history', version: VERSION, signed: false, exportedAt: new Date().toISOString(),
          stream: { name: s.name, key: s.stream_key, role: s.artifact_role, channel: s.channel, format: s.format },
          snapshots: rows.slice(0, 1000).map(r => ({ digest: r.digest, scannedAt: r.scanned_at, metrics: r.metrics, excluded: r.excluded })),
          baselines: baselines.slice(0, 1000).map(b => ({ revision: b.revision, action: b.action, digest: b.digest, at: b.created_at })),
          truncated: rows.length > 1000 || baselines.length > 1000,
          notice: 'Private, unsigned metadata export. No file paths, credentials or source are included. A passing record is not a guarantee of complete security.' };
      });
    },
  };
}
