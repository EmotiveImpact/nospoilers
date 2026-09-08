import {it,expect} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {persistHostedReceipt} from '../src/server/receipts.ts';
import {skippedGithubWrites,type GithubPort} from '../src/server/github.ts';

it('authorises related releases against the session, installation and selected workspace',async()=>{
  const sql=await openSql('pglite://:memory:');
  try {
    await migrate(sql);const store=createStore(sql);
    const fail=async():Promise<never>=>{throw new Error('Unexpected GitHub request');};
    const github:GithubPort={exchangeCode:fail,getUser:fail,listUserInstallations:fail,getInstallation:fail,getRepo:fail,listReleaseAssets:fail,getLatestRelease:fail,downloadAsset:fail,...skippedGithubWrites()};
    const app=createApp({store,github,config:loadConfig({appBaseUrl:'http://127.0.0.1:4347',sessionSecret:'alert-api'})});
    for(const id of ['owner','stranger'])await store.upsertUser({id,login:id});
    for(const id of [501,502]){
      await store.upsertInstallation({id,accountId:id,accountLogin:`org${id}`,accountType:'Organization'});
      await store.linkUserInstallation(id,'owner');
    }
    const workspaces=await listUserWorkspaces(sql,'owner');
    const workspace=workspaces.find(w=>Number(w.installation_id)===501)!;
    const foreign=workspaces.find(w=>Number(w.installation_id)===502)!;
    const persisted=await persistHostedReceipt({store,secret:'test',installationId:501,coordinate:'npm:example@1.0.0',channel:'stable',report:{
      target:'artifact.tgz',kind:'tarball',fileCount:1,findings:[],ok:true,status:'passed',inconclusiveReason:null,
      manifest:[],engineVersion:'test',artifactSha256:'aa'.repeat(32),artifactSha512:null,artifactBytes:1,
      scannedAt:new Date().toISOString(),suppressed:[],policyHash:null,
    }});
    const base={installationId:501,kind:'npm_scan',title:'Recorded scan',body:'Actual evidence'};
    const id=await store.insertAlert({...base,releaseRevisionIds:[persisted.revision.id]});
    const path=`/api/alerts/${id}/releases`;
    const headers={cookie:`ns_session=${signSession('alert-api',await store.createSession('owner'))}`};
    const query=`?installationId=501&workspaceId=${workspace.id}`;
    expect((await app.request(path+query)).status).toBe(401);
    const response=await app.request(path+query,{headers});
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({releases:[{id:persisted.revision.id,coordinate:'npm:example@1.0.0'}]});
    for(const suffix of [`?installationId=502&workspaceId=${workspace.id}`,`?installationId=501&workspaceId=${foreign.id}`]){
      const denied=await app.request(path+suffix,{headers});expect(denied.status).toBe(404);
      expect(await denied.json()).toEqual({error:'Unknown alert.'});
    }
    const stranger={cookie:`ns_session=${signSession('alert-api',await store.createSession('stranger'))}`};
    expect((await app.request(path+query,{headers:stranger})).status).toBe(404);
    const legacy=await store.insertAlert(base);
    const empty=await app.request(`/api/alerts/${legacy}/releases${query}`,{headers});
    expect(empty.status).toBe(200);expect(await empty.json()).toEqual({releases:[]});
  } finally {await sql.close();}
},30000);
