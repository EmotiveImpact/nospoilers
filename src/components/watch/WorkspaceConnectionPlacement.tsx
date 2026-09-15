import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/motion/select';
import {workspaceInstallationIds,type ProductWorkspace} from '@/watch/workspace-types';

export function WorkspaceConnectionPlacement({workspaces,organizationIds,onChanged}:{workspaces:ProductWorkspace[];organizationIds:string[];onChanged:()=>void}){
  const [selection,setSelection]=useState(''),[destination,setDestination]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const sources=workspaces.filter(w=>!w.archived_at&&['owner','admin'].includes(w.role)&&organizationIds.includes(w.organization_id))
    .flatMap(w=>workspaceInstallationIds(w).map(installationId=>({workspace:w,installationId,key:`${w.id}:${installationId}`})));
  const selected=sources.find(s=>s.key===selection);
  const destinations=workspaces.filter(w=>selected&&w.id!==selected.workspace.id&&w.organization_id===selected.workspace.organization_id&&!w.archived_at&&['owner','admin'].includes(w.role));
  if(!sources.length)return null;
  async function submit(){
    if(busy||!selected||!destinations.some(w=>w.id===destination))return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/workspaces/${selected.workspace.id}/connections/${selected.installationId}/move`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destinationWorkspaceId:destination})});
      const body=await response.json() as {error?:string};
      if(!response.ok)throw new Error(body.error??'Could not place this connection.');
      setNotice('Connection placed. Access now follows the destination workspace.');setSelection('');setDestination('');onChanged();
      window.dispatchEvent(new Event('nospoilers:workspaces-changed'));
    }catch(err){setError(err instanceof Error?err.message:'Could not place this connection.');}finally{setBusy(false);}
  }
  return <form className="workspace-create" onSubmit={event=>{event.preventDefault();void submit();}}>
    <h2>Place an unused GitHub connection</h2>
    <p>Only connections with no repositories, scans, credentials or history can move. Existing evidence stays in its original workspace. Both workspaces must belong to this organisation.</p>
    <label>Connection<Select disabled={busy} value={selection} onValueChange={value=>{setSelection(value==='__clear_connection__'?'':value);setDestination('');setError('');setNotice('');}}><SelectTrigger aria-label="Connection"><SelectValue placeholder="Choose a connection"/></SelectTrigger><SelectContent><SelectItem value="__clear_connection__">Choose a connection</SelectItem>{sources.map(s=><SelectItem key={s.key} value={s.key}>{s.workspace.name} · GitHub #{s.installationId}</SelectItem>)}</SelectContent></Select></label>
    <label>Destination workspace<Select disabled={busy||!selected} value={destination} onValueChange={value=>setDestination(value==='__clear_workspace__'?'':value)}><SelectTrigger aria-label="Destination workspace"><SelectValue placeholder="Choose a workspace"/></SelectTrigger><SelectContent><SelectItem value="__clear_workspace__">Choose a workspace</SelectItem>{destinations.map(w=><SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select></label>
    {selected&&!destinations.length?<p>Create another active workspace in this organisation first.</p>:null}
    <p>Moving replaces connection access with the destination workspace’s membership. The server checks your organisation, workspace and GitHub administrator permissions before changing anything.</p>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    <Button type="submit" disabled={busy||!selected||!destination}>{busy?'Checking connection…':'Check and move unused connection'}</Button>
  </form>;
}
