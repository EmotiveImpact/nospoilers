import type {Finding,ScanReport} from '../report-types.ts';
import {uploadVerdict} from './upload-verdict.ts';

export type UploadedRelease={id:string;target:string;status:string;artifact_sha256:string;created_at:string;workspace_id?:string|null;
  readiness?:import('../assurance/types.ts').Assessment;
  source_origin_id?:number|null;
  installation_id:number|null;report_json:ScanReport|null;receipt_json:unknown;error:string|null};
export type EvidenceCategory='all'|'maps'|'secrets'|'files'|'ai';
export function downloadUploadedRecord(upload:UploadedRelease){
  if(!upload.receipt_json)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(upload.receipt_json,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`nospoilers-proof-${upload.id}.json`;link.click();URL.revokeObjectURL(url);
}
export function findingCategory(finding:Finding):Exclude<EvidenceCategory,'all'>{
  if(finding.rule.startsWith('MAP-'))return 'maps';
  if(finding.rule.startsWith('SEC-'))return 'secrets';
  if(finding.rule.startsWith('AI-'))return 'ai';
  return 'files';
}
export function uploadedReleaseDecision(upload:UploadedRelease){
  if(upload.status==='done'){
    const candidate=upload.readiness;
    const assessment=candidate?.version===1&&candidate.releaseId===upload.id&&!candidate.preview?candidate:undefined;
    return {verdict:uploadVerdict(upload.status,upload.report_json),tone:assessment?.beforeDeploy??'unknown',title:assessment?.title??'Evidence is incomplete',detail:assessment?.summary??'A verified server assessment is unavailable. A completed job or passing report does not establish readiness.'};
  }
  const website=upload.source_origin_id!=null;
  const verdict=website&&upload.status==='running'?'Inspecting website':uploadVerdict(upload.status,upload.report_json);
  const tone=verdict==='Review findings'?'blocked':verdict.startsWith('Policy passed')?'ready':'pending';
  const title=verdict==='Review findings'?(website?'Review website exposure':'Hold this artifact'):verdict==='Policy passed'?(website?'Website policy passed':'Artifact policy passed'):verdict==='Policy passed with exceptions'?'Passed with documented exceptions':verdict;
  const report=upload.report_json;
  const detail=upload.status==='queued'?'Your scan is queued. You can leave and return to this same record.':upload.status==='running'?'The worker is inspecting the artifact. No passing decision is available yet.':upload.status==='failed'?upload.error??'The scan could not finish. Submit a new attempt; this record stays unchanged.':!report?'The completed evidence is unavailable. This is not a passing result.':report.status==='inconclusive'?report.inconclusiveReason??'Some work could not complete. Do not treat partial evidence as a pass.':tone==='blocked'?`${report.findings.length} recorded finding${report.findings.length===1?'':'s'}. Review the evidence before releasing these bytes.`:'This decision covers the uploaded bytes and recorded policy at the scan time—not unperformed repository or deployment checks.';
  const websiteDetail=upload.status==='failed'?'The website check could not finish. Review its connection and ownership in Coverage before trying again; this attempt remains in history.':upload.status==='running'?'The worker is inspecting public website assets. No passing decision is available yet.':upload.status==='done'&&report&&tone!=='pending'?(tone==='blocked'?`${report.findings.length} recorded finding${report.findings.length===1?'':'s'}. Review the public assets and recheck after remediation.`:'This decision covers the public assets retrieved at scan time and the recorded policy—not the entire website or its current state.'):detail;
  return {verdict,tone,title,detail:website?websiteDetail:detail};
}
