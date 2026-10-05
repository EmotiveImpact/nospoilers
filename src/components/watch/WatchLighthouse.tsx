import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useState,type ReactNode} from 'react';
import './watch-lighthouse.css';
import {MarkParticles} from '../motion/MarkParticles';
const LoadingContext=createContext<null|(()=>()=>void)>(null);
export function WatchLoadingSignal(){
 const register=useContext(LoadingContext);
 useLayoutEffect(()=>register?.(),[register]);
 return <p className="sr-only" role="status">Loading Watch…</p>;
}
export function WatchLoadingBoundary({children}:{children:ReactNode}){
 const [pending,setPending]=useState(0),[phase,setPhase]=useState<'loading'|'ready'|'hidden'>('loading');
 const register=useCallback(()=>{setPending(n=>n+1);return()=>setPending(n=>Math.max(0,n-1));},[]);
 useEffect(()=>{
  if(pending>0){setPhase('loading');return;}
  const ready=setTimeout(()=>setPhase('ready'),0),hide=setTimeout(()=>setPhase('hidden'),1250);
  return()=>{clearTimeout(ready);clearTimeout(hide);};
 },[pending]);
 return <LoadingContext.Provider value={register}>{children}{phase!=='hidden'?<div className={`watch-lighthouse is-${phase}`} aria-hidden="true"><MarkParticles className="watch-lighthouse-field" gathered={phase!=='loading'} duration={700}/><span>Opening Watch</span></div>:null}</LoadingContext.Provider>;
}
