import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {watchHref} from '@/watch/routes';

type Row={id:number;kind:'npm'|'map';name:string;disconnectedAt:string|null};
export function RetainedSources({installationId,search,refreshKey}:{installationId:number;search:string;refreshKey?:string}) {
  const [state,setState]=useState<{scope:number;rows:Row[]}|null>(null);
  const [failed,setFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/sources/disconnected?installationId=${installationId}`,{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Unavailable');
      const body=await response.json();
      if(!Array.isArray(body.sources))throw new Error('Invalid response');
      if(!controller.signal.aborted){setState({scope:installationId,rows:body.sources});setFailed(false);}
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[installationId,retry,refreshKey]);
  if(failed)return <section className="mb-6 rounded-lg border border-white/10 p-5"><p role="alert">Disconnected sources could not be loaded.</p><Button variant="outline" onClick={()=>{setFailed(false);setState(null);setRetry(n=>n+1);}}>Retry</Button></section>;
  if(state?.scope!==installationId)return <p className="text-sm text-mute" role="status">Checking saved connections…</p>;
  if(!state.rows.length)return null;
  return <section className="mb-6 rounded-lg border border-white/10 p-5" aria-label="Disconnected sources">
    <h2 className="text-lg font-semibold">Disconnected sources</h2>
    <p className="mt-2 text-sm text-mute">Monitoring has stopped. Saved findings and release evidence remain available. Reconnecting requires a new check before monitoring is current.</p>
    <p className="mt-2 text-sm text-mute">If you paused monitoring before disconnecting, it stays paused after reconnecting. Use Monitoring controls to resume checks.</p>
    <ul className="mt-4 divide-y divide-white/10">{state.rows.map(row=><li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div><p>{row.name}</p><p className="text-xs text-mute">Disconnected{row.disconnectedAt?` · ${new Date(row.disconnectedAt).toLocaleDateString()}`:''}</p></div>
      <a className="text-sm underline underline-offset-4" href={watchHref('/watch/sources',search,{source:null,configure:row.kind})}>Reconnect {row.kind==='map'?'with credentials':'package'}</a>
    </li>)}</ul>
  </section>;
}
