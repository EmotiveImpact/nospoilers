import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdir,mkdtemp,readFile,rm,symlink,truncate,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {isolatedScan} from '../src/server/isolated-scanner.ts';
import {
 runVercelSandboxScanner,vercelSandboxConfigurationProblems,vercelSandboxCreateOptions,
 type VercelScannerSandbox,type VercelSandboxFactory,
} from '../src/server/vercel-sandbox-scanner.ts';

const temporaryPaths:string[]=[];
const image=`nospoilers-scanner@sha256:${'a'.repeat(64)}`;
const configuredEnv:NodeJS.ProcessEnv={
 NOSPOILERS_SCANNER_IMAGE:image,VERCEL_TOKEN:'control-plane-secret',
 VERCEL_TEAM_ID:'team-id',VERCEL_PROJECT_ID:'project-id',
};

afterEach(async()=>{
 await Promise.all(temporaryPaths.splice(0).map(target=>rm(target,{recursive:true,force:true})));
});

async function temporaryInput():Promise<string> {
 const root=await mkdtemp(path.join(tmpdir(),'nospoilers-sandbox-test-'));
 temporaryPaths.push(root);
 const input=path.join(root,'input');
 await mkdir(path.join(input,'one','two'),{recursive:true});
 await writeFile(path.join(input,'root.txt'),'root');
 await writeFile(path.join(input,'one','two','nested.txt'),'nested');
 return input;
}

function fakeSandbox(options:{
 exitCode?:number;report?:Buffer;reportedSize?:number;stopError?:Error;identityError?:Error;hang?:boolean;
}={}) {
 const report=options.report??Buffer.from('{}');
 const state={events:[] as string[],mkdirs:[] as string[],uploads:[] as {path:string;mode:number}[],
  chmods:[] as {path:string;mode:number}[],seals:[] as string[],reads:0,runs:0,stops:0};
 const sandbox:VercelScannerSandbox={
  assertScannerIdentity:async()=>{state.events.push('identity');if(options.identityError)throw options.identityError;},
  mkdir:async target=>{state.events.push(`mkdir:${target}`);state.mkdirs.push(target);},
  writeFiles:async files=>{
   state.events.push('write');
   state.uploads.push(...files.map(file=>({path:file.path,mode:file.mode})));
  },
  chmod:async(target,mode)=>{state.events.push(`chmod:${target}`);state.chmods.push({path:target,mode});},
  sealInput:async target=>{state.events.push('seal');state.seals.push(target);},
  runScanner:async(_input,_report,signal)=>{
   state.events.push('run');state.runs++;
   // Mirror the provider SDK: a hung command only ends when its signal aborts.
   if(options.hang)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));
   return {exitCode:options.exitCode??0};
  },
  statSize:async()=>options.reportedSize??report.length,
  readFile:async()=>{state.reads++;return report;},
  stop:async()=>{state.stops++;if(options.stopError)throw options.stopError;},
 };
 const factory=vi.fn(async()=>sandbox) as VercelSandboxFactory;
 return {state,factory};
}

