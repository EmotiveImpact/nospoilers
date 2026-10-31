import {useEffect,useState} from 'react';
import {GitPullRequest,ShieldCheck,Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';

type Verdict='confirmed'|'likely_false_positive'|'needs_human';
type ReviewedFinding={id:number;rule:string;path:string;verdict:Verdict;impact:'high'|'medium'|'low';explanation:string;fix:string};
type ReviewResult={priority:'act_now'|'fix_this_release'|'low';summary:string;attackerView:string;findings:ReviewedFinding[];surface:{kind:'route'|'flag'|'host'|'env';value:string;why:string}[];models:{tier:string;model:string;region:string}[]};
type Review={state:'queued'|'running'|'complete'|'failed'|'skipped';failure:string|null;result:ReviewResult|null};
type FixView={number:number|null;url:string|null;state:'open'|'still_present'|'verified_closed';lastCheckedTag:string|null;verifiedTag:string|null;openedBy:string};
type FixInfo={eligible:boolean;kinds:string[];unfixable:string[];fix:FixView|null;permissions:string[]};

const VERDICT:Record<Verdict,string>={confirmed:'Confirmed',likely_false_positive:'Likely false positive',needs_human:'Needs a person'};
const PRIORITY:Record<ReviewResult['priority'],string>={act_now:'Act now',fix_this_release:'Fix in this release',low:'Low priority'};
const KIND:Record<string,string>={source_maps:'public source maps',env_file:'shipped environment files',loose_files:'files that should not ship'};
const SURFACE:Record<string,string>={route:'Route',flag:'Feature flag',host:'Internal host',env:'Environment name'};

function scoped(path:string,workspaceId?:string){return workspaceId?`${path}?workspaceId=${encodeURIComponent(workspaceId)}`:path;}

export function AlertAiReview({alertId,workspaceId}:{alertId:number;workspaceId?:string}){
 const [review,setReview]=useState<Review|null|undefined>(undefined);
 const [notice,setNotice]=useState('');
 const [fix,setFix]=useState<FixInfo|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 useEffect(()=>{const controller=new AbortController();
  void fetch(scoped(`/api/alerts/${alertId}/ai-review`,workspaceId),{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');const body=await response.json() as {review:Review|null;notice:string};
   if(!controller.signal.aborted){setReview(body.review);setNotice(body.notice);}
  }).catch(()=>{if(!controller.signal.aborted)setReview(null);});
  void fetch(scoped(`/api/alerts/${alertId}/fix-pr`,workspaceId),{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');const body=await response.json() as FixInfo;
   if(!controller.signal.aborted)setFix(body);
  }).catch(()=>{if(!controller.signal.aborted)setFix(null);});
  return()=>controller.abort();
 },[alertId,workspaceId]);

 async function openFix(){
  setBusy(true);setMessage(null);
  try{
   const response=await fetch(scoped(`/api/alerts/${alertId}/fix-pr`,workspaceId),{method:'POST'});
   const body=await response.json() as {fix?:FixView;error?:string};
   if(!response.ok||!body.fix){setMessage(body.error??'The fix pull request could not be opened.');return;}
   setFix(current=>current?{...current,fix:body.fix!}:current);
  }catch{setMessage('The fix pull request could not be opened. Check your connection and try again.');}
  finally{setBusy(false);}
 }

 const result=review?.state==='complete'?review.result:null;
 return <>
  {review?<section className="alerts-journey-section mt-7" aria-label="AI release review">
   <h2 className="flex items-center gap-2 text-sm font-semibold text-snow"><Sparkles className="size-4" aria-hidden/>AI release review</h2>
   {review.state==='queued'||review.state==='running'?<p className="mt-2 text-sm text-mute">Reviewing the findings the way an attacker would. This usually takes a minute.</p>:null}
   {review.state==='failed'||review.state==='skipped'?<p className="mt-2 text-sm text-mute">{review.failure??'No AI review for this alert.'}</p>:null}
   {result?<>
    <p className="mt-3"><span className={result.priority==='act_now'?'watch-pill watch-pill-crit':result.priority==='low'?'watch-pill watch-pill-ok':'watch-pill watch-pill-warn'}>{PRIORITY[result.priority]}</span></p>
    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-snow">{result.summary}</p>
    {result.attackerView?<><h3 className="mt-5 text-sm font-semibold text-snow">What an attacker sees</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-mute">{result.attackerView}</p></>:null}
    {result.surface.length?<ul className="mt-4 space-y-2" aria-label="Exposed surface">{result.surface.map(item=><li key={`${item.kind}:${item.value}`} className="rounded-lg border border-white/10 p-3"><p className="text-xs text-mute">{SURFACE[item.kind]}</p><p className="mt-1 break-all font-mono text-xs text-snow">{item.value}</p><p className="mt-1 text-sm text-mute">{item.why}</p></li>)}</ul>:null}
    <div className="mt-5 space-y-3" aria-label="Finding second opinions">{result.findings.map(finding=><details key={finding.id} className="rounded-lg border border-white/10 p-4">
     <summary className="cursor-pointer text-sm text-snow"><span className="font-mono text-xs">{finding.rule}</span> <span className="ml-2">{VERDICT[finding.verdict]}</span><span className="ml-2 text-xs text-mute">{finding.impact} impact</span></summary>
     <p className="mt-2 break-all font-mono text-xs text-mute">{finding.path}</p>
     <p className="mt-3 text-sm leading-relaxed text-mute">{finding.explanation}</p>
     <h4 className="mt-3 text-sm font-semibold">Suggested fix</h4><p className="mt-1 text-sm leading-relaxed text-mute">{finding.fix}</p>
    </details>)}</div>
    <p className="mt-4 text-xs text-dim">{notice} Model: {result.models.map(model=>`${model.model} (${model.tier}, ${model.region.toUpperCase()})`).join(', ')}.</p>
   </>:null}
  </section>:null}
  {fix&&(fix.eligible||fix.fix)?<section className="alerts-journey-section mt-7" aria-label="Fix pull request">
   <h2 className="flex items-center gap-2 text-sm font-semibold text-snow"><GitPullRequest className="size-4" aria-hidden/>Fix pull request</h2>
   {fix.fix?<>
    {fix.fix.state==='verified_closed'?<p className="mt-2 flex items-center gap-2 text-sm text-snow"><ShieldCheck className="size-4" aria-hidden/>Verified closed. Release {fix.fix.verifiedTag} scanned without these findings.</p>
     :fix.fix.state==='still_present'?<p className="mt-2 text-sm text-mute">Release {fix.fix.lastCheckedTag} still shows these findings. Merge the pull request, publish again and NoSpoilers will check the next release.</p>
     :<p className="mt-2 text-sm text-mute">Waiting for the next release. Merge the pull request when you are happy with it; NoSpoilers marks the alert verified closed once a new release scans without these findings.</p>}
    {fix.fix.url?<a className="mt-3 inline-block text-sm underline" href={fix.fix.url} target="_blank" rel="noreferrer noopener">Open pull request #{fix.fix.number} on GitHub</a>:null}
   </>:<>
    <p className="mt-2 text-sm text-mute">NoSpoilers can open a pull request that fixes {fix.kinds.map(kind=>KIND[kind]??kind).join(', ')}. You review and merge it; it is never merged automatically.</p>
    {fix.unfixable.length?<p className="mt-2 text-xs text-dim">Not covered: {fix.unfixable.join(', ')}.</p>:null}
    <Button className="mt-4" disabled={busy} onClick={()=>{void openFix();}}><GitPullRequest className="size-4" aria-hidden/>{busy?'Opening…':'Open fix pull request'}</Button>
    <p className="mt-2 text-xs text-dim">Uses the GitHub App permissions: {fix.permissions.join('; ')}.</p>
   </>}
   {message?<p role="alert" className="mt-2 text-sm text-mute">{message}</p>:null}
  </section>:null}
 </>;
}
