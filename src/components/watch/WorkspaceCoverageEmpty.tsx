import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import type {ProductWorkspace} from '@/watch/workspace-types';
import {GithubWorkspaceConnect} from './GithubWorkspaceConnection';
import {WorkspaceWebsites} from './WorkspaceWebsites';
import {WorkspaceCoverageHealth,hasWorkspaceCoverageHealthFilter} from './WorkspaceCoverageHealth';

export function WorkspaceCoverageEmpty({workspace}:{workspace:ProductWorkspace}){
 if(hasWorkspaceCoverageHealthFilter(window.location.search))return <WorkspaceCoverageHealth workspaceId={workspace.id} search={window.location.search}/>;
 const disabledReason=workspace.archived_at?'Restore this workspace before connecting a source.':!['owner','admin'].includes(workspace.role)?'Ask a workspace administrator to connect a source.':null;
 return <section className="watch-empty coverage-empty-page" aria-labelledby="coverage-title">
  <div className="coverage-empty-heading">
   <p className="text-xs uppercase tracking-widest text-mute">Ongoing monitoring</p>
   <h1 id="coverage-title" className="watch-page-title">Coverage</h1>
   <p>Connect the places you ship from. Each source keeps its own release evidence and monitoring history.</p>
  </div>
  <WorkspaceCoverageHealth workspaceId={workspace.id} search={window.location.search}/>
  <div className="coverage-empty-window">
   <section className="coverage-empty-card" aria-labelledby="coverage-github-title">
    <p className="coverage-empty-kicker">Source 01</p>
    <h2 id="coverage-github-title">Connect GitHub</h2>
    <p>Choose the repositories whose published releases you want to monitor in {workspace.name}.</p>
    <GithubWorkspaceConnect workspaceId={workspace.id} disabledReason={disabledReason}/>
   </section>
   <WorkspaceWebsites className="coverage-empty-card coverage-website-card" key={workspace.id} workspaceId={workspace.id} healthFilter={new URLSearchParams(window.location.search).get('websiteHealth')??'all'} disabledReason={workspace.archived_at?'Restore this workspace before scanning.':workspace.role==='viewer'?'Viewer access is read-only.':null} initialUrl={new URLSearchParams(window.location.search).get('origin')??''}/>
  </div>
  <div className="coverage-empty-releases">
   <div><p className="coverage-empty-kicker">Existing evidence</p><h2>Saved releases stay available</h2><p>Package uploads and completed checks live in Releases. Uploading a package does not turn on continuous monitoring.</p></div>
   <Button variant="outline" onClick={()=>navigate(`/watch/releases?workspace=${encodeURIComponent(workspace.id)}`)}>Open releases</Button>
  </div>
 </section>;
}
