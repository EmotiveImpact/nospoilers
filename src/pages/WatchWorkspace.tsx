import { useWatchWorkspaceController } from "@/watch/useWatchWorkspaceController";
import {WorkspaceBoundary} from '@/components/watch/WorkspaceBoundary';
import {WorkspaceEntry} from '@/components/watch/WorkspaceEntry';

export function WatchWorkspace({ path = "/watch", search }: { path?: string; search: string }) {
  const workspace=new URLSearchParams(search).get('workspace');
  if(workspace)return <WorkspaceBoundary key={workspace} id={workspace} path={path} search={search} legacy={(resolvedSearch,connectionIds)=><LegacyWorkspace key={new URLSearchParams(resolvedSearch).get('install')??'personal'} path={path} search={resolvedSearch} connectionIds={connectionIds}/>}/>;
  if(path==='/watch/workspaces')return <LegacyWorkspace key="workspace-management" path={path} search={search}/>;
  return <WorkspaceEntry key={`${path}${search}`} path={path} search={search} login={()=><LegacyWorkspace path={path} search={search}/>}/>;
}

function LegacyWorkspace({path,search,connectionIds}:{path:string;search:string;connectionIds?:number[]}){
  return useWatchWorkspaceController({ path, search, connectionIds });
}
