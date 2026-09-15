import './design/settings-pages.css';
import './design/notification-settings.css';
import {SettingsTabs} from './design/SettingsTabs';
import {Mail,History} from 'lucide-react';
import { WatchPageHeader } from "./WatchPageHeader.tsx";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState,useId,type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/motion/select';
import {notificationFailureMessage,notificationTestLabel} from '@/watch/notification-status';

type Destination={id:number;kind:string;host:string;independent:boolean;last_delivery_status:string|null;test_status:string|null};
type Page={destinations:Destination[];deliveries:{id:number;kind:string;status:string;created_at:string;error_code?:string|null}[];nextCursor:string|null;canManage:boolean;providers:{email:boolean;slack:boolean}};
export function WorkspaceNotifications({workspaceId,connectionSettings}:{workspaceId:string;connectionSettings?:ReactNode}){
 return <NotificationScope key={workspaceId} workspaceId={workspaceId} connectionSettings={connectionSettings}/>;
}
function NotificationScope({workspaceId,connectionSettings}:{workspaceId:string;connectionSettings?:ReactNode}){
 const [composing,setComposing]=useState(false);
 const composeButtonId=useId();
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
 const destinations=<>
  <div className="settings-section-head"><div><h2>Connected destinations</h2><p>Choose where independent website alerts arrive.</p></div>{page?.canManage?<Button id={composeButtonId} variant="outline" disabled={busy} onClick={()=>setComposing(value=>!value)} aria-expanded={composing} aria-controls="notification-compose">{composing?'Close editor':'Add destination'}</Button>:null}</div>
  {page?.canManage&&composing?<form id="notification-compose" className="notification-editor settings-surface" onSubmit={e=>{e.preventDefault();void act('save');}}>
   <h3>Add a destination</h3><div className="notification-fields"><div><span className="notification-field-label">Destination type</span><Select disabled={busy} value={kind} onValueChange={next=>{setKind(next as 'email'|'slack');setValue('');}}><SelectTrigger aria-label="Destination type"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="slack">Slack</SelectItem></SelectContent></Select></div>
   <label>{kind==='email'?'Email address':'Slack webhook URL'}<input disabled={busy} type={kind==='email'?'email':'password'} autoComplete="off" value={value} onChange={e=>setValue(e.target.value)} required maxLength={300}/></label></div>
   <p className="settings-note">Saving replaces this workspace’s existing destination of the same type. {page.providers[kind]?'Send a test after saving.':'Provider sending is not configured on this host; saving alone will not enable it.'}</p>
   <div className="notification-actions"><Button type="submit" disabled={busy||!value.trim()}>Save destination</Button><Button variant="ghost" disabled={busy} onClick={()=>{setComposing(false);document.getElementById(composeButtonId)?.focus();}}>Cancel</Button></div>
  </form>:null}
  {page?<><div className="notification-destination-list">{page.destinations.filter(d=>d.independent).map(d=><article className="notification-destination" key={d.id}><span className="notification-symbol" aria-hidden><Mail size={18}/></span><div className="notification-destination-copy"><h3>{d.host}</h3><p>{d.kind==='email'?'Email':'Slack'} · Last delivery: {d.last_delivery_status??'not sent'}</p><p>Latest test: {notificationTestLabel(d.test_status)}</p></div>{page.canManage?<div className="notification-actions"><Button variant="outline" aria-label={`Send test to ${d.host}`} disabled={busy||!page.providers[d.kind as 'email'|'slack']||d.test_status==='queued'||d.test_status==='running'} onClick={()=>void act('test',d)}>Send test</Button><Button variant="ghost" aria-label={`Disconnect ${d.host}`} disabled={busy} onClick={()=>{setSelected(d);setConfirm('');}}>Disconnect</Button></div>:null}</article>)}</div>
   {!page.destinations.some(d=>d.independent)?<div className="notification-empty"><Mail size={22} aria-hidden/><h3>No workspace destinations yet.</h3><p>Add email or Slack to receive website alerts. Private findings stay inside the app.</p></div>:null}
   {!page.canManage?<p className="settings-note">Only administrators of an active workspace can change destinations.</p>:null}
   <details className="settings-detail"><summary>Which alerts are sent?</summary><p>These destinations receive independent website alerts. Uploaded packages produce scan evidence, not ongoing alerts. Slack requires Team or an active trial.</p>{page.destinations.some(d=>!d.independent)?<p>GitHub connection destinations are managed in the GitHub tab. Their delivery history is included here.</p>:null}</details>
  </>:null}
  {selected?<form className="notification-editor settings-surface" onSubmit={e=>{e.preventDefault();void act('disconnect',selected);}}><h3>Disconnect {selected.host}</h3><p className="settings-note">Disconnecting removes credentials and pending notifications, not delivery history.</p><label>Type {selected.host} to disconnect<input autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><div className="notification-actions"><Button type="submit" disabled={busy||!page?.canManage||confirm!==selected.host}>Confirm disconnect</Button><Button variant="ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancel</Button></div></form>:null}
 </>;
 const history=<section aria-label="Delivery history"><div className="settings-section-head"><div><h2>Delivery history</h2><p>Provider acceptance is recorded as sent; it does not confirm that someone read the message.</p></div></div>{page?<><ul className="notification-history-list">{page.deliveries.map(d=><li key={d.id}><div><strong>{d.kind} · {d.status}</strong>{d.status==='failed'?<p>{notificationFailureMessage(d.error_code)}</p>:null}</div><time dateTime={d.created_at}>{new Date(d.created_at).toLocaleString()}</time></li>)}</ul>{!page.deliveries.length?<div className="notification-empty"><History size={22} aria-hidden/><h3>No delivery attempts on this page.</h3><p>Delivery attempts appear here after a notification is queued.</p></div>:null}{before||page.nextCursor?<nav className="notification-actions mt-5" aria-label="Delivery history pages"><Button variant="outline" disabled={busy||!before} onClick={()=>{setPage(null);setBefore(null);}}>Newest</Button><Button variant="outline" disabled={busy||!page.nextCursor} onClick={()=>{setPage(null);setBefore(page.nextCursor);}}>Older</Button></nav>:null}</>:null}</section>;
 return <section className="notification-page notification-settings" aria-label="Workspace notifications">
  <WatchPageHeader kicker="Workspace settings" title="Notifications" lede="Manage alert destinations and check delivery attempts."/>
  {loadError?<div role="alert" className="settings-note mt-5">{loadError}<Button variant="outline" onClick={()=>setRevision(n=>n+1)}>Reload notifications</Button></div>:!page?<WatchSkeleton variant="list" className="mt-4" />:null}
  {error?<p role="alert" className="settings-note mt-5">{error}</p>:null}{notice?<p role="status" className="settings-note mt-5">{notice}</p>:null}
  <SettingsTabs label="Notification settings" tabs={[{id:'destinations',label:'Destinations',content:destinations},{id:'history',label:'Delivery history',content:history},...(connectionSettings?[{id:'github',label:'GitHub',content:connectionSettings}]:[])]}/>
 </section>;
}
