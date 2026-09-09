import './design/settings-pages.css';
import { WatchPageHeader } from "./WatchPageHeader.tsx";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {notificationFailureMessage,notificationTestLabel} from '@/watch/notification-status';

type Destination={id:number;kind:string;host:string;independent:boolean;last_delivery_status:string|null;test_status:string|null};
type Page={destinations:Destination[];deliveries:{id:number;kind:string;status:string;created_at:string;error_code?:string|null}[];nextCursor:string|null;canManage:boolean;providers:{email:boolean;slack:boolean}};
export function WorkspaceNotifications({workspaceId}:{workspaceId:string}){
 return <NotificationScope key={workspaceId} workspaceId={workspaceId}/>;
}
function NotificationScope({workspaceId}:{workspaceId:string}){
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/notifications`;
 const [page,setPage]=useState<Page|null>(null),[before,setBefore]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const [kind,setKind]=useState<'email'|'slack'>('email'),[value,setValue]=useState(''),[selected,setSelected]=useState<Destination|null>(null),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[notice,setNotice]=useState('');
 const mutation=useRef<AbortController|null>(null),testKeys=useRef(new Map<number,string>());
 useEffect(()=>()=>mutation.current?.abort(),[]);
 useEffect(()=>{
  const request=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function refresh(){
   try{
    const response=await fetch(base+(before?`?before=${encodeURIComponent(before)}`:''),{signal:request.signal});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not load notifications.');
    if(!request.signal.aborted){setPage(data);setLoadError('');}
   }catch(e){if(!request.signal.aborted){setPage(null);setLoadError(e instanceof Error?e.message:'Could not load notifications.');}}
   finally{if(!request.signal.aborted)timer=setTimeout(()=>void refresh(),5000);}
  }
  void refresh();return()=>{request.abort();clearTimeout(timer);};
 },[base,before,revision]);
 async function act(action:'save'|'test'|'disconnect',destination?:Destination){
  if(mutation.current||!page?.canManage)return;
  const request=new AbortController();mutation.current=request;setBusy(true);setError('');setNotice('');
  if(action==='test'&&!testKeys.current.has(destination!.id))testKeys.current.set(destination!.id,crypto.randomUUID());
  try{
   const response=await fetch(base+(action==='save'?'':`/${destination!.id}${action==='test'?'/test':''}`),{method:action==='disconnect'?'DELETE':'POST',signal:request.signal,headers:{'content-type':'application/json'},body:JSON.stringify(action==='save'?{kind,value}:action==='test'?{requestKey:testKeys.current.get(destination!.id)}:{confirm})});
   const data=await response.json();
   if(!request.signal.aborted&&(response.status===401||response.status===403)){
    setPage(null);setSelected(null);setConfirm('');setValue('');setRevision(n=>n+1);
   }
   if(!response.ok)throw new Error(data.error??'Request could not be completed.');
   if(request.signal.aborted)return;
   if(action==='save'){setValue('');testKeys.current.clear();setNotice('Destination saved. Delivery has not been tested.');}
   if(action==='test'){setNotice(`Test ${data.status}. Check the destination status below; queued does not mean delivered.`);testKeys.current.delete(destination!.id);}
   if(action==='disconnect'){setSelected(null);setConfirm('');setNotice('Destination disconnected. Delivery history is retained.');}
   setRevision(n=>n+1);
  }catch(e){if(!request.signal.aborted)setError(`${e instanceof Error?e.message:'Request failed.'}${action==='test'?' Retry uses the same test identifier to avoid a duplicate.':''}`);}
  finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 }
 return <section className="notification-page space-y-6" aria-label="Workspace notifications">
  <header><WatchPageHeader kicker="Workspace settings" title="Notifications" lede="Know when monitored websites need attention. Private findings stay inside the app." /></header>
  <p className="text-sm text-mute">These destinations receive independent website alerts. Uploaded packages produce scan evidence, not ongoing alerts. Slack requires Team or an active trial.</p>
  {loadError?<div role="alert">{loadError}<Button variant="outline" onClick={()=>setRevision(n=>n+1)}>Reload notifications</Button></div>:!page?<WatchSkeleton variant="list" className="mt-4" />:null}
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {page?.canManage?<form className="notification-compose watch-card p-4 sm:p-5 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={e=>{e.preventDefault();void act('save');}}>
   <div className="settings-form-heading"><h2>Add a destination</h2><p>Choose where website alerts should arrive.</p></div><label className="w-full sm:w-auto">Destination type<select disabled={busy} className="block w-full rounded border border-white/15 bg-back p-2" value={kind} onChange={e=>{setKind(e.target.value as 'email'|'slack');setValue('');}}><option value="email">Email</option><option value="slack">Slack</option></select></label>
   <label className="min-w-0 w-full sm:min-w-48 sm:flex-1">{kind==='email'?'Email address':'Slack webhook URL'}<input disabled={busy} className="block w-full rounded border border-white/15 bg-transparent p-2" type={kind==='email'?'email':'password'} autoComplete="off" value={value} onChange={e=>setValue(e.target.value)} required maxLength={300}/></label>
   <Button type="submit" className="w-full sm:w-auto" disabled={busy||!value.trim()}>Save destination</Button>
   <p className="w-full text-sm text-mute">Saving replaces this workspace’s existing destination of the same type. {page.providers[kind]?'Send a test after saving.':'Provider sending is not configured on this host; saving alone will not enable it.'}</p>
  </form>:page?<p>Only administrators of an active workspace can change destinations.</p>:null}
  {page?<><section className="settings-records"><h2>Connected destinations</h2><ul className="divide-y divide-white/10">{page.destinations.filter(d=>d.independent).map(d=><li className="flex flex-wrap items-center justify-between gap-4 py-4" key={d.id}><div className="min-w-0 [overflow-wrap:anywhere]"><strong>{d.kind==='email'?'Email':'Slack'} · {d.host}</strong><p className="text-sm text-mute">Last delivery: {d.last_delivery_status??'not sent'} · Latest test: {notificationTestLabel(d.test_status)}</p></div>{page.canManage?<div className="flex max-w-full flex-wrap gap-3"><Button variant="outline" aria-label={`Send test to ${d.host}`} disabled={busy||!page.providers[d.kind as 'email'|'slack']||d.test_status==='queued'||d.test_status==='running'} onClick={()=>void act('test',d)}>Send test</Button><Button variant="ghost" aria-label={`Disconnect ${d.host}`} disabled={busy} onClick={()=>{setSelected(d);setConfirm('');}}>Disconnect</Button></div>:null}</li>)}</ul>
   {!page.destinations.some(d=>d.independent)?<p>No workspace destinations yet.</p>:null}
   {page.destinations.some(d=>!d.independent)?<p className="text-sm text-mute">GitHub connection destinations are managed separately below. Their delivery history is included here.</p>:null}
   </section><section className="settings-history" aria-label="Delivery history"><h2 className="text-lg font-semibold">Delivery history</h2><p className="text-sm text-mute">Provider acceptance is recorded as sent; it does not confirm that someone read the message.</p><ul className="divide-y divide-white/10">{page.deliveries.map(d=><li key={d.id} className="flex flex-wrap justify-between gap-3 py-3"><div><span>{d.kind} · {d.status}</span>{d.status==='failed'?<p className="text-sm text-mute">{notificationFailureMessage(d.error_code)}</p>:null}</div><time dateTime={d.created_at}>{new Date(d.created_at).toLocaleString()}</time></li>)}</ul>{!page.deliveries.length?<p>No delivery attempts on this page.</p>:null}<nav className="flex gap-3" aria-label="Delivery history pages"><Button variant="outline" disabled={busy||!before} onClick={()=>{setPage(null);setBefore(null);}}>Newest</Button><Button variant="outline" disabled={busy||!page.nextCursor} onClick={()=>{setPage(null);setBefore(page.nextCursor);}}>Older</Button></nav></section>
  </>:null}
  {selected?<form className="watch-card p-4 sm:p-5 space-y-3" onSubmit={e=>{e.preventDefault();void act('disconnect',selected);}}><p>Disconnecting removes credentials and pending notifications, not delivery history.</p><label className="block min-w-0 [overflow-wrap:anywhere]">Type {selected.host} to disconnect<input className="block w-full min-w-0 rounded border border-white/15 bg-transparent p-2" autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><div className="flex max-w-full flex-wrap gap-3"><Button type="submit" disabled={busy||!page?.canManage||confirm!==selected.host}>Confirm disconnect</Button><Button variant="ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancel</Button></div></form>:null}
 </section>;
}
