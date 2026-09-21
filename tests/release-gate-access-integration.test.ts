import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {mintWorkspaceToken,revokeWorkspaceToken} from '../src/server/workspace-tokens.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import {publishReleaseObservation} from '../src/server/release-publication.ts';
import {scan} from '../src/scanner/index.ts';
import {runGate} from '../src/cli-gate.ts';
it('grants exact connected-asset CI access without widening general token permissions',async()=>{
  const database=process.env.NOSPOILERS_GATE_TEST_DATABASE_URL;
  if(database){const u=new URL(database);if(u.hostname!=='127.0.0.1'||u.pathname!=='/nospoilers_pr44_review')throw new Error('Use the disposable gate database.');}
  const sql=await openSql(database??'pglite://:memory:');
  try{
    await migrate(sql);await migrateReleaseIntelligence(sql);await migrateReleaseIntelligence(sql);
    const secrets={sessionSecret:'grant-session',receiptSecret:'grant-receipt'},store=createStore(sql,{tokenSecret:secrets.sessionSecret}),base='http://127.0.0.1:4347';
    await store.upsertUser({id:'grant-owner',login:'grant-owner'});await store.upsertUser({id:'grant-viewer',login:'grant-viewer'});
    await store.upsertInstallation({id:992,accountId:992,accountLogin:'grant-org',accountType:'Organization'});await store.linkUserInstallation(992,'grant-owner');
    const workspace=(await listUserWorkspaces(sql,'grant-owner')).find(w=>Number(w.installation_id)===992)!;
    await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'grant-viewer','viewer','explicit')",[workspace.id]);
    const cookie=`ns_session=${signSession(secrets.sessionSecret,await store.createSession('grant-owner'))}`;
    const viewer=`ns_session=${signSession(secrets.sessionSecret,await store.createSession('grant-viewer'))}`;
    const core=createApp({store,github:stubGithub(),config:loadConfig({...secrets,appBaseUrl:base})});
    const app=withReleaseIntelligence(core,{sql,appBaseUrl:base,ports:r=>intelligencePorts(r,secrets),reserve:async()=>true,context:(r,ref)=>intelligencePorts(r,secrets).context(sql,ref)});
    const request=(path:string,body?:object,headers:Record<string,string>={cookie})=>app.fetch(new Request(base+path,{method:body?'POST':'GET',headers:{...headers,origin:base,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
    await store.upsertRepo({id:9920,installationId:992,owner:'grant',name:'app',fullName:'grant/app',private:false,htmlUrl:'https://github.com/grant/app'});
    const report=await scan('fixtures/clean.tgz');if(!report.artifactSha256)throw new Error('Expected artifact digest.');
    async function publish(name:string,tag='v1'){
      const result=await publishReleaseObservation({store,installationId:992,repoId:9920,secret:secrets.receiptSecret,tag,
        assets:[{name,coordinate:`github:grant/app@${tag}#${name}`,report}],alert:()=>({installationId:992,kind:'release_scan',title:'QA',body:'Synthetic'})});
      return {kind:'release' as const,id:String(result!.alert.releaseRevisionIds![0])};
    }
    const record=await publish('app.tgz'),other=await publish('private-assets.tgz');
    const created=await request('/api/release-intelligence/streams',{workspaceId:workspace.id,name:'CI build',key:'ci-build',role:'Package',record});expect(created.status).toBe(201);
    const stream=(await created.json() as {stream:{id:string}}).stream.id,path=`/api/release-intelligence/streams/${stream}`,gate=`${path}/gate`,access=`${path}/gate-access`;
    expect((await request(`${path}/records`,{record:other})).status).toBe(200); // Same repo/format is not the same selected asset.
    const token=await mintWorkspaceToken(sql,'grant-owner',workspace.id,'Connected CI'),bearer={authorization:`Bearer ${token.token}`};
    const grant={tokenId:Number(token.scanToken.id),enabled:true,expectedRevision:0,record,days:30,reason:'Allow gate checks for this exact release asset.',confirm:true};
    expect((await request(gate,undefined,bearer)).status).toBe(403);
    expect((await request(access,grant,bearer)).status).toBe(403);
    expect((await request(access,grant,{cookie:viewer})).status).not.toBe(200);
    const competing=await Promise.all([request(access,grant),request(access,grant)]);expect(competing.map(r=>r.status).sort()).toEqual([200,409]);
    const visible=await request(gate,undefined,bearer);expect(visible.status).toBe(200);expect(await visible.json()).toMatchObject({policies:[],decisions:[],canManage:false});
    expect((await request(path,undefined,bearer)).status).toBe(403);
    expect((await request(`/api/releases/${record.id}`,undefined,bearer)).status).not.toBe(200);
    expect((await request(gate,{action:'configure',mode:'enforce',maxAgeHours:24,expectedRevision:0,reason:'A token must not adopt policy.',confirm:true},bearer)).status).toBe(403);
    expect((await request(gate,{action:'configure',mode:'enforce',maxAgeHours:24,expectedRevision:0,reason:'Explicitly adopt this gate policy.',confirm:true})).status).toBe(200);
    const evaluation={action:'evaluate',requestKey:randomUUID(),record,digest:report.artifactSha256,deploymentId:'connected-deployment',expectedPolicyRevision:1};
    expect((await request(gate,{...evaluation,record:other},bearer)).status).toBe(403);
    const evaluated=await request(gate,evaluation,bearer);expect(evaluated.status).toBe(201);const decision=await evaluated.json() as {id:string};
    expect((await request(access,{...grant,enabled:false,expectedRevision:1})).status).toBe(200);
    const consume={action:'consume',decisionId:decision.id,record,digest:report.artifactSha256,deploymentId:'connected-deployment',expectedPolicyRevision:1};
    expect((await request(gate,consume,bearer)).status).toBe(403);
    expect((await request(access,{...grant,expectedRevision:2})).status).toBe(200);
    expect((await request(gate,consume,bearer)).status).toBe(409); // Renewal never revives an old grant decision.
    const transport:typeof fetch=(url,init)=>app.fetch(new Request(String(url),init));
    expect((await runGate({api:base,token:token.token,stream,release:record.id,digest:report.artifactSha256,deployment:'fresh-connected-deployment'},transport)).exitCode).toBe(0);
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'grant-owner')",[workspace.id]);
    expect((await request(gate,undefined,bearer)).status).toBe(404);
    await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='grant-owner'",[workspace.id]);
    await sql.query("UPDATE release_gate_ci_grants SET expires_at=now()-interval '1 second' WHERE stream_id=$1",[stream]);
    expect((await request(gate,undefined,bearer)).status).toBe(403);
    expect((await request(access,{...grant,expectedRevision:3})).status).toBe(200);
    await sql.query('UPDATE repos SET disconnected_at=now() WHERE id=9920');
    expect((await request(gate,undefined,bearer)).status).toBe(403);
    await sql.query('UPDATE repos SET disconnected_at=NULL WHERE id=9920');
    expect((await request(gate,undefined,bearer)).status).toBe(403); // Connection generation changed.
    expect((await request(access,{...grant,expectedRevision:4})).status).toBe(200);
    await store.deleteInstallation(992);
    expect((await request(gate,undefined,bearer)).status).not.toBe(200);
    await sql.query('UPDATE installations SET suspended=false,disconnected_at=NULL WHERE id=992');
    expect((await request(gate,undefined,bearer)).status).toBe(403);
    expect((await request(access,{...grant,expectedRevision:5})).status).toBe(200);
    await revokeWorkspaceToken(sql,'grant-owner',workspace.id,String(token.scanToken.id),'Connected CI');
    expect((await request(gate,undefined,bearer)).status).toBe(401);
    expect((await request(access,{...grant,enabled:false,expectedRevision:6})).status).toBe(200);
    expect((await sql.query("SELECT detail FROM release_intelligence_events WHERE stream_id=$1 AND action='release_gate_ci_access_changed'",[stream])).rows).toHaveLength(7);
  }finally{await sql.close();}
},60_000);
