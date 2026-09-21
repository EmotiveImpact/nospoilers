import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {databaseMode,githubAppConfigured,resendConfigured,type AppConfig} from './config.ts';
import {isolatedScan} from './isolated-scanner.ts';
import {MIN_SECRET_LENGTH,secretIsStrong} from './secrets.ts';

const immutableImage=/^(?:sha256:[a-f0-9]{64}|[^\s@]+@sha256:[a-f0-9]{64})$/;

function isHttpsUrl(value:string):boolean {
 try {return new URL(value).protocol==='https:';} catch {return false;}
}

export function hostedWorkerReadinessProblems(config:AppConfig,env:NodeJS.ProcessEnv=process.env):string[] {
 const problems:string[]=[];
 if(env.NODE_ENV!=='production')problems.push('NODE_ENV must be production.');
 if(config.processRole!=='worker')problems.push('NOSPOILERS_ROLE must be worker.');
 if(databaseMode(config.databaseUrl)==='pglite')problems.push('DATABASE_URL must use external Postgres; PGlite is not a hosted worker store.');
 if(!isHttpsUrl(config.appBaseUrl))problems.push('APP_BASE_URL must be the hosted HTTPS web origin.');
 if(!githubAppConfigured(config)||!config.githubAppSlug.trim())problems.push('The complete GitHub App and OAuth configuration is required.');
 if(!secretIsStrong(config.sessionSecret))problems.push(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters and not a known default.`);
 if(!secretIsStrong(config.githubWebhookSecret))problems.push(`GITHUB_WEBHOOK_SECRET must be at least ${MIN_SECRET_LENGTH} characters and not a known default.`);
 if(!secretIsStrong(config.githubClientSecret))problems.push(`GITHUB_CLIENT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
 const explicitReceipt=env.RECEIPT_SECRET?.trim()??'';
 if(!secretIsStrong(explicitReceipt))problems.push(`RECEIPT_SECRET must be explicitly set to at least ${MIN_SECRET_LENGTH} characters.`);
 if(config.sessionSecret===config.githubWebhookSecret)problems.push('SESSION_SECRET must be distinct from GITHUB_WEBHOOK_SECRET.');
 if(explicitReceipt&&(explicitReceipt===config.sessionSecret||explicitReceipt===config.githubWebhookSecret))problems.push('RECEIPT_SECRET must be distinct from session and webhook secrets.');
 if(env.NOSPOILERS_SCANNER_MODE!=='container')problems.push('NOSPOILERS_SCANNER_MODE must be container.');
 const scannerImage=env.NOSPOILERS_SCANNER_IMAGE?.trim()??'';
 if(!immutableImage.test(scannerImage))problems.push('NOSPOILERS_SCANNER_IMAGE must be an immutable sha256 image ID or digest reference.');
 if(env.DOCKER_HOST?.trim())problems.push('DOCKER_HOST must be unset so the scanner uses the worker-local default socket and local staged paths.');
 if(env.NOSPOILERS_LOCAL_REVIEW==='1'||env.NOSPOILERS_INTERNAL_LOCAL_SCAN==='1')problems.push('Local review and local scan bypasses must be disabled.');
 const notificationProvider=env.NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER?.trim().toLowerCase();
 if(notificationProvider==='resend') {
  if(!resendConfigured(config))problems.push('RESEND_API_KEY and a valid RESEND_FROM_EMAIL are required for the selected Resend notification path.');
 } else if(notificationProvider!=='slack') {
  problems.push('NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER must explicitly select resend or slack.');
 }
 return problems;
}

export async function probeWorkerLocalScanner():Promise<void> {
 const directory=await mkdtemp(path.join(tmpdir(),'nospoilers-worker-readiness-'));
 try {
  await writeFile(path.join(directory,'package.json'),'{}\n',{mode:0o600});
  await writeFile(path.join(directory,'index.js'),'export const readiness = true;\n',{mode:0o600});
  const report=await isolatedScan(directory,{requireContainer:true});
  if(!report.ok||report.status!=='passed')throw new Error('Scanner probe did not return a clean result.');
 } finally {await rm(directory,{recursive:true,force:true});}
}

export async function assertHostedWorkerReady(config:AppConfig,options:{
 env?:NodeJS.ProcessEnv;
 scanProbe?:()=>Promise<void>;
}={}):Promise<void> {
 const problems=hostedWorkerReadinessProblems(config,options.env);
 if(problems.length)throw new Error(`Hosted worker readiness failed:\n- ${problems.join('\n- ')}`);
 try {await (options.scanProbe??probeWorkerLocalScanner)();}
 catch(error) {throw new Error('Hosted worker readiness failed: the worker-local isolated scanner image or staged-path mount probe failed.',{cause:error});}
}
