import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Props={workspaceId:string;sourceId:number;canRespond:boolean};
export function WebsiteAlertRecheck(props:Props){return <Recheck key={`${props.workspaceId}:${props.sourceId}`} {...props}/>;}
function Recheck({workspaceId,sourceId,canRespond}:Props){
 const request=useRef<AbortController|null>(null),attempt=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[result,setResult]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function run(){
  if(!canRespond||request.current||result)return;
  const controller=new AbortController();request.current=controller;
  attempt.current??=crypto.randomUUID();setBusy(true);setError(null);
  try{
   const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/origins/${sourceId}/check`,{method:'POST',credentials:'include',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({attemptId:attempt.current})});
   const body=await response.json() as {id?:string;error?:string};
   if(!response.ok||body.id!==attempt.current)throw new Error(body.error??'The website check could not be confirmed. Retry to check this same request.');
   if(!controller.signal.aborted)setResult(body.id);
  }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'The check could not be started.');}
  finally{request.current=null;if(!controller.signal.aborted)setBusy(false);}
 }
 return <section aria-label="Recheck website" className="mt-5 rounded-lg border border-white/8 p-4 text-sm">
  <p className="watch-kicker">Verify your fix</p><p className="mt-2 text-mute">Check the website as it is now. This uses your workspace’s scan allowance and creates new evidence; it does not resolve this alert or replace its original result.</p>
  <Button className="mt-3" size="sm" disabled={!canRespond||busy||!!result} onClick={()=>void run()}>{busy?'Starting check…':'Recheck website'}</Button>
  {!canRespond?<p className="mt-2 text-mute">An active workspace owner, administrator or member can start a check. Read-only or archived workspace access cannot run scans.</p>:null}
  {error?<p role="alert" className="mt-2">{error}</p>:null}
  {result?<p role="status" className="mt-3">Check queued. <a className="underline" href={`/watch/releases?workspace=${encodeURIComponent(workspaceId)}&upload=${encodeURIComponent(result)}&uploadView=detail`}>View the new check</a></p>:null}
 </section>;
}
