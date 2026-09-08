export type ProductWorkspace={id:string;name:string;organization_id:string;organization_name?:string;archived_at:string|null;installation_id:number|string|null;installation_ids?:(number|string)[];role:string;plan?:string|null;trial_ends_at?:string|null};
export function workspaceInstallationIds(workspace:ProductWorkspace):number[]{
  return (workspace.installation_ids??(workspace.installation_id===null?[]:[workspace.installation_id])).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0);
}
