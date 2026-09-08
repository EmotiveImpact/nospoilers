import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';

const fail=(message:string,status:400|403|404|409):never=>{throw Object.assign(new Error(message),{status});};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Narrow transition contract: place an unused installation inside its existing
 * organisation. Existing evidence cannot move until every resource is workspace-owned. */
export async function moveUnusedWorkspaceConnection(sql:SqlClient,userId:string,installationId:number,sourceWorkspaceId:string,destinationWorkspaceId:string){
  if(!Number.isSafeInteger(installationId)||installationId<=0)fail('Choose a valid connection.',400);
  if(!uuid.test(sourceWorkspaceId)||!uuid.test(destinationWorkspaceId))fail('Workspace unavailable.',404);
  if(sourceWorkspaceId===destinationWorkspaceId)fail('Choose a different destination workspace.',400);
  return sql.transaction(async tx=>{
    const {rows:workspaces}=await tx.query<{id:string;organization_id:string;archived_at:string|null}>(
      'SELECT id,organization_id,archived_at FROM product_workspaces WHERE id IN ($1,$2) ORDER BY id FOR UPDATE',
      [sourceWorkspaceId,destinationWorkspaceId]);
    if(workspaces.length!==2)fail('Workspace unavailable.',404);
    const source=workspaces.find(w=>w.id===sourceWorkspaceId)!;
    const destination=workspaces.find(w=>w.id===destinationWorkspaceId)!;
    if(source.organization_id!==destination.organization_id)fail('Connections cannot move between organisations.',409);
    if(workspaces.some(w=>w.archived_at))fail('Both workspaces must be active.',409);
    const {rows:authority}=await tx.query(`SELECT o.id FROM product_organizations o
      JOIN product_organization_members a ON a.organization_id=o.id AND a.user_id=$2 AND a.role IN ('owner','admin')
      WHERE o.id=$1 AND 2=(SELECT count(*) FROM product_workspace_members m
        LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
        WHERE m.user_id=$2 AND m.workspace_id IN ($3,$4)
        AND CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END IN ('owner','admin')) FOR SHARE OF o`,
      [source.organization_id,userId,sourceWorkspaceId,destinationWorkspaceId]);
    if(!authority.length)fail('Organisation and both workspace administrator permissions are required.',403);
    const {rows:connections}=await tx.query(`SELECT i.id FROM installations i
      JOIN product_workspace_installations c ON c.installation_id=i.id AND c.workspace_id=$2
      JOIN installation_users u ON u.installation_id=i.id AND u.user_id=$3 AND u.role='admin'
      JOIN billing_accounts b ON b.installation_id=i.id AND b.organization_id=$4
      WHERE i.id=$1 AND NOT i.suspended AND i.disconnected_at IS NULL FOR UPDATE OF i,c`,[installationId,sourceWorkspaceId,userId,source.organization_id]);
    if(!connections.length)fail('An active connection with administrator access is required.',403);

    // Fail closed as the schema grows. Every installation-scoped resource counts,
    // including credentials, invitations, configuration and historical evidence.
    // Only stable billing bookkeeping and the membership/mapping projection are exempt.
    const {rows:tables}=await tx.query<{table_name:string}>(`SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
      WHERE c.table_schema='public' AND c.column_name='installation_id'
      AND c.table_name NOT IN ('billing_accounts','hosted_usage_days','installation_users','product_workspace_installations','product_connection_events')
      ORDER BY c.table_name`);
    const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
    // Serialise the uncommon placement operation with resource writers. In particular,
    // jobs reference billing rather than installations and do not take an installation FK lock.
    for(const table of tables)await tx.query(`LOCK TABLE ${quote(table.table_name)} IN SHARE ROW EXCLUSIVE MODE`);
    for(const table of tables){
      if((await tx.query(`SELECT 1 FROM ${quote(table.table_name)} WHERE installation_id=$1 LIMIT 1`,[installationId])).rows.length)
        fail('This connection has resources or history. Existing evidence cannot be moved; keep it in its current workspace.',409);
    }
    // Snapshot legacy roles before replacing source API access. Old workspace evidence
    // remains governed by its original membership, not by the moved installation.
    await tx.query(`UPDATE product_workspace_members m SET role=legacy.role,access_source='explicit'
      FROM product_workspaces w,product_organizations o,installation_users legacy
      WHERE w.id=m.workspace_id AND o.id=w.organization_id AND legacy.installation_id=o.legacy_installation_id
      AND legacy.user_id=m.user_id AND m.access_source='legacy' AND w.organization_id=$1`,[source.organization_id]);
    await tx.query('DELETE FROM installation_users WHERE installation_id=$1',[installationId]);
    await tx.query(`INSERT INTO installation_users(installation_id,user_id,role)
      SELECT $1,user_id,CASE WHEN role='owner' THEN 'admin' ELSE role END FROM product_workspace_members WHERE workspace_id=$2`,[installationId,destinationWorkspaceId]);
    await tx.query('UPDATE product_workspace_installations SET workspace_id=$2,explicitly_assigned=true WHERE installation_id=$1',[installationId,destinationWorkspaceId]);
    await tx.query(`INSERT INTO product_connection_events(id,installation_id,source_workspace_id,destination_workspace_id,actor_user_id)
      VALUES($1,$2,$3,$4,$5)`,[randomUUID(),installationId,sourceWorkspaceId,destinationWorkspaceId,userId]);
    return {installationId,workspaceId:destinationWorkspaceId,previousWorkspaceId:sourceWorkspaceId};
  });
}
