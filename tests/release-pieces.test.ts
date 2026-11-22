import {describe,expect,it} from 'vitest';
import {areaForRule,buildCheckAreas,buildFileMap,carrierPath,formatBytes} from '../src/watch/release-pieces.ts';
import type {Finding,ScanReport} from '../src/report-types.ts';

const finding=(rule:string,path:string,severity:Finding['severity']='critical'):Finding=>({rule,severity,path,title:rule,detail:''});
const report=(files:number,findings:Finding[],extra:Partial<ScanReport>={}):ScanReport=>({target:'t',kind:'tgz',fileCount:files,ok:!findings.length,status:findings.length?'failed-policy':'passed',scannedAt:'2026-11-22T08:00:00Z',findings,
  manifest:Array.from({length:files},(_,i)=>({path:`dist/file-${String(i).padStart(4,'0')}.js`,size:10,sha256:'0'.repeat(64)})),...extra});

describe('file map',()=>{
  it('draws nothing when no manifest was retained',()=>{
    expect(buildFileMap(null)).toBeNull();
    expect(buildFileMap({findings:[finding('MAP-001','a.js.map')],manifest:[]})).toBeNull();
    expect(buildFileMap({findings:[]})).toBeNull();
  });
  it('gives each file a tile and lights only files a recorded finding names',()=>{
    const map=buildFileMap(report(3,[finding('MAP-001','dist/file-0001.js'),finding('SEC-003','dist/file-0001.js','warn'),finding('AI-001','dist/file-0002.js','warn')]))!;
    expect(map.perTile).toBe(1);
    expect(map.tiles.map(tile=>tile.tone)).toEqual([null,'critical','warn']);
    expect(map.tiles[1]).toMatchObject({findingIndex:0,path:'dist/file-0001.js'});
    expect(map.marked).toEqual([{path:'dist/file-0001.js',tone:'critical',findingIndex:0,count:2},{path:'dist/file-0002.js',tone:'warn',findingIndex:2,count:1}]);
    expect(map.clear).toBe(1);
    expect(map.offMap).toBe(0);
  });
  it('groups files into at most the tile limit and keeps the worst finding of each group',()=>{
    const map=buildFileMap(report(1283,[finding('SEC-001','dist/file-0007.js','warn'),finding('MAP-002','dist/file-0008.js'),finding('MAP-001','dist/file-1282.js')]))!;
    expect(map.perTile).toBe(6);
    expect(map.tiles.length).toBe(214);
    expect(map.tiles.reduce((sum,tile)=>sum+tile.files,0)).toBe(1283);
    expect(map.tiles[1]).toMatchObject({tone:'critical',findingIndex:1,path:'dist/file-0008.js'});
    expect(map.tiles.at(-1)).toMatchObject({tone:'critical',files:5});
    expect(map.clear).toBe(1280);
  });
  it('places a finding inside a source map on the map file that shipped, and counts findings it cannot place',()=>{
    expect(carrierPath('dist/app.js.map::src/secret.ts')).toBe('dist/app.js.map');
    const source=report(2,[],{manifest:[{path:'dist/app.js',size:1,sha256:'a'},{path:'dist/app.js.map',size:1,sha256:'b'}]});
    const map=buildFileMap({...source,findings:[finding('SEC-001','dist/app.js.map::.env'),finding('SIZE-002','(artifact)','warn')]})!;
    expect(map.tiles.map(tile=>tile.tone)).toEqual([null,'critical']);
    expect(map.offMap).toBe(1);
    expect(map.clear).toBe(1);
  });
});

describe('check areas',()=>{
  it('maps every scanner rule family to one area',()=>{
    expect(areaForRule('MAP-003')).toBe('maps');
    expect(areaForRule('SEC-001')).toBe('env');
    expect(areaForRule('SEC-003')).toBe('secrets');
    expect(areaForRule('AI-001')).toBe('ai');
    for(const rule of ['GIT-001','BAK-001','DB-001','CRASH-001','DOC-001','DBG-001','CACHE-001','NET-001','SRC-001'])expect(areaForRule(rule)).toBe('private');
    for(const rule of ['ARC-001','LNK-001','SIZE-002','NEW-999'])expect(areaForRule(rule)).toBe('contents');
  });
  it('colours areas by recorded findings and leaves unobserved delivery open',()=>{
    const areas=buildCheckAreas(report(3,[finding('MAP-001','dist/a.js.map'),finding('MAP-002','dist/a.js.map'),finding('SEC-001','.env','warn')]),{kind:'delivery',state:'not-configured'});
    expect(areas.map(area=>area.id)).toEqual(['contents','maps','secrets','env','live','ai','private','inventory']);
    const by=Object.fromEntries(areas.map(area=>[area.id,area]));
    expect(by.maps).toMatchObject({tone:'critical',detail:'2 findings',findings:2});
    expect(by.env).toMatchObject({tone:'warn',detail:'.env',findings:1});
    expect(by.secrets).toMatchObject({tone:'clear',detail:'Clear'});
    expect(by.live).toMatchObject({tone:'unchecked',detail:'Not observed'});
    expect(by.inventory).toMatchObject({tone:'clear',detail:'3 files hashed'});
  });
  it('never shows a pass for a missing or incomplete check',()=>{
    expect(buildCheckAreas(null,{kind:'delivery',state:null}).every(area=>area.tone==='unchecked')).toBe(true);
    const incomplete=buildCheckAreas(report(2,[],{status:'inconclusive'}),{kind:'website'});
    expect(incomplete.filter(area=>area.id!=='inventory').every(area=>area.tone==='unchecked')).toBe(true);
    expect(buildCheckAreas(report(2,[],{manifest:undefined}),{kind:'delivery',state:'passed'}).find(area=>area.id==='inventory')).toMatchObject({tone:'unchecked',detail:'No manifest retained'});
  });
  it('reads delivery and website evidence for the live area',()=>{
    const live=(state:string|null)=>buildCheckAreas(report(1,[]),{kind:'delivery',state}).find(area=>area.id==='live')!;
    expect(live('passed')).toMatchObject({tone:'clear',detail:'Delivery matches'});
    expect(live('failed')).toMatchObject({tone:'critical'});
    expect(live('stale')).toMatchObject({tone:'unchecked'});
    expect(buildCheckAreas(report(1,[finding('MAP-003','app.js')]),{kind:'website'}).find(area=>area.id==='live')).toMatchObject({tone:'critical',detail:'Read from the live site',findings:0});
    expect(buildCheckAreas(report(1,[]),{kind:'website'}).find(area=>area.id==='live')).toMatchObject({tone:'clear',detail:'Public assets clear'});
  });
});

describe('formatBytes',()=>{
  it('uses compact binary units',()=>{
    expect(formatBytes(401)).toBe('401 B');
    expect(formatBytes(3.2*1024*1024)).toBe('3.2 MB');
    expect(formatBytes(412*1024)).toBe('412 KB');
    expect(formatBytes(null)).toBe('Not recorded');
  });
});
