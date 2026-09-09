import {useEffect,useRef,useState} from 'react';
import {WatchSkeleton} from '../WatchDataState';
import type {OutcomeSummary} from '../../release-intelligence/outcomes';
type View={enabled:boolean;revision:number;canConfigure:boolean;notice:string;summary:OutcomeSummary|null};
export function ReleaseOutcomeControls({streamId,workspaceId}:{streamId:string;workspaceId:string}){
  const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
  const lifetime=useRef<AbortController|null>(null);
  const initiatingControl=useRef<HTMLElement|null>(null),errorFocus=useRef<HTMLDivElement|null>(null),statusFocus=useRef<HTMLParagraphElement|null>(null);
  useEffect(()=>{
    const moved=(event:FocusEvent)=>{if(initiatingControl.current&&event.target!==initiatingControl.current)initiatingControl.current=null;};
    document.addEventListener('focusin',moved);return()=>document.removeEventListener('focusin',moved);
  },[]);
  useEffect(()=>{
    if(!error&&!message)return;
    const control=initiatingControl.current;initiatingControl.current=null;
    if(control&&!control.isConnected&&document.activeElement===document.body)(error?errorFocus.current:statusFocus.current)?.focus();
  },[error,message]);
  function rememberFocus(){initiatingControl.current=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;}
  const url=`/api/release-intelligence/streams/${streamId}/outcomes`;
  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{
    const c=new AbortController();
    void fetch(`${url}${open?`?month=${encodeURIComponent(month)}`:''}`,{signal:c.signal,credentials:'same-origin',cache:'no-store'}).then(async r=>{
      const body=await r.json();if(!r.ok)throw new Error(typeof body.error==='string'?body.error:'Outcomes unavailable.');
      if(typeof body.enabled!=='boolean'||!Number.isSafeInteger(body.revision)||body.summary&&(body.summary.scope?.streamId!==streamId||body.summary.scope?.workspaceId!==workspaceId||body.summary.window?.month!==month))throw new Error('Outcome summary scope was not confirmed.');
      if(!c.signal.aborted){setView(body);setError('');}
    }).catch(e=>{if(!c.signal.aborted){setView(null);setError(e instanceof Error?e.message:'Outcomes unavailable.');}});
    return()=>c.abort();
  },[url,streamId,workspaceId,month,open,reload]);
  async function preference(enabled:boolean){const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy||!view)return;rememberFocus();setBusy(true);setError('');setMessage('');
    try{const r=await fetch(url,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({enabled,confirm:enabled?confirm:true,expectedRevision:view.revision})});const body=await r.json();if(!r.ok)throw new Error(body.error??'Preference not saved.');
      if(!signal.aborted){setConfirm(false);setView(null);setMessage(enabled?'Private outcome summaries enabled. No messages or telemetry are sent.':'Outcome summaries disabled. Existing release evidence is unchanged.');setReload(n=>n+1);}
    }catch(e){if(!signal.aborted){setView(null);setError(e instanceof Error?e.message:'Preference not saved.');}}finally{if(!signal.aborted)setBusy(false);}
  }
  async function exportSummary(){const signal=lifetime.current?.signal;if(!view?.summary||busy||!signal||signal.aborted)return;rememberFocus();setBusy(true);setError('');setMessage('');
    try{const response=await fetch(`${url}?month=${encodeURIComponent(month)}`,{signal,credentials:'same-origin',cache:'no-store'});const body=await response.json(),summary=body.summary;
      if(!response.ok||!body.enabled||summary?.type!=='nospoilers-private-outcomes'||summary.signed!==false||summary.scope?.streamId!==streamId||summary.scope?.workspaceId!==workspaceId||summary.window?.month!==month)throw new Error('A current authorized outcome summary is unavailable. Refresh before exporting.');
      if(signal.aborted)return;
      const href=URL.createObjectURL(new Blob([JSON.stringify(summary,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=href;link.download=`nospoilers-outcomes-${month}-${streamId}.json`;link.click();URL.revokeObjectURL(href);setView(body);setMessage('Private unsigned summary downloaded. Nothing was published or sent.');
    }catch(e){if(!signal.aborted){setView(null);setError(e instanceof Error?e.message:'Export unavailable.');}}finally{if(!signal.aborted)setBusy(false);}
  }
  const summary=view?.summary,record=summary?.latest?.record;
  const recordHref=record?`/watch/releases?${new URLSearchParams({workspace:workspaceId,...(record.kind==='upload'?{upload:record.id,uploadView:'detail'}:{release:record.id})})}`:null;
  return <details onToggle={e=>{if(e.target!==e.currentTarget||e.currentTarget.open===open)return;setOpen(e.currentTarget.open);setView(null);setError('');}}>
    <summary>Monthly outcomes · private</summary>
    {message?<p ref={statusFocus} tabIndex={-1} role="status">{message}</p>:null}
    {error?<div ref={errorFocus} tabIndex={-1} role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setView(null);setReload(n=>n+1);}}>Retry outcomes</button></div>:null}
    {!view&&!error?<WatchSkeleton variant="list" label="Reading private outcome summary"/>:null}
    {view?<>
      <p>{view.notice}</p>
      {!view.enabled?<><p>Off. An administrator can enable on-demand summaries of this stream’s retained checks and remediation. This does not enable email or engagement tracking.</p>
        {view.canConfigure?<><label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Enable private summaries and a minimal event projection for this stream. No new analytics archive or external provider.</label><button type="button" disabled={busy||!confirm} onClick={()=>void preference(true)}>Enable private outcomes</button></>:null}
      </>:<>
        <div className="ns-intelligence__actions"><label>Summary month (UTC)<input type="month" value={month} disabled={busy} onChange={e=>{setMonth(e.target.value);setView(null);setError('');}}/></label>
          <button type="button" disabled={busy} onClick={()=>{setView(null);setReload(n=>n+1);}}>Refresh summary</button>
          {view.canConfigure?<button type="button" disabled={busy} onClick={()=>void preference(false)}>Turn off outcome summaries</button>:null}
        </div>
        {summary?<>
          <h3>{summary.window.month} · recorded release outcomes</h3>
          <p>UTC {summary.window.start.slice(0,10)} to {summary.window.through}. Scan outcomes are historical; current remediation and reference state are evaluated at {summary.generatedAt}. This is not whole-workspace coverage.</p>
          {summary.records.partial?<p role="status">Partial window: inspected {summary.records.inspected} of {summary.records.retainedInMonth} retained records within the processing budget. Do not treat these counts as complete.</p>:null}
          <dl className="ns-intelligence__facts"><div><dt>Verified scan records</dt><dd>{summary.records.verified}</dd></div><div><dt>Distinct artifact digests</dt><dd>{summary.records.distinctArtifacts}</dd></div><div><dt>Repeated-byte checks</dt><dd>{summary.records.repeatChecks}</dd></div></dl>
          <p>{summary.records.passed} passed the recorded scan policy · {summary.records.failedPolicy} failed policy · {summary.records.inconclusive} inconclusive · {summary.records.unavailable} unavailable.</p>
          <p>{summary.records.withSuppression} records have suppressed findings · {summary.records.held} held · {summary.records.excluded} excluded from historical analysis. A passing scan is not a deployment approval.</p>
          <p>{summary.records.distinctArtifacts===1?'One distinct artifact is recorded in this window. A later compatible build can add comparison context.':summary.records.distinctArtifacts>1?'Different artifact bytes add historical context. This count is not a confidence score or a count of deployments.':'No distinct verified artifact is available in this window.'}</p>
          {summary.records.retainedInMonth===0?<p>No retained recorded scans in this month. This does not mean no releases happened, or that everything was covered.</p>:null}
          <h3>Current remediation evidence</h3>
          <p>{summary.remediation.verifiedAbsent} scoped findings absent in a fresh linked rebuild · {summary.remediation.stillObserved} still observed · {summary.remediation.unknown} unknown · {summary.remediation.awaitingRebuild} awaiting reviewed rebuild evidence.</p>
          <p>Inspected {summary.remediation.inspected} of {summary.remediation.retainedCases} retained cases, across all dates.{summary.remediation.partial?' This is a partial case window.':''} Accepted risk and closed alerts do not count as fixes.</p>
          <p>Current approved reference: {summary.reference.state.replaceAll('_',' ')} (revision {summary.reference.revision}). {summary.reference.adoptedInMonth} adoptions and {summary.reference.revokedInMonth} revocations in this month’s event window.{summary.reference.partial?' Reference activity is limited to the newest 100 events.':''}</p>
          <div className="ns-intelligence__actions">{recordHref?<a href={recordHref}>{summary.latest?.readiness==='blocked'||summary.latest?.readiness==='review'?'Review newest recorded findings':'Open newest record in this month'} →</a>:<a href={`/watch/scan?workspace=${workspaceId}&mode=github`}>Choose the next real release to check →</a>}<button type="button" disabled={busy} onClick={()=>void exportSummary()}>Export private outcome summary</button></div>
          <details><summary>Event contract and limits</summary><p>{summary.events.length} derived events. {summary.eventsPartial?'Incomplete projection; see the window and unavailable counts.':'Bounded to the displayed stream and month.'} Schema version 1 includes only IDs, type/time and coarse scan outcome. No people, paths, source contents, reasons or billing data. Nothing is sent to a provider, and the original retention policy still applies.</p></details>
        </>:null}
      </>}
    </>:null}
  </details>;
}
