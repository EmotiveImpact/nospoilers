import type { SqlClient } from './sql.ts';
import { randomUUID } from 'node:crypto';

/** Transitional bootstrap: existing access remains authoritative until resource cutover. */
export async function ensureUserWorkspaces(sql:SqlClient,userId:string):Promise<void>{
  await sql.transaction(async tx=>{
    await tx.query(`INSERT INTO product_organizations(id,name,legacy_personal_user_id)
      SELECT md5('nospoilers:personal:'||id)::uuid,login||' personal',id FROM users WHERE id=$1 ON CONFLICT DO NOTHING`,[userId]);
    await tx.query(`INSERT INTO product_organizations(id,name,legacy_installation_id)
      SELECT md5('nospoilers:installation:'||i.id)::uuid,i.account_login,i.id FROM installations i
      JOIN installation_users m ON m.installation_id=i.id WHERE m.user_id=$1
      AND NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=i.id)
      ON CONFLICT DO NOTHING`,[userId]);
    await tx.query(`INSERT INTO product_workspaces(id,organization_id,name)
      SELECT md5('nospoilers:workspace:'||o.id)::uuid,o.id,o.name FROM product_organizations o
      WHERE o.legacy_personal_user_id=$1 OR EXISTS(SELECT 1 FROM installation_users m WHERE m.installation_id=o.legacy_installation_id AND m.user_id=$1)
      ON CONFLICT DO NOTHING`,[userId]);
    await tx.query(`INSERT INTO product_workspace_members(workspace_id,user_id,role)
      SELECT w.id,$1,CASE WHEN o.legacy_personal_user_id=$1 THEN 'owner' ELSE m.role END
      FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
      LEFT JOIN installation_users m ON m.installation_id=o.legacy_installation_id AND m.user_id=$1
      WHERE w.id=md5('nospoilers:workspace:'||o.id)::uuid AND (o.legacy_personal_user_id=$1 OR m.user_id=$1)
      AND NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=o.legacy_installation_id AND c.explicitly_assigned)
      AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$1)
      ON CONFLICT DO NOTHING`,[userId]);
    // Bootstrap only organisations without an owner. Later source grants do not confer billing control.
    await tx.query(`INSERT INTO product_organization_members(organization_id,user_id,role)
      SELECT o.id,$1,'owner' FROM product_organizations o
      WHERE NOT EXISTS(SELECT 1 FROM product_organization_members a WHERE a.organization_id=o.id)
      AND (o.legacy_personal_user_id=$1 OR EXISTS(SELECT 1 FROM product_workspace_members m
        JOIN product_workspaces w ON w.id=m.workspace_id JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
        WHERE w.organization_id=o.id AND m.user_id=$1 AND m.access_source='legacy' AND legacy.role='admin'))
      ON CONFLICT DO NOTHING`,[userId]);
    await tx.query(`INSERT INTO product_workspace_installations(installation_id,workspace_id)
      SELECT o.legacy_installation_id,w.id FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
      WHERE o.legacy_installation_id IS NOT NULL AND w.id=md5('nospoilers:workspace:'||o.id)::uuid
      AND EXISTS(SELECT 1 FROM installation_users m WHERE m.installation_id=o.legacy_installation_id AND m.user_id=$1)
      ON CONFLICT DO NOTHING`,[userId]);
  });
}

export async function listUserWorkspaces(sql:SqlClient,userId:string){
  const {rows}=await sql.query<{id:string;name:string;organization_id:string;organization_name:string;archived_at:string|null;installation_id:number|string|null;installation_ids:(number|string)[];role:string;plan:string|null;trial_ends_at:string|null}>(`SELECT w.id,w.name,w.organization_id,o.name AS organization_name,w.archived_at,
      connection.installation_id,COALESCE(connection.installation_ids,'[]'::jsonb) AS installation_ids,
      CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.plan ELSE u.plan END AS plan,
      CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.trial_ends_at ELSE u.trial_ends_at END AS trial_ends_at,
      CASE WHEN o.legacy_installation_id IS NOT NULL AND m.access_source='legacy' THEN legacy.role ELSE m.role END AS role
    FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
    JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1
    LEFT JOIN LATERAL (SELECT min(c.installation_id) AS installation_id,jsonb_agg(c.installation_id ORDER BY c.installation_id) AS installation_ids
      FROM product_workspace_installations c WHERE c.workspace_id=w.id) connection ON true
    LEFT JOIN billing_accounts b ON b.installation_id=o.legacy_installation_id
    LEFT JOIN users u ON u.id=o.legacy_personal_user_id
    LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$1
    WHERE (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR legacy.user_id IS NOT NULL)
    ORDER BY w.created_at,w.id`,[userId]);
  return rows;
}

