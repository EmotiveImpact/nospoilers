import {QuietSettingRow} from './design/QuietComponents';
import { WatchPageHeader } from "./WatchPageHeader.tsx";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {SettingsTabs} from './design/SettingsTabs';
import './design/policy-page.css';
import {Button} from '@/components/ui/button';
import {WorkspaceExceptions} from './WorkspaceExceptions';
type Policy={strict:boolean;require_exception_approval?:boolean;revision:number;canEdit:boolean;supported:boolean;events:{revision:number;strict:boolean;actor_user_id:string;created_at:string}[]};
function validPolicy(value:unknown):value is Policy{
 if(!value||typeof value!=='object')return false;const p=value as Partial<Policy>;
 return typeof p.strict==='boolean'&&Number.isSafeInteger(p.revision)&&typeof p.canEdit==='boolean'&&typeof p.supported==='boolean'&&Array.isArray(p.events);
}
type ConnectionPanels={signing:ReactNode;allowlist:ReactNode};
function subscribeLocation(listener:()=>void){window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener);}
function locationSearch(){return window.location.search;}
export function WorkspaceScanPolicy({workspaceId,connectionPanels}:{workspaceId:string;connectionPanels?:ConnectionPanels}){
 return <ScopedPolicy key={workspaceId} workspaceId={workspaceId} connectionPanels={connectionPanels}/>;
}
function ScopedPolicy({workspaceId,connectionPanels}:{workspaceId:string;connectionPanels?:ConnectionPanels}){
 const search=useSyncExternalStore(subscribeLocation,locationSearch,()=>''),params=new URLSearchParams(search);
 const [tab,setTab]=useState({search,value:params.has('exception')||params.has('exceptionBefore')?'exceptions':'rules'});
 const activeTab=tab.search!==search&&(params.has('exception')||params.has('exceptionBefore'))?'exceptions':!connectionPanels&&['signing','allowlist'].includes(tab.value)?'rules':tab.value;
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
 const rules=<section className="policy-rules" aria-label="Scan rules">
  <div className="policy-section-heading"><h2>Scan rules</h2><p>Choose when independent artifact and website scans can pass.</p></div>
  {!policy&&!error&&<WatchSkeleton variant="list" className="mt-4" />}
  {error&&<div role="alert" className="policy-notice"><p>{error}</p><Button variant="outline" disabled={busy} onClick={()=>{setPolicy(null);setError('');setSaved(false);setConflict(true);setRetry(value=>value+1);}}>Reload policy</Button></div>}
  {policy&&<>{!policy.supported?<p className="policy-notice">Independent scan policy is unavailable for this workspace.</p>:<form className="policy-rules-form" onSubmit={event=>{event.preventDefault();void save();}}>
   <QuietSettingRow label="Strict policy: any finding blocks a pass" description="When off, critical findings block a pass. Inconclusive scans are not proof of a clean release." checked={strict} disabled={!policy.canEdit||busy||conflict} onChange={next=>{setStrict(next);setSaved(false);}}/>
   <QuietSettingRow label="Require a different administrator to approve exceptions" description="When enabled, request authors cannot approve their own exceptions and new direct GitHub allowlist entries are blocked. Another administrator must be available." checked={requireApproval} disabled={!policy.canEdit||busy||conflict} onChange={next=>{setRequireApproval(next);setSaved(false);}}/>
   <aside className="policy-scope-note" aria-label="How these rules apply"><h3>How these rules apply</h3><p>Scan rules apply to independent artifact and website scans in this workspace. GitHub-connected scans keep their connection policy. Each scan keeps the policy captured when it starts; saved evidence is never rewritten.</p><p>Exception approval applies to requests from saved independent and connected release findings. Request an exception from a saved release finding so another administrator can review its scope and expiry. Existing requests retain any stricter approval requirement. Historical GitHub allowlist entries remain recorded and can be revoked; enabling approval does not rewrite earlier evidence.</p></aside>
   {!policy.canEdit&&<p className="policy-notice">Read-only. An administrator in an active workspace can change this policy.</p>}
   <div className="policy-form-footer"><Button disabled={!policy.canEdit||busy||conflict||(strict===policy.strict&&requireApproval===(policy.require_exception_approval??false))} type="submit">{busy?'Saving…':'Save policy'}</Button><span>Policy revision {policy.revision}</span></div>
  </form>}
  {saved&&<p className="policy-notice" role="status">Policy saved for subsequent scan starts.</p>}
  {policy.events.length>0&&<section className="policy-scope-note policy-history" aria-label="Policy history"><h3>Policy history</h3><ul>{policy.events.map(event=><li key={event.revision}>Revision {event.revision} · {event.strict?'Strict':'Critical findings'} · {new Date(event.created_at).toLocaleString()} · User {event.actor_user_id}</li>)}</ul></section>}
  </>}
 </section>;
 const tabs=[{id:'rules',label:'Scan rules',content:rules},{id:'exceptions',label:'Exceptions',content:<WorkspaceExceptions workspaceId={workspaceId}/>}];
 if(connectionPanels)tabs.push({id:'signing',label:'Signing',content:<>{connectionPanels.signing}</>},{id:'allowlist',label:'GitHub allowlist',content:<>{connectionPanels.allowlist}</>});
 return <section className="scan-policy-page" aria-label="Workspace scan policy"><WatchPageHeader kicker="Workspace settings" title="Policy & exceptions" lede={connectionPanels?'Scan rules for this workspace, with signing and allowlist settings for the selected GitHub connection.':'Scan rules and reviewed exceptions for this workspace.'}/><SettingsTabs label="Policy settings" tabs={tabs} value={activeTab} onValueChange={value=>setTab({search,value})}/></section>;
}
