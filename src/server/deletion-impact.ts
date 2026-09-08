import type {SqlClient} from './sql.ts';

/** A current inventory, not a purge plan or authorisation to execute deletion. */
export async function deletionImpact(sql:SqlClient,userId:string,organizationId:string,input:{scope?:unknown;workspaceId?:unknown}){
 const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
 const fail=(message:string,status:400|403|404):never=>{throw Object.assign(new Error(message),{status});};
 if(!uuid(organizationId))fail('Organisation unavailable.',404);
 if(input.scope!=='workspace_history'&&input.scope!=='organization_closure')fail('Choose a deletion scope.',400);
 const workspaceId=input.scope==='workspace_history'&&uuid(input.workspaceId)?input.workspaceId:null;
 if(input.scope==='workspace_history'&&!workspaceId||input.scope==='organization_closure'&&input.workspaceId!=null)fail('Choose an exact workspace or organisation scope.',400);
 if(!(await sql.query("SELECT 1 FROM product_organization_members WHERE organization_id=$1 AND user_id=$2 AND role='owner'",[organizationId,userId])).rows.length)fail('Organisation owner access is required.',403);
 if(workspaceId&&!(await sql.query('SELECT id FROM product_workspaces WHERE id=$1 AND organization_id=$2',[workspaceId,organizationId])).rows.length)fail('Workspace unavailable.',404);
 const {rows}=await sql.query<Record<string,string|number>>(`WITH selected AS (SELECT id FROM product_workspaces WHERE organization_id=$1 AND ($2::uuid IS NULL OR id=$2)),
 connections AS (SELECT installation_id FROM product_workspace_installations WHERE workspace_id IN (SELECT id FROM selected)),
 uploads AS (SELECT id,status FROM uploaded_scans WHERE workspace_id IN (SELECT id FROM selected))
 SELECT (SELECT count(*) FROM selected) AS workspaces,
 (SELECT count(*) FROM uploads WHERE status IN ('done','failed')) AS savedUploadRecords,
 (SELECT count(*) FROM uploads WHERE status IN ('queued','running')) AS activeUploads,
 (SELECT count(*) FROM connections) AS sourceConnections,
 (SELECT count(*) FROM release_revisions WHERE installation_id IN (SELECT installation_id FROM connections)) AS sourceReleaseRecords,
 (SELECT count(*) FROM jobs j WHERE j.status IN ('queued','running') AND (
 j.kind='uploaded_scan' AND j.payload->>'uploadId' IN (SELECT id FROM uploads) OR
 j.kind!='uploaded_scan' AND j.installation_id IN (SELECT installation_id FROM connections))) AS activeJobs,
 ((SELECT count(*) FROM uploaded_proof_shares WHERE revoked_at IS NULL AND upload_id IN (SELECT id FROM uploads))+
 (SELECT count(*) FROM release_public_pages WHERE enabled AND installation_id IN (SELECT installation_id FROM connections))+
 (SELECT count(*) FROM identity_evidence_packs WHERE enabled AND installation_id IN (SELECT installation_id FROM connections))) AS publicLinks`,[organizationId,workspaceId]);
 const row=rows[0];
 // PostgreSQL folds unquoted aliases; expose an explicit stable JSON contract.
 return {scope:input.scope,workspaceId,organizationId,generatedAt:new Date().toISOString(),executionAvailable:false,holdsChecked:false,
 counts:{workspaces:Number(row.workspaces),savedUploadRecords:Number(row.saveduploadrecords),activeUploads:Number(row.activeuploads),sourceConnections:Number(row.sourceconnections),sourceReleaseRecords:Number(row.sourcereleaserecords),activeJobs:Number(row.activejobs),publicLinks:Number(row.publiclinks)}};
}
