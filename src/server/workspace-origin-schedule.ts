import {createHash} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {Store} from './store.ts';
import {uploadWorkspaceScope} from './workspaces.ts';

/** An explicit member authorises recurring work; losing that authority stops admission. */
export async function setWorkspaceOriginSchedule(sql:SqlClient,userId:string,workspaceId:string,originId:number,hours:number){
 if(![0,6,24].includes(hours))throw Object.assign(new Error('Choose manual checks, every 6 hours or daily.'),{status:400});
 if(!Number.isSafeInteger(originId)||originId<=0||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId))throw Object.assign(new Error('Website unavailable.'),{status:404});
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
  await uploadWorkspaceScope(tx,userId,null,workspaceId);
  const result=await tx.query(`UPDATE watched_origins SET schedule_hours=$4,schedule_actor_id=$3,schedule_version=schedule_version+1,
   next_check_at=CASE WHEN $4=0 THEN NULL ELSE now()+$4*interval '1 hour' END,schedule_error=NULL
   WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND disconnected_at IS NULL
   AND ($4=0 OR verified_at IS NOT NULL) RETURNING id`,[originId,workspaceId,userId,hours]);
  if(!result.rows.length)throw Object.assign(new Error('Verify a connected website before enabling its schedule.'),{status:409});
  await tx.query("INSERT INTO workspace_origin_events(workspace_id,origin_id,actor_user_id,action) VALUES($1,$2,$3,'schedule_changed')",[workspaceId,originId,userId]);
  return {ok:true};
 });
}

/** Admission and moving next_check_at commit together in the shared queue transaction. */
export async function runWorkspaceOriginPoll({store}:{store:Store}):Promise<{queued:number}>{
 const rows=(await store.sql.query<{id:number|string;workspace_id:string;origin_url:string;schedule_actor_id:string;schedule_version:number;next_check_at:string|Date}>(`SELECT s.id,s.workspace_id,s.origin_url,s.schedule_actor_id,s.schedule_version,s.next_check_at
  FROM watched_origins s JOIN product_workspaces w ON w.id=s.workspace_id
  WHERE s.installation_id IS NULL AND s.schedule_hours>0 AND s.next_check_at<=now()
   AND s.disconnected_at IS NULL AND s.paused_at IS NULL AND s.verified_at IS NOT NULL AND w.archived_at IS NULL
  ORDER BY s.next_check_at,s.id LIMIT 100`)).rows;
 let queued=0;
 for(const source of rows){
  const dueAt=new Date(source.next_check_at).toISOString();
  const id=`website-schedule-${createHash('sha256').update(`${source.id}:${source.schedule_version}:${dueAt}`).digest('hex')}`;
  try{
   await store.queueUploadedScan({id,userId:source.schedule_actor_id,installationId:null,workspaceId:source.workspace_id,target:source.origin_url,bytes:new Uint8Array(),sourceOriginId:Number(source.id),meta:{coordinate:`web:${source.origin_url}`},schedule:{version:source.schedule_version,dueAt}});
   queued++;
  }catch(error){
   const status=(error as {status?:number}).status;
   // Unexpected infrastructure failures remain observable to the existing poller logger.
   if(!status)throw error;
   const message=status===402||status===429?'Scheduled check delayed: plan or scan allowance needs attention.':status===403||status===404?'Scheduled check stopped: the authorising member no longer has access. Save the schedule as a current member.':'Scheduled check delayed: another check is processing or the source changed.';
   await store.sql.query("UPDATE watched_origins SET schedule_error=$4 WHERE id=$1 AND schedule_version=$2 AND date_trunc('milliseconds',next_check_at)=$3::timestamptz",[source.id,source.schedule_version,dueAt,message]);
  }
 }
 return {queued};
}
