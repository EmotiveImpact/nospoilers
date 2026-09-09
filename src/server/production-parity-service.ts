import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {clean,fail,IntelligenceError,revision,text,uuid,type Baseline,type Snapshot,type Stream} from '../release-intelligence/model.ts';
import {parityMappings,type ParityMapping} from './production-parity-observation.ts';
import {uploadWorkspaceScope} from './workspaces.ts';
import {refundJobReservation,reserveBillingPayer} from './job-billing.ts';
import {notifyJobQueued} from './job-wake.ts';
export const PRODUCTION_PARITY_JOB='production_parity';
export const PARITY_OWNERSHIP_DAYS=30;
export type ParityRun={id:string;request_key:string;stream_id:string;snapshot_id:string;baseline_revision:number;receipt_fingerprint:string;
  origin_id:number;origin_url:string;origin_generation:string;deployment_id:string;deployed_at:string|Date;actor_user_id:string;mappings:ParityMapping[];
  job_id:number;status:string;result:unknown;reason:string|null;created_at:string|Date;completed_at:string|Date|null};

export async function parityStream(sql:SqlClient,ports:IntelligencePorts,id:string,write=false){
  const s=(await sql.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];
  if(!s)return fail('Release stream unavailable.',404);
  const permission=await ports.access(sql,s.workspace_id,write?'manage':'read',s.source_binding);
  if(write){
    if(!permission.actorUserId||s.archived_at)return fail('An active workspace administrator is required.',403);
    await sql.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);
    await ports.access(sql,s.workspace_id,'manage',s.source_binding);
  }
  return {s,permission};
}

