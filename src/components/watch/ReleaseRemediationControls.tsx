import {useEffect,useId,useRef,useState} from 'react';
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
  const noteId=useId();
  const noteInput=useRef<HTMLTextAreaElement|null>(null);
  const noteHelp=<p id={noteId} className="ns-intelligence__muted">Each action below requires a note of at least 8 characters. Explain what you reviewed or changed; do not include secrets.</p>;
  const requiredNote=<div className="ns-intelligence__note-required"><p role="status">Add a remediation note of at least 8 characters to continue.</p><button type="button" onClick={()=>noteInput.current?.focus()}>Add required note</button></div>;
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
  const phase=current?.observation?3:review?2:current?1:0;
  return <section className="border-t border-white/8 pt-5" aria-labelledby="remediation-workflow-title">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="ns-intelligence__eyebrow">Finding to rebuilt evidence</p>
        <h4 id="remediation-workflow-title" className="mt-1 text-[15px] font-medium text-snow">Verify a fix without rewriting the original.</h4>
        <p className="ns-intelligence__muted max-w-2xl text-xs">Record the reviewed change, then compare it with fresh signed evidence from the rebuilt artifact.</p>
      </div>
      <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh remediation</button>
    </header>

    <ol className="mt-5 grid gap-2 border-y border-white/8 py-3 sm:grid-cols-3" aria-label="Remediation progress">
      {[[1,'Original finding'],[2,'Reviewed change'],[3,'Rebuilt evidence']].map(([step,label])=><li key={step} aria-current={phase===step?'step':undefined} className={phase===step?'text-snow':'text-mute'}><span className="mr-2 font-mono text-[10px] tabular-nums text-dim">0{step}</span><span className="text-xs">{label}</span></li>)}
    </ol>

    {error?<p role="alert" tabIndex={-1} ref={errorTarget}>{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!view&&!error?<WatchSkeleton variant="list" label="Reading remediation evidence"/>:null}
    {view?<>
      <p className="ns-intelligence__muted">{view.notice}</p>
      {!view.current?<p>Record this release in the selected stream to investigate its signed findings. Existing cases below belong to this stream, not necessarily this release.</p>:!view.current.findings.length?<p>This recorded release has no signed findings to investigate. Existing stream cases remain available; a clean scan does not automatically resolve them.</p>:null}
      {view.canWrite?<div className="mt-5 rounded-lg bg-white/[0.025] p-4"><label>Remediation note (no secrets)<textarea ref={noteInput} aria-describedby={noteId} minLength={8} maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);resetConfirmation();}}/></label>{noteHelp}</div>:<p>Saved remediation is read-only for your current access.</p>}

      <section className="mt-6 border-t border-white/8 pt-5" aria-labelledby="remediation-step-finding">
        <p className="ns-intelligence__eyebrow">Step 1</p>
        <h4 id="remediation-step-finding" className="mt-1 text-base font-medium text-snow">Original finding</h4>
        {view.cases.length?<label>Remediation case<select disabled={busy} value={current?.id??''} onChange={e=>{caseFocus.current=document.activeElement===e.currentTarget?{control:e.currentTarget,id:e.target.value}:null;setError('');setSelected(e.target.value);setView(null);resetConfirmation();}}>{view.cases.map(c=><option key={c.id} value={c.id}>{c.finding} · {c.id.slice(0,8)}</option>)}</select></label>:<p>No tracked remediation in this stream. Start from a recorded finding; a passing scan does not invent one.</p>}
        {current?<><h5 ref={caseHeading} tabIndex={-1} className="mt-4 text-sm font-medium text-snow">Remediation case · {current.finding}</h5><p><strong>Original finding</strong> <code>{current.finding}</code></p>
          <p role="status">{current.unavailable?'Linked evidence is unavailable; no current resolution is inferred.':current.observation?current.observation.reason:review?'Reviewed change recorded. Rebuild and check fresh signed evidence next.':'Investigation open. Record a reviewed change before checking a rebuild.'}</p>
          {current.observation?<><p>{current.observation.scope}</p><p>Other recorded findings in this rebuild: {current.observation.otherFindings}. This observation does not approve the release.</p></>:null}
          {view.canWrite?<div className="ns-intelligence__actions justify-start"><button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void save('investigate')}>Add investigation note</button><button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void save('reopen')}>Reopen investigation</button></div>:null}
        </>:null}
        {view.canWrite&&!!view.current?.findings.length?<form className="mt-4" onSubmit={e=>{e.preventDefault();void save('start');}}>
          <label>Original signed finding<select required value={finding} onChange={e=>setFinding(e.target.value)}><option value="">Choose the finding to investigate</option>{view.current.findings.map(f=><option key={f} value={f}>{f}</option>)}</select></label>
          {reason.trim().length<8?requiredNote:null}
          <button type="submit" disabled={busy||!finding||reason.trim().length<8}>Start investigation</button>
        </form>:null}
      </section>

      <section className="mt-6 border-t border-white/8 pt-5" aria-labelledby="remediation-step-review">
        <p className="ns-intelligence__eyebrow">Step 2</p>
        <h4 id="remediation-step-review" className="mt-1 text-base font-medium text-snow">Record a human-reviewed change</h4>
        {!current?<p>Start or select an investigation before recording what a person reviewed.</p>:!view.canWrite?<p>The reviewed change is available as read-only evidence for your current access.</p>:<>
          <p>Add the change URL, full commit hash and review time, then confirm your review. The remediation note above is saved with this action.</p>
          <form onSubmit={e=>{e.preventDefault();void save('review');}}>
            <label>Change or PR URL<input required type="url" maxLength={500} value={changeUrl} onChange={e=>{setChangeUrl(e.target.value);setReviewConfirm(false);}} placeholder="https://github.com/your-org/repo/pull/123"/></label>
            <label>Full reviewed commit hash<input required minLength={40} maxLength={64} value={commit} onChange={e=>{setCommit(e.target.value);resetConfirmation();}}/></label>
            <label>Review time (ISO timestamp with timezone)<input required value={reviewedAt} onChange={e=>{setReviewedAt(e.target.value);setReviewConfirm(false);}} placeholder="2026-09-09T12:00:00Z"/></label>
            <label><input type="checkbox" checked={reviewConfirm} onChange={e=>setReviewConfirm(e.target.checked)}/> I reviewed this change. NoSpoilers has not independently verified its review or merge status.</label>
            {reason.trim().length<8?requiredNote:!reviewConfirm?<p>Confirm that you reviewed this change to enable recording.</p>:null}
            <button type="submit" disabled={busy||!reviewConfirm||reason.trim().length<8}>Record reviewed change</button>
          </form>
        </>}
      </section>

      <section className="mt-6 border-t border-white/8 pt-5" aria-labelledby="remediation-step-rebuild">
        <p className="ns-intelligence__eyebrow">Step 3</p>
        <h4 id="remediation-step-rebuild" className="mt-1 text-base font-medium text-snow">Check a rebuilt artifact</h4>
        {!current?<p>Select an investigation first. A clean build cannot create or replace an original finding.</p>:!review?<p>Record the reviewed change before connecting a rebuilt artifact to this case.</p>:<>
          <p>Reviewed commit: <code>{review.detail.commit}</code>. Select a retained, newer build from this stream, under the same scanner and policy. The check covers 24-hour-fresh evidence, not deployed production.</p>
          {view.canWrite?<form onSubmit={e=>{e.preventDefault();void save('verify');}}><label>Rebuilt artifact<select required value={candidate} onChange={e=>{setCandidate(e.target.value);setBuildConfirm(false);}}><option value="">Choose recorded rebuild</option>{snapshots.filter(s=>s.id!==current.original_snapshot).map(s=><option key={s.id} value={s.id}>{new Date(s.scanned_at).toLocaleString()} · {s.digest.slice(0,16)} · {s.record_kind}:{s.record_id}</option>)}</select></label>
            <p>Only this history page is listed. Record the new scan in this stream first, or use history pagination to find older records.</p>
            <label><input type="checkbox" checked={buildConfirm} onChange={e=>setBuildConfirm(e.target.checked)}/> I confirm this rebuilt artifact contains the reviewed change. This linkage is my declaration, not a provider attestation.</label>
            {reason.trim().length<8?requiredNote:null}
            <button type="submit" disabled={busy||!buildConfirm||!candidate||reason.trim().length<8}>Verify selected rebuild</button>
          </form>:null}
        </>}
      </section>

      <div className="mt-5"><a href={`/watch/sources?workspace=${encodeURIComponent(workspaceId)}`}>Open Coverage for existing reviewable remediation PR tools</a></div>
      {current?<details><summary>Linked evidence and technical activity</summary>{current.history.map(e=><article key={e.id}><strong>{e.action} · {e.actor_login}</strong><p>{new Date(e.created_at).toLocaleString()} · {e.detail.reason}</p>{e.detail.changeUrl?<a href={e.detail.changeUrl} target="_blank" rel="noopener noreferrer">Human-linked change</a>:null}{e.detail.commit?<code>{e.detail.commit}</code>:null}{e.detail.record?<a href={`/watch/releases?workspace=${encodeURIComponent(workspaceId)}&${e.detail.record.kind==='upload'?`upload=${encodeURIComponent(e.detail.record.id)}&uploadView=detail`:`release=${encodeURIComponent(e.detail.record.id)}`}`}>Inspect linked signed rebuild</a>:null}{e.detail.digest?<code>{e.detail.digest}</code>:null}{e.detail.result?<p>Historical check: {e.detail.result.reason} Current availability and freshness are checked above.</p>:null}</article>)}</details>:null}
    </>:null}
  </section>;
}
