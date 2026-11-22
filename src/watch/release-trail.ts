/**
 * "Where it went": one release drawn out to every place it is served, built only from
 * recorded checks. A copy is called clear only when a completed check showed it no longer
 * serves the blocked bytes; anything that could not be read stays unknown.
 */
import {releaseFamily} from './release-brief.ts';

export type TrailState='exposed'|'clear'|'changed'|'unknown';
export type TrailCell=TrailState|'none';
export type TrailTone='bad'|'good'|'warn'|'plain';
export type TrailReading={state:TrailState;label:string};
export type TrailReleaseStatus='failed'|'passed'|'incomplete';

export type TrailSource={
  key:string;
  /** origin: where the release was published. copy: a delivery URL attached to it. website and maps: watched separately in the workspace. */
  kind:'origin'|'copy'|'website'|'maps';
  scope:'release'|'workspace';
  name:string;
  detail:string;
  state:TrailState;
  label:string;
  first:(TrailReading&{at:string})|null;
  since:string|null;
  checkedAt:string|null;
  cells:TrailCell[];
};
export type TrailVersion={id:number;version:string;status:TrailReleaseStatus;createdAt:string;role:'this'|'fix'|'other'};
export type TrailEvent={at:string;tone:TrailTone;text:string};
export type TrailAlert={id:number;title:string;createdAt:string;resolvedAt:string|null};
export type ReleaseTrailModel={
  release:{id:number;coordinate:string;name:string;version:string;status:TrailReleaseStatus;createdAt:string};
  fix:{id:number;version:string;createdAt:string}|null;
  sources:TrailSource[];
  versions:TrailVersion[];
  hours:string[];
  events:TrailEvent[];
  alerts:TrailAlert[];
  summary:{tone:TrailTone;headline:string;exposed:number;clear:number;changed:number;unknown:number;copies:number;lastCheckedAt:string|null};
};

export type TrailRevisionInput={id:number;coordinate:string;status:string|null;artifactSha256:string;createdAt:string};
export type TrailLocationInput={id:number;url:string;host:string;canonical:boolean;lastStatus:string|null;lastSha256:string|null;lastCheckedAt:string|null};
export type TrailCheckInput={locationId:number;status:string;observedSha256:string|null;createdAt:string};
export type TrailWebsiteInput={id:number;host:string;status:string|null;publicMap:boolean;checkedAt:string|null;paused?:boolean};
export type TrailMapStoreInput={id:number;kind:string;project:string;status:string|null;checkedAt:string|null};
export type ReleaseTrailInput={
  release:TrailRevisionInput;
  lineage:TrailRevisionInput[];
  locations:TrailLocationInput[];
  checks:TrailCheckInput[];
  websites?:TrailWebsiteInput[];
  mapStores?:TrailMapStoreInput[];
  alerts?:TrailAlert[];
  now:Date;
  hours?:number;
};

/** A recorded time in UTC: the clock time today, the day and time otherwise. */
export function trailTime(iso:string|null|undefined,now:Date=new Date()){
  const at=iso?new Date(iso):null;
  if(!at||Number.isNaN(at.getTime()))return 'Not recorded';
  const time=at.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
  if(at.toISOString().slice(0,10)===now.toISOString().slice(0,10))return time;
  return `${at.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})} ${time}`;
}

export const TRAIL_HOURS=24;
const HOUR_MS=3_600_000;

/** The version part of a release coordinate: `npm:pkg@1.2.3` and `github:o/r@v1#asset` give `1.2.3` and `v1`. */
export function coordinateVersion(coordinate:string){
  const hash=coordinate.indexOf('#');
  const head=hash>=0?coordinate.slice(0,hash):coordinate;
  const at=head.lastIndexOf('@');
  return at>0?head.slice(at+1):'';
}

/** The package or repository a coordinate names, without the channel prefix. */
export function coordinateName(coordinate:string){
  const family=releaseFamily(coordinate);
  const colon=family.indexOf(':');
  return colon>=0?family.slice(colon+1):family;
}

/**
 * The same package, or the same named asset of the same repository, across versions.
 * An asset that carries its own version in the file name (`cli-2.4.1.tgz`) still lines up
 * with the next version's asset, because the version is taken out of the name first.
 */
