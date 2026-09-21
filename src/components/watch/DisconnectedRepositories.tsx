import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

type Row={id:number;fullName:string;disconnectedAt:string|null};
export function DisconnectedRepositories({installationId,refreshKey}:{installationId:number;refreshKey?:string}){
 const [state,setState]=useState<{scope:number;rows:Row[]}|null>(null),[failed,setFailed]=useState<number|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch(`/api/repos/disconnected?installationId=${installationId}`,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');
   const body=await response.json() as {repos:Row[]};
   if(!controller.signal.aborted){setState({scope:installationId,rows:body.repos});setFailed(null);}
  }).catch(()=>{if(!controller.signal.aborted)setFailed(installationId);});
  return()=>controller.abort();
 },[installationId,retry,refreshKey]);
 if(failed===installationId)return <section className="mb-6 rounded-lg border border-white/10 p-5"><p role="alert">Retained connections could not be loaded.</p><Button variant="outline" onClick={()=>{setFailed(null);setRetry(value=>value+1);}}>Retry</Button></section>;
 if(state?.scope!==installationId)return <p className="sr-only" role="status">Checking retained connections…</p>;
 if(!state.rows.length)return null;
 return <section className="mb-6 rounded-lg border border-white/10 p-5" aria-labelledby="disconnected-heading">
  <h2 id="disconnected-heading" className="text-lg font-semibold">Disconnected repositories</h2>
  <p className="mt-2 text-sm text-mute">Monitoring has stopped. Previous findings and release evidence remain saved; disconnection does not mean the repository is clean.</p>
  <ul className="mt-4 divide-y divide-white/10">{state.rows.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{row.fullName}</span><span className="text-sm text-mute">Disconnected{row.disconnectedAt?` · ${new Date(row.disconnectedAt).toLocaleDateString()}`:''}</span></li>)}</ul>
  <p className="mt-3 text-sm text-mute">To reconnect an existing repository, a GitHub installation administrator must restore its access in the same GitHub App installation. Deleted repositories cannot be reconnected.</p>
  <a className="mt-3 inline-block text-sm underline underline-offset-4" href="https://github.com/settings/installations" target="_blank" rel="noreferrer">Manage GitHub App access</a>
 </section>;
}
