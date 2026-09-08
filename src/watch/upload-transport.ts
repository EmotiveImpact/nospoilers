/** Reports transmitted bytes, never fabricated scanner progress. */
export function uploadArtifact(file:File, installationId:string|null, onProgress:(percent:number)=>void, signal:AbortSignal,workspaceId?:string|null):Promise<Response> {
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    const abort=()=>request.abort();
    const cleanup=()=>signal.removeEventListener('abort',abort);
    const params=new URLSearchParams();if(installationId)params.set('installationId',installationId);if(workspaceId)params.set('workspaceId',workspaceId);
    request.open('POST',`/api/scan${params.size?`?${params}`:''}`);
    request.withCredentials=true;
    request.timeout=120_000;
    request.setRequestHeader('X-Filename',file.name);
    request.setRequestHeader('Idempotency-Key',crypto.randomUUID());
    request.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    request.onload=()=>{cleanup();resolve(new Response(request.responseText,{status:request.status}));};
    request.onerror=()=>{cleanup();reject(new Error('Upload connection lost. Check Releases before submitting again; the server may have received it.'));};
    request.ontimeout=()=>{cleanup();reject(new Error('Upload timed out. Check Releases before submitting again.'));};
    request.onabort=()=>{cleanup();reject(new Error('Upload stopped. If the server already received it, its scan may still appear in Releases.'));};
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){cleanup();reject(new Error('Upload stopped.'));return;}
    request.send(file);
  });
}
