import {useCallback,useEffect,useState} from 'react';
import type {ReleaseTrailModel} from '@/watch/release-trail';

type TrailLoad={status:'loading'}|{status:'error';message:string}|{status:'ready';model:ReleaseTrailModel};

/** Loads the recorded trail for one release. A failed load never shows an older trail as current. */
export function useReleaseTrail(releaseId:number|null,active:boolean){
  const [state,setState]=useState<{releaseId:number;load:TrailLoad}|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!active||releaseId==null)return;
    const controller=new AbortController();
    void fetch(`/api/releases/${releaseId}/trail`,{credentials:'include',signal:controller.signal})
      .then(async response=>{
        const body=await response.json().catch(()=>null) as {trail?:ReleaseTrailModel;error?:string}|null;
        if(!response.ok||!body?.trail)throw new Error(body?.error??'Where this release went could not be loaded.');
        if(!controller.signal.aborted)setState({releaseId,load:{status:'ready',model:body.trail}});
      })
      .catch(error=>{if(!controller.signal.aborted)setState({releaseId,load:{status:'error',message:error instanceof Error?error.message:'Where this release went could not be loaded.'}});});
    return ()=>controller.abort();
  },[releaseId,active,attempt]);
  const reload=useCallback(()=>{setState(null);setAttempt(value=>value+1);},[]);
  const load:TrailLoad=state&&state.releaseId===releaseId?state.load:{status:'loading'};
  return {load,reload};
}
