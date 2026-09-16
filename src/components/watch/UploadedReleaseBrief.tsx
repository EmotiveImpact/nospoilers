import './design/release-journey.css';
import { EvidenceTable } from './design/EvidenceTable';
import {ArrowLeft,ArrowRight,AlertTriangle,Clock3,Download,FileCheck2} from 'lucide-react';
import {useCallback,useId,useRef,useState} from 'react';
import './release-responsive.css';
import type {Assessment} from '@/assurance/types';
import {ProofSharing} from './ProofSharing';
import {ReleaseAssurancePanel} from './ReleaseAssurancePanel';
import {WorkspaceExceptionRequest} from './WorkspaceExceptionRequest';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {downloadUploadedRecord,findingCategory,uploadedReleaseDecision,type EvidenceCategory,type UploadedRelease} from '@/watch/uploaded-release';

export function UploadedReleaseBrief({upload,search,onBack,onNewScan}:{upload:UploadedRelease;search:string;onBack:()=>void;onNewScan:()=>void}){
  const categoryId=useId();
  const [view,setView]=useState('findings');
  const [observed,setObserved]=useState<{record:UploadedRelease;assessment:Assessment|null}|null>(null);
  const onAssessment=useCallback((assessment:Assessment|null)=>setObserved({record:upload,assessment}),[upload]);
  const decision=uploadedReleaseDecision({...upload,readiness:observed?.record===upload?observed.assessment??undefined:upload.readiness}),report=upload.report_json;
  const website=upload.source_origin_id!=null;
  const retryLabel=website?'Open website controls':'Upload a new attempt';
  function nextAttempt(){
    if(!website){onNewScan();return;}
    if(!upload.workspace_id)return;
    const next=new URLSearchParams({workspace:upload.workspace_id,configure:'website'});
    navigate(`/watch/sources?${next}`);
  }
  const params=new URLSearchParams(search);
  const categories:[EvidenceCategory,string][]=[['all','All findings'],['maps','Maps'],['secrets','Secrets'],['files','Files'],['ai','AI context']];
  const category=categories.some(([id])=>id===params.get('uploadTab'))?params.get('uploadTab') as EvidenceCategory:'all';
  const findings=(report?.findings??[]).map((finding,index)=>({finding,index}));
  const visible=findings.filter(({finding})=>category==='all'||findingCategory(finding)===category);
  const selectedParam=params.get('uploadFinding');
  const selected=selectedParam===null?visible[0]:visible.find(({index})=>String(index)===selectedParam);
  const evidenceHeading=useRef<HTMLHeadingElement>(null);
  const toolsHeading=useRef<HTMLHeadingElement>(null);
  const artifactDetails=useRef<HTMLElement>(null);
  const proofSection=useRef<HTMLElement>(null);
  function choose(key:'uploadTab'|'uploadFinding',value:string){
    const next=new URLSearchParams(search);next.set(key,value);
    if(key==='uploadTab')next.delete('uploadFinding');
    navigate(`/watch/releases?${next}`);
  }
  function verifyRecord(){
    const next=new URLSearchParams();
    for(const key of ['workspace','install']){const value=params.get(key);if(value)next.set(key,value);}
    next.set('mode','receipt');navigate(`/watch/scan?${next}`);
  }
  return <section className="watch-release-brief upload-readiness" aria-labelledby="uploaded-brief-title">
    <button className="watch-release-back" type="button" onClick={onBack}><ArrowLeft className="size-4" aria-hidden/>All releases</button>
    <header className="watch-release-heading journey-result-heading"><div><h1 id="uploaded-brief-title">{upload.target}</h1><p>{website?'Website check':'Uploaded artifact'} · Saved release evidence</p></div><Button onClick={()=>setView('history')}>Verify a fix <ArrowRight className="size-4" aria-hidden/></Button></header>
    <h2 className={`journey-result-status is-${decision.tone}`}><span aria-hidden>●</span> {decision.title}</h2>
    <div className="journey-result-metadata"><span><FileCheck2 aria-hidden/>{report?`${report.fileCount} files inspected`:'Inspection not completed'}</span><span><AlertTriangle aria-hidden/>{report?`${findings.length} findings`:'Findings unavailable'}</span><span><Clock3 aria-hidden/>{new Date(upload.created_at).toLocaleString()}</span><span>Production evidence is separate</span></div>
    <nav aria-label="In this release" className="journey-release-tabs" role="tablist" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const i=tabs.indexOf(event.target as HTMLButtonElement);if(i<0)return;event.preventDefault();const n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();}}>
      {(['findings','files','history','proof'] as const).map(tab=><button key={tab} role="tab" id={`${categoryId}-view-${tab}`} aria-controls={`${categoryId}-view-panel`} aria-selected={view===tab} tabIndex={view===tab?0:-1} onClick={()=>setView(tab)}>{tab==='findings'?`Findings ${findings.length}`:tab==='files'?'Files':tab==='history'?'History':'Proof'}</button>)}
    </nav>
    <p className="journey-release-scope">{website?'Evidence covers the public assets retrieved in this bounded website check.':report?'Repository visibility, production assets, private map custody and release approval are separate checks; this upload does not establish them.':'No completed artifact evidence is available yet.'}</p>
    <div role="tabpanel" id={`${categoryId}-view-panel`} aria-labelledby={`${categoryId}-view-${view}`}>
    <div hidden={view!=='findings'}>
    <section className="upload-evidence" aria-labelledby="upload-evidence-title">

      {findings.length>1?<div className="upload-evidence-tabs" role="tablist" aria-label="Finding category">
        {categories.map(([id,label])=><button type="button" key={id} id={`${categoryId}-${id}`} role="tab" aria-controls={`${categoryId}-panel`} aria-selected={category===id} tabIndex={category===id?0:-1} onClick={()=>choose('uploadTab',id)} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
          const tabs=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index=tabs.indexOf(event.currentTarget),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
          tabs[next].focus();tabs[next].click();
        }}>{label}<span>{id==='all'?findings.length:findings.filter(({finding})=>findingCategory(finding)===id).length}</span></button>)}
      </div>:null}
      <div className="upload-evidence-grid" role="tabpanel" id={`${categoryId}-panel`} aria-labelledby={`${categoryId}-${category}`}><div className="upload-finding-list" aria-label="Recorded findings"><h2 ref={evidenceHeading} tabIndex={-1} id="upload-evidence-title">Findings <span>{findings.length}</span></h2>
        {!visible.length?<div className="upload-evidence-empty">{!report?'Findings are unavailable until this check completes.':findings.length?'No findings in this category.':decision.tone==='ready'?'No unsuppressed findings in the completed artifact check.':'No findings were recorded. This does not establish a passing decision.'}</div>:visible.map(({finding,index})=><button key={index} type="button" aria-pressed={selected?.index===index} onClick={()=>choose('uploadFinding',String(index))}><span className={`upload-severity is-${finding.severity}`}>{finding.severity==='critical'?'Critical':'Warning'}</span><span><strong>{finding.title}</strong><code>{finding.path}</code></span><ArrowRight className="size-4" aria-hidden/></button>)}
      </div><aside className="upload-evidence-panel" aria-live="polite">
        {selected?<><h3>{selected.finding.title}</h3><div className="journey-affected-label">Affected file</div><code>{selected.finding.path}</code>
          <div className="journey-finding-explanation"><section><h4>Why it matters</h4><p>{selected.finding.detail}</p></section><section><h4>What to change</h4><p>{website?'Review the publicly served asset, address or explicitly assess the exposure, then run another website check from Coverage.':'Review this file in the release build, address or explicitly assess the exposure, then upload the rebuilt artifact.'}</p></section></div>
          <div className="upload-next-step"><Button disabled={website&&!upload.workspace_id} onClick={nextAttempt}>{retryLabel} <ArrowRight className="size-4" aria-hidden/></Button><p>Original evidence is preserved. A new scan records a new decision; a note alone does not verify a fix.</p></div>
          {upload.workspace_id&&upload.status==='done'?<WorkspaceExceptionRequest workspaceId={upload.workspace_id} attemptId={upload.id} findingIndex={selected.index} website={website}/>:null}
        </>:<><h3>{selectedParam!==null?'Finding unavailable in this view':report&&findings.length===0?'No findings to review':'Select a finding'}</h3><p>{selectedParam!==null?'Choose a recorded finding from this release.':report&&findings.length===0?decision.tone==='ready'?'No unsuppressed findings were recorded in this completed check. Its decision applies only to the recorded scope.':'No findings were recorded. This does not establish a passing decision; review the check status and limitations.':'Details, the affected file and the next step appear here. No evidence is invented for an empty result.'}</p></>}
      </aside></div>
    </section>
    </div><div hidden={view!=='files'}>
    <section ref={artifactDetails} tabIndex={-1} className="upload-record-details" aria-label="Artifact record">
      <section className="journey-artifact-identity"><h2 className="sr-only">Artifact identity and scope</h2><dl><div><dt>SHA-256</dt><dd><code>{upload.artifact_sha256||'Not recorded'}</code></dd></div><div><dt>Record ID</dt><dd>{upload.id}</dd></div><div><dt>Recorded size</dt><dd>{report?.artifactBytes!=null?`${report.artifactBytes.toLocaleString()} bytes`:'Not recorded'}</dd></div><div><dt>Format</dt><dd>{report?.kind??'Not recorded'}</dd></div></dl></section>

      <section><h2>Inspected file manifest ({report?.manifest?.length??0})</h2>{report?.manifest?.length?<div className="upload-manifest"><EvidenceTable caption="Inspected artifact file manifest"><thead><tr><th scope="col">File</th><th scope="col">Bytes</th><th scope="col">SHA-256</th></tr></thead><tbody>{report.manifest.map(file=><tr key={file.path}><td>{file.path}</td><td>{file.size.toLocaleString()}</td><td><code>{file.sha256}</code></td></tr>)}</tbody></EvidenceTable></div>:<p>No manifest is available for this result.</p>}</section>
      <details><summary>Policy exceptions ({report?.suppressed?.length??0})</summary>{report?.suppressed?.length?report.suppressed.map((entry,index)=><article key={index}><h3>{entry.finding.title}</h3><code>{entry.finding.path}</code><p>{entry.reason}</p><p>Recorded by {entry.actor} · expires {entry.expiresAt}</p></article>):<p>No exceptions are recorded on this scan.</p>}</details>
    </section>
    </div><div hidden={view!=='history'}>
    {report?<section aria-label="Release tools" className="mt-6"><h2 ref={toolsHeading} tabIndex={-1} className="font-display text-xl text-snow">Release tools</h2><ReleaseAssurancePanel kind="upload" recordId={upload.id} evidenceId="upload-evidence-title" onReveal={()=>setView('findings')} onAssessment={onAssessment}/></section>:null}
    </div><div hidden={view!=='proof'}>
    <section ref={proofSection} tabIndex={-1} aria-label="Release proof" className="upload-proof-note"><h2>Signed scan evidence</h2>{upload.receipt_json!=null?<Button variant="outline" onClick={()=>downloadUploadedRecord(upload)}><Download className="size-4" aria-hidden/>Signed scan record</Button>:null}<p>A signed scan record preserves the decision and scope. A valid signature does not mean the artifact passed. Downloading it does not publish a public verification page.</p>{upload.receipt_json!=null?<><p>The downloaded JSON may contain file names and evidence metadata; review it before sharing.</p><Button variant="outline" onClick={verifyRecord}>Verify a downloaded record</Button><ProofSharing key={upload.id} uploadId={upload.id}/></>:null}</section>
  </div></div></section>;
}
