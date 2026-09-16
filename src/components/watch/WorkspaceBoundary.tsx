import {useEffect,useState,type ReactNode} from 'react';
import {WatchLoadingSignal} from './WatchLighthouse';
import {WatchMonolithShell} from '@/components/WatchMonolithShell';
import {WatchCommandPalette} from '@/components/WatchCommandPalette';
import {ScanPage} from '@/pages/ScanPage';
import {ArtifactOverview} from './ArtifactOverview';
import {WorkspaceReleaseCollection} from './WorkspaceReleaseCollection';
import {WorkspaceManagement} from './WorkspaceManagement';
import {WorkspaceTeam} from './WorkspaceTeam';
import {WorkspaceEvidenceSettings} from './WorkspaceEvidenceSettings';
import {WorkspaceTokens} from './WorkspaceTokens';
import {WorkspaceNotifications} from './WorkspaceNotifications';
import {WorkspaceScanPolicy} from './WorkspaceScanPolicy';
import {coverageFrom} from '@/coverage';
import {parseWatchRoute} from '@/watch/routes';
import {workspaceInstallationIds,type ProductWorkspace} from '@/watch/workspace-types';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {GithubConnectionReturn} from './GithubWorkspaceConnection';
import {WorkspaceCoverageEmpty} from './WorkspaceCoverageEmpty';
import {WorkspaceAlerts} from './WorkspaceAlerts';

export function WorkspaceBoundary({id,path,search,legacy}:{id:string;path:string;search:string;legacy:(search:string,connectionIds?:number[])=>ReactNode}){
  const [state,setState]=useState<{workspace:ProductWorkspace;login:string;connectionIds:number[]}|'loading'|'login'|'unavailable'>('loading');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();void Promise.all([fetch('/api/workspaces',{signal:controller.signal}),fetch('/api/me',{signal:controller.signal})]).then(async([response,me])=>{
    if(response.status===401){if(!controller.signal.aborted)setState('login');return;}
    if(!response.ok||!me.ok)throw new Error('Unavailable');
    const [body,session]=await Promise.all([response.json() as Promise<{workspaces:ProductWorkspace[]}>,me.json() as Promise<{user:{login:string}|null;installations?:{id:number;role:string}[]}>]);
    const workspace=body.workspaces.find(row=>row.id===id);if(!workspace||!session.user)throw new Error('Unavailable');
    const connectionIds=workspaceInstallationIds(workspace).filter(id=>session.installations?.some(row=>Number(row.id)===id&&row.role===(workspace.role==='owner'?'admin':workspace.role)));
    if(!controller.signal.aborted)setState({workspace,login:session.user.login,connectionIds});
  }).catch(()=>{if(!controller.signal.aborted)setState('unavailable');});return()=>controller.abort();},[id,retry]);
  if(state==='login')return legacy(search);
  if(state==='loading')return <main className="workspace-gate" aria-busy="true"><WatchLoadingSignal/></main>;
  if(state==='unavailable')return <main className="workspace-gate"><h1>Workspace unavailable</h1><p>It may be outside your access, or the workspace service could not be reached. No other workspace’s evidence is substituted.</p><Button onClick={()=>{setState('loading');setRetry(value=>value+1);}}>Retry</Button><Button variant="outline" onClick={()=>navigate('/watch/workspaces')}>Choose another workspace</Button></main>;
  const requested=new URLSearchParams(search).get('install');
  if(requested&&!state.connectionIds.includes(Number(requested)))return <main className="workspace-gate"><h1>Source unavailable in this workspace</h1><p>Choose a source belonging to this workspace. Another source’s evidence has not been substituted.</p><Button onClick={()=>navigate(`/watch?workspace=${encodeURIComponent(id)}`)}>Open workspace</Button></main>;
  if(state.connectionIds.length){
    const params=new URLSearchParams(search);params.set('install',requested??String(state.connectionIds[0]));
    return legacy(`?${params}`,state.connectionIds);
  }
  return <ArtifactWorkspace workspace={state.workspace} login={state.login} path={path} search={search}/>;
}

function ArtifactWorkspace({workspace,login,path,search}:{workspace:ProductWorkspace;login:string;path:string;search:string}){
  const [palette,setPalette]=useState(false);
  const coverage=coverageFrom(workspace.trial_ends_at,workspace.plan),route=parseWatchRoute(path,search);
  // Independent artifact workspaces contain no installation-owned sources. Never fetch another
  // installation's datasets just to fill this empty workspace.
  const params=new URLSearchParams(search);params.delete('install');const scopedSearch=`?${params}`;
  const evidenceSettings=route.view==='notifications'?<WorkspaceNotifications workspaceId={workspace.id}/>:route.view==='tokens'?<WorkspaceTokens workspaceId={workspace.id}/>:route.view==='alerts'?<WorkspaceAlerts workspaceId={workspace.id} search={scopedSearch}/>:params.get('githubReturn')==='1'?<GithubConnectionReturn/>:route.view==='sources'?<WorkspaceCoverageEmpty workspace={workspace}/>:route.view==='policy'?<WorkspaceScanPolicy workspaceId={workspace.id}/>:route.view==='retention'||route.view==='audit'?<WorkspaceEvidenceSettings key={`${workspace.id}:${route.view}`} workspaceId={workspace.id} view={route.view}/>:null;
  return <WatchMonolithShell route={route} search={scopedSearch} coverage={coverage} ended={coverage.status==='ended'} role={workspace.role==='viewer'?'viewer':workspace.role==='member'?'member':'admin'} teamOnly={false} adminOnly={false} login={login} sourceCount={0} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={0} setupTotal={0} firstRun artifactOnly installations={[]} activeInstallId={null} onInstall={()=>{}} onOpenPalette={()=>setPalette(true)}>
    <WatchCommandPalette open={palette} search={scopedSearch} teamOnly={false} adminOnly={false} artifactOnly alerts={[]} sources={[]} releases={[]} onClose={()=>setPalette(false)}/>
    {workspace.archived_at?<div className="watch-empty" role="status"><p>This workspace is archived. Saved evidence remains readable; restore the workspace before scanning.</p><Button className="mt-4" variant="outline" onClick={()=>navigate('/watch/workspaces')}>Open workspace settings</Button></div>:null}
    {evidenceSettings??(route.view==='team'?<WorkspaceTeam workspaceId={workspace.id}/>:route.view==='overview'?<ArtifactOverview workspaceId={workspace.id} search={scopedSearch} nowLabel={new Date().toLocaleDateString()}/>:route.view==='releases'?<WorkspaceReleaseCollection search={scopedSearch} canScan={!workspace.archived_at}/>:route.view==='scan'?<ScanPage search={scopedSearch} embedded workspace={workspace}/>:route.view==='workspaces'?<WorkspaceManagement/>:<section className="watch-empty"><h1 className="watch-page-title">{route.view==='alerts'?'No monitored exposure alerts':route.view==='sources'?'No ongoing connections':'Connection settings'}</h1><p>This workspace currently contains artifact scans only. Uploads produce release evidence; they do not create ongoing monitoring or repository alerts.</p><p>GitHub connection and monitoring settings remain available in GitHub-connected workspaces while their independent-workspace migration is completed.</p><Button className="mt-4" variant="outline" onClick={()=>navigate(`/watch/releases${scopedSearch}`)}>View this workspace’s releases</Button></section>)}
  </WatchMonolithShell>;
}
