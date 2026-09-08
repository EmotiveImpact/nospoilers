import type {SqlClient} from './sql.ts';

/** Read-only compatibility relation. Use in evidence queries instead of trusting
 * a potentially stale installation_users projection. No caller-controlled SQL. */
export const workspaceSourceMembershipSql = `
  SELECT candidate.installation_id,candidate.user_id,
    CASE WHEN w.archived_at IS NOT NULL THEN 'viewer'
      WHEN effective.role='owner' THEN 'admin' ELSE effective.role END AS role
  FROM (
    SELECT installation_id,user_id FROM installation_users
    UNION
    SELECT c.installation_id,m.user_id FROM product_workspace_installations c
      JOIN product_workspace_members m ON m.workspace_id=c.workspace_id
  ) candidate
  LEFT JOIN product_workspace_installations c ON c.installation_id=candidate.installation_id
  LEFT JOIN product_workspaces w ON w.id=c.workspace_id
  LEFT JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=candidate.user_id
  LEFT JOIN installation_users legacy ON legacy.installation_id=candidate.installation_id AND legacy.user_id=candidate.user_id
  CROSS JOIN LATERAL (SELECT CASE WHEN c.explicitly_assigned OR m.access_source='explicit'
    THEN m.role ELSE legacy.role END AS role) effective
  WHERE effective.role IN ('owner','admin','member','viewer')
    AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=candidate.user_id)
`;

/** Source credentials do not grant product access. Explicit workspace membership
 * is authoritative; installation_users is only a compatibility projection. */
export async function workspaceSourceAccess(sql:SqlClient,userId:string,installationId:number){
  const {rows}=await sql.query<{role:string|null;archived:boolean;revoked:boolean;explicitly_assigned:boolean;access_source:string|null;legacy_role:string|null}>(`
    SELECT m.role,w.archived_at IS NOT NULL AS archived,
      EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$1) AS revoked,
      c.explicitly_assigned,m.access_source,legacy.role AS legacy_role
    FROM product_workspace_installations c
    JOIN product_workspaces w ON w.id=c.workspace_id
    LEFT JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1
    LEFT JOIN installation_users legacy ON legacy.installation_id=c.installation_id AND legacy.user_id=$1
    WHERE c.installation_id=$2`,[userId,installationId]);
  const row=rows[0];
  if(!row){
    // Preserve pre-bootstrap installations; no mapped workspace exists yet.
    const legacy=await sql.query<{role:string}>('SELECT role FROM installation_users WHERE user_id=$1 AND installation_id=$2',[userId,installationId]);
    return {role:normalRole(legacy.rows[0]?.role),archived:false};
  }
  if(row.revoked)return {role:null,archived:row.archived};
  const role=row.explicitly_assigned||row.access_source==='explicit'?row.role:row.legacy_role;
  return {role:normalRole(role),archived:row.archived};
}

function normalRole(role:string|null|undefined):'admin'|'member'|'viewer'|null{
  if(role==='owner'||role==='admin')return 'admin';
  return role==='member'||role==='viewer'?role:null;
}
