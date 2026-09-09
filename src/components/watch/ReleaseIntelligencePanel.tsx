import { useEffect, useRef, useState } from 'react';
import type { Analysis, Baseline, Ref, Snapshot, Stream } from '../../release-intelligence/model';
import './release-intelligence.css';
type Listed = { streams: Stream[]; links: Array<{ stream_id: string; snapshot_id: string }>; canManage: boolean; canWrite: boolean };
type View = {
  stream: Stream; snapshots: Snapshot[]; selected: Snapshot | null; nextCursor: string | null;
  canManage: boolean; canWrite: boolean; unavailable: boolean; baselineEligible: boolean;
  analysis: (Analysis & { unavailable: number; inspectedHistoryRows: number; budgetLimited: boolean }) | null;
  baselines: Baseline[]; currentBaselineState: string;
  events: Array<{ id: string; action: string; actor_login: string; created_at: string }>; notice: string;
};
const API = '/api/release-intelligence';
async function read<T>(path: string, signal: AbortSignal, input?: object): Promise<T> {
  const response = await fetch(path, { signal, credentials: 'same-origin', cache: 'no-store',
    ...(input ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Release history is unavailable.');
  return data as T;
}
export function ReleaseIntelligenceFromRecord({ record }: { record: Ref }) {
  return <RecordContext key={`${record.kind}:${record.id}`} record={record}/>;
}
function RecordContext({ record }: { record: Ref }) {
  const [workspace, setWorkspace] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(''); setWorkspace('');
    void read<{ workspaceId: string }>(`${API}/record-context/${record.kind}/${encodeURIComponent(record.id)}`, controller.signal)
      .then(body => { if (!controller.signal.aborted) { if (!body.workspaceId) throw new Error('Record workspace was not returned.'); setWorkspace(body.workspaceId); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'History unavailable.'); });
    return () => controller.abort();
  }, [record.kind, record.id, retry]);
  if (workspace) return <ReleaseIntelligencePanel key={`${workspace}:${record.kind}:${record.id}`} workspaceId={workspace} record={record}/>;
  return <section className="ns-intelligence" aria-label="Release history"><h2>Release history</h2><p role={error ? 'alert' : 'status'}>{error || 'Checking access to this release’s historical context…'}</p>{error ? <button type="button" onClick={() => setRetry(n => n + 1)}>Retry history</button> : null}</section>;
}
export function ReleaseIntelligencePanel({ workspaceId, record }: { workspaceId: string; record: Ref }) {
  const [list, setList] = useState<Listed | null>(null), [view, setView] = useState<View | null>(null);
  const [streamId, setStreamId] = useState(''), [snapshotId, setSnapshotId] = useState(''), [before, setBefore] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [name, setName] = useState(''), [streamKey, setStreamKey] = useState(''), [role, setRole] = useState(''), [reason, setReason] = useState('');
  const lifetime = useRef<AbortController | null>(null), didAutoselect = useRef(false);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    const query = new URLSearchParams({ workspaceId, recordKind: record.kind, recordId: record.id });
    void read<Listed>(`${API}/streams?${query}`, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(body.streams) || !Array.isArray(body.links)) throw new Error('History response was incomplete.');
      setList(body);
      if (!didAutoselect.current) { didAutoselect.current = true; if (!streamId && body.links.length === 1) { setStreamId(body.links[0].stream_id); setSnapshotId(body.links[0].snapshot_id); } }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'History unavailable.'); });
    return () => controller.abort();
  }, [workspaceId, record.kind, record.id, reload, streamId]);
  useEffect(() => {
    const controller = new AbortController(); setView(null);
    if (!streamId) return () => controller.abort();
    const params = new URLSearchParams(); if (snapshotId) params.set('snapshotId', snapshotId); if (before) params.set('before', before);
    void read<View>(`${API}/streams/${streamId}?${params}`, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      if (body.stream?.id !== streamId || body.stream.workspace_id !== workspaceId || !Array.isArray(body.snapshots)) throw new Error('History belongs to another stream or is incomplete.');
      setView(body);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Stream unavailable.'); });
    return () => controller.abort();
  }, [workspaceId, streamId, snapshotId, before, reload]);
  async function save(action: 'create' | 'capture' | 'baseline' | 'exclusions', input: object, message: string) {
    const signal = lifetime.current?.signal; if (!signal || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const suffix = action === 'create' ? '' : `/${streamId}/${action === 'capture' ? 'records' : action}`;
      const result = await read<{ stream?: Stream; snapshot?: Snapshot; revision?: number }>(`${API}/streams${suffix}`, signal, input);
      if (signal.aborted) return;
      if (action === 'create' || action === 'capture') {
        if (!result.snapshot || result.snapshot.record_kind !== record.kind || result.snapshot.record_id !== record.id || action === 'capture' && result.snapshot.stream_id !== streamId) throw new Error('The saved record was not confirmed.');
        if (action === 'create' && (!result.stream || result.stream.id !== result.snapshot.stream_id)) throw new Error('The stream creation was not confirmed.');
        if (result.stream) setStreamId(result.stream.id);
        setSnapshotId(result.snapshot.id); setBefore('');
      } else if (!Number.isSafeInteger(result.revision)) throw new Error('The new history revision was not confirmed.');
      setReason(''); setNotice(message); setReload(n => n + 1);
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'Change not saved.'); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  async function exportHistory() {
    const signal = lifetime.current?.signal; if (!signal || busy || !streamId) return;
    setBusy(true); setError('');
    try {
      const data = await read<{ type: string; signed: boolean }>(`${API}/streams/${streamId}/export`, signal);
      if (signal.aborted) return;
      if (data.type !== 'nospoilers-private-history' || data.signed !== false) throw new Error('Export response was incomplete.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `nospoilers-history-${streamId}.json`; link.click(); URL.revokeObjectURL(url);
      setNotice('Private history exported. This is an unsigned summary, not a certificate.');
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : 'Export failed.'); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  const selected = view?.selected, analysis = view?.analysis;
  const linked = list?.links.some(link => link.stream_id === streamId);
  const viewingAnother = selected && (selected.record_id !== record.id || selected.record_kind !== record.kind);
  return <section className="ns-intelligence" aria-labelledby={`history-${record.kind}-${record.id}`} aria-busy={busy}>
    <header><div><p className="ns-intelligence__eyebrow">Release intelligence</p><h2 id={`history-${record.kind}-${record.id}`}>Every release adds context.</h2></div><span className="ns-intelligence__badge">Advisory analysis</span></header>
    <p>Compare observed changes with retained history and an explicitly approved reference. Unusual does not automatically mean unsafe.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setReload(n => n + 1)}>Retry saved history</button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {!list ? <p role="status">Reading release streams…</p> : <>
      {!list.streams.length ? <p>No release streams yet. Give this product and artefact role a stable identity; filenames alone do not group releases.</p> : <div className="ns-intelligence__actions"><label>Release stream<select disabled={busy} value={streamId} onChange={e => { setStreamId(e.target.value); setSnapshotId(''); setBefore(''); setError(''); setNotice(''); }}><option value="">Choose a stream</option>{list.streams.map(s => <option key={s.id} value={s.id}>{s.name} · {s.artifact_role} · {s.channel}</option>)}</select></label>{streamId && view?.canWrite && !linked ? <button type="button" disabled={busy} onClick={() => void save('capture', { record }, 'This signed release was added to the selected history.')}>Add this release to history</button> : null}</div>}
      {list.canManage ? <details><summary>Create a release stream from this record</summary><form onSubmit={e => { e.preventDefault(); void save('create', { workspaceId, name, key: streamKey, role, record }, 'Stream created and the first signed record saved. No baseline was adopted automatically.'); }}><p>Choose a stable product name and artefact role. Source, channel and format are bound from this record and cannot be silently reassigned.</p><label>Name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label><label>Stable key<input required minLength={2} maxLength={64} pattern="[a-z0-9][a-z0-9_\-]{1,63}" value={streamKey} onChange={e => setStreamKey(e.target.value)} placeholder="dashboard-web"/></label><label>Artefact role<input required maxLength={80} value={role} onChange={e => setRole(e.target.value)} placeholder="Production browser bundle"/></label><button type="submit" disabled={busy}>Create stream and record release</button></form></details> : <p className="ns-intelligence__muted">A workspace administrator with active coverage can create streams and manage approved references.</p>}
    </>}
    {streamId && !view && !error ? <p role="status">Loading the selected history…</p> : null}
    {view ? <>
      <header><h3>{view.stream.name}</h3><div className="ns-intelligence__actions"><button type="button" disabled={busy} onClick={() => setReload(n => n + 1)}>Refresh history</button><button type="button" disabled={busy} onClick={() => void exportHistory()}>Export private history</button></div></header>
      {viewingAnother ? <p className="ns-intelligence__notice">You are inspecting a different saved historical record, not the release displayed above this section.</p> : null}
      {view.unavailable ? <p role="status">The original authorised evidence is unavailable or changed. No historical conclusion is inferred.</p> : null}
      {analysis ? <>
        <dl className="ns-intelligence__facts"><div><dt>Distinct prior releases</dt><dd>{analysis.history}</dd></div><div><dt>Eligible statistical samples</dt><dd>{analysis.eligible}</dd></div><div><dt>Current approved reference</dt><dd>{view.currentBaselineState.replaceAll('_', ' ')}</dd></div></dl>
        <p>{analysis.state === 'first_release' ? 'First recorded release. Exact comparisons become available after another compatible release.' : analysis.eligible < 5 ? 'History is building. Statistical review needs at least five distinct, compatible passing releases without findings or exceptions.' : 'Historical comparison is available. Inspect changes in context before deciding what to do.'}</p>
        <p className="ns-intelligence__muted">Reference applicable at scan time: {analysis.baseline.state.replaceAll('_', ' ')}. A newly adopted reference applies to subsequent scans.</p>
        {!analysis.signals.length ? <p>No historical review signals in this bounded comparison. This is not a complete security verdict.</p> : <div className="ns-intelligence__signals">{analysis.signals.map(signal => <details key={signal.code}><summary>{signal.title} <span>{signal.count.toLocaleString()}</span></summary><p>{signal.detail}</p><p className="ns-intelligence__muted">Comparison samples: {signal.samples}. Up to 20 examples shown.</p>{signal.examples.map(example => <code key={example}>{example}</code>)}</details>)}</div>}
        <details><summary>How this comparison was calculated</summary><p>{analysis.notice}</p><p>Window: {analysis.windowStart ?? 'No prior release'} to {analysis.windowEnd ?? 'No prior release'}. At most 30 distinct releases are used from 60 saved candidates.</p><p>{analysis.excluded} excluded; {analysis.duplicates} duplicate digests; {analysis.incompatible} incompatible; {analysis.unavailable} unavailable. {analysis.budgetLimited ? 'The metadata budget shortened this window. ' : ''}Current exclusions are respected. Different engine and policy contexts are not statistical peers.</p></details>
      </> : null}
      <details><summary>Approved reference and history exclusions</summary><p>{view.notice}</p>{view.canManage && selected ? <><label>Reason for change<textarea minLength={8} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this reference or history selection should change."/></label><div className="ns-intelligence__actions"><button type="button" disabled={busy || reason.trim().length < 8 || !view.baselineEligible} onClick={() => void save('baseline', { action: 'adopt', snapshotId: selected.id, reason, expectedRevision: view.stream.revision }, 'Reference adopted with a new revision. Original scan evidence is unchanged.')}>Adopt selected reference</button><button type="button" disabled={busy || reason.trim().length < 8 || view.baselines[0]?.action !== 'adopt'} onClick={() => void save('baseline', { action: 'revoke', reason, expectedRevision: view.stream.revision }, 'Reference revoked. No older reference was silently reinstated.')}>Revoke current reference</button><button type="button" disabled={busy || view.unavailable || reason.trim().length < 8} onClick={() => void save('exclusions', { snapshotId: selected.id, excluded: !selected.excluded, reason, expectedRevision: view.stream.revision }, selected.excluded ? 'Record restored to historical context.' : 'Record excluded from historical context; its evidence remains unchanged.')}>{selected.excluded ? 'Restore to history' : 'Exclude from analysis'}</button></div><p>Only passing, currently accessible records without findings, exceptions, rejection or hold are eligible references.</p></> : <p>Reference changes are restricted to workspace administrators. Read access does not authorise changes.</p>}{view.baselines.map(b => <article key={b.id}><strong>Revision {b.revision}: {b.action}</strong><p>{b.reason}</p><small>{b.actor_login} · {new Date(b.created_at).toLocaleString()}</small></article>)}</details>
      <details open><summary>Recorded release history</summary><div className="ns-intelligence__history">{view.snapshots.map(s => <button type="button" key={s.id} disabled={busy} aria-pressed={selected?.id === s.id} onClick={() => setSnapshotId(s.id)}><strong>{new Date(s.scanned_at).toLocaleString()}</strong><code>{s.digest.slice(0, 16)}…</code><span>{s.metrics.files} files · {s.excluded ? 'Excluded from analysis' : 'Recorded'}</span></button>)}</div><div className="ns-intelligence__actions"><button type="button" disabled={busy || !before} onClick={() => { setBefore(''); setSnapshotId(''); }}>Newest history</button><button type="button" disabled={busy || !view.nextCursor} onClick={() => { setBefore(view.nextCursor!); setSnapshotId(''); }}>Older history</button></div></details>
      <details><summary>Record subsequent builds from CI</summary><p>Use a workspace scan token with the repository’s scan-and-record command. It reuses the existing scan policy and never adopts references automatically.</p><code>node scripts/scan-release-stream.mjs {view.stream.id} path/to/build.tgz</code><p>Set NOSPOILERS_BASE_URL and NOSPOILERS_TOKEN securely in CI. This command supports workspace upload streams, not legacy installation-token streams.</p></details>
      <details><summary>Recent history activity</summary>{view.events.map(event => <p key={event.id}>{event.action.replaceAll('_', ' ')} · {event.actor_login} · {new Date(event.created_at).toLocaleString()}</p>)}</details>
    </> : null}
  </section>;
}
