import {fail,type Ref} from './model.ts';
export const OUTCOME_RECORD_LIMIT=100;
export const OUTCOME_CASE_LIMIT=20;
export const OUTCOME_NOTICE='Private, unsigned summary of retained evidence in this stream only. Missing, deleted, unrecorded and out-of-scope scans cannot establish coverage. No emails, telemetry provider, employee tracking, savings estimate or security certificate.';
export function outcomeMonth(raw:unknown,now=Date.now()){
  const month=raw===undefined?new Date(now).toISOString().slice(0,7):raw;
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2000-01'||month>new Date(now).toISOString().slice(0,7))return fail('Choose a current or past calendar month (YYYY-MM).');
  const start=new Date(`${month}-01T00:00:00.000Z`),end=new Date(start);end.setUTCMonth(end.getUTCMonth()+1);
  return {month,start:start.toISOString(),end:end.toISOString(),through:new Date(Math.min(end.getTime(),now)).toISOString(),timezone:'UTC' as const};
}
/** Deliberately no arbitrary properties, people, paths, free text or provider transport. */
export type OutcomeEvent={schemaVersion:1;id:string;type:'scan_evidence_observed'|'baseline_adopted'|'baseline_revoked';workspaceId:string;streamId:string;occurredAt:string;outcome?:'passed'|'failed-policy'|'inconclusive'};
export type OutcomeSummary={
  type:'nospoilers-private-outcomes';signed:false;schemaVersion:1;generatedAt:string;
  scope:{workspaceId:string;streamId:string;name:string;channel:string;format:string};window:ReturnType<typeof outcomeMonth>;
  records:{retainedInMonth:number;inspected:number;verified:number;unavailable:number;distinctArtifacts:number;repeatChecks:number;passed:number;failedPolicy:number;inconclusive:number;withSuppression:number;held:number;excluded:number;partial:boolean};
  latest:{record:Ref;scannedAt:string;readiness:string;findings:number;suppressed:number}|null;
  reference:{state:'not_adopted'|'revoked'|'available'|'unavailable';revision:number;adoptedInMonth:number;revokedInMonth:number;partial:boolean};
  remediation:{retainedCases:number;inspected:number;verifiedAbsent:number;stillObserved:number;unknown:number;awaitingRebuild:number;partial:boolean;asOf:string};
  events:OutcomeEvent[];eventsPartial:boolean;notice:string;
};