describe('Vercel Sandbox scanner configuration',()=>{
 it('requires a digest-pinned image and every control-plane credential',()=>{
  expect(vercelSandboxConfigurationProblems({NOSPOILERS_SCANNER_IMAGE:'registry/scanner:latest'})).toEqual([
   expect.stringContaining('digest-pinned'),expect.stringContaining('VERCEL_TOKEN'),
   expect.stringContaining('VERCEL_TEAM_ID'),expect.stringContaining('VERCEL_PROJECT_ID'),
  ]);
  expect(vercelSandboxConfigurationProblems(configuredEnv)).toEqual([]);
  expect(vercelSandboxConfigurationProblems({...configuredEnv,NOSPOILERS_SCANNER_IMAGE:`ghcr.io/nospoilers/scanner@sha256:${'a'.repeat(64)}`}))
   .toEqual([expect.stringContaining('digest-pinned Vercel Container Registry')]);
  expect(vercelSandboxConfigurationProblems({...configuredEnv,NOSPOILERS_SCANNER_IMAGE:`vcr.vercel.com/team/project/scanner@sha256:${'b'.repeat(64)}`}))
   .toEqual([]);
 });

 it('creates an isolated, nonpersistent, deny-all VM without forwarding credentials into it',()=>{
  expect(vercelSandboxCreateOptions(configuredEnv)).toEqual({
   token:'control-plane-secret',teamId:'team-id',projectId:'project-id',image,
   resources:{vcpus:1},timeout:135_000,networkPolicy:'deny-all',persistent:false,
   env:{NODE_ENV:'production',LANG:'C.UTF-8'},
  });
 });

 it('keeps the custom scanner image non-root by default',async()=>{
  const dockerfile=await readFile(path.join(process.cwd(),'Dockerfile.scanner'),'utf8');
  expect(dockerfile).toMatch(/useradd --uid 65532 .* scanner/);
  expect(dockerfile).toMatch(/useradd --uid 65533 .* nospoilers-parser/);
  expect(dockerfile).not.toMatch(/chown .*\/parser/);
  expect(dockerfile).toMatch(/scanner ALL=\(nospoilers-parser\) NOPASSWD: ALL/);
  expect(dockerfile).not.toMatch(/scanner ALL=\(root\)/);
  const instructions=dockerfile.trim().split('\n');
  expect(instructions.at(-2)).toBe('USER scanner');
  expect(instructions.at(-1)).toMatch(/^ENTRYPOINT /);
 });
});

describe('Vercel Sandbox scanner lifecycle',()=>{
 it('dispatches production scans through the sandbox adapter',async()=>{
  const input=await temporaryInput();
  const report=Buffer.from(JSON.stringify({ok:true,status:'passed',findings:[],manifest:[]}));
  const {state,factory}=fakeSandbox({report});
  await expect(isolatedScan(input,{
   env:{...configuredEnv,NODE_ENV:'production',NOSPOILERS_SCANNER_MODE:'vercel-sandbox'},sandboxFactory:factory,
  })).resolves.toMatchObject({ok:true,status:'passed',target:input});
  expect(state.runs).toBe(1);
  expect(state.stops).toBe(1);
 });

 it('creates every nested remote directory before uploading read-only files and always stops',async()=>{
  const input=await temporaryInput();
  const {state,factory}=fakeSandbox({report:Buffer.from('{"clean":true}')});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).resolves.toBe('{"clean":true}');
  const remoteRoot='/vercel/sandbox/nospoilers-input/input';
  expect(state.mkdirs).toEqual([
   '/vercel/sandbox/nospoilers-input',remoteRoot,`${remoteRoot}/one`,`${remoteRoot}/one/two`,
  ]);
  expect(Math.max(...state.events.map((event,index)=>event.startsWith('mkdir:')?index:-1)))
   .toBeLessThan(state.events.indexOf('write'));
  expect(state.uploads).toEqual(expect.arrayContaining([
   {path:`${remoteRoot}/root.txt`,mode:0o444},
   {path:`${remoteRoot}/one/two/nested.txt`,mode:0o444},
  ]));
  expect(state.chmods).toEqual(expect.arrayContaining([
   {path:remoteRoot,mode:0o555},{path:`${remoteRoot}/one/two`,mode:0o555},
  ]));
  expect(state.events[0]).toBe('identity');
  expect(state.seals).toEqual(['/vercel/sandbox/nospoilers-input']);
  expect(state.events.indexOf('seal')).toBeLessThan(state.events.indexOf('run'));
  expect(state.stops).toBe(1);
 });

 it('fails closed on a scanner error and still stops the sandbox',async()=>{
  const input=await temporaryInput();
  const {state,factory}=fakeSandbox({exitCode:7});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow('Isolated scanner failed.');
  expect(state.reads).toBe(0);
  expect(state.stops).toBe(1);
 });

 it('rejects an image that does not start commands as uid 65532 and still stops it',async()=>{
  const input=await temporaryInput();
  const {state,factory}=fakeSandbox({identityError:new Error('wrong uid')});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow('wrong uid');
  expect(state.runs).toBe(0);
  expect(state.stops).toBe(1);
 });

 it('rejects an oversized report before reading it and still stops the sandbox',async()=>{
  const input=await temporaryInput();
  const {state,factory}=fakeSandbox({reportedSize:32*1024*1024+1});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow('output budget');
  expect(state.reads).toBe(0);
  expect(state.stops).toBe(1);
 });

 it('fails a successful scan when the sandbox cannot be stopped',async()=>{
  const input=await temporaryInput();
  const {factory}=fakeSandbox({stopError:new Error('provider unavailable')});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow('cleanup failed');
 });

 it('preserves the scanner failure when cleanup also fails',async()=>{
  const input=await temporaryInput();
  const {factory}=fakeSandbox({exitCode:7,stopError:new Error('provider unavailable')});
  await expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow('Isolated scanner failed.');
 });
});

