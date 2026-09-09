type Evidence = {
 counts: {total:number;attention:number;active:number};
 alertCounts?: {open:number;waiting:number};
 hostedSources?: Array<{installationId:number;attention:number;total:number}>;
 connectedActivity?: Array<{queued:number;running:number}>;
 websiteCoverage?: {total:number;attention:number;delayed:number};
 connectedCoverage?: {unknown:number;delayed:number;unavailable?:number};
};

export function overviewNextAction(data:Evidence,workspaceId:string){
 const params=new URLSearchParams({workspace:workspaceId});
 const result=(text:string,label:string,path='releases')=>({text,label,href:`/watch/${path}?${params}`});
 if(data.alertCounts?.open){
  params.set('tab','open');
  return result('Open alerts need a response. Reviewing or resolving an alert does not change its original scan evidence.','Review open alerts','alerts');
 }
 if(data.counts.attention){
  params.set('uploadStatus','attention');
  return result('Review failed, inconclusive or flagged attempts. Older failed attempts remain in history even after a later attempt passes.','View attempts needing review');
 }
 const hosted=data.hostedSources?.find(source=>source.attention>0);
 if(hosted){
  params.set('install',String(hosted.installationId));
  params.set('releaseView','connected');
  return result('Connected release evidence needs review. Check the recorded findings and policy outcome.','Review connected releases');
 }
 if(data.counts.active){
  params.set('uploadStatus','active');
  return result('Scans are still processing. This summary will refresh as results arrive.','View active scans');
 }
 if(data.connectedActivity?.some(source=>source.queued+source.running>0)){
  return result('Connected checks are processing. This summary refreshes automatically; review Coverage for source configuration and health.','View coverage','sources');
 }
 if(data.alertCounts?.waiting){
  params.set('tab','waiting');
  return result('Alert response is in progress. Follow up on the remaining work and record the outcome.','View work in progress','alerts');
 }
 if(data.websiteCoverage?.attention){
  params.set('websiteHealth',data.websiteCoverage.delayed?'delayed':'attention');
  return result(data.websiteCoverage.delayed?'Scheduled website monitoring is delayed. Historical scan results do not establish current coverage.':'Website coverage needs attention. Verify ownership or complete the next check before relying on monitoring.',data.websiteCoverage.delayed?'Review delayed monitoring':'Review website coverage','sources');
 }
 if(data.connectedCoverage && (data.connectedCoverage.unknown+data.connectedCoverage.delayed+(data.connectedCoverage.unavailable??0)>0)){
  return result('Connected monitoring needs attention. Unknown, delayed or suspended coverage does not establish current safety, even when an older release passed.','Review connected coverage','sources');
 }
 const source=data.hostedSources?.find(item=>item.total>0);
 if(source){
  params.set('install',String(source.installationId));
  params.set('releaseView','connected');
 }
 return result(data.counts.total||source?'Review your saved evidence and start a new check when needed. A recorded policy pass is not a guarantee of current production safety.':'No scan evidence has been recorded in this workspace.','View release history');
}
