import {useEffect,useRef,useState} from 'react';
import type {Ref} from '../../release-intelligence/model';
import type {GatePolicy,GateResult} from '../../release-intelligence/gate';
import {ReleaseGateAccessControls} from './ReleaseGateAccessControls';
type Decision={id:string;policy_revision:number;deployment_id:string;result:GateResult;expires_at:string;overridden:boolean;consumed:boolean};
type View={policy:GatePolicy;canManage:boolean;canWrite:boolean;canAdminister?:boolean;binding:{record:Ref;digest:string}|null;notice:string;
  policies:Array<{revision:number;mode:string;max_age_hours:number;reason:string}>;decisions:Decision[]};
export function ReleaseGateControls({streamId,record,refreshVersion}:{streamId:string;record:Ref;refreshVersion:number}){
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
  const [mode,setMode]=useState<GatePolicy['mode']>('advisory'),[hours,setHours]=useState(24),[reason,setReason]=useState(''),[confirm,setConfirm]=useState(false),[rollback,setRollback]=useState(''),[deployment,setDeployment]=useState('');
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{
    const c=new AbortController(),query=new URLSearchParams({recordKind:record.kind,recordId:record.id});
    void fetch(`/api/release-intelligence/streams/${streamId}/gate?${query}`,{signal:c.signal,credentials:'same-origin',cache:'no-store'})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error??'Gate unavailable.');
        if(!body.policy||!Array.isArray(body.policies)||!Array.isArray(body.decisions))throw new Error('Gate response incomplete.');
        if(!c.signal.aborted){setView(body);setMode(body.policy.mode);setHours(body.policy.maxAgeHours);setConfirm(false);setError('');}})
      .catch(e=>{if(!c.signal.aborted){setView(null);setError(e instanceof Error?e.message:'Gate unavailable.');}});
    return()=>c.abort();
  },[streamId,record.kind,record.id,refreshVersion,reload]);
  async function save(input:object,message:string){
    const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy)return;setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/gate`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Gate action was not saved.');
      if(!signal.aborted){setNotice(message);setReason('');setConfirm(false);setRollback('');setReload(n=>n+1);}
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Gate action was not saved.');}
    finally{if(!signal.aborted)setBusy(false);}
  }
  return <details><summary>Release Gate · opt-in</summary>
    <p>Adopt a policy for this release stream. CI must call the gate before deploying; enabling a mode does not automatically reconfigure your pipeline.</p>
    <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh gate</button>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {!view&&!error?<p role="status">Reading gate policy…</p>:null}
    {view?<><p><strong>{view.policy.mode}</strong> · revision {view.policy.revision} · evidence within {view.policy.maxAgeHours} hours.</p><p>{view.notice}</p>
      {view.canAdminister&&record.kind==='release'?<ReleaseGateAccessControls key={`${streamId}:${record.id}`} streamId={streamId} record={record}/>:null}
      {view.canManage?<form onSubmit={e=>{e.preventDefault();void save({action:'configure',mode,maxAgeHours:hours,expectedRevision:view.policy.revision,reason,confirm,...(rollback?{rollbackFromRevision:Number(rollback)}:{})},'New gate policy revision saved. Existing decisions must be evaluated again.');}}>
        <label>Gate mode<select value={mode} disabled={busy||Boolean(rollback)} onChange={e=>{setMode(e.target.value as GatePolicy['mode']);setConfirm(false);}}><option value="advisory">Advisory — record only</option><option value="warn">Warn — report issues without blocking</option><option value="enforce">Enforce — require ready evidence or explicit override</option></select></label>
        <label>Maximum scan age (hours)<input required type="number" min={1} max={168} value={hours} disabled={busy||Boolean(rollback)} onChange={e=>{setHours(Number(e.target.value));setConfirm(false);}}/></label>
        {view.policies.length?<label>Restore previous policy as a new revision<select value={rollback} disabled={busy} onChange={e=>{setRollback(e.target.value);setConfirm(false);}}><option value="">Use the settings above</option>{view.policies.map(p=><option key={p.revision} value={p.revision}>Revision {p.revision} · {p.mode} · {p.max_age_hours} hours</option>)}</select></label>:null}
        <label>Policy change reason<textarea required minLength={8} maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label>
        <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> I confirm this change for this stream. It invalidates previously evaluated gate decisions.</label>
        <button type="submit" disabled={busy||!confirm}>Adopt policy revision</button>
      </form>:<p>An administrator with active coverage can adopt or restore a gate policy.</p>}
      {view.canWrite&&view.binding?<form onSubmit={e=>{e.preventDefault();void save({action:'evaluate',requestKey:crypto.randomUUID(),record:view.binding!.record,digest:view.binding!.digest,deploymentId:deployment,expectedPolicyRevision:view.policy.revision},'Decision recorded for five minutes. CI must consume it against the exact deployment binding.');}}>
        <label>Deployment attempt ID<input required maxLength={120} value={deployment} onChange={e=>setDeployment(e.target.value)}/></label>
        <p>Exact build: <code>{view.binding.digest}</code>. Evaluating here does not deploy or consume the decision.</p><button type="submit" disabled={busy}>Evaluate this recorded build</button>
      </form>:<p>Record this completed build in the selected stream to evaluate it. Website observations cannot grant pre-deploy permission.</p>}
      {view.decisions.map(d=><details key={d.id}><summary>{d.deployment_id} · {d.result.readiness}{d.overridden?' · explicit override':''}{d.consumed?' · consumed':''}</summary>
        <p>{d.result.reason}</p><p>Policy revision {d.policy_revision}. Valid until {new Date(d.expires_at).toLocaleString()}, subject to current access, policy and evidence.</p><code>{d.id}</code>
        {view.canManage&&d.result.overridable&&!d.overridden&&!d.consumed?<Override key={d.id} disabled={busy} onSave={value=>void save({action:'override',decisionId:d.id,...value},'Explicit override recorded. The original finding and readiness are unchanged.')}/>:null}
      </details>)}
    </>:null}
  </details>;
}
function Override({disabled,onSave}:{disabled:boolean;onSave:(input:{reason:string;confirm:boolean})=>void}){
  const [reason,setReason]=useState(''),[confirm,setConfirm]=useState(false);
  return <form onSubmit={e=>{e.preventDefault();onSave({reason,confirm});}}><label>Override reason<textarea required minLength={12} maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label>
    <label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Authorise only this exact deployment attempt without claiming the finding is fixed.</label>
    <button type="submit" disabled={disabled||!confirm}>Record explicit override</button></form>;
}
