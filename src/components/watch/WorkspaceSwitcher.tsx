import {useEffect,useRef,useState} from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {ChevronDown,Plus} from 'lucide-react';
import {navigate} from '@/nav';
import {useWorkspaceChoices,type WorkspaceChoice,type WorkspaceChoices} from './useWorkspaceChoices';
import '@/components/motion/dropdown.css';

function ChoiceAvatar({workspace}:{workspace:WorkspaceChoice}){
 const [failed,setFailed]=useState(false);
 const initials=workspace.name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase()||'W';
 return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/5 text-xs font-medium">{workspace.avatar_url&&!failed?<img src={workspace.avatar_url} alt="" className="size-full object-cover" onError={()=>setFailed(true)}/>:initials}</span>;
}
type Props={search:string;installationId:number|null};
export function WorkspaceSwitcher({choices,...props}:Props&{choices?:WorkspaceChoices}){
 return choices?<WorkspaceMenu {...props} choices={choices}/>:<StandaloneSwitcher {...props}/>;
}
function StandaloneSwitcher(props:Props){
 const choices=useWorkspaceChoices();
 return <WorkspaceMenu {...props} choices={choices}/>;
}
function WorkspaceMenu({search,installationId,choices}:Props&{choices:WorkspaceChoices}){
  const {workspaces,error,loaded,refresh}=choices;
  const [open,setOpen]=useState(false);
  const retryButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(error)setOpen(false);},[error]);
  const selected=new URLSearchParams(search).get('workspace')??workspaces.find(w=>installationId?Number(w.installation_id)===installationId:w.installation_id===null)?.id??'';
  const current=workspaces.find(workspace=>workspace.id===selected);
  return <div className="workspace-switcher"><span className="watch-kicker">Workspace</span>
    <div><DropdownMenu.Root open={open} onOpenChange={setOpen}><DropdownMenu.Trigger aria-label="Workspace" disabled={error||!loaded} className="mt-2 flex w-full items-center gap-2 rounded-md border border-line bg-inset p-2 text-left text-[13px] text-snow focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white/40 disabled:opacity-50">
      {current?<ChoiceAvatar key={`${current.id}:${current.avatar_url??''}`} workspace={current}/>:null}<span className="min-w-0 flex-1 truncate">{error?'Workspaces unavailable':!loaded?'Loading workspaces…':current?.name??'Choose a workspace'}</span><ChevronDown className="size-4" aria-hidden="true"/>
    </DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content onCloseAutoFocus={event=>{if(error){event.preventDefault();retryButton.current?.focus();}}} align="start" sideOffset={6} collisionPadding={12} style={{maxWidth:'calc(100vw - 24px)',maxHeight:'var(--radix-dropdown-menu-content-available-height)'}} className="ns-dropdown-surface w-64 overflow-y-auto p-1 outline-none">
      {workspaces.map(workspace=><DropdownMenu.Item key={workspace.id} textValue={workspace.name} className="flex min-h-9 w-full cursor-default select-none items-center gap-3 rounded p-2 text-left text-[13px] text-snow outline-none data-highlighted:bg-white/[0.055]" onSelect={()=>{const query=new URLSearchParams({workspace:workspace.id});if(workspace.installation_id)query.set('install',String(workspace.installation_id));navigate(`/watch?${query}`);}}>
        <ChoiceAvatar key={`${workspace.id}:${workspace.avatar_url??''}`} workspace={workspace}/><span className="min-w-0 flex-1 truncate">{workspace.name}{workspace.archived_at?' · archived':''}</span>{workspace.id===selected?<span className="text-xs text-mute">Current</span>:null}
      </DropdownMenu.Item>)}
      <DropdownMenu.Item textValue="Create new workspace" className="flex min-h-9 w-full cursor-default select-none items-center gap-3 rounded p-2 text-left text-[13px] text-snow outline-none data-highlighted:bg-white/[0.055]" onSelect={()=>{const query=new URLSearchParams({workspaceTab:'create'});if(selected)query.set('workspace',selected);if(installationId)query.set('install',String(installationId));navigate(`/watch/workspaces?${query}`);}}><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center"><Plus className="size-4"/></span>Create new workspace</DropdownMenu.Item>
    </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
    {error&&<div role="alert">Workspace choices could not be refreshed. <button ref={retryButton} type="button" onClick={refresh}>Retry workspaces</button></div>}
    </div>;
}
