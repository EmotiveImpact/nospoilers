import { spawn } from 'node:child_process';
import { realpath, mkdtemp, cp, chmod, readdir, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import type { ScanReport } from '../scanner/types.ts';
import {runVercelSandboxScanner,type VercelSandboxFactory} from './vercel-sandbox-scanner.ts';

export type ScannerMode='process'|'container'|'vercel-sandbox';

export function configuredScannerMode(env:NodeJS.ProcessEnv=process.env):ScannerMode {
 const configured=env.NOSPOILERS_SCANNER_MODE?.trim().toLowerCase();
 if(configured==='container'||configured==='vercel-sandbox')return configured;
 return 'process';
}

export function scannerCommand(target:string, mode:'process'|'container',name:string) {
  if(mode==='container') {
    if(target.includes(','))throw new Error('Unsupported artifact staging path.');
    const destination=`/input/${path.basename(target)}`;
    return {command:'docker',args:['run','--rm','--name',name,'--init','--network=none','--read-only',
      '--cap-drop=ALL','--security-opt=no-new-privileges','--memory=1g','--memory-swap=1g','--cpus=1',
      '--pids-limit=32','--ulimit','cpu=100:105','--user=65532:65532',
      '--tmpfs','/tmp:rw,noexec,nosuid,size=536870912,mode=1777',
      '--mount',`type=bind,source=${target},target=${destination},readonly`,
      process.env.NOSPOILERS_SCANNER_IMAGE??'nospoilers-scanner:local',destination]};
  }
  return {command:process.execPath,args:['--max-old-space-size=512','--import','tsx',fileURLToPath(new URL('./scanner-child.ts',import.meta.url)),target]};
}

export async function isolatedScan(target:string,options:{
 requireContainer?:boolean;
 requireIsolated?:boolean;
 sandboxFactory?:VercelSandboxFactory;
 env?:NodeJS.ProcessEnv;
}={}):Promise<ScanReport> {
  const env=options.env??process.env;
  const mode=configuredScannerMode(env);
  if(options.requireContainer&&mode!=='container')throw new Error('This scan requires the isolated container executor.');
  if((env.NODE_ENV==='production'||options.requireIsolated)&&mode==='process')throw new Error('Production scans require an isolated scanner executor.');
  const resolved=await realpath(target),name=`nospoilers-scan-${randomUUID()}`;
  const staging=await mkdtemp(path.join(tmpdir(),'nospoilers-parser-'));
  const input=path.join(staging,path.basename(resolved));
  try {
  let stagedBytes=0,stagedFiles=0;
  async function checkSource(file:string):Promise<void>{
    const info=await lstat(file);
    if(info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))throw new Error('Unsupported parser input.');
    stagedBytes+=info.isFile()?info.size:0;stagedFiles++;
    if(stagedBytes>80*1024*1024 || stagedFiles>25_001)throw new Error('Parser input exceeded staging budget.');
    if(info.isDirectory())for(const child of await readdir(file))await checkSource(path.join(file,child));
  }
  await checkSource(resolved);
  await cp(resolved,input,{recursive:true,dereference:false});
  async function makeReadable(file:string):Promise<void>{
    const info=await lstat(file);
    if(info.isSymbolicLink())throw new Error('Parser staging must not contain filesystem symlinks.');
    await chmod(file,info.isDirectory()?0o755:0o444);
    if(info.isDirectory())for(const child of await readdir(file))await makeReadable(path.join(file,child));
  }
  await makeReadable(input);
  const raw=mode==='vercel-sandbox'
   ? await runVercelSandboxScanner(input,{env,factory:options.sandboxFactory})
   : await new Promise<string>((resolve,reject)=>{
    const spec=scannerCommand(input,mode,name);
    const child=spawn(spec.command,spec.args,{shell:false,stdio:['ignore','pipe','pipe'],
      env:{PATH:env.PATH??'/usr/bin:/bin',NODE_ENV:'production',LANG:'C.UTF-8'}});
    let output='';let bytes=0;let failure:Error|undefined;const decoder=new StringDecoder('utf8');
    const stop=()=>{
      child.kill('SIGKILL');
      if(mode==='container'){
        const cleanup=spawn('docker',['rm','-f',name],{stdio:'ignore',shell:false,env:{PATH:env.PATH??'/usr/bin:/bin'}});
        cleanup.on('error',()=>undefined);
      }
    };
    const timer=setTimeout(()=>{failure=new Error('Scanner exceeded its execution deadline.');stop();},120_000);
    child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>32*1024*1024){failure=new Error('Scanner report exceeded its output budget.');stop();return;}output+=decoder.write(chunk);});
    // Drain diagnostics but never return customer bytes or parser filesystem paths.
    child.stderr.resume();
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);if(failure||code!==0)reject(failure??new Error('Isolated scanner failed.'));else resolve(output+decoder.end());});
   });
  const report=JSON.parse(raw) as ScanReport;
  if(!report || !Array.isArray(report.findings) || !Array.isArray(report.manifest) || typeof report.ok!=='boolean')throw new Error('Invalid scanner report.');
  if(report.status==='inconclusive')report.ok=false;
  return {...report,target};
  } finally {
    // This directory was generated by this invocation and contains only its parser input.
    await rm(staging,{recursive:true,force:true});
  }
}
