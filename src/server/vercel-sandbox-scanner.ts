import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {Sandbox} from '@vercel/sandbox';

const MAX_INPUT_BYTES=80*1024*1024;
const MAX_INPUT_ENTRIES=25_001;
const MAX_REPORT_BYTES=32*1024*1024;
const UPLOAD_BATCH_BYTES=8*1024*1024;
const UPLOAD_BATCH_FILES=128;
const SANDBOX_SESSION_MS=135_000;
const SCANNER_COMMAND_MS=105_000;
const SANDBOX_INPUT_ROOT='/vercel/sandbox/nospoilers-input';
const SANDBOX_REPORT='/tmp/nospoilers-report.json';

// The Sandbox API accepts either a repository in the authenticated project or
// the full VCR team/project/repository path. Do not accept another registry or
// a movable tag: the worker must boot the exact reviewed scanner image.
const immutableVcrImage=/^(?:[a-z0-9][a-z0-9._-]*|vcr\.vercel\.com\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)@sha256:[a-f0-9]{64}$/;

export type VercelSandboxCreateOptions={
 token:string;
 teamId:string;
 projectId:string;
 image:string;
 resources:{vcpus:1};
 timeout:number;
 networkPolicy:'deny-all';
 persistent:false;
 env:{NODE_ENV:'production';LANG:'C.UTF-8'};
};

type SandboxUpload={path:string;content:Buffer;mode:0o444};

export type VercelScannerSandbox={
 assertScannerIdentity(signal:AbortSignal):Promise<void>;
 mkdir(path:string,signal:AbortSignal):Promise<void>;
 writeFiles(files:SandboxUpload[],signal:AbortSignal):Promise<void>;
 chmod(path:string,mode:number,signal:AbortSignal):Promise<void>;
 sealInput(path:string,signal:AbortSignal):Promise<void>;
 runScanner(inputPath:string,reportPath:string,signal:AbortSignal):Promise<{exitCode:number}>;
 statSize(path:string,signal:AbortSignal):Promise<number>;
 readFile(path:string,signal:AbortSignal):Promise<Buffer|null>;
 stop(signal:AbortSignal):Promise<void>;
};

export type VercelSandboxFactory=(options:VercelSandboxCreateOptions,signal:AbortSignal)=>Promise<VercelScannerSandbox>;

function value(env:NodeJS.ProcessEnv,name:string):string {
 return env[name]?.trim()??'';
}

export function vercelSandboxConfigurationProblems(env:NodeJS.ProcessEnv=process.env):string[] {
 const problems:string[]=[];
 if(!immutableVcrImage.test(value(env,'NOSPOILERS_SCANNER_IMAGE')))
  problems.push('NOSPOILERS_SCANNER_IMAGE must be a digest-pinned Vercel Container Registry image reference.');
 if(!value(env,'VERCEL_TOKEN'))problems.push('VERCEL_TOKEN is required for the Railway worker to create Vercel sandboxes.');
 if(!value(env,'VERCEL_TEAM_ID'))problems.push('VERCEL_TEAM_ID is required for the Vercel Sandbox project scope.');
 if(!value(env,'VERCEL_PROJECT_ID'))problems.push('VERCEL_PROJECT_ID is required for the Vercel Sandbox project scope.');
 return problems;
}

export function vercelSandboxCreateOptions(env:NodeJS.ProcessEnv=process.env):VercelSandboxCreateOptions {
 const problems=vercelSandboxConfigurationProblems(env);
 if(problems.length)throw new Error(`Vercel Sandbox scanner configuration failed:\n- ${problems.join('\n- ')}`);
 return {
  token:value(env,'VERCEL_TOKEN'),teamId:value(env,'VERCEL_TEAM_ID'),projectId:value(env,'VERCEL_PROJECT_ID'),
  image:value(env,'NOSPOILERS_SCANNER_IMAGE'),resources:{vcpus:1},timeout:SANDBOX_SESSION_MS,
  networkPolicy:'deny-all',persistent:false,env:{NODE_ENV:'production',LANG:'C.UTF-8'},
 };
}

async function createVercelScannerSandbox(options:VercelSandboxCreateOptions,signal:AbortSignal):Promise<VercelScannerSandbox> {
 const sandbox=await Sandbox.create({...options,signal});
 return {
  assertScannerIdentity:async requestSignal=>{
   const identity=await sandbox.runCommand('/usr/bin/id',['-u'],{signal:requestSignal,timeoutMs:5_000});
   if(identity.exitCode!==0||(await identity.stdout({signal:requestSignal})).trim()!=='65532')
    throw new Error('The Vercel Sandbox scanner image must run as uid 65532.');
  },
  mkdir:async(target,requestSignal)=>{await sandbox.fs.mkdir(target,{recursive:true,signal:requestSignal});},
  writeFiles:async(files,requestSignal)=>{await sandbox.writeFiles(files,{signal:requestSignal});},
  chmod:async(target,mode,requestSignal)=>{await sandbox.fs.chmod(target,mode,{signal:requestSignal});},
  sealInput:async(target,requestSignal)=>{
   const sealed=await sandbox.runCommand({cmd:'/usr/bin/chown',args:['-R','root:root',target],sudo:true,signal:requestSignal,timeoutMs:10_000});
   if(sealed.exitCode!==0)throw new Error('Vercel Sandbox could not seal the scanner input.');
  },
  runScanner:async(inputPath,reportPath,requestSignal)=>sandbox.runCommand('/usr/bin/timeout',[
    '--signal=KILL','100s','/usr/local/bin/node','--max-old-space-size=512','/parser/scanner-child.mjs',inputPath,reportPath,
  ],{signal:requestSignal,timeoutMs:SCANNER_COMMAND_MS}),
  statSize:async(target,requestSignal)=>(await sandbox.fs.stat(target,{signal:requestSignal})).size,
  readFile:(target,requestSignal)=>sandbox.readFileToBuffer({path:target},{signal:requestSignal}),
  stop:async(requestSignal)=>{await sandbox.stop({signal:requestSignal});},
 };
}

