import {useEffect,useRef,useState} from 'react';
import type {ReceiptCheckState} from './ReceiptCheck';

/**
 * Asks the server to verify a saved receipt (signature, and that it names these exact bytes) the first
 * time `active` is true. `load` returns the receipt to check, or null when there is none.
 * The outcome is only ever what the server answered; a failed request reads as "could not run".
 */
export function useReceiptCheck(active:boolean,key:string,load:(signal:AbortSignal)=>Promise<{receipt:unknown;sha256?:string|null}|null>):ReceiptCheckState|null{
  const [state,setState]=useState<{key:string;value:ReceiptCheckState}|null>(null);
  const started=useRef<string|null>(null);
  const loader=useRef(load);
  useEffect(()=>{loader.current=load;});
  useEffect(()=>{
    if(!active||started.current===key)return;
    const request=new AbortController();let settled=false;
    started.current=key;
    const finish=(value:ReceiptCheckState)=>{if(request.signal.aborted)return;settled=true;setState({key,value});};
    setState({key,value:{status:'checking'}});
    void (async()=>{
      try{
        const input=await loader.current(request.signal);
        if(!input){finish({status:'unavailable',reason:'No signed record is saved for this check.'});return;}
        const response=await fetch('/api/receipts/verify',{method:'POST',signal:request.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:input.receipt,...(input.sha256?{sha256:input.sha256}:{})})});
        const body=await response.json().catch(()=>null) as {ok?:boolean;reason?:string;error?:string}|null;
        if(response.ok&&body?.ok===true)finish({status:'passed'});
        else if(response.status===400&&body?.ok===false)finish({status:'failed',reason:body.reason??'The signed record did not verify.'});
        else finish({status:'unavailable',reason:body?.error??'The check could not run just now.'});
      }catch{finish({status:'unavailable',reason:'The check could not run just now.'});}
    })();
    return()=>{if(!settled){request.abort();started.current=null;}};
  },[active,key]);
  return state?.key===key?state.value:null;
}
