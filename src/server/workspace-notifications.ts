import type {SqlClient} from './sql.ts';
import {workspaceEvidenceSettings} from './workspace-evidence-settings.ts';
import {uploadWorkspaceScope} from './workspaces.ts';
import {parseSlackWebhook,slackPlanDeniedFromBilling} from './slack.ts';
import {parseEmailAddress,emailPlanDeniedFromBilling} from './email.ts';
import {encryptSecret} from './secret-box.ts';
import {randomUUID} from 'node:crypto';

export async function requestWorkspaceNotificationTest(sql:SqlClient,userId:string,workspaceId:string,id:string,requestKey:unknown,providers:{slack:boolean;email:boolean}){
 const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))fail('Destination unavailable.',404);
 if(typeof requestKey!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))fail('A valid test request identifier is required.',400);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin'].includes(access.workspace.role))fail('An administrator of an active workspace is required.',403);
  const destination=(await tx.query<{kind:string;configuration_version:string}>(`SELECT kind,configuration_version FROM notification_destinations WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL FOR UPDATE`,[id,workspaceId])).rows[0];
  if(!destination)fail('Independent destination unavailable.',404);
  const previous=(await tx.query<{id:string;status:string;configuration_version:string}>('SELECT id,status,configuration_version FROM workspace_notification_jobs WHERE destination_id=$1 AND request_key=$2 AND purpose=\'test\'',[id,requestKey])).rows[0];
  if(previous){
   if(previous.configuration_version!==destination.configuration_version)fail('Destination changed. Start a new test.',409);
   return {jobId:previous.id,status:previous.status};
  }
  if(!providers[destination.kind as 'slack'|'email'])fail('This notification provider is not configured on this host.',503);
  const scope=await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const payer=(scope.billing_installation_id!==null
   ?await tx.query<{plan:string|null;trial_ends_at:string|null}>('SELECT plan,trial_ends_at FROM billing_accounts WHERE installation_id=$1',[scope.billing_installation_id])
   :await tx.query<{plan:string|null;trial_ends_at:string|null}>('SELECT plan,trial_ends_at FROM users WHERE id=$1',[scope.billing_user_id])).rows[0];
  if(!payer)fail('Workspace subscription unavailable.',402);
  const denied=destination.kind==='slack'?slackPlanDeniedFromBilling(payer.trial_ends_at,payer.plan):emailPlanDeniedFromBilling(payer.trial_ends_at,payer.plan);
  if(denied)fail(denied.error,denied.status);
  if((await tx.query(`SELECT id FROM workspace_notification_jobs WHERE workspace_id=$1 AND purpose='test' AND created_at>now()-interval '1 minute' LIMIT 1`,[workspaceId])).rows.length)fail('Wait one minute before requesting another notification test.',429);
  const jobId=randomUUID();
  await tx.query(`INSERT INTO workspace_notification_jobs(id,workspace_id,destination_id,configuration_version,purpose,request_key) VALUES($1,$2,$3,$4,'test',$5)`,[jobId,workspaceId,id,destination.configuration_version,requestKey]);
  await tx.query(`INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'notification_test_requested',$4::jsonb)`,[randomUUID(),workspaceId,userId,JSON.stringify({jobId,destinationId:id,kind:destination.kind})]);
  return {jobId,status:'queued'};
 });
}

export async function disconnectWorkspaceNotification(sql:SqlClient,userId:string,workspaceId:string,id:string,confirm:unknown){
 const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))fail('Destination unavailable.',404);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin'].includes(access.workspace.role))fail('An administrator of an active workspace is required.',403);
  const destination=(await tx.query<{host:string;kind:string}>('SELECT host,kind FROM notification_destinations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,workspaceId])).rows[0];
  if(!destination)fail('Destination unavailable.',404);
  if(confirm!==destination.host)fail('Type the destination host exactly to disconnect it.',400);
  await tx.query('DELETE FROM notification_destinations WHERE id=$1',[id]);
  await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'notification_disconnected',$4::jsonb)",[randomUUID(),workspaceId,userId,JSON.stringify({destinationId:id,kind:destination.kind,host:destination.host})]);
  return {ok:true};
 });
}

