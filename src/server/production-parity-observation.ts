import {createHash} from 'node:crypto';
import {pinnedHttps} from './pinned-https.ts';
import {readBoundedBody} from './bounded-body.ts';
import {collectHtmlAssetUrls,parseWatchRoot} from './web-origin.ts';
import {assertPublicWebhookHost,lookupWebhookHost,type WebhookHostLookup} from './siem.ts';
import {normalizeDeliveryCacheState} from './delivery-verify.ts';
import {fail} from '../release-intelligence/model.ts';
import type {Evidence} from '../release-intelligence/model.ts';

export const PARITY_LIMITS={assets:40,fileBytes:2_000_000,totalBytes:20_000_000,deadlineMs:30_000,redirects:3} as const;
export type ParityMapping={path:string;servedPath:string;representation:'identity'|'transformed'};
export type ParityAsset={path:string|null;servedPath:string;state:'matched'|'missing'|'extra'|'mismatched'|'unobserved'|'unsupported';
  expectedSha256:string|null;observedSha256:string|null;observedBytes:number|null;finalPath:string|null;cache:string|null;reason:string};

/** Relative public paths only. No credentials, query tokens or ambiguous traversal. */
export function parityPath(raw:unknown):string{
  if(typeof raw!=='string'||raw.length>500||!raw.startsWith('/')||raw.startsWith('//')||/[\\?#\x00-\x20]/.test(raw))return fail('Use a query-free absolute website path.');
  let decoded:string;try{decoded=decodeURIComponent(raw);}catch{return fail('Invalid encoded website path.');}
  if(/[\\?#\x00-\x20]/.test(decoded)||decoded.includes('//')||decoded.split('/').some(x=>x==='.'||x==='..'))return fail('Ambiguous website paths are not supported.');
  return new URL(raw,'https://scope.invalid').pathname;
}

export function parityMappings(raw:unknown,manifest:Evidence['manifest']):ParityMapping[]{
  if(!Array.isArray(raw)||!raw.length||raw.length>PARITY_LIMITS.assets) return fail('Choose between 1 and 40 approved manifest files.');
  const paths=new Set<string>(),urls=new Set<string>();
  return raw.map(item=>{
    if(!item||typeof item!=='object'||typeof item.path!=='string'||!manifest.some(file=>file.path===item.path))return fail('Choose an exact path from the approved manifest.');
    const servedPath=parityPath(item.servedPath);
    if(paths.has(item.path)||urls.has(servedPath))return fail('Each manifest file and website path must be selected only once.');
    paths.add(item.path);urls.add(servedPath);
    if(item.representation!=='identity'&&item.representation!=='transformed')return fail('Declare whether the served representation is unchanged or transformed.');
    return {path:item.path,servedPath,representation:item.representation};
  });
}

/** Internal worker primitive. Caller must validate current tenant/origin ownership,
 * approved snapshot and deployment binding before AND after observing. No JS runs;
 * bodies are discarded after hashing/discovery. This never issues a receipt. */
export async function observeProductionManifest(input:{origin:string;manifest:Evidence['manifest'];mappings:ParityMapping[];signal?:AbortSignal},
  deps:{fetch?:typeof fetch;lookup?:WebhookHostLookup;beforeRequest?:()=>Promise<void>}={}){
  const root=parseWatchRoot(input.origin);if(!root||root.url!==input.origin)return fail('Use the verified website origin.');
  const mappings=parityMappings(input.mappings,input.manifest),origin=new URL(root.url);
  const lookup=deps.lookup??lookupWebhookHost;
  const signal=AbortSignal.any([AbortSignal.timeout(PARITY_LIMITS.deadlineMs),...(input.signal?[input.signal]:[])]);
  // DNS lookup itself is not abortable. Stop awaiting it when this observation
  // ends; a late DNS answer must never resume network work.
  const boundedLookup:WebhookHostLookup=async host=>{
    signal.throwIfAborted();
    let onAbort:()=>void=()=>undefined;
    const interrupted=new Promise<never>((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true});});
    try{return await Promise.race([lookup(host),interrupted]);}
    finally{signal.removeEventListener('abort',onAbort);}
  };
  const startedAt=new Date().toISOString(),assets:ParityAsset[]=[],discovered=new Set<string>();
  let totalBytes=0,chargedBytes=0,requests=0;
  async function observe(mapping:ParityMapping|null,servedPath:string):Promise<ParityAsset>{
    const expected=mapping?input.manifest.find(file=>file.path===mapping.path)!:null;
    const result:ParityAsset={path:mapping?.path??null,servedPath,state:'unobserved',expectedSha256:expected?.sha256??null,observedSha256:null,observedBytes:null,finalPath:null,cache:null,reason:'Observation was not completed.'};
    if(mapping?.representation==='transformed')return {...result,state:'unsupported',reason:'Declared transformed output cannot be compared byte-for-byte.'};
    if(signal.aborted||requests>=PARITY_LIMITS.assets||chargedBytes>=PARITY_LIMITS.totalBytes)return {...result,reason:'The bounded observation budget ended.'};
    let current=new URL(servedPath,origin),redirects=0;
    try{
      if(!await assertPublicWebhookHost(origin.hostname,boundedLookup))return {...result,reason:'Origin did not resolve exclusively to public addresses within the observation budget.'};
      while(!signal.aborted){
        if(requests>=PARITY_LIMITS.assets||chargedBytes>=PARITY_LIMITS.totalBytes)return {...result,reason:'The request or byte budget ended.'};
        await deps.beforeRequest?.();signal.throwIfAborted();
        requests++;
        const requestBytes=Math.min(PARITY_LIMITS.fileBytes,PARITY_LIMITS.totalBytes-chargedBytes);
        chargedBytes+=requestBytes; // Failed/partial reads retain their worst-case reservation.
        const init:RequestInit={method:'GET',redirect:'manual',signal,headers:{'accept-encoding':'identity','cache-control':'no-cache'}};
        const response=deps.fetch?await deps.fetch(current,init):await pinnedHttps(String(current),init,requestBytes,boundedLookup);
        result.cache=normalizeDeliveryCacheState(response.headers);result.finalPath=current.pathname;
        if(response.status>=300&&response.status<400){
          void response.body?.cancel().catch(()=>undefined);
          const location=response.headers.get('location');
          if(!location)return {...result,reason:'Redirect target was unavailable.'};
          const next=new URL(location,current);
          if(next.origin!==origin.origin||next.username||next.password||next.search||next.hash)return {...result,state:'unsupported',reason:'Redirect left the explicitly authorised origin or representation scope; target not fetched.'};
          parityPath(next.pathname);
          if(++redirects>PARITY_LIMITS.redirects)return {...result,reason:'Redirect limit reached.'};
          current=next;continue;
        }
        if(response.status===404||response.status===410){void response.body?.cancel().catch(()=>undefined);return {...result,state:expected?'missing':'unobserved',reason:'Server returned an explicit not-found response.'};}
        if(response.status!==200){void response.body?.cancel().catch(()=>undefined);return {...result,reason:'Server did not return a complete 200 representation.'};}
        const encoding=response.headers.get('content-encoding')?.trim().toLowerCase();
        if(encoding&&encoding!=='identity'){void response.body?.cancel().catch(()=>undefined);return {...result,state:'unsupported',reason:'Compressed representation was returned despite an identity request; no decompression or equality claim.'};}
        if(!response.body)return {...result,reason:'Response body was unavailable.'};
        const bytes=await readBoundedBody(response.body,requestBytes,response.headers.get('content-length'),PARITY_LIMITS.deadlineMs,signal);
        totalBytes+=bytes.length;chargedBytes-=requestBytes-bytes.length;signal.throwIfAborted();
        result.observedSha256=createHash('sha256').update(bytes).digest('hex');result.observedBytes=bytes.length;
        if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()==='text/html'){
          for(const raw of collectHtmlAssetUrls(bytes.toString('utf8'),current)){
            const url=new URL(raw,current);
            if(url.origin!==origin.origin||url.search||url.hash||discovered.size>=PARITY_LIMITS.assets)continue;
            try{discovered.add(parityPath(url.pathname));}catch{/* Unsupported links are outside the bounded comparison. */}
          }
        }
        return {...result,state:expected?(result.observedSha256===expected.sha256&&bytes.length===expected.size?'matched':'mismatched'):'extra',
          reason:expected?'Compared this observed representation with the selected approved manifest entry.':'A same-origin HTML asset reference outside the selected mapping was fetched; it may be intentionally deployed.'};
      }
    }catch(error){
      // Fixed text only: transport errors can contain private URLs or query data.
      if(error instanceof Error&&error.message==='Compressed responses are not allowed.')return {...result,state:'unsupported',reason:'Compressed representation was refused by the bounded transport.'};
    }
    return {...result,reason:'Transport, cancellation or byte budget prevented a complete observation.'};
  }
  for(const mapping of mappings)assets.push(await observe(mapping,mapping.servedPath));
  const selected=new Set(mappings.map(m=>m.servedPath));
  for(const path of discovered){if(selected.has(path)||assets.length>=PARITY_LIMITS.assets)continue;assets.push(await observe(null,path));}
  return {version:1 as const,startedAt,observedAt:new Date().toISOString(),origin:root.url,assets,requests,totalBytes,chargedBytes,
    unmappedManifestFiles:input.manifest.length-mappings.length,discovery:'Selected HTML script/style/map references on one authorised origin only.' as const,
    scope:'Point-in-time bounded observation. Unmapped files, other origins, dynamic assets and other cache locations are not verified. This is not a release approval.' as const};
}
