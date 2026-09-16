import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';

type RelatedRelease={id:number;coordinate:string};
export function AlertRelatedReleases(props:{alertId:number;installationId:number;workspaceId:string|null;hideEmpty?:boolean}) {
  return <RelatedReleaseList key={`${props.workspaceId}:${props.installationId}:${props.alertId}`} {...props}/>;
}
function RelatedReleaseList({alertId,installationId,workspaceId,hideEmpty}:{alertId:number;installationId:number;workspaceId:string|null;hideEmpty?:boolean}) {
  const [state,setState]=useState<{releases:RelatedRelease[];error:string|null;loading:boolean}>({releases:[],error:null,loading:true});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const params=new URLSearchParams({installationId:String(installationId)});
    if(workspaceId)params.set('workspaceId',workspaceId);
    void fetch(`/api/alerts/${alertId}/releases?${params}`,{credentials:'include',signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error('Related releases are unavailable.');
        const body=await response.json() as {releases:RelatedRelease[]};
        if(!Array.isArray(body.releases))throw new Error('Related releases are unavailable.');
        if(!controller.signal.aborted)setState({releases:body.releases,error:null,loading:false});
      }).catch(()=>{if(!controller.signal.aborted)setState({releases:[],error:'Related releases could not be loaded.',loading:false});});
    return ()=>controller.abort();
  },[alertId,installationId,workspaceId,retry]);
  if(hideEmpty&&!state.loading&&!state.error&&!state.releases.length)return null;
  return <section className="mt-7" aria-label="Related releases">
    <p className="watch-kicker">Related releases</p>
    <div className="mt-2 rounded-lg border border-white/8 bg-panel p-4 text-sm text-mute">
      {state.loading?<WatchSkeleton variant="list" className="mt-4" />:state.error?<><p role="alert">{state.error}</p><Button variant="outline" size="sm" className="mt-3" onClick={()=>{setState({releases:[],error:null,loading:true});setRetry(value=>value+1);}}>Retry related releases</Button></>:state.releases.length===0?<p>No linked release was recorded for this alert. Its findings remain available above.</p>:<ul className="space-y-3">{state.releases.map(release=>{
        const params=new URLSearchParams({install:String(installationId),release:String(release.id)});
        if(workspaceId)params.set('workspace',workspaceId);
        return <li key={release.id}><a className="underline underline-offset-4 hover:text-snow" href={`/watch/releases?${params}`}>{release.coordinate}</a></li>;
      })}</ul>}
      <p className="mt-3 text-xs text-dim">Resolving an alert records your response; it does not change the original scan result.</p>
    </div>
  </section>;
}
