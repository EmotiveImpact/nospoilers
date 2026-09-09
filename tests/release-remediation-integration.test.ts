import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {mintWorkspaceToken} from '../src/server/workspace-tokens.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import {scan} from '../src/scanner/index.ts';
import {buildUnsignedReceipt,signReceipt} from '../src/receipt.ts';
import {publishReleaseObservation} from '../src/server/release-publication.ts';
it('connects investigation, declared review and verified rebuilt evidence with immutable, revocable history',async()=>{
  const database=process.env.NOSPOILERS_REMEDIATION_TEST_DATABASE_URL;
  if(database){const u=new URL(database);if(u.hostname!=='127.0.0.1'||u.pathname!=='/nospoilers_pr44_review')throw new Error('Use the disposable review database.');}
  const sql=await openSql(database??'pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);await migrateReleaseIntelligence(sql);
    const secrets={sessionSecret:'remediation-session',receiptSecret:'remediation-receipt'},store=createStore(sql,{tokenSecret:secrets.sessionSecret}),base='http://127.0.0.1:4347';
    const cookies:Record<string,string>={};for(const actor of ['fix-owner','fix-viewer','fix-foreign']){await store.upsertUser({id:actor,login:actor});cookies[actor]=`ns_session=${signSession(secrets.sessionSecret,await store.createSession(actor))}`;}
    const [workspace]=await listUserWorkspaces(sql,'fix-owner');await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'fix-viewer','viewer','explicit')",[workspace.id]);
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:base})});
    const app=withReleaseIntelligence(core,{sql,appBaseUrl:base,ports:r=>intelligencePorts(r,secrets),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref)});
    const request=(path:string,payload?:object,actor='fix-owner',headers:Record<string,string>={})=>app.fetch(new Request(base+path,{method:payload?'POST':'GET',headers:{...(cookies[actor]?{cookie:cookies[actor]}:{}),origin:base,'content-type':'application/json',...headers},...(payload?{body:JSON.stringify(payload)}:{})}));
    const dirty=await scan('fixtures/sourcemap.tgz'),clean=await scan('fixtures/clean.tgz'),now=Date.now();
    async function insert(report:typeof clean,label:string,age:number){
      const revised={...report,scannedAt:new Date(now-age).toISOString()},receipt=signReceipt(buildUnsignedReceipt(revised,`upload:${label}`),secrets.receiptSecret),record={kind:'upload',id:randomUUID()};
      await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json) VALUES($1,'fix-owner',$2,$3,$4,'done',$5::jsonb,$6::jsonb)`,[record.id,workspace.id,label,report.artifactSha256,JSON.stringify(revised),JSON.stringify(receipt)]);return {record,receipt};
    }
    const original=await insert(dirty,'original',60000),rebuilt=await insert(clean,'rebuilt',1000);
    const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:'Remediation build',key:'remediation-build',role:'Package',record:original.record});expect(created.status).toBe(201);
    const {stream,snapshot}=await created.json() as {stream:{id:string};snapshot:{id:string}},path=`/api/release-intelligence/streams/${stream.id}`,endpoint=`${path}/remediation`;
    const candidate=await (await request(`${path}/records`,{record:rebuilt.record})).json() as {snapshot:{id:string}};
    const start={action:'start',snapshotId:snapshot.id,finding:original.receipt.findingFingerprints[0],reason:'Investigate original release exposure.'};
    expect((await request(endpoint,start,'')).status).toBe(401);expect((await request(endpoint,start,'fix-viewer')).status).toBe(403);expect((await request(endpoint,undefined,'fix-foreign')).status).toBe(404);
    expect((await request(endpoint,start,'fix-owner',{origin:'https://foreign.invalid'})).status).toBe(403);
    const token=await mintWorkspaceToken(sql,'fix-owner',workspace.id,'Not a remediation actor');expect((await request(endpoint,start,'',{authorization:`Bearer ${token.token}`})).status).toBe(403);
    expect((await request(endpoint,undefined,'',{authorization:`Bearer ${token.token}`})).status).toBe(403);
    const first=await request(endpoint,start);expect(first.status).toBe(200);const tracking=await first.json() as {caseId:string;revision:number};
    expect(await (await request(endpoint,start)).json()).toMatchObject({caseId:tracking.caseId,inserted:false});
    const review={action:'review',caseId:tracking.caseId,expectedRevision:1,reason:'Reviewed the packaging change for this finding.',changeUrl:'https://github.com/qa/app/pull/7',commit:'a'.repeat(40),reviewedAt:new Date(now-30000).toISOString(),confirm:true};
    expect((await request(endpoint,{...review,confirm:false})).status).toBe(400);expect((await request(endpoint,{...review,changeUrl:'javascript:alert(1)'})).status).toBe(400);
    const races=await Promise.all([request(endpoint,review),request(endpoint,review)]);expect(races.map(r=>r.status).sort()).toEqual([200,409]);
    const verify={action:'verify',caseId:tracking.caseId,expectedRevision:2,candidateSnapshot:candidate.snapshot.id,reason:'This fresh rebuilt artifact includes the reviewed change.',confirm:true};
    expect((await request(endpoint,{...verify,confirm:false})).status).toBe(400);
    const checked=await request(endpoint,verify);expect(checked.status).toBe(200);expect(await checked.json()).toMatchObject({revision:3,observation:{state:'verified_absent'}});
    const read=()=>request(endpoint).then(r=>r.json()) as Promise<{selected:{observation:{state:string}|null;unavailable:boolean;history:Array<{action:string}>}}>;
    expect((await read()).selected.observation?.state).toBe('verified_absent');
    const clock=vi.spyOn(Date,'now').mockReturnValue(now+25*3600000);try{expect((await read()).selected.observation?.state).toBe('unknown');}finally{clock.mockRestore();}
    expect((await request(endpoint,{action:'reopen',caseId:tracking.caseId,expectedRevision:3,reason:'Investigate whether this may recur in later releases.'})).status).toBe(200);expect((await read()).selected.observation).toBeNull();
    expect((await request(endpoint,{...verify,expectedRevision:4})).status).toBe(200);
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'fix-owner')",[workspace.id]);expect((await request(endpoint)).status).toBe(404);
    await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='fix-owner'",[workspace.id]);
    await expect(sql.query("UPDATE release_remediation_events SET actor_login='other' WHERE case_id=$1",[tracking.caseId])).rejects.toThrow('immutable');
    expect((await sql.query('SELECT receipt_json FROM uploaded_scans WHERE id=$1',[original.record.id])).rows[0]).toEqual({receipt_json:original.receipt});
    await expect(sql.query("UPDATE uploaded_scans SET receipt_json=jsonb_set(receipt_json,'{engineVersion}','\"tampered\"') WHERE id=$1",[rebuilt.record.id])).rejects.toThrow('immutable');
    await sql.query('DELETE FROM uploaded_scans WHERE id=$1',[rebuilt.record.id]);expect((await read()).selected).toMatchObject({observation:null,unavailable:true});
    await sql.query('DELETE FROM uploaded_scans WHERE id=$1',[original.record.id]);expect((await sql.query('SELECT id FROM release_remediation_cases')).rows).toHaveLength(0);expect((await sql.query('SELECT id FROM release_remediation_events')).rows).toHaveLength(0);

    // Connected release streams can contain multiple assets: a clean neighbour is not a fix.
    await store.upsertInstallation({id:993,accountId:993,accountLogin:'fix-org',accountType:'Organization'});await store.linkUserInstallation(993,'fix-owner');
    const connected=(await listUserWorkspaces(sql,'fix-owner')).find(w=>Number(w.installation_id)===993)!;
    await store.upsertRepo({id:9930,installationId:993,owner:'qa',name:'app',fullName:'qa/app',private:false,htmlUrl:'https://github.com/qa/app'});
    async function publish(name:string,report:typeof clean,age:number,tag:string){const result=await publishReleaseObservation({store,installationId:993,repoId:9930,secret:secrets.receiptSecret,tag,assets:[{name,coordinate:`github:qa/app@${tag}#${name}`,report:{...report,scannedAt:new Date(now-age).toISOString()}}],alert:()=>({installationId:993,kind:'release_scan',title:'QA',body:'Synthetic'})});return {kind:'release',id:String(result!.alert.releaseRevisionIds![0])};}
    const source=await publish('app.tgz',dirty,60000,'v1'),wrong=await publish('other.tgz',clean,1000,'v2'),right=await publish('app.tgz',clean,1000,'v2');
    const hosted=await (await request('/api/release-intelligence/streams',{workspaceId:connected.id,name:'Connected fix',key:'connected-fix',role:'Package',record:source})).json() as {stream:{id:string};snapshot:{id:string}};
    const hostedPath=`/api/release-intelligence/streams/${hosted.stream.id}`,hostedEndpoint=`${hostedPath}/remediation`;
    const wrongSnap=await (await request(`${hostedPath}/records`,{record:wrong})).json() as {snapshot:{id:string}},rightSnap=await (await request(`${hostedPath}/records`,{record:right})).json() as {snapshot:{id:string}};
    const hostedCase=await (await request(hostedEndpoint,{...start,snapshotId:hosted.snapshot.id})).json() as {caseId:string};
    expect((await request(hostedEndpoint,{...review,caseId:hostedCase.caseId})).status).toBe(200);
    expect((await request(hostedEndpoint,{...verify,caseId:hostedCase.caseId,candidateSnapshot:wrongSnap.snapshot.id})).status).toBe(409);
    expect(await (await request(hostedEndpoint,{...verify,caseId:hostedCase.caseId,candidateSnapshot:rightSnap.snapshot.id})).json()).toMatchObject({observation:{state:'verified_absent'}});
    await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=993");
    expect((await request(hostedEndpoint)).status).toBe(200);expect((await request(hostedEndpoint,{...verify,expectedRevision:3,caseId:hostedCase.caseId,candidateSnapshot:rightSnap.snapshot.id})).status).toBe(402);
  }finally{await sql.close();}
},60000);
