import {fail,validate,type Evidence} from './model.ts';
export type GateMode='advisory'|'warn'|'enforce';
export type GatePolicy={revision:number;mode:GateMode;maxAgeHours:number};
export const DEFAULT_GATE:GatePolicy={revision:0,mode:'advisory',maxAgeHours:24};
export type GateResult={readiness:'ready'|'review'|'blocked'|'unknown';reason:string;overridable:boolean};
export function gatePolicy(mode:unknown,maxAgeHours:unknown):Omit<GatePolicy,'revision'>{
  if(mode!=='advisory'&&mode!=='warn'&&mode!=='enforce')return fail('Choose advisory, warn or enforce.');
  if(!Number.isSafeInteger(maxAgeHours)||Number(maxAgeHours)<1||Number(maxAgeHours)>168)return fail('Evidence freshness must be 1 to 168 hours.');
  return {mode,maxAgeHours:Number(maxAgeHours)};
}
/** Layer freshness and explicit gate scope over the shared canonical assessment.
 * Never reinterpret a website observation as a pre-deployment build scan. */
export function evaluateGate(e:Evidence|null,digest:string,policy:GatePolicy,now=Date.now()):GateResult{
  if(!e)return {readiness:'unknown',reason:'Verified evidence is unavailable.',overridable:false};
  validate(e,now);
  if(e.digest!==digest)return {readiness:'unknown',reason:'Requested artifact digest does not match signed evidence.',overridable:false};
  if(e.source.includes('website:')||e.format==='scan:website')return {readiness:'unknown',reason:'A production website observation is not a pre-deployment build scan.',overridable:false};
  const age=now-Date.parse(e.scannedAt);
  if(age<0||age>policy.maxAgeHours*3600000)return {readiness:'unknown',reason:'Scan evidence is outside the adopted freshness window.',overridable:false};
  const readiness=e.readiness??'unknown';
  return {readiness,reason:readiness==='ready'?'Passes the recorded pre-deploy checks.':readiness==='unknown'?'Canonical pre-deploy evidence is incomplete.':'Recorded findings or governance require review.',
    overridable:!e.held&&(readiness==='blocked'||readiness==='review')};
}