export async function saveWorkspaceNotification(sql:SqlClient,userId:string,workspaceId:string,kind:unknown,value:unknown,encryptionSecret:string){
 const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(!encryptionSecret)fail('Notification encryption is not configured.',503);
 const slack=kind==='slack'&&typeof value==='string'?parseSlackWebhook(value):null;
 const email=kind==='email'&&typeof value==='string'?parseEmailAddress(value):null;
 if(!slack&&!email)fail('Provide a valid Slack webhook or public email address.',400);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin'].includes(access.workspace.role))fail('An administrator of an active workspace is required.',403);
  const scope=await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const billing=scope.billing_installation_id!==null
   ?await tx.query<{plan:string|null;trial_ends_at:string|null}>('SELECT plan,trial_ends_at FROM billing_accounts WHERE installation_id=$1',[scope.billing_installation_id])
   :await tx.query<{plan:string|null;trial_ends_at:string|null}>('SELECT plan,trial_ends_at FROM users WHERE id=$1',[scope.billing_user_id]);
  const payer=billing.rows[0];if(!payer)fail('Workspace subscription unavailable.',402);
  const denied=kind==='slack'?slackPlanDeniedFromBilling(payer.trial_ends_at,payer.plan):emailPlanDeniedFromBilling(payer.trial_ends_at,payer.plan);
  if(denied)fail(denied.error,denied.status);
  const secret=slack?.url??email!.address,host=slack?.host??email!.domain;
  const row=(await tx.query<{id:number;kind:string;host:string}>(`INSERT INTO notification_destinations(workspace_id,kind,host,project_key,webhook_ciphertext)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,kind) WHERE installation_id IS NULL DO UPDATE SET
   host=excluded.host,project_key=excluded.project_key,webhook_ciphertext=excluded.webhook_ciphertext,configuration_version=gen_random_uuid(),updated_at=now(),last_delivery_at=NULL,last_delivery_status=NULL,last_delivery_error=NULL
   RETURNING id,kind,host`,[workspaceId,kind,host,email?.redacted??null,encryptSecret(secret,encryptionSecret)])).rows[0];
  await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'notification_saved',$4::jsonb)",[randomUUID(),workspaceId,userId,JSON.stringify({destinationId:row.id,kind:row.kind,host:row.host})]);
  return {destination:row};
 });
}

export async function workspaceNotifications(sql:SqlClient,userId:string,workspaceId:string,before?:string){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(before&&(!/^[1-9]\d*$/.test(before)||!Number.isSafeInteger(Number(before))))throw Object.assign(new Error('Invalid delivery history cursor.'),{status:400});
 if(before&&!(await sql.query('SELECT id FROM notification_deliveries WHERE id=$1 AND workspace_id=$2',[before,workspaceId])).rows.length)throw Object.assign(new Error('Delivery history unavailable.'),{status:404});
 const [destinations,deliveries]=await Promise.all([
  sql.query<{id:number;kind:string;host:string;last_delivery_at:string|null;last_delivery_status:string|null}>(`SELECT d.id,d.kind,d.host,d.last_delivery_at,d.last_delivery_status,d.installation_id IS NULL AS independent,
   (SELECT j.status FROM workspace_notification_jobs j WHERE j.destination_id=d.id AND j.configuration_version=d.configuration_version AND j.purpose='test' ORDER BY j.created_at DESC,j.id DESC LIMIT 1) AS test_status
   FROM notification_destinations d WHERE d.workspace_id=$1 ORDER BY d.kind,d.id`,[workspaceId]),
  sql.query<{id:number;destination_id:number|null;alert_id:number|null;kind:string;status:string;created_at:string;error_code:string|null}>(`SELECT id,destination_id,alert_id,kind,status,created_at,
   CASE WHEN status='sent' THEN NULL WHEN error IN ('configuration','credentials','rejected','temporary') THEN error ELSE 'unknown' END AS error_code
   FROM notification_deliveries WHERE workspace_id=$1 AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT 51`,[workspaceId,before??null]),
 ]);
 return {destinations:destinations.rows,deliveries:deliveries.rows.slice(0,50),nextCursor:deliveries.rows.length>50?String(deliveries.rows[49].id):null,canManage:!access.workspace.archived_at&&['owner','admin'].includes(access.workspace.role)};
}
