import type {SqlClient} from './sql.ts';
import {workspaceSourceMembershipSql} from './workspace-source-access.ts';

export async function lockAlertResponse(sql:SqlClient,id:number,installationId:number,userId:string){
 const workspace=(await sql.query<{archived_at:unknown}>(`SELECT w.archived_at FROM product_workspaces w JOIN product_workspace_installations c ON c.workspace_id=w.id WHERE c.installation_id=$1 FOR SHARE OF w`,[installationId])).rows[0];
 const actor=(await sql.query<{role:string}>(`SELECT role FROM (${workspaceSourceMembershipSql}) m WHERE m.installation_id=$1 AND m.user_id=$2`,[installationId,userId])).rows[0];
 if(workspace?.archived_at||!actor||actor.role==='viewer')throw Object.assign(new Error('Active workspace responder access is required.'),{status:403});
 const row=(await sql.query<{acknowledged_at:unknown;resolved_at:unknown}>('SELECT acknowledged_at,resolved_at FROM alerts WHERE id=$1 AND installation_id=$2 FOR UPDATE',[id,installationId])).rows[0];
 if(!row)throw Object.assign(new Error('Unknown alert.'),{status:404});
 return row;
}
