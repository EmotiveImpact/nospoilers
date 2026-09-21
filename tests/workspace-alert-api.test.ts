import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin} from '../src/server/workspace-origins.ts';

it('serves independent alert history privately and protects HTTP response actions',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  const cookies:Record<string,string>={};
  for(const id of ['owner','viewer','stranger']){await store.upsertUser({id,login:id});cookies[id]=`ns_session=${signSession('alerts-test',await store.createSession(id))}`;}
  const [workspace]=await listUserWorkspaces(sql,'owner');
  const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const source=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json) VALUES('saved','owner',$1,$2,'https://example.com/','hash','done','{}')",[workspace.id,source.id]);
  const id=(await sql.query<{id:number}>("INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body) VALUES($1,$2,'saved','web_origin_scan','Exposure','Original evidence') RETURNING id",[workspace.id,source.id])).rows[0].id;
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'alerts-test',appBaseUrl:'http://127.0.0.1:4347'})});
  const base=`/api/workspaces/${workspace.id}/alerts`;
  const headers=(actor:string)=>({cookie:cookies[actor]??'','content-type':'application/json',origin:'http://127.0.0.1:4347'});
  for(const endpoint of [base,`${base}/${id}`,`${base}/${id}/assignees`,`/api/workspaces/${workspace.id}/alert-counts`]){
   expect((await app.request(endpoint)).status).toBe(401);
   expect((await app.request(endpoint,{headers:headers('stranger')})).status).toBe(404);
   const response=await app.request(endpoint,{headers:headers('viewer')});
   expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  }
  const respond=(actor:string,body:unknown,origin='http://127.0.0.1:4347')=>app.request(`${base}/${id}/respond`,{method:'POST',headers:{...headers(actor),origin},body:JSON.stringify(body)});
  expect((await respond('',{action:'acknowledge'})).status).toBe(401);
  expect((await respond('owner',{action:'acknowledge'},'https://attacker.invalid')).status).toBe(403);
  expect((await respond('viewer',{action:'acknowledge'})).status).toBe(403);
  expect((await respond('owner',{action:'unknown'})).status).toBe(400);
  expect((await respond('owner',{action:'assign',userId:'owner'})).status).toBe(200);
  expect((await respond('owner',{action:'assign',userId:null})).status).toBe(200);
  expect((await respond('owner',{action:'acknowledge'})).status).toBe(200);
  expect((await respond('owner',{action:'resolve',note:'Reviewed original evidence'})).status).toBe(200);
  expect((await respond('owner',{action:'reopen'})).status).toBe(200);
  expect((await app.request(`/api/workspaces/${other.id}/alerts/${id}`,{headers:headers('owner')})).status).toBe(404);
  const detail=await (await app.request(`${base}/${id}`,{headers:headers('owner')})).json() as {alert:Record<string,unknown>;events:unknown[]};
  expect(detail.alert).toMatchObject({installation_id:null,scan_attempt_id:'saved',body:'Original evidence',resolved_at:null});
  expect(detail.events).toHaveLength(5);
  // Newer unrelated rows must not consume the selected source's page budget.
  const anotherSource=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://another.example.com');
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json) SELECT 'other-saved-'||n,'owner',$1,$2,'https://another.example.com/','hash','done','{}' FROM generate_series(1,65)n",[workspace.id,anotherSource.id]);
  await sql.query("INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body) SELECT $1,$2,'other-saved-'||n,'web_origin_scan','Unrelated '||n,'Other scope' FROM generate_series(1,65)n",[workspace.id,anotherSource.id]);
  const scopedPath=`${base}?source=web-${source.id}`;
  const scoped=await (await app.request(scopedPath,{headers:headers('viewer')})).json() as {alerts:Array<{id:number}>;nextCursor:string|null;counts:{open:number;waiting:number}};
  expect(scoped.alerts.map(a=>a.id)).toEqual([id]);expect(scoped.nextCursor).toBeNull();expect(scoped.counts).toMatchObject({open:0,waiting:1});
  expect((await app.request(scopedPath)).status).toBe(401);expect((await app.request(scopedPath,{headers:headers('stranger')})).status).toBe(404);
  const foreignFilter=await (await app.request(`/api/workspaces/${other.id}/alerts?source=web-${source.id}`,{headers:headers('owner')})).json() as {alerts:unknown[]};expect(foreignFilter.alerts).toHaveLength(0);
  for(const sourceFilter of ['npm-1','repo-invalid','web-0','repo-9007199254740992'])expect((await app.request(`${base}?source=${sourceFilter}`,{headers:headers('owner')})).status).toBe(400);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect((await respond('owner',{action:'acknowledge'})).status).toBe(403);
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'viewer']);
  expect((await app.request(base,{headers:headers('viewer')})).status).toBe(404);
  expect((await sql.query('SELECT id FROM jobs')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
