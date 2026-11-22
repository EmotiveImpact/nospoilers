/**
 * The Acme example shown on the homepage. It is canned presentation data, run through the
 * same view models the Watch app uses, so the preview draws exactly what the app would draw
 * for these records. Only sources the product reads appear here.
 */
import {buildCheckAreas,buildFileMap} from '@/watch/release-pieces';
import {buildReleaseTrail,sourcesWhenFound} from '@/watch/release-trail';

const day=(time:string)=>`2026-11-05T${time}:00.000Z`;
const digest=(seed:string)=>seed.repeat(64).slice(0,64);

/** The moment the example is told from: the evening after the fix shipped. */
export const ACME_NOW=new Date(day('19:20'));

const BLOCKED_FILES=1283,PASSED_FILES=1279;
const FINDINGS=[
  {index:264,path:'dist/cli.js.map',rule:'MAP-002',severity:'critical' as const,title:'Embedded original source',detail:'Original source is embedded in the published map.'},
  {index:612,path:'prompts/system.txt',rule:'AI-001',severity:'warn' as const,title:'Possible private AI context',detail:'An instruction file is included in the package.'},
  {index:990,path:'config/.env',rule:'SEC-001',severity:'warn' as const,title:'Environment file with two keys',detail:'An environment file is included in the package.'},
];

function manifest(files:number,marked:{index:number;path:string}[]){
  const named=new Map(marked.map(mark=>[mark.index,mark.path]));
  return Array.from({length:files},(_,index)=>({path:named.get(index)??`dist/chunks/chunk-${String(index).padStart(4,'0')}.js`,size:2048,sha256:digest('0')}));
}

const blockedReport={status:'failed-policy' as const,manifest:manifest(BLOCKED_FILES,FINDINGS),findings:FINDINGS.map(({rule,severity,path,title,detail})=>({rule,severity,path,title,detail}))};
const passedReport={status:'passed' as const,manifest:manifest(PASSED_FILES,[]),findings:[]};

const BAD=digest('4c7e'),GOOD=`a91f${digest('3e07').slice(0,56)}d82c`,EARLIER=digest('77c0');
const revision=(id:number,version:string,status:string,artifactSha256:string,createdAt:string)=>({id,coordinate:`npm:acme-cli@${version}`,status,artifactSha256,createdAt});
const blocked=revision(3,'v2.4.1','failed-policy',BAD,day('08:00'));
const lineage=[
  revision(1,'v2.3.2','passed',EARLIER,'2026-10-21T09:00:00.000Z'),
  revision(2,'v2.4.0','passed',EARLIER,'2026-11-02T09:00:00.000Z'),
  blocked,
  revision(4,'v2.4.2','passed',GOOD,day('10:00')),
];
const HOURS=[8,9,10,11,12,13,14,15,16,17,18,19];
const at=(hour:number)=>day(`${String(hour).padStart(2,'0')}:05`);
const LOCATIONS=[
  {id:1,url:'https://registry.npmjs.org/acme-cli/-/acme-cli-2.4.1.tgz',host:'registry.npmjs.org',canonical:true,cleared:true},
  {id:2,url:'https://github.com/acme/cli/releases/download/v2.4.1/acme-cli-2.4.1.tgz',host:'github.com',canonical:false,cleared:true},
  {id:3,url:'https://cdn.acme.example/cli/2.4.1/cli.tgz',host:'cdn.acme.example',canonical:false,cleared:false},
];
const servedAt=(location:typeof LOCATIONS[number],hour:number)=>!location.cleared||hour<10;

export const acmeTrail=buildReleaseTrail({
  release:blocked,lineage,hours:HOURS.length,now:ACME_NOW,
  locations:LOCATIONS.map(location=>({id:location.id,url:location.url,host:location.host,canonical:location.canonical,
    lastStatus:location.cleared?'missing':'matched',lastSha256:location.cleared?null:BAD,lastCheckedAt:at(19)})),
  checks:HOURS.flatMap(hour=>LOCATIONS.map(location=>({locationId:location.id,status:servedAt(location,hour)?'matched':'missing',observedSha256:servedAt(location,hour)?BAD:null,createdAt:at(hour)}))),
  websites:[
    {id:1,host:'app.acme.example',status:'passed',publicMap:false,checkedAt:at(19)},
    {id:2,host:'docs.acme.example',status:'passed',publicMap:false,checkedAt:at(19)},
  ],
  mapStores:[{id:1,kind:'sentry',project:'acme/cli',status:'passed',checkedAt:at(19)}],
  alerts:[{id:1,title:'cdn.acme.example still serves v2.4.1 after the fix',createdAt:day('10:42'),resolvedAt:null}],
});

/** Every source as it stood at its first check, before the fix. */
export const acmeSourcesWhenFound=sourcesWhenFound(acmeTrail);
export const acmeFileMap=buildFileMap(blockedReport)!;
/** The fixed release: every area the check covers, with nothing recorded in any of them. */
export const acmeAreas=buildCheckAreas(passedReport,{kind:'delivery',state:'passed'});
export const acmeReceipt={fileName:'receipt.json',result:'passed · 0 findings · checked 5 Nov 2026, 10:02 UTC'};
