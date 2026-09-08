import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

export function WorkspaceDeletionRequest(props:{organizationId:string;workspaceId?:string;workspaceName?:string}){
 return <DeletionForm key={`${props.organizationId}:${props.workspaceId??''}`} {...props}/>;
}
function DeletionForm({organizationId,workspaceId,workspaceName}:{organizationId:string;workspaceId?:string;workspaceName?:string}){
 const [scope,setScope]=useState(workspaceId?'workspace_history':'organization_closure');
 const [confirmation,setConfirmation]=useState(''),[acknowledged,setAcknowledged]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[requestId,setRequestId]=useState('');
 const [requests,setRequests]=useState<Array<{id:string;scope:string;workspace_id:string|null;status:string}>>([]),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const [impactRetry,setImpactRetry]=useState(0),[impact,setImpact]=useState<{key:string;counts:Record<string,number>;generatedAt:string}|null>(null),[impactError,setImpactError]=useState<{key:string;message:string}|null>(null);
 const impactKey=`${organizationId}:${scope}:${scope==='workspace_history'?workspaceId:''}:${impactRetry}`;
 const impactReady=impact?.key===impactKey;
 useEffect(()=>{const controller=new AbortController();const query=new URLSearchParams({scope});if(scope==='workspace_history'&&workspaceId)query.set('workspaceId',workspaceId);
  void fetch(`/api/organizations/${encodeURIComponent(organizationId)}/deletion-impact?${query}`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'The affected records could not be counted.');
   if(body.scope!==scope||body.organizationId!==organizationId||body.workspaceId!==(scope==='workspace_history'?workspaceId:null)||body.executionAvailable!==false||body.holdsChecked!==false||!body.counts||!['workspaces','savedUploadRecords','activeUploads','sourceConnections','sourceReleaseRecords','activeJobs','publicLinks'].every(key=>Number.isSafeInteger(body.counts[key])&&body.counts[key]>=0))throw new Error('The deletion scope could not be confirmed.');
   if(!controller.signal.aborted)setImpact({key:impactKey,counts:body.counts,generatedAt:body.generatedAt});
  }).catch(err=>{if(!controller.signal.aborted)setImpactError({key:impactKey,message:err instanceof Error?err.message:'The affected records could not be counted.'});});return()=>controller.abort();
 },[organizationId,workspaceId,scope,impactKey]);
 useEffect(()=>{const controller=new AbortController();void fetch(`/api/organizations/${encodeURIComponent(organizationId)}/deletion-requests`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok||!Array.isArray(body.requests))throw new Error(body.error??'Existing requests could not be loaded.');if(!controller.signal.aborted){setRequests(body.requests);setLoading(false);}}).catch(err=>{if(!controller.signal.aborted){setError(err instanceof Error?err.message:'Existing requests could not be loaded.');setLoading(false);}});return()=>controller.abort();},[organizationId,retry]);
 const phrase=`${scope==='workspace_history'?'DELETE HISTORY':'CLOSE AND DELETE'} ${scope==='workspace_history'?workspaceId:organizationId}`;
 async function withdraw(id:string){
  if(busy)return;setBusy(true);setError('');
  try{const response=await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/deletion-requests/${encodeURIComponent(id)}/withdraw`,{method:'POST'});const body=await response.json();if(!response.ok||body.status!=='withdrawn')throw new Error(body.error??'Withdrawal could not be confirmed.');setRequestId('');setRetry(value=>value+1);}catch(err){setError(err instanceof Error?err.message:'Withdrawal could not be confirmed.');}finally{setBusy(false);}
 }
 async function submit(){
  if(busy||confirmation!==phrase||!acknowledged||!impactReady)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/deletion-requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scope,...(scope==='workspace_history'?{workspaceId}:{}),confirmation,acknowledgeHistory:acknowledged})});
   const body=await response.json();if(!response.ok)throw new Error(body.error??'The request could not be saved.');
   if(typeof body.id!=='string'||body.status!=='pending_review')throw new Error('The request could not be confirmed. Please retry.');
   setRequestId(body.id);setConfirmation('');setAcknowledged(false);setRetry(value=>value+1);
  }catch(err){setError(err instanceof Error?err.message:'The request could not be saved.');}finally{setBusy(false);}
 }
 return <section className="watch-empty mt-6" aria-label="Data deletion"><h3>History and account closure</h3><p>Disconnecting GitHub stops monitoring; it does not delete saved evidence or cancel billing.</p><p>Deletion requires explicit authorisation from an organisation owner. Requests are saved for review only: no history is deleted, no account is closed and no subscription is cancelled by this form. Automated deletion is not available yet.</p>
  {requestId?<p role="status">Request {requestId} saved — pending review. Your history and account remain unchanged.</p>:null}
  {loading?<WatchSkeleton variant="list" className="mt-4" />:null}
  {requests.length?<ul aria-label="Recorded requests">{requests.map(request=><li key={request.id}>{request.scope==='organization_closure'?'Organisation closure':'Workspace history'} · {request.id} · {request.status==='withdrawn'?'Withdrawn — nothing deleted':<>Pending review — nothing deleted <Button variant="outline" disabled={busy} onClick={()=>void withdraw(request.id)}>Withdraw request</Button></>}</li>)}</ul>:null}
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRetry(value=>value+1);}}>Reload requests</Button></div>:null}
  <form onSubmit={event=>{event.preventDefault();void submit();}}>
   <label>Request scope <select value={scope} disabled={busy} onChange={event=>{setScope(event.target.value);setConfirmation('');setAcknowledged(false);setRequestId('');setError('');}}>{workspaceId?<option value="workspace_history">History in {workspaceName??'this workspace'}</option>:null}<option value="organization_closure">Close this organisation and delete its history</option></select></label>
   <p>{scope==='workspace_history'?'This concerns saved scans, findings and receipts in the selected workspace.':'This concerns this organisation and all its workspaces, not other organisations or another person’s account.'} Retention requirements and any holds must be reviewed before execution.</p>
   <section aria-label="Deletion scope preview" className="my-4"><h4>Affected records — current inventory</h4>{impactReady?<><dl className="grid gap-3 sm:grid-cols-2 my-3">{([['workspaces','Workspaces'],['savedUploadRecords','Saved upload records'],['activeUploads','Uploads queued or running'],['sourceConnections','Source connections'],['sourceReleaseRecords','Source release records'],['activeJobs','Active background jobs'],['publicLinks','Active public links']] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{impact.counts[key]}</dd></div>)}</dl><p>Counted {new Date(impact.generatedAt).toLocaleString()}. Counts can change; upload and source records may overlap. This is not a deletion schedule. Legal holds, backup copies and third-party retention have not been checked.</p></>:impactError?.key===impactKey?<p role="alert">{impactError.message}</p>:<p role="status">Counting the selected scope…</p>}<Button type="button" variant="outline" disabled={busy} onClick={()=>{setAcknowledged(false);setImpactRetry(value=>value+1);}}>Refresh inventory</Button></section>
   <label><input type="checkbox" checked={acknowledged} disabled={busy||!impactReady} onChange={event=>setAcknowledged(event.target.checked)}/> I explicitly authorise deletion of the selected history after review and understand deletion may be irreversible.</label>
   <p>Type exactly: <code>{phrase}</code></p><label>Deletion confirmation <input value={confirmation} disabled={busy} autoComplete="off" spellCheck={false} onChange={event=>setConfirmation(event.target.value)}/></label>
   <Button type="submit" variant="outline" disabled={busy||!impactReady||!acknowledged||confirmation!==phrase}>{busy?'Saving request…':'Request deletion review'}</Button>
  </form>
 </section>;
}
