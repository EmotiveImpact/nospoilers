import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogBackdrop,DialogPanel,DialogTitle} from '@headlessui/react';
import {Share2} from 'lucide-react';
import {Button} from '@/components/ui/button';

type Preview={artifactSha256:string;scannedAt:string;status:string;policyPassed:boolean;findingCount:number;maxSeverity:string|null;assurance:string};
type Sharing={preview:Preview|null;active:unknown;canPublish:boolean};
export function ProofSharing({uploadId}:{uploadId:string}){
 return <ScopedProofSharing key={uploadId} uploadId={uploadId}/>;
}
function ScopedProofSharing({uploadId}:{uploadId:string}){
 const [data,setData]=useState<Sharing|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[href,setHref]=useState('');
 const [review,setReview]=useState<'publish'|'replace'|'revoke'|null>(null);
 const [retry,setRetry]=useState(0);
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>()=>mutation.current?.abort(),[]);
 const endpoint=`/api/uploads/${encodeURIComponent(uploadId)}/sharing`;
 useEffect(()=>{
  const controller=new AbortController();setData(null);setReview(null);setError('');
  fetch(endpoint,{signal:controller.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{
   if(response.status===404)return null;
   if(!response.ok)throw new Error('Sharing controls could not be loaded.');
   return response.json() as Promise<Sharing>;
  }).then(result=>{if(!controller.signal.aborted){setData(result);setError('');}}).catch(reason=>{if(!controller.signal.aborted){setData(null);setHref('');setError(reason instanceof Error?reason.message:'Sharing controls could not be loaded.');}});
  return()=>controller.abort();
 },[endpoint,retry]);
 async function change(method:'POST'|'DELETE'){
  if(busy||mutation.current||!data||error||(method==='POST'?!data.canPublish:!data.active))return;
  const controller=new AbortController();mutation.current=controller;
  setBusy(true);setError('');setHref('');
  try{
   const response=await fetch(endpoint,{method,signal:controller.signal,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify({confirm:true}):undefined});
   const result=await response.json();if(controller.signal.aborted)return;
   if(!response.ok)throw new Error(result.error||'Sharing could not be updated.');
   if(method==='POST'&&(typeof result.token!=='string'||!result.token))throw new Error('The public link was not returned. Reload to check sharing status.');
   const refreshed=await fetch(endpoint,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});
   if(!refreshed.ok)throw new Error('Reload to check sharing status.');
   const latest=await refreshed.json();if(controller.signal.aborted)return;
   setData(latest);setHref(method==='POST'?`${location.origin}/api/public/upload-proofs/${encodeURIComponent(result.token)}`:'');setReview(null);
  }catch(reason){if(!controller.signal.aborted){setData(null);setReview(null);setHref('');setError(reason instanceof Error?reason.message:'Sharing could not be updated.');}}
  finally{if(mutation.current===controller)mutation.current=null;if(!controller.signal.aborted)setBusy(false);}
 }
 if(!data&&!error)return null;
 return <section aria-label="Proof sharing" className="proof-sharing">
  <header className="journey-proof-header"><span className="journey-proof-icon"><Share2 aria-hidden/></span><div><h3>Public proof summary</h3><p>{data?.active?'Public link active':'Private · no active public link'}</p></div></header>
  <p>Anyone with the published link can read the summary. Paths, findings, package names and the original signed receipt stay private.</p>
  {error&&<div><p role="alert">{error}</p><Button variant="outline" disabled={busy} onClick={()=>setRetry(value=>value+1)}>Retry sharing status</Button></div>}
  {data?.preview&&<><p className="text-xs text-mute">What will be shared</p><dl className="proof-sharing-facts"><div><dt>Decision</dt><dd>{data.preview.status}</dd></div><div><dt>Finding count / highest severity</dt><dd>{data.preview.findingCount} · {data.preview.maxSeverity??'None'}</dd></div><div><dt>Recorded scan</dt><dd>{new Date(data.preview.scannedAt).toLocaleString()}</dd></div><div><dt>Artifact SHA-256</dt><dd><code>{data.preview.artifactSha256}</code></dd></div></dl></>}
  {data&&<div className="flex flex-wrap gap-3"><Button disabled={busy||!data.canPublish||!data.preview} onClick={()=>setReview(data.active?'replace':'publish')}>{data.active?'Replace public link':'Review & publish'}</Button>{!!data.active&&<Button variant="outline" disabled={busy} onClick={()=>setReview('revoke')}>Revoke public link</Button>}</div>}
  {data&&!data.canPublish?<p>This record cannot be published in its current workspace state. An existing public link can still be revoked.</p>:null}
  <p>A recorded summary, not independent signature verification. Revocation stops future access, not copies already saved.</p>
  {href&&<p role="status" className="text-sm break-all">Save this link now; it is only shown once. <a href={href} target="_blank" rel="noreferrer">{href}</a></p>}
  <Dialog open={review!==null} onClose={()=>{if(!busy)setReview(null);}} className="release-workspace-dialog"><DialogBackdrop className="release-workspace-backdrop"/><div className="release-workspace-dialog-position"><DialogPanel className="release-workspace-dialog-panel">
   <DialogTitle>{review==='revoke'?'Revoke public link':review==='replace'?'Replace public link':'Review public summary'}</DialogTitle>
   {review==='revoke'?<p>Revocation prevents future access through this link. It cannot retract copies already saved. Your original signed record stays private and unchanged.</p>:<><p>Publishing makes the outcome, finding count, highest severity, scan timestamp and artifact digest available to anyone with the link. Paths, finding details and the signed receipt are not shared.</p>{review==='replace'?<p>The previous public link will stop working. Saved copies cannot be withdrawn.</p>:null}<p>Recorded outcome: <strong>{data?.preview?.status}</strong> · {data?.preview?.findingCount} findings. Publication does not turn a failed or inconclusive scan into a passing result.</p></>}
   <div className="release-workspace-dialog-actions"><Button disabled={busy} onClick={()=>void change(review==='revoke'?'DELETE':'POST')}>{busy?'Saving…':review==='revoke'?'Revoke link':review==='replace'?'Replace link':'Publish summary'}</Button><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Cancel</Button></div>
  </DialogPanel></div></Dialog>
 </section>;
}
