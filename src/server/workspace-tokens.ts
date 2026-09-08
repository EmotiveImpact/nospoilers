import type {SqlClient} from './sql.ts';
import {workspaceEvidenceSettings} from './workspace-evidence-settings.ts';
import {randomUUID} from 'node:crypto';
import {mintScanToken,validateScanTokenName,MAX_SCAN_TOKENS,hashScanToken,hashesMatch,isScanToken} from './scan-api.ts';
import {uploadWorkspaceScope} from './workspaces.ts';

export async function authenticateWorkspaceToken(sql:SqlClient,token:string){
 if(!isScanToken(token))return null;
 const hash=hashScanToken(token);
 const row=(await sql.query<{id:number;workspace_id:string;token_hash:string}>(`SELECT t.id,t.workspace_id,t.token_hash
  FROM scan_api_tokens t JOIN product_workspaces w ON w.id=t.workspace_id
  WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.installation_id IS NULL AND w.archived_at IS NULL`,[hash])).rows[0];
 return row&&hashesMatch(row.token_hash,hash)?{id:Number(row.id),workspaceId:row.workspace_id}:null;
}

export async function mintWorkspaceToken(sql:SqlClient,userId:string,workspaceId:string,rawName:unknown){
 const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 const name=typeof rawName==='string'?validateScanTokenName(rawName):null;
 if(!name)fail('Use a token name of 1–64 characters without line breaks.',400);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin'].includes(access.workspace.role))fail('An administrator of an active workspace is required.',403);
  const scope=await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const entitled=scope.billing_installation_id!==null
   ?await tx.query("SELECT installation_id FROM billing_accounts WHERE installation_id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())",[scope.billing_installation_id])
   :await tx.query("SELECT id FROM users WHERE id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())",[scope.billing_user_id]);
  if(!entitled.rows.length)fail('Workspace coverage has ended. Subscribe before creating a scan token.',402);
  const count=(await tx.query<{total:string}>('SELECT count(*) AS total FROM scan_api_tokens WHERE workspace_id=$1 AND revoked_at IS NULL',[workspaceId])).rows[0];
  if(Number(count.total)>=MAX_SCAN_TOKENS)fail(`This workspace already has ${MAX_SCAN_TOKENS} active scan tokens.`,400);
  const minted=mintScanToken();
  const actor=(await tx.query<{login:string}>('SELECT login FROM users WHERE id=$1',[userId])).rows[0];
  const token=(await tx.query<{id:number;name:string;token_prefix:string;created_at:string}>(`INSERT INTO scan_api_tokens(workspace_id,name,token_prefix,token_hash,created_by_login)
   VALUES($1,$2,$3,$4,$5) RETURNING id,name,token_prefix,created_at`,[workspaceId,name,minted.tokenPrefix,minted.tokenHash,actor.login])).rows[0];
  await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'token_minted',$4::jsonb)",[randomUUID(),workspaceId,userId,JSON.stringify({tokenId:token.id,name})]);
  return {token:minted.token,scanToken:token};
 });
}

export async function revokeWorkspaceToken(sql:SqlClient,userId:string,workspaceId:string,tokenId:string,confirm:unknown){
 const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(!/^[1-9]\d*$/.test(tokenId)||!Number.isSafeInteger(Number(tokenId)))fail('Token unavailable.',404);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin'].includes(access.workspace.role))fail('An administrator of an active workspace is required.',403);
  const token=(await tx.query<{name:string;revoked_at:string|null}>('SELECT name,revoked_at FROM scan_api_tokens WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[tokenId,workspaceId])).rows[0];
  if(!token)fail('Token unavailable.',404);
  if(confirm!==token.name)fail('Type the token name exactly to revoke it.',400);
  if(token.revoked_at)return {ok:true};
  await tx.query('UPDATE scan_api_tokens SET revoked_at=now() WHERE id=$1',[tokenId]);
  await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'token_revoked',$4::jsonb)",[randomUUID(),workspaceId,userId,JSON.stringify({tokenId,name:token.name})]);
  return {ok:true};
 });
}

/** Only non-secret metadata is returned, scoped by immutable credential ownership. */
export async function listWorkspaceTokens(sql:SqlClient,userId:string,workspaceId:string,before?:string){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(before&&(!/^[1-9]\d*$/.test(before)||!Number.isSafeInteger(Number(before))))throw Object.assign(new Error('Invalid token history cursor.'),{status:400});
 if(before&&!(await sql.query('SELECT id FROM scan_api_tokens WHERE id=$1 AND workspace_id=$2',[before,workspaceId])).rows.length)throw Object.assign(new Error('Token history page unavailable.'),{status:404});
 const {rows}=await sql.query<{id:number;name:string;token_prefix:string;installation_id:number|null;created_by_login:string;created_at:string;last_used_at:string|null;revoked_at:string|null}>(`
  SELECT id,name,token_prefix,installation_id,created_by_login,created_at,last_used_at,revoked_at
  FROM scan_api_tokens WHERE workspace_id=$1 AND ($2::bigint IS NULL OR id<$2)
  ORDER BY id DESC LIMIT 51`,[workspaceId,before??null]);
 return {tokens:rows.slice(0,50),nextCursor:rows.length>50?String(rows[49].id):null,canManage:!access.workspace.archived_at&&['owner','admin'].includes(access.workspace.role)};
}
