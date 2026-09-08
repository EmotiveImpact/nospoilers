export type WebsiteHealthInput={disconnected_at?:string|Date|null;paused_at?:string|Date|null;verified_at?:string|Date|null;last_checked_at?:string|Date|null;next_check_at?:string|Date|null;schedule_hours?:number;schedule_error?:string|null;latest_attempt_status?:string|null};
export function websiteHealth(source:WebsiteHealthInput,now:number){
 if(source.disconnected_at)return {state:'disconnected',label:'Disconnected · history retained',attention:false};
 if(source.paused_at)return {state:'paused',label:'Paused · scans stopped',attention:false};
 if(!source.verified_at)return {state:'unverified',label:'Ownership verification required',attention:true};
 const due=source.next_check_at?new Date(source.next_check_at).getTime():NaN;
 if(source.schedule_hours&&(source.schedule_error||Number.isFinite(due)&&due<now))return {state:'delayed',label:'Monitoring delayed · check needs attention',attention:true};
 if(source.latest_attempt_status==='queued'||source.latest_attempt_status==='running')return {state:'checking',label:'Check in progress · result not yet available',attention:false};
 if(source.latest_attempt_status==='failed')return {state:'failed',label:'Latest check failed · previous evidence is historical',attention:true};
 if(!source.last_checked_at)return {state:'unchecked',label:'Ownership verified · no completed check',attention:true};
 return source.schedule_hours?{state:'scheduled',label:'Scheduled · inspect latest evidence for findings',attention:false}:{state:'manual',label:'Manual checks only · no ongoing monitoring',attention:false};
}
