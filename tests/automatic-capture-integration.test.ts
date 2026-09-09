import {it,expect} from 'vitest';
import {migrate,openSql,type SqlClient} from '../src/server/sql.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {createStore,signSession,type JobRow} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {publishReleaseObservation} from '../src/server/release-publication.ts';
import {publishPackageObservation} from '../src/server/package-publication.ts';
import {publishWebsiteObservation} from '../src/server/website-publication.ts';
import {handleJob} from '../src/server/worker.ts';
import {scan} from '../src/scanner/index.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {enqueueAutomaticCapture,AUTOMATIC_CAPTURE_JOB} from '../src/server/automatic-capture.ts';
import {ensureUserWorkspaces} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin,verifyWorkspaceOrigin} from '../src/server/workspace-origins.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {processAutomaticCapture} from '../src/server/automatic-capture-worker.ts';

it('connects explicit capture grants to GitHub, npm and website publication with durable owned jobs',async()=>{
  const database=process.env.NOSPOILERS_PR44_TEST_DATABASE_URL;
  if(database){const url=new URL(database);if(url.hostname!=='127.0.0.1'||url.pathname!=='/nospoilers_pr44_review')throw new Error('Use the disposable integration database.');}
  const sql=await openSql(database??'pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);await migrateReleaseIntelligence(sql);
    const store=createStore(sql),secrets={sessionSecret:'capture-session',receiptSecret:'capture-signature'},origin='http://127.0.0.1:4347';
    await store.upsertUser({id:'capture-owner',login:'capture-owner'});
    await store.upsertUser({id:'capture-viewer',login:'capture-viewer'});
    await store.upsertInstallation({id:881,accountId:881,accountLogin:'capture-org',accountType:'Organization'});
    await store.linkUserInstallation(881,'capture-owner');
    const workspace=(await listUserWorkspaces(sql,'capture-owner')).find(w=>Number(w.installation_id)===881)!;
    await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'capture-viewer','viewer','explicit')",[workspace.id]);
    const cookies={owner:`ns_session=${signSession(secrets.sessionSecret,await store.createSession('capture-owner'))}`,viewer:`ns_session=${signSession(secrets.sessionSecret,await store.createSession('capture-viewer'))}`};
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:origin})});
    const app=withReleaseIntelligence(core,{sql,appBaseUrl:origin,ports:r=>intelligencePorts(r,secrets),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref)});
    const request=(path:string,input?:unknown,actor:'owner'|'viewer'='owner')=>app.fetch(new Request(origin+path,{method:input?'POST':'GET',headers:{cookie:cookies[actor],origin,'content-type':'application/json'},body:input?JSON.stringify(input):undefined}));
    await store.upsertRepo({id:8810,installationId:881,owner:'capture',name:'app',fullName:'capture/app',private:false,htmlUrl:'https://github.com/capture/app'});
    const clean=await scan('fixtures/clean.tgz');
    const publishRepo=async(version:number,name='app.tgz')=>publishReleaseObservation({store,installationId:881,repoId:8810,secret:secrets.receiptSecret,tag:`v${version}`,
      assets:[{name,coordinate:`github:capture/app@v${version}#${name}`,report:clean}],alert:()=>({installationId:881,kind:'release_scan',title:'QA release',body:'Synthetic integration'})});
    const first=(await publishRepo(1))!.alert.releaseRevisionIds![0];
    expect((await sql.query('SELECT id FROM release_intelligence_capture_attempts')).rows).toHaveLength(0);
    async function enable(recordId:number,key:string){
      const record={kind:'release',id:String(recordId)};
      const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:key,key,role:'Explicit QA artifact',record});
      expect(created.status).toBe(201);
      const stream=(await created.json() as {stream:{id:string}}).stream.id;
      const path=`/api/release-intelligence/streams/${stream}/automatic-capture`;
      const input={enabled:true,expectedRevision:0,record,confirm:true,reason:'Explicitly enable this connected QA artifact.'};
      expect((await request(path,input,'viewer')).status).toBe(403);
      expect((await request(path,input)).status).toBe(200);
      expect((await request(path,input)).status).toBe(409);
      return {stream,path,record};
    }
    const repo=await enable(first,'capture-repo');
    await publishRepo(2,'another.tgz');
    expect((await sql.query('SELECT id FROM release_intelligence_capture_attempts')).rows).toHaveLength(0);
    const second=(await publishRepo(2))!.alert.releaseRevisionIds![0];
    await enqueueAutomaticCapture(sql,{kind:'release',id:String(second)});
    expect((await sql.query('SELECT id FROM release_intelligence_capture_attempts')).rows).toHaveLength(1);
    const run=async(stale=false)=>{
      const job=await store.claimJob('light',1,'capture-worker');
      expect(job).toBeTruthy();
      if(!job)throw new Error('Expected a queued history job.');
      expect(job.kind).toBe(AUTOMATIC_CAPTURE_JOB);
      await handleJob(job,{store,workerId:stale?'old-worker':'capture-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,notifier:{send:async()=>{throw new Error('Capture must not send notifications.');}}});
      if(!stale)await store.finishJob(Number(job.id),undefined,'capture-worker');
      else await sql.query("UPDATE jobs SET status='queued',locked_by=NULL WHERE id=$1",[job.id]);
      return job;
    };
    await run(true);
    expect((await sql.query("SELECT id FROM release_intelligence_capture_attempts WHERE status='captured'")).rows).toHaveLength(0);
    // An interrupted history write rolls back and can retry without rewriting the scan.
    const retryJob=(await sql.query<JobRow>("SELECT * FROM jobs WHERE kind=$1 AND status='queued' ORDER BY id LIMIT 1",[AUTOMATIC_CAPTURE_JOB])).rows[0];
    const attempt=(await sql.query<{id:string}>('SELECT id FROM release_intelligence_capture_attempts WHERE job_id=$1',[retryJob.id])).rows[0];
    await sql.query("UPDATE jobs SET status='running',locked_by='capture-worker' WHERE id=$1",[retryJob.id]);
    let interrupted=false;
    const interrupt=(client:SqlClient):SqlClient=>({...client,
      query:async <T>(statement:string,params?:unknown[])=>{
        if(!interrupted&&statement.includes('INSERT INTO release_intelligence_snapshots')){interrupted=true;throw new Error('Synthetic transient write failure');}
        return client.query<T>(statement,params);
      },transaction:fn=>client.transaction(tx=>fn(interrupt(tx))),
    });
    await expect(processAutomaticCapture(interrupt(sql),attempt.id,secrets.receiptSecret,{jobId:Number(retryJob.id),workerId:'capture-worker'})).rejects.toThrow('saved scan is unchanged');
    expect(interrupted).toBe(true);
    expect((await sql.query('SELECT status,outcome FROM release_intelligence_capture_attempts WHERE id=$1',[attempt.id])).rows).toEqual([{status:'failed',outcome:'capture_temporarily_unavailable'}]);
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[repo.stream])).rows).toHaveLength(1);
    await sql.query("UPDATE jobs SET status='queued',locked_by=NULL WHERE id=$1",[retryJob.id]);
    await run();
    expect((await sql.query("SELECT id FROM release_intelligence_capture_attempts WHERE status='captured'")).rows).toHaveLength(1);
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[repo.stream])).rows).toHaveLength(2);
    expect((await sql.query('SELECT id FROM release_intelligence_baselines')).rows).toHaveLength(0);
    // A queued rule revision cannot survive disabling; the scan itself stays saved.
    const third=(await publishRepo(3))!.alert.releaseRevisionIds![0];
    expect((await request(repo.path,{enabled:false,expectedRevision:1,reason:'Stop future automatic capture explicitly.'})).status).toBe(200);
    await run();
    expect((await store.getReleaseRevision(third))?.receipt_status).toBe('passed');
    expect((await sql.query("SELECT id FROM release_intelligence_capture_attempts WHERE status='stopped'")).rows).toHaveLength(1);
    // Registry completion uses the same durable capture path.
    const pkg=(await store.insertWatchedPackage(881,'capture-package'))!;
    const generation=await store.packageConnectionGeneration(pkg.id,881);
    const publishNpm=async(version:string)=>publishPackageObservation({store,installationId:881,packageId:pkg.id,generation,packageName:'capture-package',version,
      report:clean,sha256:clean.artifactSha256??null,secret:secrets.receiptSecret,channel:'stable',updateIdentity:false,alert:()=>({installationId:881,kind:'npm_scan',title:'QA package',body:'Synthetic integration'})});
    const npmFirst=(await publishNpm('1.0.0'))!.alert.releaseRevisionIds![0];
    const npm=await enable(npmFirst,'capture-npm');await publishNpm('1.0.1');await run();
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[npm.stream])).rows).toHaveLength(2);
    const watched=(await store.insertWatchedOrigin(881,'https://capture.example/','capture.example'))!;
    const publishWeb=async(digest:string)=>publishWebsiteObservation({store,installationId:881,origin:watched,report:{...clean,artifactSha256:digest},sha256:digest,secret:secrets.receiptSecret,updateIdentity:false,alert:()=>({installationId:881,kind:'web_origin_scan',title:'QA website',body:'Synthetic integration'})});
    const webFirst=(await publishWeb('c'.repeat(64)))!.alert.releaseRevisionIds![0];
    const website=await enable(webFirst,'capture-website');await publishWeb('d'.repeat(64));await run();
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[website.stream])).rows).toHaveLength(2);
    // Reconnecting the same source cannot silently reuse its previous grant.
    await publishWeb('e'.repeat(64));
    await sql.query('UPDATE watched_origins SET paused_at=now() WHERE id=$1',[watched.id]);
    await sql.query('UPDATE watched_origins SET paused_at=NULL WHERE id=$1',[watched.id]);
    await run();
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[website.stream])).rows).toHaveLength(2);
    expect((await sql.query("SELECT outcome FROM release_intelligence_capture_attempts WHERE stream_id=$1 AND status='stopped'",[website.stream])).rows).toEqual([{outcome:'configuration_or_source_changed'}]);
    // Revoking the enabling administrator prevents queued work from writing.
    await publishNpm('1.0.2');
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'capture-owner')",[workspace.id]);
    await run();
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[npm.stream])).rows).toHaveLength(2);
  }finally{await sql.close();}
},60_000);

