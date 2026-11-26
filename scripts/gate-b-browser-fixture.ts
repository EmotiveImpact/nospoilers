/** Opt-in, loopback-only Gate B browser fixture. Never imported by app/runtime. */
import {serve} from '@hono/node-server';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
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
import {attachCanonicalDeliveryUrl,runDeliveryVerifyJob} from '../src/server/delivery-verify.ts';
import {createLogNotifier} from '../src/server/notifier.ts';
import type {ScanReport} from '../src/scanner/types.ts';

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
// Where it went: a blocked version, its fix and the recorded hourly reads of each copy.
// Past rows are plain inserts with an explicit time; the latest read of each copy runs the real job over a synthetic transport.
const trail=(await store.insertWatchedPackage(9902,'qa-trail-cli'))!;
// A package large enough to show the file map: a sample archive's own files among ordinary ones, packed and scanned for real.
async function packedWith(source:string){
 const dir=await mkdtemp(path.join(tmpdir(),'qa-trail-'));
 execFileSync('tar',['-xzf',path.resolve(source),'-C',dir]);
 for(const [folder,count] of [['assets',64],['lib',146]] as const){
  await mkdir(path.join(dir,folder),{recursive:true});
  for(let index=0;index<count;index+=1)await writeFile(path.join(dir,folder,`chunk-${String(index).padStart(3,'0')}.js`),`export const part${index} = ${index};\n`);
 }
 const packed=`${dir}.tgz`;
 execFileSync('tar',['-czf',packed,'-C',dir,'.']);
 return {report:await scan(packed),bytes:await readFile(packed)};
}
const trailCleanPack=await packedWith('fixtures/clean.tgz'),trailDirtyPack=await packedWith('fixtures/sourcemap.tgz');
const trailClean=trailCleanPack.report,trailDirty=trailDirtyPack.report;
async function sealedHoursAgo(version:string,report:ScanReport,hoursAgo:number){
 const coordinate=`npm:qa-trail-cli@${version}`;
 const signed=signReceipt(buildUnsignedReceipt(report,coordinate,{channel:'stable',sourceRevision:version,ciRunUrl:null}),secret);
 const row=await store.insertScanReceipt({installationId:9902,packageId:trail.id,repoId:null,receipt:signed});
 await sql.query(`INSERT INTO hosted_scan_evidence(receipt_id,installation_id,report) VALUES($1,9902,$2::jsonb) ON CONFLICT(receipt_id) DO NOTHING`,[row.id,JSON.stringify(report)]);
 const inserted=await sql.query<{id:number}>(`INSERT INTO release_revisions(installation_id,package_id,receipt_id,channel,coordinate,artifact_sha256,artifact_sha512,artifact_bytes,media_type,source_revision,mismatch,created_at)
  VALUES(9902,$1,$2,'stable',$3,$4,$5,$6,'application/gzip',$7,false,now()-make_interval(mins=>$8)) RETURNING id`,
  [trail.id,row.id,coordinate,signed.artifactSha256,signed.artifactSha512??null,signed.artifactBytes??null,version,Math.round(hoursAgo*60)]);
 return Number(inserted.rows[0].id);
}
await sealedHoursAgo('2.3.2',trailClean,96);await sealedHoursAgo('2.4.0',trailClean,48);
const trailBlocked=await sealedHoursAgo('2.4.1',trailDirty,7.95);
await sealedHoursAgo('2.4.2',trailClean,4.4);
const trailRegistry=(await attachCanonicalDeliveryUrl(store,{installationId:9902,revisionId:trailBlocked,url:'https://registry.npmjs.org/qa-trail-cli/-/qa-trail-cli-2.4.1.tgz'}))!.id;
const trailCdn=(await store.insertDeliveryLocation({installationId:9902,revisionId:trailBlocked,url:'https://cdn.qa-fixture.example.com/qa-trail-cli/2.4.1/cli.tgz',host:'cdn.qa-fixture.example.com',expectedMediaType:'application/gzip',createdByLogin:'QA-owner'})).id;
const trailDownloads=(await store.insertDeliveryLocation({installationId:9902,revisionId:trailBlocked,url:'https://downloads.qa-fixture.example.com/cli/latest.tgz',host:'downloads.qa-fixture.example.com',expectedMediaType:'application/gzip',createdByLogin:'QA-owner'})).id;
for(let hour=7;hour>=1;hour-=1){
 const read=async(locationId:number,status:string,sha:string|null,host:string)=>sql.query(`INSERT INTO release_delivery_verifications(installation_id,location_id,revision_id,status,observed_sha256,observed_media_type,final_host,redirect_count,created_at)
  VALUES(9902,$1,$2,$3,$4,$5,$6,0,date_trunc('hour',now())-make_interval(hours=>$7)+interval '5 minutes')`,[locationId,trailBlocked,status,sha,sha?'application/gzip':null,host,hour]);
 await read(trailCdn,'matched',trailDirty.artifactSha256??null,'cdn.qa-fixture.example.com');
 await read(trailRegistry,hour>=5?'matched':'missing',hour>=5?trailDirty.artifactSha256??null:null,'registry.npmjs.org');
 await read(trailDownloads,hour>=5?'matched':'mismatch',(hour>=5?trailDirty.artifactSha256:trailClean.artifactSha256)??null,'downloads.qa-fixture.example.com');
}
{
 const dirtyBytes=trailDirtyPack.bytes,cleanBytes=trailCleanPack.bytes;
 const served=(body:Buffer|null)=>(async()=>new Response(body,{status:body?200:404,headers:{'content-type':'application/gzip'}})) as unknown as typeof fetch;
 const lookup=async()=>[{address:'93.184.216.34',family:4}];
 for(const [locationId,body] of [[trailCdn,dirtyBytes],[trailRegistry,null],[trailDownloads,cleanBytes]] as const)
  await runDeliveryVerifyJob({store,notifier:createLogNotifier(store),installationId:9902,locationId,revisionId:trailBlocked,scheduled:true,hourlyRecheck:loadConfig().deliveryRecheck,fetch:served(body),lookup});
}
const website=await createWorkspaceOrigin(sql,'qa-owner',workspace.id,'https://qa-fixture.example.com');
await sql.query("UPDATE watched_origins SET verified_at=now(),last_checked_at=now(),last_scan_status='failed-policy' WHERE id=$1",[website.id]);
const upload=randomUUID(),receipt=signReceipt(buildUnsignedReceipt(dirty,'qa-independent-upload'),secret);
await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json,completed_at)
 VALUES($1,'qa-owner',$2,'QA independent sourcemap.tgz',$3,'done',$4::jsonb,$5::jsonb,now())`,[upload,workspace.id,dirty.artifactSha256??'',JSON.stringify(dirty),JSON.stringify(receipt)]);
// Fresh rebuilt bytes for the explicit, human-reviewed remediation UI flow.
const rebuiltUpload=randomUUID(),rebuiltReport={...clean,scannedAt:new Date().toISOString()},rebuiltReceipt=signReceipt(buildUnsignedReceipt(rebuiltReport,'qa-rebuilt-upload'),secret);
await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json,completed_at)
 VALUES($1,'qa-owner',$2,'QA rebuilt clean.tgz',$3,'done',$4::jsonb,$5::jsonb,now())`,[rebuiltUpload,workspace.id,clean.artifactSha256??'',JSON.stringify(rebuiltReport),JSON.stringify(rebuiltReceipt)]);