describe('Vercel Sandbox hostile input',()=>{
 const productionEnv={...configuredEnv,NODE_ENV:'production',NOSPOILERS_SCANNER_MODE:'vercel-sandbox'};

 it('rejects a symlink before any sandbox is created',async()=>{
  const input=await temporaryInput();
  await symlink('/etc/passwd',path.join(input,'one','passwd'));
  const {state,factory}=fakeSandbox();
  await expect(isolatedScan(input,{env:productionEnv,sandboxFactory:factory})).rejects.toThrow('Unsupported parser input.');
  expect(factory).not.toHaveBeenCalled();
  expect(state.uploads).toEqual([]);
 });

 it('rejects a FIFO before any sandbox is created or the pipe is opened',async()=>{
  const input=await temporaryInput();
  execFileSync('mkfifo',[path.join(input,'one','pipe')]);
  const {factory}=fakeSandbox();
  await expect(isolatedScan(input,{env:productionEnv,sandboxFactory:factory})).rejects.toThrow('Unsupported parser input.');
  expect(factory).not.toHaveBeenCalled();
 });

 it('rejects input over the 80 MiB staging budget before any sandbox is created',async()=>{
  const input=await temporaryInput();
  // Sparse: the declared size is what the budget checks, so no disk is spent.
  const large=path.join(input,'large.bin');
  await writeFile(large,'');
  await truncate(large,80*1024*1024+1);
  const {factory}=fakeSandbox();
  await expect(isolatedScan(input,{env:productionEnv,sandboxFactory:factory})).rejects.toThrow('staging budget');
  expect(factory).not.toHaveBeenCalled();
 });

 it('re-checks staged input inside the adapter, uploads nothing and stops the sandbox',async()=>{
  const linked=await temporaryInput();
  await symlink('/etc/passwd',path.join(linked,'passwd'));
  const first=fakeSandbox();
  await expect(runVercelSandboxScanner(linked,{env:configuredEnv,factory:first.factory})).rejects.toThrow('Unsupported parser input.');
  expect(first.state.uploads).toEqual([]);
  expect(first.state.runs).toBe(0);
  expect(first.state.stops).toBe(1);

  const oversized=await temporaryInput();
  await writeFile(path.join(oversized,'large.bin'),'');
  await truncate(path.join(oversized,'large.bin'),80*1024*1024+1);
  const second=fakeSandbox();
  await expect(runVercelSandboxScanner(oversized,{env:configuredEnv,factory:second.factory})).rejects.toThrow('staging budget');
  expect(second.state.uploads).toEqual([]);
  expect(second.state.stops).toBe(1);
 });
});

describe('Vercel Sandbox session deadline',()=>{
 afterEach(()=>{vi.useRealTimers();});

 it('aborts a hung scanner at the session deadline without reading a report and still stops the sandbox',async()=>{
  const input=await temporaryInput();
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const {state,factory}=fakeSandbox({hang:true});
  const outcome=expect(runVercelSandboxScanner(input,{env:configuredEnv,factory})).rejects.toThrow();
  await vi.waitFor(()=>expect(state.runs).toBe(1));
  await vi.advanceTimersByTimeAsync(135_000);
  await outcome;
  expect(state.reads).toBe(0);
  expect(state.stops).toBe(1);
 });
});
