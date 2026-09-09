import {isCount,isRecord,recordedTime} from './evidence.ts';
import type {AssuranceView} from './types.ts';
/** Reject incomplete transport responses instead of rendering a fabricated green view. */
export function readAssuranceView(value:unknown,expectedId:number|string):AssuranceView|null{
  if(!isRecord(value)||value.schema!=='nospoilers.assurance-view/v1'||!isRecord(value.assessment)||!isRecord(value.strictPreview)||!isRecord(value.comparison)||!isRecord(value.investigation)||!isRecord(value.passport))return null;
  for(const assessment of [value.assessment,value.strictPreview]){
    if(assessment.releaseId!==expectedId||!['ready','review','blocked','unknown'].includes(String(assessment.beforeDeploy))||!['passed','failed','review','unknown','stale','not-configured'].includes(String(assessment.afterDeploy))||typeof assessment.title!=='string'||typeof assessment.summary!=='string'||recordedTime(assessment.evaluatedAt)===null||!Array.isArray(assessment.checks)||assessment.checks.length>100||!Array.isArray(assessment.limitations)||!assessment.limitations.every(item=>typeof item==='string'))return null;
    if(assessment.checks.some(check=>!isRecord(check)||typeof check.id!=='string'||typeof check.label!=='string'||typeof check.detail!=='string'||!['passed','failed','review','unknown','stale','not-configured'].includes(String(check.state))))return null;
  }
  const comparison=value.comparison;
  if(typeof comparison.available!=='boolean'||typeof comparison.reason!=='string'||!isRecord(comparison.paths))return null;
  for(const key of ['added','removed','changed'])if(!Array.isArray(comparison.paths[key])||!(comparison.paths[key] as unknown[]).every(item=>typeof item==='string'))return null;
  if(comparison.available){
    const counts=comparison.counts;
    if(!isRecord(counts)||!['added','removed','changed','unchanged'].every(key=>isCount(counts[key])))return null;
    if(!['newFindingCount','noLongerObservedCount','newlySuppressedCount'].every(key=>isCount(comparison[key])))return null;
  }
  if(!['hosted-release','token-scan','uploaded-scan','website-scan'].includes(String(value.source)))return null;
  if(value.passport.schema!=='nospoilers.release-passport/v1'||value.passport.signatureStatus!=='unsigned-summary'||value.passport.certification!==false)return null;
  if(typeof value.investigation.caveat!=='string'||!Array.isArray(value.investigation.steps)||value.investigation.steps.some(step=>!isRecord(step)||typeof step.title!=='string'||typeof step.detail!=='string'))return null;
  return value as unknown as AssuranceView;
}