export async function uploadWorkspaceScope(sql:SqlClient,userId:string|null,installationId:number|null,workspaceId?:string,tokenId?:number){
  if(workspaceId)validId(workspaceId);
  if(userId)await ensureUserWorkspaces(sql,userId);
  if(installationId!==null){
    // CI tokens do not have an interactive user, but still need a stable workspace owner.
    await sql.query(`INSERT INTO product_organizations(id,name,legacy_installation_id)
      SELECT md5('nospoilers:installation:'||id)::uuid,account_login,id FROM installations WHERE id=$1
      AND NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=installations.id) ON CONFLICT DO NOTHING`,[installationId]);
    await sql.query(`INSERT INTO product_workspaces(id,organization_id,name)
      SELECT md5('nospoilers:workspace:'||id)::uuid,id,name FROM product_organizations WHERE legacy_installation_id=$1 ON CONFLICT DO NOTHING`,[installationId]);
    await sql.query(`INSERT INTO product_workspace_installations(installation_id,workspace_id)
      SELECT $1,md5('nospoilers:workspace:'||id)::uuid FROM product_organizations WHERE legacy_installation_id=$1 ON CONFLICT DO NOTHING`,[installationId]);
  }
  const {rows}=await sql.query<{id:string;billing_installation_id:number|null;billing_user_id:string|null;archived_at:string|null;role:string|null}>(`SELECT w.id,o.legacy_installation_id AS billing_installation_id,
    o.legacy_personal_user_id AS billing_user_id,w.archived_at,
    CASE WHEN o.legacy_installation_id IS NOT NULL AND m.access_source='legacy' THEN legacy.role ELSE m.role END AS role
    FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
    LEFT JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1
    LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$1
    WHERE ($3::uuid IS NOT NULL AND w.id=$3 OR $3::uuid IS NULL AND
      ($2::bigint IS NOT NULL AND EXISTS(SELECT 1 FROM product_workspace_installations selected WHERE selected.workspace_id=w.id AND selected.installation_id=$2)
        OR $2::bigint IS NULL AND o.legacy_personal_user_id=$1 AND w.id=md5('nospoilers:workspace:'||o.id)::uuid))
    AND ($2::bigint IS NULL OR EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.workspace_id=w.id AND c.installation_id=$2))
    AND ($1::text IS NULL AND ($2::bigint IS NOT NULL OR EXISTS(SELECT 1 FROM scan_api_tokens t WHERE t.id=$4 AND t.workspace_id=w.id AND t.installation_id IS NULL AND t.revoked_at IS NULL)) OR m.user_id=$1)
    AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations revoked WHERE revoked.workspace_id=w.id AND revoked.user_id=$1)
    FOR SHARE OF w`,[userId,installationId,workspaceId??null,tokenId??null]);
  const row=rows[0];
  if(!row || row.archived_at || (userId && !['owner','admin','member'].includes(row.role??'')))fail('A writable, active workspace is required to start scans.',403);
  return {...row,billing_installation_id:row.billing_installation_id===null?null:Number(row.billing_installation_id)};
}

const fail=(message:string,status:400|403|404|409):never=>{throw Object.assign(new Error(message),{status});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id:string){if(!uuid.test(id))fail('Workspace unavailable.',404);}
function workspaceName(value:unknown):string{
  // Control characters are invalid in a human-readable workspace name.
  // eslint-disable-next-line no-control-regex
  if(typeof value!=='string' || !value.trim() || value.trim().length>100 || /[\u0000-\u001f\u007f]/.test(value))
    fail('Use a workspace name between 1 and 100 characters, without control characters.',400);
  return (value as string).trim();
}

