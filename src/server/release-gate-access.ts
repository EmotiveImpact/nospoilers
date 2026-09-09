import {createHash,randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {fail,IntelligenceError,reference,revision,text,uuid,type Ref,type Stream} from '../release-intelligence/model.ts';
import {captureIdentity} from './automatic-capture-identity.ts';
export type GateGrant={stream_id:string;token_id:number;revision:number;enabled:boolean;actor_user_id:string;seed_release_id:number;source_binding:string;selector:string;source_generation:string;installation_generation:number;expires_at:string|Date};
const tokenId=(raw:unknown)=>Number.isSafeInteger(Number(raw))&&Number(raw)>0?Number(raw):fail('Choose an existing workspace token.');
/** Only used by the gate route. Never exposes general repository, receipt or history access. */
export function connectedGatePorts(base:IntelligencePorts,resolve:(sql:SqlClient)=>Promise<{tokenId:number;workspaceId:string}>,delegate:(userId:string)=>IntelligencePorts,streamId:string):IntelligencePorts{
  async function authority(sql:SqlClient,workspace:string,mode:'read'|'write'|'manage',source?:string){
    if(mode==='manage')return fail('CI gate access cannot manage policy or overrides.',403);
    const actor=await resolve(sql),id=uuid(streamId);
    if(workspace!==actor.workspaceId)return fail('Gate workspace unavailable.',403);
    const s=(await sql.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1 AND workspace_id=$2',[id,workspace])).rows[0];
    if(!s||s.archived_at||source&&source!==s.source_binding)return fail('Gate stream unavailable.',404);
    if(!s.source_binding.startsWith('installation:'))return {ports:base,grant:null,key:undefined};
    const grant=(await sql.query<GateGrant>('SELECT * FROM release_gate_ci_grants WHERE stream_id=$1 AND token_id=$2 AND enabled AND expires_at>now()',[id,actor.tokenId])).rows[0];
    if(!grant||grant.source_binding!==s.source_binding)return fail('Explicit active CI access is required for this connected stream.',403);
    const ports=delegate(grant.actor_user_id);
    // The grant is subordinate to its administrator's CURRENT source and billing access.
    await ports.access(sql,workspace,'manage',s.source_binding);
    const identity=await captureIdentity(sql,{kind:'release',id:String(grant.seed_release_id)});
    if(!identity||identity.source!==s.source_binding||identity.selector!==grant.selector||identity.generation!==grant.source_generation||identity.channel!==s.channel||identity.format!==s.format)return fail('Source changed. An administrator must renew CI access.',403);
    const install=(await sql.query<{gate_connection_generation:string|number}>('SELECT gate_connection_generation FROM installations WHERE id=$1',[identity.installationId])).rows[0];
    if(!install||String(install.gate_connection_generation)!==String(grant.installation_generation))return fail('Installation changed. An administrator must renew CI access.',403);
    const key=createHash('sha256').update(`${id}:${actor.tokenId}:${grant.revision}:${grant.actor_user_id}:${grant.source_generation}:${grant.installation_generation}`).digest('hex');
    return {ports,grant,key};
  }
  return {
    async access(sql,workspace,mode,source){
      const auth=await authority(sql,workspace,mode,source);
      if(!auth.grant)return base.access(sql,workspace,mode,source);
      const actor=await resolve(sql);
      return {actorLogin:`workspace-token:${actor.tokenId}`,canManage:false,canWrite:true,canAdminister:false,capabilityKey:auth.key};
    },
    async evidence(sql,workspace,ref){
      const auth=await authority(sql,workspace,'read');
      if(!auth.grant)return base.evidence(sql,workspace,ref);
      if(ref.kind!=='release')return fail('This connected gate grant covers recorded releases only.',403);
      const identity=await captureIdentity(sql,ref);
      if(!identity||identity.source!==auth.grant.source_binding||identity.selector!==auth.grant.selector||identity.generation!==auth.grant.source_generation)return fail('This release is outside the explicit CI source selection.',403);
      const e=await auth.ports.evidence(sql,workspace,ref);
      await authority(sql,workspace,'read',e.source);
      return e;
    },
  };
}
export function releaseGateAccess(sql:SqlClient,ports:IntelligencePorts){
  async function scope(tx:SqlClient,id:string){
    const s=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];
    if(!s)return fail('Stream unavailable.',404);
    const permission=await ports.access(tx,s.workspace_id,'read',s.source_binding);
    if(!permission.actorUserId||!permission.canAdminister)return fail('An administrator must manage CI access.',403);
    return {s,permission};
  }
  return {
    async view(id:string,ref?:Ref){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id);
      const grants=(await tx.query(`SELECT g.token_id,g.revision,g.enabled,g.expires_at,(g.expires_at<=now()) AS expired,g.selector,t.name,t.token_prefix,t.revoked_at
        FROM release_gate_ci_grants g JOIN scan_api_tokens t ON t.id=g.token_id WHERE g.stream_id=$1 ORDER BY g.updated_at DESC LIMIT 100`,[id])).rows;
      const tokens=(await tx.query('SELECT id,name,token_prefix FROM scan_api_tokens WHERE workspace_id=$1 AND installation_id IS NULL AND revoked_at IS NULL ORDER BY id DESC LIMIT 100',[s.workspace_id])).rows;
      let eligible=false;
      if(ref?.kind==='release'){
        try{const e=await ports.evidence(tx,s.workspace_id,ref),identity=await captureIdentity(tx,ref);
          eligible=!!identity&&e.source===s.source_binding&&identity.source===s.source_binding&&e.channel===s.channel&&e.format===s.format&&!s.source_binding.includes(':coordinate:web:');}
        catch(error){if(!(error instanceof IntelligenceError)||![404,409,422].includes(error.status))throw error;}
      }
      await ports.access(tx,s.workspace_id,'read',s.source_binding);
      return {tokens,grants,eligible,canEnable:permission.canManage&&!s.archived_at,canDisable:true,
        notice:'Gate-only access to this exact connected asset stream. It does not grant repository browsing, receipt download, policy changes or overrides. Access ends on expiry, revocation, source reconnection or loss of the granting administrator’s authority.'};
    });},
    async configure(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      let {s,permission}=await scope(tx,id);
      await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);
      ({s,permission}=await scope(tx,id));
      const token=tokenId(input.tokenId),expected=revision(input.expectedRevision),reason=text(input.reason,'CI access reason',8,1000);
      if(typeof input.enabled!=='boolean')return fail('Choose whether CI access is enabled.');
      const current=(await tx.query<GateGrant>('SELECT * FROM release_gate_ci_grants WHERE stream_id=$1 AND token_id=$2 FOR UPDATE',[id,token])).rows[0];
      if(Number(current?.revision??0)!==expected)return fail('CI access changed. Reload before saving.',409);
      const next=expected+1;
      if(!input.enabled){
        if(!current)return fail('CI access grant unavailable.',404);
        await tx.query('UPDATE release_gate_ci_grants SET enabled=false,revision=$3,updated_at=now() WHERE stream_id=$1 AND token_id=$2',[id,token,next]);
      }else{
        await ports.access(tx,s.workspace_id,'manage',s.source_binding);
        if(s.archived_at||input.confirm!==true)return fail('Confirm CI access for an active stream.');
        if(!Number.isSafeInteger(input.days)||Number(input.days)<1||Number(input.days)>90)return fail('Choose an access duration of 1 to 90 days.');
        if(!(await tx.query('SELECT id FROM scan_api_tokens WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND revoked_at IS NULL',[token,s.workspace_id])).rows.length)return fail('Active workspace token unavailable.',404);
        const ref=reference(input.record);if(ref.kind!=='release')return fail('Select a connected release asset.');
        const e=await ports.evidence(tx,s.workspace_id,ref),identity=await captureIdentity(tx,ref,true);
        if(!identity||!s.source_binding.startsWith('installation:')||e.source!==s.source_binding||identity.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format||s.source_binding.includes(':coordinate:web:'))return fail('Choose a compatible connected package or GitHub release asset.',409);
        const install=(await tx.query<{gate_connection_generation:string|number}>('SELECT gate_connection_generation FROM installations WHERE id=$1',[identity.installationId])).rows[0];
        if(!install)return fail('Installation unavailable.',409);
        await tx.query(`INSERT INTO release_gate_ci_grants(stream_id,token_id,revision,enabled,actor_user_id,seed_release_id,source_binding,selector,source_generation,expires_at,installation_generation)
          VALUES($1,$2,$3,true,$4,$5,$6,$7,$8,now()+($9::integer*interval '1 day'),$10) ON CONFLICT(stream_id,token_id) DO UPDATE SET
          revision=excluded.revision,enabled=true,actor_user_id=excluded.actor_user_id,seed_release_id=excluded.seed_release_id,source_binding=excluded.source_binding,
          selector=excluded.selector,source_generation=excluded.source_generation,installation_generation=excluded.installation_generation,expires_at=excluded.expires_at,updated_at=now()`,[id,token,next,permission.actorUserId,ref.id,s.source_binding,identity.selector,identity.generation,input.days,install.gate_connection_generation]);
      }
      await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),id,'release_gate_ci_access_changed',permission.actorLogin,JSON.stringify({tokenId:token,revision:next,enabled:input.enabled,reason})]);
      await ports.access(tx,s.workspace_id,input.enabled?'manage':'read',s.source_binding);
      return {revision:next,enabled:input.enabled};
    });},
  };
}
