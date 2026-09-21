import {flushSync} from 'react-dom';
import {WatchSkeleton} from '../WatchDataState';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Download, FileCheck2, X} from 'lucide-react';
import {Dialog, DialogBackdrop, DialogPanel, DialogTitle} from '@headlessui/react';
import {renderAssurancePanel} from '../../assurance/render';
import {downloadPassport,readAssuranceView} from '../../assurance/client';
import type {Assessment,AssuranceView} from '../../assurance/types';
import {ReleaseIntelligenceFromRecord} from './ReleaseIntelligencePanel';
import './release-assurance.css';
type Props={kind:'release'|'upload';recordId:number|string;evidenceId:string;onReveal?:(section:'findings'|'proof'|'controls')=>void;onAssessment?:(assessment:Assessment|null)=>void;decisionControls?:ReactNode};
export function ReleaseAssurancePanel(props:Props){return <ScopedPanel key={`${props.kind}:${props.recordId}`} {...props}/>;}
function ScopedPanel({kind,recordId,evidenceId,onAssessment,onReveal,decisionControls}:Props){
  const [view,setView]=useState<AssuranceView|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setView(null);setError('');setPending('');
    void fetch(`/api/assurance/${kind==='release'?'releases':'uploads'}/${encodeURIComponent(recordId)}`,{credentials:'same-origin',signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        if(controller.signal.aborted)return;
        if(response.status===202){onAssessment?.(null);setPending('The scan is still running. No completed review is available.');return;}
        const body=await response.json();
        if(controller.signal.aborted)return;
        if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Release assurance is unavailable.');
        const checked=readAssuranceView(body.view,recordId);
        if(!checked)throw new Error('The assurance response was incomplete or belonged to another release.');
        setView(checked);onAssessment?.(checked.assessment);
      }).catch((reason:unknown)=>{if(!controller.signal.aborted){onAssessment?.(null);setError(reason instanceof Error?reason.message:'Release assurance is unavailable.');}});
    return()=>controller.abort();
  },[kind,recordId,retry,onAssessment]);
  return <div className="release-assurance-slot">
    {!view&&!error?decisionControls:null}
    {!view&&!error&&!pending?<WatchSkeleton label="Reading this release’s saved evidence…"/>:null}
    {!view&&(error||pending)?<section className="ns-assurance" aria-label="Release assurance companion"><h2>Release assurance</h2><p role={error?'alert':'status'}>{error||pending}</p>{error||pending?<button type="button" onClick={()=>setRetry(value=>value+1)}>Retry saved evidence</button>:null}<p className="ns-assurance__muted">The original findings and controls below remain available. No passing decision is inferred from missing data.</p></section>:null}
    {/* History checks its own record access; an unavailable advisory view must not hide it.
        Explicitly pending scans still wait for completed evidence before setup is offered. */}
    {view||error?<ReleaseIntelligenceFromRecord record={{kind,id:String(recordId)}} decisionControls={decisionControls} comparisonReview={view?<ExactReleaseComparison comparison={view.comparison}/>:null} supportingReview={view?<SavedEvidenceReview view={view} kind={kind} recordId={recordId} evidenceId={evidenceId} onReveal={onReveal} onRefresh={()=>setRetry(value=>value+1)}/>:null}/>:null}
  </div>;
}

function ExactReleaseComparison({comparison}:{comparison:AssuranceView['comparison']}){
  const counts=comparison?.counts;
  return <section className="ns-exact-comparison" aria-label="Current release file comparison"><h3>What changed in this release?</h3><p className="ns-intelligence__muted">For the release displayed above. Selecting an older history record does not change this file comparison.</p>
    {comparison?.available&&counts?<><p>Compared with release {comparison.previousReleaseId}, an eligible passing reference. This does not adopt it as the stream’s approved reference.</p>
      <dl className="ns-exact-comparison__counts">{(['added','removed','changed','unchanged'] as const).map(key=><div key={key}><dt>{key[0].toUpperCase()+key.slice(1)}</dt><dd>{counts[key]}</dd></div>)}</dl>
      <p>{comparison.newFindingCount??0} new findings · {comparison.noLongerObservedCount??0} no longer observed · {comparison.newlySuppressedCount??0} newly suppressed.</p>
      <p className="ns-intelligence__muted">A missing finding alone does not prove it was fixed.</p>
      {comparison.policyChanged||comparison.engineChanged?<p className="ns-intelligence__notice">Policy or scanner context changed. Review those versions before interpreting improvements.</p>:null}
      <details><summary>Inspect recorded file changes</summary>{(['added','removed','changed'] as const).map(key=><section key={key}><h4>{key[0].toUpperCase()+key.slice(1)}</h4>{comparison.paths[key].length?<ul>{comparison.paths[key].map(path=><li key={path}><code>{path}</code></li>)}</ul>:<p>None recorded in this category.</p>}</section>)}{comparison.truncated?<p>Showing at most 50 paths per category. Counts cover the compared manifests.</p>:null}</details>
    </>:<p className="ns-exact-comparison__unavailable">{comparison?.reason||'No compatible earlier release is available for this comparison.'}</p>}
  </section>;
}

