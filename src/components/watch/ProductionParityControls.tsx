import {useEffect,useId,useRef,useState} from 'react';
type Mapping={path:string;servedPath:string;representation:'identity'|'transformed'};
type Asset={servedPath:string;state:string;reason:string;cache:string|null};
type Run={id:string;status:string;deployment_id:string;reason:string|null;authorityCurrent:boolean;stale:boolean;result:{assets:Asset[];scope:string;unmappedManifestFiles:number;observedAt:string}|null};
type View={canManage:boolean;canCancel:boolean;baselineRevision:number|null;manifest:Array<{path:string;size:number}>;origins:Array<{id:number;origin_url:string}>;runs:Run[];notice:string};
export function ProductionParityControls({streamId,refreshVersion}:{streamId:string;refreshVersion:number}){
  const manifestListId=useId();
  const [view,setView]=useState<View|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
  const [originId,setOriginId]=useState(''),[deployment,setDeployment]=useState(''),[deployedAt,setDeployedAt]=useState('');
  const [mappings,setMappings]=useState<Mapping[]>([]),[confirmed,setConfirmed]=useState(false);
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const c=new AbortController();lifetime.current=c;return()=>c.abort();},[]);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,count=0;
    async function load(){try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/production-parity`,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Production comparison unavailable.');
      if(!Array.isArray(body.runs)||!Array.isArray(body.manifest)||!Array.isArray(body.origins))throw new Error('Production comparison returned incomplete data.');
      if(controller.signal.aborted)return;setView(body);setError('');
      if(body.runs.some((r:Run)=>r.status==='queued'||r.status==='running')&&count++<20)timer=setTimeout(()=>void load(),3000);
    }catch(e){if(!controller.signal.aborted){setView(null);setError(e instanceof Error?e.message:'Production comparison unavailable.');}}}
    void load();return()=>{controller.abort();clearTimeout(timer);};
  },[streamId,reload,refreshVersion]);
  async function mutate(input:object){
    const signal=lifetime.current?.signal;if(!signal||signal.aborted||busy)return;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/release-intelligence/streams/${streamId}/production-parity`,{method:'POST',signal,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Observation was not saved.');
      if(!signal.aborted){setConfirmed(false);setReload(n=>n+1);}
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Observation was not saved.');}
    finally{if(!signal.aborted)setBusy(false);}
  }
  function change(index:number,patch:Partial<Mapping>){setMappings(rows=>rows.map((r,i)=>i===index?{...r,...patch}:r));setConfirmed(false);}
  return <details><summary>Approved build → production</summary>
    <p>Compare selected files from your adopted reference with a declared deployment. This is a separate, bounded observation—not permission to ship and not a scan of everything on the site.</p>
    <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh production observations</button>
    {error?<p role="alert">{error}</p>:null}
    {!view&&!error?<p role="status">Reading production scope…</p>:null}
    {view?<><p>{view.notice}</p>
      {view.baselineRevision===null||!view.manifest.length?<p>Adopt an eligible signed release as a reference before mapping production files. Missing, excluded or revoked references cannot establish parity.</p>:view.canManage?<form onSubmit={event=>{
        event.preventDefault();const date=new Date(deployedAt);if(!Number.isFinite(date.getTime())){setError('Choose the declared deployment time.');return;}
        void mutate({requestKey:crypto.randomUUID(),expectedBaselineRevision:view.baselineRevision,originId:Number(originId),deploymentId:deployment,deployedAt:date.toISOString(),mappings,confirm:confirmed});
      }}>
        <label>Verified website<select required value={originId} onChange={e=>{setOriginId(e.target.value);setConfirmed(false);}}><option value="">Choose a workspace website</option>{view.origins.map(o=><option key={o.id} value={o.id}>{o.origin_url}</option>)}</select></label>
        <label>Declared deployment ID<input required maxLength={120} value={deployment} onChange={e=>{setDeployment(e.target.value);setConfirmed(false);}} placeholder="Your deploy ID or release reference"/></label>
        <label>Declared deployment time (your local time)<input required type="datetime-local" value={deployedAt} onChange={e=>{setDeployedAt(e.target.value);setConfirmed(false);}}/></label>
        <p>Reference revision {view.baselineRevision}. Select up to 40 files and confirm their exact public paths. Other manifest files remain unobserved.</p>
        <datalist id={manifestListId}>{view.manifest.map(file=><option key={file.path} value={file.path}/>)}</datalist>
        {mappings.map((mapping,index)=><fieldset key={index}><legend>File {index+1}</legend>
          <label>Approved file<input required list={manifestListId} value={mapping.path} placeholder="Exact approved manifest path" onChange={e=>change(index,{path:e.target.value})}/></label>
          <label>Exact public path<input required placeholder="/assets/app.js" value={mapping.servedPath} onChange={e=>change(index,{servedPath:e.target.value})}/></label>
          <label>Served representation<select value={mapping.representation} onChange={e=>change(index,{representation:e.target.value as Mapping['representation']})}><option value="identity">Unchanged file bytes</option><option value="transformed">Transformed by hosting/CDN — cannot compare exactly</option></select></label>
          <button type="button" onClick={()=>{setMappings(rows=>rows.filter((_,i)=>i!==index));setConfirmed(false);}}>Remove file {index+1}</button>
        </fieldset>)}
        <button type="button" disabled={mappings.length>=40} onClick={()=>{setMappings(rows=>[...rows,{path:'',servedPath:'',representation:'identity'}]);setConfirmed(false);}}>Add file mapping</button>
        <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this declared deployment and these exact file mappings on a website I control.</label>
        <button type="submit" disabled={busy||!confirmed||!mappings.length}>{busy?'Saving…':'Observe production'}</button>
      </form>:<p>An administrator with active coverage can request an observation.</p>}
      {view.runs.map(run=><details key={run.id}><summary>{run.deployment_id} · {run.status}</summary>
        {run.reason?<p>{run.reason}</p>:null}
        {!run.authorityCurrent?<p>Historical only: the current reference or origin authority no longer matches this observation. Its original result is unchanged.</p>:null}
        {view.canCancel&&['queued','running','failed'].includes(run.status)?<button type="button" disabled={busy} onClick={()=>void mutate({action:'cancel',runId:run.id})}>Cancel observation</button>:null}
        {run.result?<><p>{run.result.scope}</p><p>Observed {new Date(run.result.observedAt).toLocaleString()}. {run.stale?'Stale or unconfirmed time — request a fresh observation before relying on current production.':'Point-in-time evidence; production and caches can change.'}</p><p>{run.result.unmappedManifestFiles} manifest {run.result.unmappedManifestFiles===1?'file was':'files were'} not mapped.</p>
          <ul>{run.result.assets.map((asset,i)=><li key={i}><strong>{asset.state}</strong> <code>{asset.servedPath}</code><p>{asset.reason}{asset.cache?` Cache: ${asset.cache}.`:''}</p></li>)}</ul>
        </>:null}
      </details>)}
    </>:null}
  </details>;
}
