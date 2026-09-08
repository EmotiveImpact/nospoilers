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
 return <section className="watch-empty" aria-label={view==='audit'?'Workspace audit log':'Workspace retention'}>
  <h1 className="watch-page-title">{view==='audit'?'Audit log':'Retention & history'}</h1>
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setData(null);setRetry(value=>value+1);}}>Retry</Button>{before?<Button variant="outline" onClick={()=>page('')}>Newest activity</Button>:null}</div>:!data?<p role="status">Loading workspace settings…</p>:view==='retention'?<>
   <p>Evidence belongs to {data.workspace.name}. Disconnecting a source stops monitoring but keeps history available to authorised members. Cancelling a subscription does not authorise deletion.</p>
   <dl className="grid gap-4 sm:grid-cols-2 my-6"><div><dt>Saved upload records</dt><dd>{data.retention.savedScans}</dd></div><div><dt>Uploads queued or running</dt><dd>{data.retention.activeScans}</dd></div></dl>
   <p>Staged upload files are removed after processing or expiry. Saved findings and receipts are separate from those temporary files.</p>
   <p>There is no automatic history-expiry setting for this workspace. Permanent deletion requires separate owner authorisation, retention checks and an explicit scope. A deletion request is not confirmation that records have been erased.</p>
   {data.workspace.organization_owner?<WorkspaceDeletionRequest organizationId={data.workspace.organization_id} workspaceId={workspaceId} workspaceName={data.workspace.name}/>:<p className="mt-6">Ask an organisation owner to authorise history deletion. Workspace administrator permissions alone do not grant this right.</p>}
  </>:<>
   <p>Recorded workspace-management activity. Scan findings are available in Releases; this log does not claim to include every source or billing event.</p>
   {data.events.length?<div className="overflow-x-auto mt-6"><table className="w-full text-left"><thead><tr><th className="p-3">Action</th><th className="p-3">Actor</th><th className="p-3">Recorded</th></tr></thead><tbody>{data.events.map(event=><tr key={event.id}><td className="p-3">{event.action.replaceAll('_',' ')}</td><td className="p-3">{event.actor??'Former account'}</td><td className="p-3"><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></td></tr>)}</tbody></table></div>:<p className="mt-6">No recorded workspace activity on this page.</p>}
   {before||data.nextCursor?<nav className="flex gap-3 mt-6" aria-label="Audit history pages"><Button variant="outline" disabled={!before} onClick={()=>page('')}>Newest activity</Button><Button variant="outline" disabled={!data.nextCursor} onClick={()=>page(data.nextCursor!)}>Older activity</Button></nav>:null}
  </>}
 </section>;
}
