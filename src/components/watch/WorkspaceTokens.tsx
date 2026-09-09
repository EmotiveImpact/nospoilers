import { WatchPageHeader } from "./WatchPageHeader.tsx";
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
type Token={id:number;name:string;token_prefix:string;revoked_at:string|null;last_used_at:string|null};
type Page={tokens:Token[];nextCursor:string|null;canManage:boolean};
export function WorkspaceTokens({workspaceId}:{workspaceId:string}){
 return <TokenScope key={workspaceId} workspaceId={workspaceId}/>;
}
function TokenScope({workspaceId}:{workspaceId:string}){
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/tokens`;
 const [page,setPage]=useState<Page|null>(null),[before,setBefore]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const [name,setName]=useState(''),[secret,setSecret]=useState(''),[selected,setSelected]=useState<Token|null>(null),[confirm,setConfirm]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>()=>mutation.current?.abort(),[]);
 useEffect(()=>{const request=new AbortController();
  void fetch(`${base}${before?`?before=${encodeURIComponent(before)}`:''}`,{signal:request.signal}).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error(body.error??'Could not load credentials.');
   if(!request.signal.aborted){setPage(body);setError('');}
  }).catch(e=>{if(!request.signal.aborted){setPage(null);setSecret('');setError(e.message);}});
  return()=>request.abort();
 },[base,before,revision]);
 async function save(revoke:boolean){
  if(mutation.current||!page?.canManage||(!revoke&&uncertain))return;
  const request=new AbortController();mutation.current=request;setBusy(true);setError('');setNotice('');
  let accessRejected=false;
  try{
   const response=await fetch(revoke?`${base}/${selected!.id}`:base,{method:revoke?'DELETE':'POST',signal:request.signal,headers:{'content-type':'application/json'},body:JSON.stringify(revoke?{confirm}:{name})});
   const body=await response.json();
   if(!request.signal.aborted&&(response.status===401||response.status===403)){
    accessRejected=true;setPage(null);setSecret('');setSelected(null);setConfirm('');setName('');
   }
   if(!response.ok)throw new Error(body.error??'Could not save credentials.');
   if(request.signal.aborted)return;
   if(!revoke&&(typeof body.token!=='string'||!body.token.trim()))throw new Error('The token secret was not received. Check credential history before trying again.');
   if(revoke){setSelected(null);setConfirm('');setSecret('');setNotice('Token revoked. Saved scan history is unchanged.');}
   else {setSecret(body.token);setName('');setNotice('Token created. Store it securely now; it cannot be shown again.');}
   setBefore(null);setRevision(n=>n+1);
  }catch(e){if(!request.signal.aborted){setError(e instanceof Error?e.message:'Request failed.');if(!revoke&&!accessRejected)setUncertain(true);}}
  finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 }
 function changePage(cursor:string|null){setPage(null);setSelected(null);setConfirm('');setSecret('');setBefore(cursor);}
 return <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]" aria-label="Workspace scan tokens">
  <header><WatchPageHeader kicker="Workspace settings" title="Scan API tokens" lede="Connect CI to this workspace. Tokens can submit scans and read saved scan results across this workspace. Keep them secret." /></header>
  <p className="text-sm text-mute">Up to five active tokens, shared with existing connection tokens. API scans use your workspace’s plan and scan allowance.</p>
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRevision(n=>n+1)}>Reload credentials</Button></div>:null}
  {notice?<p role="status">{notice}</p>:null}
  {uncertain?<div className="watch-card p-4 sm:p-5 space-y-3" role="status"><p>Creation was not confirmed. Reload credentials and check for the token before creating another. If it exists but you did not receive its secret, revoke it first.</p><Button variant="outline" disabled={busy||!page} onClick={()=>setUncertain(false)}>I’ve checked credential history</Button></div>:null}
  {secret?<div className="watch-card p-4 sm:p-5 space-y-3"><label className="block">New token — shown once<input aria-label="New token" className="block w-full rounded border border-white/15 bg-transparent p-3 font-mono" value={secret} readOnly autoComplete="off"/></label><Button variant="outline" onClick={()=>setSecret('')}>I’ve saved it</Button></div>:null}
  {!page&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
  {page?.canManage?<form className="watch-card p-4 sm:p-5 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void save(false);}}><label className="min-w-0 w-full sm:w-auto sm:flex-1">Token name<input className="block w-full min-w-0 rounded border border-white/15 bg-transparent p-2" value={name} onChange={e=>setName(e.target.value)} maxLength={64} required/></label><Button type="submit" disabled={busy||uncertain||!!secret||!name.trim()}>Create token</Button></form>:page?<p className="text-sm text-mute">Only administrators of an active workspace can create or revoke tokens.</p>:null}
  {page?<><ul className="divide-y divide-white/10">{page.tokens.map(token=><li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><strong>{token.name}</strong><p className="text-sm text-mute">{token.token_prefix}… · {token.revoked_at?'Revoked':'Active'} · {token.last_used_at?`Last used ${new Date(token.last_used_at).toLocaleString()}`:'Never used'}</p></div>{!token.revoked_at&&page.canManage?<Button className="h-auto min-h-11 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]" variant="outline" disabled={busy} onClick={()=>{setSelected(token);setConfirm('');}}>Revoke {token.name}</Button>:null}</li>)}</ul>{!page.tokens.length?<p>No tokens on this page.</p>:null}<nav className="flex gap-3" aria-label="Credential history"><Button variant="outline" disabled={!before||busy} onClick={()=>changePage(null)}>Newest</Button><Button variant="outline" disabled={!page.nextCursor||busy} onClick={()=>changePage(page.nextCursor)}>Older</Button></nav></>:null}
  {selected?<form className="watch-card p-4 sm:p-5 space-y-3" onSubmit={e=>{e.preventDefault();void save(true);}}><p>Revoking this token stops future API access. It does not delete scan history.</p><label className="block">Type {selected.name} to confirm<input className="block w-full min-w-0 rounded border border-white/15 bg-transparent p-2" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label><Button type="submit" disabled={busy||confirm!==selected.name}>Confirm revocation</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancel</Button></form>:null}
 </section>;
}
