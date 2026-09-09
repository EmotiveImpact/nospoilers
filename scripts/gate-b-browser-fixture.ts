/** Opt-in, loopback-only Gate B browser fixture. Never imported by app/runtime. */
import {serve} from '@hono/node-server';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {scan} from '../src/scanner/index.ts';
import {buildUnsignedReceipt,signReceipt} from '../src/receipt.ts';
import {publishPackageObservation} from '../src/server/package-publication.ts';
import {publishReleaseObservation} from '../src/server/release-publication.ts';
import {createWorkspaceOrigin} from '../src/server/workspace-origins.ts';
import {createWorkspace} from '../src/server/workspaces.ts';
import {saveWorkspaceArtifactPolicy} from '../src/server/workspace-policy.ts';
import {requestWorkspaceException} from '../src/server/workspace-exceptions.ts';
import {moveUnusedWorkspaceConnection} from '../src/server/workspace-connections.ts';
import {inviteWorkspaceMember,acceptWorkspaceInvite} from '../src/server/workspace-membership.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import {withReleaseAssurance} from '../src/server/assurance-app.ts';
import {handleJob} from '../src/server/worker.ts';
import {PRODUCTION_PARITY_JOB} from '../src/server/production-parity-service.ts';

const port=process.argv[2]===undefined?4359:Number(process.argv[2]);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use a valid unprivileged QA port.');
const host='localhost',base=`http://${host}:${port}`;
const secret=randomBytes(32).toString('hex'),entry=randomBytes(18).toString('hex');
// Any accidental provider call fails locally; the fixture never starts a worker.
globalThis.fetch=async()=>{throw new Error('QA fixture: outbound network is disabled.');};
const sql=await openSql('pglite://:memory:');await migrate(sql);await migrateReleaseIntelligence(sql);const store=createStore(sql);
for(const actor of ['owner','reviewer','viewer'])await store.upsertUser({id:`qa-${actor}`,login:`QA-${actor}`});
await store.upsertInstallation({id:9901,accountId:9901,accountLogin:'QA primary connection',accountType:'User'});
await store.linkUserInstallation(9901,'qa-owner');
const empty=(await sql.query<{id:string;organization_id:string}>(`SELECT w.id,w.organization_id FROM product_workspaces w JOIN product_workspace_installations c ON c.workspace_id=w.id WHERE c.installation_id=9901`)).rows[0];
const workspace={...await createWorkspace(sql,'qa-owner',empty.organization_id,'QA mixed workspace — disposable'),organization_id:empty.organization_id};
await moveUnusedWorkspaceConnection(sql,'qa-owner',9901,empty.id,workspace.id);
await sql.query("UPDATE product_workspaces SET name='QA first-login workspace' WHERE id=$1",[empty.id]);
await store.upsertInstallation({id:9902,accountId:9902,accountLogin:'QA secondary connection',accountType:'User'});
await sql.query('INSERT INTO product_workspace_installations(installation_id,workspace_id) VALUES(9902,$1) ON CONFLICT(installation_id) DO UPDATE SET workspace_id=$1',[workspace.id]);
await store.linkUserInstallation(9902,'qa-owner');
for(const [actor,role] of [['reviewer','admin'],['viewer','viewer']] as const){
 const invitation=await inviteWorkspaceMember(sql,'qa-owner',workspace.id,`QA-${actor}`,role);
 await acceptWorkspaceInvite(sql,`qa-${actor}`,invitation.id);
}
await store.upsertRepo({id:9911,installationId:9901,owner:'qa',name:'release-app',fullName:'qa/release-app',private:true,htmlUrl:'https://github.com/qa/release-app'});
const pkg=(await store.insertWatchedPackage(9902,'qa-example-package'))!;
const clean=await scan('fixtures/clean.tgz'),dirty=await scan('fixtures/sourcemap.tgz');
await publishReleaseObservation({store,installationId:9901,repoId:9911,secret,tag:'qa-v1',assets:[{name:'clean.tgz',coordinate:'github:qa/release-app@qa-v1#clean.tgz',report:clean}],alert:()=>({installationId:9901,kind:'release_scan',title:'QA repository release checked',body:'Disposable fixture evidence, not customer data.'})});
await publishPackageObservation({store,installationId:9902,packageId:pkg.id,generation:'0',packageName:'qa-example-package',version:'1.0.0',report:dirty,sha256:dirty.artifactSha256??null,secret,channel:'stable',updateIdentity:true,alert:report=>({installationId:9902,kind:'npm_scan',title:'QA package contains exposed source',body:'Disposable fixture finding.',findings:report.findings})});
await sql.query("UPDATE watched_packages SET last_checked_at=now()-interval '2 days' WHERE id=$1",[pkg.id]);
const website=await createWorkspaceOrigin(sql,'qa-owner',workspace.id,'https://qa-fixture.example.com');
await sql.query("UPDATE watched_origins SET verified_at=now(),last_checked_at=now(),last_scan_status='failed-policy' WHERE id=$1",[website.id]);
const upload=randomUUID(),receipt=signReceipt(buildUnsignedReceipt(dirty,'qa-independent-upload'),secret);
await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json,completed_at)
 VALUES($1,'qa-owner',$2,'QA independent sourcemap.tgz',$3,'done',$4::jsonb,$5::jsonb,now())`,[upload,workspace.id,dirty.artifactSha256??'',JSON.stringify(dirty),JSON.stringify(receipt)]);
const websiteAttempt=randomUUID();
await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json,receipt_json,completed_at)
 VALUES($1,'qa-owner',$2,$3,'https://qa-fixture.example.com/',$4,'done',$5::jsonb,$6::jsonb,now())`,[websiteAttempt,workspace.id,website.id,dirty.artifactSha256??'',JSON.stringify(dirty),JSON.stringify(receipt)]);
