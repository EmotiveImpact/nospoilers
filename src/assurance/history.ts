import {comparisonProblem} from './evidence.ts';
import type {Comparison, EvidenceSnapshot} from './types.ts';
const DISPLAY_LIMIT=50;
export function unavailableComparison(reason='No eligible earlier release is available in the inspected history.'): Comparison {
  return {available:false,reason,previousReleaseId:null,counts:null,paths:{added:[],removed:[],changed:[]},truncated:false,newFindingCount:null,noLongerObservedCount:null,newlySuppressedCount:null,sizeChangeBytes:null,sizeChangePercent:null,policyChanged:false,engineChanged:false};
}
export function compareReleases(current:EvidenceSnapshot,previous:EvidenceSnapshot,now=Date.now()):Comparison {
  const problem=comparisonProblem(current,previous,now);
  if(problem)return unavailableComparison(problem);
  const a=previous.receipt!,b=current.receipt!;
  const left=new Map(a.manifest.map(file=>[file.path,file]));
  const right=new Map(b.manifest.map(file=>[file.path,file]));
  const added:string[]=[],removed:string[]=[],changed:string[]=[];
  let unchanged=0;
  for(const [name,file] of right){const old=left.get(name);if(!old)added.push(name);else if(old.sha256.toLowerCase()!==file.sha256.toLowerCase()||old.size!==file.size)changed.push(name);else unchanged++;}
  for(const name of left.keys())if(!right.has(name))removed.push(name);
  for(const paths of [added,removed,changed])paths.sort();
  const oldFindings=new Set([...a.findingFingerprints,...a.suppressedFingerprints]);
  const newFindings=new Set([...b.findingFingerprints,...b.suppressedFingerprints]);
  const sizeChangeBytes=a.artifactBytes!==null&&b.artifactBytes!==null?b.artifactBytes-a.artifactBytes:null;
  return {available:true,reason:'Compared exact paths and file digests in two authorised, bound receipts. Removed findings are not proof of remediation.',previousReleaseId:previous.release.id,counts:{added:added.length,removed:removed.length,changed:changed.length,unchanged},paths:{added:added.slice(0,DISPLAY_LIMIT),removed:removed.slice(0,DISPLAY_LIMIT),changed:changed.slice(0,DISPLAY_LIMIT)},truncated:[added,removed,changed].some(paths=>paths.length>DISPLAY_LIMIT),newFindingCount:[...newFindings].filter(f=>!oldFindings.has(f)).length,noLongerObservedCount:[...oldFindings].filter(f=>!newFindings.has(f)).length,newlySuppressedCount:b.suppressedFingerprints.filter(f=>!a.suppressedFingerprints.includes(f)).length,sizeChangeBytes,sizeChangePercent:sizeChangeBytes!==null&&a.artifactBytes!==null&&a.artifactBytes>0?Number((sizeChangeBytes/a.artifactBytes*100).toFixed(2)):null,policyChanged:a.policyHash!==b.policyHash,engineChanged:a.engineVersion!==b.engineVersion};
}
/** Robust, descriptive size history. Never train a baseline on arbitrary same-name uploads. */
export function sizeHistory(values:number[]):{sampleCount:number;medianBytes:number|null;madBytes:number|null;ready:boolean}{
  const sample=values.filter(value=>Number.isSafeInteger(value)&&value>=0).slice(0,30).sort((a,b)=>a-b);
  const median=(rows:number[])=>rows.length%2?rows[Math.floor(rows.length/2)]:(rows[rows.length/2-1]+rows[rows.length/2])/2;
  if(sample.length<5)return {sampleCount:sample.length,medianBytes:null,madBytes:null,ready:false};
  const centre=median(sample),deviations=sample.map(value=>Math.abs(value-centre)).sort((a,b)=>a-b);
  return {sampleCount:sample.length,medianBytes:centre,madBytes:median(deviations),ready:true};
}