export async function approvedParityEvidence(sql:SqlClient,ports:IntelligencePorts,s:Stream,expectedRevision:number){
  const baseline=(await sql.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1',[s.id])).rows[0];
  if(!baseline||Number(baseline.revision)!==expectedRevision||baseline.action!=='adopt'||!baseline.snapshot_ref)return fail('Refresh and select the currently adopted reference.',409);
  const snapshot=(await sql.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE id=$1 AND stream_id=$2',[baseline.snapshot_ref,s.id])).rows[0];
  if(!snapshot)return fail('Approved evidence is no longer available.',409);
  const exclusion=(await sql.query<{excluded:boolean}>('SELECT excluded FROM release_intelligence_exclusions WHERE stream_id=$1 AND snapshot_ref=$2 ORDER BY revision DESC LIMIT 1',[s.id,snapshot.id])).rows[0];
  if(exclusion?.excluded)return fail('The approved reference is excluded.',409);
  const e=await ports.evidence(sql,s.workspace_id,{kind:snapshot.record_kind,id:snapshot.record_id});
  if(!clean(e)||e.workspaceId!==s.workspace_id||e.fingerprint!==snapshot.receipt_fingerprint||e.digest!==baseline.digest||e.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format)return fail('The approved signed evidence is unavailable or changed.',409);
  return {baseline,snapshot,e};
}

export async function parityOrigin(sql:SqlClient,s:Stream,id:number,lock=true){
  if(!Number.isSafeInteger(id)||id<1)return fail('Choose a verified origin.',400);
  const row=(await sql.query<{id:number;origin_url:string;connection_generation:string}>(`SELECT o.id,o.origin_url,o.connection_generation FROM watched_origins o
    WHERE o.id=$1 AND o.disconnected_at IS NULL AND o.paused_at IS NULL AND o.verification_token IS NOT NULL
      AND o.verified_at>now()-interval '30 days' AND o.verified_at<=now()
      AND (o.workspace_id=$2 OR EXISTS(SELECT 1 FROM product_workspace_installations c JOIN installations i ON i.id=c.installation_id
        WHERE c.workspace_id=$2 AND c.installation_id=o.installation_id AND NOT i.suspended AND i.disconnected_at IS NULL))${lock?' FOR SHARE OF o':''}`,[id,s.workspace_id])).rows[0];
  if(!row)return fail('Verify ownership of this workspace origin within the last 30 days and keep it connected.',409);
  return {...row,id:Number(row.id),connection_generation:String(row.connection_generation)};
}

export function productionParity(sql:SqlClient,ports:IntelligencePorts){return {
  async cancel(id:string,runId:string){return sql.transaction(async tx=>{
    const {s,permission}=await parityStream(tx,ports,id);
    if(!permission.canAdminister)return fail('An administrator must cancel the observation.',403);
    await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);
    if(!(await ports.access(tx,s.workspace_id,'read',s.source_binding)).canAdminister)return fail('Administrator access changed.',403);
    const job=(await tx.query<{id:number;status:string;attempts:number}>(`SELECT j.id,j.status,j.attempts FROM jobs j JOIN release_production_observations r ON r.job_id=j.id WHERE r.id=$1 AND r.stream_id=$2 FOR UPDATE OF j`,[uuid(runId),s.id])).rows[0];
    const changed=await tx.query("UPDATE release_production_observations SET status='cancelled',reason='Cancelled by a workspace administrator.',completed_at=now() WHERE id=$1 AND stream_id=$2 AND status IN ('queued','running','failed') RETURNING id",[uuid(runId),s.id]);
    if(changed.rows.length&&job?.status==='queued'&&Number(job.attempts)===0){
      await refundJobReservation(tx,Number(job.id));
      await tx.query("UPDATE jobs SET status='done',error=NULL WHERE id=$1",[job.id]);
    }
    if(changed.rows.length)await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),s.id,'production_observation_cancelled',permission.actorLogin,JSON.stringify({runId})]);
    return {cancelled:changed.rows.length>0};
  });},
  async view(id:string){return sql.transaction(async tx=>{
    const {s}=await parityStream(tx,ports,id);
    const baseline=(await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1',[s.id])).rows[0];
    let manifest:Array<{path:string;size:number}>=[];
    if(baseline?.action==='adopt'){
      try{
        const approved=await approvedParityEvidence(tx,ports,s,Number(baseline.revision));
        manifest=approved.e.manifest.map(f=>({path:f.path,size:f.size}));
      }catch(error){if(!(error instanceof IntelligenceError)||![404,409,422].includes(error.status))throw error;}
    }
    const origins=(await tx.query(`SELECT o.id,o.origin_url,o.verified_at,o.paused_at,o.disconnected_at FROM watched_origins o
      WHERE o.workspace_id=$1 OR EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.workspace_id=$1 AND c.installation_id=o.installation_id) ORDER BY o.id LIMIT 20`,[s.workspace_id])).rows;
    const savedRuns=(await tx.query<ParityRun>('SELECT * FROM release_production_observations WHERE stream_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10',[s.id])).rows;
    const runs=[];
    for(const run of savedRuns){
      let authorityCurrent=false;
      try{const origin=await parityOrigin(tx,s,Number(run.origin_id),false);authorityCurrent=manifest.length>0&&baseline?.action==='adopt'&&Number(baseline.revision)===Number(run.baseline_revision)&&baseline.snapshot_ref===run.snapshot_id&&origin.connection_generation===run.origin_generation&&origin.origin_url===run.origin_url;}
      catch(error){if(!(error instanceof IntelligenceError)||error.status!==409)throw error;}
      const completed=run.completed_at?new Date(run.completed_at).getTime():NaN;
      runs.push({...run,authorityCurrent,stale:!Number.isFinite(completed)||completed>Date.now()||Date.now()-completed>86400000});
    }
    const permission=await ports.access(tx,s.workspace_id,'read',s.source_binding);
    return {canManage:permission.canManage,canCancel:permission.canAdminister??false,baselineRevision:baseline?.action==='adopt'?Number(baseline.revision):null,manifest,origins,runs,
      notice:'Select approved manifest files and their public paths. One bounded observation uses your existing scan allowance. Verify origin ownership within 30 days. No deployment gate changes.'};
  });},
  async queue(id:string,input:{requestKey:unknown;expectedBaselineRevision:unknown;originId:unknown;deploymentId:unknown;deployedAt:unknown;mappings:unknown;confirm?:unknown}){return sql.transaction(async tx=>{
    const {s,permission}=await parityStream(tx,ports,id,true);
    if(input.confirm!==true)return fail('Confirm the deployment and exact public-file mapping.');
    const requestKey=uuid(input.requestKey),expected=revision(input.expectedBaselineRevision),deployment=text(input.deploymentId,'Deployment identity',1,120);
    const deployedAt=typeof input.deployedAt==='string'?new Date(input.deployedAt):new Date(NaN);
    if(!Number.isFinite(deployedAt.getTime())||deployedAt.getTime()>Date.now()||deployedAt.getTime()<Date.now()-30*86400000)return fail('Choose a deployment time within the last 30 days, not in the future.');
    const approved=await approvedParityEvidence(tx,ports,s,expected),origin=await parityOrigin(tx,s,Number(input.originId));
    const mappings=parityMappings(input.mappings,approved.e.manifest);
    const existing=(await tx.query<ParityRun>('SELECT * FROM release_production_observations WHERE request_key=$1',[requestKey])).rows[0];
    if(existing){
      if(existing.stream_id!==s.id||Number(existing.baseline_revision)!==expected||existing.origin_url!==origin.origin_url||existing.deployment_id!==deployment||new Date(existing.deployed_at).getTime()!==deployedAt.getTime()||JSON.stringify(parityMappings(existing.mappings,approved.e.manifest))!==JSON.stringify(mappings))return fail('Request identity was already used for a different observation.',409);
      return {id:existing.id,status:existing.status};
    }
    if((await tx.query(`SELECT r.id FROM release_production_observations r WHERE r.stream_id IN (SELECT id FROM release_intelligence_streams WHERE workspace_id=$1)
      AND (r.status IN ('queued','running') OR (r.status='failed' AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=r.job_id AND j.status IN ('queued','running')))) LIMIT 1`,[s.workspace_id])).rows.length)return fail('A production observation is already pending in this workspace.',409);
    const payer=await uploadWorkspaceScope(tx,permission.actorUserId!,null,s.workspace_id);
    if(!await reserveBillingPayer(tx,payer))return fail('Workspace scan allowance is unavailable.',429);
    const runId=randomUUID();
    await tx.query(`INSERT INTO release_production_observations(id,request_key,stream_id,snapshot_id,baseline_revision,receipt_fingerprint,origin_id,origin_url,origin_generation,deployment_id,deployed_at,actor_user_id,mappings)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,[runId,requestKey,s.id,approved.snapshot.id,expected,approved.e.fingerprint,origin.id,origin.origin_url,origin.connection_generation,deployment,deployedAt.toISOString(),permission.actorUserId,JSON.stringify(mappings)]);
    // Freeze the existing payer at creation, as uploaded jobs do. Ownership must
    // never be rewritten after enqueue (the core schema enforces that invariant).
    const job=(await tx.query<{id:number}>(`INSERT INTO jobs(delivery_id,priority,kind,payload,usage_reserved,usage_day,billing_installation_id,billing_user_id)
      VALUES($1,'heavy',$2,$3::jsonb,true,(timezone('utc',now()))::date,$4,$5) RETURNING id`,[`parity:${runId}`,PRODUCTION_PARITY_JOB,JSON.stringify({runId}),payer.billing_installation_id,payer.billing_user_id])).rows[0];
    if(!job)throw new Error('Could not queue production observation.');
    await tx.query('UPDATE release_production_observations SET job_id=$2 WHERE id=$1',[runId,job.id]);
    await notifyJobQueued(tx,PRODUCTION_PARITY_JOB);
    await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),s.id,'production_observation_queued',permission.actorLogin,JSON.stringify({runId,baselineRevision:expected,deploymentId:deployment})]);
    return {id:runId,status:'queued'};
  });},
};}
