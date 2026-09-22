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
  let installed=false;
  const installation={id:999,account:{id:77,login:'owner',type:'User'},app_id:1,created_at:new Date().toISOString(),suspended_at:null};
  const app=createApp({store,config:loadConfig({appBaseUrl:'http://localhost:4347',githubAppId:'1',githubPrivateKey:'configured',githubClientId:'client',githubClientSecret:'client-secret',githubAppSlug:'nospoilers',sessionSecret:'secret',githubWebhookSecret:'signature'}),github:{...stubGithub(),getUser:async()=>({id:77,login:'owner',avatar_url:''}),listUserInstallations:async()=>installed?[999]:[],getInstallation:async()=>installation,listInstallationRepositories:async()=>[]}});
  const path=`/api/workspaces/${workspace}/github`;
  expect((await app.request(path,{method:'POST'})).status).toBe(401);
  expect((await app.request(path,{method:'POST',headers:{cookie,origin:'https://foreign.invalid'}})).status).toBe(403);
  const start=await app.request(path,{method:'POST',headers:{cookie}});expect(start.status).toBe(200);
  const {url}=await start.json() as {url:string};const state=new URL(url).searchParams.get('state')!;
  installed=true;
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

it('offers and explicitly attaches an unbound personal installation without removing it from GitHub',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql,{tokenSecret:'secret'});await store.upsertUser({id:'person',login:'person',accessToken:'provider-token'});
  const session=await store.createSession('person'),cookie=`ns_session=${signSession('secret',session)}`;
  const workspace=(await listUserWorkspaces(sql,'person'))[0].id;
  const installation={id:999,account:{id:77,login:'owner',type:'User'},created_at:'2020-01-01T00:00:00.000Z',suspended_at:null};
  const app=createApp({store,config:loadConfig({appBaseUrl:'http://localhost:4347',githubAppId:'1',githubPrivateKey:'configured',githubClientId:'client',githubClientSecret:'client-secret',githubAppSlug:'nospoilers',sessionSecret:'secret',githubWebhookSecret:'signature'}),github:{...stubGithub(),getUser:async()=>({id:77,login:'owner',avatar_url:''}),listUserInstallations:async()=>[999],getInstallation:async()=>installation,listInstallationRepositories:async()=>[]}});
  const start=await app.request(`/api/workspaces/${workspace}/github`,{method:'POST',headers:{cookie}});expect(start.status).toBe(200);
  expect(await start.json()).toMatchObject({status:'existing_available',installations:[{installationId:999,accountLogin:'owner',accountType:'User'}]});
  const intentCookie=start.headers.get('set-cookie')!.split(';')[0];
  expect((await app.request('/api/github/connection/existing',{method:'POST',headers:{cookie:`${cookie}; ${intentCookie}`,origin:'https://foreign.invalid','Content-Type':'application/json'},body:JSON.stringify({installationId:999})})).status).toBe(403);
  const connected=await app.request('/api/github/connection/existing',{method:'POST',headers:{cookie:`${cookie}; ${intentCookie}`,'Content-Type':'application/json'},body:JSON.stringify({installationId:999})});
  expect(connected.status).toBe(200);expect(await connected.json()).toMatchObject({status:'connected',workspaceId:workspace,installationId:999});
  expect((await sql.query('SELECT installation_id,workspace_id FROM product_workspace_installations')).rows).toEqual([{installation_id:999,workspace_id:workspace}]);
  expect((await sql.query("SELECT detail->>'connectionMode' AS mode FROM product_workspace_events WHERE action='github_connected'")).rows).toEqual([{mode:'existing-personal'}]);
 }finally{await sql.close();}
});
it('turns expired provider credentials into safe actionable reauthentication feedback',async()=>{
 const {GithubApiError}=await import('../src/server/github.ts');
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql,{tokenSecret:'secret'});await store.upsertUser({id:'person',login:'person',accessToken:'expired-provider-token'});
  const session=await store.createSession('person'),cookie=`ns_session=${signSession('secret',session)}`;
  const workspace=(await listUserWorkspaces(sql,'person'))[0].id;
  const app=createApp({store,config:loadConfig({appBaseUrl:'http://localhost:4347',githubAppId:'1',githubPrivateKey:'configured',githubClientId:'client',githubClientSecret:'client-secret',githubAppSlug:'nospoilers',sessionSecret:'secret',githubWebhookSecret:'signature'}),github:{...stubGithub(),getUser:async()=>{throw new GithubApiError(401,'Raw provider diagnostic must stay private');}}});
  const response=await app.request(`/api/workspaces/${workspace}/github`,{method:'POST',headers:{cookie}});
  expect(response.status).toBe(401);
  const body=await response.json() as {code:string;error:string};
  expect(body.code).toBe('github_reauth_required');expect(body.error).toContain('Sign in to GitHub again');expect(body.error).not.toContain('Raw provider');
  expect((await sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
