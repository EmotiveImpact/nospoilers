import {Hono} from 'hono';
import {verifyReceipt} from '../receipt.ts';
import {handleAssuranceRequest} from './assurance-api.ts';
import type {AssuranceDependencies} from './assurance-api.ts';

/** Compose before the existing application's SPA catch-all. Original routes stay untouched. */
export function withReleaseAssurance(
  core:{fetch:(request:Request)=>Response|Promise<Response>},
  options:{receiptSecret:string;scopeForRelease:AssuranceDependencies['scopeForRelease']},
){
  const app=new Hono();
  app.all('/api/assurance/*',c=>handleAssuranceRequest(c.req.raw,{
    read:request=>core.fetch(request),
    scopeForRelease:options.scopeForRelease,
    verify:(raw,digest)=>options.receiptSecret.trim()?verifyReceipt(raw,options.receiptSecret,digest):{ok:false},
  }));
  app.all('*',c=>core.fetch(c.req.raw));
  return app;
}
