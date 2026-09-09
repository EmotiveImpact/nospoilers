import assert from 'node:assert/strict';
import {handleAssuranceRequest,type AssuranceDependencies} from '../src/server/assurance-api.ts';
import {sample,NOW,DIGEST} from './assurance-fixtures.ts';
import {isRecord} from '../src/assurance/evidence.ts';
import {readAssuranceView} from '../src/assurance/view.ts';
async function completed(response: Response) {
  const body: unknown = await response.json();
  assert.ok(isRecord(body) && isRecord(body.view) && isRecord(body.view.assessment));
  const id = body.view.assessment.releaseId;
  assert.ok(typeof id === 'number' || typeof id === 'string');
  const view = readAssuranceView(body.view, id);
  assert.ok(view, 'Completed API responses must satisfy the client evidence contract');
  return { view };
}
export const assuranceApiCases:Array<[string,()=>Promise<void>]>=[];
const add=(name:string,run:()=>Promise<void>)=>assuranceApiCases.push([name,run]);
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const UUID='12345678-1234-1234-1234-123456789abc';
function harness(options:{anonymous?:boolean;foreign?:boolean;revoke?:boolean;pending?:boolean;scopeMismatch?:boolean}={}){
 const calls:string[]=[];let scopes=0,currentReads=0;
 const deps:AssuranceDependencies={
  now:()=>NOW,
  verify:(raw,digest)=>{const value=JSON.parse(raw);return {ok:value.signature==='fixture-signature'&&value.artifactSha256===digest,receipt:value};},
  scopeForRelease:async id=>{scopes++;return {installationId:options.foreign&&id===1?8:7,receiptId:options.scopeMismatch?999:id};},
  read:async request=>{
   assert.equal(request.method,'GET');assert.equal(new URL(request.url).origin,'https://nospoilers.example');
   assert.equal(request.headers.get('cookie'),'session=fixture');
   const path=new URL(request.url).pathname,query=new URL(request.url).search;calls.push(path+query);
   if(options.anonymous)return response({error:'Sign in'},401);
   if(path==='/api/releases/2'){currentReads++;if(options.revoke&&currentReads>1)return response({},404);return response({release:sample(2).release});}
   if(path==='/api/releases/1')return response({release:sample(1).release});
   if(path==='/api/releases')return response({releases:[sample(2).release,sample(1).release]});
   if(path.startsWith('/api/receipts/')){const id=Number(path.split('/').pop());return response({id,receipt:{...sample(id).receipt,signature:'fixture-signature'}});}
   if(path===`/api/uploads/${UUID}`)return response({upload:{id:UUID,status:options.pending?'queued':'done',workspace_id:'ws',artifact_sha256:DIGEST,receipt_json:{...sample().receipt,signature:'fixture-signature'}}});
   if(path===`/api/v1/scans/${UUID}`){assert.equal(request.headers.get('authorization'),'Bearer fixture-token');return response({uploadId:UUID,status:'done',receipt:{...sample().receipt,signature:'fixture-signature'},report:{artifactSha256:DIGEST}});}
   return response({},404);
  },
 };
 const req=(path:string,method='GET')=>new Request(`https://nospoilers.example${path}`,{method,headers:{cookie:'session=fixture',authorization:'Bearer fixture-token'}});
 return {deps,calls,req,scopeCount:()=>scopes};
}
add('API authenticates before accessing privileged scope metadata',async()=>{const h=harness({anonymous:true});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,401);assert.equal(h.scopeCount(),0);assert.equal(h.calls.length,1);});
add('API returns a bound review using only existing authenticated GETs',async()=>{const h=harness();const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,200);const body=await completed(r);assert.equal(body.view.assessment.releaseId,2);assert.equal(body.view.comparison.previousReleaseId,1);assert.equal(body.view.assessment.beforeDeploy,'ready');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.match(r.headers.get('vary')!,/Authorization/);assert.ok(h.calls.every(path=>path.startsWith('/api/')));});
add('API rejects cross-installation comparison despite access to both records',async()=>{const h=harness({foreign:true});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2?compareTo=1'),h.deps);assert.equal(r.status,404);});
add('API notices access revoked while gathering evidence',async()=>{const h=harness({revoke:true});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,404);assert.ok(!(await r.text()).includes('passport'));});
add('API rejects disagreement between release and scope receipt ids',async()=>{const h=harness({scopeMismatch:true});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,404);assert.equal(h.calls.length,1);});
for(const method of ['POST','PUT','DELETE','PATCH'])add(`API does not implement ${method} side effects`,async()=>{const h=harness();const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2',method),h.deps);assert.equal(r.status,405);assert.equal(h.calls.length,0);});
for(const id of ['0','-1','NaN','9007199254740992','1.1','%2F..'])add(`API rejects invalid id ${id}`,async()=>{const h=harness();const r=await handleAssuranceRequest(h.req(`/api/assurance/releases/${id}`),h.deps);assert.equal(r.status,404);assert.equal(h.calls.length,0);});
add('API rejects malformed comparison ids',async()=>{const h=harness();const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2?compareTo=foo'),h.deps);assert.equal(r.status,400);});
add('API degrades unavailable history without fabricating a comparison',async()=>{const h=harness();const read=h.deps.read;h.deps.read=async request=>new URL(request.url).pathname==='/api/releases'?response({},503):read(request);const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,200);const b=await completed(r);assert.equal(b.view.comparison.available,false);assert.equal(b.view.comparison.counts,null);});
add('API handles uploaded records without inventing numeric release ids',async()=>{const h=harness();const r=await handleAssuranceRequest(h.req(`/api/assurance/uploads/${UUID}`),h.deps);assert.equal(r.status,200);const b=await completed(r);assert.equal(b.view.assessment.releaseId,UUID);assert.equal(b.view.assessment.receiptId,null);assert.equal(b.view.comparison.available,false);});
add('API uses the existing bearer-token result route for agent reads',async()=>{const h=harness();const r=await handleAssuranceRequest(h.req(`/api/assurance/scans/${UUID}`),h.deps);assert.equal(r.status,200);assert.equal((await completed(r)).view.source,'token-scan');assert.equal(h.scopeCount(),0);assert.ok(h.calls.every(path=>path.startsWith('/api/v1/scans/')));});
add('API refuses upload comparison inferred from filenames',async()=>{const h=harness();const r=await handleAssuranceRequest(h.req(`/api/assurance/uploads/${UUID}?compareTo=${UUID}`),h.deps);assert.equal(r.status,400);});
add('API pending scan does not produce a passport or invented result',async()=>{const h=harness({pending:true});const r=await handleAssuranceRequest(h.req(`/api/assurance/uploads/${UUID}`),h.deps);assert.equal(r.status,202);const b:unknown=await r.json();assert.ok(isRecord(b));assert.equal(b.pending,true);assert.equal(b.view,undefined);});
add('API invalid signature cannot become a ready assessment',async()=>{const h=harness();h.deps.verify=()=>({ok:false});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,200);assert.equal((await completed(r)).view.assessment.beforeDeploy,'unknown');});
add('API malformed source JSON fails without publishing a result',async()=>{const h=harness();h.deps.read=()=>new Response('{',{status:200});const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,502);assert.equal(h.scopeCount(),0);});
add('API bounds saved JSON record reads',async()=>{const h=harness();h.deps.read=()=>new Response('x'.repeat(8*1024*1024+1));const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.equal(r.status,413);});
add('API rejects an already aborted review',async()=>{const h=harness();const controller=new AbortController();controller.abort();const request=new Request(h.req('/api/assurance/releases/2'),{signal:controller.signal});const r=await handleAssuranceRequest(request,h.deps);assert.equal(r.status,503);});

add('API cancellation interrupts a stalled internal read',async()=>{const h=harness();h.deps.read=()=>new Promise<Response>(()=>{});const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5);try{const r=await handleAssuranceRequest(new Request(h.req('/api/assurance/releases/2'),{signal:controller.signal}),h.deps);assert.equal(r.status,503);}finally{clearTimeout(timer);}});
add('API cancellation interrupts a stalled scope read',async()=>{const h=harness();h.deps.scopeForRelease=()=>new Promise(()=>{});const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5);try{const r=await handleAssuranceRequest(new Request(h.req('/api/assurance/releases/2'),{signal:controller.signal}),h.deps);assert.equal(r.status,503);}finally{clearTimeout(timer);}});
add('API distinguishes unreadable history from first-release history',async()=>{const h=harness();const read=h.deps.read;h.deps.read=request=>new URL(request.url).pathname==='/api/releases'?response({},503):read(request);const r=await handleAssuranceRequest(h.req('/api/assurance/releases/2'),h.deps);assert.match((await completed(r)).view.comparison.reason,/could not be read/);});
