import {useEffect,useState,type ReactNode} from 'react';
import {workspaceInstallationIds,type ProductWorkspace} from '@/watch/workspace-types';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {WatchLoadingSignal} from './WatchLighthouse';

/** Resolve legacy links before rendering any tenant-owned data. */
export function WorkspaceEntry({path,search,login}:{path:string;search:string;login:()=>ReactNode}){
  const [state,setState]=useState<'loading'|'login'|'unavailable'>('loading'),[retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();void (async()=>{
    const me=await fetch('/api/me',{signal:controller.signal});if(!me.ok)throw new Error('Unavailable');
    const session=await me.json();if(!session.user){if(!controller.signal.aborted)setState('login');return;}
    const response=await fetch('/api/workspaces',{signal:controller.signal});if(!response.ok)throw new Error('Unavailable');
    const body=await response.json() as {workspaces:ProductWorkspace[]};
    const params=new URLSearchParams(search),installationId=params.get('install');
    let selected:ProductWorkspace|undefined;
    // A saved upload link knows its own immutable workspace. Never guess from its list position.
    if(params.has('upload')){
      const detail=await fetch(`/api/uploads/${encodeURIComponent(params.get('upload')!)}`,{signal:controller.signal});
      if(!detail.ok)throw new Error('Unavailable');const record=await detail.json();
      selected=body.workspaces.find(row=>row.id===record.upload?.workspace_id);
      if(installationId&&(!selected||!workspaceInstallationIds(selected).includes(Number(installationId))))throw new Error('Unavailable');
    }else selected=installationId?body.workspaces.find(row=>workspaceInstallationIds(row).includes(Number(installationId))):body.workspaces.find(row=>!row.archived_at);
    if(!selected)throw new Error('Unavailable');params.set('workspace',selected.id);
    if(installationId)params.set('install',installationId);else if(selected.installation_id)params.set('install',String(selected.installation_id));else params.delete('install');
    if(!controller.signal.aborted){window.history.replaceState({},'',`${path}?${params}`);window.dispatchEvent(new PopStateEvent('popstate'));}
  })().catch(()=>{if(!controller.signal.aborted)setState('unavailable');});return()=>controller.abort();},[path,search,retry]);
  if(state==='login')return login();
  if(state==='unavailable')return <main className="workspace-gate"><h1>Workspace unavailable</h1><p>This link could not be matched to an accessible workspace. No other workspace’s evidence is substituted.</p><Button onClick={()=>{setState('loading');setRetry(v=>v+1);}}>Retry</Button><Button variant="outline" onClick={()=>navigate('/watch/workspaces')}>Choose a workspace</Button></main>;
  return <main className="workspace-gate"><WatchLoadingSignal/></main>;
}
