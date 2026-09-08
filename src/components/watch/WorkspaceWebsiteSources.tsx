import {useWatchScreenContext} from './useWatchScreenContext';
import {WorkspaceWebsites} from './WorkspaceWebsites';

/** Website sources belong to the workspace, not the selected GitHub installation. */
export function WorkspaceWebsiteSources(){
 const {route,search,locked}=useWatchScreenContext();
 const params=new URLSearchParams(search),workspaceId=params.get('workspace');
 if(route.view!=='sources'||!workspaceId)return null;
 return <WorkspaceWebsites key={workspaceId} workspaceId={workspaceId} healthFilter={params.get('websiteHealth')??'all'} initialUrl={params.get('origin')??''} disabledReason={locked?'Scanning and source changes are unavailable with the current access or plan.':null}/>;
}
