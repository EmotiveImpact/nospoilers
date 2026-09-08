import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';

type Role='owner'|'admin'|'member'|'viewer';
const fail=(message:string,status:400|403|404|409):never=>{throw Object.assign(new Error(message),{status});};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function validId(id:string){if(!uuid.test(id))fail('Workspace unavailable.',404);}

/** Lock the workspace first so invite acceptance, revocation and last-owner changes serialize. */
async function access(tx:SqlClient,workspaceId:string,userId:string,write=false){
  validId(workspaceId);
  const {rows}=await tx.query<{role:Role;archived_at:string|null}>(`SELECT w.archived_at,
    CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END AS role
    FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
    JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$2
    LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$2
    WHERE w.id=$1 AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR legacy.user_id IS NOT NULL)
    FOR UPDATE OF w`,[workspaceId,userId]);
  const row=rows[0];if(!row)fail('Workspace unavailable.',404);
  if(write && (row.archived_at||!['owner','admin'].includes(row.role)))fail('An active workspace administrator is required.',403);
  return row;
}
async function event(tx:SqlClient,workspaceId:string,actor:string,action:string,subject:string,detail:unknown={}){
  await tx.query('INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,subject_user_id,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[randomUUID(),workspaceId,actor,action,subject,JSON.stringify(detail)]);
}
async function teamCoverage(tx:SqlClient,workspaceId:string){
  const {rows}=await tx.query(`SELECT w.id FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
    LEFT JOIN billing_accounts b ON b.installation_id=o.legacy_installation_id LEFT JOIN users u ON u.id=o.legacy_personal_user_id
    WHERE w.id=$1 AND CASE WHEN o.legacy_installation_id IS NOT NULL THEN (b.plan='team' OR b.trial_ends_at>now()) ELSE (u.plan='team' OR u.trial_ends_at>now()) END`,[workspaceId]);
  if(!rows.length)fail('Inviting teammates requires an active trial or Team subscription.',403);
}
/** Existing source APIs consume installation_users. Keep this compatibility projection
 * in the same transaction as explicit workspace grants/revocations, never at next login. */
async function projectConnectionAccess(tx:SqlClient,workspaceId:string,userId:string,role:Role|null){
  if(role===null){
    await tx.query('DELETE FROM installation_users WHERE user_id=$2 AND installation_id IN (SELECT installation_id FROM product_workspace_installations WHERE workspace_id=$1)',[workspaceId,userId]);
  }else await tx.query(`INSERT INTO installation_users(installation_id,user_id,role)
    SELECT installation_id,$2,$3 FROM product_workspace_installations WHERE workspace_id=$1
    ON CONFLICT(installation_id,user_id) DO UPDATE SET role=excluded.role`,[workspaceId,userId,role==='owner'?'admin':role]);
}
export async function workspaceTeam(sql:SqlClient,userId:string,workspaceId:string){
  return sql.transaction(async tx=>{
    const actor=await access(tx,workspaceId,userId);
    const {rows:members}=await tx.query<{user_id:string;login:string;access_source:string;role:Role}>(`SELECT m.user_id,u.login,m.access_source,
      CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END AS role
      FROM product_workspace_members m JOIN users u ON u.id=m.user_id
      JOIN product_workspaces w ON w.id=m.workspace_id JOIN product_organizations o ON o.id=w.organization_id
      LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
      WHERE m.workspace_id=$1 AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR legacy.user_id IS NOT NULL)
      ORDER BY u.login,m.user_id`,[workspaceId]);
    const {rows:invites}=await tx.query(`SELECT i.id,i.role,u.login,i.expires_at FROM product_workspace_invites i JOIN users u ON u.id=i.recipient_user_id WHERE i.workspace_id=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() ORDER BY i.created_at`,[workspaceId]);
    const {rows:events}=await tx.query(`SELECT e.id,e.action,e.detail,e.created_at,u.login AS actor,s.login AS subject FROM product_workspace_events e LEFT JOIN users u ON u.id=e.actor_user_id LEFT JOIN users s ON s.id=e.subject_user_id WHERE e.workspace_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 100`,[workspaceId]);
    return {role:actor.role,archived:!!actor.archived_at,members,invites,events};
  });
}
export async function inviteWorkspaceMember(sql:SqlClient,userId:string,workspaceId:string,login:unknown,role:unknown){
  if(typeof login!=='string'||login.length>100||!login.trim()||!['admin','member','viewer'].includes(String(role)))fail('Choose an existing account name and a valid role.',400);
  return sql.transaction(async tx=>{
    const actor=await access(tx,workspaceId,userId,true);
    await teamCoverage(tx,workspaceId);
    if(role==='admin'&&actor.role!=='owner')fail('Only an owner can invite administrators.',403);
    // Bind to immutable internal ID, not an email/provider alias that could later change hands.
    const {rows:users}=await tx.query<{id:string}>('SELECT id FROM users WHERE lower(login)=lower($1)',[(login as string).trim()]);
    if(users.length!==1)fail('That account is not available for invitation. Ask the person to sign in to NoSpoilers first.',400);
    const recipient=users[0].id;
    if((await tx.query('SELECT user_id FROM product_workspace_members WHERE workspace_id=$1 AND user_id=$2',[workspaceId,recipient])).rows.length)fail('This person is already a workspace member.',409);
    await tx.query('UPDATE product_workspace_invites SET revoked_at=now() WHERE workspace_id=$1 AND recipient_user_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL',[workspaceId,recipient]);
    const id=randomUUID();
    await tx.query('INSERT INTO product_workspace_invites(id,workspace_id,recipient_user_id,invited_by,role) VALUES($1,$2,$3,$4,$5)',[id,workspaceId,recipient,userId,role]);
    await event(tx,workspaceId,userId,'invited',recipient,{role});return {id};
  });
}
export async function pendingWorkspaceInvites(sql:SqlClient,userId:string){
  const {rows}=await sql.query(`SELECT i.id,i.role,i.expires_at,w.name AS workspace_name,u.login AS invited_by
    FROM product_workspace_invites i JOIN product_workspaces w ON w.id=i.workspace_id JOIN users u ON u.id=i.invited_by
    WHERE i.recipient_user_id=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND w.archived_at IS NULL ORDER BY i.created_at DESC LIMIT 100`,[userId]);return rows;
}
export async function acceptWorkspaceInvite(sql:SqlClient,userId:string,id:string){
  validId(id);
  return sql.transaction(async tx=>{
    const {rows}=await tx.query<{workspace_id:string;invited_by:string;role:Role}>('SELECT workspace_id,invited_by,role FROM product_workspace_invites WHERE id=$1 AND recipient_user_id=$2',[id,userId]);
    const invite=rows[0];if(!invite)fail('Invitation unavailable.',404);
    const sender=await access(tx,invite.workspace_id,invite.invited_by,true);
    await teamCoverage(tx,invite.workspace_id);
    if(invite.role==='admin'&&sender.role!=='owner')fail('The inviter can no longer grant this role.',403);
    const accepted=await tx.query(`UPDATE product_workspace_invites SET accepted_at=now() WHERE id=$1 AND recipient_user_id=$2 AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>now() RETURNING id`,[id,userId]);
    if(!accepted.rows.length)fail('Invitation expired, revoked or already accepted.',409);
    await tx.query(`INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,$2,$3,'explicit') ON CONFLICT DO NOTHING`,[invite.workspace_id,userId,invite.role]);
    const {rows:membership}=await tx.query<{role:Role}>('SELECT role FROM product_workspace_members WHERE workspace_id=$1 AND user_id=$2',[invite.workspace_id,userId]);
    await projectConnectionAccess(tx,invite.workspace_id,userId,membership[0].role);
    await tx.query('DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id=$2',[invite.workspace_id,userId]);
    await event(tx,invite.workspace_id,userId,'invite_accepted',userId,{role:invite.role});
    return {workspaceId:invite.workspace_id};
  });
}
export async function revokeWorkspaceInvite(sql:SqlClient,userId:string,workspaceId:string,id:string){
  validId(id);return sql.transaction(async tx=>{
    await access(tx,workspaceId,userId,true);
    const {rows}=await tx.query<{recipient_user_id:string}>('UPDATE product_workspace_invites SET revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING recipient_user_id',[id,workspaceId]);
    if(!rows[0])fail('Invitation unavailable.',404);
    await event(tx,workspaceId,userId,'invite_revoked',rows[0].recipient_user_id);return {id};
  });
}
export async function changeWorkspaceMember(sql:SqlClient,userId:string,workspaceId:string,targetId:string,role:unknown){
  if(role!==null&&!['owner','admin','member','viewer'].includes(String(role)))fail('Choose a valid workspace role.',400);
  return sql.transaction(async tx=>{
    const actor=await access(tx,workspaceId,userId,true);
    const {rows}=await tx.query<{role:Role;access_source:string}>('SELECT role,access_source FROM product_workspace_members WHERE workspace_id=$1 AND user_id=$2',[workspaceId,targetId]);
    const target=rows[0];if(!target)fail('Member unavailable.',404);
    if(actor.role!=='owner'&&(role==='owner'||role==='admin'||['owner','admin'].includes(target.role)))fail('Only an owner can manage administrators or owners.',403);
    if(target.role==='owner'&&role!=='owner'){
      const count=await tx.query<{count:string}>('SELECT count(*) AS count FROM product_workspace_members WHERE workspace_id=$1 AND role=\'owner\'',[workspaceId]);
      if(Number(count.rows[0].count)<=1)fail('Add another owner before removing or demoting the last owner.',409);
    }
    if(role===null){
      await tx.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[workspaceId,targetId]);
      await tx.query('DELETE FROM product_workspace_members WHERE workspace_id=$1 AND user_id=$2',[workspaceId,targetId]);
      await tx.query('UPDATE product_workspace_invites SET revoked_at=now() WHERE workspace_id=$1 AND recipient_user_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL',[workspaceId,targetId]);
    }else await tx.query("UPDATE product_workspace_members SET role=$3,access_source='explicit' WHERE workspace_id=$1 AND user_id=$2",[workspaceId,targetId,role]);
    await projectConnectionAccess(tx,workspaceId,targetId,role as Role|null);
    await event(tx,workspaceId,userId,role===null?'member_removed':'role_changed',targetId,{from:target.role,to:role});
    return {userId:targetId};
  });
}
