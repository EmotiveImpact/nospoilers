import './release-responsive.css';
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import type {ScanReport} from '@/scanner/types';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {WorkspaceExceptionRequest} from './WorkspaceExceptionRequest';
import {ReleaseAssurancePanel} from './ReleaseAssurancePanel';
type Evidence={available:true;workspaceId:string|null;report:ScanReport}|{available:false;reason:string};
export function HostedReleaseEvidence(props:{releaseId:number;receiptId:number;search:string;activeSection?:string;onReveal?:(section:'findings'|'proof'|'controls')=>void;onAssessment?:(assessment:import('@/assurance/types').Assessment|null)=>void}){
 return <><div hidden={props.activeSection!=null&&!['findings','files'].includes(props.activeSection)}><ScopedEvidence key={props.releaseId} {...props}/></div><section hidden={props.activeSection!=null&&props.activeSection!=='history'} className="journey-hosted-tools"><h2>History & verify a fix</h2><ReleaseAssurancePanel kind="release" recordId={props.releaseId} evidenceId={`assurance-findings-${props.releaseId}`} onReveal={props.onReveal} onAssessment={props.onAssessment}/></section></>;
}
function ScopedEvidence({releaseId,receiptId,search,activeSection}:{releaseId:number;receiptId:number;search:string;activeSection?:string}){
 const [data,setData]=useState<Evidence|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');void fetch(`/api/releases/${releaseId}/evidence`,{signal:controller.signal}).then(async r=>{
  const body=await r.json();if(!r.ok)throw new Error(body.error??'Release evidence unavailable.');
  if(typeof body.available!=='boolean'||body.available&&!Array.isArray(body.report?.findings))throw new Error('Release evidence response was incomplete.');
  if(!controller.signal.aborted)setData(body);
 }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Release evidence unavailable.');});return()=>controller.abort();},[releaseId,retry]);
 const value=new URLSearchParams(search).get('releaseFinding');
 const index=value===null?0:/^\d+$/.test(value)?Number(value):-1;
 const selected=data?.available?data.report.findings[index]:null;
 function choose(index:number){const params=new URLSearchParams(search);params.set('releaseFinding',String(index));navigate(`${window.location.pathname}?${params}`);}
 if(activeSection==='files')return <section aria-label="Inspected release files" className="journey-hosted-files">{error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry evidence</Button></div>:!data?<WatchSkeleton variant="list"/>:!data.available?<p>{data.reason}</p>:data.report.manifest?.length?<><div className="journey-release-table-wrap"><table className="journey-release-table"><thead><tr><th scope="col">File</th><th scope="col">Size</th><th scope="col">SHA-256</th></tr></thead><tbody>{data.report.manifest.map(file=><tr key={file.path}><td><code>{file.path}</code></td><td>{file.size.toLocaleString()} bytes</td><td><code>{file.sha256}</code></td></tr>)}</tbody></table></div><p className="journey-release-scope">{data.report.fileCount} files inspected. This is the retained artifact manifest.</p></>:<p>No file manifest was retained with this release. Findings alone do not establish a complete file inventory.</p>}</section>;
 return <section id={`assurance-findings-${releaseId}`} className="watch-card hosted-release-evidence space-y-4" aria-label="Saved release findings"><h2 className="text-lg font-semibold">Recorded findings</h2>
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry evidence</Button></div>:!data?<WatchSkeleton variant="list" className="mt-4" />:!data.available?<p>{data.reason}</p>:<>
   <p className="text-sm text-mute">These are the findings saved with this receipt. Accepting risk never rewrites this result.</p>
   {data.report.findings.length?<div className="upload-evidence-grid"><div className="upload-finding-list" aria-label="Recorded findings">{data.report.findings.map((finding,i)=><button type="button" key={i} aria-pressed={index===i} onClick={()=>choose(i)}><span className={`upload-severity is-${finding.severity}`}>{finding.severity==='critical'?'Critical':'Warning'}</span><span><strong>{finding.title}</strong><code>{finding.path}</code></span></button>)}</div><aside className="upload-evidence-panel" aria-live="polite" aria-label="Selected recorded finding">{selected?<><h3>{selected.title}</h3><div className="journey-affected-label">Affected file</div><code className="break-all">{selected.path}</code><div className="journey-finding-explanation"><section><h4>Why it matters</h4><p>{selected.detail}</p></section><section><h4>What to change</h4><p>Review the affected file in the release build and address or explicitly assess the exposure. Scan a rebuilt artifact to check the finding again. The original evidence stays unchanged.</p></section></div>{data.workspaceId?<WorkspaceExceptionRequest workspaceId={data.workspaceId} receiptId={receiptId} findingIndex={index} website={false}/>:<p>Workspace ownership is unavailable for this historical record.</p>}</>:<p>Select a recorded finding. The linked finding is unavailable.</p>}</aside></div>:<p>No unsuppressed findings were recorded. This alone does not establish complete coverage.</p>}
   <details><summary>Recorded policy exceptions ({data.report.suppressed?.length??0})</summary>{data.report.suppressed?.map((entry,i)=><article key={i}><p>{entry.finding.rule} · {entry.finding.path}</p><p>{entry.reason}</p><p>Recorded by {entry.actor} · expires {entry.expiresAt}</p></article>)}</details>
  </>}
 </section>;
}
