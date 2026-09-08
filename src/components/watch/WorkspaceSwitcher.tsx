import {useEffect,useState} from 'react';
import {navigate} from '@/nav';
import type {ProductWorkspace} from '@/watch/workspace-types';

export function WorkspaceSwitcher({search,installationId}:{search:string;installationId:number|null}){
  const [workspaces,setWorkspaces]=useState<ProductWorkspace[]>([]);
  const [error,setError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(value=>value+1);window.addEventListener('nospoilers:workspaces-changed',refresh);return()=>window.removeEventListener('nospoilers:workspaces-changed',refresh);},[]);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/workspaces',{signal:controller.signal})
    .then(async response=>{if(!response.ok)throw new Error('Unavailable');const body=await response.json() as {workspaces:ProductWorkspace[]};if(!Array.isArray(body.workspaces))throw new Error('Unavailable');if(!controller.signal.aborted){setWorkspaces(body.workspaces);setError(false);setLoaded(true);}})
    .catch(()=>{if(!controller.signal.aborted){setWorkspaces([]);setError(true);}});return()=>controller.abort();},[revision]);
  const selected=new URLSearchParams(search).get('workspace')??workspaces.find(w=>installationId?Number(w.installation_id)===installationId:w.installation_id===null)?.id??'';
  return <div className="workspace-switcher"><label><span className="watch-kicker">Workspace</span><select aria-label="Workspace" value={workspaces.some(workspace=>workspace.id===selected)?selected:''} disabled={error||!workspaces.length} onChange={event=>{
    const workspace=workspaces.find(w=>w.id===event.target.value);if(!workspace)return;
    const query=new URLSearchParams({workspace:workspace.id});if(workspace.installation_id)query.set('install',String(workspace.installation_id));navigate(`/watch?${query}`);
  }}><option value="" disabled>{error?'Workspaces unavailable':!loaded?'Loading workspaces…':workspaces.length?'Choose a workspace':'No workspaces available'}</option>{workspaces.map(workspace=><option key={workspace.id} value={workspace.id}>{workspace.name}{workspace.archived_at?' · archived':''}</option>)}</select></label>
    {error&&<div role="alert">Workspace choices could not be refreshed. <button type="button" onClick={()=>setRevision(value=>value+1)}>Retry workspaces</button></div>}
    <button type="button" onClick={()=>navigate('/watch/workspaces')}>Manage workspaces</button></div>;
}
