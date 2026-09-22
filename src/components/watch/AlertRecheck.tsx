import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {navigate} from '@/nav';
import {Button} from '@/components/ui/button';

type Props={alertId:number;installationId:number;workspaceId:string|null;canRespond:boolean;ended:boolean};
type Target={repoId?:number|null;installationId:number;endpoint:string|null;label:string|null;detail:string};
export function AlertRecheck(props:Props){return <Recheck key={`${props.workspaceId}:${props.installationId}:${props.alertId}`} {...props}/>;}
function Recheck({alertId,installationId,workspaceId,canRespond,ended}:Props){
  const [target,setTarget]=useState<Target|null>(null),[error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null),[retry,setRetry]=useState(0);
  const params=new URLSearchParams({install:String(installationId)});if(workspaceId)params.set('workspace',workspaceId);
  useEffect(()=>{
    const controller=new AbortController();
    const query=new URLSearchParams({installationId:String(installationId)});if(workspaceId)query.set('workspaceId',workspaceId);
    void fetch(`/api/alerts/${alertId}/recheck?${query}`,{credentials:'include',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error('Recheck options could not be loaded.');
      const body=await response.json() as {target:Target};
      if(body.target?.installationId!==installationId)throw new Error('Recheck options could not be loaded.');
      if(!controller.signal.aborted)setTarget(body.target);
    }).catch(()=>{if(!controller.signal.aborted)setError('Recheck options could not be loaded.');});
    return ()=>controller.abort();
  },[alertId,installationId,workspaceId,retry]);
  const scanParams=new URLSearchParams(params);scanParams.set('mode','package');
  const repoParams=new URLSearchParams(params);
  const hasRepo=Number.isSafeInteger(target?.repoId)&&Number(target?.repoId)>0;
  if(hasRepo){repoParams.set('source',`repo-${target!.repoId}`);repoParams.set('sourceType','github');repoParams.set('configure','github');}
  function openPage(event:React.MouseEvent<HTMLAnchorElement>,href:string){
    if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();navigate(href);
  }
  async function run(){
    if(!target?.endpoint||!/^\/api\/repos\/\d+\/scan-latest-release$/.test(target.endpoint)||!canRespond||ended||busy)return;
    setBusy(true);setError(null);setMessage(null);
    try{
      const response=await fetch(target.endpoint,{method:'POST',credentials:'include'});
      const body=await response.json() as {error?:string;ok?:boolean;queued?:boolean};
      if(!response.ok||!body.ok)throw new Error(body.error??'The check could not be started.');
      setMessage(body.queued?'Scan queued. Follow the new result in Releases. This alert has not been resolved.':'A scan was not queued. Review existing work in Releases before trying again.');
    }catch(reason){setError(reason instanceof Error?reason.message:'The check could not be started.');}finally{setBusy(false);}
  }
  if(!target&&!error)return <WatchSkeleton />;
  return <section aria-label="Recheck source" className="mt-5 rounded-lg border border-white/8 p-4 text-sm">
    <p className="watch-kicker">{target?.endpoint?'Run a new check':'Verify what ships'}</p>
    {target?<><p className="mt-2 text-mute">{target.detail}</p><div className="mt-3 flex flex-wrap gap-3">
      {target.endpoint?<Button size="sm" disabled={!canRespond||ended||busy||!!message} onClick={()=>void run()}>{busy?'Starting scan…':target.label}</Button>:null}
      {!target.endpoint?<a className="inline-flex min-h-9 items-center rounded-md bg-snow px-3 text-xs font-medium text-ink" href={`/watch/scan?${scanParams}`} onClick={event=>openPage(event,`/watch/scan?${scanParams}`)}>Upload a build to scan</a>:null}
      {hasRepo?<a className="inline-flex min-h-9 items-center text-sm underline underline-offset-4" href={`/watch/sources?${repoParams}`} onClick={event=>openPage(event,`/watch/sources?${repoParams}`)}>Repository checks</a>:null}
      {message?<a className="underline underline-offset-4" href={`/watch/releases?${params}`}>View releases</a>:null}
    </div>{!canRespond?<p className="mt-2 text-xs text-dim">Viewer access is read-only.</p>:ended?<p className="mt-2 text-xs text-dim">Active coverage is required to run checks.</p>:null}</>:!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    {error?<><p role="alert" className="mt-2">{error}</p>{!target?<Button size="sm" variant="outline" onClick={()=>{setError(null);setRetry(value=>value+1);}}>Retry recheck options</Button>:null}</>:null}
    {message?<p role="status" className="mt-2 text-mute">{message}</p>:null}
  </section>;
}
