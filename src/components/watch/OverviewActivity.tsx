import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowUpRight,GitBranch} from 'lucide-react';
import {navigate} from '@/nav';
import {buildAlertListViewModels} from '@/watch/view-models';
import type {Alert,TimelineEntry} from '@/watch/types';
import {overviewActivityBuckets} from './overview-activity';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/motion/select';

type Remote<T>={status:'loading'}|{status:'error';code:number}|{status:'ready';data:T};
function useOverviewRead<T>(url:string|null,retry:number){
 const [state,setState]=useState<Remote<T>>({status:'loading'});
 useEffect(()=>{
  if(!url)return;
  const request=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function read(){try{
   const response=await fetch(url!,{signal:request.signal});
   if(!response.ok){if(!request.signal.aborted)setState({status:'error',code:response.status});return;}
   const data=await response.json() as T;
   if(!request.signal.aborted){setState({status:'ready',data});timer=setTimeout(()=>void read(),30000);}
  }catch{if(!request.signal.aborted)setState({status:'error',code:0});}}
  void read();return()=>{request.abort();clearTimeout(timer);};
 },[url,retry]);
 return state;
}
const queues=[{key:'open',label:'Open'},{key:'waiting',label:'In progress'},{key:'done',label:'Resolved'}] as const;
export function OverviewAttention({workspaceId,counts}:{workspaceId:string;counts:{open:number;waiting:number;done:number;mine:number}}){
 const [tab,setTab]=useState<'open'|'waiting'|'done'>('open');
 const [retry,setRetry]=useState(0);
 return <section className="overview-panel overview-attention" aria-label="Needs attention">
  <div className="overview-section-heading"><h2>Needs attention</h2><button className="overview-link" onClick={()=>navigate(`/watch/alerts?${new URLSearchParams({workspace:workspaceId,tab})}`)}>View all<ArrowUpRight aria-hidden/></button></div>
  <p>Workspace alerts requiring a response</p>
  <div className="overview-queue" role="tablist" aria-label="Alert response filters" style={{'--selected':queues.findIndex(item=>item.key===tab)} as CSSProperties}>
   {queues.map((item,i)=><button key={item.key} id={`overview-tab-${item.key}`} role="tab" aria-selected={tab===item.key} aria-controls="overview-alert-panel" tabIndex={tab===item.key?0:-1} onClick={()=>setTab(item.key)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:2))%3;setTab(queues[index].key);document.getElementById(`overview-tab-${queues[index].key}`)?.focus();}}>{item.label} <span>{counts[item.key]}</span></button>)}
  </div>
  <AlertRows key={`${workspaceId}:${tab}:${retry}`} workspaceId={workspaceId} tab={tab} retry={retry} onRetry={()=>setRetry(n=>n+1)}/>
 </section>;
}
function AlertRows({workspaceId,tab,retry,onRetry}:{workspaceId:string;tab:string;retry:number;onRetry:()=>void}){
 const state=useOverviewRead<{alerts:Alert[];counts:{open:number;waiting:number;done:number}}>(`/api/workspaces/${encodeURIComponent(workspaceId)}/alerts?status=${tab}`,retry);
 const valid=state.status==='ready'&&Array.isArray(state.data.alerts);
 const rows=valid?buildAlertListViewModels(state.data.alerts.slice(0,3),()=> 'Saved check').map(row=>({...row,coordinate:row.coordinate===row.rule?row.title:row.coordinate})):[];
 return <div id="overview-alert-panel" role="tabpanel" aria-labelledby={`overview-tab-${tab}`} aria-busy={state.status==='loading'} className="overview-alert-panel">
  {state.status==='loading'?<span className="sr-only" role="status">Loading alerts</span>:!valid?<div className="overview-empty" role="alert"><p>Alerts could not be loaded.</p><button className="overview-link" onClick={onRetry}>Retry alerts</button></div>:!rows.length?<p className="overview-empty">{tab==='open'?'No open alerts.':tab==='waiting'?'No checks in progress.':'No resolved alerts.'}</p>:<>{rows.map(row=><button key={row.id} className="overview-alert-row" onClick={()=>navigate(`/watch/alerts?${new URLSearchParams({workspace:workspaceId,tab,alert:String(row.id)})}`)} aria-label={`Review ${row.coordinate}`}><GitBranch aria-hidden/><span><strong>{row.operational?'Check incomplete':row.title}</strong><small>{row.coordinate}</small></span><ArrowUpRight aria-hidden/></button>)}<button className="overview-link overview-alert-more" onClick={()=>navigate(`/watch/alerts?${new URLSearchParams({workspace:workspaceId,tab})}`)}>View {tab==='waiting'?'in progress':tab==='done'?'resolved':'open'} alerts<ArrowUpRight aria-hidden/></button></>}
 </div>;
}

