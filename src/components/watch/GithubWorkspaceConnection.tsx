import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';

type ConnectProps={workspaceId:string;disabledReason?:string|null;compact?:boolean};
type ExistingInstallation={installationId:number;accountLogin:string;accountType:'User'};
export function GithubWorkspaceConnect(props:ConnectProps){
 return <GithubWorkspaceConnectScope key={props.workspaceId} {...props}/>;
}
function GithubWorkspaceConnectScope({workspaceId,disabledReason,compact=false}:ConnectProps){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[existing,setExisting]=useState<ExistingInstallation[]>([]),[connectingId,setConnectingId]=useState<number|null>(null);const submitting=useRef(false);
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function start(newInstallation=false){
  if(submitting.current||disabledReason)return;submitting.current=true;setBusy(true);setError(null);
  try{
   const suffix=newInstallation?'?new=1':'';
   const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/github${suffix}`,{method:'POST'});
   const body=await response.json() as {url?:string;status?:string;installations?:ExistingInstallation[];error?:string};if(!active.current)return;
   if(!response.ok)throw new Error(body.error??'Could not start the connection.');
   if(body.status==='existing_available'&&body.installations?.length){setExisting(body.installations);return;}
   if(!body.url)throw new Error('Could not start the connection.');
   const destination=new URL(body.url);if(destination.origin!=='https://github.com')throw new Error('Unexpected connection destination.');
   window.location.assign(destination.href);
  }catch(reason){if(active.current)setError(reason instanceof Error?reason.message:'Connection unavailable.');}
  finally{submitting.current=false;if(active.current)setBusy(false);}
 }
 async function connectExisting(installationId:number){
  if(submitting.current||disabledReason)return;submitting.current=true;setConnectingId(installationId);setError(null);
  try{
   const response=await fetch('/api/github/connection/existing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({installationId})});
   const body=await response.json() as {status?:string;workspaceId?:string;error?:string};if(!active.current)return;
   if(!response.ok||body.status!=='connected'||!body.workspaceId)throw new Error(body.error??'Could not reconnect GitHub.');
   window.location.assign(`/watch/sources?workspace=${encodeURIComponent(body.workspaceId)}`);
  }catch(reason){if(active.current)setError(reason instanceof Error?reason.message:'Connection unavailable.');}
  finally{submitting.current=false;if(active.current)setConnectingId(null);}
 }
 if(existing.length)return <div><div className="space-y-3" aria-label="Existing GitHub connections">{existing.map(item=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-panel px-4 py-3" key={item.installationId}><div><p className="font-medium text-snow">{item.accountLogin}</p><p className="text-sm text-mute">Existing personal GitHub connection</p></div><Button disabled={connectingId!==null} onClick={()=>void connectExisting(item.installationId)}>{connectingId===item.installationId?'Connecting…':`Connect ${item.accountLogin}`}</Button></div>)}</div><Button className="mt-3" variant="outline" disabled={connectingId!==null||busy} onClick={()=>void start(true)}>{busy?'Opening GitHub…':'Use a different GitHub account'}</Button><p className="mt-3 text-sm leading-relaxed text-mute">NoSpoilers verified that the signed-in GitHub user owns this unassigned personal installation. Connecting it preserves its repository access and attaches it to this workspace.</p>{error?<p className="mt-2 text-sm" role="alert">{error}</p>:null}</div>;
 return <div><Button variant={compact?'outline':'default'} disabled={busy||!!disabledReason} onClick={()=>void start()}>{busy?'Checking GitHub…':compact?'Connect GitHub':'Connect GitHub to this workspace'}</Button><p className="mt-3 text-sm leading-relaxed text-mute">{compact?'Requires organisation and workspace admin approval. Existing connections and history stay in place.':'NoSpoilers will reconnect a personal installation owned by the signed-in GitHub user when one is available. Otherwise GitHub will open its installation flow.'}</p>{disabledReason?<p role="status">{disabledReason}</p>:null}{error?<p className="mt-2 text-sm" role="alert">{error}</p>:null}</div>;
}

export function GithubConnectionReturn(){
 const [status,setStatus]=useState<'ready'|'working'|'waiting'|'error'>('ready'),[error,setError]=useState('');const submitting=useRef(false);
 const active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function finish(){
  if(submitting.current)return;submitting.current=true;setStatus('working');setError('');
  try{
   const response=await fetch('/api/github/connection/complete',{method:'POST'});
   const body=await response.json() as {status?:string;workspaceId?:string;error?:string};
   if(!active.current)return;
   if(!response.ok)throw new Error(body.error??'Could not complete the connection.');
   if(body.status==='awaiting_webhook'){setStatus('waiting');return;}
   if(body.status!=='connected'||!body.workspaceId)throw new Error('Unexpected connection response.');
   window.location.assign(`/watch/sources?workspace=${encodeURIComponent(body.workspaceId)}`);
  }catch(reason){if(active.current){setStatus('error');setError(reason instanceof Error?reason.message:'Connection failed.');}}
  finally{submitting.current=false;}
 }
 return <section className="watch-empty" aria-labelledby="github-return-title"><p className="text-xs uppercase tracking-widest text-mute">GitHub connection</p><h1 id="github-return-title" className="watch-page-title">Finish connecting your repositories</h1><p>We’ll verify the installation approval, add its repositories to this workspace’s Coverage and queue initial checks within your existing allowance. No new subscription or trial is created.</p>{status==='waiting'?<p role="status">GitHub’s signed installation notification has not arrived yet. Wait a moment, then check again. Nothing has been attached or scanned.</p>:null}{status==='working'?<p role="status">Verifying approval and synchronising repository access…</p>:null}{error?<p role="alert">{error}</p>:null}<Button className="mt-4" disabled={status==='working'} onClick={()=>void finish()}>{status==='working'?'Connecting…':status==='waiting'?'Check again':status==='error'?'Retry connection':'Finish connection'}</Button></section>;
}
