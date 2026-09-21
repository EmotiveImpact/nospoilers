import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {OrganizationBilling} from './OrganizationBilling';
import {WorkspaceDeletionRequest} from './WorkspaceDeletionRequest';
import {Dialog,DialogBackdrop,DialogPanel,DialogTitle} from '@headlessui/react';
import {Activity,ArrowRight,Building2,CreditCard,ShieldCheck,Users,X} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/motion/select';
import './workspace-settings.css';
import './organization-access.css';
export type ManagedOrganization={id:string;name:string;role:string;workspace_limit:number;billing_available?:boolean};
type Access={organization:ManagedOrganization;members:{user_id:string;login:string;role:string|null}[];events:{id:string;action:string;actor:string|null;subject:string|null;created_at:string}[]};
type OrganizationAccessProps={organization:ManagedOrganization;onChanged:()=>void;onOpenBilling?:()=>void};
export function OrganizationAccess({organization,onChanged,onOpenBilling}:OrganizationAccessProps){
  return <AccessEditor key={`${organization.id}:${organization.role}`} organization={organization} onChanged={onChanged} onOpenBilling={onOpenBilling}/>;
}
function AccessEditor({organization,onChanged,onOpenBilling}:OrganizationAccessProps){
  const id=organization.id;
  const [panel,setPanel]=useState<'activity'|'billing'|'deletion'|null>(null);
  const [snapshot,setSnapshot]=useState<{revision:number;data:Access}|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
  const data=snapshot?.revision===revision?snapshot.data:null;
  const owner=organization.role==='owner'&&data?.organization.role==='owner';
  const actionController=useRef<AbortController|null>(null);
  useEffect(()=>()=>actionController.current?.abort(),[]);
  useEffect(()=>{const controller=new AbortController();void fetch(`/api/organizations/${id}/access`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not load organisation access.');if(body.organization?.id!==id||!Array.isArray(body.members)||!Array.isArray(body.events))throw new Error('Could not load organisation access.');if(!controller.signal.aborted){setSnapshot({revision,data:body});setError('');}}).catch(err=>{if(!controller.signal.aborted){setSnapshot(null);setError(err instanceof Error?err.message:'Could not load organisation access.');}});return()=>controller.abort();},[id,revision]);
  async function save(userId:string,role:string|null){
    if(busy||!owner)return;const controller=new AbortController();actionController.current=controller;setBusy(true);setError('');try{const response=await fetch(`/api/organizations/${id}/access/${encodeURIComponent(userId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({role}),signal:controller.signal});const body=await response.json();if(controller.signal.aborted)return;if(!response.ok){if(response.status===401||response.status===403)setSnapshot(null);throw new Error(body.error??'Could not save organisation access.');}setRevision(v=>v+1);onChanged();window.dispatchEvent(new Event('nospoilers:workspaces-changed'));}catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not save organisation access.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const activity=<section className="organisation-activity" aria-label="Administration activity"><p className="workspace-form-note">Recorded changes to organisation access.</p>{!data&&!error?<WatchSkeleton variant="list" className="mt-4" />:data?.events.length?<ol className="workspace-administration-events">{data.events.map(event=><li key={event.id}><span className="organisation-event-icon"><ShieldCheck size={16} aria-hidden="true"/></span><div><strong>{event.action.replaceAll('_',' ')}</strong><p>{event.actor??'Former user'} → {event.subject??'Former user'}</p></div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></li>)}</ol>:data?<div className="organisation-empty"><Activity size={22} aria-hidden="true"/><h3>No administration changes yet</h3><p>Changes to organisation roles will appear here.</p></div>:null}{error?<p role="alert">{error}</p>:null}</section>;
  const dialogOpen=panel!==null&&(panel!=='deletion'||owner);
  return <section className="organisation-access" aria-label={`${organization.name} organisation administration`}>
    <header className="organisation-access-heading"><span className="organisation-access-icon"><Building2 size={20} aria-hidden="true"/></span><div className="organisation-access-identity"><h3>{organization.name}</h3><p><span>{data?.organization.role??organization.role}</span><span aria-hidden="true">·</span>{data?.organization.workspace_limit??organization.workspace_limit} workspace allowance</p></div><div className="organisation-access-actions"><Button type="button" variant="outline" onClick={()=>setPanel('activity')}><Activity size={15} aria-hidden="true"/>Activity</Button>{organization.billing_available?<Button type="button" variant="outline" onClick={()=>onOpenBilling?onOpenBilling():setPanel('billing')}><CreditCard size={15} aria-hidden="true"/>Billing</Button>:null}</div></header>
    <div className="organisation-access-members-heading"><div><h4><Users size={16} aria-hidden="true"/>Organisation roles{data?<span>{data.members.length}</span>:null}</h4><p>Owners manage administrators. Invite people to individual workspaces separately.</p></div></div>
    {error?<div className="organisation-access-error" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRevision(v=>v+1);}}>Retry organisation access</Button></div>:null}
    {!data&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    {data?<><div className="organisation-member-list">{data.members.map(member=><OrganizationMember key={`${member.user_id}:${member.role}`} member={member} editable={owner} busy={busy} save={role=>save(member.user_id,role)}/>)}</div><p className="organisation-access-scope">Organisation administrators can create workspaces within the shared allowance. This does not grant access to every workspace or connect a GitHub account.</p></>:null}
    {owner?<div className="organisation-access-closure"><div><h4>History &amp; account closure</h4><p>Review affected records and request deletion. Nothing is deleted immediately.</p></div><Button type="button" variant="outline" onClick={()=>setPanel('deletion')}>Deletion review<ArrowRight size={15} aria-hidden="true"/></Button></div>:null}
    <Dialog open={dialogOpen} onClose={()=>setPanel(null)} className="organisation-dialog"><DialogBackdrop className="organisation-dialog-backdrop"/><div className="organisation-dialog-position"><DialogPanel className="organisation-dialog-panel"><header><div><p>{organization.name}</p><DialogTitle>{panel==='activity'?'Administration activity':panel==='billing'?'Organisation billing':'Deletion review'}</DialogTitle></div><Button type="button" variant="ghost" aria-label="Close organisation panel" onClick={()=>setPanel(null)}><X size={18} aria-hidden="true"/></Button></header><div className="organisation-dialog-content">{panel==='activity'?activity:panel==='billing'?<OrganizationBilling key={organization.id} id={organization.id}/>:owner?<WorkspaceDeletionRequest organizationId={organization.id}/>:null}</div></DialogPanel></div></Dialog>
  </section>;
}

function OrganizationMember({member,editable,busy,save}:{member:Access['members'][number];editable:boolean;busy:boolean;save:(role:string|null)=>Promise<void>}){
  const [role,setRole]=useState(member.role??'');
  const roleLabel=member.role==='owner'?'Owner':member.role==='admin'?'Administrator':'Workspace access only';
  return <div className="organisation-member-row"><span className="organisation-member-avatar" aria-hidden="true">{member.login.slice(0,2).toUpperCase()}</span><div className="organisation-member-identity"><strong>{member.login}</strong></div>{editable?<form onSubmit={event=>{event.preventDefault();void save(role||null);}}><label><span className="sr-only">Organisation role for {member.login}</span><Select value={role||'__no_admin__'} onValueChange={value=>setRole(value==='__no_admin__'?'':value)} disabled={busy}><SelectTrigger aria-label={`Organisation role for ${member.login}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="__no_admin__">No organisation role</SelectItem><SelectItem value="admin">Administrator</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent></Select></label><Button type="submit" aria-label={`Save organisation role for ${member.login}`} disabled={busy||role===(member.role??'')}>Save</Button></form>:<span className="organisation-member-role">{roleLabel}</span>}</div>;
}
