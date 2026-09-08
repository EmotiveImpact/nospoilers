import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';

export function GithubWorkspaceConnect({workspaceId,disabledReason}:{workspaceId:string;disabledReason?:string|null}){
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);const submitting=useRef(false);
 async function start(){
  if(submitting.current||disabledReason)return;submitting.current=true;setBusy(true);setError(null);
  try{
   const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/github`,{method:'POST'});
   const body=await response.json() as {url?:string;error?:string};if(!response.ok||!body.url)throw new Error(body.error??'Could not start the connection.');
   const destination=new URL(body.url);if(destination.origin!=='https://github.com')throw new Error('Unexpected connection destination.');
   window.location.assign(destination.href);
  }catch(reason){setError(reason instanceof Error?reason.message:'Connection unavailable.');}
  finally{submitting.current=false;setBusy(false);}
 }
 return <div><Button disabled={busy||!!disabledReason} onClick={()=>void start()}>{busy?'Opening GitHub…':'Connect GitHub to this workspace'}</Button><p className="mt-2 text-sm text-mute">An organisation and workspace administrator must authorise a new GitHub App installation. Existing connections keep their workspace and history.</p>{disabledReason?<p role="status">{disabledReason}</p>:null}{error?<p className="mt-2 text-sm" role="alert">{error}</p>:null}</div>;
}

export function GithubConnectionReturn(){
 const [status,setStatus]=useState<'ready'|'working'|'waiting'|'error'>('ready'),[error,setError]=useState('');const submitting=useRef(false);
 async function finish(){
  if(submitting.current)return;submitting.current=true;setStatus('working');setError('');
  try{
   const response=await fetch('/api/github/connection/complete',{method:'POST'});
   const body=await response.json() as {status?:string;workspaceId?:string;error?:string};
   if(!response.ok)throw new Error(body.error??'Could not complete the connection.');
   if(body.status==='awaiting_webhook'){setStatus('waiting');return;}
   if(body.status!=='connected'||!body.workspaceId)throw new Error('Unexpected connection response.');
   window.location.assign(`/watch/sources?workspace=${encodeURIComponent(body.workspaceId)}`);
  }catch(reason){setStatus('error');setError(reason instanceof Error?reason.message:'Connection failed.');}
  finally{submitting.current=false;}
 }
 return <section className="watch-empty" aria-labelledby="github-return-title"><p className="text-xs uppercase tracking-widest text-mute">GitHub connection</p><h1 id="github-return-title" className="watch-page-title">Finish connecting your repositories</h1><p>We’ll verify the installation approval, add its repositories to this workspace’s Coverage and queue initial checks within your existing allowance. No new subscription or trial is created.</p>{status==='waiting'?<p role="status">GitHub’s signed installation notification has not arrived yet. Wait a moment, then check again. Nothing has been attached or scanned.</p>:null}{status==='working'?<p role="status">Verifying approval and synchronising repository access…</p>:null}{error?<p role="alert">{error}</p>:null}<Button className="mt-4" disabled={status==='working'} onClick={()=>void finish()}>{status==='working'?'Connecting…':status==='waiting'?'Check again':status==='error'?'Retry connection':'Finish connection'}</Button></section>;
}
