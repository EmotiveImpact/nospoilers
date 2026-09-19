import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {websiteHealth,type WebsiteHealthInput} from '@/watch/website-health';
type Origin={id:number;host:string;origin_url:string;verification_token:string|null;verified_at:string|null;disconnected_at:string|null;paused_at?:string|null;latest_attempt_id:string|null;last_scan_status:string|null;last_checked_at?:string|null;schedule_hours?:number;next_check_at?:string|null;schedule_error?:string|null;schedule_actor?:string|null;activity?:{action:string;created_at:string;actor:string|null}[]};
export function WorkspaceWebsites({workspaceId,disabledReason,initialUrl='',healthFilter='all',className=''}:{workspaceId:string;disabledReason?:string|null;initialUrl?:string;healthFilter?:string;className?:string}){
 const [rows,setRows]=useState<(Origin&WebsiteHealthInput)[]|null>(null),[error,setError]=useState(''),[url,setUrl]=useState(initialUrl),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const pending=useRef(false),mounted=useRef(true),attempts=useRef<Record<number,string>>({});
 const loadEpoch=useRef(0);
 const [confirming,setConfirming]=useState<number|null>(null),[confirmation,setConfirmation]=useState('');
 const [loadError,setLoadError]=useState('');
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/origins`;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function load(){
   const epoch=loadEpoch.current;
   try{const response=await fetch(base,{signal:controller.signal});const body=await response.json();if(controller.signal.aborted||epoch!==loadEpoch.current)return;if(!response.ok||!Array.isArray(body.origins)){if([401,403,404].includes(response.status))setRows(null);throw new Error(body.error??'Websites unavailable.');}setRows(body.origins);setLoadError('');}
   catch(reason){if(!controller.signal.aborted&&epoch===loadEpoch.current)setLoadError(reason instanceof Error?reason.message:'Websites unavailable.');}
   finally{if(!controller.signal.aborted)timer=setTimeout(()=>void load(),30000);}
  }
  void load();
  return()=>{controller.abort();clearTimeout(timer);};
 },[base,refresh]);
 async function action(path:string,body:object,sourceId?:number){
  if(pending.current||disabledReason)return;pending.current=true;setBusy(true);setError('');
  try{
   const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();
   if(!response.ok){if(mounted.current&&[401,403,404].includes(response.status)){loadEpoch.current++;setRows(null);setConfirming(null);setConfirmation('');setRefresh(value=>value+1);}throw new Error(result.error??'The action could not be completed.');}
   if(!mounted.current)return;
   if(sourceId&&typeof result.releaseUrl==='string'){
    const destination=new URL(result.releaseUrl,window.location.origin);
    if(destination.origin!==window.location.origin||destination.pathname!=='/watch/releases')throw new Error('Unexpected result destination.');
    delete attempts.current[sourceId];navigate(destination.pathname+destination.search);
   }else {setConfirming(null);setConfirmation('');setRefresh(value=>value+1);}
  }catch(reason){if(mounted.current)setError(reason instanceof Error?reason.message:'The action could not be completed.');}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 const filteredRows=rows?.filter(row=>healthFilter==='attention'?websiteHealth(row,now).attention:healthFilter==='delayed'?websiteHealth(row,now).state==='delayed':true);
 return <section className={`mt-6 rounded-lg border border-white/10 p-5 ${className}`} aria-labelledby="workspace-websites-heading">
  <h2 id="workspace-websites-heading" className="text-lg font-semibold">Production websites</h2>
  <p className="mt-2 text-sm text-mute">Verify a website you control, then scan its public assets. Manual and scheduled checks share this workspace’s scan allowance. Scheduling is off until you enable it.</p>
  <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();void action(base,{url});}}>
   <label className="min-w-0 flex-1 text-sm">HTTPS website<input type="url" required value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://app.example.com" className="mt-2 block w-full rounded-md border border-white/15 bg-transparent p-3"/></label>
   <Button type="submit" disabled={busy||!!disabledReason||!url.trim()}>Connect website</Button>
  </form>
  {disabledReason?<p className="mt-3 text-sm" role="status">{disabledReason}</p>:null}
  {error||loadError?<div className="mt-3"><p role="alert">{error||loadError}{loadError&&rows?' Displayed source details are from the last successful refresh.':''}</p><Button type="button" variant="outline" onClick={()=>{setError('');setLoadError('');setRefresh(value=>value+1);}}>Refresh websites</Button></div>:null}
  {busy?<p className="mt-3 text-sm" role="status">Processing your request…</p>:null}
  {!rows&&!error&&!loadError?<WatchSkeleton variant="list" className="mt-4" />:null}
  {healthFilter==='attention'||healthFilter==='delayed'?<p className="mt-3 text-sm">Showing {healthFilter==='delayed'?'delayed monitoring':'websites needing attention'}. <Button variant="ghost" onClick={()=>{const params=new URLSearchParams(window.location.search);params.delete('websiteHealth');navigate(`/watch/sources?${params}`);}}>Show all websites</Button></p>:null}
  {rows&&filteredRows?.length===0?<p className="mt-4 text-sm">{rows.length?'No websites match this health filter.':'No websites connected yet.'}</p>:null}
  {filteredRows?.map(row=><article key={row.id} className="mt-5 border-t border-white/10 pt-4">
   <h3 className="font-semibold">{row.host}</h3>
   <p className="mt-1 break-all text-sm text-mute">Scan target: <code>{row.origin_url??row.host}</code></p>
   <p className="mt-1 text-sm text-mute">Managed by this workspace. A saved check covers its recorded assets, not every page or service on this domain.</p>
   <p className="mt-1 text-sm text-mute">{websiteHealth(row,now).label}</p>
   <p className="mt-2 text-sm text-mute">Last completed check: {row.last_checked_at?new Date(row.last_checked_at).toLocaleString():'Not checked yet'}. {row.schedule_hours?`Scheduled every ${row.schedule_hours} hours${row.schedule_actor?` by ${row.schedule_actor}`:''}.`:'Manual checks only.'}</p>
   {row.schedule_hours&&!row.paused_at&&!row.disconnected_at&&row.next_check_at?<p className="mt-1 text-sm">{new Date(row.next_check_at).getTime()<now?'Check due — awaiting scheduler':'Next check due'}: {new Date(row.next_check_at).toLocaleString()}. Checks run on the next scheduler cycle, subject to allowance.</p>:null}
   {row.schedule_error?<p className="mt-2 text-sm" role="status">{row.schedule_error}</p>:null}
   {row.verified_at&&!row.disconnected_at?<WebsiteSchedule key={`${row.id}:${row.schedule_hours??0}:${refresh}`} origin={row} disabled={busy||!!disabledReason} onSave={hours=>void action(`${base}/${row.id}/schedule`,{hours})}/>:null}
   {!row.verified_at&&!row.disconnected_at&&row.verification_token?<div className="mt-3 space-y-3 text-sm">
    <p>Add a DNS TXT record named <code className="break-all">_nospoilers.{row.host}</code> with value:</p><code className="block break-all rounded bg-white/5 p-3">nospoilers-verification={row.verification_token}</code>
    <p>Alternatively, serve that value at <code className="break-all">https://{row.host}/.well-known/nospoilers-verification.txt</code>.</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy||!!disabledReason} onClick={()=>void action(`${base}/${row.id}/verify`,{method:'dns'})}>Verify DNS</Button><Button variant="outline" disabled={busy||!!disabledReason} onClick={()=>void action(`${base}/${row.id}/verify`,{method:'http'})}>Verify HTTP file</Button></div>
   </div>:null}
   <div className="mt-3 flex flex-wrap gap-3">
    {row.verified_at&&!row.disconnected_at&&!row.paused_at?<Button disabled={busy||!!disabledReason} onClick={()=>{const attemptId=attempts.current[row.id]??=crypto.randomUUID();void action(`${base}/${row.id}/check`,{attemptId},row.id);}}>Scan website</Button>:null}
    {row.disconnected_at?<Button variant="outline" disabled={busy||!!disabledReason} onClick={()=>void action(`${base}/${row.id}/lifecycle`,{action:'reconnect'})}>Reconnect website</Button>:<>
     <Button variant="outline" disabled={busy||!!disabledReason} onClick={()=>void action(`${base}/${row.id}/lifecycle`,{action:row.paused_at?'resume':'pause'})}>{row.paused_at?'Resume website':'Pause website'}</Button>
     <Button variant="ghost" disabled={busy||!!disabledReason} onClick={()=>{setConfirming(row.id);setConfirmation('');}}>Disconnect website</Button>
    </>}
    {row.latest_attempt_id?<a className="text-sm underline underline-offset-4" href={`/watch/releases?workspace=${encodeURIComponent(workspaceId)}&upload=${encodeURIComponent(row.latest_attempt_id)}&uploadView=detail`}>View latest attempt</a>:null}
   </div>
   {confirming===row.id?<form className="mt-4 rounded-md border border-white/15 p-4" onSubmit={event=>{event.preventDefault();if(confirmation===row.origin_url)void action(`${base}/${row.id}/lifecycle`,{action:'disconnect',confirmation});}}>
    <p className="text-sm">This stops new checks and revokes deployment triggers. Saved releases and findings remain available.</p>
    <label className="mt-3 block text-sm">Type {row.origin_url} to disconnect<input className="mt-2 block w-full rounded border border-white/15 bg-transparent p-2" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label>
    <div className="mt-3 flex gap-2"><Button type="submit" disabled={busy||!!disabledReason||confirmation!==row.origin_url}>Confirm disconnect</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setConfirming(null)}>Cancel</Button></div>
   </form>:null}
   {row.activity?.length?<details className="mt-4 text-sm"><summary className="cursor-pointer text-mute">Recent source activity</summary><ol className="mt-2 space-y-2">{row.activity.map((event,index)=><li key={`${event.created_at}:${index}`}><span className="capitalize">{event.action}</span> · {event.actor??'Former member'} · {new Date(event.created_at).toLocaleString()}</li>)}</ol></details>:null}
  </article>)}
 </section>;
}

function WebsiteSchedule({origin,disabled,onSave}:{origin:Origin;disabled:boolean;onSave:(hours:number)=>void}){
 const [hours,setHours]=useState(origin.schedule_hours??0);
 return <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();onSave(hours);}}>
  <label className="text-sm">Check schedule for {origin.host}<select className="mt-2 block rounded border border-white/15 bg-surface p-2" value={hours} disabled={disabled} onChange={event=>setHours(Number(event.target.value))}><option value={0}>Manual only</option><option value={6}>Every 6 hours</option><option value={24}>Daily</option></select></label>
  <Button type="submit" variant="outline" disabled={disabled}>Save schedule</Button>
 </form>;
}
