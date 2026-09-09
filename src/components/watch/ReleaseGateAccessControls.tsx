import {useEffect,useRef,useState} from 'react';
import type {Ref} from '../../release-intelligence/model';
type Grant={token_id:number;revision:number;enabled:boolean;expires_at:string;expired:boolean;selector:string;name:string;revoked_at:string|null};
type View={tokens:Array<{id:number;name:string;token_prefix:string}>;grants:Grant[];eligible:boolean;canEnable:boolean;canDisable:boolean;notice:string};
export function ReleaseGateAccessControls({streamId,record}:{streamId:string;record:Ref}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
  const [token,setToken]=useState(''),[days,setDays]=useState(30),[reason,setReason]=useState(''),[confirm,setConfirm]=useState(false);
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{
    const c=new AbortController(),params=new URLSearchParams({recordKind:record.kind,recordId:record.id});
    void fetch(`/api/release-intelligence/streams/${streamId}/gate-access?${params}`,{signal:c.signal,credentials:'same-origin',cache:'no-store'}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error??'CI access unavailable.');
      if(!Array.isArray(data.tokens)||!Array.isArray(data.grants))throw new Error('CI access response incomplete.');
      if(!c.signal.aborted){setView(data);setError('');setConfirm(false);}
    }).catch(e=>{if(!c.signal.aborted){setView(null);setError(e instanceof Error?e.message:'CI access unavailable.');}});
    return()=>c.abort();
  },[streamId,record.kind,record.id,reload]);
  async function save(tokenId:number,expectedRevision:number,enabled:boolean){
    const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy)return;
    if(reason.trim().length<8){setError('Enter a reason of at least eight characters.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/gate-access`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({tokenId,expectedRevision,enabled,record,days,reason,confirm})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'CI access was not saved.');
      if(!signal.aborted){setNotice(enabled?'Gate-only CI access saved for this asset selection. Other token permissions are unchanged.':'CI grant revoked. Previously granted decisions cannot be consumed with a renewed grant.');setReload(n=>n+1);setReason('');setConfirm(false);}
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'CI access was not saved.');}
    finally{if(!signal.aborted)setBusy(false);}
  }
  return <details><summary>Connected-source CI access</summary>
    <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh CI access</button>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!view&&!error?<p role="status">Reading explicit CI grants…</p>:null}
    {view?<><p>{view.notice}</p><label>CI access change reason<textarea value={reason} minLength={8} maxLength={1000} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label>
      {view.canEnable&&view.eligible?<form onSubmit={e=>{e.preventDefault();void save(Number(token),Number(view.grants.find(g=>Number(g.token_id)===Number(token))?.revision??0),true);}}>
        <label>Existing workspace token<select required value={token} onChange={e=>{setToken(e.target.value);setConfirm(false);}}><option value="">Choose a CI token</option>{view.tokens.map(t=><option key={t.id} value={t.id}>{t.name} · {t.token_prefix}</option>)}</select></label>
        {!view.tokens.length?<p>Create a workspace scan token in Scan API Tokens first. No token secret is shown or created here.</p>:null}
        <label>Access duration (days)<input type="number" min={1} max={90} required value={days} onChange={e=>{setDays(Number(e.target.value));setConfirm(false);}}/></label>
        <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Grant this token gate-only access to this exact connected asset selection.</label>
        <button type="submit" disabled={busy||!confirm||!token||reason.trim().length<8}>Grant or renew CI access</button>
      </form>:<p>Enabling requires active administrator access and a compatible connected release asset. Existing grants can still be revoked.</p>}
      {view.grants.map(g=><div key={g.token_id}><p><strong>{g.name}</strong> · {!g.enabled||g.revoked_at?'Disabled':g.expired?'Expired':'Configured — checked on use'} · revision {g.revision}</p><p>Expires {new Date(g.expires_at).toLocaleString()}. Current source and administrator authority are checked at every gate request.</p><code>{g.selector}</code>
        {view.canDisable&&g.enabled?<button type="button" disabled={busy||reason.trim().length<8} onClick={()=>void save(Number(g.token_id),Number(g.revision),false)}>Revoke CI access for {g.name}</button>:null}
      </div>)}
    </>:null}
  </details>;
}
