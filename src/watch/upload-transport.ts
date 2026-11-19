export function scanSubmissionUrl(installationId?:string|null,workspaceId?:string|null,kind:'upload'|'claim'='upload'):string {
  const params=new URLSearchParams();
  if(installationId)params.set('installationId',installationId);
  if(workspaceId)params.set('workspaceId',workspaceId);
  return `/api/scan${kind==='claim'?'/pending':''}${params.size?`?${params}`:''}`;
}

/** Reports transmitted bytes, never fabricated scanner progress. */
export function uploadArtifact(file:File, installationId:string|null, onProgress:(percent:number)=>void, signal:AbortSignal,workspaceId?:string|null):Promise<Response> {
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    const abort=()=>request.abort();
    // Inactivity, not total duration: an 80 MiB upload on a slow link may legitimately take minutes.
    let idle:ReturnType<typeof setTimeout>|undefined,timedOut=false;
    const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>{timedOut=true;request.abort();},120_000);};
    const cleanup=()=>{clearTimeout(idle);signal.removeEventListener('abort',abort);};
    request.open('POST',scanSubmissionUrl(installationId,workspaceId));
    request.withCredentials=true;
    request.setRequestHeader('X-Filename',file.name);
    request.setRequestHeader('Idempotency-Key',crypto.randomUUID());
    request.upload.onprogress=event=>{arm();if(event.lengthComputable)onProgress(Math.round(event.loaded/event.total*100));};
    request.onload=()=>{cleanup();resolve(new Response(request.responseText,{status:request.status}));};
    request.onerror=()=>{cleanup();reject(new Error('Upload connection lost. Check Releases before submitting again; the server may have received it.'));};
    const timeout=()=>{cleanup();reject(new Error('Upload timed out. Check Releases before submitting again.'));};
    request.ontimeout=timeout;
    request.onabort=()=>{if(timedOut){timeout();return;}cleanup();reject(new Error('Upload stopped. If the server already received it, its scan may still appear in Releases.'));};
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){cleanup();reject(new Error('Upload stopped.'));return;}
    request.onprogress=arm;
    arm();
    request.send(file);
  });
}
