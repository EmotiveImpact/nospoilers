import { EvidenceTable } from './design/EvidenceTable';
import './design/settings-pages.css';
import './design/workspace-evidence.css';
import {WatchPageHeader} from "./WatchPageHeader";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {WorkspaceDeletionRequest} from './WorkspaceDeletionRequest';

type Settings={workspace:{name:string;organization_id:string;archived_at:string|null;role:string;organization_owner:boolean};retention:{savedScans:number;activeScans:number};events:Array<{id:string;action:string;actor:string|null;created_at:string}>;nextCursor:string|null};
export function WorkspaceEvidenceSettings({workspaceId,view}:{workspaceId:string;view:'retention'|'audit'}){
 return <EvidenceSettings key={`${workspaceId}:${view}`} workspaceId={workspaceId} view={view}/>;
}
function EvidenceSettings({workspaceId,view}:{workspaceId:string;view:'retention'|'audit'}){
 const [data,setData]=useState<Settings|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[before,setBefore]=useState('');
 useEffect(()=>{const controller=new AbortController();void fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/evidence-settings${before?`?before=${encodeURIComponent(before)}`:''}`,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Workspace settings could not be loaded.');if(!body.workspace||!body.retention||!Array.isArray(body.events))throw new Error('Workspace settings could not be confirmed.');if(!controller.signal.aborted)setData(body);}).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Workspace settings could not be loaded.');});return()=>controller.abort();},[workspaceId,before,retry]);
 function page(cursor:string){setData(null);setError('');setBefore(cursor);}
 return <section className="evidence-settings-page workspace-evidence-journey min-w-0 [overflow-wrap:anywhere]" aria-label={view==='audit'?'Workspace audit log':'Workspace retention'}>
  <WatchPageHeader title={view==='audit'?'Who changed what.':'Keep evidence deliberately.'} lede={view==='audit'?'Administrative changes, separate from scan activity.':'Understand what stays available and what expires.'}/>
  {error?<div className="workspace-evidence-error" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setData(null);setRetry(value=>value+1);}}>Retry</Button>{before?<Button variant="outline" onClick={()=>page('')}>Newest activity</Button>:null}</div>:!data?<span className="sr-only" role="status">Loading workspace settings…</span>:view==='retention'?<>
   <div className="workspace-retention-split"><div>
    <div className="workspace-retention-row"><div><h2>Evidence retention</h2><p>There is no automatic history-expiry setting for this workspace. Saved evidence remains available to authorised members.</p></div><span className="workspace-retention-value">Current workspace policy</span></div>
    <div className="workspace-retention-row"><div><h2>Saved upload records</h2><p>Recorded scans in {data.workspace.name}.</p></div><strong>{data.retention.savedScans}</strong></div>
    <div className="workspace-retention-row"><div><h2>Uploads queued or running</h2><p>Processing status is separate from saved evidence.</p></div><strong>{data.retention.activeScans}</strong></div>
    <div className="workspace-retention-row"><div><h2>Temporary upload files</h2><p>Staged upload files are removed after processing or expiry. Saved findings and receipts are separate from those temporary files.</p></div></div>
   </div><aside className="workspace-retention-note"><h2>Keep history deliberately</h2><p>Disconnecting a source stops monitoring but keeps history available to authorised members. Cancelling a subscription does not authorise deletion.</p><h2>Deletion is a separate decision</h2><p>Permanent deletion requires owner authorisation, retention checks and an explicit scope. A deletion request is not confirmation that records have been erased.</p></aside></div>
   {data.workspace.organization_owner?<WorkspaceDeletionRequest organizationId={data.workspace.organization_id} workspaceId={workspaceId} workspaceName={data.workspace.name}/>:<p className="workspace-evidence-note">Ask an organisation owner to authorise history deletion. Workspace administrator permissions alone do not grant this right.</p>}
  </>:<>
   {data.events.length?<div className="workspace-audit-wrap"><EvidenceTable caption="Recorded workspace activity" className="workspace-audit-table"><thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Scope</th></tr></thead><tbody>{data.events.map(event=><tr key={event.id}><td><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></td><td className="[overflow-wrap:anywhere]">{event.actor??'Former account'}</td><td>{event.action.replaceAll('_',' ')}</td><td>{data.workspace.name}</td></tr>)}</tbody></EvidenceTable></div>:<p className="workspace-audit-empty">No recorded workspace activity on this page.</p>}
   {before||data.nextCursor?<nav className="workspace-audit-pagination" aria-label="Audit history pages"><Button variant="outline" disabled={!before} onClick={()=>page('')}>Newest activity</Button><Button variant="outline" disabled={!data.nextCursor} onClick={()=>page(data.nextCursor!)}>Older activity</Button></nav>:null}
   <p className="workspace-evidence-note">Recorded workspace-management activity. Scan findings are available in Releases; this log does not claim to include every source or billing event.</p>
  </>}
 </section>;
}
