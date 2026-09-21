import type {SqlClient} from './sql.ts';
import {IntelligenceError,reference,uuid} from '../release-intelligence/model.ts';
import type {Stream} from '../release-intelligence/model.ts';
import {intelligenceCapturePorts} from './release-intelligence-adapter.ts';
import {releaseIntelligence} from './release-intelligence-service.ts';
import {captureIdentity} from './automatic-capture-identity.ts';
import type {CaptureRule} from './automatic-capture.ts';
type Attempt={id:string;stream_id:string;rule_revision:number;record_kind:'upload'|'release';record_id:string;job_id:number;status:string};

export async function processAutomaticCapture(sql:SqlClient,rawId:unknown,secret:string,lease:{jobId:number;workerId:string}){
  const id=uuid(rawId);
  try{
    await sql.transaction(async tx=>{
      const attempt=(await tx.query<Attempt>('SELECT * FROM release_intelligence_capture_attempts WHERE id=$1',[id])).rows[0];
      if(!attempt||Number(attempt.job_id)!==lease.jobId||attempt.status==='captured'||attempt.status==='stopped')return;
      const stream=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[attempt.stream_id])).rows[0];
      const initial=(await tx.query<CaptureRule>('SELECT * FROM release_intelligence_capture_rules WHERE stream_id=$1',[attempt.stream_id])).rows[0];
      if(!stream||!initial)throw new IntelligenceError('Capture grant removed.',403);
      const ports=intelligenceCapturePorts(initial.actor_user_id,secret);
      await ports.access(tx,stream.workspace_id,'manage',stream.source_binding);
      await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[stream.workspace_id]);
      await ports.access(tx,stream.workspace_id,'manage',stream.source_binding);
      const record=reference({kind:attempt.record_kind,id:attempt.record_id});
      const identity=await captureIdentity(tx,record,true);
      await tx.query('SELECT id FROM release_intelligence_streams WHERE id=$1 FOR UPDATE',[stream.id]);
      const rule=(await tx.query<CaptureRule>('SELECT * FROM release_intelligence_capture_rules WHERE stream_id=$1 FOR UPDATE',[stream.id])).rows[0];
      const owned=await tx.query("SELECT id FROM jobs WHERE id=$1 AND locked_by=$2 AND status='running' FOR UPDATE",[lease.jobId,lease.workerId]);
      if(!owned.rows.length)return;
      if(!rule?.enabled||Number(rule.revision)!==Number(attempt.rule_revision)||rule.actor_user_id!==initial.actor_user_id||!identity||identity.source!==stream.source_binding||identity.channel!==stream.channel||identity.format!==stream.format||identity.selector!==rule.selector||identity.generation!==rule.connection_generation){
        await tx.query("UPDATE release_intelligence_capture_attempts SET status='stopped',outcome='configuration_or_source_changed',updated_at=now() WHERE id=$1",[id]);return;
      }
      const result=await releaseIntelligence(tx,ports).capture(stream.id,record);
      await tx.query("UPDATE release_intelligence_capture_attempts SET status='captured',outcome=$2,snapshot_id=$3,updated_at=now() WHERE id=$1",[id,result.inserted?'recorded':'already_recorded',result.snapshot.id]);
    });
  }catch(error){
    const stopped=error instanceof IntelligenceError&&[401,402,403,404,409,422].includes(error.status);
    // Fixed reason codes only: no paths, receipt values or source contents in logs.
    await sql.query(`UPDATE release_intelligence_capture_attempts a SET status=$2,outcome=$3,updated_at=now()
      WHERE a.id=$1 AND a.status<>'captured' AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=a.job_id AND j.id=$4 AND j.locked_by=$5 AND j.status='running')`,
      [id,stopped?'stopped':'failed',stopped?'access_or_evidence_unavailable':'capture_temporarily_unavailable',lease.jobId,lease.workerId]);
    if(!stopped)throw new Error('Historical capture is temporarily unavailable; the saved scan is unchanged.');
  }
}
