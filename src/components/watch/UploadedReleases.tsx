import './design/release-journey.css';
import { WatchSkeleton } from "@/components/WatchDataState";
import { useEffect, useState } from 'react';
import { navigate } from '@/nav';
import { uploadVerdict } from '@/watch/upload-verdict';
import {downloadUploadedRecord,uploadedReleaseDecision,type UploadedRelease as Upload} from '@/watch/uploaded-release';
import {UploadedReleaseBrief} from './UploadedReleaseBrief';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/motion/select';
import {Box,ChevronRight,Download} from 'lucide-react';
import {ListPagination} from './ListPagination';
import {parsePageSize,type PageSize} from '@/watch/pagination';

const sourceLabel=(upload:Upload)=>upload.source_origin_id!=null?'Website check':upload.installation_id?'GitHub-connected artifact':'Uploaded artifact';
const evidenceSummary=(upload:Upload)=>upload.report_json?`${upload.report_json.fileCount} files · ${upload.report_json.findings.length} findings`:'No completed report recorded';

export function UploadedReleases({search,installationId,collection='attempts'}:{search:string;installationId?:number|null;collection?:'uploads'|'attempts'}) {
  const params=new URLSearchParams(search);
  return <UploadedReleaseScope key={`${params.get('workspace')??'legacy'}:${installationId??'none'}:${collection}`} search={search} installationId={installationId} collection={collection}/>;
}
function UploadedReleaseScope({search,installationId,collection='attempts'}:{search:string;installationId?:number|null;collection?:'uploads'|'attempts'}) {
  const params=new URLSearchParams(search);
  const urlQuery=params.get('uploadQuery')??'';
  const [input,setInput]=useState({urlQuery,value:urlQuery});
  if(input.urlQuery!==urlQuery)setInput({urlQuery,value:urlQuery});
  const query=input.urlQuery===urlQuery?input.value:urlQuery;
  const searchQuery=query.trim();
  const [retry,setRetry]=useState(0);
  const before=params.get('uploadBefore');
  const selectedId=params.get('upload');
  const workspaceId=params.get('workspace');
  const fullDetail=params.get('uploadView')==='detail';
  const statusFilter=params.get('uploadStatus')??'all';
  const pageSize=parsePageSize(params.get('uploadPageSize')) as PageSize;
  const identity=JSON.stringify([installationId,workspaceId,collection,before,statusFilter,pageSize,searchQuery,selectedId,retry]);
  const [data,setData]=useState<{identity:string;uploads:Upload[];linked:Upload|null;nextCursor:string|null;error:string|null}|null>(null);
  const current=data?.identity===identity?data:null;
  const loading=current===null,error=current?.error??null,uploads=current?.uploads??[],nextCursor=current?.nextCursor??null;
  let trail:(string|null)[]=[null];
  if(before){
    try{const parsed:unknown=JSON.parse(params.get('uploadTrail')??'');if(Array.isArray(parsed)&&parsed.length<=50&&parsed[0]===null&&parsed.at(-1)===before&&parsed.every(value=>value===null||typeof value==='string'&&value.length>0&&value.length<=128))trail=parsed;else trail=[null,before];}catch{trail=[null,before];}
  }
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try {
        const requestQuery=new URLSearchParams();if(installationId)requestQuery.set('installationId',String(installationId));if(workspaceId)requestQuery.set('workspaceId',workspaceId);
        if(before)requestQuery.set('before',before);if(statusFilter!=='all')requestQuery.set('status',statusFilter);requestQuery.set('collection',collection);requestQuery.set('pageSize',String(pageSize));if(searchQuery)requestQuery.set('q',searchQuery);
        const response=await fetch(`/api/uploads?${requestQuery}`,{signal:controller.signal});
        if(!response.ok){const failure=await response.json().catch(()=>null);throw new Error(typeof failure?.error==='string'?failure.error:'Could not load uploaded releases.');}
        const body=await response.json() as {uploads:Upload[];nextCursor?:string|null};
        if(!Array.isArray(body.uploads)||body.nextCursor!=null&&typeof body.nextCursor!=='string')throw new Error('Release history was incomplete. Try again.');
        let linked:Upload|null=null;
        if(selectedId && !body.uploads.some(upload=>upload.id===selectedId)) {
          const detail=await fetch(`/api/uploads/${encodeURIComponent(selectedId)}`,{signal:controller.signal});
          if(detail.ok) {
            const payload=await detail.json() as {upload:Upload};
            if(payload.upload?.id===selectedId&&(installationId == null || payload.upload.installation_id === installationId) && (!workspaceId || payload.upload.workspace_id===workspaceId))linked=payload.upload;
          } else if(detail.status!==404 && detail.status!==403) throw new Error('Could not refresh the selected release. Try again.');
        }
        if(controller.signal.aborted)return;
        setData({identity,uploads:body.uploads,linked,nextCursor:body.nextCursor??null,error:null});
        if([...body.uploads,...(linked?[linked]:[])].some(u=>u.status==='queued'||u.status==='running'))timer=setTimeout(()=>void refresh(),2000);
      } catch(err){if(!controller.signal.aborted)setData({identity,uploads:[],linked:null,nextCursor:null,error:err instanceof Error?err.message:'Could not load uploads.'});}
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[installationId,selectedId,workspaceId,before,statusFilter,collection,pageSize,searchQuery,identity]);
  const label=(u:Upload)=>uploadVerdict(u.status,u.report_json);
  const select=(id:string)=>{const p=new URLSearchParams(search);p.set('upload',id);p.delete('release');p.delete('preview');p.delete('uploadFinding');p.delete('uploadTab');p.delete('uploadView');navigate(`/watch/releases?${p}`);};
  const newScan=()=>{const p=new URLSearchParams();if(installationId)p.set('install',String(installationId));if(workspaceId)p.set('workspace',workspaceId);p.set('mode','package');navigate(`/watch/scan${p.size?`?${p}`:''}`);};
  const openBrief=()=>{if(!selected)return;const p=new URLSearchParams(search);p.set('upload',selected.id);p.set('uploadView','detail');p.delete('release');p.delete('preview');navigate(`/watch/releases?${p}`);};
  const back=()=>{const p=new URLSearchParams(search);p.delete('uploadView');navigate(`/watch/releases?${p}`);};
  const clearSelection=(p:URLSearchParams)=>{for(const key of ['upload','uploadView','uploadFinding','uploadTab'])p.delete(key);};
  const page=(nextTrail:(string|null)[],size=pageSize)=>{const p=new URLSearchParams(search),cursor=nextTrail.at(-1);if(cursor){p.set('uploadBefore',cursor);p.set('uploadTrail',JSON.stringify(nextTrail));}else {p.delete('uploadBefore');p.delete('uploadTrail');}p.set('uploadPageSize',String(size));clearSelection(p);navigate(`/watch/releases?${p}`);};
  const searchBuilds=(value:string)=>{setInput({urlQuery,value});const p=new URLSearchParams(search);if(value)p.set('uploadQuery',value);else p.delete('uploadQuery');p.delete('uploadBefore');p.delete('uploadTrail');clearSelection(p);window.history.replaceState({},'',`/watch/releases?${p}`);window.dispatchEvent(new PopStateEvent('popstate'));};
  const filtered=uploads.filter(upload=>collection==='attempts'?upload.status!=='done':upload.status==='done').filter(upload=>upload.target.toLowerCase().includes(searchQuery.toLowerCase())).filter(upload=>statusFilter==='all'||(statusFilter==='active'?['queued','running'].includes(upload.status):statusFilter==='attention'?['Scan failed','Inconclusive','Review findings','Result unavailable'].includes(label(upload)):statusFilter==='passed'?label(upload).startsWith('Policy passed'):true));
  const selected=selectedId?uploads.find(u=>u.id===selectedId)??current?.linked:filtered[0];
  if(fullDetail && selected && !loading && !error)return <UploadedReleaseBrief key={selected.id} upload={selected} search={search} onBack={back} onNewScan={newScan}/>;
  const decision=selected?uploadedReleaseDecision(selected):null;
  const productionState=selected?.source_origin_id==null?'Unobserved':selected.status==='done'&&selected.report_json?'Observed':selected.status==='queued'||selected.status==='running'?'Pending':'Unavailable';
  return <section className="uploaded-releases upload-history" aria-label="Uploaded releases">

    {!fullDetail?<div className="upload-history-toolbar"><input type="search" aria-label="Find a build" placeholder="Find a build…" value={query} maxLength={200} onChange={event=>searchBuilds(event.target.value)}/><div className="flex items-center gap-2"><span className="text-sm text-mute">Status</span><Select value={statusFilter} onValueChange={value=>{const p=new URLSearchParams(search);p.set('uploadStatus',value);p.delete('uploadBefore');p.delete('uploadTrail');clearSelection(p);navigate(`/watch/releases?${p}`);}}><SelectTrigger aria-label="Status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All results</SelectItem>{collection==='attempts'?<SelectItem value="active">Queued or running</SelectItem>:null}<SelectItem value="attention">Needs attention</SelectItem>{collection==='uploads'?<SelectItem value="passed">Policy passed</SelectItem>:null}</SelectContent></Select></div></div>:<Button variant="outline" onClick={back}>Back to releases</Button>}
    {loading?<WatchSkeleton variant="list" className="mt-4" />:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>Try again</button></div>:uploads.length===0&&!selected?<p className="text-mute">{selectedId?'This upload is unavailable in the current workspace. Select another release.':before||statusFilter!=='all'||searchQuery?'No releases match this filter or page. Choose another status or return to the newest releases.':'Upload a package or build to create your first release. A GitHub installation is optional.'}</p>:
    <div className="journey-release-results"><div className="journey-release-table-wrap"><table className="journey-release-table journey-upload-table"><thead><tr><th>Result</th><th>Build</th><th>Scanned</th><th>Files</th></tr></thead><tbody>{filtered.map(u=><tr key={u.id} className={selected?.id===u.id?'is-selected':undefined} aria-current={selected?.id===u.id?'true':undefined} onClick={event=>{if(!(event.target as HTMLElement).closest('button,a'))select(u.id);}}><td><span className={`journey-result-status is-${uploadedReleaseDecision(u).tone}`}>{label(u)}</span></td><td><button className="journey-build-name" onClick={()=>select(u.id)}><Box className="size-4" aria-hidden/><span><strong>{u.target}</strong><small>{sourceLabel(u)}</small></span></button></td><td>{new Date(u.created_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>{u.report_json?.fileCount??'—'}<ChevronRight className="row-go" aria-hidden/></td></tr>)}</tbody></table>{!filtered.length?<p className="upload-evidence-empty">No results match this status or search. Change the filter to see other releases.</p>:null}</div>
      {selected?<article className={`uploaded-detail rel-panel is-${decision!.tone}`} aria-live="polite">
        <div className="rel-panel-head"><h3 className="rel-panel-title">{selected.target}</h3><p className="rel-panel-sub">{sourceLabel(selected)} · {new Date(selected.created_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p></div>
        <p className="rel-panel-verdict"><span className={`journey-result-status is-${decision!.tone}`}>{label(selected)}</span><span>{decision!.title}</span></p>
        {!filtered.some(upload=>upload.id===selected.id)?<p role="status" className="rel-panel-note">This linked attempt is outside the selected status filter or history page. Change the filter or page to include it in the list.</p>:null}
        {selected.status==='failed'||selected.report_json?.status==='inconclusive'?<p className="rel-panel-note">{decision!.detail}</p>:null}
        <dl className="rel-panel-kv" aria-label="Recorded evidence lanes">
          <dt>Artifact inspection</dt><dd><span className={`rel-pill is-${decision!.tone}`} title={evidenceSummary(selected)}><i/>{decision!.tone==="blocked"?"Needs action":label(selected)}</span></dd>
          <dt>Source identity</dt><dd><span className={`rel-pill ${selected.artifact_sha256?'':'is-pending'}`} title={selected.artifact_sha256??undefined}><i/>{selected.artifact_sha256?`sha256 ${selected.artifact_sha256.slice(0,10)}`:'Unrecorded'}</span></dd>
          <dt>Production delivery</dt><dd><span className={`rel-pill ${productionState==='Observed'?'':'is-pending'}`}><i/>{productionState}</span></dd>
          <dt>Release approval</dt><dd><span className={`rel-pill is-${decision!.tone}`}><i/>{decision!.tone==='ready'?'Ready to approve':decision!.tone==='blocked'?'Blocked':'No decision yet'}</span></dd>
        </dl>
        {!selected.artifact_sha256?<p className="rel-panel-note">Exact artifact identity was not recorded for this attempt.</p>:null}
        <p className="rel-panel-note">Production delivery is assessed separately from artifact inspection.</p>
        <div className="rel-panel-actions">
          <Button onClick={openBrief}>Open full release check</Button>
          {selected.receipt_json!=null?<Button variant="outline" onClick={()=>downloadUploadedRecord(selected)} aria-label="Download signed scan record"><Download className="size-3.5" aria-hidden/>Signed record</Button>:null}
          {(selected.status==='failed'||selected.status==='done')?<Button variant="outline" disabled={selected.source_origin_id!=null&&!workspaceId} onClick={()=>{if(selected.source_origin_id!=null){if(workspaceId)navigate(`/watch/sources?${new URLSearchParams({workspace:workspaceId,configure:'website'})}`);}else newScan();}}>{selected.source_origin_id!=null?'Open website controls':'Upload a new attempt'}</Button>:null}
        </div>
      </article>:selectedId?<article className="uploaded-detail rel-panel" aria-live="polite"><p className="rel-panel-note">This upload is unavailable in the current workspace. Select another release.</p></article>:null}</div>}
    {!fullDetail&&!loading&&!error&&(filtered.length>10||before||nextCursor||pageSize>10)?<ListPagination label="Builds" pageSize={pageSize} onPageSizeChange={size=>page([null],size)} page={trail.length-1} count={filtered.length} hasPrevious={before!==null} hasNext={nextCursor!==null} onPrevious={()=>page(trail.slice(0,-1))} onNext={()=>{if(nextCursor)page([...trail,nextCursor]);}}/>:null}
  </section>;
}
