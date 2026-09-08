import { request } from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { isBlockedResolvedAddress, lookupWebhookHost, type WebhookHostLookup } from './siem.ts';

/** No pooled sockets, redirects or second DNS lookup. TLS still verifies the original hostname. */
export async function pinnedHttps(rawUrl:string, init:RequestInit={}, maxBytes=2_000_000,
  lookup:WebhookHostLookup=lookupWebhookHost):Promise<Response> {
  const url=new URL(rawUrl);
  if(url.protocol!=='https:' || url.username || url.password)throw new Error('Only credential-free HTTPS destinations are allowed.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  let dnsTimer:ReturnType<typeof setTimeout>;
  const records=await Promise.race([
    isIP(host)?Promise.resolve([{address:host,family:isIP(host)}]):lookup(host),
    new Promise<never>((_,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('DNS resolution timed out.')),10_000);}),
  ]).finally(()=>clearTimeout(dnsTimer!));
  if(!records.length || records.some(r=>isBlockedResolvedAddress(r.address,r.family)))throw new Error('Destination is not a public address.');
  const chosen=records[0];
  const fixedLookup:LookupFunction=(_host,options,callback)=>{
    if(options.all)callback(null,[chosen]);
    else callback(null,chosen.address,chosen.family);
  };
  const signal=AbortSignal.any([AbortSignal.timeout(15_000),...(init.signal?[init.signal]:[])]);
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const headers=Object.fromEntries(new Headers(init.headers));
    // No compressed body amplification. Caller parses the bounded identity representation.
    headers['accept-encoding']='identity';
    const req=request(url,{method:init.method??'GET',headers,lookup:fixedLookup,agent:false,
      rejectUnauthorized:true,signal},res=>{
      const status=res.statusCode??502;
      if(status>=300 && status<400){
        res.destroy();
        if(init.redirect==='manual')resolve(new Response(null,{status,headers:{location:String(res.headers.location??'')}}));
        else reject(new Error('Redirects are not allowed.'));
        return;
      }
      if(res.headers['content-encoding'] && res.headers['content-encoding']!=='identity'){
        res.destroy();reject(new Error('Compressed responses are not allowed.'));return;
      }
      if(Number(res.headers['content-length'])>maxBytes){res.destroy();reject(new Error('Response exceeds byte limit.'));return;}
      let size=0;const chunks:Buffer[]=[];
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){res.destroy(new Error('Response exceeds byte limit.'));return;}chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>{
        const out=new Headers();for(const [key,value] of Object.entries(res.headers))if(value!==undefined)out.set(key,Array.isArray(value)?value.join(', '):value);
        resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks,size),{status,headers:out}));
      });
    });
    req.on('error',reject);
    if(init.body && typeof init.body!=='string'){req.destroy();reject(new Error('Unsupported request body.'));return;}
    req.end(init.body??undefined);
  });
}
