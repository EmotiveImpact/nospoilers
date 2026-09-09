import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import type {ExplanationProvider,ExplanationView} from '../src/server/release-explanations.ts';
import {scan} from '../src/scanner/index.ts';
import {buildUnsignedReceipt,signReceipt} from '../src/receipt.ts';

it('wires private explanation availability to real sessions and signed records without activating a provider',async()=>{
  const database=process.env.NOSPOILERS_EXPLANATIONS_TEST_DATABASE_URL;
  if(database){const parsed=new URL(database);if(parsed.hostname!=='127.0.0.1'||parsed.port!=='55449'||parsed.pathname!=='/nospoilers_explanation_test')throw new Error('Use only the disposable explanation test database.');}
  const sql=await openSql(database??'pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);await migrateReleaseIntelligence(sql);
    const secrets={sessionSecret:'explanation-session',receiptSecret:'explanation-receipt'},store=createStore(sql),base='http://127.0.0.1:4347';
    const cookies:Record<string,string>={};
    for(const actor of ['explanation-owner','explanation-viewer','explanation-outsider']){
      await store.upsertUser({id:actor,login:actor});cookies[actor]=`ns_session=${signSession(secrets.sessionSecret,await store.createSession(actor))}`;
    }
    const [workspace]=await listUserWorkspaces(sql,'explanation-owner');
    await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'explanation-viewer','viewer','explicit')",[workspace.id]);
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:base})});
    const wrap=(explanationProvider?:ExplanationProvider)=>withReleaseIntelligence(core,{sql,appBaseUrl:base,ports:r=>intelligencePorts(r,secrets),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref),explanationProvider});
    let app=wrap();
    const request=(path:string,payload?:object,actor='explanation-owner',origin=base)=>app.fetch(new Request(base+path,{method:payload?'POST':'GET',headers:{...(cookies[actor]?{cookie:cookies[actor]}:{}),origin,'content-type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})}));
    const report=await scan('fixtures/clean.tgz'),receipt=signReceipt(buildUnsignedReceipt(report,'upload:explanation-test'),secrets.receiptSecret),record={kind:'upload',id:randomUUID()};
    await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json) VALUES($1,'explanation-owner',$2,'explanation-test',$3,'done',$4::jsonb,$5::jsonb)`,[record.id,workspace.id,report.artifactSha256,JSON.stringify(report),JSON.stringify(receipt)]);
    const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:'Explanation test',key:'explanation-test',role:'Package',record});
    expect(created.status).toBe(201);
    const {stream,snapshot}=await created.json() as {stream:{id:string};snapshot:{id:string}};
    const endpoint=`/api/release-intelligence/streams/${stream.id}/explanations`,url=`${endpoint}?snapshotId=${snapshot.id}`;
    const response=await request(url);expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({available:false,canRequest:false});
    expect((await request(url,undefined,'')).status).toBe(401);
    expect((await request(url,undefined,'explanation-outsider')).status).toBe(404);
    expect((await request(`${endpoint}?snapshotId=${randomUUID()}`)).status).toBe(404);
    const input={action:'request',snapshotId:snapshot.id,requestKey:randomUUID(),confirm:true};
    expect((await request(endpoint,input,'explanation-owner','https://foreign.invalid')).status).toBe(403);
    expect((await request(endpoint,input,'explanation-viewer')).status).toBe(403);
    expect((await request(endpoint,input)).status).toBe(503);
    let calls=0;
    app=wrap({id:'test-only',model:'test-contract',currency:'USD',maxCostMinor:1,dailyCostMinor:5,maxOutputTokens:300,explain:async()=>{calls++;return 'The saved aggregate evidence is passed; review the original signed findings before acting.';}});
    const enabled=await (await request(url)).json() as ExplanationView;
    const generate={...input,consentKey:enabled.consentKey};
    const generated=await request(endpoint,generate);expect(generated.status).toBe(200);
    const draft=await generated.json() as ExplanationView;expect(draft.items[0].state).toBe('pending');expect(calls).toBe(1);
    expect((await request(endpoint,generate)).status).toBe(200);expect(calls).toBe(1);
    expect((await request(endpoint,{action:'review',snapshotId:snapshot.id,explanationId:draft.items[0].id,accept:true,reviewedText:'Reviewed explanatory text, not release approval.',confirm:true})).status).toBe(200);
    const reviewed=await (await request(url)).json() as ExplanationView;expect(reviewed.items[0]).toMatchObject({state:'accepted',reviewed_text:'Reviewed explanatory text, not release approval.'});
    expect((await sql.query('SELECT receipt_json FROM uploaded_scans WHERE id=$1',[record.id])).rows[0]).toEqual({receipt_json:receipt});
  }finally{await sql.close();}
},60000);
