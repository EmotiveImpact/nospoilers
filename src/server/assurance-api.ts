import {buildAssuranceView} from '../assurance/index.ts';
import {eligiblePredecessors,isCount,isDigest,isRecord,readReceipt} from '../assurance/evidence.ts';
import type {AssuranceView,EvidenceSnapshot,ReleaseEvidence} from '../assurance/types.ts';

export type AssuranceDependencies={
  /** Must call the existing application handler, not external HTTP or this handler recursively. */
  read:(request:Request)=>Response|Promise<Response>;
  /** Read only AFTER the original endpoint has authorised access. */
  scopeForRelease:(id:number)=>Promise<{installationId:number;receiptId:number}|null>;
  verify:(raw:string,expectedSha256:string)=>{ok:boolean;receipt?:unknown};
  now?:()=>number;
};
const MAX_JSON_BYTES=8*1024*1024;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const positive=(value:unknown):value is number=>isCount(value)&&value>0;
class ReadError extends Error {readonly status:number;constructor(status:number,message:string){super(message);this.status=status;}}
function json(body:unknown,status=200):Response{
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Cookie, Authorization','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','x-frame-options':'DENY'}});
}
async function boundedJson(response:Response,signal:AbortSignal):Promise<Record<string,unknown>>{
  if(!response.body)throw new ReadError(502,'The saved evidence response was empty.');
  const reader=response.body.getReader();let bytes=0;const chunks:Uint8Array[]=[];
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  try{
    for(;;){if(signal.aborted)throw new ReadError(503,'Evidence review was interrupted.');const result=await reader.read();if(result.done)break;bytes+=result.value.byteLength;if(bytes>MAX_JSON_BYTES){await reader.cancel();throw new ReadError(413,'This saved record exceeds the bounded assurance-review limit. Use the existing evidence view.');}chunks.push(result.value);}
    if(signal.aborted)throw new ReadError(503,'Evidence review was interrupted.');
    const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
    const value:unknown=JSON.parse(new TextDecoder().decode(joined));
    if(!isRecord(value))throw new ReadError(502,'The saved evidence response was incomplete.');
    return value;
  }catch(error){if(error instanceof ReadError)throw error;throw new ReadError(502,'Could not read the saved evidence response.');}
  finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
/** Stop waiting on a revoked/aborted review, including an unresponsive internal read. */
async function interruptible<T>(work:()=>T|Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted)throw new ReadError(503,'Evidence review was interrupted.');
  let abort:()=>void=()=>{};
  const interrupted=new Promise<never>((_,reject)=>{abort=()=>reject(new ReadError(503,'Evidence review was interrupted.'));signal.addEventListener('abort',abort,{once:true});});
  try{return await Promise.race([Promise.resolve().then(work),interrupted]);}
  finally{signal.removeEventListener('abort',abort);}
}
function releaseValue(value:unknown,id:number):ReleaseEvidence{
  if(!isRecord(value)||value.id!==id||!positive(value.receiptId)||typeof value.coordinate!=='string'||!isDigest(value.artifactSha256)||typeof value.channel!=='string'||typeof value.createdAt!=='string'||typeof value.mismatch!=='boolean')throw new ReadError(502,'Release identity was incomplete.');
  if(value.locations!==undefined&&(!Array.isArray(value.locations)||value.locations.length>100))throw new ReadError(502,'Delivery evidence was incomplete.');
  return value as unknown as ReleaseEvidence;
}
/** Stateless, read-only evidence API. No new authorisation model, fetcher, queue, mailer or parser. */
export async function handleAssuranceRequest(request:Request,deps:AssuranceDependencies):Promise<Response>{
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET','cache-control':'no-store'}});
  const url=new URL(request.url),match=/^\/api\/assurance\/(releases|uploads|scans)\/([^/]+)$/.exec(url.pathname);
  if(!match)return json({error:'Unknown assurance resource.'},404);
  const [,kind,rawId]=match;
  const now=deps.now?.()??Date.now();
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]);
  const read=async(path:string)=>{
    const headers=new Headers();for(const name of ['cookie','authorization']){const value=request.headers.get(name);if(value)headers.set(name,value);}
    headers.set('accept','application/json');
    const response=await interruptible(()=>deps.read(new Request(new URL(path,url.origin),{headers,signal})),signal);
    if(!response.ok)throw new ReadError([401,402,403,404,409,413,429,503].includes(response.status)?response.status:502,'The requested evidence is unavailable to this session.');
    return boundedJson(response,signal);
  };
  const verify=(value:unknown,expected:string)=>{
    if(!isRecord(value))return {receipt:null,signature:'unavailable' as const};
    try{const result=deps.verify(JSON.stringify(value),expected);return {receipt:result.ok?readReceipt(result.receipt??value):null,signature:result.ok?'verified' as const:'invalid' as const};}
    catch{return {receipt:null,signature:'invalid' as const};}
  };
  const load=async(id:number):Promise<EvidenceSnapshot>=>{
    const body=await read(`/api/releases/${id}`); // Authorisation must precede metadata access.
    const release=releaseValue(body.release,id);
    const scope=await interruptible(()=>deps.scopeForRelease(id),signal);
    if(!scope||!positive(scope.installationId)||scope.receiptId!==release.receiptId)throw new ReadError(404,'The requested evidence is unavailable.');
    const stored=await read(`/api/receipts/${release.receiptId}`);
    return {scopeKey:`installation:${scope.installationId}`,release,...verify(stored.receipt,release.artifactSha256)};
  };
  try{
    if(kind==='releases'){
      if(!/^\d+$/.test(rawId)||!positive(Number(rawId)))return json({error:'Unknown release.'},404);
      const current=await load(Number(rawId));let previous:EvidenceSnapshot|null=null;let historyUnavailable=false;
      const compareTo=url.searchParams.get('compareTo');
      if(compareTo!==null){
        if(!/^\d+$/.test(compareTo)||!positive(Number(compareTo)))return json({error:'Invalid comparison release.'},400);
        previous=await load(Number(compareTo));
        if(previous.scopeKey!==current.scopeKey)return json({error:'Comparison unavailable in this scope.'},404);
      }else{
        // One bounded history page, at most three candidate receipt reads. Never claim complete history.
        try{
          const installation=current.scopeKey.slice('installation:'.length);
          const history=await read(`/api/releases?installationId=${installation}`);
          if(Array.isArray(history.releases)){
            const rows=history.releases.slice(0,250).flatMap(value=>{try{return isRecord(value)&&positive(value.id)?[releaseValue(value,value.id)]:[];}catch{return [];}});
            for(const candidate of eligiblePredecessors(current.release,rows).slice(0,3)){
              const found=await load(Number(candidate.id));
              if(found.scopeKey===current.scopeKey&&found.signature==='verified'&&found.receipt?.status==='passed'&&!found.receipt.suppressedCount){previous=found;break;}
            }
          }
        }catch(error){if(error instanceof ReadError&&[401,403,404].includes(error.status))throw error;historyUnavailable=true;}
      }
      // Re-authorise after gathering evidence, so revocation during the read is not ignored.
      await read(`/api/releases/${Number(rawId)}`);
      if(previous)await read(`/api/releases/${previous.release.id}`);
      const view=buildAssuranceView(current,previous,now);
      if(historyUnavailable&&!view.comparison.available)view.comparison.reason='Historical evidence could not be read. No claim about the existence of earlier releases is made.';
      view.assessment.limitations.push('Automatic comparison considers one bounded history page and up to three candidate references; it is not a complete historical audit.');
      return json({view});
    }
    if(!UUID.test(rawId))return json({error:'Unknown scan record.'},404);
    if(url.searchParams.has('compareTo'))return json({error:'Uploads need an explicitly linked stable source before automatic comparison. A matching filename is insufficient.'},400);
    const path=kind==='scans'?`/api/v1/scans/${rawId}`:`/api/uploads/${rawId}`;
    const body=await read(path),upload=kind==='scans'?body:body.upload;
    if(!isRecord(upload))throw new ReadError(502,'The scan response was incomplete.');
    const returnedId=kind==='scans'?upload.uploadId:upload.id;
    if(returnedId!==rawId)throw new ReadError(502,'The scan identity did not match.');
    if(['queued','running'].includes(String(upload.status)))return json({pending:true,status:upload.status,message:'The scan has not produced completed evidence.'},202);
    const rawReceipt=kind==='scans'?upload.receipt:upload.receipt_json;
    const expected=kind==='scans'?(isRecord(upload.report)?upload.report.artifactSha256:null):upload.artifact_sha256;
    if(upload.status!=='done'||!isDigest(expected)||!isRecord(rawReceipt))return json({error:'A completed signed scan record is not available.'},409);
    const result=verify(rawReceipt,expected),receipt=result.receipt;
    if(!receipt)return json({error:'The signed scan record could not be verified or was incomplete.'},409);
    const receiptId=positive(upload.receiptId)?upload.receiptId:positive(upload.receipt_id)?upload.receipt_id:null;
    const release:ReleaseEvidence={id:rawId,receiptId,coordinate:receipt.coordinate,channel:receipt.channel??'unspecified',artifactSha256:expected,artifactBytes:receipt.artifactBytes,mediaType:null,createdAt:receipt.scannedAt,receiptStatus:receipt.status,mismatch:false};
    const scopeKey=kind==='scans'?`token-scan:${rawId}`:typeof upload.workspace_id==='string'?`workspace:${upload.workspace_id}`:`upload:${rawId}`;
    const source:AssuranceView['source']=kind==='scans'?'token-scan':upload.source_origin_id!=null?'website-scan':'uploaded-scan';
    await read(path);
    const view=buildAssuranceView({scopeKey,release,...result},null,now,source);
    if(source==='website-scan')view.assessment.limitations.push('This is a bounded website observation, not a pre-deployment build gate or a proof of exhaustive site coverage.');
    return json({view});
  }catch(error){return json({error:error instanceof ReadError?error.message:'Evidence review could not be completed.'},error instanceof ReadError?error.status:503);}
}
