import {afterEach,describe,expect,it} from 'vitest';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLogNotifier} from '../src/server/notifier.ts';
import {
 createScanInterrupter,isScanInterruption,ScanInterruptedError,
} from '../src/server/scan-interruption.ts';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore,type Store} from '../src/server/store.ts';
import {
 runVercelSandboxScanner,type VercelScannerSandbox,type VercelSandboxFactory,
} from '../src/server/vercel-sandbox-scanner.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {createWorker} from '../src/server/worker.ts';
import {createWorkspace,listUserWorkspaces} from '../src/server/workspaces.ts';

const temporaryPaths:string[]=[];
const env:NodeJS.ProcessEnv={
 NOSPOILERS_SCANNER_IMAGE:`nospoilers-scanner@sha256:${'a'.repeat(64)}`,VERCEL_TOKEN:'control-plane-secret',
 VERCEL_TEAM_ID:'team-id',VERCEL_PROJECT_ID:'project-id',
};

afterEach(async()=>{
 await Promise.all(temporaryPaths.splice(0).map(target=>rm(target,{recursive:true,force:true})));
});

async function temporaryInput():Promise<string> {
 const root=await mkdtemp(path.join(tmpdir(),'nospoilers-interrupt-test-'));
 temporaryPaths.push(root);
 const input=path.join(root,'input');
 await mkdir(input,{recursive:true});
 await writeFile(path.join(input,'root.txt'),'root');
 return input;
}

/** A sandbox whose scanner runs until its signal aborts, like a long parse. */
function hangingSandbox(options:{stopError?:Error}={}) {
 const state={created:0,stops:0,stopSignalAborted:undefined as boolean|undefined};
 let running!:()=>void;
 const started=new Promise<void>(resolve=>{running=resolve;});
 const sandbox:VercelScannerSandbox={
  assertScannerIdentity:async()=>undefined,mkdir:async()=>undefined,writeFiles:async()=>undefined,
  chmod:async()=>undefined,sealInput:async()=>undefined,
  runScanner:(_input,_report,signal)=>new Promise((_resolve,reject)=>{
   running();
   signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  }),
  statSize:async()=>2,readFile:async()=>Buffer.from('{}'),
  stop:async signal=>{state.stops++;state.stopSignalAborted=signal.aborted;if(options.stopError)throw options.stopError;},
 };
 const factory:VercelSandboxFactory=async()=>{state.created++;return sandbox;};
 return {state,factory,started};
}

describe('scan interruption',()=>{
 it('recognises an interruption through wrapped causes only',()=>{
  expect(isScanInterruption(new ScanInterruptedError())).toBe(true);
  expect(isScanInterruption(new Error('wrapped',{cause:new ScanInterruptedError()}))).toBe(true);
  expect(isScanInterruption(new Error('Isolated scanner failed.'))).toBe(false);
  expect(isScanInterruption(new DOMException('aborted','AbortError'))).toBe(false);
  expect(isScanInterruption(undefined)).toBe(false);
 });

 it('aborts an in-flight sandbox scan, stops the VM with a fresh signal and reports an interruption',async()=>{
  const interrupter=createScanInterrupter();
  const {state,factory,started}=hangingSandbox();
  const scanning=runVercelSandboxScanner(await temporaryInput(),{env,factory,interrupter});
  await started;
  expect(interrupter.interrupt()).toBe(1);
  await expect(scanning).rejects.toBeInstanceOf(ScanInterruptedError);
  expect(state.stops).toBe(1);
  expect(state.stopSignalAborted).toBe(false);
 });

 it('still reports an interruption when the stop request fails, keeping the cause',async()=>{
  const interrupter=createScanInterrupter();
  const {state,factory,started}=hangingSandbox({stopError:new Error('provider unavailable')});
  const scanning=runVercelSandboxScanner(await temporaryInput(),{env,factory,interrupter});
  await started;
  interrupter.interrupt();
  const error=await scanning.catch(caught=>caught);
  expect(error).toBeInstanceOf(ScanInterruptedError);
  expect((error as Error).cause).toMatchObject({message:'provider unavailable'});
  expect(state.stops).toBe(1);
 });

 it('refuses to create a sandbox once shutdown has begun',async()=>{
  const interrupter=createScanInterrupter();
  interrupter.interrupt();
  const {state,factory}=hangingSandbox();
  await expect(runVercelSandboxScanner(await temporaryInput(),{env,factory,interrupter}))
   .rejects.toBeInstanceOf(ScanInterruptedError);
  expect(state.created).toBe(0);
 });

 it('does not abort a scan that finished before shutdown',async()=>{
  const interrupter=createScanInterrupter();
  const {factory}=hangingSandbox();
  const finished:VercelSandboxFactory=async(options,signal)=>{
   const sandbox=await factory(options,signal);
   return {...sandbox,runScanner:async()=>({exitCode:0})};
  };
  await expect(runVercelSandboxScanner(await temporaryInput(),{env,factory:finished,interrupter})).resolves.toBe('{}');
  expect(interrupter.interrupt()).toBe(0);
 });
});

