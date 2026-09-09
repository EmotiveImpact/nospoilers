import {useEffect,useRef,useState} from 'react';
import {WatchSkeleton} from '../WatchDataState';
import type {Ref,Snapshot} from '../../release-intelligence/model';
import type {RemediationResult} from '../../release-intelligence/remediation';
type Case={id:string;finding:string;revision:number;original_snapshot:string};
type Event={id:string;action:string;actor_login:string;created_at:string;detail:{reason:string;changeUrl?:string;commit?:string;reviewedAt?:string;record?:Ref;digest?:string;result?:RemediationResult}};
type View={cases:Case[];selected:(Case&{history:Event[];observation:RemediationResult|null;unavailable:boolean})|null;current:{snapshotId:string;findings:string[]}|null;canWrite:boolean;notice:string};
export function ReleaseRemediationControls({streamId,workspaceId,record,snapshots}:{streamId:string;workspaceId:string;record:Ref;snapshots:Snapshot[]}){
  return <ReleaseRemediationScope key={`${workspaceId}:${streamId}:${record.kind}:${record.id}`} streamId={streamId} workspaceId={workspaceId} record={record} snapshots={snapshots}/>;
}
function ReleaseRemediationScope({streamId,workspaceId,record,snapshots}:{streamId:string;workspaceId:string;record:Ref;snapshots:Snapshot[]}){
  const [view,setView]=useState<View|null>(null),[selected,setSelected]=useState(''),[reload,setReload]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [finding,setFinding]=useState(''),[reason,setReason]=useState(''),[changeUrl,setChangeUrl]=useState(''),[commit,setCommit]=useState(''),[reviewedAt,setReviewedAt]=useState(''),[candidate,setCandidate]=useState(''),[reviewConfirm,setReviewConfirm]=useState(false),[buildConfirm,setBuildConfirm]=useState(false);
  const resetConfirmation=()=>{setReviewConfirm(false);setBuildConfirm(false);};
  const lifetime=useRef<AbortController|null>(null);
  const errorTarget=useRef<HTMLParagraphElement|null>(null),focusFailure=useRef(false);
  useEffect(()=>{if(error&&focusFailure.current){errorTarget.current?.focus();focusFailure.current=false;}},[error]);
  const caseHeading=useRef<HTMLHeadingElement|null>(null),caseFocus=useRef<{control:HTMLElement;id:string}|null>(null);
  useEffect(()=>{
    const moved=(event:FocusEvent)=>{if(caseFocus.current&&event.target!==caseFocus.current.control)caseFocus.current=null;};
    document.addEventListener('focusin',moved);return()=>document.removeEventListener('focusin',moved);
  },[]);
  useEffect(()=>{
    if(!error&&!view)return;
    const pending=caseFocus.current;caseFocus.current=null;
    if(pending&&!pending.control.isConnected&&document.activeElement===document.body){
      if(error)errorTarget.current?.focus();
      else if(view?.selected?.id===pending.id)caseHeading.current?.focus();
    }
  },[view,error]);

  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{
    const c=new AbortController(),params=new URLSearchParams({recordKind:record.kind,recordId:record.id});if(selected)params.set('caseId',selected);
    setView(null);setReviewConfirm(false);setBuildConfirm(false);
    void fetch(`/api/release-intelligence/streams/${streamId}/remediation?${params}`,{signal:c.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Remediation unavailable.');
      if(!Array.isArray(body.cases))throw new Error('Remediation response incomplete.');
      if(!c.signal.aborted){setView(body);setError('');setReviewConfirm(false);setBuildConfirm(false);}
    }).catch(e=>{if(!c.signal.aborted){setView(null);setError(e instanceof Error?e.message:'Remediation unavailable.');}});
    return()=>c.abort();
  },[streamId,record.kind,record.id,selected,reload]);
  async function save(action:string){
    const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy||!view)return;
    const initiatingControl=document.activeElement;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/remediation`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action,reason,snapshotId:view.current?.snapshotId,finding,caseId:view.selected?.id,expectedRevision:view.selected?.revision,changeUrl,commit,reviewedAt,confirm:action==='review'?reviewConfirm:buildConfirm,candidateSnapshot:candidate})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Remediation was not saved.');
      if(!signal.aborted){setView(null);setSelected(body.caseId);setReload(n=>n+1);setReason('');resetConfirmation();setNotice('Remediation activity saved. Original receipts and alert states are unchanged.');}
    }catch(e){if(!signal.aborted){focusFailure.current=document.activeElement===initiatingControl;setView(null);resetConfirmation();setError(e instanceof Error?e.message:'Remediation was not saved.');}}
    finally{if(!signal.aborted)setBusy(false);}
  }
  const current=view?.selected,review=current?.history.find(e=>e.action==='review');
  return <details><summary>Remediation · finding to rebuilt evidence</summary>
    <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh remediation</button>
    {error?<p role="alert" tabIndex={-1} ref={errorTarget}>{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!view&&!error?<WatchSkeleton variant="list" label="Reading remediation evidence"/>:null}
    {view?<><p>{view.notice}</p>
      <a href={`/watch/sources?workspace=${encodeURIComponent(workspaceId)}`}>Open Coverage for existing reviewable remediation PR tools</a>
      {!view.current?<p>Record this release in the selected stream to investigate its signed findings. Existing cases below belong to this stream, not necessarily this release.</p>:!view.current.findings.length?<p>This recorded release has no signed findings to investigate. Existing stream cases remain available; a clean scan does not automatically resolve them.</p>:null}
      {view.canWrite?<><label>Remediation note (no secrets)<textarea minLength={8} maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);resetConfirmation();}}/></label><p className="ns-intelligence__muted">Each action below requires a note of at least 8 characters. Explain what you reviewed or changed; do not include secrets.</p></>:<p>Saved remediation is read-only for your current access.</p>}
      {view.canWrite&&!!view.current?.findings.length?<form onSubmit={e=>{e.preventDefault();void save('start');}}>
        <label>Original signed finding<select required value={finding} onChange={e=>setFinding(e.target.value)}><option value="">Choose the finding to investigate</option>{view.current.findings.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
        <button type="submit" disabled={busy||!finding||reason.trim().length<8}>Start investigation</button>
      </form>:null}
      {view.cases.length?<label>Remediation case<select disabled={busy} value={current?.id??''} onChange={e=>{caseFocus.current=document.activeElement===e.currentTarget?{control:e.currentTarget,id:e.target.value}:null;setError('');setSelected(e.target.value);setView(null);resetConfirmation();}}>{view.cases.map(c=><option key={c.id} value={c.id}>{c.finding} · {c.id.slice(0,8)}</option>)}</select></label>:<p>No tracked remediation in this stream. Start from a recorded finding; a passing scan does not invent one.</p>}
      {current?<><h4 ref={caseHeading} tabIndex={-1}>Remediation case · {current.finding}</h4><p><strong>Original finding</strong> <code>{current.finding}</code></p>
        <p role="status">{current.unavailable?'Linked evidence is unavailable; no current resolution is inferred.':current.observation?current.observation.reason:review?'Reviewed change recorded. Rebuild and check fresh signed evidence next.':'Investigation open. Record a reviewed change before checking a rebuild.'}</p>
        {current.observation?<><p>{current.observation.scope}</p><p>Other recorded findings in this rebuild: {current.observation.otherFindings}. This observation does not approve the release.</p></>:null}
        {view.canWrite?<><button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void save('investigate')}>Add investigation note</button><button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void save('reopen')}>Reopen investigation</button>
          <details><summary>Record a human-reviewed change</summary><p>Add the change URL, full commit hash and review time, then confirm your review. The remediation note above is saved with this action.</p><form onSubmit={e=>{e.preventDefault();void save('review');}}>
            <label>Change or PR URL<input required type="url" maxLength={500} value={changeUrl} onChange={e=>{setChangeUrl(e.target.value);setReviewConfirm(false);}} placeholder="https://github.com/your-org/repo/pull/123"/></label>
            <label>Full reviewed commit hash<input required minLength={40} maxLength={64} value={commit} onChange={e=>{setCommit(e.target.value);resetConfirmation();}}/></label>
            <label>Review time (ISO timestamp with timezone)<input required value={reviewedAt} onChange={e=>{setReviewedAt(e.target.value);setReviewConfirm(false);}} placeholder="2026-09-09T12:00:00Z"/></label>
            <label><input type="checkbox" checked={reviewConfirm} onChange={e=>setReviewConfirm(e.target.checked)}/> I reviewed this change. NoSpoilers has not independently verified its review or merge status.</label>
            {reason.trim().length<8?<p role="status">Add a remediation note of at least 8 characters above to enable recording.</p>:!reviewConfirm?<p>Confirm that you reviewed this change to enable recording.</p>:null}
            <button type="submit" disabled={busy||!reviewConfirm||reason.trim().length<8}>Record reviewed change</button>
          </form></details>
          {review?<details><summary>Check a rebuilt artifact</summary><p>Reviewed commit: <code>{review.detail.commit}</code>. Select a retained, newer build from this stream, under the same scanner and policy. The check covers 24-hour-fresh evidence, not deployed production.</p>
            <form onSubmit={e=>{e.preventDefault();void save('verify');}}><label>Rebuilt artifact<select required value={candidate} onChange={e=>{setCandidate(e.target.value);setBuildConfirm(false);}}><option value="">Choose recorded rebuild</option>{snapshots.filter(s=>s.id!==current.original_snapshot).map(s=><option key={s.id} value={s.id}>{new Date(s.scanned_at).toLocaleString()} · {s.digest.slice(0,16)} · {s.record_kind}:{s.record_id}</option>)}</select></label>
              <p>Only this history page is listed. Record the new scan in this stream first, or use history pagination to find older records.</p>
              <label><input type="checkbox" checked={buildConfirm} onChange={e=>setBuildConfirm(e.target.checked)}/> I confirm this rebuilt artifact contains the reviewed change. This linkage is my declaration, not a provider attestation.</label>
              {reason.trim().length<8?<p role="status">Add a remediation note of at least 8 characters above before verifying.</p>:null}
              <button type="submit" disabled={busy||!buildConfirm||!candidate||reason.trim().length<8}>Verify selected rebuild</button>
            </form></details>:null}
        </>:null}
        <details><summary>Linked evidence and activity</summary>{current.history.map(e=><article key={e.id}><strong>{e.action} · {e.actor_login}</strong><p>{new Date(e.created_at).toLocaleString()} · {e.detail.reason}</p>{e.detail.changeUrl?<a href={e.detail.changeUrl} target="_blank" rel="noopener noreferrer">Human-linked change</a>:null}{e.detail.commit?<code>{e.detail.commit}</code>:null}{e.detail.record?<a href={`/watch/releases?workspace=${encodeURIComponent(workspaceId)}&${e.detail.record.kind==='upload'?`upload=${encodeURIComponent(e.detail.record.id)}&uploadView=detail`:`release=${encodeURIComponent(e.detail.record.id)}`}`}>Inspect linked signed rebuild</a>:null}{e.detail.digest?<code>{e.detail.digest}</code>:null}{e.detail.result?<p>Historical check: {e.detail.result.reason} Current availability and freshness are checked above.</p>:null}</article>)}</details>
      </>:null}
    </>:null}
  </details>;
}
