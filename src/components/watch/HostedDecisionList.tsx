import {WatchPageHeader} from './WatchPageHeader';
import {QuietEmptyState} from './design/QuietComponents';
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import type {ReleaseRevision} from '@/watch/types';
import {buildReleaseBriefModel} from '@/watch/release-brief';
const decisionLabels:Record<string,string>={all:'All connected revisions',passed:'Recorded scan passed',attention:'Other scan outcomes'};
export function HostedDecisionList({search}:{search:string}){
 const params=new URLSearchParams(search),decision=params.get('hostedDecision')??'all',install=params.get('install'),workspace=params.get('workspace')??'',before=params.get('before');
 const [rows,setRows]=useState<ReleaseRevision[]|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [context,setContext]=useState<{workspaceName:string;connectionName:string}|null>(null);
 useEffect(()=>{const controller=new AbortController();setRows(null);setError('');void(async()=>{try{
  const query=new URLSearchParams({installationId:install??'',hostedDecision:decision,workspace});if(before)query.set('before',before);
  const response=await fetch(`/api/releases?${query}`,{signal:controller.signal});const body=await response.json();
  if(!response.ok||!Array.isArray(body.releases))throw new Error('Release decisions could not be loaded.');
  if(!controller.signal.aborted){setRows(body.releases);setContext(body.context??null);}
 }catch{if(!controller.signal.aborted)setError('Release decisions could not be loaded.');}})();return()=>controller.abort();},[install,workspace,decision,before,retry]);
 function href(extra:Record<string,string>){return `/watch/releases?${new URLSearchParams({workspace,install:install??'',hostedDecision:decision,...extra})}`;}
 return <section className="watch-release-index" aria-label="Connected release decisions"><WatchPageHeader kicker={context?`${context.workspaceName} / ${context.connectionName}`:'Connected release evidence'} title={decisionLabels[decision]??decisionLabels.all} lede="Scan outcomes recorded for this connection. Uploaded artifacts have their own history." action={<Button variant="outline" onClick={()=>navigate(`/watch/releases?${new URLSearchParams({workspace,install:install??'',releaseView:'attempts'})}`)}>View uploaded scans</Button>}/><div className="flex flex-wrap gap-2 my-6" role="group" aria-label="Connected scan outcome">{['all','passed','attention'].map(value=><Button key={value} variant={decision===value?"default":"outline"} aria-pressed={decision===value} onClick={()=>navigate(href({hostedDecision:value}))}>{decisionLabels[value]}</Button>)}</div>
 {error?<p role="alert">{error} <Button onClick={()=>setRetry(value=>value+1)}>Retry</Button></p>:!rows?<WatchSkeleton variant="list" className="mt-4" />:rows.length?<section className="watch-release-list"><ol>{rows.map(row=><li key={row.id}><button type="button" onClick={()=>navigate(`/watch/releases?${new URLSearchParams({workspace,install:install??'',release:String(row.id)})}`)}><span className="watch-release-list-copy"><strong>{row.coordinate}</strong><small>{row.channel} · {row.sourceRevision??row.artifactSha256?.slice(0,12)} · {new Date(row.createdAt).toLocaleString()}</small></span><span className={`watch-release-list-status is-${buildReleaseBriefModel(row).status}`}>{buildReleaseBriefModel(row).title}</span></button></li>)}</ol></section>:<div role="status"><QuietEmptyState title="No connected revisions match this decision."><p>{decision==='all'?'No connected release evidence is available in this view. Uploaded scans are recorded separately.':'Choose All connected revisions to see other recorded outcomes for this connection.'}</p></QuietEmptyState></div>}
 {rows?.length===50?<Button onClick={()=>navigate(href({before:String(rows[rows.length-1].id)}))}>Older decisions</Button>:null}{before?<Button onClick={()=>navigate(href({}))}>Newest decisions</Button>:null}
 </section>;
}
