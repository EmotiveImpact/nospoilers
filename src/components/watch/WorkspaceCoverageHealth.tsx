import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
const states=['all','delayed','unknown','paused','recent','unavailable'];
export function hasWorkspaceCoverageHealthFilter(search:string){return states.includes(new URLSearchParams(search).get('coverageHealth')??'');}
type Source={key:string;name:string;installationId:number;connectionName:string;health:string};
export function WorkspaceCoverageHealth({workspaceId,search}:{workspaceId:string;search:string}){
 const selected=new URLSearchParams(search).get('coverageHealth');
 if(!selected||!states.includes(selected))return null;
 return <HealthRows key={workspaceId} workspaceId={workspaceId} selected={selected}/>;
}
function HealthRows({workspaceId,selected}:{workspaceId:string;selected:string}){
 const [sources,setSources]=useState<Source[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();void(async()=>{try{
  const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/overview`,{signal:controller.signal});
  const body=await response.json();if(!response.ok||!Array.isArray(body.connectedCoverage?.sources))throw new Error('Coverage could not be loaded.');
  if(!controller.signal.aborted){setSources(body.connectedCoverage.sources);setError('');}
 }catch{if(!controller.signal.aborted){setSources(null);setError('Coverage could not be loaded.');}}})();return()=>controller.abort();},[workspaceId,retry]);
 const filtered=sources?.filter(source=>selected==='all'||source.health===selected);
 return <section className="watch-empty mb-6" aria-label="Workspace monitoring results"><h1 className="watch-page-title">Coverage</h1><h2 className="text-lg font-semibold">Connected monitoring · {selected}</h2><p>Across all connections in this workspace. Monitoring health is separate from release risk.</p><div className="flex flex-wrap gap-2 my-3"><Button variant="outline" onClick={()=>navigate(`/watch/sources?${new URLSearchParams({workspace:workspaceId})}`)}>Manage all coverage</Button><Button onClick={()=>navigate(`/watch/scan?${new URLSearchParams({workspace:workspaceId})}`)}>Add coverage</Button></div>
 <div className="flex flex-wrap gap-2 my-3">{states.map(state=><Button key={state} variant="outline" aria-pressed={state===selected} onClick={()=>navigate(`/watch/sources?${new URLSearchParams({workspace:workspaceId,coverageHealth:state})}`)}>{state}</Button>)}</div>
 {error?<p role="alert">{error} <Button onClick={()=>setRetry(value=>value+1)}>Retry</Button></p>:!sources?<p role="status">Loading connected monitoring…</p>:filtered?.length?filtered.map(source=><Button className="m-1" variant="outline" key={`${source.installationId}:${source.key}`} onClick={()=>navigate(`/watch/sources?${new URLSearchParams({workspace:workspaceId,install:String(source.installationId),source:source.key})}`)}>{source.name} · {source.connectionName} · {source.health}</Button>):<p role="status">No connected sources match this monitoring state.</p>}
 </section>;
}