const websiteAttempt=randomUUID();
await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json,receipt_json,completed_at)
 VALUES($1,'qa-owner',$2,$3,'https://qa-fixture.example.com/',$4,'done',$5::jsonb,$6::jsonb,now())`,[websiteAttempt,workspace.id,website.id,dirty.artifactSha256??'',JSON.stringify(dirty),JSON.stringify(receipt)]);
const alert=(await sql.query<{id:number}>(`INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body,findings,assigned_to_user_id)
 VALUES($1,$2,$3,'web_origin_scan','QA website exposes original source','Disposable browser acceptance fixture.',$4::jsonb,'qa-owner') RETURNING id`,[workspace.id,website.id,websiteAttempt,JSON.stringify(dirty.findings)])).rows[0];
await saveWorkspaceArtifactPolicy(sql,'qa-owner',workspace.id,{strict:false,expectedRevision:0,requireExceptionApproval:true});
const exception=await requestWorkspaceException(sql,'qa-owner',workspace.id,{attemptId:upload,findingIndex:0,requestKey:randomUUID(),reason:'QA bounded exception awaiting independent reviewer',expiresAt:new Date(Date.now()+86400000).toISOString()});
const sessions=new Map<string,string>();for(const actor of ['owner','reviewer','viewer'])sessions.set(actor,signSession(secret,await store.createSession(`qa-${actor}`)));
const app=createApp({store,github:stubGithub(),config:loadConfig({
 sessionSecret:secret,receiptSecret:secret,appBaseUrl:base,databaseUrl:'pglite://:memory:',
 githubAppId:'',githubPrivateKey:'',githubWebhookSecret:'',githubClientId:'',githubClientSecret:'',githubAppSlug:'',githubDiscoveryToken:'',
 adminToken:'',adminGithubLogin:'',polarAccessToken:'',polarWebhookSecret:'',
 polarProductSoloMonthly:'',polarProductSoloYearly:'',polarProductTeamMonthly:'',polarProductTeamYearly:'',
 resendApiKey:'',resendFromEmail:'',cronSecret:'',processRole:'web',
}),wakeWorker:()=>{}});
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
}},()=>console.log(JSON.stringify({qaOnly:true,entry:`${base}/__qa/${entry}`,actors:['owner','reviewer','viewer'],workspace:workspace.id,emptyWorkspace:empty.id,upload,rebuiltUpload,reviewedAt:dirty.scannedAt,websiteAttempt,alert:alert.id,exception:exception.id,network:'disabled',database:'ephemeral-memory',workers:false})));
async function stop(){server.close();await sql.close();process.exit(0);}process.once('SIGINT',stop);process.once('SIGTERM',stop);
