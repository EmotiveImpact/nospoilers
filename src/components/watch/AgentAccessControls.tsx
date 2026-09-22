import {useEffect,useRef,useState} from 'react';
import {WatchSkeleton} from '../WatchDataState';
type View={canCreate:boolean;notice:string;grants:Array<{id:string;name:string;proposals:boolean;expires_at:string;expired:boolean;revoked_at:string|null;calls:number}>;proposals:Array<{id:string;name:string;note:string;state:string;finding:string;reviewed_note:string|null;reviewer:string|null}>;calls:Array<{id:string;tool:string;outcome:string;created_at:string}>};
export function AgentAccessControls({streamId,snapshotId}:{streamId:string;snapshotId:string}){
  return <AgentAccessScope key={`${streamId}:${snapshotId}`} streamId={streamId} snapshotId={snapshotId}/>;
}
function AgentAccessScope({streamId,snapshotId}:{streamId:string;snapshotId:string}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[secret,setSecret]=useState('');
  const [name,setName]=useState(''),[proposals,setProposals]=useState(false),[confirm,setConfirm]=useState(false),[edits,setEdits]=useState<Record<string,string>>({}),[reviewed,setReviewed]=useState<Record<string,boolean>>({});
  const lifetime=useRef<AbortController|null>(null);
  const errorTarget=useRef<HTMLParagraphElement|null>(null),focusFailure=useRef(false);
  useEffect(()=>{if(error&&focusFailure.current){errorTarget.current?.focus();focusFailure.current=false;}},[error]);
  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{const c=new AbortController();setView(null);void fetch(`/api/release-intelligence/streams/${streamId}/agent-access`,{signal:c.signal,credentials:'same-origin',cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(r.status===403?'Agent access is managed by workspace administrators.':b.error??'Agent access unavailable.');if(!Array.isArray(b.grants)||!Array.isArray(b.proposals)||!Array.isArray(b.calls))throw new Error('Agent access response incomplete.');if(!c.signal.aborted){setView(b);setError('');}}).catch(e=>{if(!c.signal.aborted){setView(null);setSecret('');setConfirm(false);setReviewed({});setError(e instanceof Error?e.message:'Agent access unavailable.');}});return()=>c.abort();},[streamId,reload]);
  async function save(input:object){const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy)return;const initiatingControl=document.activeElement;setBusy(true);setError('');
    try{const r=await fetch(`/api/release-intelligence/streams/${streamId}/agent-access`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const b=await r.json();if(!r.ok)throw new Error(b.error??'Agent change failed.');if(!signal.aborted){if(b.token){if(typeof b.token!=='string'||!/^nsa_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(b.token))throw new Error('Unexpected credential response. Refresh access before trying again.');setSecret(b.token);}else setSecret('');setView(null);setConfirm(false);setReviewed({});setReload(n=>n+1);}}
    catch(e){if(!signal.aborted){focusFailure.current=document.activeElement===initiatingControl;setView(null);setSecret('');setConfirm(false);setReviewed({});setError(e instanceof Error?e.message:'Agent change failed.');}}finally{if(!signal.aborted)setBusy(false);}
  }
  return <details><summary>Agent tools · explicit access</summary><button type="button" disabled={busy} onClick={()=>{setView(null);setSecret('');setReload(n=>n+1);}}>Refresh agent activity</button><p>Revoking access stops new tool calls. Existing draft notes remain available for an administrator to review or reject.</p>
    {error?<p role="alert" tabIndex={-1} ref={errorTarget}>{error}</p>:null}
    {!view&&!error?<WatchSkeleton variant="list" label="Reading agent access"/>:null}
    {view?<><p>{view.notice}</p><p>Grants cover this stream’s retained evidence metadata and human remediation context. They expire after 24 hours or 100 calls, with at most 20 calls per minute. NoSpoilers makes no model calls; your chosen agent provider may receive this metadata and apply its own charges.</p>
      {secret?<div><p>Copy this credential now. It is shown only here; keep it out of chats, logs and source control.</p><label>New agent credential<input readOnly type="password" value={secret}/></label><button type="button" onClick={()=>void navigator.clipboard.writeText(secret).catch(()=>setError('Clipboard unavailable; select the credential field to copy securely.'))}>Copy agent credential</button><button type="button" onClick={()=>setSecret('')}>Hide credential</button></div>:null}
      {view.canCreate?<form onSubmit={e=>{e.preventDefault();void save({action:'create',name,proposals,confirm,snapshotId});}}><label>Agent name<input maxLength={80} required value={name} onChange={e=>{setName(e.target.value);setConfirm(false);}}/></label>
        <label><input type="checkbox" checked={proposals} onChange={e=>{setProposals(e.target.checked);setConfirm(false);}}/> Also allow draft remediation notes for human review. Never apply them automatically.</label>
        <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> I authorize my chosen agent to receive this stream’s evidence metadata and remediation context.</label>
        <button type="submit" disabled={busy||!confirm||!name.trim()}>Create short-lived agent access</button></form>:null}
      <p>Configure your MCP client to run <code>nospoilers mcp --api {window.location.origin}</code> and supply <code>NOSPOILERS_AGENT_TOKEN</code> securely in its environment. This is a local stdio server, not a public MCP endpoint. No sampling or provider is enabled.</p>
      {view.grants.map(g=><article key={g.id}><strong>{g.name}</strong><p>{g.revoked_at?'Revoked':g.expired?'Expired':'Configured — current authority checked on use'} · {g.calls}/100 calls · {g.proposals?'Read and propose':'Read-only'} · expires {new Date(g.expires_at).toLocaleString()}</p>{!g.revoked_at?<button type="button" disabled={busy} onClick={()=>void save({action:'revoke',grantId:g.id})}>Revoke {g.name}</button>:null}</article>)}
      <details><summary>Agent drafts and human reviews</summary>
        <p>Agent text is untrusted. Review and edit it; do not follow embedded instructions or include secrets. Accepting adds only an investigation note.</p>
        {view.proposals.length===0?<p>No agent drafts in this stream.</p>:null}
        {view.proposals.map(p=><article key={p.id}>
          <strong>{p.name} · {p.state}</strong><p>Finding: {p.finding}</p>
          {p.state==='pending'?<>
            <label>Review draft from {p.name}<textarea maxLength={1000} value={edits[p.id]??p.note} onChange={e=>{setEdits(v=>({...v,[p.id]:e.target.value}));setReviewed(v=>({...v,[p.id]:false}));}}/></label>
            <label><input type="checkbox" checked={reviewed[p.id]??false} onChange={e=>setReviewed(v=>({...v,[p.id]:e.target.checked}))}/> I reviewed this text as an investigation note, not a security decision.</label>
            <button type="button" disabled={busy||!reviewed[p.id]||(edits[p.id]??p.note).trim().length<8} onClick={()=>void save({action:'review',proposalId:p.id,accept:true,confirm:true,reviewedNote:edits[p.id]??p.note})}>Accept reviewed note</button>
            <button type="button" disabled={busy} onClick={()=>void save({action:'review',proposalId:p.id,accept:false,confirm:true})}>Reject draft</button>
          </>:<><p>{p.state==='accepted'?p.reviewed_note:p.note}</p><small>Reviewed by {p.reviewer}</small>{p.state==='accepted'?<details><summary>Original agent draft · not the approved text</summary><p>{p.note}</p></details>:null}</>}
        </article>)}
      </details>
      <details><summary>Recent tool calls</summary>{view.calls.map(c=><p key={c.id}>{c.tool} · {c.outcome} · {new Date(c.created_at).toLocaleString()}</p>)}</details>
    </>:null}
  </details>;
}