it('captures verified independent-workspace website completions without a GitHub installation',async()=>{
  const sql=await openSql('pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);
    const store=createStore(sql),secrets={sessionSecret:'independent-session',receiptSecret:'independent-receipt'};
    await store.upsertUser({id:'independent-owner',login:'independent-owner'});await ensureUserWorkspaces(sql,'independent-owner');
    const workspace=(await listUserWorkspaces(sql,'independent-owner'))[0];
    const origin=await createWorkspaceOrigin(sql,'independent-owner',workspace.id,'https://independent.example/');
    await verifyWorkspaceOrigin(sql,'independent-owner',workspace.id,origin.id,'dns',async(_host,_token,method)=>({method,detail:'matched'}));
    const base='http://127.0.0.1:4347',cookie=`ns_session=${signSession(secrets.sessionSecret,await store.createSession('independent-owner'))}`;
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:base})});
    const app=withReleaseIntelligence(core,{sql,appBaseUrl:base,ports:r=>intelligencePorts(r,secrets),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref)});
    const request=(path:string,body:unknown)=>app.fetch(new Request(base+path,{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)}));
    async function complete(id:string){
      await store.queueUploadedScan({id,userId:'independent-owner',installationId:null,workspaceId:workspace.id,target:origin.origin_url,bytes:new Uint8Array(),sourceOriginId:origin.id,meta:{coordinate:`web:${origin.origin_url}`}});
      await processUploadedScan(id,store,scan,secrets.receiptSecret,undefined,{lookup:async()=>[{address:'1.1.1.1',family:4}],fetch:async url=>String(url)===origin.origin_url?new Response('<html>Owned synthetic website</html>',{headers:{'content-type':'text/html'}}):new Response('missing',{status:404})});
      expect((await store.getUploadedScan('independent-owner',id))?.status).toBe('done');
    }
    const seed='9c27a17e-1c97-4a70-b85b-9976ec6a6101',next='9c27a17e-1c97-4a70-b85b-9976ec6a6102';
    await complete(seed);
    const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:'Independent web',key:'independent-web',role:'Production website',record:{kind:'upload',id:seed}});
    expect(created.status).toBe(201);
    const stream=(await created.json() as {stream:{id:string}}).stream.id;
    const enabled=await request(`/api/release-intelligence/streams/${stream}/automatic-capture`,{enabled:true,expectedRevision:0,record:{kind:'upload',id:seed},confirm:true,reason:'Capture this verified website only.'});
    expect(enabled.status).toBe(200);
    await complete(next);
    const job=await store.claimJob('light',1,'independent-worker');
    expect(job).toBeTruthy();
    if(!job)throw new Error('Expected a queued history job.');
    expect(job.kind).toBe(AUTOMATIC_CAPTURE_JOB);
    await handleJob(job,{store,workerId:'independent-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,notifier:{send:async()=>{throw new Error('No external delivery permitted.');}}});
    expect((await sql.query("SELECT status FROM release_intelligence_capture_attempts WHERE stream_id=$1",[stream])).rows).toEqual([{status:'captured'}]);
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[stream])).rows).toHaveLength(2);
    expect((await sql.query('SELECT id FROM installations')).rows).toHaveLength(0);
    expect((await sql.query('SELECT id FROM release_intelligence_baselines')).rows).toHaveLength(0);
  }finally{await sql.close();}
},60_000);
