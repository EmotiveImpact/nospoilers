import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
it('connects and verifies a website through authenticated workspace APIs without GitHub or a scan job',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  const session=await store.createSession('owner');const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  const headers={cookie:`ns_session=${signSession('test',session)}`,'content-type':'application/json'};
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'test'}),verifyDomain:async(_host,_token,method)=>({method,detail:'matched'})});
  const path=`/api/workspaces/${workspace.id}/origins`;
  expect((await app.request(path,{method:'POST',body:'{}'})).status).toBe(401);
  expect((await app.request(path,{method:'POST',headers,body:'{'})).status).toBe(400);
  const response=await app.request(path,{method:'POST',headers,body:JSON.stringify({url:'https://example.com'})});expect(response.status).toBe(201);
  const body=await response.json() as {origin:{id:number};queued:boolean};expect(body.queued).toBe(false);
  const checkPath=`${path}/${body.origin.id}/check`,attemptId=crypto.randomUUID();
  const check=()=>app.request(checkPath,{method:'POST',headers,body:JSON.stringify({attemptId})});
  expect((await check()).status).toBe(409);
  const verified=await app.request(`${path}/${body.origin.id}/verify`,{method:'POST',headers,body:'{"method":"dns"}'});expect(verified.status).toBe(200);
  expect(await verified.json()).toMatchObject({queued:false,method:'dns'});
  const schedulePath=`${path}/${body.origin.id}/schedule`;
  expect((await app.request(schedulePath,{method:'POST',body:'{"hours":24}'})).status).toBe(401);
  expect((await app.request(schedulePath,{method:'POST',headers,body:'{"hours":1}'})).status).toBe(400);
  expect((await app.request(schedulePath,{method:'POST',headers,body:'{"hours":24}'})).status).toBe(200);
  expect((await sql.query('SELECT * FROM installations')).rows).toHaveLength(0);expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(0);
  expect((await check()).status).toBe(202);expect((await check()).status).toBe(202);
  expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(1);
  const listed=await app.request(path,{headers});expect(listed.status).toBe(200);
  expect(await listed.json()).toMatchObject({origins:[{latest_attempt_id:attemptId,latest_attempt_status:'queued',schedule_hours:24,schedule_actor:'owner'}]});
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);
  expect((await app.request(path,{headers})).status).toBe(404);
  expect([403,404]).toContain((await app.request(schedulePath,{method:'POST',headers,body:'{"hours":0}'})).status);
 }finally{await sql.close();}
});