function SavedEvidenceReview({view,kind,recordId,evidenceId,onReveal,onRefresh}:Pick<Props,'kind'|'recordId'|'evidenceId'|'onReveal'>&{view:AssuranceView;onRefresh:()=>void}){
  const [open,setOpen]=useState(false);
  function review(){
    const action=view.assessment.nextAction;
    const id=kind==='release'&&['configure-delivery','verify-delivery','review-approval'].includes(action)?'release-operations-heading':evidenceId;
    flushSync(()=>{setOpen(false);onReveal?.(id==='release-operations-heading'?'controls':'findings');});
    if(id==='release-operations-heading')flushSync(()=>document.getElementById(`history-nav-${kind}-${recordId}-decisions`)?.click());
    const target=document.getElementById(id)??document.getElementById(evidenceId);
    if(target){target.setAttribute('tabindex','-1');target.focus();target.scrollIntoView({block:'start',behavior:'auto'});}
  }
  return <><section className="ns-saved-review" aria-label="Saved evidence review"><FileCheck2 size={20} aria-hidden="true"/><div><h3>Saved evidence review</h3><p>Inspect the checks, comparisons and limitations behind this release’s recorded outcome.</p></div><button type="button" onClick={()=>setOpen(true)}>Inspect review</button></section>
    <Dialog open={open} onClose={setOpen} className="ns-review-dialog"><DialogBackdrop className="ns-review-dialog__backdrop"/><div className="ns-review-dialog__position"><DialogPanel className="ns-review-dialog__panel"><div className="ns-review-dialog__heading"><DialogTitle>Saved evidence review</DialogTitle><button type="button" onClick={()=>setOpen(false)} aria-label="Close saved evidence review"><X size={18}/></button></div><div className="release-assurance-slot"><EvidenceReviewContents view={view} recordId={recordId} onReview={review} onRefresh={onRefresh}/></div></DialogPanel></div></Dialog>
  </>;
}

function EvidenceReviewContents({view,recordId,onReview,onRefresh}:{view:AssuranceView;recordId:number|string;onReview:()=>void;onRefresh:()=>void}){
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!root.current)return;
    return renderAssurancePanel(root.current,view,{review:onReview,refresh:onRefresh,exportPassport:()=>downloadPassport(view.passport,recordId)},{supporting:false});
  },[view,recordId,onReview,onRefresh]);
  return <div ref={root}/>;
}

/** Download from a freshly authorized, record-bound view; never a cached neighboring release. */
export function ReleasePassportDownload({kind,recordId}:Pick<Props,'kind'|'recordId'>){
  return <PassportDownload key={`${kind}:${recordId}`} kind={kind} recordId={recordId}/>;
}
function PassportDownload({kind,recordId}:Pick<Props,'kind'|'recordId'>){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function download(){
    if(busy)return;
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/assurance/${kind==='release'?'releases':'uploads'}/${encodeURIComponent(recordId)}`,{credentials:'same-origin',signal:controller.signal,cache:'no-store'});
      if(response.status===202)throw new Error('The scan is still running. No completed passport is available.');
      const body=await response.json();
      if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'The private passport is unavailable.');
      const checked=readAssuranceView(body.view,recordId);
      if(!checked)throw new Error('The passport response did not match this release.');
      if(!controller.signal.aborted)downloadPassport(checked.passport,recordId);
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'The private passport is unavailable.');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="release-passport-download"><button type="button" disabled={busy} onClick={()=>void download()}><Download size={15} aria-hidden="true"/>{busy?'Preparing passport…':'Export private passport'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
