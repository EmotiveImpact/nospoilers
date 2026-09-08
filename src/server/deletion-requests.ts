import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';

export const deletionRequestSchema = `
ALTER TABLE product_organization_events DROP CONSTRAINT IF EXISTS product_organization_events_action_check;
ALTER TABLE product_organization_events ADD CONSTRAINT product_organization_events_action_check CHECK(action IN ('role_changed','administrator_removed','deletion_review_requested'));
CREATE TABLE IF NOT EXISTS product_deletion_requests (
 id UUID PRIMARY KEY,
 organization_id UUID NOT NULL REFERENCES product_organizations(id),
 workspace_id UUID REFERENCES product_workspaces(id),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 scope TEXT NOT NULL CHECK(scope IN ('workspace_history','organization_closure')),
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status='pending_review'),
 policy_version TEXT NOT NULL,
 confirmation_phrase TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK ((scope='workspace_history' AND workspace_id IS NOT NULL) OR (scope='organization_closure' AND workspace_id IS NULL))
);
DROP INDEX IF EXISTS deletion_request_scope_unique;
CREATE TABLE IF NOT EXISTS product_deletion_withdrawals (
 request_id UUID PRIMARY KEY REFERENCES product_deletion_requests(id),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS deletion_withdrawal_immutable ON product_deletion_withdrawals;
CREATE TRIGGER deletion_withdrawal_immutable BEFORE UPDATE OR DELETE ON product_deletion_withdrawals FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation();
DROP TRIGGER IF EXISTS deletion_withdrawal_no_truncate ON product_deletion_withdrawals;
CREATE TRIGGER deletion_withdrawal_no_truncate BEFORE TRUNCATE ON product_deletion_withdrawals FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
DROP TRIGGER IF EXISTS deletion_request_immutable ON product_deletion_requests;
CREATE TRIGGER deletion_request_immutable BEFORE UPDATE OR DELETE ON product_deletion_requests FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation();
DROP TRIGGER IF EXISTS deletion_request_no_truncate ON product_deletion_requests;
CREATE TRIGGER deletion_request_no_truncate BEFORE TRUNCATE ON product_deletion_requests FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
`;
const fail=(message:string,status:400|403|404):never=>{throw Object.assign(new Error(message),{status});};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export const deletionPolicyVersion='2026-09-05-explicit-history-authorization';
export async function listDeletionRequests(sql:SqlClient,userId:string,organizationId:string){
 if(!uuid(organizationId))fail('Organisation unavailable.',404);
 const access=await sql.query("SELECT 1 FROM product_organization_members WHERE organization_id=$1 AND user_id=$2 AND role='owner'",[organizationId,userId]);
 if(!access.rows.length)fail('Organisation owner access is required.',403);
 return (await sql.query("SELECT r.id,r.workspace_id,r.scope,CASE WHEN w.request_id IS NULL THEN 'pending_review' ELSE 'withdrawn' END AS status,r.created_at FROM product_deletion_requests r LEFT JOIN product_deletion_withdrawals w ON w.request_id=r.id WHERE r.organization_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 100",[organizationId])).rows;
}
export async function withdrawDeletionRequest(sql:SqlClient,userId:string,organizationId:string,requestId:string){
 if(!uuid(organizationId)||!uuid(requestId))fail('Request unavailable.',404);
 return sql.transaction(async tx=>{
  const access=await tx.query("SELECT o.id FROM product_organizations o JOIN product_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2 AND m.role='owner' FOR UPDATE OF o",[organizationId,userId]);
  if(!access.rows.length)fail('Organisation owner access is required.',403);
  if(!(await tx.query('SELECT id FROM product_deletion_requests WHERE id=$1 AND organization_id=$2',[requestId,organizationId])).rows.length)fail('Request unavailable.',404);
  await tx.query('INSERT INTO product_deletion_withdrawals(request_id,actor_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[requestId,userId]);
  return {id:requestId,status:'withdrawn'};
 });
}
/** Records explicit intent only. Execution needs separate retention, hold and billing orchestration. */
export async function requestDeletion(sql:SqlClient,userId:string,organizationId:string,input:{scope?:unknown;workspaceId?:unknown;confirmation?:unknown;acknowledgeHistory?:unknown}){
 if(!uuid(organizationId))fail('Organisation unavailable.',404);
 if(input.scope!=='workspace_history'&&input.scope!=='organization_closure')fail('Choose a deletion scope.',400);
 const scope=input.scope;
 const workspaceId=scope==='workspace_history'&&uuid(input.workspaceId)?input.workspaceId:null;
 if(scope==='workspace_history'&&!workspaceId)fail('Choose the workspace whose history should be reviewed for deletion.',400);
 if(scope==='organization_closure'&&input.workspaceId!=null)fail('Organisation closure applies to every workspace in this organisation.',400);
 const phrase=`${scope==='workspace_history'?'DELETE HISTORY':'CLOSE AND DELETE'} ${workspaceId??organizationId}`;
 if(input.confirmation!==phrase||input.acknowledgeHistory!==true)fail('Type the exact confirmation and acknowledge deletion of history.',400);
 return sql.transaction(async tx=>{
  const owner=await tx.query("SELECT o.id FROM product_organizations o JOIN product_organization_members m ON m.organization_id=o.id WHERE o.id=$1 AND m.user_id=$2 AND m.role='owner' FOR UPDATE OF o",[organizationId,userId]);
  if(!owner.rows.length)fail('Organisation owner access is required.',403);
  if(workspaceId&&!(await tx.query('SELECT id FROM product_workspaces WHERE id=$1 AND organization_id=$2',[workspaceId,organizationId])).rows.length)fail('Workspace unavailable.',404);
  const existing=await tx.query<{id:string;status:string}>('SELECT id,status FROM product_deletion_requests r WHERE organization_id=$1 AND scope=$2 AND workspace_id IS NOT DISTINCT FROM $3::uuid AND NOT EXISTS(SELECT 1 FROM product_deletion_withdrawals w WHERE w.request_id=r.id)',[organizationId,scope,workspaceId]);
  if(existing.rows[0])return existing.rows[0];
  const id=randomUUID();
  await tx.query('INSERT INTO product_deletion_requests(id,organization_id,workspace_id,actor_user_id,scope,policy_version,confirmation_phrase) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,organizationId,workspaceId,userId,scope,deletionPolicyVersion,phrase]);
  await tx.query('INSERT INTO product_organization_events(id,organization_id,actor_user_id,subject_user_id,action,detail) VALUES($1,$2,$3,$3,$4,$5::jsonb)',[randomUUID(),organizationId,userId,'deletion_review_requested',JSON.stringify({requestId:id,scope,workspaceId,policyVersion:deletionPolicyVersion})]);
  return {id,status:'pending_review'};
 });
}
