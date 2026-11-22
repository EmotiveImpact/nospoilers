/**
 * View models for the release pieces shared by the Watch app and the homepage preview.
 * Everything here is derived from recorded evidence. Nothing is inferred: an area with no
 * recorded check stays "unchecked", and a file is only lit when a recorded finding names it.
 */
import type {Finding,ScanReport} from '../report-types.ts';

export type PieceTone='critical'|'warn';
export type FileMapTile={files:number;tone:PieceTone|null;findingIndex:number|null;path:string|null};
export type FileMapMark={path:string;tone:PieceTone;findingIndex:number;count:number};
export type FileMapModel={tiles:FileMapTile[];perTile:number;total:number;marked:FileMapMark[];clear:number;offMap:number};

/** Most tiles the map draws. Larger packages group several files into one tile. */
export const FILE_MAP_TILE_LIMIT=216;

const rank=(tone:PieceTone|null)=>tone==='critical'?2:tone==='warn'?1:0;

/** A finding inside a source map is recorded as `map::original`; the file that shipped is the map. */
export function carrierPath(path:string){const at=path.indexOf('::');return at<0?path:path.slice(0,at);}

export function buildFileMap(report:Pick<ScanReport,'manifest'|'findings'>|null|undefined,limit=FILE_MAP_TILE_LIMIT):FileMapModel|null{
  const manifest=report?.manifest??[];
  if(!report||!manifest.length)return null;
  const position=new Map<string,number>();
  manifest.forEach((file,index)=>{if(!position.has(file.path))position.set(file.path,index);});
  const perFile=new Map<number,{tone:PieceTone;findingIndex:number;count:number}>();
  let offMap=0;
  report.findings.forEach((finding,findingIndex)=>{
    const index=position.get(finding.path)??position.get(carrierPath(finding.path));
    if(index===undefined){offMap+=1;return;}
    const current=perFile.get(index);
    if(!current)perFile.set(index,{tone:finding.severity,findingIndex,count:1});
    else{current.count+=1;if(rank(finding.severity)>rank(current.tone)){current.tone=finding.severity;current.findingIndex=findingIndex;}}
  });
  const perTile=Math.max(1,Math.ceil(manifest.length/Math.max(1,limit)));
  const tiles:FileMapTile[]=[];
  for(let start=0;start<manifest.length;start+=perTile){
    const end=Math.min(manifest.length,start+perTile);
    let tone:PieceTone|null=null,findingIndex:number|null=null,path:string|null=null;
    for(let index=start;index<end;index+=1){
      const mark=perFile.get(index);
      if(mark&&rank(mark.tone)>rank(tone)){tone=mark.tone;findingIndex=mark.findingIndex;path=manifest[index].path;}
    }
    tiles.push({files:end-start,tone,findingIndex,path});
  }
  const marked=[...perFile.entries()].sort(([a,x],[b,y])=>rank(y.tone)-rank(x.tone)||a-b).map(([index,mark])=>({path:manifest[index].path,...mark}));
  return {tiles,perTile,total:manifest.length,marked,clear:manifest.length-marked.length,offMap};
}

export type CheckAreaId='contents'|'maps'|'secrets'|'env'|'live'|'ai'|'private'|'inventory';
export type CheckAreaTone='clear'|'critical'|'warn'|'unchecked';
export type CheckArea={id:CheckAreaId;label:string;tone:CheckAreaTone;detail:string;findings:number};
/** How the live copy was observed for this record. A website check reads the live site itself. */
export type LiveEvidence={kind:'website'}|{kind:'delivery';state:string|null|undefined};

export const CHECK_AREAS:{id:CheckAreaId;label:string}[]=[
  {id:'contents',label:'Package contents'},{id:'maps',label:'Source maps'},{id:'secrets',label:'Secrets'},{id:'env',label:'Environment files'},
  {id:'live',label:'Live sites'},{id:'ai',label:'AI context'},{id:'private',label:'Private files'},{id:'inventory',label:'Inventory'},
];
const PRIVATE_FILE_RULES=new Set(['GIT','BAK','DB','CRASH','DOC','DBG','CACHE','NET','SRC']);

export function areaForRule(rule:string):Exclude<CheckAreaId,'live'|'inventory'>{
  const family=rule.split('-')[0];
  if(family==='MAP')return 'maps';
  if(rule==='SEC-001')return 'env';
  if(family==='SEC')return 'secrets';
  if(family==='AI')return 'ai';
  if(PRIVATE_FILE_RULES.has(family))return 'private';
  return 'contents';
}

const worst=(findings:Finding[]):CheckAreaTone=>findings.some(finding=>finding.severity==='critical')?'critical':findings.length?'warn':'clear';
const shortPath=(path:string)=>{const carrier=carrierPath(path);return carrier.length>28?`…${carrier.slice(-27)}`:carrier;};

export function buildCheckAreas(report:ScanReport|null|undefined,live:LiveEvidence):CheckArea[]{
  const findings=report?.findings??[];
  const quiet:{tone:CheckAreaTone;detail:string}=!report?{tone:'unchecked',detail:'Not checked'}:report.status==='inconclusive'?{tone:'unchecked',detail:'Check incomplete'}:{tone:'clear',detail:'Clear'};
  return CHECK_AREAS.map(({id,label})=>{
    if(id==='inventory'){
      const files=report?.manifest?.length??0;
      return files?{id,label,tone:'clear',detail:`${files.toLocaleString('en-GB')} file${files===1?'':'s'} hashed`,findings:0}:{id,label,tone:'unchecked',detail:report?'No manifest retained':'Not checked',findings:0};
    }
    if(id==='live'){
      if(live.kind==='website'){
        if(!report)return {id,label,tone:'unchecked',detail:'Not checked',findings:0};
        const tone=report.status==='inconclusive'&&!findings.length?'unchecked':worst(findings);
        return {id,label,tone,detail:tone==='unchecked'?'Check incomplete':tone==='clear'?'Public assets clear':'Read from the live site',findings:0};
      }
      const state=live.state;
      return state==='passed'?{id,label,tone:'clear',detail:'Delivery matches',findings:0}
        :state==='failed'?{id,label,tone:'critical',detail:'Delivery differs',findings:0}
        :state==='review'?{id,label,tone:'warn',detail:'Review delivery',findings:0}
        :state==='stale'?{id,label,tone:'unchecked',detail:'Observation is stale',findings:0}
        :{id,label,tone:'unchecked',detail:'Not observed',findings:0};
    }
    const own=findings.filter(finding=>areaForRule(finding.rule)===id);
    if(!own.length)return {id,label,...quiet,findings:0};
    return {id,label,tone:worst(own),detail:own.length===1?shortPath(own[0].path):`${own.length} findings`,findings:own.length};
  });
}

export function formatBytes(bytes:number|null|undefined){
  if(bytes==null||!Number.isFinite(bytes)||bytes<0)return 'Not recorded';
  if(bytes<1024)return `${bytes} B`;
  const units=['KB','MB','GB'];let value=bytes/1024,unit=0;
  while(value>=1024&&unit<units.length-1){value/=1024;unit+=1;}
  return `${value>=100?Math.round(value):value.toFixed(1).replace(/\.0$/,'')} ${units[unit]}`;
}
