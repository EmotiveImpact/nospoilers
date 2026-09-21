import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/motion/select';
import {WatchSkeleton} from '@/components/WatchDataState';
import {navigate} from '@/nav';
import type {Repo,TenantJob} from '@/watch/types';

type Props={installationId:string;search:string;disabledReason:string|null};
function openWatchLink(event:MouseEvent<HTMLAnchorElement>){
  if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute('href')!);
}
export function GithubRepositoryScan(props:Props){
  return <RepositoryScan key={`${props.installationId}:${new URLSearchParams(props.search).get('workspace')}`} {...props}/>;
}
function RepositoryScan({installationId,search,disabledReason}:Props){
  const [repos,setRepos]=useState<Repo[]|null>(null),[selected,setSelected]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const [jobId,setJobId]=useState<number|null>(null),[progressRetry,setProgressRetry]=useState(0),[progressError,setProgressError]=useState('');
  const [pendingRepositories,setPendingRepositories]=useState<Set<string>>(()=>new Set());
  const active=useRef(true),submitting=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/repos?installationId=${encodeURIComponent(installationId)}`,{signal:controller.signal,credentials:'include'}).then(async response=>{
      const body=await response.json();
      if(!response.ok||!Array.isArray(body.repos)||body.repos.some((repo:Repo)=>!Number.isSafeInteger(repo.id)||typeof repo.full_name!=='string'))throw new Error('Could not load accessible repositories.');
      if(!controller.signal.aborted)setRepos(body.repos);
    }).catch(()=>{if(!controller.signal.aborted){setRepos(null);setError('Could not load accessible repositories.');}});
    return()=>controller.abort();
  },[installationId,retry]);
  useEffect(()=>{
    if(jobId===null)return;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let checks=0;
    async function poll(){
      try{
        const response=await fetch(`/api/jobs?installationId=${encodeURIComponent(installationId)}`,{signal:controller.signal,credentials:'include'});
        const body=await response.json();if(controller.signal.aborted)return;
        if(!response.ok||!Array.isArray(body.jobs))throw new Error();
        const job=body.jobs.find((row:TenantJob)=>row.id===jobId&&String(row.installationId)===installationId&&row.kind==='scan_latest_release') as TenantJob|undefined;
        if(!job){setNotice('');setProgressError('This check is no longer in recent activity. Review saved releases and source alerts; its result is not confirmed here.');return;}
        if(job.status==='done'||job.status==='failed'){
          setPendingRepositories(previous=>{const next=new Set(previous);next.delete(selected);return next;});
          if(job.status==='done')setNotice('Release check finished. Review saved releases or source alerts for its outcome. Completion does not mean the release passed.');
          else{setNotice('');setProgressError('The release check failed. Review source alerts and repository setup before submitting another check.');}
          return;
        }
        if(!['queued','running'].includes(job.status)){setNotice('');setProgressError('The check has an unrecognised state. Review current activity before retrying.');return;}
        setNotice(job.status==='running'?'Checking the latest release. No completed result is available yet.':'Release check queued. Waiting for the worker; no completed result is available yet.');
        if(++checks>=40){setProgressError('This check is still pending. You can leave this page or check progress again.');return;}
        timer=setTimeout(()=>void poll(),3000);
      }catch{if(!controller.signal.aborted){setNotice('');setProgressError('Could not refresh check progress. The check may still be running.');}}
    }
    void poll();return()=>{controller.abort();if(timer)clearTimeout(timer);};
  },[jobId,installationId,progressRetry,selected]);
  const repo=repos?.find(row=>String(row.id)===selected);
  const params=new URLSearchParams({install:installationId});
  const workspaceId=new URLSearchParams(search).get('workspace');if(workspaceId)params.set('workspace',workspaceId);
  const setup=new URLSearchParams(params);setup.set('configure','github');if(repo)setup.set('source',`repo-${repo.id}`);
  const alerts=new URLSearchParams(params);if(repo)alerts.set('source',`repo-${repo.id}`);
  const releases=new URLSearchParams(params);releases.set('releaseView','connected');
  async function scan(){
    if(!repo||disabledReason||submitting.current||pendingRepositories.has(selected))return;
    submitting.current=true;setBusy(true);setError('');setNotice('');setProgressError('');setJobId(null);
    setPendingRepositories(previous=>new Set(previous).add(selected));
    try{
      const response=await fetch(`/api/repos/${repo.id}/scan-latest-release`,{method:'POST',credentials:'include'});
      const body=await response.json();if(!active.current)return;
      // These endpoint guards reject before enqueueing. A lost response, 5xx,
      // or malformed body may follow acceptance, so must not unlock a duplicate.
      if([400,401,402,403,404,409,429].includes(response.status)&&typeof body?.error==='string'&&body.error.trim()&&body.ok!==true){
        setPendingRepositories(previous=>{const next=new Set(previous);next.delete(selected);return next;});
        throw new Error(body.error);
      }
      if(!response.ok||body.ok!==true||typeof body.queued!=='boolean')throw new Error(body.error??'The server did not confirm the scan. Check Releases before retrying.');
      setNotice(body.queued?'Release check queued. This is not a completed scan or a passing result.':'No new scan was queued. Check existing work in Releases before retrying.');
      if(Number.isSafeInteger(body.jobId)&&body.jobId>0){setProgressError('');setJobId(body.jobId);}
    }catch(reason){if(active.current)setError(reason instanceof Error?reason.message:'Could not start the release check.');}
    finally{submitting.current=false;if(active.current)setBusy(false);}
  }
  const chooseRepository=(value:string)=>{setSelected(value);setNotice('');setError('');setJobId(null);setProgressError('');};
  return <section className="scan-repository-picker" aria-label="Choose repository to scan">
    <div className="scan-repository-heading"><h3>Re-check a connected release</h3><p>Connected repositories are watched automatically. Choose one here only when you want to check its latest published release again now.</p></div>
    {repos===null&&!error?<WatchSkeleton variant="list"/>:null}
    {repos?<>{repos.length?<><div className="scan-repository-controls"><div><span className="scan-field-label">Repository</span><Select value={selected||undefined} onValueChange={chooseRepository} disabled={busy}><SelectTrigger aria-label="Repository"><SelectValue placeholder="Choose a connected repository"/></SelectTrigger><SelectContent>{repos.map(row=><SelectItem key={row.id} value={String(row.id)}>{row.full_name}</SelectItem>)}</SelectContent></Select></div>
      <Button disabled={!repo||!!disabledReason||busy||pendingRepositories.has(selected)} onClick={()=>void scan()}>{busy?'Queuing release check…':'Scan latest release'}</Button></div>
    </>:<p>No connected repositories are available. Add repository access to this GitHub installation first.</p>}</>:null}
    {disabledReason?<p className="text-sm text-mute">{disabledReason}</p>:null}
    {error?<div role="alert"><p>{error}</p>{!repos?<Button variant="outline" onClick={()=>{setError('');setRetry(value=>value+1);}}>Retry repositories</Button>:null}</div>:null}
    {notice?<p role="status">{notice}</p>:null}
    {progressError?<div role="alert"><p>{progressError}</p><Button variant="outline" onClick={()=>{setProgressError('');setProgressRetry(value=>value+1);}}>Check progress again</Button></div>:null}
    <div className="scan-repository-links"><a href={`/watch/releases?${releases}`} onClick={openWatchLink}>View releases and scan progress</a>{repo?<a href={`/watch/alerts?${alerts}`} onClick={openWatchLink}>View this repository’s alerts</a>:null}<a href={`/watch/sources?${setup}`} onClick={openWatchLink}>Repository setup and prerequisites</a></div>
  </section>;
}
