import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
const sourceBody = async (response:Response) => await response.json() as {sources:Array<{id:number;paused:boolean;canManage:boolean}>};

it('enforces monitoring and retained-source HTTP boundaries with real storage',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql),cookies:Record<string,string>={};
  for(const id of ['owner','viewer','stranger']){await store.upsertUser({id,login:id});cookies[id]=`ns_session=${signSession('monitor-test',await store.createSession(id))}`;}
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===7)!;
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const pkg=(await store.insertWatchedPackage(7,'example-pack'))!;
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'monitor-test',appBaseUrl:'http://127.0.0.1:4347'})});
  const get=(actor:string,path='/api/sources/monitoring?installationId=7')=>app.request(path,{headers:{cookie:cookies[actor]??''}});
  const post=(actor:string,paused:unknown,origin='http://127.0.0.1:4347')=>app.request(`/api/sources/npm/${pkg.id}/monitoring`,{method:'POST',headers:{cookie:cookies[actor]??'',origin,'content-type':'application/json'},body:JSON.stringify({paused})});
  expect((await get('')).status).toBe(401);
  expect(await (await get('stranger')).json()).toEqual({sources:[]});
  const list=await get('owner');expect(list.headers.get('cache-control')).toContain('no-store');
  expect((await sourceBody(list)).sources[0]).toMatchObject({id:pkg.id,paused:false,canManage:true});
  expect((await sourceBody(await get('viewer'))).sources[0].canManage).toBe(false);
  expect((await post('',true)).status).toBe(401);
  expect((await post('viewer',true)).status).toBe(403);
  expect((await post('stranger',true)).status).toBe(403);
  expect((await post('owner',true,'https://attacker.invalid')).status).toBe(403);
  expect((await post('owner','true')).status).toBe(400);
  expect((await post('owner',true)).status).toBe(200);
  expect((await post('owner',true)).status).toBe(200);
  expect((await sourceBody(await get('owner'))).sources[0].paused).toBe(true);
  expect((await sql.query("SELECT id FROM audit_events WHERE action='source.pause'")).rows).toHaveLength(1);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect((await post('owner',false)).status).toBe(403);
  await sql.query('UPDATE product_workspaces SET archived_at=NULL WHERE id=$1',[workspace.id]);
  expect((await post('owner',false)).status).toBe(200);
  await store.deleteWatchedPackageForUser(pkg.id,'owner');
  expect((await post('owner',false)).status).toBe(403);
  expect((await sourceBody(await get('owner','/api/sources/disconnected?installationId=7'))).sources).toHaveLength(1);
  expect((await sourceBody(await get('stranger','/api/sources/disconnected?installationId=7'))).sources).toEqual([]);
  await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'owner')",[workspace.id]);
  expect((await sourceBody(await get('owner','/api/sources/disconnected?installationId=7'))).sources).toEqual([]);
 }finally{await sql.close();}
});
