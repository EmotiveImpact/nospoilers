import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import {sourceBillingSql} from './source-billing.ts';
/** A source selects its current organisation, never its historical billing alias. */
export async function sourceBillingTarget(sql:SqlClient,input:{organizationId?:unknown;installationId?:unknown}){
  if(input.installationId===undefined)return input;
  const id=Number(input.installationId);
  if(!Number.isSafeInteger(id)||id<=0)fail('Choose a billing organisation.',400);
  const {rows}=await sql.query<{organization_id:string|null}>(`SELECT organization_id FROM (${sourceBillingSql}) resolved WHERE installation_id=$1`,[id]);
  const organizationId=rows[0]?.organization_id;
  if(!organizationId||(input.organizationId!==undefined&&input.organizationId!==organizationId))fail('Billing organisation unavailable.',403);
  return {organizationId};
}
const fail=(message:string,status:400|403|404|409):never=>{throw Object.assign(new Error(message),{status});};
function validId(id:string){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail('Organisation unavailable.',404);}
export async function listManagedOrganizations(sql:SqlClient,userId:string){
  const {rows}=await sql.query<{id:string;name:string;role:string;workspace_limit:number;billing_available:boolean}>(`SELECT o.id,o.name,m.role,o.workspace_limit,
    (o.legacy_personal_user_id IS NOT NULL OR EXISTS(SELECT 1 FROM billing_accounts b WHERE b.organization_id=o.id)) AS billing_available
    FROM product_organizations o JOIN product_organization_members m ON m.organization_id=o.id AND m.user_id=$1 ORDER BY o.created_at,o.id`,[userId]);return rows;
}

export async function managedBillingAccount(sql:SqlClient,userId:string,input:{organizationId?:unknown;installationId?:unknown}){
  const organizationId=typeof input.organizationId==='string'?input.organizationId:undefined;
  if(organizationId)validId(organizationId);
  const installationId=input.installationId===undefined?undefined:Number(input.installationId);
  if(installationId!==undefined&&(!Number.isSafeInteger(installationId)||installationId<=0))fail('Choose a billing organisation.',400);
  if(!organizationId&&installationId===undefined)fail('Choose a billing organisation.',400);
  const {rows}=await sql.query<{organization_id:string;installation_id:number|string}>(`SELECT b.organization_id,b.installation_id FROM billing_accounts b
    JOIN product_organization_members m ON m.organization_id=b.organization_id AND m.user_id=$1
    WHERE ($2::uuid IS NULL OR b.organization_id=$2) AND ($3::bigint IS NULL OR b.installation_id=$3) AND m.role IN ('owner','admin')`,[userId,organizationId??null,installationId??null]);
  if(!rows[0])fail('Organisation administrator access is required to manage billing.',403);
  return {organizationId:rows[0].organization_id,installationId:Number(rows[0].installation_id)};
}
export async function organizationAccess(sql:SqlClient,userId:string,id:string){
  validId(id);
  const organizations=await listManagedOrganizations(sql,userId),organization=organizations.find(row=>row.id===id);
  if(!organization)fail('Organisation unavailable.',404);
  const {rows:members}=await sql.query<{user_id:string;login:string;role:string|null}>(`SELECT DISTINCT u.id AS user_id,u.login,a.role FROM users u
    LEFT JOIN product_organization_members a ON a.user_id=u.id AND a.organization_id=$1
    WHERE a.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM product_workspace_members m JOIN product_workspaces w ON w.id=m.workspace_id WHERE m.user_id=u.id AND w.organization_id=$1) ORDER BY u.login,u.id`,[id]);
  const {rows:events}=await sql.query(`SELECT e.id,e.action,e.detail,e.created_at,a.login AS actor,s.login AS subject FROM product_organization_events e LEFT JOIN users a ON a.id=e.actor_user_id LEFT JOIN users s ON s.id=e.subject_user_id WHERE organization_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 100`,[id]);
  return {organization,members,events};
}
export async function changeOrganizationAccess(sql:SqlClient,userId:string,id:string,targetId:string,role:unknown){
  validId(id);if(role!==null&&role!=='owner'&&role!=='admin')fail('Choose owner or administrator access.',400);
  return sql.transaction(async tx=>{
    const {rows}=await tx.query(`SELECT o.id FROM product_organizations o JOIN product_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2 AND m.role='owner' FOR UPDATE OF o`,[id,userId]);
    if(!rows.length)fail('Organisation owner access is required.',403);
    const {rows:targets}=await tx.query<{role:string|null}>(`SELECT a.role FROM users u LEFT JOIN product_organization_members a ON a.user_id=u.id AND a.organization_id=$1
      WHERE u.id=$2 AND (a.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM product_workspace_members m JOIN product_workspaces w ON w.id=m.workspace_id WHERE m.user_id=u.id AND w.organization_id=$1))`,[id,targetId]);
    if(!targets.length)fail('Invite this person to a workspace in the organisation first.',404);
    if(targets[0].role==='owner'&&role!=='owner'){
      const count=await tx.query<{count:string}>("SELECT count(*) AS count FROM product_organization_members WHERE organization_id=$1 AND role='owner'",[id]);
      if(Number(count.rows[0].count)<=1)fail('Add another organisation owner before removing or demoting the last owner.',409);
    }
    if(role===null)await tx.query('DELETE FROM product_organization_members WHERE organization_id=$1 AND user_id=$2',[id,targetId]);
    else await tx.query('INSERT INTO product_organization_members(organization_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role',[id,targetId,role]);
    await tx.query('INSERT INTO product_organization_events(id,organization_id,actor_user_id,subject_user_id,action,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[randomUUID(),id,userId,targetId,role===null?'administrator_removed':'role_changed',JSON.stringify({from:targets[0].role,to:role})]);
    return {userId:targetId};
  });
}
