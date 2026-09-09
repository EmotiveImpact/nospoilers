import {sameContext,validate,type Evidence} from './model.ts';
export type RemediationResult={state:'verified_absent'|'still_observed'|'unknown';reason:string;otherFindings:number;scope:string};
/** A scoped observation, never a new receipt, causal attribution or production claim. */
export function assessRemediation(original:Evidence,candidate:Evidence,finding:string,reviewedAt:string,now=Date.now(),reviewedCommit?:string):RemediationResult{
  validate(original,now);validate(candidate,now);
  const result=(state:RemediationResult['state'],reason:string):RemediationResult=>({state,reason,otherFindings:candidate.findings.filter(f=>f!==finding).length,scope:'Selected finding and its rule in the exact rebuilt artifact only. Review and build linkage are human-declared; production and other releases are not verified.'});
  if(!original.findings.includes(finding))return result('unknown','Original signed finding is unavailable.');
  if(original.source.includes('website:')||original.source.includes(':coordinate:web:'))return result('unknown','Website observations do not establish rebuilt-artifact remediation. Use the production verification workflow.');
  if(candidate.sourceRevision&&reviewedCommit&&candidate.sourceRevision!==reviewedCommit)return result('unknown','The signed rebuild revision differs from the human-reviewed commit.');
  if(!sameContext(original,candidate))return result('unknown','Source, channel, format, scanner or policy changed; this is not equivalent evidence.');
  if(candidate.digest===original.digest||Date.parse(candidate.scannedAt)<=Date.parse(original.scannedAt)||Date.parse(candidate.scannedAt)<Date.parse(reviewedAt))return result('unknown','Select different rebuilt bytes scanned after the original finding and declared review.');
  if(!Number.isFinite(Date.parse(reviewedAt))||now-Date.parse(candidate.scannedAt)>24*3600000)return result('unknown','Fresh signed rebuild evidence within 24 hours is required.');
  if(candidate.status==='inconclusive'||candidate.suppressed||candidate.held)return result('unknown','Inconclusive, suppressed or held evidence cannot verify remediation.');
  if(candidate.findings.includes(finding))return result('still_observed','The selected finding remains in the rebuilt artifact.');
  const separator=finding.indexOf('|'),rulePrefix=separator>0?finding.slice(0,separator+1):null;
  if(rulePrefix&&candidate.findings.some(f=>f.startsWith(rulePrefix)))return result('still_observed','The same finding rule still reports exposure in this artifact. A moved path or changed title is not proof of remediation.');
  return result('verified_absent','The selected finding was not observed in this rebuilt artifact under the same scanner and policy.');
}
