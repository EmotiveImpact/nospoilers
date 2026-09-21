import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import {createStore} from './store.ts';
import {fail,IntelligenceError,reference,revision,text,uuid} from '../release-intelligence/model.ts';
import type {Ref,Stream} from '../release-intelligence/model.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {captureIdentity} from './automatic-capture-identity.ts';
export const AUTOMATIC_CAPTURE_JOB='release_history_capture';
export type CaptureRule={stream_id:string;enabled:boolean;revision:number;actor_user_id:string;selector:string;connection_generation:string;updated_at:string};

export function automaticCapture(sql:SqlClient,ports:IntelligencePorts){
  async function stream(tx:SqlClient,id:string,write=false){
    const s=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];
    if(!s) return fail('Release stream unavailable.',404);
    let permission=await ports.access(tx,s.workspace_id,'read',s.source_binding);
    if(write){
      if(!permission.canAdminister||!permission.actorUserId)fail('A workspace administrator must change automatic capture.',403);
      await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);
      permission=await ports.access(tx,s.workspace_id,'read',s.source_binding);
      if(!permission.canAdminister||!permission.actorUserId)fail('Administrator access changed.',403);
    }
    return {s,permission};
  }
  return {
    async view(id:string,raw?:unknown){return sql.transaction(async tx=>{
      const {s}=await stream(tx,id);
      const config=(await tx.query<CaptureRule>('SELECT * FROM release_intelligence_capture_rules WHERE stream_id=$1',[s.id])).rows[0];
      let candidate:Awaited<ReturnType<typeof captureIdentity>>=null;
      if(raw){
        const ref=reference(raw);
        try{
          const e=await ports.evidence(tx,s.workspace_id,ref);candidate=await captureIdentity(tx,ref);
          if(!candidate||candidate.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format||candidate.format!==s.format||candidate.channel!==s.channel)candidate=null;
        }catch(error){
          // The stream was authorised above. Missing/invalid seed evidence must not
          // hide an existing rule's stop control. Never swallow database failures
          // or changed authorisation, and enabling still verifies the record anew.
          if(!(error instanceof IntelligenceError)||![404,409,422].includes(error.status))throw error;
        }
      }
      const attempts=(await tx.query(`SELECT a.id,a.record_kind,a.record_id,a.status,a.outcome,a.updated_at,j.status AS job_status
        FROM release_intelligence_capture_attempts a LEFT JOIN jobs j ON j.id=a.job_id WHERE a.stream_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 10`,[s.id])).rows;
      const permission=await ports.access(tx,s.workspace_id,'read',s.source_binding);
      return {config:config?{enabled:config.enabled,revision:Number(config.revision),selector:config.selector}:null,
        candidate:candidate?{selector:candidate.selector,channel:candidate.channel,format:candidate.format}:null,
        canManage:permission.canManage,canDisable:permission.canAdminister??false,attempts,
        notice:'Opt-in applies to future completed records matching this exact connected source, artifact selector, channel and format. No baseline is adopted automatically.'};
    });},
    async configure(id:string,input:{enabled:unknown;expectedRevision:unknown;record?:unknown;reason:unknown;confirm?:unknown}){
      if(typeof input.enabled!=='boolean')fail('Choose whether automatic capture is enabled.');
      const expected=revision(input.expectedRevision),reason=text(input.reason,'Reason',8,1000);
      return sql.transaction(async tx=>{
        const {s,permission}=await stream(tx,id,true);
        const old=(await tx.query<CaptureRule>('SELECT * FROM release_intelligence_capture_rules WHERE stream_id=$1',[s.id])).rows[0];
        if(Number(old?.revision??0)!==expected)fail('Automatic capture changed. Refresh before saving.',409);
        if(!input.enabled&&!old)return {revision:0,enabled:false};
        let selector=old?.selector,generation=old?.connection_generation;
        if(input.enabled){
          if(input.confirm!==true)fail('Confirm the exact source and artifact selection.');
          if(s.archived_at)fail('This release stream is archived.',409);
          await ports.access(tx,s.workspace_id,'manage',s.source_binding);
          const ref=reference(input.record),e=await ports.evidence(tx,s.workspace_id,ref);
          const candidate=await captureIdentity(tx,ref,true);
          if(!candidate||candidate.source!==s.source_binding||e.source!==s.source_binding||e.workspaceId!==s.workspace_id||e.channel!==s.channel||e.format!==s.format||candidate.channel!==s.channel||candidate.format!==s.format)fail('Choose a completed record from this exact connected source, channel and format. Manual uploads keep explicit CI capture.',409);
          if(old&&old.selector!==candidate.selector)fail('The selected artifact differs from this capture rule. Create a separate stream.',409);
          selector=candidate.selector;generation=candidate.generation;
          const duplicate=await tx.query(`SELECT r.stream_id FROM release_intelligence_capture_rules r JOIN release_intelligence_streams s ON s.id=r.stream_id
            WHERE s.workspace_id=$1 AND s.source_binding=$2 AND s.channel=$3 AND s.format=$4 AND r.selector=$5 AND r.enabled AND r.stream_id<>$6`,[s.workspace_id,s.source_binding,s.channel,s.format,selector,s.id]);
          if(duplicate.rows.length)fail('This source and artifact are already automatically captured in another stream.',409);
        }
        await tx.query('SELECT id FROM release_intelligence_streams WHERE id=$1 FOR UPDATE',[s.id]);
        const next=expected+1;
        await tx.query(`INSERT INTO release_intelligence_capture_rules(stream_id,enabled,revision,actor_user_id,selector,connection_generation)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(stream_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,
          actor_user_id=excluded.actor_user_id,connection_generation=excluded.connection_generation,updated_at=now()`,[s.id,input.enabled,next,permission.actorUserId,selector,generation]);
        await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),s.id,input.enabled?'automatic_capture_enabled':'automatic_capture_disabled',permission.actorLogin,JSON.stringify({revision:next,selector,reason})]);
        await ports.access(tx,s.workspace_id,input.enabled?'manage':'read',s.source_binding);
        return {revision:next,enabled:input.enabled};
      });
    },
  };
}

