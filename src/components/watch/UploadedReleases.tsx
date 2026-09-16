import './design/release-journey.css';
import { WatchSkeleton } from "@/components/WatchDataState";
import { useEffect, useState } from 'react';
import { navigate } from '@/nav';
import { uploadVerdict } from '@/watch/upload-verdict';
import {downloadUploadedRecord,uploadedReleaseDecision,type UploadedRelease as Upload} from '@/watch/uploaded-release';
import {UploadedReleaseBrief} from './UploadedReleaseBrief';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/motion/select';
import {ArrowRight,Box,Clock3} from 'lucide-react';

export function UploadedReleases({search,installationId,collection='attempts'}:{search:string;installationId?:number|null;collection?:'uploads'|'attempts'}) {
  const params=new URLSearchParams(search);
  return <UploadedReleaseScope key={`${params.get('workspace')??'legacy'}:${installationId??'none'}:${params.get('uploadBefore')??''}:${params.get('uploadStatus')??'all'}`} search={search} installationId={installationId} collection={collection}/>;
}
function UploadedReleaseScope({search,installationId,collection='attempts'}:{search:string;installationId?:number|null;collection?:'uploads'|'attempts'}) {
  const [query,setQuery]=useState('');
  const [uploads,setUploads]=useState<Upload[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const before=new URLSearchParams(search).get('uploadBefore');
  const selectedId=new URLSearchParams(search).get('upload');
  const workspaceId=new URLSearchParams(search).get('workspace');
  const fullDetail=new URLSearchParams(search).get('uploadView')==='detail';
  const statusFilter=new URLSearchParams(search).get('uploadStatus')??'all';
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      try {
        const query=new URLSearchParams();if(installationId)query.set('installationId',String(installationId));if(workspaceId)query.set('workspaceId',workspaceId);
        if(before)query.set('before',before);if(statusFilter!=='all')query.set('status',statusFilter);
        const response=await fetch(`/api/uploads${query.size?`?${query}`:''}`,{signal:controller.signal});
        if(!response.ok){const failure=await response.json().catch(()=>null);throw new Error(typeof failure?.error==='string'?failure.error:'Could not load uploaded releases.');}
        const body=await response.json() as {uploads:Upload[];nextCursor?:string|null};
        if(selectedId && !body.uploads.some(upload=>upload.id===selectedId)) {
          const detail=await fetch(`/api/uploads/${encodeURIComponent(selectedId)}`,{signal:controller.signal});
          if(detail.ok) {
            const payload=await detail.json() as {upload:Upload};
            if((installationId == null || payload.upload.installation_id === installationId) && (!workspaceId || payload.upload.workspace_id===workspaceId)) body.uploads.push(payload.upload);
          } else if(detail.status!==404 && detail.status!==403) throw new Error('Could not refresh the selected release. Try again.');
        }
        if(controller.signal.aborted)return;
        setUploads(body.uploads);setNextCursor(body.nextCursor??null);setError(null);setLoading(false);
        if(body.uploads.some(u=>u.status==='queued'||u.status==='running'))timer=setTimeout(()=>void refresh(),2000);
      } catch(err){if(!controller.signal.aborted){setError(err instanceof Error?err.message:'Could not load uploads.');setLoading(false);}}
    }
    void refresh();return()=>{controller.abort();clearTimeout(timer);};
  },[installationId,retry,selectedId,workspaceId,before,statusFilter]);
  const selected=uploads.find(u=>u.id===selectedId);
  const label=(u:Upload)=>uploadVerdict(u.status,u.report_json);
  const select=(id:string)=>{const p=new URLSearchParams(search);p.set('upload',id);p.delete('release');p.delete('preview');p.delete('uploadFinding');p.delete('uploadTab');p.delete('uploadView');navigate(`/watch/releases?${p}`);};
  const newScan=()=>{const p=new URLSearchParams();if(installationId)p.set('install',String(installationId));if(workspaceId)p.set('workspace',workspaceId);navigate(`/watch/scan${p.size?`?${p}`:''}`);};
  const openBrief=()=>{if(!selected)return;const p=new URLSearchParams(search);p.set('upload',selected.id);p.set('uploadView','detail');p.delete('release');p.delete('preview');navigate(`/watch/releases?${p}`);};
  const back=()=>{const p=new URLSearchParams(search);p.delete('uploadView');navigate(`/watch/releases?${p}`);};
  const page=(cursor:string|null)=>{const p=new URLSearchParams(search);if(cursor)p.set('uploadBefore',cursor);else p.delete('uploadBefore');for(const key of ['upload','uploadView','uploadFinding','uploadTab'])p.delete(key);navigate(`/watch/releases?${p}`);};
  const filtered=uploads.filter(upload=>collection==='attempts'||upload.status==='done').filter(upload=>upload.target.toLowerCase().includes(query.toLowerCase())).filter(upload=>statusFilter==='all'||(statusFilter==='active'?['queued','running'].includes(upload.status):statusFilter==='attention'?['Scan failed','Inconclusive','Review findings','Result unavailable'].includes(label(upload)):statusFilter==='passed'?label(upload).startsWith('Policy passed'):true));
  if(fullDetail && selected && !loading && !error)return <UploadedReleaseBrief key={selected.id} upload={selected} search={search} onBack={back} onNewScan={newScan}/>;
  const decision=selected?uploadedReleaseDecision(selected):null;
  return <section className="uploaded-releases upload-history" aria-label="Uploaded releases">

    {!fullDetail?<div className="upload-history-toolbar"><input type="search" aria-label="Find a build" placeholder="Find a build…" value={query} onChange={event=>setQuery(event.target.value)}/><div className="flex items-center gap-2"><span className="text-sm text-mute">Status</span><Select value={statusFilter} onValueChange={value=>{const p=new URLSearchParams(search);p.set('uploadStatus',value);for(const key of ['uploadBefore','upload','uploadFinding','uploadTab'])p.delete(key);navigate(`/watch/releases?${p}`);}}><SelectTrigger aria-label="Status"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All results</SelectItem>{collection==='attempts'?<SelectItem value="active">Queued or running</SelectItem>:null}<SelectItem value="attention">Needs attention</SelectItem><SelectItem value="passed">Policy passed</SelectItem></SelectContent></Select></div></div>:<Button variant="outline" onClick={back}>Back to releases</Button>}
    {!fullDetail&&(before||nextCursor)?<nav className="upload-history-toolbar" aria-label="Release history pages"><Button variant="outline" disabled={!before} onClick={()=>page(null)}>Newest releases</Button><Button variant="outline" disabled={loading||!!error||!nextCursor} onClick={()=>page(nextCursor)}>Older releases</Button></nav>:null}
    {loading?<WatchSkeleton variant="list" className="mt-4" />:error?<div role="alert"><p>{error}</p><button onClick={()=>{setLoading(true);setRetry(x=>x+1);}}>Try again</button></div>:uploads.length===0?<p className="text-mute">{selectedId?'This upload is unavailable in the current workspace. Select another release.':before||statusFilter!=='all'?'No releases match this filter or page. Choose another status or return to the newest releases.':'Upload a package or build to create your first release. A GitHub installation is optional.'}</p>:
    <div className="journey-release-results"><div className="journey-release-table-wrap"><table className="journey-release-table"><thead><tr><th>Build</th><th>Scanned</th><th>Result</th><th>Files</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map(u=><tr key={u.id}><td><button className="journey-build-name" onClick={()=>select(u.id)}><Box className="size-4" aria-hidden/><span><strong>{u.target}</strong><small>{u.source_origin_id!=null?'Website check':u.installation_id?'GitHub-connected artifact':'Uploaded artifact'}</small></span></button></td><td>{new Date(u.created_at).toLocaleDateString()}</td><td><span className={`journey-result-status is-${uploadedReleaseDecision(u).tone}`}>{label(u)}</span></td><td>{u.report_json?.fileCount??'—'}</td><td><Button variant="ghost" onClick={()=>{const p=new URLSearchParams(search);p.set('upload',u.id);p.set('uploadView','detail');p.delete('release');p.delete('preview');navigate(`/watch/releases?${p}`);}}>View evidence <ArrowRight className="size-4" aria-hidden/></Button></td></tr>)}</tbody></table>{!filtered.length?<p className="upload-evidence-empty">No results match this status. Change the filter to see other releases.</p>:null}</div>
      {selectedId?<article className="uploaded-detail upload-preview" aria-live="polite">{!selected?<p>This upload is unavailable in the current workspace. Select another release.</p>:<>
        <p className="watch-kicker">Decision preview</p><h3 className="font-display text-2xl text-snow">{selected.target}</h3><div className={`upload-preview-verdict is-${decision!.tone}`}><Clock3 className="size-4" aria-hidden/><strong>{decision!.title}</strong></div>
        {!filtered.some(upload=>upload.id===selected.id)?<p role="status" className="text-sm text-mute">This linked attempt is outside the selected status filter. Its saved evidence is shown below; change the filter to include it in the list.</p>:null}
        <p className="text-mute">{decision!.detail}</p>
        <dl><div><dt>Scope</dt><dd>{selected.source_origin_id!=null?'Retrieved website assets':'Packed artifact only'}</dd></div><div><dt>Submitted</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div><div><dt>Recorded SHA-256</dt><dd><code>{selected.artifact_sha256||'Not available until processing completes'}</code></dd></div>{selected.report_json?<div><dt>Recorded evidence</dt><dd>{selected.report_json.fileCount} files · {selected.report_json.findings.length} findings</dd></div>:null}</dl>
        <Button onClick={openBrief}>Open full release brief <ArrowRight className="size-4" aria-hidden/></Button>
        {selected.receipt_json!=null?<Button variant="outline" onClick={()=>downloadUploadedRecord(selected)}>Download signed scan record</Button>:null}
        {(selected.status==='failed'||selected.status==='done')?<Button variant="ghost" disabled={selected.source_origin_id!=null&&!workspaceId} onClick={()=>{if(selected.source_origin_id!=null){if(workspaceId)navigate(`/watch/sources?${new URLSearchParams({workspace:workspaceId,configure:'website'})}`);}else newScan();}}>{selected.source_origin_id!=null?'Open website controls':'Upload a new attempt'}</Button>:null}
      </>}</article>:null}</div>}
  </section>;
}
