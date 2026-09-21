import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Row={id:number;kind:'npm'|'map';name:string;paused:boolean;canManage:boolean};
export function SourceMonitoringControls({installationId,refreshKey}:{installationId:number;refreshKey?:string}) {
  const [rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0),[busy,setBusy]=useState<string|null>(null);
  const mutation=useRef<AbortController|null>(null);
  const inventoryRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{mutation.current?.abort();mutation.current=null;},[installationId]);
  useEffect(()=>{
    const controller=new AbortController();
    inventoryRequest.current=controller;
    setRows(null);setError(null);
    if(!mutation.current)setBusy(null);
    void fetch(`/api/sources/monitoring?installationId=${installationId}`,{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw new Error('Could not load monitoring controls.');
      const body=await r.json();if(!Array.isArray(body.sources))throw new Error('Could not load monitoring controls.');
      if(!controller.signal.aborted){setRows(body.sources);setError(null);}
    }).catch(e=>{if(!controller.signal.aborted){setRows(null);setError(e.message);}});
    return()=>{controller.abort();if(inventoryRequest.current===controller)inventoryRequest.current=null;};
  },[installationId,retry,refreshKey]);
  async function toggle(row:Row){
    if(mutation.current)return;
    const controller=new AbortController();mutation.current=controller;
    setBusy(`${row.kind}-${row.id}`);setError(null);
    try {
      const response=await fetch(`/api/sources/${row.kind}/${row.id}/monitoring`,{signal:controller.signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paused:!row.paused})});
      if(controller.signal.aborted)return;
      inventoryRequest.current?.abort();
      if(!response.ok)throw new Error('Monitoring could not be changed. Refresh and check your access.');
      setRows(null);setRetry(n=>n+1);
    }catch(e){if(!controller.signal.aborted){inventoryRequest.current?.abort();setRows(null);setError(e instanceof Error?e.message:'Monitoring could not be changed.');}}
    finally{if(mutation.current===controller){mutation.current=null;setBusy(null);}}
  }
  if(!rows&&!error)return <WatchSkeleton />;
  if(rows?.length===0)return null;
  return <section className="mb-6 rounded-lg border border-white/10 p-5" aria-label="Source monitoring controls">
    <h2 className="text-lg font-semibold">Monitoring controls</h2>
    <p className="mt-2 text-sm text-mute">Pause checks without disconnecting or removing evidence. Resuming allows future checks; it does not mark saved results current.</p>
    {error?<div role="alert"><p className="mt-3 text-sm">{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Refresh controls</Button></div>:null}
    {!rows&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    <ul className="mt-3 divide-y divide-white/10">{rows?.map(row=><li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div><p>{row.name}</p><p className="text-xs text-mute">{row.paused?'Paused':'Enabled'}{!row.canManage?' · Requires source management permission':''}</p></div>
      <Button variant="outline" disabled={!row.canManage||busy!==null} onClick={()=>void toggle(row)}>{busy===`${row.kind}-${row.id}`?'Saving…':row.paused?'Resume monitoring':'Pause monitoring'}</Button>
    </li>)}</ul>
  </section>;
}
