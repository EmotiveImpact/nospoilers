import {useEffect,useRef,useState} from 'react';
import type {Ref} from '@/release-intelligence/model';
type State={config:{enabled:boolean;revision:number;selector:string}|null;candidate:{selector:string;channel:string;format:string}|null;
  canManage:boolean;canDisable:boolean;notice:string;attempts:Array<{id:string;record_kind:string;record_id:string;status:string;outcome:string|null;job_status:string|null}>};
export function AutomaticCaptureControls({streamId,record,refreshVersion=0}:{streamId:string;record:Ref;refreshVersion?:number}){
  const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[]);
  useEffect(()=>{
    const controller=new AbortController();setError('');
    const params=new URLSearchParams({recordKind:record.kind,recordId:record.id});
    void fetch(`/api/release-intelligence/streams/${streamId}/automatic-capture?${params}`,{signal:controller.signal,cache:'no-store',credentials:'same-origin'}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Automatic capture is unavailable.');
      if(!Array.isArray(body.attempts)||typeof body.canManage!=='boolean')throw new Error('Capture settings were incomplete.');
      if(!controller.signal.aborted)setState(body);
    }).catch(e=>{if(!controller.signal.aborted){setState(null);setError(e instanceof Error?e.message:'Capture settings are unavailable.');}});
    return()=>controller.abort();
  },[streamId,record.kind,record.id,reload,refreshVersion]);
  async function save(enabled:boolean){
    const signal=lifetime.current?.signal;
    if(!state||busy||!signal||signal.aborted)return;setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/automatic-capture`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({enabled,expectedRevision:state.config?.revision??0,record,confirm:confirmed,reason})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Capture settings were not saved.');
      if(signal.aborted)return;
      setNotice(enabled?'Automatic history capture enabled for this exact selection. References still require your approval.':'Automatic history capture disabled. Saved scans and history are unchanged.');setConfirmed(false);setReason('');setReload(n=>n+1);
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Capture settings were not saved.');}finally{if(!signal.aborted)setBusy(false);}
  }
  return <details><summary>Automatic history capture{state?.config?.enabled?' · Enabled':' · Off'}</summary>
    <p>Save future completed checks into this stream without recording each one manually. This does not schedule more scans, change policy or approve a reference.</p>
    {error?<p role="alert">{error} <button type="button" onClick={()=>setReload(n=>n+1)}>Reload capture settings</button></p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {!state?(error?null:<p role="status">Reading capture settings…</p>):<>
      <p>{state.notice}</p>
      <p><strong>Exact artifact selection</strong><br/><code>{state.config?.selector??state.candidate?.selector??'No connected selector is available for this record.'}</code></p>
      {state.candidate?<p>{state.candidate.channel} · {state.candidate.format}</p>:<p>This record has no currently eligible connected selection. Check source access and connection status. Manual uploads keep explicit capture or the CI scan-and-record command.</p>}
      {(state.config?.enabled?state.canDisable:state.canManage&&state.candidate)?<form onSubmit={e=>{e.preventDefault();void save(!state.config?.enabled);}}>
        {!state.config?.enabled?<label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this exact connected source and artifact belong in this stream.</label>:null}
        <label>Reason for capture change<textarea required minLength={8} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button type="submit" disabled={busy||reason.trim().length<8||!state.config?.enabled&&!confirmed}>{busy?'Saving…':state.config?.enabled?'Disable automatic capture':'Enable automatic capture'}</button>
      </form>:<p>A workspace administrator with active coverage can enable capture. Existing history remains available under its retention terms.</p>}
      {state.attempts.length?<><h4>Recent automatic captures</h4><ul>{state.attempts.map(attempt=><li key={attempt.id}><strong>{attempt.status==='captured'?'Recorded':attempt.status==='stopped'?'Not recorded — access, source or settings changed':attempt.status==='failed'?'Capture failed — scan unchanged':'Queued'}</strong>{attempt.outcome?<span> · {attempt.outcome.replaceAll('_',' ')}</span>:null}{attempt.job_status==='queued'&&attempt.status==='failed'?<span> · automatic retry queued</span>:null}</li>)}</ul></>:<p>No automatic captures recorded yet. This is separate from manually saved history.</p>}
    </>}
  </details>;
}
