import {randomUUID} from 'node:crypto';
import {readBoundedBody} from './server/bounded-body.ts';
/** Explicit CI preflight. The existing scan command and its exit semantics are untouched. */
export async function runGate(input:{api:string;token:string;stream:string;upload:string;digest:string;deployment:string;decision?:string},transport:typeof fetch=fetch){
  const origin=new URL(input.api);
  if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw new Error('Gate API requires an HTTPS origin (or loopback development).');
  if(!input.token.trim())throw new Error('Set NOSPOILERS_TOKEN to a workspace scan token.');
  if(!/^[a-f0-9-]{36}$/i.test(input.stream)||!/^[a-f0-9-]{36}$/i.test(input.upload)||!/^[a-f0-9]{64}$/.test(input.digest))throw new Error('Supply stream/upload IDs and the exact lowercase SHA-256 digest.');
  const endpoint=new URL(`/api/release-intelligence/streams/${input.stream}/gate`,origin),signal=AbortSignal.timeout(30000);
  const request=async(body?:object)=>{
    const response=await transport(endpoint,{signal,redirect:'error',headers:{authorization:`Bearer ${input.token}`,...(body?{'content-type':'application/json'}:{})},method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{})});
    const bytes=await readBoundedBody(response.body,1_000_000,response.headers.get('content-length'),30000,signal);
    const data=JSON.parse(bytes.toString('utf8'));
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Gate request failed. Do not deploy on this error.');
    return data;
  };
  const view=await request(),revision=view.policy?.revision;
  if(!Number.isSafeInteger(revision)||revision<0)throw new Error('Gate policy response was incomplete.');
  const decision=input.decision?{id:input.decision}:await request({action:'evaluate',requestKey:randomUUID(),expectedPolicyRevision:revision,record:{kind:'upload',id:input.upload},digest:input.digest,deploymentId:input.deployment});
  if(typeof decision.id!=='string')throw new Error('Gate decision response was incomplete.');
  const result=await request({action:'consume',decisionId:decision.id,record:{kind:'upload',id:input.upload},expectedPolicyRevision:revision,digest:input.digest,deploymentId:input.deployment});
  if(result.decisionId!==decision.id||result.digest!==input.digest||result.deploymentId!==input.deployment||result.policyRevision!==revision||result.mode!==view.policy.mode||!['ready','review','blocked','unknown'].includes(result.readiness)||!['advisory','warn','enforce'].includes(result.mode))throw new Error('Gate result binding was incomplete.');
  const permit=result.mode==='enforce'?(result.outcome==='allowed'&&result.readiness==='ready'||result.outcome==='override'&&['review','blocked'].includes(result.readiness)):result.outcome==='not_enforced';
  if(result.proceed!==permit)throw new Error('Gate result was inconsistent.');
  return {result,exitCode:permit?0:2};
}