export function artifactLine(coordinate:string){
  const hash=coordinate.indexOf('#');
  const family=releaseFamily(coordinate);
  if(hash<0)return `${family}#`;
  const version=coordinateVersion(coordinate);
  let asset=coordinate.slice(hash+1);
  for(const token of new Set([version,version.replace(/^v(?=\d)/i,'')])){
    if(token.length>=3&&/\d/.test(token))asset=asset.split(token).join('{version}');
  }
  return `${family}#${asset}`;
}

export function trailStatus(status:string|null|undefined):TrailReleaseStatus{
  return status==='failed-policy'?'failed':status==='passed'?'passed':'incomplete';
}

const later=(a:TrailRevisionInput,b:TrailRevisionInput)=>a.createdAt>b.createdAt||(a.createdAt===b.createdAt&&a.id>b.id);

/** The first later revision of the same artifact line that passed its check. */
export function firstFix(release:TrailRevisionInput,lineage:TrailRevisionInput[]){
  if(trailStatus(release.status)!=='failed')return null;
  const line=artifactLine(release.coordinate);
  return lineage.filter(row=>row.id!==release.id&&row.status==='passed'&&artifactLine(row.coordinate)===line&&later(row,release))
    .sort((a,b)=>later(a,b)?1:-1)[0]??null;
}

type ReadContext={status:TrailReleaseStatus;bySha:Map<string,TrailRevisionInput>;sha:string};

/** What one recorded check says about one copy of this release. */
export function readCheck(context:ReadContext,status:string|null,observedSha256:string|null):TrailReading{
  const failed=context.status==='failed';
  if(!status)return {state:'unknown',label:'Not checked yet'};
  if(status==='matched'){
    if(failed)return {state:'exposed',label:'Serving this build'};
    return context.status==='passed'?{state:'clear',label:'Matches the checked build'}:{state:'unknown',label:'Serves this build, check incomplete'};
  }
  if(status==='mismatch'){
    const other=observedSha256&&observedSha256!==context.sha?context.bySha.get(observedSha256):undefined;
    if(other){
      const version=coordinateVersion(other.coordinate)||'another release';
      const outcome=trailStatus(other.status);
      if(outcome==='passed')return {state:'clear',label:`Now serves ${version}`};
      if(outcome==='failed')return {state:'exposed',label:`Serves ${version}, also blocked`};
      return {state:'changed',label:`Serves ${version}, check incomplete`};
    }
    return {state:'changed',label:failed?'Replaced by bytes not yet checked':'Serves different bytes'};
  }
  if(status==='missing')return failed?{state:'clear',label:'No longer served'}:{state:'changed',label:'No longer served'};
  if(status==='content_type')return {state:'changed',label:'Serves a different content type'};
  if(status==='redirect')return {state:'unknown',label:'Redirects elsewhere'};
  if(status==='blocked')return {state:'unknown',label:'Check was blocked'};
  return {state:'unknown',label:'Check could not complete'};
}

const hourStart=(ms:number)=>Math.floor(ms/HOUR_MS)*HOUR_MS;
const plural=(count:number,one:string,many:string)=>`${count} ${count===1?one:many}`;

function originName(coordinate:string){
  if(coordinate.startsWith('npm:'))return 'npm registry';
  if(coordinate.startsWith('github:'))return 'GitHub release';
  return 'Published release';
}

/** An attached copy on one of the two places the product itself reads releases from. */
function knownHostName(url:string){
  try{
    const parsed=new URL(url);
    if(parsed.host==='registry.npmjs.org')return 'npm registry';
    if(parsed.host==='github.com'&&parsed.pathname.includes('/releases/download/'))return 'GitHub release';
  }catch{/* fall through to the host */}
  return null;
}

/** The path of an attached URL, shortened from the front on whole segments. The host is shown as the name. */
function urlPath(url:string){
  try{
    const segments=new URL(url).pathname.split('/').filter(Boolean);
    if(!segments.length)return 'Attached delivery URL';
    const kept:string[]=[];
    for(const segment of [...segments].reverse()){
      if(kept.length&&kept.join('/').length+segment.length+1>34)break;
      kept.unshift(segment);
    }
    return `${kept.length<segments.length?'…/':'/'}${kept.join('/')}`;
  }catch{return 'Attached delivery URL';}
}

