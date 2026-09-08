import {createHash,randomBytes} from 'node:crypto';
import type {SqlClient} from './sql.ts';

export const githubConnectionIntentSchema=`
CREATE TABLE IF NOT EXISTS github_connection_intents (
 token_hash TEXT PRIMARY KEY CHECK(length(token_hash)=64),
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes',
 consumed_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 FOREIGN KEY(organization_id,workspace_id) REFERENCES product_workspaces(organization_id,id) ON DELETE RESTRICT,
 CHECK(expires_at>created_at),
 CHECK(NOT(consumed_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS github_connection_intents_session ON github_connection_intents(session_id);
`;

const fail=():never=>{throw Object.assign(new Error('Connection request unavailable. Start again from an active workspace you administer.'),{status:403});};
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function inspectGithubConnectionIntent(sql:SqlClient,sessionId:string,userId:string,token:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))fail();
 return sql.transaction(async tx=>{
  await session(tx,sessionId,userId);
  const {rows}=await tx.query<{workspace_id:string;organization_id:string;created_at:Date|string}>(`SELECT workspace_id,organization_id,created_at FROM github_connection_intents
    WHERE token_hash=$1 AND session_id=$2 AND user_id=$3 AND expires_at>now() AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`,[hash(token),sessionId,userId]);
  if(!rows[0])fail();
  return {...await destination(tx,userId,rows[0].workspace_id,rows[0].organization_id),createdAt:new Date(rows[0].created_at).toISOString()};
 });
}
async function session(tx:SqlClient,sessionId:string,userId:string){
 if(!(await tx.query('SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND expires_at>now() FOR UPDATE',[sessionId,userId])).rows.length)fail();
}
async function destination(tx:SqlClient,userId:string,workspaceId:string,expectedOrganization?:string){
 if(!uuid.test(workspaceId))fail();
 const {rows}=await tx.query<{organization_id:string}>('SELECT organization_id FROM product_workspaces WHERE id=$1',[workspaceId]);
 const organizationId=rows[0]?.organization_id;
 if(!organizationId||(expectedOrganization&&expectedOrganization!==organizationId))fail();
 // Match the organisation-before-workspace lock order used by workspace management.
 if(!(await tx.query(`SELECT o.id FROM product_organizations o JOIN product_organization_members a ON a.organization_id=o.id
   WHERE o.id=$1 AND a.user_id=$2 AND a.role IN ('owner','admin') FOR UPDATE OF o`,[organizationId,userId])).rows.length)fail();
 const access=await tx.query(`SELECT w.id FROM product_workspaces w
   JOIN product_organizations o ON o.id=w.organization_id
   JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$2
   LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
   WHERE w.id=$1 AND w.organization_id=$3 AND w.archived_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$2)
   AND CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END IN ('owner','admin')
   FOR UPDATE OF w`,[workspaceId,userId,organizationId]);
 if(!access.rows.length)fail();
 return {workspaceId,organizationId,userId};
}

/** Internal prerequisite only: no installation URL is exposed until binding and webhook coordination exist. */
export async function createGithubConnectionIntent(sql:SqlClient,sessionId:string,userId:string,workspaceId:string){
 return sql.transaction(async tx=>{
  await session(tx,sessionId,userId);
  const target=await destination(tx,userId,workspaceId);
  await tx.query('UPDATE github_connection_intents SET revoked_at=now() WHERE session_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL',[sessionId]);
  const token=randomBytes(32).toString('base64url');
  const {rows}=await tx.query<{expires_at:Date|string}>(`INSERT INTO github_connection_intents(token_hash,session_id,user_id,organization_id,workspace_id)
    VALUES($1,$2,$3,$4,$5) RETURNING expires_at`,[hash(token),sessionId,userId,target.organizationId,workspaceId]);
  return {token,expiresAt:new Date(rows[0].expires_at).toISOString()};
 });
}

/** The future coordinator must verify GitHub authority first, then bind using this transaction.
 * Failure rolls back consumption and binding together; no standalone claim-then-bind window. */
export async function consumeGithubConnectionIntent<T>(sql:SqlClient,sessionId:string,userId:string,token:string,
 bind:(tx:SqlClient,target:{workspaceId:string;organizationId:string;userId:string})=>Promise<T>):Promise<T>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))fail();
 return sql.transaction(async tx=>{
  await session(tx,sessionId,userId);
  const {rows}=await tx.query<{workspace_id:string;organization_id:string}>(`SELECT workspace_id,organization_id FROM github_connection_intents
    WHERE token_hash=$1 AND session_id=$2 AND user_id=$3 AND expires_at>now() AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`,[hash(token),sessionId,userId]);
  if(!rows[0])fail();
  const target=await destination(tx,userId,rows[0].workspace_id,rows[0].organization_id);
  await tx.query('UPDATE github_connection_intents SET consumed_at=now() WHERE token_hash=$1',[hash(token)]);
  return bind(tx,target);
 });
}
