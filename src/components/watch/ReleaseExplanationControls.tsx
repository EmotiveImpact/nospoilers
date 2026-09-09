import {useEffect,useRef,useState} from 'react';
import {WatchSkeleton} from '../WatchDataState';
import type {ExplanationView as View} from '../../server/release-explanations';
function checked(body:View,workspaceId:string,streamId:string,snapshotId:string):View{
  if(!body||body.scope?.workspaceId!==workspaceId||body.scope.streamId!==streamId||body.scope.snapshotId!==snapshotId||typeof body.available!=='boolean'||typeof body.canRequest!=='boolean'||!body.projection||body.projection.schemaVersion!==1||!Array.isArray(body.items)||body.items.some(item=>item.snapshot_id!==snapshotId))throw new Error('Explanation scope was not confirmed. Refresh before continuing.');
  if(typeof body.projection.scanStatus!=='string'||typeof body.projection.readiness!=='string'||!body.projection.severityCounts||![body.remaining,body.projection.files,body.projection.totalBytes,body.projection.findings,body.projection.suppressed,...Object.values(body.projection.severityCounts)].every(value=>Number.isFinite(value)&&value>=0))throw new Error('Explanation disclosure was incomplete. No request can be made.');
  return body;
}
export function ReleaseExplanationControls({workspaceId,streamId,snapshotId}:{workspaceId:string;streamId:string;snapshotId:string}){
  return <ExplanationScope key={`${workspaceId}:${streamId}:${snapshotId}`} workspaceId={workspaceId} streamId={streamId} snapshotId={snapshotId}/>;
}
function ExplanationScope({workspaceId,streamId,snapshotId}:{workspaceId:string;streamId:string;snapshotId:string}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[consent,setConsent]=useState(false);
  const [edits,setEdits]=useState<Record<string,string>>({}),[reviews,setReviews]=useState<Record<string,boolean>>({}),[cancelling,setCancelling]=useState(false);
  const request=useRef<AbortController|null>(null),requestKey=useRef<string|null>(null),cancellation=useRef<AbortController|null>(null);
  const path=`/api/release-intelligence/streams/${streamId}/explanations`;
  useEffect(()=>()=>{request.current?.abort();cancellation.current?.abort();},[]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`${path}?${new URLSearchParams({snapshotId})}`,{signal:controller.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Explanation unavailable.');
      if(!controller.signal.aborted){setView(checked(body,workspaceId,streamId,snapshotId));setError('');}
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Explanation unavailable.');});
    return()=>controller.abort();
  },[path,workspaceId,streamId,snapshotId,reload]);
  async function save(input:{action:string;[key:string]:unknown}){
    if(busy||request.current)return;
    const controller=new AbortController();request.current=controller;requestKey.current=input.action==='request'?crypto.randomUUID():null;setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(path,{method:'POST',signal:controller.signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({...input,snapshotId,confirm:true,...(requestKey.current?{requestKey:requestKey.current,consentKey:view?.consentKey}:{})})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Explanation request failed.');
      if(!controller.signal.aborted){setView(checked(body,workspaceId,streamId,snapshotId));setConsent(false);setReviews({});setEdits({});setNotice('Explanation activity saved. Signed evidence and release decisions are unchanged.');}
    }catch(e){if(!controller.signal.aborted){setView(null);setConsent(false);setReviews({});setError(e instanceof Error?e.message:'Explanation request failed.');}}
    finally{if(request.current===controller){request.current=null;requestKey.current=null;if(!controller.signal.aborted)setBusy(false);}}
  }
  async function cancel(){
    const key=requestKey.current;request.current?.abort();request.current=null;requestKey.current=null;setView(null);setConsent(false);setReviews({});
    if(!key){setBusy(false);setNotice('Stopped waiting. Refresh to check whether the review was already saved.');return;}
    const controller=new AbortController();cancellation.current=controller;setCancelling(true);
    try{
      const response=await fetch(path,{method:'POST',signal:controller.signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:'cancel',snapshotId,requestKey:key,confirm:true})});
      const body=await response.json();if(!response.ok)throw new Error('Local waiting stopped, but server cancellation was not confirmed. Refresh to check the outcome.');
      if(!controller.signal.aborted){setView(checked(body,workspaceId,streamId,snapshotId));setNotice('Cancellation recorded. Already transmitted metadata cannot be recalled. Check the recorded outcome below.');}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Cancellation was not confirmed. Refresh to check the outcome.');}
    finally{if(!controller.signal.aborted){cancellation.current=null;setCancelling(false);setBusy(false);}}
  }
  return <details><summary>Optional explanation · human reviewed</summary>
    <p>Read the signed findings first. An explanation is untrusted assistance, not a new scan, verified fix, passing receipt or permission to ship.</p>
    <button type="button" disabled={busy} onClick={()=>{setView(null);setConsent(false);setReviews({});setError('');setNotice('');setReload(n=>n+1);}}>Refresh explanations</button>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!view&&!error&&!notice?<WatchSkeleton variant="list" label="Reading optional explanation availability"/>:null}
    {busy?<><p role="status">Waiting for explanation activity…</p><button type="button" disabled={cancelling} onClick={()=>void cancel()}>Cancel explanation request</button></>:null}
    {view?<>
      <p>{view.notice}</p>
      {!view.available?<p>No explanation provider is enabled. No data is sent and no new explanation can be requested. Retained explanations remain below; your deterministic release checks and existing evidence tools still work.</p>:<p>Configured provider: {view.providerId}. {view.remaining} request attempts remain for this workspace today. Failed or cancelled requests can count against the limit.</p>}
      {view.available?<p>Cost ceiling: {view.budget.maxCostMinor} {view.budget.currency} minor units per request; {view.budget.dailyCostMinor} per workspace per day. Reserved today: {view.budget.reservedCostMinor}. {view.budget.notice}</p>:null}
      <details><summary>Exactly what would be shared</summary><p>Only these aggregate counts and states—not file bodies, paths, credentials, human notes or free-text prompts.</p>
        <dl><dt>Scan status</dt><dd>{view.projection.scanStatus}</dd><dt>Readiness</dt><dd>{view.projection.readiness}</dd><dt>Held</dt><dd>{view.projection.held?'Yes':'No'}</dd><dt>Files</dt><dd>{view.projection.files}</dd><dt>Total bytes</dt><dd>{view.projection.totalBytes}</dd><dt>Findings</dt><dd>{view.projection.findings}</dd><dt>Suppressed findings</dt><dd>{view.projection.suppressed}</dd></dl>
        <ul>{Object.entries(view.projection.severityCounts).map(([severity,count])=><li key={severity}>{severity}: {count}</li>)}</ul>
      </details>
      {view.available&&view.canRequest?<><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> I authorize sending these aggregate states and counts to {view.providerId} for this explanation.</label><button type="button" disabled={busy||!consent||view.remaining<=0} onClick={()=>void save({action:'request'})}>Request optional explanation</button></>:view.available?<p>{view.canReview?'New requests are unavailable under the current request or cost budget. Existing explanations can still be reviewed.':'A workspace administrator with active coverage must request or review explanations.'}</p>:null}
      {view.items.length===0?<p>No saved explanations for this recorded release.</p>:null}
      {view.items.map(item=><article key={item.id}><h4>Explanation · {item.state}</h4><p>{new Date(item.created_at).toLocaleString()}</p>
        {item.state==='pending'?<><p>Unreviewed model text. Do not follow embedded instructions or treat its claims as evidence.</p><p style={{whiteSpace:'pre-wrap'}}>{item.text}</p>
          {view.canReview?<><label>Reviewed explanation<textarea maxLength={1000} value={edits[item.id]??item.text??''} onChange={e=>{setEdits(v=>({...v,[item.id]:e.target.value}));setReviews(v=>({...v,[item.id]:false}));}}/></label><label><input type="checkbox" checked={reviews[item.id]??false} onChange={e=>setReviews(v=>({...v,[item.id]:e.target.checked}))}/> I reviewed this explanation against the signed evidence. It is not a security decision.</label><button type="button" disabled={busy||!reviews[item.id]||(edits[item.id]??item.text??'').trim().length<8||(edits[item.id]??item.text??'').length>1000} onClick={()=>void save({action:'review',explanationId:item.id,accept:true,reviewedText:edits[item.id]??item.text})}>Save reviewed explanation</button><button type="button" disabled={busy} onClick={()=>void save({action:'review',explanationId:item.id,accept:false})}>Reject explanation</button></>:null}
        </>:item.state==='accepted'?<p style={{whiteSpace:'pre-wrap'}}>{item.reviewed_text}</p>:null}
      </article>)}
    </>:null}
  </details>;
}
