import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {releaseRemediation} from './release-remediation-service.ts';
import {clean,fail,IntelligenceError,revision,uuid,validate,type Stream,type Snapshot,type Baseline} from '../release-intelligence/model.ts';
import {OUTCOME_RECORD_LIMIT,OUTCOME_CASE_LIMIT,OUTCOME_NOTICE,outcomeMonth,type OutcomeSummary,type OutcomeEvent} from '../release-intelligence/outcomes.ts';
type Preference={enabled:boolean;revision:number};
const iso=(value:string|Date)=>new Date(value).toISOString();
const unavailable=(e:unknown)=>e instanceof IntelligenceError&&[403,404,409,422].includes(e.status);
const snapshots=`SELECT s.*,COALESCE((SELECT e.excluded FROM release_intelligence_exclusions e WHERE e.stream_id=s.stream_id AND e.snapshot_ref=s.id ORDER BY e.revision DESC LIMIT 1),false) AS excluded FROM release_intelligence_snapshots s`;
export function releaseOutcomes(sql:SqlClient,ports:IntelligencePorts){
  async function scope(tx:SqlClient,id:string){
    const s=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];if(!s)return fail('Stream unavailable.',404);
    const p=await ports.access(tx,s.workspace_id,'read',s.source_binding);if(!p.actorUserId)return fail('Sign in to view private outcome summaries.',403);return {s,p};
  }
  async function preference(tx:SqlClient,id:string){const p=(await tx.query<Preference>('SELECT enabled,revision FROM release_outcome_preferences WHERE stream_id=$1',[id])).rows[0];return p?{enabled:p.enabled,revision:Number(p.revision)}:{enabled:false,revision:0};}
  async function evidence(tx:SqlClient,s:Stream,snap:Snapshot){
    const e=await ports.evidence(tx,s.workspace_id,{kind:snap.record_kind,id:snap.record_id});validate(e);
    if(e.workspaceId!==s.workspace_id||e.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format||e.digest!==snap.digest||e.fingerprint!==snap.receipt_fingerprint||Date.parse(e.scannedAt)!==new Date(snap.scanned_at).getTime())return fail('Recorded evidence is no longer consistent.',409);
    return e;
  }
  return {
    async configure(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s}=await scope(tx,id);await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);const {p,s:current}=await scope(tx,id);
      if(!p.canAdminister)return fail('A workspace administrator must change outcome preferences.',403);
      if(typeof input.enabled!=='boolean'||input.confirm!==true)return fail('Confirm the outcome summary preference.');
      if(input.enabled&&current.archived_at)return fail('Archived streams cannot enable summaries.',409);
      const before=await preference(tx,id);if(revision(input.expectedRevision)!==before.revision)return fail('Outcome preference changed. Refresh before saving.',409);
      const next=before.revision+1;
      await tx.query('INSERT INTO release_outcome_preferences(stream_id,enabled,revision) VALUES($1,$2,$3) ON CONFLICT(stream_id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,updated_at=now()',[s.id,input.enabled,next]);
      await tx.query('INSERT INTO release_intelligence_events(id,stream_id,action,actor_login,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),s.id,input.enabled?'outcomes_enabled':'outcomes_disabled',p.actorLogin,JSON.stringify({schemaVersion:1,revision:next})]);
      const final=await scope(tx,id);if(!final.p.canAdminister)return fail('Administrator access changed.',403);
      return {enabled:input.enabled,revision:next};
    });},
    async view(id:string,month?:string,signal:AbortSignal=new AbortController().signal){return sql.transaction(async tx=>{
      const check=()=>{if(signal.aborted)fail('Outcome summary cancelled or timed out.',408);};check();
      const {s,p}=await scope(tx,id),pref=await preference(tx,id);
      const base={...pref,canConfigure:!!p.canAdminister,notice:OUTCOME_NOTICE};
      if(!pref.enabled||month===undefined)return {...base,summary:null};
      const now=Date.now(),window=outcomeMonth(month,now),events:OutcomeEvent[]=[];
      const rows=(await tx.query<Snapshot>(`${snapshots} WHERE s.stream_id=$1 AND s.scanned_at>=$2 AND s.scanned_at<$3 ORDER BY s.scanned_at DESC,s.id DESC LIMIT $4`,[s.id,window.start,window.through,OUTCOME_RECORD_LIMIT])).rows;
      const total=Number((await tx.query<{n:string}>('SELECT count(*) AS n FROM release_intelligence_snapshots WHERE stream_id=$1 AND scanned_at>=$2 AND scanned_at<$3',[s.id,window.start,window.through])).rows[0].n);
      const records={retainedInMonth:total,inspected:0,verified:0,unavailable:0,distinctArtifacts:0,repeatChecks:0,passed:0,failedPolicy:0,inconclusive:0,withSuppression:0,held:0,excluded:0,partial:total>rows.length};
      let latest:OutcomeSummary['latest']=null,bytes=0,entries=0;const digests=new Set<string>();
      for(const snap of rows){check();
        try{
          const e=await evidence(tx,s,snap);bytes+=Buffer.byteLength(JSON.stringify(e));entries+=e.manifest.length;
          if(bytes>16*1024*1024||entries>100000){records.partial=true;break;}
          records.inspected++;records.verified++;digests.add(e.digest);
          if(e.status==='passed')records.passed++;else if(e.status==='failed-policy')records.failedPolicy++;else records.inconclusive++;
          if(e.suppressed)records.withSuppression++;if(e.held)records.held++;if(snap.excluded)records.excluded++;
          // Never fall back to an older green result if the newest record was unavailable.
          if(snap.id===rows[0]?.id)latest={record:e.ref,scannedAt:e.scannedAt,readiness:e.readiness??'unknown',findings:e.findings.length,suppressed:e.suppressed};
          events.push({schemaVersion:1,id:snap.id,type:'scan_evidence_observed',workspaceId:s.workspace_id,streamId:s.id,occurredAt:e.scannedAt,outcome:e.status});
        }catch(error){if(!unavailable(error))throw error;records.inspected++;records.unavailable++;}
      }
      records.distinctArtifacts=digests.size;records.repeatChecks=records.verified-digests.size;
      const changes=(await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY revision DESC LIMIT 101',[s.id,window.start,window.through])).rows;
      const adopted=(await tx.query<Baseline>('SELECT * FROM release_intelligence_baselines WHERE stream_id=$1 ORDER BY revision DESC LIMIT 1',[s.id])).rows[0];
      const reference:OutcomeSummary['reference']={state:adopted?.action==='revoke'?'revoked':adopted?'unavailable':'not_adopted',revision:Number(adopted?.revision??0),adoptedInMonth:changes.slice(0,100).filter(b=>b.action==='adopt').length,revokedInMonth:changes.slice(0,100).filter(b=>b.action==='revoke').length,partial:changes.length>100};
      if(adopted?.snapshot_ref&&adopted.action==='adopt'){
        check();try{const snap=(await tx.query<Snapshot>(`${snapshots} WHERE s.id=$1 AND s.stream_id=$2`,[adopted.snapshot_ref,s.id])).rows[0];if(snap&&!snap.excluded&&clean(await evidence(tx,s,snap)))reference.state='available';}catch(error){if(!unavailable(error))throw error;}
      }
      for(const b of changes.slice(0,100))events.push({schemaVersion:1,id:b.id,type:b.action==='adopt'?'baseline_adopted':'baseline_revoked',workspaceId:s.workspace_id,streamId:s.id,occurredAt:iso(b.created_at)});
      const cases=(await tx.query<{id:string}>('SELECT id FROM release_remediation_cases WHERE stream_id=$1 ORDER BY created_at DESC,id LIMIT $2',[s.id,OUTCOME_CASE_LIMIT])).rows;
      const retainedCases=Number((await tx.query<{n:string}>('SELECT count(*) AS n FROM release_remediation_cases WHERE stream_id=$1',[s.id])).rows[0].n);
      const remediation={retainedCases,inspected:0,verifiedAbsent:0,stillObserved:0,unknown:0,awaitingRebuild:0,partial:retainedCases>cases.length,asOf:new Date(now).toISOString()};
      for(const c of cases){check();const detail=(await releaseRemediation(tx,ports).view(s.id,undefined,c.id)).selected;remediation.inspected++;
        if(!detail||detail.unavailable||detail.observation?.state==='unknown')remediation.unknown++;
        else if(detail.observation?.state==='verified_absent')remediation.verifiedAbsent++;
        else if(detail.observation?.state==='still_observed')remediation.stillObserved++;
        else remediation.awaitingRebuild++;
      }
      check();await scope(tx,id);const finalPreference=await preference(tx,id);if(!finalPreference.enabled||finalPreference.revision!==pref.revision)return fail('Outcome preference changed. Refresh before viewing.',409);
      const summary:OutcomeSummary={type:'nospoilers-private-outcomes',signed:false,schemaVersion:1,generatedAt:new Date(now).toISOString(),scope:{workspaceId:s.workspace_id,streamId:s.id,name:s.name,channel:s.channel,format:s.format},window,records,latest,reference,remediation,events:events.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)),eventsPartial:records.partial||records.unavailable>0||changes.length>100,notice:OUTCOME_NOTICE};
      return {...base,summary};
    });},
  };
}
