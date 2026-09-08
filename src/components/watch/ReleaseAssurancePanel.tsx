import {useEffect,useRef,useState} from 'react';
import {renderAssurancePanel} from '../../assurance/render';
import {downloadPassport,readAssuranceView} from '../../assurance/client';
import type {AssuranceView} from '../../assurance/types';
import './release-assurance.css';
type Props={kind:'release'|'upload';recordId:number|string;evidenceId:string};
export function ReleaseAssurancePanel(props:Props){return <ScopedPanel key={`${props.kind}:${props.recordId}`} {...props}/>;}
function ScopedPanel({kind,recordId,evidenceId}:Props){
  const root=useRef<HTMLDivElement>(null);
  const [view,setView]=useState<AssuranceView|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setView(null);setError('');setPending('');
    void fetch(`/api/assurance/${kind==='release'?'releases':'uploads'}/${encodeURIComponent(recordId)}`,{credentials:'same-origin',signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        const body=await response.json();
        if(controller.signal.aborted)return;
        if(response.status===202){setPending('The scan is still running. No completed review is available.');return;}
        if(!response.ok)throw new Error(typeof body.error==='string'?body.error:'Release assurance is unavailable.');
        const checked=readAssuranceView(body.view,recordId);
        if(!checked)throw new Error('The assurance response was incomplete or belonged to another release.');
        setView(checked);
      }).catch((reason:unknown)=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Release assurance is unavailable.');});
    return()=>controller.abort();
  },[kind,recordId,retry]);
  useEffect(()=>{
    if(!root.current||!view)return;
    return renderAssurancePanel(root.current,view,{
      review:()=>{
        const action=view.assessment.nextAction;
        const id=kind==='release'&&['configure-delivery','verify-delivery'].includes(action)?'release-proof-delivery':kind==='release'&&action==='review-approval'?'release-operations-heading':evidenceId;
        const target=document.getElementById(id)??document.getElementById(evidenceId);
        if(target){
          if(id==='release-proof-delivery'&&target instanceof HTMLButtonElement)target.click();
          target.setAttribute('tabindex','-1');target.focus();target.scrollIntoView({block:'start',behavior:'auto'});
        }
      },
      refresh:()=>setRetry(value=>value+1),
      exportPassport:()=>downloadPassport(view.passport,recordId),
    });
  },[view,kind,recordId,evidenceId]);
  return <div className="release-assurance-slot">
    {!view?<section className="ns-assurance" aria-label="Release assurance companion" aria-busy={!error&&!pending}><h2>Release assurance</h2><p role={error?'alert':'status'}>{error||pending||'Reading this release’s saved evidence…'}</p>{error||pending?<button type="button" onClick={()=>setRetry(value=>value+1)}>Retry saved evidence</button>:null}<p className="ns-assurance__muted">The original findings and controls below remain available. No passing decision is inferred from missing data.</p></section>:null}
    <div ref={root}/>
  </div>;
}
