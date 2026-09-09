import type {SqlClient} from './sql.ts';
import {workspaceEvidenceSettings} from './workspace-evidence-settings.ts';

function alertId(value:string){
 if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw Object.assign(new Error('Alert unavailable.'),{status:404});
 return Number(value);
}
const projection=`id,installation_id,workspace_id,repo_id,source_origin_id,scan_attempt_id,kind,title,body,findings,
 created_at,acknowledged_at,acknowledged_by_login,assigned_to_user_id,assigned_to_login,resolved_at,resolved_by_login,resolution_note`;

export async function workspaceAlertCounts(sql:SqlClient,userId:string,workspaceId:string){
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 const row=(await sql.query<{open:string;waiting:string;done:string;mine:string}>(`SELECT
 count(*) FILTER(WHERE resolved_at IS NULL AND acknowledged_at IS NULL) AS open,
 count(*) FILTER(WHERE resolved_at IS NULL AND acknowledged_at IS NOT NULL) AS waiting,
 count(*) FILTER(WHERE resolved_at IS NOT NULL) AS done,
 count(*) FILTER(WHERE resolved_at IS NULL AND assigned_to_user_id=$2) AS mine FROM alerts WHERE workspace_id=$1`,[workspaceId,userId])).rows[0];
 return {open:Number(row.open),waiting:Number(row.waiting),done:Number(row.done),mine:Number(row.mine)};
}

export async function workspaceAlertAssignees(sql:SqlClient,userId:string,workspaceId:string,id:string){
 await workspaceAlertDetail(sql,userId,workspaceId,id);
 const {rows}=await sql.query<{id:string;login:string}>(`SELECT u.id,u.login FROM product_workspace_members m
 JOIN users u ON u.id=m.user_id JOIN product_workspaces w ON w.id=m.workspace_id
 JOIN product_organizations o ON o.id=w.organization_id
 LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
 WHERE m.workspace_id=$1 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=m.user_id)
 AND (CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END) IN ('owner','admin','member')
 ORDER BY u.login,u.id`,[workspaceId]);
 return {members:rows};
}

