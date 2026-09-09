import {ArrowLeft,ArrowRight,AlertTriangle,Clock3,Download,FileCheck2,ShieldCheck} from 'lucide-react';
import {useCallback,useRef,useState} from 'react';
import type {Assessment} from '@/assurance/types';
import {ProofSharing} from './ProofSharing';
import {ReleaseAssurancePanel} from './ReleaseAssurancePanel';
import {WorkspaceExceptionRequest} from './WorkspaceExceptionRequest';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {downloadUploadedRecord,findingCategory,uploadedReleaseDecision,type EvidenceCategory,type UploadedRelease} from '@/watch/uploaded-release';

export function UploadedReleaseBrief({upload,search,onBack,onNewScan}:{upload:UploadedRelease;search:string;onBack:()=>void;onNewScan:()=>void}){
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
  function jumpTo(target:HTMLElement|null){
    target?.focus();target?.scrollIntoView({block:'start',behavior:'auto'});
  }
  function choose(key:'uploadTab'|'uploadFinding',value:string){
    const next=new URLSearchParams(search);next.set(key,value);
    if(key==='uploadTab')next.delete('uploadFinding');
    navigate(`/watch/releases?${next}`);
  }
  function review(){
    const next=new URLSearchParams(search);next.delete('uploadFinding');next.delete('uploadTab');
    navigate(`/watch/releases?${next}`);evidenceHeading.current?.focus();
  }
  function verifyRecord(){
    const next=new URLSearchParams();
    for(const key of ['workspace','install']){const value=params.get(key);if(value)next.set(key,value);}
    next.set('mode','receipt');navigate(`/watch/scan?${next}`);
  }
  return <section className="watch-release-brief upload-readiness" aria-labelledby="uploaded-brief-title">
    <button className="watch-release-back" type="button" onClick={onBack}><ArrowLeft className="size-4" aria-hidden/>All releases</button>
    <header className="watch-release-heading"><div><span className="watch-kicker">Release readiness brief</span><h1 id="uploaded-brief-title">{upload.target}</h1><p>{website?'Website check':'Packed artifact'} · {new Date(upload.created_at).toLocaleString()} · {upload.installation_id?'GitHub-connected workspace':'Workspace evidence'}</p></div>
      {upload.receipt_json!=null?<Button variant="outline" onClick={()=>downloadUploadedRecord(upload)}><Download className="size-4" aria-hidden/>Signed scan record</Button>:null}
    </header>
    <nav aria-label="In this release" className="mt-5 flex flex-wrap gap-x-5 border-b border-white/10 text-sm text-mute">
      <button type="button" className="min-h-11 hover:text-snow" onClick={()=>jumpTo(evidenceHeading.current)}>Findings</button>
      {report?<button type="button" className="min-h-11 hover:text-snow" onClick={()=>jumpTo(toolsHeading.current)}>Release tools</button>:null}
      <button type="button" className="min-h-11 hover:text-snow" onClick={()=>jumpTo(artifactDetails.current)}>Artifact details</button>
      {upload.receipt_json!=null?<button type="button" className="min-h-11 hover:text-snow" onClick={()=>jumpTo(proofSection.current)}>Proof sharing</button>:null}
    </nav>
    <div className="watch-release-decision-grid">
      <article className={`watch-release-decision is-${decision.tone}`}>
        <div className="watch-release-verdict-icon">{decision.tone==='blocked'?<AlertTriangle aria-hidden/>:decision.tone==='ready'?<ShieldCheck aria-hidden/>:<Clock3 aria-hidden/>}</div>
        <div><span className="watch-kicker">{website?'Website decision':'Artifact decision'}</span><h2>{decision.title}</h2><p>{decision.detail}</p>
          {report?<Button onClick={review}>Review evidence <ArrowRight className="size-4" aria-hidden/></Button>:upload.status==='failed'?<Button disabled={website&&!upload.workspace_id} onClick={nextAttempt}>{retryLabel}</Button>:null}
        </div>
        <div className="upload-scope-mark"><FileCheck2 aria-hidden/><strong>{website?'Website':'Artifact'}</strong><span>Scoped check</span></div>
      </article>
      <aside className="watch-release-evidence-summary"><div className="watch-release-card-title"><span className="watch-kicker">Provenance</span></div><dl>
        <div><dt>Scan state</dt><dd>{decision.verdict}</dd></div>
        <div><dt>Checked</dt><dd>{report?.scannedAt?new Date(report.scannedAt).toLocaleString():'Not completed'}</dd></div>
        <div><dt>Engine</dt><dd>{report?.engineVersion??'Not recorded'}</dd></div>
        <div><dt>Policy fingerprint</dt><dd>{report?.policyHash??'No custom policy fingerprint recorded'}</dd></div>
      </dl></aside>
    </div>
    <div className="upload-scope-note"><strong>Recorded scope</strong><p>{website?'Evidence covers only the public assets retrieved during this bounded website check. It does not establish complete site coverage, repository visibility, private map custody or release approval.':<>{report?'Evidence is limited to the recorded artifact inspection.':'No completed artifact evidence is available yet.'} Repository visibility, production assets, private map custody and release approval are separate checks; this upload does not establish them.</>}</p></div>
    <section className="upload-evidence" aria-labelledby="upload-evidence-title">
      <div className="watch-release-section-heading"><div><span className="watch-kicker">Evidence workspace</span><h2 ref={evidenceHeading} tabIndex={-1} id="upload-evidence-title">Findings and next steps</h2></div><span>{report?`${report.fileCount} files inspected`:'Waiting for completed evidence'}</span></div>
      <div className="upload-evidence-tabs" role="tablist" aria-label="Finding category">
        {categories.map(([id,label])=><button type="button" key={id} role="tab" aria-selected={category===id} tabIndex={category===id?0:-1} onClick={()=>choose('uploadTab',id)} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
          const tabs=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index=tabs.indexOf(event.currentTarget),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
          tabs[next].focus();tabs[next].click();
        }}>{label}<span>{id==='all'?findings.length:findings.filter(({finding})=>findingCategory(finding)===id).length}</span></button>)}
      </div>
      <div className="upload-evidence-grid"><div className="upload-finding-list" aria-label="Recorded findings">
        {!visible.length?<div className="upload-evidence-empty">{!report?'Findings are unavailable until this check completes.':findings.length?'No findings in this category.':decision.tone==='ready'?'No unsuppressed findings in the completed artifact check.':'No findings were recorded. This does not establish a passing decision.'}</div>:visible.map(({finding,index})=><button key={index} type="button" aria-pressed={selected?.index===index} onClick={()=>choose('uploadFinding',String(index))}><span className={`upload-severity is-${finding.severity}`}>{finding.severity==='critical'?'Critical':'Warning'}</span><span><strong>{finding.title}</strong><code>{finding.path}</code></span><ArrowRight className="size-4" aria-hidden/></button>)}
      </div><aside className="upload-evidence-panel" aria-live="polite">
        {selected?<><span className="watch-kicker">{selected.finding.rule} · Recorded evidence</span><h3>{selected.finding.title}</h3><code>{selected.finding.path}</code><p>{selected.finding.detail}</p>
          <div className="upload-next-step"><strong>Next step</strong><p>{website?'Review the publicly served asset, address or explicitly assess the exposure, then run another website check from Coverage.':'Review this file in the release build, address or explicitly assess the exposure, then upload the rebuilt artifact.'} A new scan records a new decision; it does not rewrite this evidence.</p><Button variant="outline" disabled={website&&!upload.workspace_id} onClick={nextAttempt}>{retryLabel} <ArrowRight className="size-4" aria-hidden/></Button></div>
          {upload.workspace_id&&upload.status==='done'?<WorkspaceExceptionRequest workspaceId={upload.workspace_id} attemptId={upload.id} findingIndex={selected.index} website={website}/>:null}
        </>:<><h3>{selectedParam!==null?'Finding unavailable in this view':report&&findings.length===0?'No findings to review':'Select a finding'}</h3><p>{selectedParam!==null?'Choose a recorded finding from this release.':report&&findings.length===0?decision.tone==='ready'?'No unsuppressed findings were recorded in this completed check. Its decision applies only to the recorded scope.':'No findings were recorded. This does not establish a passing decision; review the check status and limitations.':'Details, the affected file and the next step appear here. No evidence is invented for an empty result.'}</p></>}
      </aside></div>
    </section>
    <section ref={artifactDetails} tabIndex={-1} className="upload-record-details" aria-label="Artifact record">
      <details><summary>Artifact identity and scope</summary><dl><dt>SHA-256</dt><dd><code>{upload.artifact_sha256}</code></dd><dt>Record ID</dt><dd>{upload.id}</dd><dt>Recorded size</dt><dd>{report?.artifactBytes!=null?`${report.artifactBytes.toLocaleString()} bytes`:'Not recorded'}</dd><dt>Format</dt><dd>{report?.kind??'Not recorded'}</dd></dl></details>
      <details><summary>Policy exceptions ({report?.suppressed?.length??0})</summary>{report?.suppressed?.length?report.suppressed.map((entry,index)=><article key={index}><h3>{entry.finding.title}</h3><code>{entry.finding.path}</code><p>{entry.reason}</p><p>Recorded by {entry.actor} · expires {entry.expiresAt}</p></article>):<p>No exceptions are recorded on this scan.</p>}</details>
      <details><summary>Inspected file manifest ({report?.manifest?.length??0})</summary>{report?.manifest?.length?<div className="upload-manifest"><table><thead><tr><th>File</th><th>Bytes</th><th>SHA-256</th></tr></thead><tbody>{report.manifest.map(file=><tr key={file.path}><td>{file.path}</td><td>{file.size.toLocaleString()}</td><td><code>{file.sha256}</code></td></tr>)}</tbody></table></div>:<p>No manifest is available for this result.</p>}</details>
    </section>
    {report?<section aria-label="Release tools" className="mt-6"><h2 ref={toolsHeading} tabIndex={-1} className="font-display text-xl text-snow">Release tools</h2><ReleaseAssurancePanel kind="upload" recordId={upload.id} evidenceId="upload-evidence-title" onAssessment={onAssessment}/></section>:null}
    <section ref={proofSection} tabIndex={-1} aria-label="Release proof" className="upload-proof-note"><p>A signed scan record preserves the decision and scope. A valid signature does not mean the artifact passed. Downloading it does not publish a public verification page.</p>{upload.receipt_json!=null?<><p>The downloaded JSON may contain file names and evidence metadata; review it before sharing.</p><Button variant="outline" onClick={verifyRecord}>Verify a downloaded record</Button><ProofSharing key={upload.id} uploadId={upload.id}/></>:null}</section>
  </section>;
}