describe('worker handling of interrupted scans',()=>{
 async function withStore(run:(store:Store)=>Promise<void>):Promise<void> {
  const sql=await openSql('pglite://:memory:');
  try {
   await migrate(sql);
   await run(createStore(sql,{jobMaxAttempts:3,jobRetryBaseMs:60_000}));
  } finally {
   await sql.close();
  }
 }

 async function runOnce(store:Store,failure:Error):Promise<{status:string;attempts:number;locked_by:string|null;error:string|null;due:boolean}> {
  const {id}=await store.enqueueJob({priority:'light',kind:'interruption_probe',payload:{}});
  const worker=createWorker({
   store,github:{} as never,notifier:createLogNotifier(store),heavyConcurrency:0,lightConcurrency:1,
   maxAssetBytes:1000,intervalMs:60_000,onJob:async()=>{throw failure;},
  });
  // tick claims and launches; stop drains it and prevents a reclaim of a requeued job.
  await worker.tick();
  await worker.stop();
  const {rows}=await store.sql.query<{status:string;attempts:number;locked_by:string|null;error:string|null;due:boolean}>(
   'SELECT status,attempts::int AS attempts,locked_by,error,run_after<=now() AS due FROM jobs WHERE id=$1',[id]);
  return rows[0]!;
 }

 it('requeues an interrupted job immediately without spending an attempt',async()=>{
  await withStore(async store=>{
   const job=await runOnce(store,new Error('handler wrapped it',{cause:new ScanInterruptedError()}));
   expect(job).toEqual({status:'queued',attempts:0,locked_by:null,error:'worker interrupted; requeued',due:true});
  });
 });

 it('keeps ordinary failures on the normal retry path',async()=>{
  await withStore(async store=>{
   const job=await runOnce(store,new Error('Isolated scanner failed.'));
   expect(job).toMatchObject({status:'queued',attempts:1,locked_by:null,error:'Isolated scanner failed.',due:false});
  });
 });

 it('leaves an interrupted upload resumable and retries it to completion',async()=>{
  await withStore(async store=>{
   await store.upsertUser({id:'owner',login:'owner'});
   await store.upsertInstallation({id:81,accountId:81,accountLogin:'org',accountType:'Organization'});
   await store.linkUserInstallation(81,'owner');
   const original=(await listUserWorkspaces(store.sql,'owner')).find(w=>Number(w.installation_id)===81)!;
   const workspace=await createWorkspace(store.sql,'owner',original.organization_id,'Artifacts');
   const id=crypto.randomUUID();
   await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:workspace.id,target:'x.zip',bytes:new Uint8Array([1])});
   await expect(processUploadedScan(id,store,async()=>{throw new ScanInterruptedError();},'test-secret'))
    .rejects.toBeInstanceOf(ScanInterruptedError);
   const interrupted=(await store.sql.query<{status:string;has_bytes:boolean;usage_refunded:boolean}>(
    'SELECT status,artifact_bytes IS NOT NULL AS has_bytes,usage_refunded FROM uploaded_scans WHERE id=$1',[id])).rows[0];
   expect(interrupted).toEqual({status:'running',has_bytes:true,usage_refunded:false});
   await processUploadedScan(id,store,async()=>({target:'x.zip',kind:'zip',fileCount:1,findings:[],ok:true,status:'passed',
    scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,
    artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null}),'test-secret');
   expect((await store.getUploadedScan('owner',id))?.status).toBe('done');
  });
 });
});
