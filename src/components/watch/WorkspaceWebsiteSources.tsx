import {useWatchScreenContext} from './useWatchScreenContext';
import {WorkspaceWebsites} from './WorkspaceWebsites';
import {hasWorkspaceCoverageHealthFilter} from './WorkspaceCoverageHealth';
import {parseWatchRoute} from '@/watch/routes';

/** Website sources belong to the workspace, not the selected GitHub installation. */
export function WorkspaceWebsiteSources(){
 const {route,search,locked}=useWatchScreenContext();
 const params=new URLSearchParams(search),workspaceId=params.get('workspace');
 if(route.view!=='sources'||!workspaceId||hasWorkspaceCoverageHealthFilter(search))return null;
 const {sourceFilter,sourceConfigure}=parseWatchRoute('/watch/sources',search);
 // Only the Websites tab or an explicit website setup in All sources owns this
 // form. A leftover configure parameter must never override a different tab.
 if(sourceFilter!=='website'&&!(sourceFilter==='all'&&sourceConfigure==='website'))return null;
 return <WorkspaceWebsites key={workspaceId} workspaceId={workspaceId} healthFilter={params.get('websiteHealth')??'all'} initialUrl={params.get('origin')??''} disabledReason={locked?'Scanning and source changes are unavailable with the current access or plan.':null}/>;
}