/** Called inside the successful publication transaction. No scan or external work. */
export async function enqueueAutomaticCapture(sql:SqlClient,record:Ref){
  // Original schema-only consumers do not install the optional intelligence layer.
  if(!(await sql.query<{name:string|null}>("SELECT to_regclass('release_intelligence_capture_rules')::text AS name")).rows[0]?.name)return;
  const identity=await captureIdentity(sql,record);if(!identity)return;
  const rules=(await sql.query<{stream_id:string;revision:number}>(`SELECT r.stream_id,r.revision FROM release_intelligence_capture_rules r
    JOIN release_intelligence_streams s ON s.id=r.stream_id
    WHERE r.enabled AND s.archived_at IS NULL AND s.source_binding=$1 AND s.channel=$2 AND s.format=$3
      AND r.selector=$4 AND r.connection_generation=$5 AND r.updated_at<=$6::timestamptz
      AND (($7::uuid IS NOT NULL AND s.workspace_id=$7) OR ($8::bigint IS NOT NULL AND EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.workspace_id=s.workspace_id AND c.installation_id=$8)))`,
    [identity.source,identity.channel,identity.format,identity.selector,identity.generation,identity.createdAt,identity.workspaceId,identity.installationId])).rows;
  for(const rule of rules){
    const id=randomUUID();
    const inserted=await sql.query(`INSERT INTO release_intelligence_capture_attempts(id,stream_id,rule_revision,record_kind,record_id,release_id,upload_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(stream_id,rule_revision,record_kind,record_id) DO NOTHING RETURNING id`,[id,rule.stream_id,rule.revision,record.kind,record.id,record.kind==='release'?Number(record.id):null,record.kind==='upload'?record.id:null]);
    if(!inserted.rows.length)continue;
    const job=await createStore(sql).enqueueJob({deliveryId:`history:${id}`,priority:'light',kind:AUTOMATIC_CAPTURE_JOB,payload:{captureId:id}});
    if(!job.id)throw new Error('Could not queue historical capture.');
    await sql.query('UPDATE release_intelligence_capture_attempts SET job_id=$2 WHERE id=$1',[id,job.id]);
  }
}
