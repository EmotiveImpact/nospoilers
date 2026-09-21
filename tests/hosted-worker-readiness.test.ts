import {expect,it,vi} from 'vitest';
import {loadConfig} from '../src/server/config.ts';
import {assertHostedWorkerReady,hostedWorkerReadinessProblems} from '../src/server/hosted-worker-readiness.ts';

const strong={
 session:'session-secret-with-enough-entropy-123456',
 webhook:'webhook-secret-with-enough-entropy-1234',
 client:'client-secret-with-enough-entropy-12345',
 receipt:'receipt-secret-with-enough-entropy-1234',
};

function ready() {
 const config=loadConfig({
  processRole:'worker',databaseUrl:'postgres://worker:secret@db.internal/nospoilers',appBaseUrl:'https://app.example.test',
  githubAppId:'123',githubPrivateKey:'-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----',
  githubWebhookSecret:strong.webhook,githubClientId:'client-id',githubClientSecret:strong.client,githubAppSlug:'nospoilers-test',
  sessionSecret:strong.session,receiptSecret:strong.receipt,resendApiKey:'resend-key',resendFromEmail:'NoSpoilers <alerts@example.test>',
 });
 const env:NodeJS.ProcessEnv={
  NODE_ENV:'production',RECEIPT_SECRET:strong.receipt,NOSPOILERS_SCANNER_MODE:'container',
  NOSPOILERS_SCANNER_IMAGE:`sha256:${'a'.repeat(64)}`,NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER:'resend',
 };
 return {config,env};
}

it('accepts a complete non-Stripe worker only after its local isolated scan probe passes',async()=>{
 const {config,env}=ready();const scanProbe=vi.fn(async()=>undefined);
 expect(hostedWorkerReadinessProblems(config,env)).toEqual([]);
 await expect(assertHostedWorkerReady(config,{env,scanProbe})).resolves.toBeUndefined();
 expect(scanProbe).toHaveBeenCalledOnce();
 expect(config.stripeSecretKey).toBe('');
});

it('accepts a digest-pinned Vercel Sandbox executor with explicit project credentials',()=>{
 const {config,env}=ready();
 expect(hostedWorkerReadinessProblems(config,{
  ...env,NOSPOILERS_SCANNER_MODE:'vercel-sandbox',
  NOSPOILERS_SCANNER_IMAGE:`nospoilers-scanner@sha256:${'b'.repeat(64)}`,
  VERCEL_TOKEN:'sandbox-token',VERCEL_TEAM_ID:'team-id',VERCEL_PROJECT_ID:'project-id',
 })).toEqual([]);
});

it('fails before probing when hosted identity, isolation, or delivery configuration is unsafe',async()=>{
 const {config,env}=ready();const scanProbe=vi.fn(async()=>undefined);
 const unsafe={...env,NODE_ENV:'test',NOSPOILERS_SCANNER_MODE:'container',NOSPOILERS_SCANNER_IMAGE:'nospoilers-scanner:latest',
  DOCKER_HOST:'tcp://daemon.example.test:2376',NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER:'resend'};
 const unsafeConfig={...config,databaseUrl:'pglite://./data/nospoilers',appBaseUrl:'http://127.0.0.1:4347',processRole:'all' as const,
  resendApiKey:'',receiptSecret:config.sessionSecret};
 await expect(assertHostedWorkerReady(unsafeConfig,{env:unsafe,scanProbe})).rejects.toThrow(/NODE_ENV must be production/);
 const problems=hostedWorkerReadinessProblems(unsafeConfig,unsafe).join('\n');
 expect(problems).toMatch(/PGlite/);expect(problems).toMatch(/HTTPS/);expect(problems).toMatch(/NOSPOILERS_ROLE/);
 expect(problems).toMatch(/immutable sha256/);expect(problems).toMatch(/DOCKER_HOST/);expect(problems).toMatch(/RESEND_API_KEY/);
 expect(hostedWorkerReadinessProblems(config,{...env,NOSPOILERS_SCANNER_MODE:'process'}).join('\n')).toMatch(/container or vercel-sandbox/);
 expect(scanProbe).not.toHaveBeenCalled();
});

it('propagates a generic failure when the real executor cannot mount and scan worker-local staging',async()=>{
 const {config,env}=ready();const underlying=new Error('private daemon detail');
 await expect(assertHostedWorkerReady(config,{env,scanProbe:async()=>{throw underlying;}}))
  .rejects.toMatchObject({message:expect.stringContaining('clean staging probe'),cause:underlying});
});

it('allows the Slack path only when it is selected explicitly',()=>{
 const {config,env}=ready();
 expect(hostedWorkerReadinessProblems({...config,resendApiKey:'',resendFromEmail:''},{...env,NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER:'slack'})).toEqual([]);
 expect(hostedWorkerReadinessProblems(config,{...env,NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER:undefined}).join('\n')).toMatch(/explicitly select/);
});
