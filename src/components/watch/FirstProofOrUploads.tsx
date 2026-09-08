import {useEffect,useState} from 'react';
import {WatchFirstProofOverview} from './WatchFirstProofOverview';
import {UploadedReleases} from './UploadedReleases';

export function FirstProofOrUploads({search,nowLabel}:{search:string;nowLabel:string}){
  const install=new URLSearchParams(search).get('install');
  return <FirstProofScope key={new URLSearchParams(search).get('workspace')??install??'all'} search={search} nowLabel={nowLabel} install={install}/>;
}
function FirstProofScope({search,nowLabel,install}:{search:string;nowLabel:string;install:string|null}){
  const [state,setState]=useState<'loading'|'empty'|'ready'|'error'>('loading');
  const [retry,setRetry]=useState(0);
  const workspaceId=new URLSearchParams(search).get('workspace');
  useEffect(()=>{
    const controller=new AbortController();
    const query=new URLSearchParams();if(workspaceId)query.set('workspaceId',workspaceId);else if(install)query.set('installationId',install);
    void fetch(`/api/uploads${query.size?`?${query}`:''}`,{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error('Uploads unavailable');
        const body=await response.json() as {uploads:unknown[]};
        if(!controller.signal.aborted)setState(body.uploads.length?'ready':'empty');
      }).catch(()=>{if(!controller.signal.aborted)setState('error');});
    return()=>controller.abort();
  },[install,retry,workspaceId]);
  if(state==='loading')return <p role="status">Checking your release history…</p>;
  if(state==='error')return <section role="alert"><h1 className="watch-page-title">Release history unavailable</h1><p>We cannot determine your first-release progress until saved scans load.</p><button className="scan-primary-action" onClick={()=>{setState('loading');setRetry(value=>value+1);}}>Try again</button></section>;
  if(state==='empty')return <WatchFirstProofOverview search={search} nowLabel={nowLabel}/>;
  return <section><h1 className="watch-page-title">Your release evidence</h1><p className="watch-page-lede">Your saved checks are here. Manage source connections and monitoring schedules in Coverage.</p><UploadedReleases search={search} installationId={!workspaceId&&install?Number(install):undefined}/></section>;
}
