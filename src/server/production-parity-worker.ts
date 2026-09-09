import type {SqlClient} from './sql.ts';
import {IntelligenceError,uuid} from '../release-intelligence/model.ts';
import {intelligenceCapturePorts} from './release-intelligence-adapter.ts';
import {approvedParityEvidence,parityOrigin,parityStream,type ParityRun} from './production-parity-service.ts';
import {observeProductionManifest} from './production-parity-observation.ts';

export async function processProductionParity(sql:SqlClient,rawId:unknown,secret:string,lease:{jobId:number;workerId:string},deps:Parameters<typeof observeProductionManifest>[1]={}){
  const id=uuid(rawId),controller=new AbortController();
  let polling:Promise<void>|undefined;
  const owns=async()=>Boolean((await sql.query("SELECT j.id FROM jobs j JOIN release_production_observations r ON r.job_id=j.id WHERE r.id=$1 AND j.id=$2 AND j.locked_by=$3 AND j.status='running' AND r.status NOT IN ('completed','stopped','cancelled')",[id,lease.jobId,lease.workerId])).rows.length);
  try{
    const prepared=await sql.transaction(async tx=>{
      const run=(await tx.query<ParityRun>('SELECT * FROM release_production_observations WHERE id=$1',[id])).rows[0];
      if(!run||Number(run.job_id)!==lease.jobId||['completed','stopped','cancelled'].includes(run.status))return null;
      const ports=intelligenceCapturePorts(run.actor_user_id,secret);
      const {s}=await parityStream(tx,ports,run.stream_id,true);
      const approved=await approvedParityEvidence(tx,ports,s,Number(run.baseline_revision)),origin=await parityOrigin(tx,s,Number(run.origin_id));
      if(origin.connection_generation!==run.origin_generation||origin.origin_url!==run.origin_url||approved.e.fingerprint!==run.receipt_fingerprint||approved.snapshot.id!==run.snapshot_id)throw new IntelligenceError('Observation binding changed.',409);
      const owned=await tx.query("SELECT id FROM jobs WHERE id=$1 AND locked_by=$2 AND status='running' FOR UPDATE",[lease.jobId,lease.workerId]);
      if(!owned.rows.length)return null;
      const changed=await tx.query("UPDATE release_production_observations SET status='running',reason=NULL WHERE id=$1 AND status IN ('queued','running','failed') RETURNING id",[id]);
      return changed.rows.length?{run,s,manifest:approved.e.manifest}:null;
    });
    if(!prepared)return;
    // No DB locks across network work. Cancellation or a lost lease stops in-flight I/O.
    const timer=setInterval(()=>{
      if(polling)return;
      polling=owns().then(active=>{if(!active)controller.abort();}).catch(()=>controller.abort()).finally(()=>{polling=undefined;});
    },1000);
    let result:Awaited<ReturnType<typeof observeProductionManifest>>;
    try{result=await observeProductionManifest({origin:prepared.run.origin_url,manifest:prepared.manifest,mappings:prepared.run.mappings,signal:controller.signal},{...deps,beforeRequest:async()=>{
      try{
        if(!await owns())throw new IntelligenceError('Observation lease ended.',409);
        const ports=intelligenceCapturePorts(prepared.run.actor_user_id,secret);
        await ports.access(sql,prepared.s.workspace_id,'manage',prepared.s.source_binding);
        const origin=await parityOrigin(sql,prepared.s,Number(prepared.run.origin_id),false);
        const current=(await sql.query<{revision:number;action:string}>('SELECT revision,action FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1',[prepared.s.id])).rows[0];
        if(origin.connection_generation!==prepared.run.origin_generation||!current||Number(current.revision)!==Number(prepared.run.baseline_revision)||current.action!=='adopt')throw new IntelligenceError('Observation authority changed.',409);
        await deps?.beforeRequest?.();
      }catch(error){controller.abort();throw error;}
    }});}
    finally{clearInterval(timer);await polling;}
    await sql.transaction(async tx=>{
      const ports=intelligenceCapturePorts(prepared.run.actor_user_id,secret),{s}=await parityStream(tx,ports,prepared.run.stream_id,true);
      const approved=await approvedParityEvidence(tx,ports,s,Number(prepared.run.baseline_revision)),origin=await parityOrigin(tx,s,Number(prepared.run.origin_id));
      if(origin.connection_generation!==prepared.run.origin_generation||approved.e.fingerprint!==prepared.run.receipt_fingerprint||approved.snapshot.id!==prepared.run.snapshot_id)throw new IntelligenceError('Observation binding changed.',409);
      await tx.query(`UPDATE release_production_observations r SET status='completed',result=$2::jsonb,completed_at=now()
        WHERE r.id=$1 AND r.status='running' AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=r.job_id AND j.id=$3 AND j.locked_by=$4 AND j.status='running')`,[id,JSON.stringify(result),lease.jobId,lease.workerId]);
    });
  }catch(error){
    const stopped=error instanceof IntelligenceError&&[401,402,403,404,409,422].includes(error.status);
    await sql.query(`UPDATE release_production_observations r SET status=$2,reason=$3,completed_at=now()
      WHERE r.id=$1 AND r.status NOT IN ('completed','cancelled','stopped') AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=r.job_id AND j.id=$4 AND j.locked_by=$5 AND j.status='running')`,
      [id,stopped?'stopped':'failed',stopped?'Access, reference or origin authority changed.':'Observation temporarily unavailable; original evidence unchanged.',lease.jobId,lease.workerId]);
    if(!stopped)throw new Error('Production observation temporarily unavailable.');
  }finally{controller.abort();}
}