export function OverviewActivity({workspaceId,connection}:{workspaceId:string;connection?:{installationId:number;name:string}}){
 const [retry,setRetry]=useState(0);
 return <TimelinePreview key={`${workspaceId}:${connection?.installationId}:${retry}`} workspaceId={workspaceId} connection={connection} retry={retry} onRetry={()=>setRetry(n=>n+1)}/>;
}
function TimelinePreview({workspaceId,connection,retry,onRetry}:{workspaceId:string;connection?:{installationId:number;name:string};retry:number;onRetry:()=>void}){
 const [days,setDays]=useState(7);
 const state=useOverviewRead<{entries:TimelineEntry[];until:string;days:number}>(connection?`/api/timeline?installationId=${connection.installationId}`:null,retry);
 const ready=state.status==='ready'&&Array.isArray(state.data.entries)&&Number.isFinite(Date.parse(state.data.until));
 const buckets=ready?overviewActivityBuckets(state.data.entries,days,state.data.until):[];
 const max=Math.max(1,...buckets.flatMap(b=>[b.opened,b.responded]));
 const total=buckets.reduce((sum,b)=>sum+b.opened,0);
 const timeline=()=>navigate(`/watch/timeline?${new URLSearchParams({workspace:workspaceId,...(connection?{install:String(connection.installationId)}:{})})}`);
 return <section className="overview-panel overview-activity" aria-label="Alert activity">
  <div className="overview-section-heading"><h2>Alert activity</h2>{ready?<Select className="overview-activity-select" value={String(days)} onValueChange={value=>setDays(Number(value))}><SelectTrigger aria-label="Activity range"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select>:null}</div>
  <p>{connection?`${connection.name} · Selected connection`:'Choose a connection to view its timeline'}</p>
  {!connection?<div className="overview-empty"><button className="overview-link" onClick={timeline}>Open timeline<ArrowUpRight aria-hidden/></button></div>:state.status==='loading'?<div className="overview-chart-loading" aria-busy="true"><span className="sr-only" role="status">Loading activity</span></div>:!ready?<div className="overview-empty"><p>{state.status==='error'&&[402,403].includes(state.code)?'Timeline is available with Team or an active trial.':'Activity could not be loaded.'}</p><button className="overview-link" onClick={state.status==='error'&&[402,403].includes(state.code)?timeline:onRetry}>{state.status==='error'&&[402,403].includes(state.code)?'View timeline access':'Retry activity'}<ArrowUpRight aria-hidden/></button></div>:<>
   <div className="overview-chart-total"><strong>{total}</strong><span>alerts opened in the returned history</span></div>
   <div className="overview-chart" role="img" aria-label={buckets.map(b=>`${b.at.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}: ${b.opened} alerts opened, ${b.responded} response events`).join('; ')}>
    <span className="overview-chart-max">{max}</span>{buckets.map(b=><div className="overview-chart-column" key={b.at.toISOString()}><div className="overview-chart-bars"><i style={{height:`${b.opened/max*100}%`}}/><i style={{height:`${b.responded/max*100}%`}}/></div><span>{b.at.toLocaleDateString(undefined,days===7?{weekday:'short',timeZone:'UTC'}:{month:'short',day:'numeric',timeZone:'UTC'})}</span></div>)}
   </div>
   <div className="overview-chart-legend"><span>Alerts opened</span><span>Response events</span></div>
   <p className="overview-chart-note">Up to 200 retained events · UTC dates. Responses are not resolved-alert totals.</p>
   <button className="overview-link" onClick={timeline}>View timeline<ArrowUpRight aria-hidden/></button>
  </>}
 </section>;
}
