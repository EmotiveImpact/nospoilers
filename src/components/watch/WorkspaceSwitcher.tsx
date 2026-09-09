import {useEffect,useState} from 'react';
import {Menu,MenuButton,MenuItem,MenuItems} from '@headlessui/react';
import {ChevronDown,Plus} from 'lucide-react';
import {navigate} from '@/nav';
import type {ProductWorkspace} from '@/watch/workspace-types';

type WorkspaceChoice = ProductWorkspace & {avatar_url?:string|null};
function ChoiceAvatar({workspace}:{workspace:WorkspaceChoice}){
 const [failed,setFailed]=useState(false);
 const initials=workspace.name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase()||'W';
 return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5 text-xs font-medium">{workspace.avatar_url&&!failed?<img src={workspace.avatar_url} alt="" className="size-full object-cover" onError={()=>setFailed(true)}/>:initials}</span>;
}
export function WorkspaceSwitcher({search,installationId}:{search:string;installationId:number|null}){
  const [workspaces,setWorkspaces]=useState<WorkspaceChoice[]>([]);
  const [error,setError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(value=>value+1);window.addEventListener('nospoilers:workspaces-changed',refresh);return()=>window.removeEventListener('nospoilers:workspaces-changed',refresh);},[]);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/workspaces',{signal:controller.signal})
    .then(async response=>{if(!response.ok)throw new Error('Unavailable');const body=await response.json() as {workspaces:WorkspaceChoice[]};if(!Array.isArray(body.workspaces))throw new Error('Unavailable');if(!controller.signal.aborted){setWorkspaces(body.workspaces);setError(false);setLoaded(true);}})
    .catch(()=>{if(!controller.signal.aborted){setWorkspaces([]);setError(true);}});return()=>controller.abort();},[revision]);
  const selected=new URLSearchParams(search).get('workspace')??workspaces.find(w=>installationId?Number(w.installation_id)===installationId:w.installation_id===null)?.id??'';
  const current=workspaces.find(workspace=>workspace.id===selected);
  return <div className="workspace-switcher"><span className="watch-kicker">Workspace</span>
    <Menu as="div"><MenuButton aria-label="Workspace" disabled={error||!loaded} className="mt-2 flex w-full items-center gap-2 rounded-md border border-line bg-inset p-2 text-left text-[13px] text-snow disabled:opacity-50">
      {current?<ChoiceAvatar key={`${current.id}:${current.avatar_url??''}`} workspace={current}/>:null}<span className="min-w-0 flex-1 truncate">{error?'Workspaces unavailable':!loaded?'Loading workspaces…':current?.name??'Choose a workspace'}</span><ChevronDown className="size-4" aria-hidden="true"/>
    </MenuButton><MenuItems anchor="bottom start" className="z-50 mt-2 w-64 rounded-lg border border-white/10 bg-ink p-1 shadow-xl outline-none">
      {workspaces.map(workspace=><MenuItem key={workspace.id}><button type="button" className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm text-snow data-focus:bg-white/5" onClick={()=>{const query=new URLSearchParams({workspace:workspace.id});if(workspace.installation_id)query.set('install',String(workspace.installation_id));navigate(`/watch?${query}`);}}>
        <ChoiceAvatar key={`${workspace.id}:${workspace.avatar_url??''}`} workspace={workspace}/><span className="min-w-0 flex-1 truncate">{workspace.name}{workspace.archived_at?' · archived':''}</span>{workspace.id===selected?<span className="text-xs text-mute">Current</span>:null}
      </button></MenuItem>)}
      <MenuItem><button type="button" className="flex w-full items-center gap-3 rounded-md border-t border-white/10 p-2 text-left text-sm text-snow data-focus:bg-white/5" onClick={()=>navigate('/watch/workspaces')}><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5"><Plus className="size-4"/></span>Create new workspace</button></MenuItem>
    </MenuItems></Menu>
    {error&&<div role="alert">Workspace choices could not be refreshed. <button type="button" onClick={()=>setRevision(value=>value+1)}>Retry workspaces</button></div>}
    <button type="button" onClick={()=>navigate('/watch/workspaces')}>Manage workspaces</button></div>;
}
