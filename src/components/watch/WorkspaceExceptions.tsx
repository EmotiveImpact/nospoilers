import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import './design/policy-page.css';
type Exception={id:string;rule:string;exact_path:string;reason:string;expires_at:string;requested_by:string;requested_login:string;effective_status:string;independent_approval:boolean;requires_independent_approval?:boolean;artifact_sha256:string|null;source_origin_id:number|null;installation_id?:number|null};
type Page={exceptions:Exception[];nextCursor:string|null;canDecide:boolean;currentUserId:string};
export function WorkspaceExceptions({workspaceId}:{workspaceId:string}){
 const selected=new URLSearchParams(window.location.search).get('exception');
 return <ExceptionScope key={JSON.stringify([workspaceId,selected])} workspaceId={workspaceId}/>;
}
function ExceptionScope({workspaceId}:{workspaceId:string}){
 const params=new URLSearchParams(window.location.search),before=params.get('exceptionBefore'),selected=params.get('exception');
 const [page,setPage]=useState<Page|null>(null),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[notice,setNotice]=useState('');
 const [events,setEvents]=useState<{id:number;action:string;actor_user_id:string;note:string;created_at:string}[]>([]);
 const [listError,setListError]=useState('');
 const [detail,setDetail]=useState<{exception:Exception;canDecide:boolean;currentUserId:string;independentApproverAvailable?:boolean}|null>(null);
 const mutation=useRef<AbortController|null>(null);
 const detailGeneration=useRef(0);
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/exceptions`;
 useEffect(()=>()=>mutation.current?.abort(),[]);
 useEffect(()=>{const request=new AbortController();setPage(null);setListError('');void fetch(base+(before?`?before=${encodeURIComponent(before)}`:''),{signal:request.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??'Exceptions unavailable.');if(!request.signal.aborted)setPage(data);}).catch(e=>{if(!request.signal.aborted)setListError(e.message);});return()=>request.abort();},[base,before,revision]);
 useEffect(()=>{
  const request=new AbortController();let timer:ReturnType<typeof setTimeout>;
  setDetail(null);setEvents([]);setNote('');
  async function refresh(){
   const generation=detailGeneration.current;
   try{
    if(!selected||mutation.current)return;
    const r=await fetch(`${base}/${encodeURIComponent(selected)}`,{signal:request.signal});const data=await r.json();
    if(!r.ok)throw new Error(data.error??'Exception unavailable.');
    if(!request.signal.aborted&&generation===detailGeneration.current){setEvents(data.events);setDetail(data);setError('');}
   }catch(e){if(!request.signal.aborted&&generation===detailGeneration.current){setDetail(null);setError(e instanceof Error?e.message:'Exception unavailable.');}}
   finally{if(selected&&!request.signal.aborted)timer=setTimeout(()=>void refresh(),30000);}
  }
  if(selected)void refresh();
  return()=>{request.abort();clearTimeout(timer);};
 },[base,selected,revision]);
 const entry=detail?.exception.id===selected?detail.exception:null;
 const canDecide=!!entry&&detail?.canDecide===true;
 const independent=entry?.requires_independent_approval??entry?.independent_approval??false;
 const selfApproval=independent&&entry?.requested_by===detail?.currentUserId;
 function choose(key:string,value:string|null){const next=new URLSearchParams(window.location.search);next.set('workspace',workspaceId);if(value)next.set(key,value);else next.delete(key);navigate(`/watch/policy?${next}`);}
 async function decide(action:string){
  if(!entry||!canDecide||mutation.current)return;
  const request=new AbortController();mutation.current=request;detailGeneration.current++;
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch(`${base}/${entry.id}/decision`,{method:'POST',signal:request.signal,headers:{'content-type':'application/json'},body:JSON.stringify({action,note})});
   const data=await response.json();if(!response.ok)throw new Error(data.error??'Decision not confirmed.');
   if(!request.signal.aborted){setNotice('Decision recorded. Saved scans and alert resolution are unchanged.');setRevision(v=>v+1);}
  }catch(e){
   if(!request.signal.aborted){setDetail(null);setEvents([]);setError(e instanceof Error?e.message:'Decision failed.');}
  }finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 }
 return <section className="policy-exceptions" aria-label="Policy exceptions"><header className="policy-section-heading"><h2>Policy exceptions</h2><p>Review requests from saved release findings.</p></header><p className="policy-scope-caveat">Approval accepts bounded risk for future checks; it does not fix exposure or change old results.</p>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {listError?<p role="alert">{listError}</p>:null}
  <Button variant="outline" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh exceptions</Button>
  {!page&&!listError?<WatchSkeleton variant="list" className="mt-4" />:null}
{page?<><ul className="policy-exception-list">{page.exceptions.map(e=><li key={e.id}><button className="policy-exception-row" type="button" aria-pressed={selected===e.id} onClick={()=>choose('exception',e.id)}><strong>{e.rule} · {e.exact_path}</strong><p>{e.effective_status} · expires {new Date(e.expires_at).toLocaleString(undefined,{timeZone:'UTC'})} UTC</p></button></li>)}</ul>{!page.exceptions.length?<p className="policy-empty">No exception requests on this page.</p>:null}{before||page.nextCursor?<nav className="flex flex-wrap gap-3" aria-label="Exception history"><Button variant="outline" disabled={!before||busy} onClick={()=>choose('exceptionBefore',null)}>Newest</Button><Button variant="outline" disabled={!page.nextCursor||busy} onClick={()=>choose('exceptionBefore',page.nextCursor)}>Older</Button></nav>:null}</>:null}
  {entry?<article className="policy-exception-detail"><h3>{entry.rule} · {entry.exact_path}</h3><p>{entry.reason}</p><p className="break-all">Scope: {entry.source_origin_id?`Website source ${entry.source_origin_id}`:`Artifact SHA-256 ${entry.artifact_sha256}`}</p><p>Requested by {entry.requested_login} · {independent?'Independent approval required':'Administrator approval required'}</p>
   <p>Status: {entry.effective_status} · Expires {new Date(entry.expires_at).toLocaleString(undefined,{timeZone:'UTC'})} UTC</p>
   {entry.installation_id!=null?<p>Limited to GitHub connection {entry.installation_id}. This does not apply to independent scans or another connection.</p>:null}
   {independent&&entry.effective_status==='pending'&&detail?.independentApproverAvailable===false?<p role="status">No other eligible administrator is available to approve this request. Ask a workspace owner to review <a className="underline" href={`/watch/team?workspace=${encodeURIComponent(workspaceId)}`}>team access</a>. The exception remains pending.</p>:null}
   {canDecide&&['pending','approved'].includes(entry.effective_status)?<><label className="block">Decision explanation<textarea className="block w-full rounded border border-white/15 bg-transparent p-2" minLength={8} maxLength={4000} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label><div className="flex flex-wrap gap-3">{entry.effective_status==='pending'?<><Button disabled={busy||note.trim().length<8||selfApproval} onClick={()=>void decide('approved')}>Approve exception</Button><Button variant="outline" disabled={busy||note.trim().length<8} onClick={()=>void decide('rejected')}>Reject request</Button></>:null}<Button variant="outline" disabled={busy||note.trim().length<8} onClick={()=>void decide('revoked')}>Revoke exception</Button></div>{selfApproval?<p>A different administrator must approve your request.</p>:null}</>:<p>No decision is available with your current access or this exception’s status.</p>}
   <h4>Decision history</h4><ul>{events.map(e=><li className="py-2" key={e.id}>{e.action} · {e.actor_user_id} · {new Date(e.created_at).toLocaleString()}<p>{e.note}</p></li>)}</ul>
  </article>:selected&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
 </section>;
}
