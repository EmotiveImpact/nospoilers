import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import type {ProductWorkspace} from '@/watch/workspace-types';
import {GithubWorkspaceConnect} from './GithubWorkspaceConnection';
import {WorkspaceWebsites} from './WorkspaceWebsites';

export function WorkspaceCoverageEmpty({workspace}:{workspace:ProductWorkspace}){
 const disabledReason=workspace.archived_at?'Restore this workspace before connecting a source.':!['owner','admin'].includes(workspace.role)?'Ask a workspace administrator to connect a source.':null;
 return <section className="watch-empty" aria-labelledby="coverage-title">
  <p className="text-xs uppercase tracking-widest text-mute">Ongoing monitoring</p>
  <h1 id="coverage-title" className="watch-page-title">Coverage</h1>
  <p>Manage connected sources in {workspace.name}. Repository monitoring and website checks keep their individual release evidence.</p>
  <div className="mt-6 rounded-lg border border-white/10 p-5">
   <h2 className="mb-3 text-lg font-semibold">Connect GitHub</h2>
   <GithubWorkspaceConnect workspaceId={workspace.id} disabledReason={disabledReason}/>
  </div>
  <WorkspaceWebsites key={workspace.id} workspaceId={workspace.id} healthFilter={new URLSearchParams(window.location.search).get('websiteHealth')??'all'} disabledReason={workspace.archived_at?'Restore this workspace before scanning.':workspace.role==='viewer'?'Viewer access is read-only.':null} initialUrl={new URLSearchParams(window.location.search).get('origin')??''}/>
  <div className="mt-6">
   <h2 className="text-lg font-semibold">Coverage and Releases do different jobs</h2>
   <p>Coverage manages connected sources. Releases keeps the results of individual checks, including uploaded packages. Uploading a package does not turn on continuous monitoring.</p>
   <Button className="mt-4" variant="outline" onClick={()=>navigate(`/watch/releases?workspace=${encodeURIComponent(workspace.id)}`)}>View saved releases</Button>
  </div>
 </section>;
}
