import { useEffect, useState } from 'react';
import { Package, Globe, ArrowUpRight, ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { navigate } from '@/nav';
import { overviewNextAction } from './overview-next-action';
import './artifact-overview.css';

type Overview={connectedActivity?:Array<{installationId:number;name:string;queued:number;running:number}>;workspace:{name:string;archived:boolean};counts:{total:number;active:number;attention:number;completedAttention?:number;attemptAttention?:number;passed:number};hostedSources?:Array<{installationId:number;name:string;total:number;passed:number;attention:number}>;alertCounts?:{open:number;waiting:number;done:number;mine:number};priorityAlert?:{id:number;title:string;body:string;kind:string;findings:{rule:string;path:string;severity?:string}[]|null;created_at:string;acknowledged_at:string|null;resolved_at:string|null;status:'open'|'waiting'}|null;websiteCoverage?:{total:number;attention:number;delayed:number;unverified?:number;unchecked?:number};recent:Array<{id:string;target:string;status:string;created_at:string;completed_at?:string|null;source_kind:'website'|'artifact';verdict:string}>};
export function ArtifactOverview({workspaceId,search}:{workspaceId:string;search:string;nowLabel:string}) {
 return <OverviewScope key={workspaceId} workspaceId={workspaceId} search={search}/>;
}
const dateLabel=(value:string)=>new Date(value).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function resultTone(row:Overview['recent'][number]) {
 return row.verdict.startsWith('Policy passed')?'passed':row.status==='failed'?'failed':row.verdict==='Review findings'?'review':'neutral';
}
function resultLabel(row:Overview['recent'][number]) {return row.verdict==='Review findings'?'Needs review':row.verdict;}
function priorityRank(row:Overview['recent'][number]) {
 if(row.verdict==='Review findings')return 0;
 if(row.status==='failed')return 1;
 if(row.status==='running'||row.status==='queued')return 2;
 if(!row.verdict.startsWith('Policy passed'))return 3;
 return 4;
}
function overviewHeading(row:Overview['recent'][number]|undefined) {
 if(!row)return 'Your release evidence is ready.';
 if(row.verdict==='Review findings')return 'One release needs review.';
 if(row.status==='failed')return 'A release attempt could not complete.';
 if(row.status==='running')return 'A release check is running.';
 if(row.status==='queued')return 'A release check is queued.';
 if(priorityRank(row)<4)return 'A release result needs review.';
 return 'Your latest release evidence is ready.';
}
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
 const spotlight=data.recent.reduce<Overview['recent'][number]|undefined>((best,row)=>!best||priorityRank(row)<priorityRank(best)?row:best,undefined);
 const actionable=data.recent.filter(row=>priorityRank(row)<4).slice(0,3);
 const priorityAlert=data.priorityAlert??null;
 const priorityFindings=priorityAlert&&Array.isArray(priorityAlert.findings)?priorityAlert.findings:[];
 const priorityFinding=priorityFindings.find(finding=>finding.severity?.toLowerCase()==='critical')??priorityFindings[0]??null;
 const priorityOperational=priorityAlert?.kind==='scan_latest_release'&&!priorityFinding;
 const priorityRepositoryExposure=priorityAlert?.kind==='repo_publicized'||priorityAlert?.kind==='repo_created_public';
 const priorityAlertCritical=priorityRepositoryExposure||priorityFinding?.severity?.toLowerCase()==='critical';
 const priorityAlertLabel=priorityOperational?'Check incomplete':priorityFinding?(priorityAlertCritical?'Critical finding':'Finding'):priorityRepositoryExposure?'Repository exposure':'Exposure';
 const completedAttention=data.counts.completedAttention??data.recent.filter(row=>row.status==='done'&&priorityRank(row)<4).length;
 const attemptAttention=data.counts.attemptAttention??Math.max(0,data.counts.attention-completedAttention);
 const nextAction=overviewNextAction(data,workspaceId);
 const hasAlerts=!!data.alertCounts&&(data.alertCounts.open+data.alertCounts.waiting+data.alertCounts.done)>0;
 const empty=!data.counts.total&&!hasAlerts&&!data.hostedSources?.length&&!data.connectedActivity?.length&&!data.workspace.archived;
 const unavailableNotice=data.connectedCoverage?.unavailable?<p className="overview-notice" role="status">{data.connectedCoverage.unavailable} sources unavailable because their connection is suspended. <button onClick={()=>go('sources')} className="overview-link">Review connection access in Coverage<ArrowRight aria-hidden/></button></p>:null;
 if(empty) {
  const websiteStage=data.websiteCoverage?.total?(data.websiteCoverage.unchecked?'scan':data.websiteCoverage.unverified?'verify':'configured'):undefined;
  const connected=(data.connectedCoverage?.total??0)>(data.connectedCoverage?.paused??0)+(data.connectedCoverage?.unavailable??0);
  return <section className="workspace-overview" aria-label="Workspace overview"><header className="overview-page-head"><div><p className="overview-eyebrow">{data.workspace.name}</p><h1>Your first release starts here.</h1><p>Get useful evidence from the exact build you plan to ship.</p></div></header>{unavailableNotice}<div className="overview-first-scan"><Package aria-hidden/><h2>{websiteStage==='verify'?'Your website is added. Verify ownership next.':websiteStage==='scan'?'Ownership verified. Run your first check.':'Check a build in minutes'}</h2><p>Upload a release archive, or connect a repository with a published release.</p><Button className="overview-primary" onClick={()=>go('scan',{mode:'package'})}>Run your first scan<ArrowRight aria-hidden/></Button>{websiteStage||connected?<button className="overview-link" onClick={()=>go('sources')}>{websiteStage==='verify'?'Verify website ownership':websiteStage==='scan'?'Run your first website check':websiteStage?'Review website setup':'Choose a connected source to check'}<ArrowRight aria-hidden/></button>:null}</div></section>;
 }
 const spotlightDescription=spotlight?(spotlight.status==='queued'?'This build is waiting to be inspected. No release decision is available yet.':spotlight.status==='running'?'This build is being inspected. Results will appear when the check finishes.':spotlight.status==='failed'?'This scan could not complete. Open the attempt to review what happened.':spotlight.verdict.startsWith('Policy passed')?'The recorded scan passed its configured policy. Open the evidence to review its scope.':spotlight.verdict==='Review findings'?'The recorded scan has findings to review. Open the evidence to inspect the affected files.':'Open this attempt to review its recorded outcome and limitations.'):nextAction.text;
 const activityUntil=new Date();
 const days=Array.from({length:7},(_,i)=>{const d=new Date(activityUntil);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-6+i);return d;});
 const activityRows=[{key:'github',label:'GitHub releases',configured:!!data.connectedCoverage?.connections?.length||!!data.hostedSources?.length},{key:'artifact',label:'Uploaded builds',configured:true},{key:'website',label:'Production websites',configured:!!data.websiteCoverage?.total}];
 return <section className="workspace-overview" aria-label="Workspace overview">
  <header className="overview-page-head"><div><p className="overview-eyebrow">{data.workspace.name}</p><h1>{priorityAlert?(priorityOperational?'A release check needs your response.':'One release alert needs your response.'):overviewHeading(spotlight)}</h1><p>See the most important returned state first, then the evidence and coverage that support it.</p><span className="sr-only">{data.workspace.name} · Your releases and saved evidence.</span></div></header>
  {data.workspace.archived?<p className="overview-notice" role="status">Archived — history remains available. Restore the workspace before starting another scan. <button className="overview-link" onClick={()=>go('workspaces')}>Workspace settings<ArrowRight aria-hidden/></button></p>:null}
  {unavailableNotice}
  <section className={`overview-latest is-${priorityAlert?(priorityAlertCritical?'failed':'review'):spotlight?resultTone(spotlight):'neutral'}`} aria-label="Priority release decision">
   <div className="overview-latest-top"><span className="overview-eyebrow">{priorityAlert?(priorityAlert.status==='open'?'Open alert':'Response in progress'):spotlight?(priorityRank(spotlight)<4?'Needs attention':'Latest release'):'Next action'}</span>{priorityAlert?<span className={`overview-status ${priorityAlertCritical?'failed':'review'}`}>{priorityAlertLabel}</span>:spotlight?<span className={`overview-status ${resultTone(spotlight)}`}>{resultLabel(spotlight)}</span>:null}</div>
   <h2>{priorityAlert?priorityAlert.title:spotlight?(spotlight.source_kind==='website'?'Website check':'Release artifact'):nextAction.label}{!priorityAlert&&spotlight?<span> · {spotlight.target}</span>:null}</h2>
   <p>{priorityAlert?'This alert needs a response. Reviewing or resolving it will not rewrite the original scan evidence.':spotlightDescription}</p>
   <Button className="overview-primary" onClick={()=>priorityAlert?go('alerts',{alert:String(priorityAlert.id),tab:priorityAlert.status}):spotlight?openEvidence(spotlight.id):navigate(nextAction.href)}>{priorityAlert?'Review alert':spotlight?(spotlight.verdict==='Review findings'?'Review finding':'Review evidence'):nextAction.label}<ArrowUpRight aria-hidden/></Button>
   <div className="overview-latest-meta"><span>{priorityAlert?dateLabel(priorityAlert.created_at):spotlight?dateLabel(spotlight.created_at):'No saved release yet'}</span><span>{priorityAlert?'Original evidence remains on record':'Production evidence remains a separate lane'}</span></div>
  </section>
  <div className="overview-action-grid">
   <section className="overview-needs" aria-label="Release work"><div className="overview-section-heading"><h2>Needs attention</h2><div className="overview-needs-links">{completedAttention?<button className="overview-link" aria-label={`Completed releases needing review ${completedAttention}`} onClick={()=>go('releases',{uploadStatus:'attention'})}>{completedAttention} {completedAttention===1?'release':'releases'}<ArrowRight aria-hidden/></button>:null}{attemptAttention?<button className="overview-link" aria-label={`Failed attempts needing review ${attemptAttention}`} onClick={()=>go('releases',{releaseView:'attempts',uploadStatus:'attention'})}>{attemptAttention} {attemptAttention===1?'attempt':'attempts'}<ArrowRight aria-hidden/></button>:null}</div></div>
    {priorityAlert||actionable.length?<div className="overview-need-list">{priorityAlert?<button onClick={()=>go('alerts',{alert:String(priorityAlert.id),tab:priorityAlert.status})}><span><strong>{priorityAlert.title}</strong><small>{priorityAlertLabel} · {dateLabel(priorityAlert.created_at)}</small></span><span className={`overview-status ${priorityAlertCritical?'failed':'review'}`}>{priorityAlert.status==='open'?'Open':'In progress'}</span><ChevronRight aria-hidden/></button>:null}{actionable.map(row=><button key={row.id} onClick={()=>openEvidence(row.id)}><span><strong>{row.target}</strong><small>{row.source_kind==='website'?'Website evidence':'Release artifact'} · {dateLabel(row.created_at)}</small></span><span className={`overview-status ${resultTone(row)}`}>{resultLabel(row)}</span><ChevronRight aria-hidden/></button>)}</div>:<p className="overview-empty">{data.counts.attention?`${data.counts.attention} saved release ${data.counts.attention===1?'record needs':'records need'} review outside this returned summary.`:'No returned release records need attention.'}</p>}
   </section>
   <aside className="overview-coverage" aria-label="Coverage status"><div className="overview-section-heading"><h2>Coverage</h2><button className="overview-link" onClick={()=>go('sources',{coverageHealth:'all'})}>Review coverage<ArrowRight aria-hidden/></button></div>
    <dl><div><dt>Connected sources</dt><dd>{data.connectedCoverage?.total??0}</dd></div><div><dt>Recently checked</dt><dd>{data.connectedCoverage?.recent??0}</dd></div><div><dt>Overdue</dt><dd className={(data.connectedCoverage?.delayed??0)>0?'warn':''}>{data.connectedCoverage?.delayed??0}</dd></div><div><dt>Unknown or unavailable</dt><dd className={(data.connectedCoverage?.unknown??0)+(data.connectedCoverage?.unavailable??0)>0?'warn':''}>{(data.connectedCoverage?.unknown??0)+(data.connectedCoverage?.unavailable??0)}</dd></div></dl>
    {data.websiteCoverage?.total?<p>{data.websiteCoverage.total} production {data.websiteCoverage.total===1?'website':'websites'} configured · {data.websiteCoverage.attention} need attention.</p>:<p>Production website evidence is not configured.</p>}
   </aside>
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