const alert=(await sql.query<{id:number}>(`INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body,findings,assigned_to_user_id)
 VALUES($1,$2,$3,'web_origin_scan','QA website exposes original source','Disposable browser acceptance fixture.',$4::jsonb,'qa-owner') RETURNING id`,[workspace.id,website.id,websiteAttempt,JSON.stringify(dirty.findings)])).rows[0];
await saveWorkspaceArtifactPolicy(sql,'qa-owner',workspace.id,{strict:false,expectedRevision:0,requireExceptionApproval:true});
const exception=await requestWorkspaceException(sql,'qa-owner',workspace.id,{attemptId:upload,findingIndex:0,requestKey:randomUUID(),reason:'QA bounded exception awaiting independent reviewer',expiresAt:new Date(Date.now()+86400000).toISOString()});
const sessions=new Map<string,string>();for(const actor of ['owner','reviewer','viewer'])sessions.set(actor,signSession(secret,await store.createSession(`qa-${actor}`)));
const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:secret,receiptSecret:secret,appBaseUrl:base}),wakeWorker:()=>{}});
const assurance=withReleaseAssurance(app,{receiptSecret:secret,scopeForRelease:async id=>{
 const row=await store.getReleaseRevision(id);return row?{installationId:row.installation_id,receiptId:row.receipt_id}:null;
}});
const secrets={sessionSecret:secret,receiptSecret:secret};
const integrated=withReleaseIntelligence(assurance,{sql,appBaseUrl:base,
 ports:request=>intelligencePorts(request,secrets),
 reserve:request=>intelligencePorts(request,secrets).reserve(sql),
 context:(request,ref)=>intelligencePorts(request,secrets).context(sql,ref),
});
const dist=path.resolve('dist');await readFile(path.join(dist,'index.html'));
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=serve({hostname:'127.0.0.1',port,fetch:async request=>{
 const url=new URL(request.url);
 if(url.hostname!==host)return new Response('QA loopback host only',{status:403});
 if(url.pathname===`/__qa/${entry}/production-step`&&request.method==='POST'){
  if(request.headers.get('origin')!==base||!request.headers.get('cookie')?.split(';').some(c=>c.trim()===`ns_session=${sessions.get('owner')}`))return new Response('QA owner only',{status:403});
  const job=await store.claimJob('heavy',1,'qa-parity-worker');
  if(!job)return Response.json({qaOnly:true,processed:false});
  if(job.kind!==PRODUCTION_PARITY_JOB){await store.finishJob(job.id,'Unexpected job in disposable fixture','qa-parity-worker');return new Response('Unexpected QA job',{status:409});}
  await handleJob(job,{store,workerId:'qa-parity-worker',receiptSecret:secret,github:stubGithub(),scan,maxAssetBytes:100000,
    webLookup:async()=>[{address:'1.1.1.1',family:4}],webFetch:async()=>new Response('Synthetic QA delivered bytes',{headers:{'content-type':'text/javascript','cache-control':'no-cache'}}),
    notifier:{send:async()=>{throw new Error('QA fixture does not send notifications.');}}});
  await store.finishJob(job.id,undefined,'qa-parity-worker');return Response.json({qaOnly:true,processed:true,transport:'synthetic — no outbound network'});
 }
 if(url.pathname===`/__qa/${entry}`){const actor=url.searchParams.get('actor')??'owner',session=sessions.get(actor);if(!session)return new Response('Unknown QA actor',{status:400});return new Response(null,{status:302,headers:{'Set-Cookie':`ns_session=${session}; Path=/; HttpOnly; SameSite=Strict`,'Location':`/watch?workspace=${workspace.id}`}});}
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return integrated.fetch(request);
 const candidate=path.resolve(dist,`.${decodeURIComponent(url.pathname)}`);
 if(!candidate.startsWith(dist+path.sep))return new Response(await readFile(path.join(dist,'index.html')),{headers:{'Content-Type':'text/html','Cache-Control':'no-store'}});
 try{return new Response(await readFile(candidate),{headers:{'Content-Type':mime[path.extname(candidate)]??'application/octet-stream','Cache-Control':'no-store'}});}catch{return new Response(await readFile(path.join(dist,'index.html')),{headers:{'Content-Type':'text/html','Cache-Control':'no-store'}});}
}},()=>console.log(JSON.stringify({qaOnly:true,entry:`${base}/__qa/${entry}`,actors:['owner','reviewer','viewer'],workspace:workspace.id,emptyWorkspace:empty.id,upload,websiteAttempt,alert:alert.id,exception:exception.id,network:'disabled',database:'ephemeral-memory',workers:false})));
async function stop(){server.close();await sql.close();process.exit(0);}process.once('SIGINT',stop);process.once('SIGTERM',stop);
