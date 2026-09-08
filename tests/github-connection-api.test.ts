import {it,expect} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {githubSignature} from '../src/server/hmac.ts';

it('preserves the workspace/session through start, callback-first waiting, signed webhook and protected completion',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql,{tokenSecret:'secret'});await store.upsertUser({id:'person',login:'person',accessToken:'provider-token'});
  const session=await store.createSession('person'),cookie=`ns_session=${signSession('secret',session)}`;
  const workspace=(await listUserWorkspaces(sql,'person'))[0].id;
  await expect(store.linkUserInstallation(999,'person')).resolves.toBeUndefined();
  expect((await sql.query('SELECT * FROM installations WHERE id=999')).rows).toHaveLength(0);
  const installation={id:999,account:{id:77,login:'owner',type:'User'},app_id:1,created_at:new Date().toISOString(),suspended_at:null};
  const app=createApp({store,config:loadConfig({appBaseUrl:'http://localhost:4347',githubAppId:'1',githubPrivateKey:'configured',githubClientId:'client',githubClientSecret:'client-secret',githubAppSlug:'nospoilers',sessionSecret:'secret',githubWebhookSecret:'signature'}),github:{...stubGithub(),getUser:async()=>({id:77,login:'owner',avatar_url:''}),listUserInstallations:async()=>[999],getInstallation:async()=>installation,listInstallationRepositories:async()=>[]}});
  const path=`/api/workspaces/${workspace}/github`;
  expect((await app.request(path,{method:'POST'})).status).toBe(401);
  expect((await app.request(path,{method:'POST',headers:{cookie,origin:'https://foreign.invalid'}})).status).toBe(403);
  const start=await app.request(path,{method:'POST',headers:{cookie}});expect(start.status).toBe(200);
  const {url}=await start.json() as {url:string};const state=new URL(url).searchParams.get('state')!;
  const callback=await app.request(`/api/github/setup?installation_id=999&state=${encodeURIComponent(state)}`,{headers:{cookie}});
  expect(callback.status).toBe(302);expect(callback.headers.get('location')).toBe(`/watch/setup?githubReturn=1&workspace=${workspace}`);
  const completeCookie=`${cookie}; ${callback.headers.get('set-cookie')!.split(';')[0]}`;
  const complete=()=>app.request('/api/github/connection/complete',{method:'POST',headers:{cookie:completeCookie}});
  expect((await complete()).status).toBe(202);
  const body=JSON.stringify({installation,action:'created',sender:{id:77},repositories:[]});
  const delivery=await app.request('/api/webhooks/github',{method:'POST',headers:{'x-github-event':'installation','x-github-delivery':'created','x-hub-signature-256':githubSignature('signature',body)},body});expect(delivery.status).toBe(200);
  const connected=await complete();expect(connected.status).toBe(200);expect(await connected.json()).toMatchObject({status:'connected',workspaceId:workspace,queued:0});
  expect((await sql.query('SELECT * FROM billing_accounts')).rows).toHaveLength(0);
  expect((await complete()).status).toBe(403);
 }finally{await sql.close();}
});
