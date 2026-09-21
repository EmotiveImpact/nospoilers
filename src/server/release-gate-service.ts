import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {fail,IntelligenceError,reference,revision,text,uuid,type Evidence,type Ref,type Stream,type Snapshot} from '../release-intelligence/model.ts';
import {DEFAULT_GATE,evaluateGate,gatePolicy,type GatePolicy,type GateResult} from '../release-intelligence/gate.ts';
type PolicyRow={revision:number;mode:GatePolicy['mode'];max_age_hours:number};
type DecisionRow={id:string;stream_id:string;record_kind:Ref['kind'];record_id:string;digest:string;receipt_fingerprint:string|null;policy_revision:number;mode:GatePolicy['mode'];deployment_id:string;result:GateResult;expires_at:string|Date;capability_key:string|null};
const digestValue=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:fail('Supply the exact lowercase SHA-256 artifact digest.');
export function releaseGate(sql:SqlClient,ports:IntelligencePorts){
  async function scope(tx:SqlClient,id:string,mode:'read'|'write'|'manage'){
    const found=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];
    if(!found)return fail('Release stream unavailable.',404);
    await ports.access(tx,found.workspace_id,mode,found.source_binding);
    if(mode!=='read')await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[found.workspace_id]);
    const s=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[found.id])).rows[0];
    if(!s)return fail('Release stream unavailable.',404);
    if(mode!=='read'&&s.archived_at)return fail('Release stream is archived.',409);
    const permission=await ports.access(tx,s.workspace_id,mode,s.source_binding);
    return {s,permission};
  }
  async function policy(tx:SqlClient,id:string):Promise<GatePolicy>{
    const row=(await tx.query<PolicyRow>('SELECT revision,mode,max_age_hours FROM release_gate_policies WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1',[id])).rows[0];
    return row?{revision:Number(row.revision),mode:row.mode,maxAgeHours:Number(row.max_age_hours)}:DEFAULT_GATE;
  }
  async function evidence(tx:SqlClient,s:Stream,ref:Ref){
    const snap=(await tx.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE stream_id=$1 AND record_kind=$2 AND record_id=$3',[s.id,ref.kind,ref.id])).rows[0];
    if(!snap)return fail('Record this exact scan in the release stream before checking the gate.',409);
    let e:Evidence|null=null;
    try{
      e=await ports.evidence(tx,s.workspace_id,ref);
      if(e.workspaceId!==s.workspace_id||e.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format||e.digest!==snap.digest||e.fingerprint!==snap.receipt_fingerprint)return fail('Original evidence no longer matches the recorded stream.',422);
    }catch(error){if(!(error instanceof IntelligenceError)||![409,422].includes(error.status))throw error;e=null;}
    return {snap,e};
  }
  async function audit(tx:SqlClient,s:Stream,actor:string,action:string,detail:object){
    await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),s.id,action,actor,JSON.stringify(detail)]);
  }
  async function currentDecision(tx:SqlClient,s:Stream,id:string){
    const row=(await tx.query<DecisionRow>('SELECT * FROM release_gate_decisions WHERE id=$1 AND stream_id=$2',[uuid(id),s.id])).rows[0];
    if(!row)return fail('Gate decision unavailable.',404);
    const p=await policy(tx,s.id);
    if(p.revision!==Number(row.policy_revision)||new Date(row.expires_at).getTime()<=Date.now())return fail('Gate decision expired or policy changed. Evaluate again.',409);
    const {e}=await evidence(tx,s,{kind:row.record_kind,id:row.record_id});
    const fresh=evaluateGate(e,row.digest,p);
    if((e?.fingerprint??null)!==row.receipt_fingerprint||fresh.readiness!==row.result.readiness||fresh.overridable!==row.result.overridable||fresh.reason!==row.result.reason)return fail('Evidence or governance changed. Evaluate again.',409);
    if((await tx.query('SELECT id FROM release_gate_consumptions WHERE decision_id=$1',[row.id])).rows.length)return fail('This gate decision has already been consumed. Evaluate again for another deployment attempt.',409);
    return {row,p,fresh};
  }
  return {
    async view(id:string,ref?:Ref){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,'read'),p=await policy(tx,id);
      let binding:{digest:string;record:Ref}|null=null;
      if(ref){try{const {snap}=await evidence(tx,s,ref);binding={digest:snap.digest,record:ref};}
        catch(error){if(!(error instanceof IntelligenceError)||error.status!==409)throw error;}}
      const policies=permission.capabilityKey?[]:(await tx.query('SELECT revision,mode,max_age_hours,rollback_from,reason,actor_login,created_at FROM release_gate_policies WHERE stream_id=$1 ORDER BY revision DESC LIMIT 20',[id])).rows;
      const decisions=permission.capabilityKey?[]:(await tx.query(`SELECT d.*,EXISTS(SELECT 1 FROM release_gate_overrides o WHERE o.decision_id=d.id) AS overridden,
        EXISTS(SELECT 1 FROM release_gate_consumptions c WHERE c.decision_id=d.id) AS consumed FROM release_gate_decisions d WHERE d.stream_id=$1 ORDER BY d.created_at DESC LIMIT 10`,[id])).rows;
      await ports.access(tx,s.workspace_id,'read',s.source_binding);
      return {policy:p,policies,decisions,binding,canManage:permission.canManage,canWrite:permission.canWrite,canAdminister:permission.canAdminister??false,
        notice:'Opt-in pre-deployment gate. CI must explicitly consume a fresh decision. Production observations are separate; original scan results never change.'};
    });},
    async configure(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,'manage'),p=await policy(tx,id);
      if(revision(input.expectedRevision)!==p.revision)return fail('Gate policy changed. Reload before saving.',409);
      if(input.confirm!==true)return fail('Confirm the gate change for this stream.');
      const reason=text(input.reason,'Reason',8,1000);
      let configuration=gatePolicy(input.mode,input.maxAgeHours),rollback:number|null=null;
      if(input.rollbackFromRevision!==undefined){
        rollback=revision(input.rollbackFromRevision);
        const old=(await tx.query<PolicyRow>('SELECT revision,mode,max_age_hours FROM release_gate_policies WHERE stream_id=$1 AND revision=$2',[id,rollback])).rows[0];
        if(!old)return fail('Previous policy revision unavailable.',404);
        configuration=gatePolicy(old.mode,Number(old.max_age_hours));
      }
      const next=p.revision+1;
      await tx.query('INSERT INTO release_gate_policies(id,stream_id,revision,mode,max_age_hours,rollback_from,reason,actor_login) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),id,next,configuration.mode,configuration.maxAgeHours,rollback,reason,permission.actorLogin]);
      await audit(tx,s,permission.actorLogin,'release_gate_policy_adopted',{revision:next,...configuration,rollbackFromRevision:rollback});
      await ports.access(tx,s.workspace_id,'manage',s.source_binding);
      return {...configuration,revision:next};
    });},
    async evaluate(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,'write'),p=await policy(tx,id);
      if(revision(input.expectedPolicyRevision)!==p.revision)return fail('Gate policy changed. Reload before evaluating.',409);
      const key=uuid(input.requestKey),ref=reference(input.record),digest=digestValue(input.digest),deployment=text(input.deploymentId,'Deployment identity',1,120);
      const {snap,e}=await evidence(tx,s,ref);
      if(snap.digest!==digest)return fail('Requested digest does not match this saved record.',409);
      const existing=(await tx.query<DecisionRow>('SELECT * FROM release_gate_decisions WHERE request_key=$1',[key])).rows[0];
      if(existing){
        if(existing.stream_id!==id||existing.record_kind!==ref.kind||existing.record_id!==ref.id||existing.digest!==digest||Number(existing.policy_revision)!==p.revision||existing.deployment_id!==deployment||existing.capability_key!==(permission.capabilityKey??null))return fail('Request identity already belongs to another gate evaluation.',409);
        return existing;
      }
      const result=evaluateGate(e,digest,p),decisionId=randomUUID(),expires=new Date(Date.now()+5*60000).toISOString();
      const row=(await tx.query<DecisionRow>(`INSERT INTO release_gate_decisions(id,request_key,stream_id,record_kind,record_id,upload_id,release_id,digest,receipt_fingerprint,policy_revision,mode,deployment_id,result,expires_at,capability_key)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15) RETURNING *`,[decisionId,key,id,ref.kind,ref.id,ref.kind==='upload'?ref.id:null,ref.kind==='release'?ref.id:null,digest,e?.fingerprint??null,p.revision,p.mode,deployment,JSON.stringify(result),expires,permission.capabilityKey??null])).rows[0];
      await audit(tx,s,permission.actorLogin,'release_gate_evaluated',{decisionId,readiness:result.readiness,policyRevision:p.revision});
      await ports.access(tx,s.workspace_id,'write',s.source_binding);
      return row;
    });},
    async override(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,'manage'),{row,fresh}=await currentDecision(tx,s,uuid(input.decisionId));
      if(input.confirm!==true)return fail('Confirm the explicit exception for this exact decision.');
      if(!fresh.overridable)return fail('Unknown evidence, holds and passing decisions cannot receive this override.',409);
      const reason=text(input.reason,'Override reason',12,1000);
      const changed=await tx.query('INSERT INTO release_gate_overrides(id,decision_id,reason,actor_login) VALUES($1,$2,$3,$4) ON CONFLICT(decision_id) DO NOTHING RETURNING id',[randomUUID(),row.id,reason,permission.actorLogin]);
      if(!changed.rows.length)return fail('This decision already has an override.',409);
      await audit(tx,s,permission.actorLogin,'release_gate_overridden',{decisionId:row.id,reason});
      await ports.access(tx,s.workspace_id,'manage',s.source_binding);
      return {decisionId:row.id,overridden:true,readiness:fresh.readiness};
    });},
    async consume(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,'write'),{row,p,fresh}=await currentDecision(tx,s,uuid(input.decisionId));
      if(row.capability_key!==null&&row.capability_key!==permission.capabilityKey)return fail('CI grant changed. Evaluate a new decision under the current grant.',409);
      if(digestValue(input.digest)!==row.digest||text(input.deploymentId,'Deployment identity',1,120)!==row.deployment_id||revision(input.expectedPolicyRevision)!==p.revision)return fail('Gate decision binding changed.',409);
      if(input.record!==undefined){const ref=reference(input.record);if(ref.kind!==row.record_kind||ref.id!==row.record_id)return fail('Gate decision record changed.',409);}
      const overridden=(await tx.query('SELECT id FROM release_gate_overrides WHERE decision_id=$1',[row.id])).rows.length>0;
      const outcome=p.mode!=='enforce'?'not_enforced':fresh.readiness==='ready'?'allowed':overridden&&fresh.overridable?'override':'denied';
      const result={decisionId:row.id,policyRevision:p.revision,mode:p.mode,readiness:fresh.readiness,outcome,
        proceed:outcome!=='denied',warning:p.mode==='warn'&&fresh.readiness!=='ready',digest:row.digest,deploymentId:row.deployment_id,notice:'Single-use gate decision; not a new scan receipt or proof of deployment.'};
      await ports.access(tx,s.workspace_id,'write',s.source_binding);
      await tx.query('INSERT INTO release_gate_consumptions(id,decision_id,result,actor_login) VALUES($1,$2,$3::jsonb,$4)',[randomUUID(),row.id,JSON.stringify(result),permission.actorLogin]);
      await audit(tx,s,permission.actorLogin,'release_gate_consumed',{decisionId:row.id,outcome});
      return result;
    });},
  };
}