async function uploadInput(localInput:string,remoteInput:string,sandbox:VercelScannerSandbox,signal:AbortSignal):Promise<void> {
 const directories:string[]=[];
 const files:{localPath:string;remotePath:string;size:number}[]=[];
 let totalBytes=0,totalEntries=0;
 const visit=async(localTarget:string,remoteTarget:string):Promise<void>=>{
  const info=await lstat(localTarget);
  if(info.isSymbolicLink()||(!info.isFile()&&!info.isDirectory()))throw new Error('Unsupported parser input.');
  totalEntries++;
  if(totalEntries>MAX_INPUT_ENTRIES)throw new Error('Parser input exceeded staging budget.');
  if(info.isDirectory()){
   directories.push(remoteTarget);
   for(const child of await readdir(localTarget))await visit(path.join(localTarget,child),path.posix.join(remoteTarget,child));
   return;
  }
  totalBytes+=info.size;
  if(totalBytes>MAX_INPUT_BYTES)throw new Error('Parser input exceeded staging budget.');
  files.push({localPath:localTarget,remotePath:remoteTarget,size:info.size});
 };
 await visit(localInput,remoteInput);

 await sandbox.mkdir(SANDBOX_INPUT_ROOT,signal);
 // Vercel's file upload API does not contractually create parent directories.
 // Create the full tree before sending any untrusted bytes.
 for(const directory of directories.sort((a,b)=>a.length-b.length))await sandbox.mkdir(directory,signal);

 let batch:SandboxUpload[]=[];
 let batchBytes=0;
 const flush=async()=>{
  if(!batch.length)return;
  const current=batch;batch=[];batchBytes=0;
  await sandbox.writeFiles(current,signal);
 };
 for(const file of files){
  if(batch.length&&(batch.length>=UPLOAD_BATCH_FILES||batchBytes+file.size>UPLOAD_BATCH_BYTES))await flush();
  const content=await readFile(file.localPath);
  if(content.length!==file.size)throw new Error('Parser input changed during staging.');
  batch.push({path:file.remotePath,content,mode:0o444});batchBytes+=content.length;
 }
 await flush();
 // Lock the uploaded tree after the control plane has populated it. Files are
 // already 0444; applying directory modes deepest-first prevents later writes.
 for(const directory of directories.sort((a,b)=>b.length-a.length))await sandbox.chmod(directory,0o555,signal);
 await sandbox.chmod(SANDBOX_INPUT_ROOT,0o555,signal);
 // Transfer ownership after upload so a compromised non-root parser cannot
 // re-enable writes to its input merely by changing the permission bits.
 await sandbox.sealInput(SANDBOX_INPUT_ROOT,signal);
}

export async function runVercelSandboxScanner(localInput:string,options:{
 env?:NodeJS.ProcessEnv;
 factory?:VercelSandboxFactory;
}={}):Promise<string> {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),SANDBOX_SESSION_MS);
 let sandbox:VercelScannerSandbox|undefined;
 let result:string|undefined;
 let operationFailed=false,operationError:unknown;
 try {
  const createOptions=vercelSandboxCreateOptions(options.env);
  sandbox=await (options.factory??createVercelScannerSandbox)(createOptions,controller.signal);
  await sandbox.assertScannerIdentity(controller.signal);
  const remoteInput=path.posix.join(SANDBOX_INPUT_ROOT,path.basename(localInput));
  await uploadInput(localInput,remoteInput,sandbox,controller.signal);
  const command=await sandbox.runScanner(remoteInput,SANDBOX_REPORT,controller.signal);
  if(command.exitCode!==0)throw new Error('Isolated scanner failed.');
  const reportBytes=await sandbox.statSize(SANDBOX_REPORT,controller.signal);
  if(reportBytes<=0||reportBytes>MAX_REPORT_BYTES)throw new Error('Scanner report exceeded its output budget.');
  const report=await sandbox.readFile(SANDBOX_REPORT,controller.signal);
  if(!report||report.length!==reportBytes||report.length>MAX_REPORT_BYTES)throw new Error('Invalid scanner report.');
  result=report.toString('utf8');
 } catch(error) {
  operationFailed=true;
  operationError=error;
 } finally {
  clearTimeout(timer);
 }
 let cleanupError:unknown;
 if(sandbox){
  const cleanup=AbortSignal.timeout(10_000);
  try {await sandbox.stop(cleanup);}
  catch(error){cleanupError=error;}
 }
 if(operationFailed)throw operationError;
 if(cleanupError)throw new Error('Vercel Sandbox scanner cleanup failed.',{cause:cleanupError});
 if(result===undefined)throw new Error('Invalid scanner report.');
 return result;
}
