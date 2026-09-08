import {randomBytes} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import {uploadWorkspaceScope} from './workspaces.ts';
import {parseWatchRoot,MAX_WATCHED_ORIGINS} from './web-origin.ts';
import {coverageFrom} from '../coverage.ts';
import {verifyDomainOwnership,type DomainVerificationMethod} from './domain-verification.ts';
const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};

export async function listWorkspaceOrigins(sql:SqlClient,userId:string,workspaceId:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId))fail('Workspace unavailable.',404);
 const permitted=await sql.query(`SELECT w.id FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
 JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$2
 WHERE w.id=$1 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$2)
 AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR EXISTS(SELECT 1 FROM installation_users l WHERE l.installation_id=o.legacy_installation_id AND l.user_id=$2))`,[workspaceId,userId]);
 if(!permitted.rows.length)fail('Workspace unavailable.',404);
 return (await sql.query<{id:string|number;origin_url:string;host:string;verification_token:string|null;verified_at:string|Date|null;disconnected_at:string|Date|null;paused_at:string|Date|null;last_checked_at:string|Date|null;last_scan_status:string|null;latest_attempt_id:string|null;schedule_hours:number;next_check_at:string|Date|null;schedule_error:string|null;schedule_actor:string|null;activity:{action:string;created_at:string;actor:string|null}[]}>(`SELECT source.id,source.origin_url,source.host,source.verification_token,source.verified_at,source.disconnected_at,source.paused_at,source.last_checked_at,source.last_scan_status,
 source.schedule_hours,source.next_check_at,source.schedule_error,(SELECT u.login FROM users u WHERE u.id=source.schedule_actor_id) AS schedule_actor,
 (SELECT attempt.status FROM uploaded_scans attempt WHERE attempt.source_origin_id=source.id AND attempt.workspace_id=source.workspace_id ORDER BY attempt.created_at DESC,attempt.id DESC LIMIT 1) AS latest_attempt_status,
 (SELECT COALESCE(jsonb_agg(event),'[]'::jsonb) FROM (SELECT e.action,e.created_at,u.login AS actor FROM workspace_origin_events e LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.origin_id=source.id AND e.workspace_id=source.workspace_id ORDER BY e.id DESC LIMIT 20) event) AS activity,
 (SELECT attempt.id FROM uploaded_scans attempt WHERE attempt.source_origin_id=source.id AND attempt.workspace_id=source.workspace_id ORDER BY attempt.created_at DESC,attempt.id DESC LIMIT 1) AS latest_attempt_id
 FROM watched_origins source WHERE source.workspace_id=$1 AND source.installation_id IS NULL ORDER BY source.created_at,source.id`,[workspaceId])).rows.map(row=>({...row,id:Number(row.id)}));
}

/** Internal creation primitive. No scanning before explicit domain verification. */
export async function createWorkspaceOrigin(sql:SqlClient,userId:string,workspaceId:string,url:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId))fail('Workspace unavailable.',404);
 const parsed=parseWatchRoot(url);if(!parsed)fail('Use an HTTPS website on a public host.',400);
 return sql.transaction(async tx=>{
  // Serialise quota + uniqueness with every workspace source creation.
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const scope=await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const billing=scope.billing_installation_id!==null
   ?(await tx.query<{plan:string|null;trial_ends_at:string|Date|null}>('SELECT plan,trial_ends_at FROM billing_accounts WHERE installation_id=$1',[scope.billing_installation_id])).rows[0]
   :(await tx.query<{plan:string|null;trial_ends_at:string|Date|null}>('SELECT plan,trial_ends_at FROM users WHERE id=$1',[scope.billing_user_id])).rows[0];
  if(!billing||coverageFrom(billing.trial_ends_at?new Date(billing.trial_ends_at).toISOString():null,billing.plan).status==='ended')fail('An active workspace plan or trial is required.',402);
  const count=(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM watched_origins WHERE workspace_id=$1 AND disconnected_at IS NULL',[workspaceId])).rows[0].n;
  if(count>=MAX_WATCHED_ORIGINS)fail('Website connection allowance reached.',409);
  const token=randomBytes(32).toString('base64url');
  const existing=(await tx.query<{id:string|number}>('SELECT id FROM watched_origins WHERE workspace_id=$1 AND origin_url=$2',[workspaceId,parsed!.url])).rows[0];
  if(existing)fail('This website already has a source record in this workspace. Reconnect that source instead.',409);
  const {rows}=await tx.query<{id:string|number;workspace_id:string;origin_url:string;host:string;verification_token:string}>(`INSERT INTO watched_origins(workspace_id,installation_id,origin_url,host,verification_token)
    VALUES($1,NULL,$2,$3,$4) RETURNING id,workspace_id,origin_url,host,verification_token`,[workspaceId,parsed!.url,parsed!.host,token]);
  await tx.query("INSERT INTO workspace_origin_events(workspace_id,origin_id,actor_user_id,action) VALUES($1,$2,$3,'connected')",[workspaceId,rows[0].id,userId]);
  return {...rows[0],id:Number(rows[0].id)};
 });
}

