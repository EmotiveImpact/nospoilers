import {useEffect,useId,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type RequestProps={workspaceId:string;findingIndex:number;website:boolean}&({attemptId:string;receiptId?:never}|{attemptId?:never;receiptId:number});
export function WorkspaceExceptionRequest(props:RequestProps){
 return <RequestScope key={`${props.workspaceId}:${props.attemptId??`receipt-${props.receiptId}`}:${props.findingIndex}`} {...props}/>;
}
function RequestScope({workspaceId,attemptId,receiptId,findingIndex,website}:RequestProps){
 const expiryHelpId=useId();
 const [open,setOpen]=useState(false),[canRequest,setCanRequest]=useState(false),[loaded,setLoaded]=useState(false),[reason,setReason]=useState(''),[expiresAt,setExpiry]=useState(''),[error,setError]=useState(''),[id,setId]=useState(''),[busy,setBusy]=useState(false);
 const requestKey=useRef(crypto.randomUUID()),mutation=useRef<AbortController|null>(null);
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/exceptions`;
 useEffect(()=>{const request=new AbortController();void fetch(base,{signal:request.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??'Could not check exception permissions.');if(!request.signal.aborted){setCanRequest(data.canRequest===true);setLoaded(true);}}).catch(e=>{if(!request.signal.aborted)setError(e.message);});return()=>{request.abort();mutation.current?.abort();};},[base]);
 async function submit(){
  if(mutation.current||!canRequest)return;const request=new AbortController();mutation.current=request;setBusy(true);setError('');
  try{const r=await fetch(base,{method:'POST',signal:request.signal,headers:{'content-type':'application/json'},body:JSON.stringify({requestKey:requestKey.current,attemptId,receiptId,findingIndex,reason,expiresAt})});const data=await r.json();if(!r.ok)throw new Error(data.error??'Request not confirmed. Retry safely using the same request.');if(!request.signal.aborted)setId(data.id);}
  catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Request not confirmed.');}
  finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 }
 return <div className="mt-4 space-y-3">
  {error?<p role="alert">{error}</p>:null}
  {id?<p role="status">Exception requested, not approved. <a className="underline" href={`/watch/policy?workspace=${encodeURIComponent(workspaceId)}&exception=${encodeURIComponent(id)}`}>Review exception</a></p>:<>
   <Button variant="outline" disabled={!loaded||!canRequest} onClick={()=>setOpen(v=>!v)}>Request a policy exception</Button>
   {loaded&&!canRequest?<p className="text-sm text-mute">An active workspace responder can request an exception; an administrator must decide.</p>:null}
   {open?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit();}}>
    <p className="text-sm">This accepts risk, not remediation. Scope is this exact rule and file path {website?'on this website source':'in this exact artifact digest and its source connection, if connected'}. Existing scan evidence is unchanged.</p>
    <label className="block">Exception justification<textarea className="block w-full rounded border border-white/15 bg-transparent p-2" required minLength={8} maxLength={4000} value={reason} disabled={busy} onChange={e=>{setReason(e.target.value);requestKey.current=crypto.randomUUID();}}/></label>
    <label className="block">Exception expiry<input aria-describedby={expiryHelpId} className="block rounded border border-white/15 bg-transparent p-2" type="date" required value={expiresAt} disabled={busy} onChange={e=>{setExpiry(e.target.value);requestKey.current=crypto.randomUUID();}}/></label>
    <p id={expiryHelpId} className="text-sm text-mute">Expires at 23:59:59 UTC on the selected date. Your local calendar date may differ.</p>
    <Button type="submit" disabled={busy||reason.trim().length<8||!expiresAt}>{busy?'Requesting…':'Submit exception request'}</Button>
   </form>:null}
  </>}
 </div>;
}
