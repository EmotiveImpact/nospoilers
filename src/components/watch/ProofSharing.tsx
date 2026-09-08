import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';

type Preview={artifactSha256:string;scannedAt:string;status:string;policyPassed:boolean;findingCount:number;maxSeverity:string|null;assurance:string};
export function ProofSharing({uploadId}:{uploadId:string}){
 return <ScopedProofSharing key={uploadId} uploadId={uploadId}/>;
}
function ScopedProofSharing({uploadId}:{uploadId:string}){
 const [data,setData]=useState<{preview:Preview|null;active:unknown;canPublish:boolean}|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[href,setHref]=useState('');
 const [retry,setRetry]=useState(0);const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const endpoint=`/api/uploads/${encodeURIComponent(uploadId)}/sharing`;
 useEffect(()=>{const controller=new AbortController();fetch(endpoint,{signal:controller.signal}).then(async response=>{
  if(response.status===404)return null;if(!response.ok)throw new Error('Sharing controls could not be loaded.');return response.json();
 }).then(result=>{if(!controller.signal.aborted){setData(result);setError('');}}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});return()=>controller.abort();},[endpoint,retry]);
 async function change(method:'POST'|'DELETE'){
  setBusy(true);setError('');try{const response=await fetch(endpoint,{method,headers:{'Content-Type':'application/json'},body:method==='POST'?JSON.stringify({confirm:true}):undefined});
   const result=await response.json();if(!alive.current)return;if(!response.ok)throw new Error(result.error||'Sharing could not be updated.');
   setHref(method==='POST'?`${location.origin}/api/public/upload-proofs/${encodeURIComponent(result.token)}`:'');
   const refreshed=await fetch(endpoint);if(!refreshed.ok)throw new Error('Reload to check sharing status.');const latest=await refreshed.json();if(alive.current)setData(latest);
  }catch(error){if(alive.current)setError(error instanceof Error?error.message:'Sharing could not be updated.');}finally{if(alive.current)setBusy(false);}
 }
 if(!data&&!error)return null;
 return <section aria-label="Proof sharing" className="rounded-lg border border-white/10 p-4 space-y-3">
  <h3>Share a redacted proof</h3><p className="text-sm text-muted-foreground">Private unless you publish. Anyone with the link can read this summary. Paths, findings, package names and the original signed receipt stay private. Revocation stops future access, not copies already saved.</p>
  {error&&<div><p role="alert">{error}</p><Button variant="outline" disabled={busy} onClick={()=>setRetry(value=>value+1)}>Retry sharing status</Button></div>}
  {data?.preview&&<dl className="text-sm space-y-1"><dt>Artifact SHA-256</dt><dd className="break-all">{data.preview.artifactSha256}</dd><dt>Recorded scan</dt><dd>{data.preview.scannedAt}</dd><dt>Decision / finding count / highest severity</dt><dd>{data.preview.status} · {data.preview.findingCount} · {data.preview.maxSeverity??'None'}</dd></dl>}
  <p className="text-sm text-muted-foreground">A recorded summary—not independent signature verification or a guarantee of security.</p>
  {data&&<div className="flex flex-wrap gap-3"><Button disabled={busy||!data.canPublish} onClick={()=>void change('POST')}>{data.active?'Replace public link':'Publish this summary'}</Button>{!!data.active&&<Button variant="outline" disabled={busy} onClick={()=>void change('DELETE')}>Revoke public link</Button>}</div>}
  {href&&<p className="text-sm break-all">Save this link now; it is only shown once. <a href={href} target="_blank" rel="noreferrer">{href}</a></p>}
 </section>;
}
