import {useEffect,useRef,useState} from 'react';
import {WatchAlertsWorkspace} from '@/components/WatchAlertsWorkspace';
import {buildAlertListViewModels} from '@/watch/view-models';
import {filterDeskAlerts} from '@/watch/verdict';
import {parseWatchRoute} from '@/watch/routes';
import type {Alert,AlertEvent} from '@/watch/types';
import type {WatchSectionState} from '@/watch/data-state';
import {navigate} from '@/nav';
import {CLEAR_ALERT_ASSIGNMENT} from './AlertMemberSelect';
import {AlertRelatedReleases} from './AlertRelatedReleases';
import {AlertRecheck} from './AlertRecheck';
import {WebsiteAlertRecheck} from './WebsiteAlertRecheck';
import {Button} from '@/components/ui/button';

type WorkspaceAlert=Alert&{installation_id:number|null;scan_attempt_id:string|null;source_origin_id:number|null};
type Detail={alert:WorkspaceAlert;events:AlertEvent[];nextEventsCursor?:string|null};
type Props={workspaceId:string;search:string};
export function WorkspaceAlerts(props:Props){const p=new URLSearchParams(props.search);return <WorkspaceAlertPage key={`${props.workspaceId}:${p.get('tab')}:${p.get('mine')}:${p.get('before')}:${p.get('source')}`} {...props}/>;}
async function json<T>(url:string,signal:AbortSignal,body?:unknown):Promise<T>{
 const response=await fetch(url,{signal,credentials:'include',...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'Alerts could not be loaded.');return data;
}
function WorkspaceAlertPage({workspaceId,search}:Props){
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/alerts`;
 const route=parseWatchRoute('/watch/alerts',search),mine=new URLSearchParams(search).get('mine')==='1';
 const before=new URLSearchParams(search).get('before');
 const source=new URLSearchParams(search).get('source');
 const eventBefore=new URLSearchParams(search).get('eventBefore');
 const [page,setPage]=useState<{nextCursor:string|null;counts:{open:number;waiting:number;mine:number;done:number}}|null>(null);
 const [alerts,setAlerts]=useState<WorkspaceAlert[]>([]),[state,setState]=useState<WatchSectionState>({status:'loading'});
 const [identity,setIdentity]=useState({id:'',login:'',canRespond:false});
 const [sourceCount,setSourceCount]=useState(0);
 const [detail,setDetail]=useState<Detail|null>(null),[activity,setActivity]=useState<WatchSectionState>({status:'loading'});
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const [notes,setNotes]=useState<Record<number,string>>({}),[assignees,setAssignees]=useState<Record<number,string>>({});
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>()=>mutation.current?.abort(),[]);
 useEffect(()=>{const timer=window.setInterval(()=>{if(!mutation.current)setRevision(n=>n+1);},30_000);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{const request=new AbortController();
  void (async()=>{
   const [settings,me]=await Promise.all([
    json<{workspace:{role:string;archived_at:string|null}}>(`/api/workspaces/${workspaceId}/evidence-settings`,request.signal),
    json<{user:{id:string;login:string}}>('/api/me',request.signal),
   ]);
   const query=new URLSearchParams({status:route.tab,mine:mine?'1':'0'});if(before)query.set('before',before);if(source)query.set('source',source);
   const result=await json<{alerts:WorkspaceAlert[];nextCursor:string|null;sourceCount:number;counts:{open:number;waiting:number;mine:number;done:number}}>(`${base}?${query}`,request.signal);
   if(request.signal.aborted)return;
   setIdentity({...me.user,canRespond:!settings.workspace.archived_at&&['owner','admin','member'].includes(settings.workspace.role)});
   setPage(result);setSourceCount(result.sourceCount);setAlerts(result.alerts);setState({status:'ready'});
  })().catch(e=>{if(!request.signal.aborted){setAlerts([]);setDetail(null);setIdentity({id:'',login:'',canRespond:false});setState({status:'error',message:e.message});}});
  return()=>request.abort();
 },[workspaceId,base,revision,route.tab,mine,before,source]);
 const listed=filterDeskAlerts(alerts,route.tab,identity.login,mine,identity.id) as WorkspaceAlert[];
 const selectedId=route.alertId!==null?(!source||listed.some(row=>row.id===route.alertId)?route.alertId:null):listed[0]?.id??null;
 const selected=state.status!=='ready'?null:detail?.alert.id===selectedId?detail.alert:listed.find(row=>row.id===selectedId)??null;
 const detailReady=state.status==='ready'&&activity.status==='ready'&&detail?.alert.id===selectedId;
 useEffect(()=>{if(selectedId===null)return;const request=new AbortController();
  setActivity({status:'loading'});
  void json<Detail>(`${base}/${selectedId}${eventBefore?`?eventBefore=${encodeURIComponent(eventBefore)}`:''}`,request.signal).then(body=>{if(!request.signal.aborted){setDetail(body);setActivity({status:'ready'});}})
   .catch(e=>{if(!request.signal.aborted){setDetail(null);setActivity({status:'error',message:e.message});}});
  return()=>request.abort();
 },[base,selectedId,revision,eventBefore]);
 const go=(updates:Record<string,string|null>)=>{const params=new URLSearchParams(search);if('alert' in updates||'tab' in updates||'mine' in updates)params.delete('eventBefore');for(const [key,value] of Object.entries(updates)){if(value===null)params.delete(key);else params.set(key,value);}navigate(`/watch/alerts?${params}`);};
 const retry=()=>{setState({status:'loading'});setActivity({status:'loading'});setRevision(n=>n+1);};
 const act=async(action:'acknowledge'|'resolve'|'reopen'|'assign')=>{
  if(!selected||!detailReady||mutation.current||!identity.canRespond)return;
  const request=new AbortController();mutation.current=request;setBusy(true);setError(null);
  try{
   const body=await json<Detail>(`${base}/${selected.id}/respond`,request.signal,{action,note:notes[selected.id]??'',...(action==='assign'?{userId:assignees[selected.id]===CLEAR_ALERT_ASSIGNMENT?null:assignees[selected.id]??''}:{})});
   if(request.signal.aborted)return;setDetail(body);setAlerts(rows=>rows.map(row=>row.id===body.alert.id?body.alert:row));
   go({alert:String(body.alert.id),before:null,tab:body.alert.resolved_at?'done':body.alert.acknowledged_at?'waiting':'open',...(mine&&body.alert.assigned_to_user_id!==identity.id?{mine:null}:{})});setRevision(n=>n+1);
  }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Response could not be saved.');}
  finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 };
 return <>{source?<div className="flex items-center gap-3 px-4 py-2 text-sm"><span>Filtered to selected source</span><Button variant="ghost" size="sm" onClick={()=>go({source:null,alert:null,before:null,eventBefore:null})}>Show all workspace alerts</Button></div>:null}<WatchAlertsWorkspace workspaceId={workspaceId} userId={identity.id} alerts={listed} allAlerts={alerts} sourceCount={sourceCount} login={identity.login}
 counts={page?.counts} exportLabel="Export this page"
  activityPagination={(eventBefore||detail?.nextEventsCursor)&&<nav aria-label="Alert activity pages" className="mt-3 flex gap-2"><Button variant="outline" size="sm" disabled={!eventBefore} onClick={()=>go({eventBefore:null})}>Latest activity</Button><Button variant="outline" size="sm" disabled={!detail?.nextEventsCursor||!detailReady} onClick={()=>go({eventBefore:detail?.nextEventsCursor??null})}>Older activity</Button></nav>}
  selectedViewModel={selected?buildAlertListViewModels([selected],()=> 'Saved check')[0]:undefined}
  pagination={<nav aria-label="Alert history pages" className="flex items-center justify-between gap-2 border-t border-white/8 p-3 text-xs"><span>{alerts.length} alerts on this page</span><Button size="sm" variant="outline" disabled={!before||state.status!=='ready'} onClick={()=>go({before:null,alert:null})}>Newest</Button><Button size="sm" variant="outline" disabled={!page?.nextCursor||state.status!=='ready'} onClick={()=>go({before:page?.nextCursor??null,alert:null})}>Older</Button></nav>}
  rows={buildAlertListViewModels(listed,()=> 'Saved check')} selected={selected} events={detail?.alert.id===selectedId?detail.events:[]}
  previewing={false} canRespond={identity.canRespond&&detailReady} ended={false} busy={busy} note={selected?notes[selected.id]??'':''} assignee={selected?assignees[selected.id]??'':''}
  error={error} exportError={null} state={state} activityState={activity.status==='error'||detail?.alert.id===selectedId?activity:{status:'loading'}} detailOpen={route.alertId!==null} tab={route.tab} assignedToMe={mine} teamOnly={false}
  onSelect={id=>{setError(null);setActivity({status:'loading'});go({alert:String(id)});}} onBack={()=>go({alert:null})} onRetry={retry} onRetryActivity={retry}
  onTab={tab=>go({tab,alert:null,before:null})} onAssignedToMe={()=>go({mine:mine?null:'1',alert:null,before:null})}
  onNote={value=>{if(selected)setNotes(rows=>({...rows,[selected.id]:value}));}} onAssignee={value=>{if(selected)setAssignees(rows=>({...rows,[selected.id]:value}));}} onAction={action=>void act(action)}
  onExport={()=>{if(state.status!=='ready')return;const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),workspaceId,scope:'current_page',source,status:route.tab,mine,before,nextCursor:page?.nextCursor,alerts},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='nospoilers-alert-page.json';a.click();URL.revokeObjectURL(url);}}
  onConnectSource={()=>navigate(`/watch/sources?workspace=${workspaceId}`)}
relatedReleases={selected&&!detailReady?<p className="text-sm text-mute">Recheck actions require loaded alert evidence. Retry loading the selected alert before starting another scan.</p>:selected?.scan_attempt_id?<><a className="text-sm underline" href={`/watch/releases?workspace=${workspaceId}&upload=${encodeURIComponent(selected.scan_attempt_id)}&uploadView=detail`}>Open the saved website check</a>{selected.source_origin_id?<WebsiteAlertRecheck workspaceId={workspaceId} sourceId={selected.source_origin_id} canRespond={identity.canRespond}/>:null}</>:selected?.installation_id?<><AlertRecheck alertId={selected.id} installationId={selected.installation_id} workspaceId={workspaceId} canRespond={identity.canRespond} ended={false}/><AlertRelatedReleases hideEmpty alertId={selected.id} installationId={selected.installation_id} workspaceId={workspaceId}/></>:null}/></>
}
