import {it,expect,vi} from 'vitest';
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
import {PRODUCTION_PARITY_JOB} from '../src/server/production-parity-service.ts';
import {randomUUID} from 'node:crypto';

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
      const competing=await Promise.all([request(path,input),request(path,input)]);
      expect(competing.map(response=>response.status).sort()).toEqual([200,409]);
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
    const unavailableSeed=await request(`${repo.path}?recordKind=release&recordId=999999999`);
    expect(unavailableSeed.status).toBe(200);
    expect(await unavailableSeed.json()).toMatchObject({config:{enabled:true,revision:1},candidate:null,canDisable:true});
    expect((await request(repo.path,{enabled:true,expectedRevision:1,record:{kind:'release',id:'999999999'},confirm:true,reason:'Missing evidence must not enable capture.'})).status).toBe(404);
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
    const billing=(await sql.query<{plan:string|null;trial_ends_at:string|Date|null}>('SELECT plan,trial_ends_at FROM billing_accounts WHERE installation_id=881')).rows[0];
    await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=881");
    expect(await (await request(website.path)).json()).toMatchObject({canManage:false,canDisable:true});
    expect((await request(website.path,{enabled:false,expectedRevision:1,reason:'Stop capture even though coverage has ended.'})).status).toBe(200);
    expect((await request(website.path,{enabled:true,expectedRevision:2,record:website.record,confirm:true,reason:'Expired coverage cannot restart capture.'})).status).toBe(402);
    await sql.query('UPDATE billing_accounts SET plan=$1,trial_ends_at=$2 WHERE installation_id=881',[billing.plan,billing.trial_ends_at]);
    // Revoking the enabling administrator prevents queued work from writing.
    await publishNpm('1.0.2');
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'capture-owner')",[workspace.id]);
    await run();
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE stream_id=$1',[npm.stream])).rows).toHaveLength(2);
    // Existing hosted append-only policy remains intact; capture cannot bypass it.
    await expect(sql.query('DELETE FROM release_revisions WHERE id=$1',[second])).rejects.toThrow('append-only');
  }finally{await sql.close();}
},60_000);

