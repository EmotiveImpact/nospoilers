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
import type {OutcomeSummary} from '../src/release-intelligence/outcomes.ts';

it('derives private monthly outcomes from real signed records with opt-out, deduplication and current remediation',async()=>{
  const database=process.env.NOSPOILERS_OUTCOMES_TEST_DATABASE_URL;
  if(database){const u=new URL(database);if(u.hostname!=='127.0.0.1'||u.pathname!=='/nospoilers_pr44_review')throw new Error('Use the disposable review database.');}
  const sql=await openSql(database??'pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);await migrateReleaseIntelligence(sql);
    const secrets={sessionSecret:'outcome-session',receiptSecret:'outcome-receipt'},store=createStore(sql,{tokenSecret:secrets.sessionSecret}),base='http://127.0.0.1:4347';
    const cookies:Record<string,string>={};for(const actor of ['outcome-owner','outcome-viewer','outcome-foreign']){await store.upsertUser({id:actor,login:actor});cookies[actor]=`ns_session=${signSession(secrets.sessionSecret,await store.createSession(actor))}`;}
    const [workspace]=await listUserWorkspaces(sql,'outcome-owner');await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'outcome-viewer','viewer','explicit')",[workspace.id]);
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:base})});
    const wrap=(receiptSecret=secrets.receiptSecret)=>withReleaseIntelligence(core,{sql,appBaseUrl:base,ports:r=>intelligencePorts(r,{...secrets,receiptSecret}),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref)});
    const app=wrap();
    const request=(path:string,payload?:object,actor='outcome-owner',headers:Record<string,string>={})=>app.fetch(new Request(base+path,{method:payload?'POST':'GET',headers:{...(cookies[actor]?{cookie:cookies[actor]}:{}),origin:base,'content-type':'application/json',...headers},...(payload?{body:JSON.stringify(payload)}:{})}));
    const dirty=await scan('fixtures/sourcemap.tgz'),clean=await scan('fixtures/clean.tgz'),now=Date.now(),month=new Date(now).toISOString().slice(0,7);
    async function insert(report:typeof clean,age:number){const revised={...report,scannedAt:new Date(now-age).toISOString()},receipt=signReceipt(buildUnsignedReceipt(revised,'upload:outcome-fixture'),secrets.receiptSecret),record={kind:'upload',id:randomUUID()};await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json) VALUES($1,'outcome-owner',$2,'outcome-fixture',$3,'done',$4::jsonb,$5::jsonb)`,[record.id,workspace.id,report.artifactSha256,JSON.stringify(revised),JSON.stringify(receipt)]);return {record,receipt};}
    const original=await insert(dirty,60000),rebuilt=await insert(clean,1000),repeat=await insert(clean,500);
    const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:'Outcome fixture',key:'outcome-fixture',role:'Package',record:original.record});expect(created.status).toBe(201);
    const {stream,snapshot}=await created.json() as {stream:{id:string};snapshot:{id:string}},path=`/api/release-intelligence/streams/${stream.id}`,endpoint=`${path}/outcomes`,query=`${endpoint}?month=${month}`;
    const candidate=await (await request(`${path}/records`,{record:rebuilt.record})).json() as {snapshot:{id:string}};await request(`${path}/records`,{record:repeat.record});
    expect(await (await request(query)).json()).toMatchObject({enabled:false,revision:0,summary:null});
    const enable={enabled:true,confirm:true,expectedRevision:0};
    expect((await request(endpoint,enable,'')).status).toBe(401);expect((await request(endpoint,enable,'outcome-viewer')).status).toBe(403);expect((await request(query,undefined,'outcome-foreign')).status).toBe(404);
    expect((await request(endpoint,{...enable,confirm:false})).status).toBe(400);expect((await request(endpoint,enable,'outcome-owner',{origin:'https://foreign.invalid'})).status).toBe(403);
    const token=await mintWorkspaceToken(sql,'outcome-owner',workspace.id,'No human outcomes');expect((await request(query,undefined,'',{authorization:`Bearer ${token.token}`})).status).toBe(403);
    expect((await request(endpoint,enable)).status).toBe(200);
    const read=async()=>{const r=await request(query);expect(r.status).toBe(200);return (await r.json() as {summary:OutcomeSummary}).summary;};
    const initial=await read();expect(initial.records).toMatchObject({retainedInMonth:3,verified:3,distinctArtifacts:2,repeatChecks:1,passed:2,failedPolicy:1,unavailable:0,partial:false});
    expect(initial.type).toBe('nospoilers-private-outcomes');expect(initial.signed).toBe(false);expect(initial.events).toHaveLength(3);
    expect((await request(query,undefined,'outcome-viewer')).status).toBe(200);
    expect((await request(`${endpoint}?month=2026-13`)).status).toBe(400);
    for(const event of initial.events)expect(Object.keys(event).sort()).toEqual(['schemaVersion','id','type','workspaceId','streamId','occurredAt','outcome'].sort());
    expect(JSON.stringify(initial.events)).not.toContain('index.js');expect(JSON.stringify(initial.events)).not.toContain('outcome-owner');
    expect((await request(`${path}/baseline`,{action:'adopt',snapshotId:candidate.snapshot.id,expectedRevision:0,reason:'Use this checked artifact as the reference.'})).status).toBe(200);
    const started=await (await request(`${path}/remediation`,{action:'start',snapshotId:snapshot.id,finding:original.receipt.findingFingerprints[0],reason:'Review original evidence.'})).json() as {caseId:string};
    expect((await request(`${path}/remediation`,{action:'review',caseId:started.caseId,expectedRevision:1,reason:'Reviewed packaging change.',changeUrl:'https://github.com/qa/app/pull/1',commit:'a'.repeat(40),reviewedAt:new Date(now-30000).toISOString(),confirm:true})).status).toBe(200);
    expect((await request(`${path}/remediation`,{action:'verify',caseId:started.caseId,expectedRevision:2,candidateSnapshot:candidate.snapshot.id,reason:'Confirm the rebuilt output.',confirm:true})).status).toBe(200);
    const verified=await read();expect(verified.remediation).toMatchObject({verifiedAbsent:1,unknown:0});expect(verified.reference).toMatchObject({state:'available',adoptedInMonth:1});
    const clock=vi.spyOn(Date,'now').mockReturnValue(now+25*3600000);try{expect((await read()).remediation).toMatchObject({verifiedAbsent:0,unknown:1});}finally{clock.mockRestore();}
    const rotated=await wrap('different-receipt-key').fetch(new Request(base+query,{headers:{cookie:cookies['outcome-owner']}}));expect(rotated.status).toBe(200);const unknown=await rotated.json() as {summary:OutcomeSummary};expect(unknown.summary.records).toMatchObject({verified:0,unavailable:3,passed:0});expect(unknown.summary.latest).toBeNull();
    const races=await Promise.all([request(endpoint,{enabled:false,confirm:true,expectedRevision:1}),request(endpoint,{enabled:false,confirm:true,expectedRevision:1})]);expect(races.map(r=>r.status).sort()).toEqual([200,409]);expect(await (await request(query)).json()).toMatchObject({enabled:false,summary:null});
    expect((await request(endpoint,{...enable,expectedRevision:2})).status).toBe(200);
    await sql.query('DELETE FROM uploaded_scans WHERE id=$1',[rebuilt.record.id]);const missing=await read();expect(missing.reference.state).toBe('unavailable');expect(missing.remediation).toMatchObject({verifiedAbsent:0,unknown:1});expect(missing.records.retainedInMonth).toBe(2);
    await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='outcome-owner'");expect((await request(query)).status).toBe(200);expect((await request(endpoint,{enabled:false,confirm:true,expectedRevision:3})).status).toBe(200);
    expect((await sql.query('SELECT receipt_json FROM uploaded_scans WHERE id=$1',[original.record.id])).rows[0]).toEqual({receipt_json:original.receipt});
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'outcome-owner')",[workspace.id]);expect((await request(query)).status).toBe(404);
    await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='outcome-owner'",[workspace.id]);
    await sql.query("UPDATE users SET plan='solo' WHERE id='outcome-owner'");
    expect((await request(endpoint,{...enable,expectedRevision:4})).status).toBe(200);
    for(let i=0;i<101;i++){const extra=await insert(clean,100);expect((await request(`${path}/records`,{record:extra.record})).status).toBe(200);}
    const bounded=await read();expect(bounded.records).toMatchObject({retainedInMonth:103,inspected:100,verified:100,distinctArtifacts:1,repeatChecks:99,partial:true});expect(bounded.eventsPartial).toBe(true);
    const rate=intelligencePorts(new Request(base+query,{headers:{cookie:cookies['outcome-owner']}}),secrets);
    for(let i=0;i<10;i++)expect(await rate.reserve(sql)).toBe(true);expect(await rate.reserve(sql)).toBe(false);
    const cancelled=new AbortController();cancelled.abort();const aborted=await app.fetch(new Request(base+query,{headers:{cookie:cookies['outcome-owner']},signal:cancelled.signal}));expect(aborted.status).toBe(408);
  }finally{await sql.close();}
},60000);