export function buildReleaseTrail(input:ReleaseTrailInput):ReleaseTrailModel{
  const {release,now}=input;
  const hourCount=Math.max(1,input.hours??TRAIL_HOURS);
  const status=trailStatus(release.status);
  const version=coordinateVersion(release.coordinate);
  const lineage=input.lineage.some(row=>row.id===release.id)?input.lineage:[...input.lineage,release];
  const bySha=new Map<string,TrailRevisionInput>();
  for(const row of [...lineage].sort((a,b)=>later(a,b)?1:-1))bySha.set(row.artifactSha256,row);
  const context:ReadContext={status,bySha,sha:release.artifactSha256};
  const fix=firstFix(release,lineage);

  const lastHour=hourStart(now.getTime());
  const hours=Array.from({length:hourCount},(_,index)=>new Date(lastHour-(hourCount-1-index)*HOUR_MS).toISOString());
  const events:TrailEvent[]=[];
  const label=version||release.coordinate;
  events.push({at:release.createdAt,tone:status==='failed'?'bad':status==='passed'?'good':'plain',text:`${label} checked: ${status==='failed'?'blocked':status==='passed'?'passed':'incomplete'}`});
  if(fix)events.push({at:fix.createdAt,tone:'good',text:`${coordinateVersion(fix.coordinate)||'A later release'} passed its check`});

  const sources:TrailSource[]=input.locations.map(location=>{
    const name=location.canonical?originName(release.coordinate):knownHostName(location.url)??location.host;
    const own=input.checks.filter(check=>check.locationId===location.id).sort((a,b)=>a.createdAt<b.createdAt?-1:a.createdAt>b.createdAt?1:0);
    const readings=own.map(check=>({at:check.createdAt,...readCheck(context,check.status,check.observedSha256)}));
    const current=readCheck(context,location.lastStatus,location.lastSha256);
    const cells:TrailCell[]=hours.map(()=>'none');
    for(const reading of readings){
      const index=Math.round((hourStart(Date.parse(reading.at))-Date.parse(hours[0]))/HOUR_MS);
      if(index>=0&&index<cells.length)cells[index]=reading.state;
    }
    let since:string|null=null;
    for(let index=readings.length-1;index>=0;index-=1){
      if(readings[index].state!==current.state||readings[index].label!==current.label)break;
      since=readings[index].at;
    }
    readings.forEach((reading,index)=>{
      const previous=readings[index-1];
      if(previous&&previous.state===reading.state&&previous.label===reading.label)return;
      const tone:TrailTone=reading.state==='exposed'?'bad':reading.state==='clear'?'good':reading.state==='changed'?'warn':'plain';
      events.push({at:reading.at,tone,text:`${name}: ${reading.label.charAt(0).toLowerCase()}${reading.label.slice(1)}`});
    });
    const still=status==='failed'&&current.state==='exposed'&&location.lastStatus==='matched'&&(Boolean(fix)||readings.length>1);
    return {
      key:`copy-${location.id}`,kind:location.canonical?'origin':'copy',scope:'release',name,
      detail:location.canonical?location.host:urlPath(location.url),
      state:current.state,label:still?'Still serving this build':current.label,
      first:readings[0]?{state:readings[0].state,label:readings[0].label,at:readings[0].at}:null,
      since,checkedAt:location.lastCheckedAt,cells,
    };
  });

  for(const site of input.websites??[]){
    const reading:TrailReading=site.paused?{state:'unknown',label:'Watching is paused'}
      :!site.checkedAt||!site.status?{state:'unknown',label:'Not checked yet'}
      :site.publicMap?{state:'exposed',label:'Serves a public source map'}
      :site.status==='passed'?{state:'clear',label:'Clean at its last check'}
      :site.status.startsWith('fail')?{state:'changed',label:'Findings at its last check'}
      :{state:'unknown',label:'Last check incomplete'};
    sources.push({key:`site-${site.id}`,kind:'website',scope:'workspace',name:site.host,detail:'Verified website',...reading,first:null,since:null,checkedAt:site.checkedAt,cells:[]});
  }
  for(const store of input.mapStores??[]){
    const reading:TrailReading=!store.checkedAt||!store.status?{state:'unknown',label:'Not checked yet'}
      :store.status==='passed'?{state:'clear',label:'Private, as intended'}
      :store.status==='failed-policy'?{state:'exposed',label:'Custody check failed'}
      :{state:'unknown',label:'Last check incomplete'};
    const name=store.kind==='bugsnag'?'Bugsnag upload':store.kind==='sentry'?'Sentry upload':'Map upload';
    sources.push({key:`maps-${store.id}`,kind:'maps',scope:'workspace',name,detail:store.project,...reading,first:null,since:null,checkedAt:store.checkedAt,cells:[]});
  }

  const alerts=[...(input.alerts??[])].sort((a,b)=>a.createdAt<b.createdAt?-1:1);
  for(const alert of alerts){
    events.push({at:alert.createdAt,tone:'bad',text:`Alert sent: ${alert.title}`});
    if(alert.resolvedAt)events.push({at:alert.resolvedAt,tone:'good',text:`Alert resolved: ${alert.title}`});
  }
  events.sort((a,b)=>a.at<b.at?-1:a.at>b.at?1:0);

  const line=artifactLine(release.coordinate);
  const versionKey=(row:TrailRevisionInput)=>coordinateVersion(row.coordinate)||`#${row.id}`;
  const perVersion=new Map<string,TrailRevisionInput>();
  for(const row of lineage.filter(row=>artifactLine(row.coordinate)===line).sort((a,b)=>later(a,b)?1:-1))perVersion.set(versionKey(row),row);
  if(fix)perVersion.set(versionKey(fix),fix);
  perVersion.set(versionKey(release),release);
  const ordered=[...perVersion.values()].sort((a,b)=>later(a,b)?1:-1);
  const at=ordered.findIndex(row=>row.id===release.id);
  const fixAt=fix?ordered.findIndex(row=>row.id===fix.id):-1;
  const picks=new Set<number>();
  for(const index of [at-2,at-1,at,at+1,...(fixAt>=0?[fixAt,fixAt+1]:[]),ordered.length-1])if(index>=0&&index<ordered.length)picks.add(index);
  const versions:TrailVersion[]=[...picks].sort((a,b)=>a-b).map(index=>ordered[index]).map(row=>({
    id:row.id,version:coordinateVersion(row.coordinate)||row.coordinate,status:trailStatus(row.status),createdAt:row.createdAt,
    role:row.id===release.id?'this':row.id===fix?.id?'fix':'other',
  }));

  const copies=sources.filter(source=>source.scope==='release');
  const count=(state:TrailState)=>copies.filter(source=>source.state===state).length;
  const exposed=count('exposed'),clear=count('clear'),changed=count('changed'),unknown=count('unknown');
  const lastCheckedAt=copies.map(source=>source.checkedAt).filter((value):value is string=>Boolean(value)).sort().at(-1)??null;
  const summary=((): {tone:TrailTone;headline:string}=>{
    if(!copies.length)return {tone:'plain',headline:'No copy of this release is being tracked'};
    if(exposed)return {tone:'bad',headline:status==='failed'?`${plural(exposed,'source is','sources are')} still serving this build`:`${plural(exposed,'source serves','sources serve')} a blocked build`};
    if(changed)return {tone:'warn',headline:`${plural(changed,'source has','sources have')} changed since the check`};
    if(unknown)return {tone:'plain',headline:unknown===copies.length?'No source has been read yet':`${plural(unknown,'source','sources')} could not be read`};
    return {tone:'good',headline:status==='failed'?'No source serves this build':'Every source matches the checked build'};
  })();

  return {
    release:{id:release.id,coordinate:release.coordinate,name:coordinateName(release.coordinate),version,status,createdAt:release.createdAt},
    fix:fix?{id:fix.id,version:coordinateVersion(fix.coordinate),createdAt:fix.createdAt}:null,
    sources,versions,hours,events:events.slice(-14),alerts,
    summary:{...summary,exposed,clear,changed,unknown,copies:copies.length,lastCheckedAt},
  };
}

/** The same sources as they stood at their first recorded check, for the "when found" view. */
export function sourcesWhenFound(model:ReleaseTrailModel):TrailSource[]{
  return model.sources.map(source=>source.scope==='release'&&source.first?{...source,state:source.first.state,label:source.first.label,checkedAt:source.first.at,since:null}:source);
}
