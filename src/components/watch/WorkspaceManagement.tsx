import {WatchPageHeader} from "./WatchPageHeader";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/motion/select';
import {navigate} from '@/nav';
import {workspaceInstallationIds,type ProductWorkspace} from '@/watch/workspace-types';
import {WorkspaceInvitationInbox} from './WorkspaceTeam';
import {OrganizationAccess,type ManagedOrganization} from './OrganizationAccess';
import {WorkspaceConnectionPlacement} from './WorkspaceConnectionPlacement';
import {WorkspaceDeletionRequest} from './WorkspaceDeletionRequest';
import {SettingsTabs} from './design/SettingsTabs';
import './workspace-settings.css';

type WorkspaceListRow = ProductWorkspace & {avatar_url?: string | null};
function WorkspaceAvatar({name,url}:{name:string;url?:string|null}){
  const [failed,setFailed]=useState(false);
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase()||'W';
  return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5 text-xs font-medium text-snow">
    {url&&!failed?<img src={url} alt="" className="size-full object-cover" onError={()=>setFailed(true)}/>:initials}
  </span>;
}

export function WorkspaceManagement(){
  const readTab=()=>new URLSearchParams(window.location.search).get('workspaceTab')??'workspaces';
  const [tab,setTab]=useState(readTab);
  const [rows,setRows]=useState<WorkspaceListRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[name,setName]=useState(''),[organization,setOrganization]=useState('');
  const [renameId,setRenameId]=useState<string|null>(null),[rename,setRename]=useState('');
  const [notice,setNotice]=useState('');
  const [listFailed,setListFailed]=useState(false);
  const [organizations,setOrganizations]=useState<ManagedOrganization[]>([]);
  const selectedOrganization=organization?organizations.find(row=>row.id===organization):organizations[0];
  useEffect(()=>{const sync=()=>setTab(readTab());window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/workspaces',{signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error('Could not load workspaces.');const body=await response.json() as {workspaces:WorkspaceListRow[];organizations?:ManagedOrganization[]};if(!Array.isArray(body.workspaces)||(body.organizations!==undefined&&!Array.isArray(body.organizations)))throw new Error('Could not load workspaces.');if(!controller.signal.aborted){setRows(body.workspaces);setOrganizations(body.organizations??[]);setListFailed(false);setLoading(false);}
  }).catch(err=>{if(!controller.signal.aborted){setRows([]);setOrganizations([]);setListFailed(true);setError(err instanceof Error?err.message:'Could not load workspaces.');setLoading(false);}});return()=>controller.abort();},[revision]);
  async function mutate(path:string,method:string,body:unknown,reset?:{creation?:boolean;renameId?:string}){
    if(busy||loading)return;setBusy(true);setError(null);setNotice('');
    try{const response=await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??'Could not save workspace.');setNotice('Workspace saved. Existing evidence and subscription allowances are unchanged.');if(reset?.creation)setName('');if(reset?.renameId)setRenameId(current=>current===reset.renameId?null:current);setLoading(true);setRevision(value=>value+1);window.dispatchEvent(new Event('nospoilers:workspaces-changed'));}
    catch(err){setError(err instanceof Error?err.message:'Could not save workspace.');}finally{setBusy(false);}
  }
  const workspaceList=<>
    <div className="workspace-section-heading"><div><h2>Your workspaces</h2><p>Separate evidence, connections and access.</p></div>{!loading&&!listFailed?<span className="workspace-count">{rows.length} {rows.length===1?'workspace':'workspaces'}</span>:null}</div>
    <WorkspaceInvitationInbox/>
    {loading?<WatchSkeleton variant="list" className="mt-4" />:listFailed?null:rows.length?<div className="workspace-settings-list">{rows.map(workspace=><article className="workspace-settings-row" key={workspace.id}>
      <div className="workspace-row-main"><WorkspaceAvatar key={`${workspace.id}:${workspace.avatar_url??''}`} name={workspace.name} url={workspace.avatar_url}/><div className="workspace-row-identity"><h3>{workspace.name}</h3><p><span>{workspace.role}</span><span>{workspace.archived_at?'Archived · evidence retained':'Active'}</span><span>{workspace.installation_id?'GitHub connected':'No GitHub connection'}</span></p></div></div>
      <div className="workspace-row-actions"><Button variant="outline" onClick={()=>{const p=new URLSearchParams({workspace:workspace.id});if(workspace.installation_id)p.set('install',String(workspace.installation_id));navigate(`/watch?${p}`);}}>Open workspace</Button>
      <Button variant="ghost" onClick={()=>navigate(`/watch/team?workspace=${workspace.id}`)}>Team & access</Button>
      {['owner','admin'].includes(workspace.role)?<><Button variant="ghost" disabled={busy} onClick={()=>{setRenameId(workspace.id);setRename(workspace.name);}}>Rename</Button><Button variant="ghost" disabled={busy} onClick={()=>void mutate(`/api/workspaces/${workspace.id}`,'PATCH',{archived:!workspace.archived_at})}>{workspace.archived_at?'Restore':'Archive'}</Button></>:null}</div>
      {renameId===workspace.id?<form className="workspace-rename-form" onSubmit={event=>{event.preventDefault();void mutate(`/api/workspaces/${workspace.id}`,'PATCH',{name:rename},{renameId:workspace.id});}}><input aria-label="Workspace name" maxLength={100} value={rename} disabled={busy} onChange={event=>setRename(event.target.value)}/><Button type="submit" disabled={busy||!rename.trim()}>Save name</Button><Button type="button" variant="ghost" onClick={()=>setRenameId(null)}>Cancel</Button></form>:null}
      {organizations.some(o=>o.id===workspace.organization_id&&o.role==='owner')?<details className="workspace-history-review"><summary>History deletion review</summary><WorkspaceDeletionRequest organizationId={workspace.organization_id} workspaceId={workspace.id} workspaceName={workspace.name}/></details>:null}
    </article>)}</div>:<div className="workspace-settings-empty"><h3>No workspaces yet</h3><p>Accepted invitations and workspaces you create appear here.</p></div>}
  </>;
  const creation=loading?<WatchSkeleton variant="list" className="mt-4"/>:listFailed?null:organizations.length?<form className="workspace-create workspace-settings-form" onSubmit={event=>{event.preventDefault();if(selectedOrganization)void mutate('/api/workspaces','POST',{organizationId:selectedOrganization.id,name},{creation:true});}}><div className="workspace-section-heading"><div><h2>Create a workspace</h2><p>A separate home for a project’s evidence and team.</p></div></div><label>Organisation<Select value={selectedOrganization?.id??''} onValueChange={setOrganization} disabled={busy}><SelectTrigger aria-label="Organisation"><SelectValue placeholder="Choose an organisation"/></SelectTrigger><SelectContent>{organizations.map(row=><SelectItem key={row.id} value={row.id}>{row.name} · existing subscription</SelectItem>)}</SelectContent></Select></label><label>Workspace name<input required maxLength={100} value={name} disabled={busy} onChange={event=>setName(event.target.value)} placeholder="For example, Production"/></label><p className="workspace-form-note">Uses the organisation’s existing subscription and scan allowance. Creating a workspace does not restart the trial. Migrated default and connected workspaces cannot yet be archived.</p><Button type="submit" disabled={busy||!selectedOrganization||!name.trim()}>{busy?'Saving…':'Create workspace'}</Button></form>:<div className="workspace-settings-empty"><h2>Create a workspace</h2><p>An organisation owner or administrator can create workspaces within the shared allowance.</p></div>;
  const connections=listFailed?null:<><div className="workspace-section-heading"><div><h2>Connection placement</h2><p>Move an unused GitHub connection between workspaces in the same organisation.</p></div></div><WorkspaceConnectionPlacement workspaces={rows} organizationIds={organizations.map(o=>o.id)} onChanged={()=>setRevision(v=>v+1)}/>{!loading&&!rows.some(w=>!w.archived_at&&['owner','admin'].includes(w.role)&&organizations.some(o=>o.id===w.organization_id)&&workspaceInstallationIds(w).length)?<div className="workspace-settings-empty"><h3>No connections available to place</h3><p>Connect GitHub in a workspace you administer. Only connections without repositories, scans or history can move.</p></div>:null}</>;
  const administration=listFailed?null:<><div className="workspace-section-heading"><div><h2>Organisation settings</h2><p>Shared administration, subscription and history controls.</p></div></div>{organizations.length?<div className="workspace-organisation-list">{organizations.map(organization=><OrganizationAccess key={organization.id} organization={organization} onChanged={()=>setRevision(v=>v+1)}/>)}</div>:loading?null:<div className="workspace-settings-empty"><h3>No organisation administration access</h3><p>Your workspace role still controls the evidence and tools you can use.</p></div>}</>;
  return <section className="workspace-management workspace-settings"><WatchPageHeader kicker="Settings" title="Workspaces" lede="Your workspaces, connections and shared organisation settings."/>
    {error?<div role="alert" className="watch-empty"><p>{error}</p><Button variant="outline" onClick={()=>{setError(null);setLoading(true);setRevision(value=>value+1);}}>Retry</Button></div>:null}
    {notice?<p role="status" className="mt-4 text-sm text-mute">{notice}</p>:null}
    <SettingsTabs label="Workspace settings" value={['workspaces','create','connections','organisation'].includes(tab)?tab:'workspaces'} onValueChange={value=>{setTab(value);const query=new URLSearchParams(window.location.search);if(value==='workspaces')query.delete('workspaceTab');else query.set('workspaceTab',value);navigate(`/watch/workspaces${query.size?`?${query}`:''}`);}} tabs={[{id:'workspaces',label:'Workspaces',content:workspaceList},{id:'create',label:'Create workspace',content:creation},{id:'connections',label:'Connections',content:connections},{id:'organisation',label:'Organisation',content:administration}]}/>
  </section>;
}
