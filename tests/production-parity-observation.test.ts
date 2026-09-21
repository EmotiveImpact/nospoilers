import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {observeProductionManifest,parityPath,PARITY_LIMITS,type ParityMapping} from '../src/server/production-parity-observation.ts';
const origin='https://parity.example/';
const file=(path:string,content:string)=>({path,size:Buffer.byteLength(content),sha256:createHash('sha256').update(content).digest('hex')});
const map=(path:string,servedPath=`/${path}`):ParityMapping=>({path,servedPath,representation:'identity'});
const lookup=async()=>[{address:'1.1.1.1',family:4}];

it('reports matched, mismatched, missing, unsupported, extras and unmapped scope without claiming global safety',async()=>{
  const html='<script src="/extra.js"></script><script src="https://other.example/remote.js"></script>';
  const manifest=[file('index.html',html),file('ok.js','ok'),file('changed.js','old'),file('gone.js','gone'),file('dynamic.js','source'),file('unmapped.js','not observed')];
  const fetch=vi.fn<typeof globalThis.fetch>(async url=>{
    const path=new URL(String(url)).pathname;
    if(path==='/gone.js')return new Response('gone',{status:404});
    return new Response(path==='/index.html'?html:path==='/ok.js'?'ok':'new',{headers:{'content-type':path==='/index.html'?'text/html':'text/javascript','cf-cache-status':'HIT'}});
  });
  const result=await observeProductionManifest({origin,manifest,mappings:[...manifest.slice(0,4).map(f=>map(f.path)),{...map('dynamic.js'),representation:'transformed'}]},{lookup,fetch});
  expect(result.assets.map(x=>x.state)).toEqual(['matched','matched','mismatched','missing','unsupported','extra']);
  expect(result.unmappedManifestFiles).toBe(1);expect(result.assets[0].cache).toBe('cf:hit');
  expect(fetch.mock.calls.every(([url])=>new URL(String(url)).origin===new URL(origin).origin)).toBe(true);
  expect(result.scope).toContain('not a release approval');
});

it('does not fetch an off-origin redirect or compare compressed bytes as source bytes',async()=>{
  const manifest=[file('redirect.js','x'),file('compressed.js','x')];
  const fetch=vi.fn<typeof globalThis.fetch>(async url=>String(url).includes('redirect')?new Response(null,{status:302,headers:{location:'https://outside.example/file.js'}}):new Response('x',{headers:{'content-encoding':'gzip'}}));
  const result=await observeProductionManifest({origin,manifest,mappings:manifest.map(f=>map(f.path))},{lookup,fetch});
  expect(result.assets.map(x=>x.state)).toEqual(['unsupported','unsupported']);expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.assets.every(x=>x.observedSha256===null)).toBe(true);
});

it('records same-origin redirects and final paths without executing returned code',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>(async url=>new URL(String(url)).pathname==='/file.js'?new Response(null,{status:302,headers:{location:'/current.js'}}):new Response('code'));
  const result=await observeProductionManifest({origin,manifest:[file('build.js','code')],mappings:[map('build.js','/file.js')]},{lookup,fetch});
  expect(result.assets[0]).toMatchObject({state:'matched',finalPath:'/current.js'});expect(result.requests).toBe(2);
});

it('charges failed reads against the byte budget and leaves later files unobserved',async()=>{
  const manifest=Array.from({length:40},(_,i)=>file(`${i}.js`,'x'));
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>{throw new Error('sensitive diagnostic must not escape');});
  const result=await observeProductionManifest({origin,manifest,mappings:manifest.map(f=>map(f.path))},{lookup,fetch});
  expect(result.chargedBytes).toBe(PARITY_LIMITS.totalBytes);expect(fetch).toHaveBeenCalledTimes(10);
  expect(result.assets.every(a=>a.state==='unobserved')).toBe(true);expect(JSON.stringify(result)).not.toContain('sensitive diagnostic');
});

it('cancels a pending body read and does not send subsequent requests',async()=>{
  const controller=new AbortController(),cancel=vi.fn();
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(new ReadableStream({start(){queueMicrotask(()=>controller.abort());},cancel})));
  const manifest=[file('one.js','x'),file('two.js','x')];
  const result=await observeProductionManifest({origin,manifest,mappings:manifest.map(f=>map(f.path)),signal:controller.signal},{lookup,fetch});
  expect(result.assets.map(x=>x.state)).toEqual(['unobserved','unobserved']);expect(fetch).toHaveBeenCalledTimes(1);expect(cancel).toHaveBeenCalledTimes(1);
});

it('stops awaiting stalled DNS on cancellation without fetching after a late answer',async()=>{
  const controller=new AbortController(),fetch=vi.fn<typeof globalThis.fetch>();
  let finish!:(records:Array<{address:string;family:number}>)=>void;
  const pending=observeProductionManifest({origin,manifest:[file('x.js','x')],mappings:[map('x.js')],signal:controller.signal},{
    lookup:()=>new Promise(resolve=>{finish=resolve;queueMicrotask(()=>controller.abort());}),fetch,
  });
  const result=await pending;
  expect(result.assets[0].state).toBe('unobserved');expect(result.requests).toBe(0);
  finish([{address:'1.1.1.1',family:4}]);await Promise.resolve();
  expect(fetch).not.toHaveBeenCalled();
});

it('refuses private DNS answers before the injected transport can run',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>();
  const result=await observeProductionManifest({origin,manifest:[file('x.js','x')],mappings:[map('x.js')]},{lookup:async()=>[{address:'127.0.0.1',family:4}],fetch});
  expect(result.assets[0].state).toBe('unobserved');expect(fetch).not.toHaveBeenCalled();
});

it.each(['//evil.example/a','/a?token=secret','/a#frag','/a/../b','/%2e%2e/b','/a%2fb/../c','/a\\b','/a%00b'])('rejects ambiguous or credential-bearing path %s',path=>{
  expect(()=>parityPath(path)).toThrow();
});
