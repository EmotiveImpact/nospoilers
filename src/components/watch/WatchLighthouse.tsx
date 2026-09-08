import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useState,type ReactNode} from 'react';
import './watch-lighthouse.css';
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
  const ready=setTimeout(()=>setPhase('ready'),0),hide=setTimeout(()=>setPhase('hidden'),650);
  return()=>{clearTimeout(ready);clearTimeout(hide);};
 },[pending]);
 return <LoadingContext.Provider value={register}>{children}{phase!=='hidden'?<div className={`watch-lighthouse is-${phase}`} aria-hidden="true"><div className="watch-lighthouse-scene">
  <div className="watch-lighthouse-beam"/><div className="watch-lighthouse-glow"/>
  <svg viewBox="0 0 24 24" className="watch-lighthouse-tower" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
   <path d="m8 6 4-3 4 3M8 11h8M9 6h6v5H9zM9.5 11 8 21m6.5-10L16 21M6 21h12"/>
   <path d="M10 16h4" strokeOpacity=".5"/>
   <path d="M12 7.7v1.6" stroke="#ff3158"/>
  </svg></div><span>Opening Watch</span></div>:null}</LoadingContext.Provider>;
}
