import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useState} from 'react';
import type {ScanReport} from '@/scanner/types';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {WorkspaceExceptionRequest} from './WorkspaceExceptionRequest';
type Evidence={available:true;workspaceId:string|null;report:ScanReport}|{available:false;reason:string};
export function HostedReleaseEvidence(props:{releaseId:number;receiptId:number;search:string}){
 return <ScopedEvidence key={props.releaseId} {...props}/>;
}
function ScopedEvidence({releaseId,receiptId,search}:{releaseId:number;receiptId:number;search:string}){
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
 return <section className="watch-card space-y-4" aria-label="Saved release findings"><h2 className="text-lg font-semibold">Recorded findings</h2>
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Retry evidence</Button></div>:!data?<WatchSkeleton variant="list" className="mt-4" />:!data.available?<p>{data.reason}</p>:<>
   <p className="text-sm text-mute">These are the findings saved with this receipt. Accepting risk never rewrites this result.</p>
   {data.report.findings.length?<div className="upload-evidence-grid"><div className="upload-finding-list" aria-label="Recorded findings">{data.report.findings.map((finding,i)=><button type="button" key={i} aria-pressed={index===i} onClick={()=>choose(i)}><span className={`upload-severity is-${finding.severity}`}>{finding.severity==='critical'?'Critical':'Warning'}</span><span><strong>{finding.title}</strong><code>{finding.path}</code></span></button>)}</div><div className="space-y-3">{selected?<><p className="watch-kicker">{selected.rule}</p><h3>{selected.title}</h3><code className="break-all">{selected.path}</code><p>{selected.detail}</p>{data.workspaceId?<WorkspaceExceptionRequest workspaceId={data.workspaceId} receiptId={receiptId} findingIndex={index} website={false}/>:<p>Workspace ownership is unavailable for this historical record.</p>}</>:<p>Select a recorded finding. The linked finding is unavailable.</p>}</div></div>:<p>No unsuppressed findings were recorded. This alone does not establish complete coverage.</p>}
   <details><summary>Recorded policy exceptions ({data.report.suppressed?.length??0})</summary>{data.report.suppressed?.map((entry,i)=><article key={i}><p>{entry.finding.rule} · {entry.finding.path}</p><p>{entry.reason}</p><p>Recorded by {entry.actor} · expires {entry.expiresAt}</p></article>)}</details>
  </>}
 </section>;
}
