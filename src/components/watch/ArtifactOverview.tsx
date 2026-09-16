import { useEffect, useState } from 'react';
import { Package, Globe, ArrowUpRight, ArrowRight, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navigate } from '@/nav';
import { overviewNextAction } from './overview-next-action';
import './artifact-overview.css';

type Overview={connectedActivity?:Array<{installationId:number;name:string;queued:number;running:number}>;workspace:{name:string;archived:boolean};counts:{total:number;active:number;attention:number;passed:number};hostedSources?:Array<{installationId:number;name:string;total:number;passed:number;attention:number}>;alertCounts?:{open:number;waiting:number;done:number;mine:number};websiteCoverage?:{total:number;attention:number;delayed:number;unverified?:number;unchecked?:number};recent:Array<{id:string;target:string;status:string;created_at:string;completed_at?:string|null;source_kind:'website'|'artifact';verdict:string}>};
export function ArtifactOverview({workspaceId,search}:{workspaceId:string;search:string;nowLabel:string}) {
 return <OverviewScope key={workspaceId} workspaceId={workspaceId} search={search}/>;
}
const dateLabel=(value:string)=>new Date(value).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function resultTone(row:Overview['recent'][number]) {
 return row.verdict.startsWith('Policy passed')?'passed':row.status==='failed'?'failed':row.verdict==='Review findings'?'review':'neutral';
}
function resultLabel(row:Overview['recent'][number]) {return row.verdict==='Review findings'?'Needs review':row.verdict;}
function OverviewScope({workspaceId,search}:{workspaceId:string;search:string}) {
 const [data,setData]=useState<(Overview & {connectedCoverage?:{total:number;paused:number;unavailable?:number;unknown:number;delayed:number;recent:number;connections?:Array<{installationId:number;name:string}>}})|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function refresh(){try{const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/overview`,{signal:controller.signal});const body=await response.json();if(!response.ok||!body.counts||!Array.isArray(body.recent))throw new Error('Workspace overview could not be loaded.');if(controller.signal.aborted)return;setData(body);setError('');const active=body.counts.active>0||body.connectedActivity?.some((item:{queued:number;running:number})=>item.queued+item.running>0);timer=setTimeout(()=>void refresh(),active?3000:30000);}catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Workspace overview could not be loaded.');}}
  void refresh();return()=>{controller.abort();clearTimeout(timer);};
 },[workspaceId,retry]);

 function href(view:string,extra:Record<string,string>={}) {
  const params=new URLSearchParams({workspace:workspaceId});
  const install=new URLSearchParams(search).get('install');
  if(install)params.set('install',install);
  Object.entries(extra).forEach(([key,value])=>params.set(key,value));
  return `/watch/${view}?${params}`;
 }
 const go=(view:string,extra:Record<string,string>={})=>navigate(href(view,extra));
 const openEvidence=(id:string)=>go('releases',{upload:id,uploadView:'detail'});
 if(error)return <section className="workspace-overview overview-error" role="alert"><h1 className="watch-page-title">Overview unavailable</h1><p>{error} No other workspace’s evidence is shown.</p><div className="overview-actions"><Button onClick={()=>{setError('');setData(null);setRetry(value=>value+1);}}>Retry</Button><Button variant="outline" onClick={()=>navigate('/watch/workspaces')}>Choose a workspace</Button></div></section>;
 if(!data)return <section aria-label="Workspace overview" aria-busy="true"><span className="sr-only" role="status">Loading workspace overview…</span></section>;
 const latest=data.recent[0];
 const nextAction=overviewNextAction(data,workspaceId);
 const hasAlerts=!!data.alertCounts&&(data.alertCounts.open+data.alertCounts.waiting+data.alertCounts.done)>0;
 const empty=!data.counts.total&&!hasAlerts&&!data.hostedSources?.length&&!data.connectedActivity?.length&&!data.workspace.archived;
 const unavailableNotice=data.connectedCoverage?.unavailable?<p className="overview-notice" role="status">{data.connectedCoverage.unavailable} sources unavailable because their connection is suspended. <button onClick={()=>go('sources')} className="overview-link">Review connection access in Coverage<ArrowRight aria-hidden/></button></p>:null;
 if(empty) {
  const websiteStage=data.websiteCoverage?.total?(data.websiteCoverage.unchecked?'scan':data.websiteCoverage.unverified?'verify':'configured'):undefined;
  const connected=(data.connectedCoverage?.total??0)>(data.connectedCoverage?.paused??0)+(data.connectedCoverage?.unavailable??0);
  return <section className="workspace-overview" aria-label="Workspace overview"><header className="overview-page-head"><div><p className="overview-eyebrow">{data.workspace.name}</p><h1>Your first release starts here.</h1><p>Get useful evidence from the exact build you plan to ship.</p></div></header>{unavailableNotice}<div className="overview-first-scan"><Package aria-hidden/><h2>{websiteStage==='verify'?'Your website is added. Verify ownership next.':websiteStage==='scan'?'Ownership verified. Run your first check.':'Check a build in minutes'}</h2><p>Upload a release archive, or connect a repository with a published release.</p><Button className="overview-primary" onClick={()=>go('scan',{mode:'package'})}>Run your first scan<ArrowRight aria-hidden/></Button>{websiteStage||connected?<button className="overview-link" onClick={()=>go('sources')}>{websiteStage==='verify'?'Verify website ownership':websiteStage==='scan'?'Run your first website check':websiteStage?'Review website setup':'Choose a connected source to check'}<ArrowRight aria-hidden/></button>:null}</div></section>;
 }
 const latestDescription=latest?(latest.status==='queued'?'This build is waiting to be inspected.':latest.status==='running'?'This build is being inspected. Results will appear when the check finishes.':latest.status==='failed'?'This scan could not complete. Open the attempt to review what happened.':latest.verdict.startsWith('Policy passed')?'The recorded scan passed its configured policy. Open the evidence to review its scope.':latest.verdict==='Review findings'?'The recorded scan has findings to review. Open the evidence to inspect the affected files.':'Open this attempt to review its recorded outcome and limitations.'):nextAction.text;
 const activityUntil=new Date();
 const days=Array.from({length:7},(_,i)=>{const d=new Date(activityUntil);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-6+i);return d;});
 const activityRows=[{key:'github',label:'GitHub releases',configured:!!data.connectedCoverage?.connections?.length||!!data.hostedSources?.length},{key:'artifact',label:'Uploaded builds',configured:true},{key:'website',label:'Production websites',configured:!!data.websiteCoverage?.total}];
 return <section className="workspace-overview" aria-label="Workspace overview">
  <header className="overview-page-head"><div><p className="overview-eyebrow">{data.workspace.name}</p><h1>Your releases, at a glance.</h1><p>{data.counts.attention?`${data.counts.attention===1?'One attempt needs':`${data.counts.attention} attempts need`} a closer look.`:'Your latest retained release evidence is ready.'}</p><span className="sr-only">{data.workspace.name} · Your releases and saved evidence.</span></div>{!data.workspace.archived?<Button className="overview-primary" onClick={()=>go('scan')}>New scan<Plus aria-hidden/></Button>:null}</header>
  {data.workspace.archived?<p className="overview-notice" role="status">Archived — history remains available. Restore the workspace before starting another scan. <button className="overview-link" onClick={()=>go('workspaces')}>Workspace settings<ArrowRight aria-hidden/></button></p>:null}
  {unavailableNotice}
  <section className="overview-latest" aria-label="Latest release decision">
   <div className="overview-latest-top"><span className="overview-eyebrow">{latest?(latest.status==='done'?'Latest release':'Latest attempt'):'Next action'}</span>{latest?<span className={`overview-status ${resultTone(latest)}`}>{resultLabel(latest)}</span>:null}</div>
   <h2>{latest?(latest.source_kind==='website'?'Website check':'Release artifact'):nextAction.label}{latest?<span> · {latest.target}</span>:null}</h2>
   <p>{latestDescription}</p>
   <Button className="overview-primary" onClick={()=>latest?openEvidence(latest.id):navigate(nextAction.href)}>{latest?(latest.verdict==='Review findings'?'Review finding':'Review evidence'):nextAction.label}<ArrowUpRight aria-hidden/></Button>
   <div className="overview-latest-meta"><span>{latest?dateLabel(latest.created_at):'No saved release yet'}</span><span>Production evidence is separate</span></div>
  </section>
  <div className="overview-stat-strip" aria-label="Workspace evidence totals">
   <button aria-label={`Saved attempts ${data.counts.total}`} onClick={()=>go('releases',{releaseView:'attempts'})}><strong>{data.counts.total}</strong><span>Saved attempts</span></button>
   <button aria-label={`Need review ${data.counts.attention}`} onClick={()=>go('releases',{releaseView:'attempts',uploadStatus:'attention'})}><strong className="review">{data.counts.attention}</strong><span>Needs review</span></button>
   <button aria-label={`${data.connectedCoverage?.total??0} connected sources`} onClick={()=>go('sources',{coverageHealth:'all'})}><strong>{data.connectedCoverage?.total??0}</strong><span>Connected sources</span></button>
  </div>
  <section className="overview-releases" aria-label="Recent release scans"><div className="overview-section-heading"><h2>Recent release scans</h2><button className="overview-link" onClick={()=>go('releases')}>All releases<ArrowRight aria-hidden/></button></div>
   {data.recent.length?<div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>Build</th><th>Scanned</th><th>Result</th><th>Files</th><th><span className="sr-only">Open evidence</span></th></tr></thead><tbody>{data.recent.slice(0,3).map(row=><tr key={row.id}><td><button className="overview-entity" onClick={()=>openEvidence(row.id)} aria-label={`View evidence for ${row.target}`}><span className="overview-source-icon">{row.source_kind==='website'?<Globe aria-hidden/>:<Package aria-hidden/>}</span><span><strong>{row.source_kind==='website'?'Website check':'Release artifact'}</strong><small>{row.target}</small></span></button></td><td>{row.completed_at?dateLabel(row.completed_at):row.status==='done'?dateLabel(row.created_at):'Not completed'}</td><td><span className={`overview-status ${resultTone(row)}`}>{resultLabel(row)}</span></td><td><span title="File count is available in the full scan evidence" aria-label="File count not available in this summary">—</span></td><td><button className="overview-open" onClick={()=>openEvidence(row.id)} aria-label={`Open ${row.target}`}>Open<ChevronRight aria-hidden/></button></td></tr>)}</tbody></table></div>:<p className="overview-empty">No saved upload attempts yet.</p>}
   {!data.recent.length&&data.hostedSources?.map(source=><p className="overview-connected-empty" key={source.installationId}><span>{source.name} · {source.total} retained releases</span><button className="overview-link" onClick={()=>go('releases',{install:String(source.installationId),releaseView:'connected'})}>View {source.name} releases<ArrowRight aria-hidden/></button></p>)}
  </section>
  <section className="overview-activity-section" aria-label="Source activity"><div className="overview-section-heading"><h2>Source activity</h2><button className="overview-link" onClick={()=>go('timeline')}>View timeline<ArrowRight aria-hidden/></button></div>
   <div className="overview-activity-row overview-activity-dates"><span/><div>{days.map(day=><span key={day.toISOString()}>{day.toLocaleDateString(undefined,{weekday:'short',day:'numeric',timeZone:'UTC'})}</span>)}</div><small>Last 7 days</small></div>
   {activityRows.map(source=><div className="overview-activity-row" key={source.key}><span>{source.label}</span><div className="overview-activity-ticks">{days.map(day=>{const rows=data.recent.filter(row=>row.source_kind===source.key&&row.status==='done'&&Date.parse(row.completed_at??row.created_at)>=day.getTime()&&Date.parse(row.completed_at??row.created_at)<day.getTime()+86400000&&Date.parse(row.completed_at??row.created_at)<=activityUntil.getTime());return <span key={day.toISOString()} className={rows.length?(rows.some(row=>!row.verdict.startsWith('Policy passed'))?'has-review':'has-record'):''} title={`${day.toLocaleDateString(undefined,{timeZone:'UTC'})}: ${source.key==='github'?'Activity unavailable in this summary':rows.length?`${rows.length} recent saved checks`:'No returned check'}`} aria-label={`${source.label}, ${day.toISOString().slice(0,10)}: ${source.key==='github'?'Activity unavailable in this summary':`${rows.length} returned checks`}`}/>;})}</div><small>{!source.configured?'Not configured':source.key==='github'?'View timeline':'Recent checks'}</small></div>)}
   <p className="overview-micro">Activity uses the latest five returned scans, in UTC. Gaps are not proof of inactivity or continuous safety; open Timeline for more history.</p>
  </section>
 </section>;
}
