import './design/release-journey.css';
import { EvidenceTable } from './design/EvidenceTable';
import {ArrowLeft,ArrowRight,Clock3,Download,FileCheck2,ShieldCheck,ExternalLink} from 'lucide-react';
import {useCallback,useId,useRef,useState} from 'react';
import './release-responsive.css';
import type {Assessment} from '@/assurance/types';
import {ProofSharing} from './ProofSharing';
import {ReleaseAssurancePanel,ReleasePassportDownload} from './ReleaseAssurancePanel';
import {ReleaseWorkspaceSummary} from './ReleaseWorkspaceSummary';
import type {ReleaseWorkspaceState} from './ReleaseWorkspaceSummary';
import {Dialog,DialogBackdrop,DialogPanel,DialogTitle} from '@headlessui/react';
import {WorkspaceExceptionRequest} from './WorkspaceExceptionRequest';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {downloadUploadedRecord,findingCategory,uploadedReleaseDecision,type EvidenceCategory,type UploadedRelease} from '@/watch/uploaded-release';

export function UploadedReleaseBrief({upload,search,onBack,onNewScan}:{upload:UploadedRelease;search:string;onBack:()=>void;onNewScan:()=>void}){
  return <UploadedReleaseWorkspace key={upload.id} upload={upload} search={search} onBack={onBack} onNewScan={onNewScan}/>;
}
function UploadedReleaseWorkspace({upload,search,onBack,onNewScan}:{upload:UploadedRelease;search:string;onBack:()=>void;onNewScan:()=>void}){
  const categoryId=useId();
  const [inspectedFile,setInspectedFile]=useState<string|null>(null);
  const [view,setView]=useState('findings');
  const [observed,setObserved]=useState<{record:UploadedRelease;assessment:Assessment|null}|null>(null);
  const onAssessment=useCallback((assessment:Assessment|null)=>setObserved({record:upload,assessment}),[upload]);
  const candidate=observed?.record===upload?observed.assessment:upload.readiness;
  const assessment=candidate?.version===1&&candidate.releaseId===upload.id&&!candidate.preview?candidate:undefined;
  const decision=uploadedReleaseDecision({...upload,readiness:assessment}),report=upload.report_json;
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
  const availableCategories=categories.filter(([id])=>id==='all'||id===category||findings.some(({finding})=>findingCategory(finding)===id));
  const showCategories=new Set(findings.map(({finding})=>findingCategory(finding))).size>1||category!=='all';
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
  const states:ReleaseWorkspaceState[]=[
    ['scan','Artifact inspection'],['attestations','Source identity'],['delivery','Production delivery'],['governance','Release approval'],
  ].map(([key,label])=>{
    const check=assessment?.checks.find(item=>item.id===key),state=check?.state??'unknown';
    const status=state==='passed'?'Recorded pass':state==='failed'?'Needs action':state==='review'?'Review evidence':state==='stale'?'Stale observation':state==='not-configured'?(key==='attestations'?(website?'No source attestation':'Direct upload · no attestation'):key==='delivery'?'Not observed':key==='governance'?'No decision recorded':'Not configured'):'Unknown';
    return {key,label,status,detail:check?.detail??'A verified assessment is not available for this evidence. The saved job status alone does not establish a pass.',tone:state==='not-configured'&&key==='delivery'?'waiting':state};
  });
  const manifestFile=report?.manifest?.find(file=>file.path===inspectedFile);
  const selectedGuidance=selected?.finding.rule==='MAP-001'?'Exclude this map from the release archive. Keep any private debugging copy outside the files sent to customers.':selected?.finding.rule==='MAP-003'?'Remove the sourceMappingURL reference from the release bundle and exclude public source maps. Scan the rebuilt archive to verify the change.':selected?.finding.rule==='MAP-002'?'Remove the embedded original source from the shipped map, or keep the map outside the released artifact. Verify the rebuilt bytes.':website?'Review the publicly served asset, address or explicitly assess the exposure, then run another website check from Coverage.':'Review this file in the release build, address or explicitly assess the exposure, then upload the rebuilt artifact.';
  return <section className="watch-release-brief upload-readiness release-workspace" aria-labelledby="uploaded-brief-title">
    <button className="watch-release-back" type="button" onClick={onBack}><ArrowLeft className="size-4" aria-hidden/>All releases</button>
    <header className="watch-release-heading journey-result-heading"><div><h1 id="uploaded-brief-title">{upload.target}</h1><p>{website?'Website check':'Uploaded artifact'} · Saved release evidence</p></div>{upload.receipt_json!=null?<Button variant="outline" onClick={()=>downloadUploadedRecord(upload)}><Download className="size-4" aria-hidden/>Receipt JSON</Button>:null}</header>
    <div className="journey-result-metadata"><span><Clock3 aria-hidden/>{new Date(upload.created_at).toLocaleString()}</span><span><FileCheck2 aria-hidden/>{report?`${report.fileCount} files inspected`:'Inspection not completed'}</span></div>
    <ReleaseWorkspaceSummary title={decision.title} detail={decision.detail} tone={decision.tone} findingCount={report?findings.length:undefined} states={states} scope={website?'Evidence covers the public assets retrieved in this bounded website check. It does not prove build-to-production parity.':'Artifact evidence only. Source identity, production delivery and release approval are separate checks.'}/>
    <nav aria-label="In this release" className="journey-release-tabs" role="tablist" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const i=tabs.indexOf(event.target as HTMLButtonElement);if(i<0)return;event.preventDefault();const n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();}}>
      {(['findings','files','history','proof'] as const).map(tab=><button key={tab} role="tab" id={`${categoryId}-view-${tab}`} aria-controls={`${categoryId}-view-panel`} aria-selected={view===tab} tabIndex={view===tab?0:-1} onClick={()=>setView(tab)}>{tab==='findings'?`Findings ${findings.length}`:tab==='files'?'Files':tab==='history'?'History':'Proof'}</button>)}
    </nav>
    <div role="tabpanel" id={`${categoryId}-view-panel`} aria-labelledby={`${categoryId}-view-${view}`}>
    <div hidden={view!=='findings'}>
    <section className="upload-evidence" aria-labelledby="upload-evidence-title">

      {showCategories?<div className="upload-evidence-tabs" role="tablist" aria-label="Finding category">
        {availableCategories.map(([id,label])=><button type="button" key={id} id={`${categoryId}-${id}`} role="tab" aria-controls={`${categoryId}-panel`} aria-selected={category===id} tabIndex={category===id?0:-1} onClick={()=>choose('uploadTab',id)} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
          const tabs=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index=tabs.indexOf(event.currentTarget),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
          tabs[next].focus();tabs[next].click();
        }}>{label}<span>{id==='all'?findings.length:findings.filter(({finding})=>findingCategory(finding)===id).length}</span></button>)}
      </div>:null}
      <div className="upload-evidence-grid" role={showCategories?"tabpanel":undefined} id={`${categoryId}-panel`} aria-labelledby={showCategories?`${categoryId}-${category}`:undefined}><div className="upload-finding-list" aria-label="Recorded findings"><h2 ref={evidenceHeading} tabIndex={-1} id="upload-evidence-title">Findings <span>{findings.length}</span></h2>
        {!visible.length?<div className="upload-evidence-empty">{!report?'Findings are unavailable until this check completes.':findings.length?'No findings in this category.':decision.tone==='ready'?'No unsuppressed findings in the completed artifact check.':'No findings were recorded. This does not establish a passing decision.'}</div>:visible.map(({finding,index})=><button key={index} type="button" aria-pressed={selected?.index===index} onClick={()=>choose('uploadFinding',String(index))}><span className={`upload-severity is-${finding.severity}`}>{finding.severity==='critical'?'Critical':'Warning'}</span><span><strong>{finding.title}</strong><code>{finding.path}</code></span><ArrowRight className="size-4" aria-hidden/></button>)}
      </div><aside className="upload-evidence-panel" aria-live="polite">
        {selected?<><span className={`release-finding-kind is-${selected.finding.severity}`}>{selected.finding.severity==='critical'?'Critical':'Warning'} · {categories.find(([id])=>id===findingCategory(selected.finding))?.[1]}</span><h3>{selected.finding.title}</h3><span className="sr-only">Affected file</span><code>{selected.finding.path}</code>
          <div className="journey-finding-explanation"><section><h4>Why it matters</h4><p>{selected.finding.detail}</p></section><section><h4>What to change</h4><p>{selectedGuidance}</p></section></div>
          <div className="upload-next-step"><Button disabled={website&&!upload.workspace_id} onClick={nextAttempt}>{retryLabel} <ArrowRight className="size-4" aria-hidden/></Button><p>Original evidence is preserved. A new scan records a new decision; a note alone does not verify a fix.</p></div>
          {upload.workspace_id&&upload.status==='done'?<WorkspaceExceptionRequest workspaceId={upload.workspace_id} attemptId={upload.id} findingIndex={selected.index} website={website}/>:null}
        </>:<><h3>{selectedParam!==null?'Finding unavailable in this view':report&&findings.length===0?'No findings to review':'Select a finding'}</h3><p>{selectedParam!==null?'Choose a recorded finding from this release.':report&&findings.length===0?decision.tone==='ready'?'No unsuppressed findings were recorded in this completed check. Its decision applies only to the recorded scope.':'No findings were recorded. This does not establish a passing decision; review the check status and limitations.':'Details, the affected file and the next step appear here. No evidence is invented for an empty result.'}</p></>}
      </aside></div>
    </section>
    </div><div hidden={view!=='files'}>
    <section ref={artifactDetails} tabIndex={-1} className="upload-record-details" aria-label="Artifact record">
      <header className="release-section-heading"><div><h2>Artifact identity &amp; files</h2><p>Exact bytes and checks recorded with this scan.</p></div><span className="text-xs text-mute">{report?.manifest?.length??0} inspected files</span></header>
      <section className="journey-artifact-identity"><h2 className="sr-only">Artifact identity and scope</h2><dl><div><dt>Format</dt><dd>{report?.kind??'Not recorded'}</dd></div><div><dt>Archive size</dt><dd>{report?.artifactBytes!=null?`${report.artifactBytes.toLocaleString()} bytes`:'Not recorded'}</dd></div><div><dt>Record ID</dt><dd>{upload.id}</dd></div><div className="release-identity-wide"><dt>Artifact SHA-256</dt><dd><code>{upload.artifact_sha256||'Not recorded'}</code></dd></div></dl></section>
      <section><h2 className="sr-only">Inspected file manifest ({report?.manifest?.length??0})</h2>{report?.manifest?.length?<div className="upload-manifest"><EvidenceTable caption="Inspected artifact file manifest"><thead><tr><th scope="col">File</th><th scope="col">Bytes</th><th scope="col">SHA-256</th></tr></thead><tbody>{report.manifest.map(file=><tr key={file.path}><td><button className="release-file-inspect" type="button" onClick={()=>setInspectedFile(file.path)} aria-label={`Inspect ${file.path}`}>{file.path}<ExternalLink aria-hidden/></button></td><td>{file.size.toLocaleString()}</td><td><code>{file.sha256}</code></td></tr>)}</tbody></EvidenceTable></div>:<p>No manifest is available for this result.</p>}</section>
      <section className="release-exceptions"><h3>Recorded policy exceptions ({report?.suppressed?.length??0})</h3>{report?.suppressed?.length?report.suppressed.map((entry,index)=><article key={index}><h4>{entry.finding.title}</h4><code>{entry.finding.path}</code><p>{entry.reason}</p><p>Recorded by {entry.actor} · expires {entry.expiresAt}</p></article>):<p>No exceptions are recorded on this scan. A later exception does not rewrite this record.</p>}{findings.length?<Button variant="outline" onClick={()=>setView('findings')}>Review findings &amp; request an exception</Button>:null}</section>
    </section>
    </div><div hidden={view!=='history'}>
    {report?<section aria-label="Release tools" className="journey-history-tools"><h2 ref={toolsHeading} tabIndex={-1} className="sr-only">Release tools</h2><ReleaseAssurancePanel kind="upload" recordId={upload.id} evidenceId="upload-evidence-title" onReveal={()=>setView('findings')} onAssessment={onAssessment}/></section>:<p>No completed scan evidence is available for release history yet.</p>}
    </div><div hidden={view!=='proof'}>
    <section ref={proofSection} tabIndex={-1} aria-label="Release proof" className="upload-proof-note journey-proof">
      <div className="journey-proof-receipt">
        <header className="journey-proof-header"><span className="journey-proof-icon"><FileCheck2 aria-hidden/></span><div><h2>Signed scan record</h2><p>The saved decision, bound to this exact artifact.</p></div></header>
        <dl className="release-receipt-facts"><div><dt>Recorded outcome</dt><dd>{report?.status??'Not available'}</dd></div><div><dt>Highest severity</dt><dd>{findings.some(({finding})=>finding.severity==='critical')?'Critical':findings.length?'Warning':report?'None recorded':'Unknown'}</dd></div><div><dt>Artifact identity</dt><dd><code>{upload.artifact_sha256||'Not recorded'}</code></dd></div></dl>
        <div className="journey-proof-actions">{upload.receipt_json!=null?<><Button variant="outline" onClick={()=>downloadUploadedRecord(upload)}><Download className="size-4" aria-hidden/>Signed scan record</Button><Button variant="outline" onClick={verifyRecord}><ShieldCheck className="size-4" aria-hidden/>Verify a downloaded record</Button></>:null}</div>
        <p>A valid signature does not mean the artifact passed. Downloading the record does not publish a public verification page.</p>
        {upload.receipt_json!=null?<p className="journey-proof-caution">The downloaded JSON may contain file names and evidence metadata; review it before sharing.</p>:null}
        {upload.receipt_json==null?<p>No signed record is available for this attempt.</p>:null}
        {report?<div className="release-private-export"><h3>Unsigned private summary</h3><p>A portable assurance passport. The original signed record remains the evidence of record.</p><ReleasePassportDownload kind="upload" recordId={upload.id}/></div>:null}
      </div>
      {upload.receipt_json!=null?<ProofSharing key={upload.id} uploadId={upload.id}/>:null}
    </section>
  </div></div>
    <Dialog open={Boolean(manifestFile)} onClose={()=>setInspectedFile(null)} className="release-workspace-dialog"><DialogBackdrop className="release-workspace-backdrop"/><div className="release-workspace-dialog-position"><DialogPanel className="release-workspace-dialog-panel"><DialogTitle>Inspected file</DialogTitle><p>{manifestFile?.path}</p><dl><div><dt>Bytes</dt><dd>{manifestFile?.size.toLocaleString()}</dd></div><div><dt>SHA-256</dt><dd><code>{manifestFile?.sha256}</code></dd></div></dl><p>{findings.filter(({finding})=>finding.path===manifestFile?.path).length} recorded findings for this path. This view shows saved metadata; source contents are not retained here.</p><div className="release-workspace-dialog-actions">{findings.some(({finding})=>finding.path===manifestFile?.path)?<Button onClick={()=>{const match=findings.find(({finding})=>finding.path===manifestFile?.path);if(match){setView('findings');const next=new URLSearchParams(search);next.set('uploadFinding',String(match.index));next.delete('uploadTab');navigate(`/watch/releases?${next}`);}setInspectedFile(null);}}>Review file findings</Button>:null}<Button variant="outline" onClick={()=>setInspectedFile(null)}>Close</Button></div></DialogPanel></div></Dialog>
  </section>;
}