export async function respondToWorkspaceAlert(sql:SqlClient,userId:string,workspaceId:string,id:string,action:string,note?:unknown,assignee?:unknown){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId))throw Object.assign(new Error('Workspace unavailable.'),{status:404});
 if(!['acknowledge','resolve','reopen','assign'].includes(action))throw Object.assign(new Error('Unknown response action.'),{status:400});
 if(action==='assign'&&assignee!==null&&(typeof assignee!=='string'||!assignee.trim()||assignee.length>200))throw Object.assign(new Error('Choose a workspace member or explicitly clear assignment.'),{status:400});
 const key=alertId(id),detail=typeof note==='string'?note.trim():'';
 if(action==='resolve'&&(detail.length<8||detail.length>4000))throw Object.assign(new Error('Resolution note must be between 8 and 4000 characters.'),{status:400});
 await sql.transaction(async tx=>{
  // Membership/archive writers also lock the workspace before changing access.
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR SHARE',[workspaceId]);
  const access=await workspaceEvidenceSettings(tx,userId,workspaceId);
  if(access.workspace.archived_at||!['owner','admin','member'].includes(access.workspace.role))throw Object.assign(new Error('Active workspace responder access is required.'),{status:403});
  const row=(await tx.query<{installation_id:number|null;acknowledged_at:unknown;resolved_at:unknown}>('SELECT installation_id,acknowledged_at,resolved_at FROM alerts WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspaceId,key])).rows[0];
  if(!row)throw Object.assign(new Error('Alert unavailable.'),{status:404});
  const login=(await tx.query<{login:string}>('SELECT login FROM users WHERE id=$1',[userId])).rows[0].login;
  if(action==='assign'){
   let assignedLogin:string|null=null;
   if(typeof assignee==='string'){
    const target=await workspaceEvidenceSettings(tx,assignee,workspaceId);
    if(!['owner','admin','member'].includes(target.workspace.role))throw Object.assign(new Error('Choose a workspace responder.'),{status:400});
    assignedLogin=(await tx.query<{login:string}>('SELECT login FROM users WHERE id=$1',[assignee])).rows[0].login;
   }
   await tx.query('UPDATE alerts SET assigned_to_user_id=$2,assigned_to_login=$3 WHERE id=$1',[key,assignee,assignedLogin]);
   await tx.query("INSERT INTO alert_events(alert_id,installation_id,workspace_id,actor_login,action,detail) VALUES($1,$2,$3,$4,'assigned',$5)",[key,row.installation_id,workspaceId,login,assignedLogin===null?'Assignment cleared':`Assigned to ${assignedLogin}`]);
   return;
  }
  if(action==='acknowledge'){
   if(row.acknowledged_at)return;
   await tx.query('UPDATE alerts SET acknowledged_at=now(),acknowledged_by_login=$2 WHERE id=$1',[key,login]);
  }else if(action==='resolve'){
   if(row.resolved_at)throw Object.assign(new Error('That alert is already resolved.'),{status:409});
   await tx.query('UPDATE alerts SET resolved_at=now(),resolved_by_login=$2,resolution_note=$3,acknowledged_at=COALESCE(acknowledged_at,now()),acknowledged_by_login=COALESCE(acknowledged_by_login,$2) WHERE id=$1',[key,login,detail]);
  }else{
   if(!row.resolved_at)throw Object.assign(new Error('That alert is not resolved.'),{status:409});
   await tx.query('UPDATE alerts SET resolved_at=NULL,resolved_by_login=NULL,resolution_note=NULL WHERE id=$1',[key]);
  }
  await tx.query('INSERT INTO alert_events(alert_id,installation_id,workspace_id,actor_login,action,detail) VALUES($1,$2,$3,$4,$5,$6)',[key,row.installation_id,workspaceId,login,action==='acknowledge'?'acknowledged':action==='resolve'?'resolved':'reopened',action==='resolve'?detail:null]);
 });
 return workspaceAlertDetail(sql,userId,workspaceId,id);
}

/** Workspace identity is authoritative; null installations remain null. */
export async function listWorkspaceAlerts(sql:SqlClient,userId:string,workspaceId:string,before?:string,filter:{status?:string;mine?:boolean;source?:string}={}){
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 const status=filter.status??'all';
 if(!['all','open','waiting','done','mine'].includes(status))throw Object.assign(new Error('Unknown alert status.'),{status:400});
 const source=filter.source;
 if(source&&(!/^(repo|web)-[1-9]\d*$/.test(source)||!Number.isSafeInteger(Number(source.split('-')[1]))))throw Object.assign(new Error('This source filter is unavailable. Clear the source filter to view workspace alerts.'),{status:400});
 const sourceType=source?.split('-')[0]??null,sourceId=source?Number(source.split('-')[1]):null;
 const cursor=before?alertId(before):null;
 if(cursor&&!(await sql.query('SELECT id FROM alerts WHERE workspace_id=$1 AND id=$2',[workspaceId,cursor])).rows.length)
  throw Object.assign(new Error('Alert page unavailable.'),{status:404});
 const {rows}=await sql.query<Record<string,unknown>&{id:number}>(`SELECT ${projection} FROM alerts WHERE workspace_id=$1
 AND ($2::bigint IS NULL OR id<$2)
 AND (NOT $4::boolean OR assigned_to_user_id=$5)
 AND ($6::text IS NULL OR $6='repo' AND repo_id=$7 OR $6='web' AND source_origin_id=$7)
 AND ($3='all' OR $3='open' AND resolved_at IS NULL AND acknowledged_at IS NULL
  OR $3='waiting' AND resolved_at IS NULL AND acknowledged_at IS NOT NULL
  OR $3='done' AND resolved_at IS NOT NULL OR $3='mine' AND resolved_at IS NULL AND assigned_to_user_id=$5)
 ORDER BY id DESC LIMIT 51`,[workspaceId,cursor,status,filter.mine??false,userId,sourceType,sourceId]);
 const totals=(await sql.query<{open:string;waiting:string;done:string;mine:string}>(`SELECT
 count(*) FILTER(WHERE resolved_at IS NULL AND acknowledged_at IS NULL) AS open,
 count(*) FILTER(WHERE resolved_at IS NULL AND acknowledged_at IS NOT NULL) AS waiting,
 count(*) FILTER(WHERE resolved_at IS NOT NULL) AS done,
 count(*) FILTER(WHERE resolved_at IS NULL AND assigned_to_user_id=$2) AS mine
 FROM alerts WHERE workspace_id=$1 AND ($3::text IS NULL OR $3='repo' AND repo_id=$4 OR $3='web' AND source_origin_id=$4)`,[workspaceId,userId,sourceType,sourceId])).rows[0];
 const sources=await sql.query<{count:number|string}>(`SELECT
  (SELECT count(*) FROM watched_origins s WHERE s.workspace_id=$1 AND s.disconnected_at IS NULL AND (s.installation_id IS NULL OR EXISTS(SELECT 1 FROM installations i WHERE i.id=s.installation_id AND i.disconnected_at IS NULL))) +
  (SELECT count(*) FROM repos r JOIN product_workspace_installations c ON c.installation_id=r.installation_id JOIN installations i ON i.id=c.installation_id WHERE c.workspace_id=$1 AND r.disconnected_at IS NULL AND i.disconnected_at IS NULL) +
  (SELECT count(*) FROM watched_packages p JOIN product_workspace_installations c ON c.installation_id=p.installation_id JOIN installations i ON i.id=c.installation_id WHERE c.workspace_id=$1 AND i.disconnected_at IS NULL AND p.disconnected_at IS NULL) AS count`,[workspaceId]);
 return {alerts:rows.slice(0,50),nextCursor:rows.length>50?String(rows[49].id):null,sourceCount:Number(sources.rows[0].count),counts:{open:Number(totals.open),waiting:Number(totals.waiting),done:Number(totals.done),mine:Number(totals.mine)}};
}

export async function workspaceAlertDetail(sql:SqlClient,userId:string,workspaceId:string,id:string,before?:string){
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 const key=alertId(id);
 const alert=(await sql.query(`SELECT ${projection} FROM alerts WHERE workspace_id=$1 AND id=$2`,[workspaceId,key])).rows[0];
 if(!alert)throw Object.assign(new Error('Alert unavailable.'),{status:404});
 const cursor=before?alertId(before):null;
 if(cursor&&!(await sql.query('SELECT id FROM alert_events WHERE workspace_id=$1 AND alert_id=$2 AND id=$3',[workspaceId,key,cursor])).rows.length)throw Object.assign(new Error('Activity page unavailable.'),{status:404});
 const events=await sql.query<{id:number;actor_login:string;action:string;detail:string|null;created_at:string}>('SELECT id,actor_login,action,detail,created_at FROM alert_events WHERE workspace_id=$1 AND alert_id=$2 AND ($3::bigint IS NULL OR id<$3) ORDER BY id DESC LIMIT 51',[workspaceId,key,cursor]);
 return {alert,events:events.rows.slice(0,50).reverse(),nextEventsCursor:events.rows.length>50?String(events.rows[49].id):null};
}
