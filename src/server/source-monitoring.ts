/** Cadence is configured intent, not a worker heartbeat or guaranteed dispatch. */
export function sourceMonitoring(intervalMs:number,lastCheckedAt:string|null,now=Date.now()){
 const valid=Number.isFinite(intervalMs)&&intervalMs>0;
 const checked=lastCheckedAt?Date.parse(lastCheckedAt):NaN;
 return {
  intervalMs:valid?intervalMs:null,
  freshness:!valid||!Number.isFinite(checked)||checked>now?'unknown':now-checked>intervalMs*2?'delayed':'recent',
  nextDispatchAt:null,
  evaluatedAt:new Date(now).toISOString(),
 };
}