export async function verifyWorkspaceOrigin(sql:SqlClient,userId:string,workspaceId:string,originId:number,method:DomainVerificationMethod,verify=verifyDomainOwnership){
 if(method!=='dns'&&method!=='http')fail('Choose DNS or HTTP verification.',400);
 if(!Number.isSafeInteger(originId)||originId<=0)fail('Website unavailable.',404);
 const before=await sql.transaction(async tx=>{
  await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const row=(await tx.query<{host:string;verification_token:string|null}>(`SELECT host,verification_token FROM watched_origins WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND disconnected_at IS NULL`,[originId,workspaceId])).rows[0];
  if(!row?.verification_token)fail('Website unavailable or ownership challenge missing.',404);
  return row!;
 });
 // No database lock is held across DNS/HTTP work. The challenge and access are
 // both rechecked on return, so a stale response cannot authorise a changed source.
 const result=await verify(before.host,before.verification_token!,method);
 return sql.transaction(async tx=>{
  await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const {rows}=await tx.query<{id:string|number;verified_at:string|Date}>(`UPDATE watched_origins SET verified_at=now(),verification_method=$4
    WHERE id=$1 AND workspace_id=$2 AND verification_token=$3 AND installation_id IS NULL AND disconnected_at IS NULL RETURNING id,verified_at`,[originId,workspaceId,before.verification_token,method]);
  if(!rows[0])fail('Website changed during verification. Refresh its ownership challenge and try again.',409);
  await tx.query("INSERT INTO workspace_origin_events(workspace_id,origin_id,actor_user_id,action) VALUES($1,$2,$3,'verified')",[workspaceId,originId,userId]);
  return {id:Number(rows[0].id),verifiedAt:new Date(rows[0].verified_at).toISOString(),method,detail:result.detail};
 });
}

export async function changeWorkspaceOrigin(sql:SqlClient,userId:string,workspaceId:string,originId:number,action:string,confirmation?:string){
 if(!['pause','resume','disconnect','reconnect'].includes(action))fail('Unknown website action.',400);
 if(!Number.isSafeInteger(originId)||originId<=0||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId))fail('Website unavailable.',404);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const source=(await tx.query<{origin_url:string;paused_at:unknown;disconnected_at:unknown}>(`SELECT origin_url,paused_at,disconnected_at FROM watched_origins WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL FOR UPDATE`,[originId,workspaceId])).rows[0];
  if(!source)fail('Website unavailable.',404);
  if(action==='disconnect'&&confirmation!==source!.origin_url)fail('Type the website URL to confirm disconnection. Saved history will remain.',400);
  if(source!.disconnected_at&&action!=='reconnect'&&action!=='disconnect')fail('Reconnect this website first.',409);
  if(action==='reconnect'&&!source!.disconnected_at)fail('This website is already connected.',409);
  if(action==='reconnect'&&(await tx.query<{n:number}>('SELECT count(*)::int AS n FROM watched_origins WHERE workspace_id=$1 AND disconnected_at IS NULL',[workspaceId])).rows[0].n>=MAX_WATCHED_ORIGINS)fail('Website connection allowance reached.',409);
  if(action==='pause'&&source!.paused_at||action==='resume'&&!source!.paused_at||action==='disconnect'&&source!.disconnected_at)return {ok:true};
  if(action==='pause')await tx.query('UPDATE watched_origins SET paused_at=now() WHERE id=$1',[originId]);
  if(action==='resume')await tx.query('UPDATE watched_origins SET paused_at=NULL WHERE id=$1',[originId]);
  if(action==='disconnect')await tx.query('UPDATE watched_origins SET disconnected_at=now(),deploy_token_hash=NULL,deploy_token_prefix=NULL,schedule_hours=0,next_check_at=NULL,schedule_version=schedule_version+1,schedule_error=NULL WHERE id=$1',[originId]);
  if(action==='reconnect')await tx.query('UPDATE watched_origins SET disconnected_at=NULL,paused_at=NULL,verified_at=NULL,verification_method=NULL,verification_token=$2 WHERE id=$1',[originId,randomBytes(32).toString('base64url')]);
  const event={pause:'paused',resume:'resumed',disconnect:'disconnected',reconnect:'reconnected'}[action];
  await tx.query('INSERT INTO workspace_origin_events(workspace_id,origin_id,actor_user_id,action) VALUES($1,$2,$3,$4)',[workspaceId,originId,userId,event]);
  return {ok:true};
 });
}
