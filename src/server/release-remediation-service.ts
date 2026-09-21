import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {IntelligencePorts} from './release-intelligence-service.ts';
import {fail,IntelligenceError,revision,text,uuid,validate,type Ref,type Snapshot,type Stream} from '../release-intelligence/model.ts';
import {assessRemediation,type RemediationResult} from '../release-intelligence/remediation.ts';
import {captureIdentity} from './automatic-capture-identity.ts';
type Case={id:string;stream_id:string;original_snapshot:string;finding:string;revision:number;created_at:string};
type Event={id:string;revision:number;action:string;actor_login:string;detail:Record<string,unknown>;created_at:string};
export function releaseRemediation(sql:SqlClient,ports:IntelligencePorts){
  async function scope(tx:SqlClient,id:string,write=false){
    const s=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[uuid(id)])).rows[0];
    if(!s)return fail('Stream unavailable.',404);
    let permission=await ports.access(tx,s.workspace_id,write?'write':'read',s.source_binding);
    if(!permission.actorUserId)return fail('Sign in to inspect or update human remediation records.',403);
    if(write){
      if(!permission.actorUserId)return fail('A signed-in person must record remediation decisions.',403);
      await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[s.workspace_id]);
      permission=await ports.access(tx,s.workspace_id,'write',s.source_binding);
      const current=(await tx.query<Stream>('SELECT * FROM release_intelligence_streams WHERE id=$1',[s.id])).rows[0];
      if(!current||current.archived_at)return fail('This stream is archived.',409);
    }
    return {s,permission};
  }
  async function saved(tx:SqlClient,s:Stream,id:string){
    const snap=(await tx.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE stream_id=$1 AND id=$2',[s.id,uuid(id)])).rows[0];
    if(!snap)return fail('Recorded evidence is unavailable in this stream.',404);
    const e=await ports.evidence(tx,s.workspace_id,{kind:snap.record_kind,id:snap.record_id});validate(e);
    if(e.workspaceId!==s.workspace_id||e.source!==s.source_binding||e.channel!==s.channel||e.format!==s.format||e.digest!==snap.digest||e.fingerprint!==snap.receipt_fingerprint)return fail('Signed evidence no longer matches this stream snapshot.',409);
    return {snap,e};
  }
  async function events(tx:SqlClient,id:string){return (await tx.query<Event>('SELECT * FROM release_remediation_events WHERE case_id=$1 ORDER BY revision DESC LIMIT 100',[id])).rows;}
  async function assess(tx:SqlClient,s:Stream,c:Case,review:Event,candidateId:string){
    const original=await saved(tx,s,c.original_snapshot),candidate=await saved(tx,s,candidateId);
    if(original.e.ref.kind==='release'||candidate.e.ref.kind==='release'){
      const a=await captureIdentity(tx,original.e.ref),b=await captureIdentity(tx,candidate.e.ref);
      if(!a||!b||a.selector!==b.selector||a.source!==b.source)return fail('Rebuilt evidence must belong to the exact connected asset selection.',409);
    }
    const result=assessRemediation(original.e,candidate.e,c.finding,String(review.detail.reviewedAt),Date.now(),String(review.detail.commit));
    return {result,candidate:candidate.e,original:original.e};
  }
  async function append(tx:SqlClient,c:Case,actor:string,action:string,detail:object){
    if(Number(c.revision)>=100)return fail('Remediation activity safety limit reached.',409);
    const next=Number(c.revision)+1;
    await tx.query('INSERT INTO release_remediation_events(id,case_id,revision,action,actor_login,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[randomUUID(),c.id,next,action,actor,JSON.stringify(detail)]);
    await tx.query('UPDATE release_remediation_cases SET revision=$2 WHERE id=$1',[c.id,next]);
    return next;
  }
  return {
    async view(id:string,ref?:Ref,selectedCase?:string){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id);
      let current:{snapshotId:string;findings:string[]}|null=null;
      if(ref){const snap=(await tx.query<Snapshot>('SELECT * FROM release_intelligence_snapshots WHERE stream_id=$1 AND record_kind=$2 AND record_id=$3',[s.id,ref.kind,ref.id])).rows[0];if(snap){const {e}=await saved(tx,s,snap.id);current={snapshotId:snap.id,findings:[...new Set(e.findings)]};}}
      const cases=(await tx.query<Case>('SELECT * FROM release_remediation_cases WHERE stream_id=$1 ORDER BY created_at DESC,id LIMIT 100',[s.id])).rows;
      const selected=selectedCase?cases.find(c=>c.id===uuid(selectedCase)):cases[0];
      if(selectedCase&&!selected)return fail('Remediation unavailable in this stream.',404);
      let selectedDetail=null;
      for(const c of selected?[selected]:[]){
        const history=await events(tx,c.id),review=history.find(e=>e.action==='review'),lastCheck=history.find(e=>e.action==='verify'),reopened=history.find(e=>e.action==='reopen');
        let observation:RemediationResult|null=null,unavailable=false;
        try{
          await saved(tx,s,c.original_snapshot);
          if(lastCheck&&review&&Number(lastCheck.revision)>Number(review.revision)&&(!reopened||Number(lastCheck.revision)>Number(reopened.revision))){
            const checked=await assess(tx,s,c,review,String(lastCheck.detail.candidateSnapshot));
            if(checked.candidate.fingerprint!==lastCheck.detail.fingerprint)throw new IntelligenceError('Evidence changed.',409);
            observation=checked.result;
          }
        }catch(error){if(!(error instanceof IntelligenceError)||![404,409,422].includes(error.status))throw error;unavailable=true;}
        selectedDetail={...c,revision:Number(c.revision),history,observation,unavailable};
      }
      await ports.access(tx,s.workspace_id,'read',s.source_binding);
      return {cases:cases.map(c=>({...c,revision:Number(c.revision)})),selected:selectedDetail,current,canWrite:!!permission.actorUserId&&permission.canWrite&&!s.archived_at,
        notice:'Link a human-reviewed change to fresh rebuilt evidence. This does not merge a PR, close an alert, rewrite a receipt or verify production. Review and build provenance are declarations, not provider attestations.'};
    });},
    async change(id:string,input:Record<string,unknown>){return sql.transaction(async tx=>{
      const {s,permission}=await scope(tx,id,true),reason=text(input.reason,'Remediation note',8,1000);
      if(input.action==='start'){
        const {snap,e}=await saved(tx,s,uuid(input.snapshotId)),finding=text(input.finding,'Finding',1,4096);
        if(!e.findings.includes(finding))return fail('Select an unsuppressed finding from the signed original record.',409);
        const existing=(await tx.query<Case>('SELECT * FROM release_remediation_cases WHERE stream_id=$1 AND original_snapshot=$2 AND finding=$3',[s.id,snap.id,finding])).rows[0];
        if(existing)return {caseId:existing.id,revision:Number(existing.revision),inserted:false};
        if(Number((await tx.query<{n:string}>('SELECT count(*) AS n FROM release_remediation_cases WHERE stream_id=$1',[s.id])).rows[0].n)>=100)return fail('Stream remediation safety limit reached.',409);
        const caseId=randomUUID();
        await tx.query('INSERT INTO release_remediation_cases(id,stream_id,original_snapshot,finding) VALUES($1,$2,$3,$4)',[caseId,s.id,snap.id,finding]);
        await tx.query("INSERT INTO release_remediation_events(id,case_id,revision,action,actor_login,detail) VALUES($1,$2,1,'investigate',$3,$4::jsonb)",[randomUUID(),caseId,permission.actorLogin,JSON.stringify({reason})]);
        await ports.access(tx,s.workspace_id,'write',s.source_binding);return {caseId,revision:1,inserted:true};
      }
      const c=(await tx.query<Case>('SELECT * FROM release_remediation_cases WHERE id=$1 AND stream_id=$2',[uuid(input.caseId),s.id])).rows[0];
      if(!c)return fail('Remediation unavailable.',404);
      if(Number(c.revision)!==revision(input.expectedRevision))return fail('Remediation changed. Refresh before saving.',409);
      await saved(tx,s,c.original_snapshot);
      let detail:Record<string,unknown>={reason};
      if(input.action==='review'){
        if(input.confirm!==true)return fail('Confirm that you reviewed this change.');
        const changeUrl=text(input.changeUrl,'Reviewed change URL',1,500);let url:URL;
        try{url=new URL(changeUrl);}catch{return fail('Use a valid HTTPS change or pull-request URL.');}
        if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return fail('Use an HTTPS change URL without credentials, query or fragment.');
        const commit=text(input.commit,'Reviewed commit',40,64).toLowerCase();if(!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit))return fail('Use the complete reviewed commit hash.');
        const reviewedAt=text(input.reviewedAt,'Review time',1,40),at=Date.parse(reviewedAt);
        if(!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(reviewedAt)||!Number.isFinite(at)||at>Date.now()+60_000)return fail('Review time must be a valid past ISO timestamp with timezone.');
        detail={reason,changeUrl:url.href,commit,reviewedAt:new Date(at).toISOString(),provenance:'human-declared'};
      }else if(input.action==='verify'){
        if(input.confirm!==true)return fail('Confirm this rebuild contains the reviewed change.');
        const review=(await events(tx,c.id)).find(e=>e.action==='review');if(!review)return fail('Record the reviewed change before checking a rebuild.',409);
        const candidateSnapshot=uuid(input.candidateSnapshot),checked=await assess(tx,s,c,review,candidateSnapshot);
        detail={reason,candidateSnapshot,record:checked.candidate.ref,digest:checked.candidate.digest,fingerprint:checked.candidate.fingerprint,reviewId:review.id,buildLink:'human-declared',result:checked.result};
      }else if(!['investigate','reopen'].includes(String(input.action)))return fail('Choose a remediation action.');
      const next=await append(tx,c,permission.actorLogin,String(input.action),detail);
      await ports.access(tx,s.workspace_id,'write',s.source_binding);return {caseId:c.id,revision:next,...(detail.result?{observation:detail.result}:{})};
    });},
  };
}