/** Lock the organisation before checking access/allowance; concurrent creates cannot overrun it. */
async function lockManagedOrganization(tx:SqlClient,userId:string,organizationId:string){
  validId(organizationId);
  const {rows}=await tx.query<{workspace_limit:number}>(`SELECT workspace_limit FROM product_organizations o
    WHERE o.id=$1 AND EXISTS(SELECT 1 FROM product_organization_members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.role IN ('owner','admin')) FOR UPDATE`,[organizationId,userId]);
  if(!rows[0])fail('Organisation unavailable or administrator access required.',403);
  return rows[0];
}

async function checkWorkspaceAllowance(tx:SqlClient,organizationId:string,limit:number){
  const {rows}=await tx.query<{count:number|string}>(`SELECT count(*) AS count FROM product_workspaces WHERE organization_id=$1 AND archived_at IS NULL`,[organizationId]);
  if(Number(rows[0].count)>=limit)fail('Workspace allowance reached. Archive an unused workspace or contact your administrator.',409);
}

export async function createWorkspace(sql:SqlClient,userId:string,organizationId:string,name:unknown){
  const normalized=workspaceName(name);
  return sql.transaction(async tx=>{
    const organization=await lockManagedOrganization(tx,userId,organizationId);
    await checkWorkspaceAllowance(tx,organizationId,organization.workspace_limit);
    const id=randomUUID();
    await tx.query('INSERT INTO product_workspaces(id,organization_id,name) VALUES($1,$2,$3)',[id,organizationId,normalized]);
    await tx.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,$2,'owner','explicit')",[id,userId]);
    await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action) VALUES($1,$2,$3,'created')",[randomUUID(),id,userId]);
    return {id,organization_id:organizationId,name:normalized,archived_at:null};
  });
}

export async function updateWorkspace(sql:SqlClient,userId:string,id:string,input:{name?:unknown;archived?:unknown}){
  validId(id);
  if(input.name===undefined && input.archived===undefined)fail('Specify a name or archive state.',400);
  const name=input.name===undefined?undefined:workspaceName(input.name);
  if(input.archived!==undefined && typeof input.archived!=='boolean')fail('Archive state must be true or false.',400);
  return sql.transaction(async tx=>{
    const {rows}=await tx.query<{organization_id:string;role:string}>(`SELECT w.organization_id,
      CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END AS role
      FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
      JOIN product_workspace_members m ON m.workspace_id=w.id
      LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
      WHERE w.id=$1 AND m.user_id=$2`,[id,userId]);
    if(!rows[0])fail('Workspace unavailable.',404);
    if(!['owner','admin'].includes(rows[0].role))fail('Workspace administrator access is required.',403);
    const orgId=rows[0].organization_id;
    const {rows:organizations}=await tx.query<{workspace_limit:number}>('SELECT workspace_limit FROM product_organizations WHERE id=$1 FOR UPDATE',[orgId]);
    const org=organizations[0];
    const {rows:current}=await tx.query<{name:string;archived_at:string|null}>(`SELECT name,archived_at FROM product_workspaces WHERE id=$1 FOR UPDATE`,[id]);
    const changedArchive=input.archived!==undefined && input.archived!==Boolean(current[0].archived_at);
    if(changedArchive && input.archived){
      // Legacy workers still use installation scope. Until cutover, never hide a live connection.
      const {rows:protectedWorkspace}=await tx.query(`SELECT id FROM product_workspaces WHERE id=$1 AND (
        id=md5('nospoilers:workspace:'||organization_id)::uuid OR EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.workspace_id=$1))`,[id]);
      if(protectedWorkspace.length)fail('The migrated default workspace or a connected workspace cannot be archived yet.',409);
    }
    if(changedArchive && !input.archived)await checkWorkspaceAllowance(tx,orgId,org.workspace_limit);
    await tx.query(`UPDATE product_workspaces SET name=COALESCE($2,name),archived_at=CASE WHEN $3::boolean IS NULL THEN archived_at WHEN $3 THEN COALESCE(archived_at,now()) ELSE NULL END WHERE id=$1`,[id,name??null,input.archived??null]);
    const actions:string[]=[];
    if(name!==undefined && name!==current[0].name)actions.push('renamed');
    if(changedArchive)actions.push(input.archived?'archived':'restored');
    for(const action of actions)await tx.query('INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action) VALUES($1,$2,$3,$4)',[randomUUID(),id,userId,action]);
    return {id};
  });
}
