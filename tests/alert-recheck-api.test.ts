import {it,expect} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {skippedGithubWrites,type GithubPort} from '../src/server/github.ts';

it('scopes recheck descriptors and preserves the original alert when a viewer cannot start work',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    const fail=async():Promise<never>=>{throw new Error('Unexpected GitHub request');};
    const github:GithubPort={exchangeCode:fail,getUser:fail,listUserInstallations:fail,getInstallation:fail,getRepo:fail,listReleaseAssets:fail,getLatestRelease:fail,downloadAsset:fail,...skippedGithubWrites()};
    const app=createApp({store,github,config:loadConfig({appBaseUrl:'http://127.0.0.1:4347',sessionSecret:'recheck'})});
    for(const id of ['owner','stranger'])await store.upsertUser({id,login:id});
    for(const id of [601,602]){await store.upsertInstallation({id,accountId:id,accountLogin:`org${id}`,accountType:'Organization'});await store.linkUserInstallation(id,'owner');}
    await store.upsertRepo({id:601,installationId:601,owner:'org601',name:'repo',fullName:'org601/repo',private:true,htmlUrl:'https://github.com/org601/repo'});
    const workspaces=await listUserWorkspaces(sql,'owner'),workspace=workspaces.find(w=>Number(w.installation_id)===601)!,foreign=workspaces.find(w=>Number(w.installation_id)===602)!;
    const id=await store.insertAlert({installationId:601,repoId:601,kind:'release_scan',title:'Release issue',body:'Saved result'});
    const path=`/api/alerts/${id}/recheck`,query=`?installationId=601&workspaceId=${workspace.id}`;
    const headers={cookie:`ns_session=${signSession('recheck',await store.createSession('owner'))}`};
    expect((await app.request(path+query)).status).toBe(401);
    const response=await app.request(path+query,{headers});expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({target:{installationId:601,endpoint:'/api/repos/601/scan-latest-release'}});
    for(const suffix of [`?installationId=602&workspaceId=${workspace.id}`,`?installationId=601&workspaceId=${foreign.id}`])expect((await app.request(path+suffix,{headers})).status).toBe(404);
    const stranger={cookie:`ns_session=${signSession('recheck',await store.createSession('stranger'))}`};
    expect((await app.request(path+query,{headers:stranger})).status).toBe(404);
    await sql.query("UPDATE product_workspace_members SET role='viewer',access_source='explicit' WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
    expect((await app.request('/api/repos/601/scan-latest-release',{method:'POST',headers:{...headers,origin:'http://127.0.0.1:4347'}})).status).toBe(403);
    expect((await store.getAlertForUser(id,'owner'))?.resolved_at).toBeNull();
    expect((await sql.query('SELECT id FROM jobs')).rows).toHaveLength(0);
    await sql.query("UPDATE product_workspace_members SET role='member' WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
    const started=await app.request('/api/repos/601/scan-latest-release',{method:'POST',headers:{...headers,origin:'http://127.0.0.1:4347'}});
    expect(started.status).toBe(200);expect(await started.json()).toMatchObject({ok:true,queued:true});
    expect((await sql.query('SELECT kind FROM jobs')).rows).toEqual([{kind:'scan_latest_release'}]);
    expect((await store.getAlertForUser(id,'owner'))?.resolved_at).toBeNull();
  }finally{await sql.close();}
},30000);
