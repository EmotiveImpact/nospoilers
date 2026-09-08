import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {randomUUID} from 'node:crypto';
it('protects workspace notification writes and does not claim configured destinations are delivering',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql),cookies:Record<string,string>={};
  for(const id of ['owner','viewer','stranger']){await store.upsertUser({id,login:id});cookies[id]=`ns_session=${signSession('test-key',await store.createSession(id))}`;}
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'test-key',appBaseUrl:'http://127.0.0.1:4347',resendApiKey:'',resendFromEmail:''})});
  const base=`/api/workspaces/${workspace.id}/notifications`;
  const call=(actor:string,method='GET',body?:unknown,suffix='',origin='http://127.0.0.1:4347')=>app.request(base+suffix,{method,headers:{cookie:cookies[actor]??'',origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  expect((await call('')).status).toBe(401);expect((await call('stranger')).status).toBe(404);
  const input={kind:'email',value:'owner@example.com'};
  expect((await call('viewer','POST',input)).status).toBe(403);
  expect((await call('owner','POST',input,'','https://attacker.invalid')).status).toBe(403);
  const response=await call('owner','POST',input);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  const saved=await response.json() as {destination:{id:number};deliveryStatus:string};expect(saved.deliveryStatus).toBe('not_tested');
  const read=await (await call('viewer')).json() as {providers:{email:boolean};independentDeliveryEnabled:boolean};expect(read.providers.email).toBe(false);expect(read.independentDeliveryEnabled).toBe(true);expect(JSON.stringify(read)).not.toContain('owner@example.com');
  const unavailable=await call('owner','POST',{requestKey:randomUUID()},`/${saved.destination.id}/test`);expect(unavailable.status,await unavailable.text()).toBe(503);
  const slack=await (await call('owner','POST',{kind:'slack',value:'https://hooks.slack.com/services/T1/B1/testsecret'})).json() as {destination:{id:number}};
  const suffix=`/${slack.destination.id}/test`,requestKey=randomUUID();
  expect((await call('viewer','POST',{requestKey},suffix)).status).toBe(403);
  expect((await call('stranger','POST',{requestKey},suffix)).status).toBe(404);
  expect((await call('owner','POST',{requestKey},suffix,'https://attacker.invalid')).status).toBe(403);
  expect((await call('owner','POST',{requestKey:'bad'},suffix)).status).toBe(400);
  const first=await call('owner','POST',{requestKey},suffix);expect(first.status).toBe(200);expect(first.headers.get('cache-control')).toBe('no-store');
  const queued=await first.json();expect(queued).toMatchObject({status:'queued'});
  expect(await (await call('owner','POST',{requestKey},suffix)).json()).toEqual(queued);
  expect((await call('owner','POST',{requestKey:randomUUID()},suffix)).status).toBe(429);
  expect((await sql.query('SELECT id FROM workspace_notification_jobs')).rows).toHaveLength(1);
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE action='notification_test_requested'")).rows).toHaveLength(1);
  expect((await sql.query('SELECT id FROM alerts')).rows).toHaveLength(0);
  expect((await sql.query('SELECT id FROM jobs')).rows).toHaveLength(0);
  expect((await call('owner','DELETE',{confirm:'wrong'},`/${saved.destination.id}`)).status).toBe(400);
  expect((await call('owner','DELETE',{confirm:'example.com'},`/${saved.destination.id}`)).status).toBe(200);
  expect((await sql.query('SELECT id FROM notification_deliveries')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
