import { WatchPageHeader } from "./WatchPageHeader.tsx";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {WorkspaceExceptions} from './WorkspaceExceptions';
type Policy={strict:boolean;require_exception_approval?:boolean;revision:number;canEdit:boolean;supported:boolean;events:{revision:number;strict:boolean;actor_user_id:string;created_at:string}[]};
function validPolicy(value:unknown):value is Policy{
 if(!value||typeof value!=='object')return false;const p=value as Partial<Policy>;
 return typeof p.strict==='boolean'&&Number.isSafeInteger(p.revision)&&typeof p.canEdit==='boolean'&&typeof p.supported==='boolean'&&Array.isArray(p.events);
}
export function WorkspaceScanPolicy({workspaceId}:{workspaceId:string}){
 return <ScopedPolicy key={workspaceId} workspaceId={workspaceId}/>;
}
function ScopedPolicy({workspaceId}:{workspaceId:string}){
 const [requireApproval,setRequireApproval]=useState(false);
 const [policy,setPolicy]=useState<Policy|null>(null),[strict,setStrict]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[conflict,setConflict]=useState(false);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const endpoint=`/api/workspaces/${encodeURIComponent(workspaceId)}/scan-policy`;
 useEffect(()=>{const controller=new AbortController();void fetch(endpoint,{signal:controller.signal}).then(async response=>{
  const body=await response.json();if(!response.ok)throw new Error(body.error??'Scan policy could not be loaded.');
  if(!validPolicy(body.policy))throw new Error('Scan policy could not be loaded.');
  if(!controller.signal.aborted){setPolicy(body.policy);setStrict(body.policy.strict);setRequireApproval(body.policy.require_exception_approval??false);setError('');setConflict(false);}
 }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Scan policy could not be loaded.');});return()=>controller.abort();},[endpoint,retry]);
 async function save(){
  if(!policy?.canEdit||busy||conflict)return;setBusy(true);setError('');setSaved(false);
  try{const response=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({strict,expectedRevision:policy.revision,requireExceptionApproval:requireApproval})});
   const body=await response.json();if(!alive.current)return;if(response.status===409)setConflict(true);
   if(response.status===401||response.status===403){setPolicy(null);setConflict(true);}
   if(!response.ok)throw new Error(body.error??'Scan policy could not be saved.');
   if(!validPolicy(body.policy)){setConflict(true);throw new Error('Scan policy response was incomplete. Reload to check the saved policy.');}
   setPolicy(body.policy);setStrict(body.policy.strict);setRequireApproval(body.policy.require_exception_approval??false);setSaved(true);
  }catch(error){if(alive.current)setError(error instanceof Error?error.message:'Scan policy could not be saved.');}finally{if(alive.current)setBusy(false);}
 }
 return <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]" aria-label="Workspace scan policy"><header><WatchPageHeader kicker="Workspace settings" title="Independent scan policy" lede="Applies to independent artifact and website scans in this workspace. GitHub-connected scans keep their connection policy. Each scan keeps the policy captured when it starts; saved evidence is never rewritten." /></header>
  {!policy&&!error&&<WatchSkeleton variant="list" className="mt-4" />}
  {error&&<div role="alert" className="space-y-3 text-sm text-mute"><p>{error}</p><Button variant="outline" disabled={busy} onClick={()=>{setSaved(false);setRetry(value=>value+1);}}>Reload policy</Button></div>}
  {policy&&<>{!policy.supported?<p>Independent scan policy is unavailable for this workspace.</p>:<form className="watch-card space-y-4 p-4 text-sm sm:p-5" onSubmit={event=>{event.preventDefault();void save();}}>
   <label className="flex min-h-11 items-start gap-3 py-2 font-medium text-snow"><input className="mt-0.5 size-4 shrink-0" type="checkbox" checked={strict} disabled={!policy.canEdit||busy||conflict} onChange={event=>{setStrict(event.target.checked);setSaved(false);}}/>Strict policy: any finding blocks a pass</label>
   <p className="text-sm leading-relaxed text-mute">When off, critical findings block a pass. Inconclusive scans are not proof of a clean release.</p>
   <label className="flex min-h-11 items-start gap-3 py-2 font-medium text-snow"><input className="mt-0.5 size-4 shrink-0" type="checkbox" checked={requireApproval} disabled={!policy.canEdit||busy||conflict} onChange={e=>{setRequireApproval(e.target.checked);setSaved(false);}}/>Require a different administrator to approve exceptions</label>
   <p className="text-sm leading-relaxed text-mute">Applies to workspace exception requests from saved independent and connected release findings. When enabled, request authors cannot approve their own exceptions, and new direct GitHub allowlist entries are blocked. Request an exception from a saved release finding so another administrator can review its scope and expiry. Make sure another administrator is available. Existing requests retain any stricter approval requirement. Historical GitHub allowlist entries remain recorded and can be revoked; enabling approval does not rewrite earlier evidence.</p>
   {!policy.canEdit&&<p className="text-sm leading-relaxed text-mute">Read-only. An administrator in an active workspace can change this policy.</p>}
   <Button disabled={!policy.canEdit||busy||conflict||(strict===policy.strict&&requireApproval===(policy.require_exception_approval??false))} type="submit">{busy?'Saving…':'Save policy'}</Button>
  </form>}
  <p className="text-sm text-mute">Policy revision {policy.revision}</p>{saved&&<p className="text-sm text-snow" role="status">Policy saved for subsequent scan starts.</p>}
  {policy.events.length>0&&<details className="watch-card p-4 text-sm text-mute sm:p-5"><summary className="cursor-pointer text-snow">Policy history</summary><ul className="mt-3 space-y-3">{policy.events.map(event=><li key={event.revision}>Revision {event.revision} · {event.strict?'Strict':'Critical findings'} · {new Date(event.created_at).toLocaleString()} · User {event.actor_user_id}</li>)}</ul></details>}
  </>}
  <WorkspaceExceptions workspaceId={workspaceId}/>
 </section>;
}
