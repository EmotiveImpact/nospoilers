import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {releaseIntelligence} from './release-intelligence-service.ts';
import {releaseRemediation} from './release-remediation-service.ts';
import {captureIdentity} from './automatic-capture-identity.ts';
import {fail,text,uuid,validate,compatible,type Stream,type Snapshot} from '../release-intelligence/model.ts';
import {AGENT_TOOLS,AGENT_DATA_NOTICE} from '../agent-tools.ts';
import {createStore} from './store.ts';
type Grant={id:string;stream_id:string;seed_snapshot:string;actor_user_id:string;token_hash:string;proposals:boolean;source_generation:string|null;expires_at:string|Date;revoked_at:string|null;calls:number};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
async function stream(sql:SqlClient,id:string){const s=(await sql.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];if(!s)return fail('Stream unavailable.',404);return s;}
async function saved(sql:SqlClient,ports:IntelligencePorts,s:Stream,id:string){
  const snap=(await sql.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE id=$1 AND stream_id=$2',[uuid(id),s.id])).rows[0];if(!snap)return fail('Snapshot unavailable in the authorized stream.',404);
  const e=await ports.evidence(sql,s.workspace_id,{kind:snap.record_kind,id:snap.record_id});validate(e);
  if(e.source!==s.source_binding||e.workspaceId!==s.workspace_id||e.channel!==s.channel||e.format!==s.format||e.fingerprint!==snap.receipt_fingerprint||e.digest!==snap.digest)return fail('Signed snapshot evidence changed.',409);
  return e;
}
async function generation(sql:SqlClient,s:Stream,seed:Snapshot){
  if(s.source_binding==='manual-upload')return null;
  const identity=await captureIdentity(sql,{kind:seed.record_kind,id:seed.record_id});if(!identity)return fail('Source unavailable.',403);
  const install=identity.installationId===null?null:(await sql.query<{gate_connection_generation:string}>('SELECT gate_connection_generation FROM installations WHERE id=$1',[identity.installationId])).rows[0];
  return `${identity.source}:${identity.generation}:${install?.gate_connection_generation??'independent'}`;
}
export function agentAccess(sql:SqlClient,ports:IntelligencePorts){
  async function admin(tx:SqlClient,id:string,write=false){const s=await stream(tx,id),p=await ports.access(tx,s.workspace_id,write?'manage':'read',s.source_binding);if(!p.actorUserId||!p.canAdminister)return fail('An administrator must manage agent access.',403);return {s,p};}
  return {
    async view(id:string){const {s,p}=await admin(sql,id);const grants=(await sql.query('SELECT id,name,proposals,expires_at,expires_at<=now() AS expired,revoked_at,calls,created_at FROM release_agent_grants WHERE stream_id=$1 ORDER BY created_at DESC LIMIT 30',[s.id])).rows;
      const proposals=(await sql.query(`SELECT p.id,p.note,p.reviewed_note,p.reviewer,p.reviewed_at,p.state,p.case_id,p.case_revision,p.created_at,g.name,c.finding FROM release_agent_proposals p JOIN release_agent_grants g ON g.id=p.grant_id JOIN release_remediation_cases c ON c.id=p.case_id WHERE g.stream_id=$1 ORDER BY p.created_at DESC LIMIT 30`,[s.id])).rows;
      const calls=(await sql.query('SELECT c.id,c.tool,c.outcome,c.created_at FROM release_agent_calls c JOIN release_agent_grants g ON g.id=c.grant_id WHERE g.stream_id=$1 ORDER BY c.created_at DESC LIMIT 30',[s.id])).rows;
      await admin(sql,id);return {grants,proposals,calls,canCreate:p.canManage&&!s.archived_at,notice:AGENT_DATA_NOTICE};},
    async change(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,p}=await admin(tx,id);await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);await admin(tx,id);
      if(input.action==='revoke'){
        const result=await tx.query('UPDATE release_agent_grants SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND stream_id=$2 RETURNING id',[uuid(input.grantId),s.id]);if(!result.rows.length)return fail('Grant unavailable.',404);return {revoked:true};
      }
      await admin(tx,id,true);if(s.archived_at)return fail('Stream archived.',409);
      if(input.confirm!==true)return fail('Explicit human confirmation is required.');
      if(input.action==='create'){
        if(typeof input.proposals!=='boolean')return fail('Choose read-only or proposal access.');
        const snapshotId=uuid(input.snapshotId);await saved(tx,ports,s,snapshotId);
        const seed=(await tx.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE id=$1 AND stream_id=$2',[snapshotId,s.id])).rows[0];
        if(Number((await tx.query<{n:string}>('SELECT count(*) AS n FROM release_agent_grants WHERE stream_id=$1 AND revoked_at IS NULL AND expires_at>now()',[s.id])).rows[0].n)>=5)return fail('Revoke an active agent grant before creating another.',409);
        const grantId=randomUUID(),token=`nsa_${grantId}.${randomBytes(32).toString('hex')}`;
        await tx.query(`INSERT INTO release_agent_grants(id,stream_id,seed_snapshot,actor_user_id,name,token_hash,proposals,source_generation,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '24 hours')`,[grantId,s.id,seed.id,p.actorUserId,text(input.name,'Agent name',1,80),hash(token),input.proposals,await generation(tx,s,seed)]);
        await admin(tx,id,true);return {id:grantId,token,expiresInHours:24,maxCalls:100};
      }
      if(input.action==='review'){
        const proposal=(await tx.query<{id:string;case_id:string;case_revision:number;state:string}>(`SELECT p.* FROM release_agent_proposals p JOIN release_agent_grants g ON g.id=p.grant_id WHERE p.id=$1 AND g.stream_id=$2 FOR UPDATE OF p`,[uuid(input.proposalId),s.id])).rows[0];
        if(!proposal||proposal.state!=='pending')return fail('Pending proposal unavailable.',409);
        if(typeof input.accept!=='boolean')return fail('Choose accept or reject.');
        const reviewedNote=input.accept?text(input.reviewedNote,'Reviewed note',8,1000):null;
        if(input.accept)await releaseRemediation(tx,ports).change(s.id,{action:'investigate',caseId:proposal.case_id,expectedRevision:Number(proposal.case_revision),reason:reviewedNote});
        await tx.query('UPDATE release_agent_proposals SET state=$2,reviewer=$3,reviewed_note=$4,reviewed_at=now() WHERE id=$1',[proposal.id,input.accept?'accepted':'rejected',p.actorLogin,reviewedNote]);await admin(tx,id,true);return {state:input.accept?'accepted':'rejected'};
      }
      return fail('Choose an agent access action.');
    });},
  };
}
export async function callAgentTool(sql:SqlClient,delegate:(userId:string)=>IntelligencePorts,token:string,input:Record<string,unknown>,signal:AbortSignal){
  const match=/^nsa_([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);if(!match)return fail('Use an explicit agent access token.',401);
  const id=uuid(match[1]),tool=AGENT_TOOLS.find(t=>t.name===input.name);if(!tool)return fail('Unknown tool.');
  const args=input.arguments;if(!args||typeof args!=='object'||Array.isArray(args))return fail('Tool arguments must be an object.');
  const a=args as Record<string,unknown>;if(Object.keys(a).some(k=>!Object.hasOwn(tool.inputSchema.properties,k))||tool.inputSchema.required.some(k=>!Object.hasOwn(a,k)))return fail('Unexpected or missing tool arguments.');
  const check=()=>{if(signal.aborted)return fail('Tool request cancelled.',408);};
  async function authority(tx:SqlClient){
    check();const g=(await tx.query<Grant>('SELECT * FROM release_agent_grants WHERE id=$1',[id])).rows[0];
    if(!g||!timingSafeEqual(Buffer.from(g.token_hash,'hex'),Buffer.from(hash(token),'hex'))||g.revoked_at||Date.parse(String(g.expires_at))<=Date.now())return fail('Agent access expired or revoked.',401);
    const s=await stream(tx,g.stream_id),ports=delegate(g.actor_user_id);await ports.access(tx,s.workspace_id,'manage',s.source_binding);if(s.archived_at)return fail('Stream archived.',403);
    const seed=(await tx.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE id=$1 AND stream_id=$2',[g.seed_snapshot,s.id])).rows[0];if(!seed||await generation(tx,s,seed)!==g.source_generation)return fail('Source changed. Create a new explicit agent grant.',403);
    check();return {g,s,ports};
  }
  const auth=await authority(sql);
  if(!await createStore(sql).reserveRequest(`agent-tools:${id}`,20,60000))return fail('Agent request rate limit reached.',429);
  const reserved=await sql.query('UPDATE release_agent_grants SET calls=calls+1 WHERE id=$1 AND calls<100 AND revoked_at IS NULL AND expires_at>now() RETURNING id',[id]);if(!reserved.rows.length)return fail('Agent request budget exhausted.',429);
  const callId=randomUUID();await sql.query("INSERT INTO release_agent_calls(id,grant_id,tool,outcome) VALUES($1,$2,$3,'started')",[callId,id,tool.name]);
  try{
    check();let data:unknown;
    if(tool.name==='propose_remediation_note'){
      if(!auth.g.proposals)return fail('This grant is read-only.',403);
      data=await sql.transaction(async tx=>{
        const {s}=await authority(tx);await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);await authority(tx);
        const c=(await tx.query<{id:string;revision:number}>('SELECT id,revision FROM release_remediation_cases WHERE id=$1 AND stream_id=$2',[uuid(a.caseId),s.id])).rows[0];if(!c)return fail('Remediation unavailable in this stream.',404);
        const proposalId=randomUUID();check();await tx.query('INSERT INTO release_agent_proposals(id,grant_id,case_id,case_revision,note) VALUES($1,$2,$3,$4,$5)',[proposalId,id,c.id,c.revision,text(a.note,'Draft note',8,1000)]);check();return {proposalId,state:'pending_human_review',applied:false};
      });
    }else if(tool.name==='list_releases'){
      data={snapshots:(await sql.query('SELECT id,record_kind,record_id,digest,scanned_at FROM release_intelligence_snapshots WHERE stream_id=$1 ORDER BY scanned_at DESC,id DESC LIMIT 30',[auth.s.id])).rows,limit:30};
    }else if(tool.name==='prepare_remediation_context'){
      const v=await releaseRemediation(sql,auth.ports).view(auth.s.id,undefined,uuid(a.caseId));data={selected:v.selected,notice:v.notice};
    }else{
      const e=await saved(sql,auth.ports,auth.s,uuid(a.snapshotId));check();
      if(tool.name==='get_release_status')data={ref:e.ref,digest:e.digest,readiness:e.readiness??'unknown',scanStatus:e.status,scannedAt:e.scannedAt,production:'not_assessed_by_this_tool'};
      else if(tool.name==='get_release_evidence')data={...e,manifest:e.manifest.slice(0,200),findings:e.findings.slice(0,100),manifestTotal:e.manifest.length,findingsTotal:e.findings.length,truncated:e.manifest.length>200||e.findings.length>100};
      else if(tool.name==='get_release_anomalies'){const v=await releaseIntelligence(sql,auth.ports).view(auth.s.id,uuid(a.snapshotId));data={analysis:v.analysis,unavailable:v.unavailable};}
      else{
        const previous=await saved(sql,auth.ports,auth.s,uuid(a.previousSnapshotId));if(!compatible(e,previous))return fail('Incompatible release scope.',409);
        if(e.ref.kind==='release'||previous.ref.kind==='release'){
          const currentIdentity=await captureIdentity(sql,e.ref),previousIdentity=await captureIdentity(sql,previous.ref);
          if(!currentIdentity||!previousIdentity||currentIdentity.source!==previousIdentity.source||currentIdentity.selector!==previousIdentity.selector)return fail('Compare the same connected asset selection.',409);
        }
        const old=new Map(previous.manifest.map(f=>[f.path,f.sha256])),current=new Map(e.manifest.map(f=>[f.path,f.sha256]));
        const added=e.manifest.filter(f=>!old.has(f.path)),changed=e.manifest.filter(f=>old.has(f.path)&&old.get(f.path)!==f.sha256),removed=previous.manifest.filter(f=>!current.has(f.path));
        data={current:e.digest,previous:previous.digest,added:added.slice(0,100),changed:changed.slice(0,100),removed:removed.slice(0,100),totals:{added:added.length,changed:changed.length,removed:removed.length},sameScannerPolicy:e.engine===previous.engine&&e.policy===previous.policy};
      }
    }
    await authority(sql);check();const result={deterministic:true,untrustedData:true,notice:AGENT_DATA_NOTICE,data};
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>512000)return fail('Tool result exceeds the metadata budget.',413);
    await sql.query("UPDATE release_agent_calls SET outcome='completed' WHERE id=$1",[callId]);return result;
  }catch(error){await sql.query('UPDATE release_agent_calls SET outcome=$2 WHERE id=$1',[callId,signal.aborted?'cancelled':'failed']);throw error;}
}
