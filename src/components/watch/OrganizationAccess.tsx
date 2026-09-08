import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {OrganizationBilling} from './OrganizationBilling';
import {WorkspaceDeletionRequest} from './WorkspaceDeletionRequest';
export type ManagedOrganization={id:string;name:string;role:string;workspace_limit:number;billing_available?:boolean};
type Access={organization:ManagedOrganization;members:{user_id:string;login:string;role:string|null}[];events:{id:string;action:string;actor:string|null;subject:string|null;created_at:string}[]};
export function OrganizationAccess({organization,onChanged}:{organization:ManagedOrganization;onChanged:()=>void}){
  const [open,setOpen]=useState(false);
  return <details className="workspace-create" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{organization.name} · organisation administration</summary>{open?<><AccessEditor id={organization.id} onChanged={onChanged}/>{organization.billing_available?<OrganizationBilling key={organization.id} id={organization.id}/>:null}{organization.role==='owner'?<WorkspaceDeletionRequest organizationId={organization.id}/>:null}</>:null}</details>;
}
function AccessEditor({id,onChanged}:{id:string;onChanged:()=>void}){
  const [data,setData]=useState<Access|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
  useEffect(()=>{const controller=new AbortController();void fetch(`/api/organizations/${id}/access`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not load organisation access.');if(!controller.signal.aborted)setData(body);}).catch(err=>{if(!controller.signal.aborted){setData(null);setError(err.message);}});return()=>controller.abort();},[id,revision]);
  async function save(userId:string,role:string|null){
    if(busy)return;setBusy(true);setError('');try{const response=await fetch(`/api/organizations/${id}/access/${encodeURIComponent(userId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({role})});const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not save organisation access.');setRevision(v=>v+1);onChanged();window.dispatchEvent(new Event('nospoilers:workspaces-changed'));}catch(err){setError(err instanceof Error?err.message:'Could not save organisation access.');}finally{setBusy(false);}
  }
  return <div className="mt-4"><p>Owners manage organisation administrators. Administrators can create workspaces within the shared allowance. These permissions do not grant access to every workspace or connect anyone’s GitHub account.</p>{error?<div role="alert">{error}<Button variant="outline" onClick={()=>{setError('');setRevision(v=>v+1);}}>Retry organisation access</Button></div>:null}{!data&&!error?<p role="status">Loading organisation access…</p>:null}{data?<><p>Active workspace allowance: {data.organization.workspace_limit}. This is not a per-workspace scan allowance.</p>{data.members.map(member=><OrganizationMember key={`${member.user_id}:${member.role}`} member={member} editable={data.organization.role==='owner'} busy={busy} save={role=>save(member.user_id,role)}/>)}<h3 className="mt-6">Administration activity</h3>{data.events.length?data.events.map(event=><p key={event.id}>{event.action.replaceAll('_',' ')} · {event.actor??'Former user'} → {event.subject??'Former user'} · {new Date(event.created_at).toLocaleString()}</p>):<p>No administration changes recorded.</p>}</>:null}</div>;
}
function OrganizationMember({member,editable,busy,save}:{member:Access['members'][number];editable:boolean;busy:boolean;save:(role:string|null)=>Promise<void>}){
  const [role,setRole]=useState(member.role??'');
  return <div className="watch-empty"><strong>{member.login}</strong><p>{member.role??'Workspace access only'}</p>{editable?<form onSubmit={event=>{event.preventDefault();void save(role||null);}}><label>Organisation role for {member.login}<select value={role} onChange={event=>setRole(event.target.value)}><option value="">No organisation administration</option><option value="admin">Administrator</option><option value="owner">Owner</option></select></label><Button type="submit" disabled={busy||role===(member.role??'')}>Save organisation role for {member.login}</Button></form>:null}</div>;
}
