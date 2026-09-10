import {WatchPageHeader} from "./WatchPageHeader";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import type {ProductWorkspace} from '@/watch/workspace-types';
import {WorkspaceInvitationInbox} from './WorkspaceTeam';
import {OrganizationAccess,type ManagedOrganization} from './OrganizationAccess';
import {WorkspaceConnectionPlacement} from './WorkspaceConnectionPlacement';
import {WorkspaceDeletionRequest} from './WorkspaceDeletionRequest';

type WorkspaceListRow = ProductWorkspace & {avatar_url?: string | null};
function WorkspaceAvatar({name,url}:{name:string;url?:string|null}){
  const [failed,setFailed]=useState(false);
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase()||'W';
  return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5 text-xs font-medium text-snow">
    {url&&!failed?<img src={url} alt="" className="size-full object-cover" onError={()=>setFailed(true)}/>:initials}
  </span>;
}

export function WorkspaceManagement(){
  const [rows,setRows]=useState<WorkspaceListRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[name,setName]=useState(''),[organization,setOrganization]=useState('');
  const [renameId,setRenameId]=useState<string|null>(null),[rename,setRename]=useState('');
  const [notice,setNotice]=useState('');
  const [organizations,setOrganizations]=useState<ManagedOrganization[]>([]);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/workspaces',{signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error('Could not load workspaces.');const body=await response.json() as {workspaces:WorkspaceListRow[];organizations?:ManagedOrganization[]};if(!controller.signal.aborted){setRows(body.workspaces);setOrganizations(body.organizations??[]);setLoading(false);}
  }).catch(err=>{if(!controller.signal.aborted){setError(err.message);setLoading(false);}});return()=>controller.abort();},[revision]);
  async function mutate(path:string,method:string,body:unknown){
    if(busy)return;setBusy(true);setError(null);setNotice('');
    try{const response=await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??'Could not save workspace.');setNotice('Workspace saved. Existing evidence and subscription allowances are unchanged.');setName('');setRenameId(null);setRevision(value=>value+1);window.dispatchEvent(new Event('nospoilers:workspaces-changed'));}
    catch(err){setError(err instanceof Error?err.message:'Could not save workspace.');}finally{setBusy(false);}
  }
  return <section className="workspace-management"><WatchPageHeader kicker="Organisation settings" title="Workspaces" lede="Separate evidence and access. One shared subscription and scan allowance per organisation."/>
    <WorkspaceInvitationInbox/>
    {error?<div role="alert" className="watch-empty"><p>{error}</p><Button variant="outline" onClick={()=>{setError(null);setLoading(true);setRevision(value=>value+1);}}>Retry</Button></div>:null}
    {notice?<p role="status" className="mt-4 text-sm text-mute">{notice}</p>:null}
    {loading?<WatchSkeleton variant="list" className="mt-4" />:<div className="workspace-cards">{rows.map(workspace=><article key={workspace.id}><div className="flex items-start gap-3"><WorkspaceAvatar key={`${workspace.id}:${workspace.avatar_url??''}`} name={workspace.name} url={workspace.avatar_url}/><div><h2>{workspace.name}</h2><p>{workspace.role} · {workspace.archived_at?'Archived · evidence retained':'Active'} · {workspace.installation_id?'GitHub-connected':'No GitHub connection'}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>{const p=new URLSearchParams({workspace:workspace.id});if(workspace.installation_id)p.set('install',String(workspace.installation_id));navigate(`/watch?${p}`);}}>Open workspace</Button>
      <Button variant="outline" onClick={()=>navigate(`/watch/team?workspace=${workspace.id}`)}>Team & access</Button>
      {['owner','admin'].includes(workspace.role)?<><Button variant="ghost" disabled={busy} onClick={()=>{setRenameId(workspace.id);setRename(workspace.name);}}>Rename</Button><Button variant="ghost" disabled={busy} onClick={()=>void mutate(`/api/workspaces/${workspace.id}`,'PATCH',{archived:!workspace.archived_at})}>{workspace.archived_at?'Restore':'Archive'}</Button></>:null}</div>
      {renameId===workspace.id?<form className="mt-4 flex gap-3" onSubmit={event=>{event.preventDefault();void mutate(`/api/workspaces/${workspace.id}`,'PATCH',{name:rename});}}><input aria-label="Workspace name" maxLength={100} value={rename} onChange={event=>setRename(event.target.value)}/><Button type="submit" disabled={busy||!rename.trim()}>Save name</Button><Button type="button" variant="ghost" onClick={()=>setRenameId(null)}>Cancel</Button></form>:null}
      {organizations.some(o=>o.id===workspace.organization_id&&o.role==='owner')?<details className="mt-4"><summary>History deletion review</summary><WorkspaceDeletionRequest organizationId={workspace.organization_id} workspaceId={workspace.id} workspaceName={workspace.name}/></details>:null}
    </article>)}</div>}
    {organizations.length?<form className="workspace-create" onSubmit={event=>{event.preventDefault();void mutate('/api/workspaces','POST',{organizationId:organization||organizations[0].id,name});}}><h2>Create a workspace</h2><p>Creating another workspace does not restart the trial or add scan allowances. Migrated default and connected workspaces cannot yet be archived.</p><label>Organisation<select value={organization||organizations[0].id} onChange={event=>setOrganization(event.target.value)}>{organizations.map(row=><option key={row.id} value={row.id}>{row.name} · existing subscription</option>)}</select></label><label>Workspace name<input required maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder="For example, Production"/></label><Button type="submit" disabled={busy||!name.trim()}>{busy?'Saving…':'Create workspace'}</Button></form>:null}
    <WorkspaceConnectionPlacement workspaces={rows} organizationIds={organizations.map(o=>o.id)} onChanged={()=>setRevision(v=>v+1)}/>
    {organizations.map(organization=><OrganizationAccess key={organization.id} organization={organization} onChanged={()=>setRevision(v=>v+1)}/>)}
  </section>;
}
