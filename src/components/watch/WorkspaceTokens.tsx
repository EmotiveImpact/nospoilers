import './design/settings-pages.css';
import './design/journey-access.css';
import {SettingsTabs} from './design/SettingsTabs';
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
 const [tab,setTab]=useState('tokens');
 const tokenName=useRef<HTMLInputElement>(null);
 const base=`/api/workspaces/${encodeURIComponent(workspaceId)}/tokens`;
 const [page,setPage]=useState<Page|null>(null),[before,setBefore]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const [name,setName]=useState(''),[secret,setSecret]=useState(''),[selected,setSelected]=useState<Token|null>(null),[confirm,setConfirm]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [uncertain,setUncertain]=useState(false);
 const mutation=useRef<AbortController|null>(null);
 const confirmationInput=useRef<HTMLInputElement|null>(null);
 const confirmationForm=useRef<HTMLFormElement|null>(null);
 const revokeTrigger=useRef<HTMLButtonElement|null>(null);
 const historyHeading=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{if(selected)confirmationInput.current?.focus();},[selected]);
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
   if(revoke){if(confirmationForm.current?.contains(document.activeElement))historyHeading.current?.focus();setSelected(null);setConfirm('');setSecret('');setNotice('Token revoked. Saved scan history is unchanged.');}
   else {setTab('tokens');setSecret(body.token);setName('');setNotice('Token created. Store it securely now; it cannot be shown again.');}
   setBefore(null);setRevision(n=>n+1);
  }catch(e){if(!request.signal.aborted){setError(e instanceof Error?e.message:'Request failed.');if(!revoke&&!accessRejected)setUncertain(true);}}
  finally{mutation.current=null;if(!request.signal.aborted)setBusy(false);}
 }
 function changePage(cursor:string|null){setPage(null);setSelected(null);setConfirm('');setSecret('');setBefore(cursor);}
 return <section className="token-page journey-access min-w-0 space-y-6 [overflow-wrap:anywhere]" aria-label="Workspace scan tokens">
  <header><WatchPageHeader kicker="Workspace settings" title="Connect your build pipeline." lede="Create credentials with a clear purpose and workspace scope." action={page?.canManage&&tab!=='create'?<Button disabled={busy||uncertain||!!secret} onClick={()=>{setTab('create');requestAnimationFrame(()=>tokenName.current?.focus());}}>Create token</Button>:undefined}/></header>
  <p className="text-sm text-mute">Up to five active tokens, shared with existing connection tokens. API scans use your workspace’s plan and scan allowance.</p>
  {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRevision(n=>n+1)}>Reload credentials</Button></div>:null}
  {notice?<p role="status">{notice}</p>:null}
  {uncertain?<div className="watch-card p-4 sm:p-5 space-y-3" role="status"><p>Creation was not confirmed. Reload credentials and check for the token before creating another. If it exists but you did not receive its secret, revoke it first.</p><Button variant="outline" disabled={busy||!page} onClick={()=>setUncertain(false)}>I’ve checked credential history</Button></div>:null}
  {secret?<div className="watch-card p-4 sm:p-5 space-y-3"><label className="block">New token — shown once<input aria-label="New token" className="block w-full rounded border border-white/15 bg-transparent p-3 font-mono" value={secret} readOnly autoComplete="off"/></label><Button variant="outline" onClick={()=>setSecret('')}>I’ve saved it</Button></div>:null}
  {!page&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
  {page?<SettingsTabs label="Token sections" value={tab} onValueChange={setTab} tabs={[{id:'tokens',label:'Tokens',content:<section className="settings-records"><h2 className="sr-only" ref={historyHeading} tabIndex={-1}>Token history</h2><div className="journey-access-table"><table aria-label="Scan tokens"><thead><tr><th>Token</th><th>Scope</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{page.tokens.map(token=><tr key={token.id}><td><strong>{token.name}</strong><small>{token.last_used_at?`Last used ${new Date(token.last_used_at).toLocaleString()}`:'Never used'} · {token.token_prefix}…</small></td><td>Workspace scans &amp; results</td><td><span className={token.revoked_at?'':'journey-access-status'}>{token.revoked_at?'Revoked':'Active'}</span></td><td>{!token.revoked_at&&page.canManage?<Button variant="ghost" disabled={busy} onClick={event=>{revokeTrigger.current=event.currentTarget;setSelected(token);setConfirm('');}}>Revoke {token.name}</Button>:null}</td></tr>)}</tbody></table>{!page.tokens.length?<div className="journey-access-empty"><h2>No tokens on this page.</h2><p>Create a token when you are ready to connect your pipeline.</p></div>:null}</div><nav className="flex gap-3" aria-label="Credential history"><Button variant="outline" disabled={!before||busy} onClick={()=>changePage(null)}>Newest</Button><Button variant="outline" disabled={!page.nextCursor||busy} onClick={()=>changePage(page.nextCursor)}>Older</Button></nav></section>},...(page.canManage?[{id:'create',label:'Create token',content:<form className="journey-access-compose" onSubmit={e=>{e.preventDefault();void save(false);}}><h2>Create a scan token</h2><p>Name the integration so you can recognise it later.</p><div className="journey-access-fields"><label>Token name<input ref={tokenName} value={name} onChange={e=>setName(e.target.value)} maxLength={64} required/></label><Button type="submit" disabled={busy||uncertain||!!secret||!name.trim()}>Create token</Button></div><p className="journey-access-note">This token can submit scans and read saved scan results across this workspace. It remains active until revoked.</p></form>}]:[])]}/>:null}
  {page&&!page.canManage?<p className="journey-access-note">Only administrators of an active workspace can create or revoke tokens.</p>:null}
  <section className="journey-access-explanation"><div><h2>One purpose per credential</h2><h3>Submit the packed artifact</h3><p>Your CI workflow sends the exact release bytes for inspection and receives a result.</p><p>Do not place tokens in source control. A newly created token is shown once.</p></div><aside><h3>Separate permissions</h3><p>Scan tokens do not automatically grant release-gate access or agent access.</p></aside></section>
  {selected?<form ref={confirmationForm} aria-label="Revoke scan token" className="watch-card p-4 sm:p-5 space-y-3" onSubmit={e=>{e.preventDefault();void save(true);}}><p>Revoking this token stops future API access. It does not delete scan history.</p><label className="block">Type {selected.name} to confirm<input ref={confirmationInput} className="block w-full min-w-0 rounded border border-white/15 bg-transparent p-2" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label><Button type="submit" disabled={busy||confirm!==selected.name}>Confirm revocation</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setSelected(null);revokeTrigger.current?.focus();}}>Cancel</Button></form>:null}
 </section>;
}