it('captures verified independent-workspace website completions without a GitHub installation',async()=>{
  const database=process.env.NOSPOILERS_PARITY_TEST_DATABASE_URL;
  if(database){const url=new URL(database);if(url.hostname!=='127.0.0.1'||url.pathname!=='/nospoilers_pr44_review')throw new Error('Use the disposable parity integration database.');}
  const sql=await openSql(database??'pglite://:memory:');
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
    const createdBody=await created.json() as {stream:{id:string};snapshot:{id:string}};
    const stream=createdBody.stream.id;
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
    // The same authenticated stream can bind an approved manifest to production.
    expect((await request(`/api/release-intelligence/streams/${stream}/baseline`,{action:'adopt',snapshotId:createdBody.snapshot.id,expectedRevision:0,reason:'Reviewed the exact synthetic website manifest.'})).status).toBe(200);
    const parityPath=`/api/release-intelligence/streams/${stream}/production-parity`;
    const parityInput={requestKey:'9c27a17e-1c97-4a70-b85b-9976ec6a6199',expectedBaselineRevision:1,originId:origin.id,deploymentId:'synthetic-deploy-1',deployedAt:new Date(Date.now()-1000).toISOString(),mappings:[{path:'index.html',servedPath:'/',representation:'identity'}],confirm:true};
    const queued=await request(parityPath,parityInput);
    expect(queued.status).toBe(202);
    const queuedBody=await queued.json() as {id:string};
    const repeated=await request(parityPath,parityInput);expect(repeated.status).toBe(202);expect(await repeated.json()).toMatchObject({id:queuedBody.id});
    // Earlier website attempts were processed directly above, outside the loop.
    await sql.query("UPDATE jobs SET status='done' WHERE kind='workspace_origin_scan'");
    const parityJob=await store.claimJob('heavy',1,'parity-worker');expect(parityJob?.kind).toBe(PRODUCTION_PARITY_JOB);
    if(!parityJob)throw new Error('Expected the queued production observation.');
    await handleJob(parityJob,{store,workerId:'parity-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,
      webLookup:async()=>[{address:'1.1.1.1',family:4}],webFetch:async()=>new Response('<html>Owned synthetic website</html>',{headers:{'content-type':'text/html'}}),notifier:{send:async()=>{throw new Error('No external delivery permitted.');}}});
    const observation=(await sql.query<{status:string;result:{assets:Array<{state:string}>}}>('SELECT status,result FROM release_production_observations WHERE id=$1',[queuedBody.id])).rows[0];
    expect(observation.status).toBe('completed');expect(observation.result.assets[0].state).toBe('matched');
    await store.finishJob(parityJob.id,undefined,'parity-worker');
    const readParity=async()=>{
      const response=await app.fetch(new Request(base+parityPath,{headers:{cookie}}));expect(response.status).toBe(200);
      return response.json() as Promise<{runs:Array<{id:string;authorityCurrent:boolean;stale:boolean;result:unknown}>}>;
    };
    expect((await readParity()).runs[0].authorityCurrent).toBe(true);
    expect((await readParity()).runs[0].stale).toBe(false);
    const completed=(await sql.query<{completed_at:string|Date}>('SELECT completed_at FROM release_production_observations WHERE id=$1',[queuedBody.id])).rows[0].completed_at;
    const parityClock=vi.spyOn(Date,'now').mockReturnValue(new Date(completed).getTime()+24*60*60*1000+1);
    try{
      const aged=(await readParity()).runs.find(run=>run.id===queuedBody.id)!;
      expect(aged.stale).toBe(true);expect(aged.result).toEqual(observation.result);
    }finally{parityClock.mockRestore();}
    const cancelQueued=await request(parityPath,{...parityInput,requestKey:'9c27a17e-1c97-4a70-b85b-9976ec6a6198'});
    expect(cancelQueued.status).toBe(202);const cancelId=(await cancelQueued.json() as {id:string}).id;
    expect((await request(parityPath,{action:'cancel',runId:cancelId})).status).toBe(200);
    expect(await store.claimJob('heavy',1,'cancelled-parity-worker')).toBeNull();
    expect((await sql.query('SELECT j.status,j.usage_reserved FROM jobs j JOIN release_production_observations r ON r.job_id=j.id WHERE r.id=$1',[cancelId])).rows).toEqual([{status:'done',usage_reserved:false}]);
    // Mutate authority after the request starts, not merely before queueing.
    for(const change of ['cancel','revoke','lease'] as const){
      const response=await request(parityPath,{...parityInput,requestKey:randomUUID()});
      expect(response.status).toBe(202);const runId=(await response.json() as {id:string}).id;
      const claimed=await store.claimJob('heavy',1,'race-worker');expect(claimed?.kind).toBe(PRODUCTION_PARITY_JOB);
      if(!claimed)throw new Error('Expected race observation job.');
      let requests=0;
      await handleJob(claimed,{store,workerId:'race-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,
        webLookup:async()=>[{address:'1.1.1.1',family:4}],webFetch:async()=>{
          requests++;
          if(change==='cancel')expect((await request(parityPath,{action:'cancel',runId})).status).toBe(200);
          if(change==='revoke')await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'independent-owner')",[workspace.id]);
          if(change==='lease')await sql.query("UPDATE jobs SET locked_by='replacement-worker' WHERE id=$1",[claimed.id]);
          return new Response('<html>Owned synthetic website</html>',{headers:{'content-type':'text/html'}});
        },notifier:{send:async()=>{throw new Error('No external delivery permitted.');}}});
      expect(requests).toBe(1);
      expect((await sql.query('SELECT status,result FROM release_production_observations WHERE id=$1',[runId])).rows).toEqual([{status:change==='cancel'?'cancelled':change==='revoke'?'stopped':'running',result:null}]);
      if(change==='revoke')await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='independent-owner'",[workspace.id]);
      if(change==='lease'){
        // The legitimate replacement owner can retry; the former worker saved nothing.
        await handleJob(claimed,{store,workerId:'replacement-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,
          webLookup:async()=>[{address:'1.1.1.1',family:4}],webFetch:async()=>new Response('<html>Owned synthetic website</html>',{headers:{'content-type':'text/html'}}),notifier:{send:async()=>{throw new Error('No external delivery permitted.');}}});
        expect((await sql.query('SELECT status FROM release_production_observations WHERE id=$1',[runId])).rows).toEqual([{status:'completed'}]);
      }
      await store.finishJob(claimed.id,undefined,change==='lease'?'replacement-worker':'race-worker');
    }
    const delayed=await request(parityPath,{...parityInput,requestKey:randomUUID()});expect(delayed.status).toBe(202);
    const delayedId=(await delayed.json() as {id:string}).id;
    await sql.query("UPDATE watched_origins SET verified_at=now()-interval '31 days' WHERE id=$1",[origin.id]);
    const delayedJob=await store.claimJob('heavy',1,'delayed-parity-worker');expect(delayedJob?.kind).toBe(PRODUCTION_PARITY_JOB);
    if(!delayedJob)throw new Error('Expected queued observation before ownership expiry.');
    let delayedRequests=0,delayedLookups=0;
    await handleJob(delayedJob,{store,workerId:'delayed-parity-worker',receiptSecret:secrets.receiptSecret,github:stubGithub(),scan,maxAssetBytes:100000,
      webLookup:async()=>{delayedLookups++;return [{address:'1.1.1.1',family:4}];},webFetch:async()=>{delayedRequests++;return new Response('Should not fetch expired origin.');},notifier:{send:async()=>{throw new Error('No external delivery permitted.');}}});
    expect(delayedLookups).toBe(0);expect(delayedRequests).toBe(0);
    expect((await sql.query('SELECT status,result FROM release_production_observations WHERE id=$1',[delayedId])).rows).toEqual([{status:'stopped',result:null}]);
    await store.finishJob(delayedJob.id,undefined,'delayed-parity-worker');
    expect((await request(parityPath,{...parityInput,requestKey:'9c27a17e-1c97-4a70-b85b-9976ec6a6197'})).status).toBe(409);
    const historical=(await readParity()).runs.find(r=>r.id===queuedBody.id)!;
    expect(historical.authorityCurrent).toBe(false);expect(historical.result).toEqual(observation.result);
    await expect(sql.query("UPDATE release_production_observations SET result='{}'::jsonb WHERE id=$1",[queuedBody.id])).rejects.toThrow('immutable');
    // Where original upload deletion is permitted, dependent capture data cascades.
    await sql.query('DELETE FROM uploaded_scans WHERE id=$1',[next]);
    expect((await sql.query('SELECT id FROM release_intelligence_capture_attempts WHERE upload_id=$1',[next])).rows).toHaveLength(0);
    expect((await sql.query('SELECT id FROM release_intelligence_snapshots WHERE upload_id=$1',[next])).rows).toHaveLength(0);
    expect((await sql.query('SELECT stream_id FROM release_intelligence_capture_rules WHERE stream_id=$1',[stream])).rows).toHaveLength(1);
    await sql.query('DELETE FROM uploaded_scans WHERE id=$1',[seed]);
    expect((await sql.query('SELECT id FROM release_production_observations WHERE stream_id=$1',[stream])).rows).toHaveLength(0);
  }finally{await sql.close();}
},60_000);
