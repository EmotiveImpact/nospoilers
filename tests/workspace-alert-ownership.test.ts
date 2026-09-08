import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin} from '../src/server/workspace-origins.ts';
import type {SqlClient} from '../src/server/sql.ts';
import {listWorkspaceAlerts,workspaceAlertDetail,respondToWorkspaceAlert,workspaceAlertAssignees} from '../src/server/workspace-alerts.ts';

it('upgrades existing alert history without changing its evidence or weakening append-only protection',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  // Exercise the real pre-101 schema, not a current schema with its marker removed.
  const before101=(client:SqlClient):SqlClient=>({
   ...client,
   query:async<T>(text:string,params?:unknown[])=>Number(text.match(/^SELECT id FROM schema_migrations WHERE id='(\d+)_/)?.[1])>=101
    ? {rows:[{id:'skip-101'} as T]} : client.query<T>(text,params),
   transaction:fn=>client.transaction(tx=>fn(before101(tx))),
  });
  await migrate(before101(sql));
  const store=createStore(sql);
  await store.upsertUser({id:'legacy-owner',login:'legacy-owner'});
  await store.upsertInstallation({id:7,accountLogin:'legacy-owner',accountType:'User',accountId:7});
  await store.linkUserInstallation(7,'legacy-owner');
  const alert=(await sql.query<{id:number}>("INSERT INTO alerts(installation_id,kind,title,body) VALUES(7,'release_scan','Existing exposure','Original evidence') RETURNING id")).rows[0];
  await sql.query("INSERT INTO alert_events(alert_id,installation_id,actor_login,action,detail) VALUES($1,7,'legacy-owner','acknowledged','Original response')",[alert.id]);
  const before=(await sql.query('SELECT * FROM alert_events WHERE alert_id=$1',[alert.id])).rows[0];
  await migrate(sql);
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  expect((await sql.query('SELECT workspace_id,body FROM alerts WHERE id=$1',[alert.id])).rows[0]).toEqual({workspace_id:workspace,body:'Original evidence'});
  expect((await sql.query('SELECT * FROM alert_events WHERE alert_id=$1',[alert.id])).rows[0]).toEqual({...before as object,workspace_id:workspace});
  await expect(sql.query("UPDATE alert_events SET detail='rewritten' WHERE alert_id=$1",[alert.id])).rejects.toThrow();
  await expect(sql.query('DELETE FROM alert_events WHERE alert_id=$1',[alert.id])).rejects.toThrow();
  await migrate(sql);
  expect((await sql.query('SELECT * FROM alert_events WHERE alert_id=$1',[alert.id])).rows).toHaveLength(1);
 }finally{await sql.close();}
});
it('binds independent alerts and events to their completed website attempt without allowing source changes',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  const source=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json) VALUES('attempt','owner',$1,$2,'https://example.com/','digest','done','{}')",[workspace.id,source.id]);
  const insert=(workspaceId:string)=>sql.query<{id:number}>("INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body) VALUES($1,$2,'attempt','web_origin_scan','Exposure','Evidence') RETURNING id",[workspaceId,source.id]);
  await expect(insert(other.id)).rejects.toThrow('own source and workspace');
  const id=(await insert(workspace.id)).rows[0].id;
  await expect(insert(workspace.id)).rejects.toThrow('website_alert_attempt');
  await expect(sql.query('UPDATE alerts SET workspace_id=$2 WHERE id=$1',[id,other.id])).rejects.toThrow('immutable');
  await expect(sql.query("INSERT INTO alert_events(alert_id,workspace_id,actor_login,action) VALUES($1,$2,'owner','acknowledged')",[id,other.id])).rejects.toThrow('workspace mismatch');
  await sql.query("INSERT INTO alert_events(alert_id,actor_login,action) VALUES($1,'owner','acknowledged')",[id]);
  expect((await sql.query('SELECT workspace_id,installation_id FROM alert_events WHERE alert_id=$1',[id])).rows).toEqual([{workspace_id:workspace.id,installation_id:null}]);
  const feed=await listWorkspaceAlerts(sql,'owner',workspace.id);
  expect(feed.alerts).toHaveLength(1);expect(feed.alerts[0].installation_id).toBeNull();
  expect(feed.sourceCount).toBe(1);
  expect((await listWorkspaceAlerts(sql,'owner',other.id)).sourceCount).toBe(0);
  expect((await workspaceAlertDetail(sql,'owner',workspace.id,String(id))).events).toHaveLength(1);
  await Promise.all([1,2].map(()=>respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'acknowledge')));
  expect((await workspaceAlertDetail(sql,'owner',workspace.id,String(id))).events).toHaveLength(2);
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'resolve','short')).rejects.toMatchObject({status:400});
  await respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'resolve','Reviewed and removed exposure');
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'resolve','Duplicate response')).rejects.toMatchObject({status:409});
  await respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'reopen');
  expect((await workspaceAlertDetail(sql,'owner',workspace.id,String(id))).events).toHaveLength(4);
  await store.upsertUser({id:'viewer',login:'viewer'});
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  expect((await listWorkspaceAlerts(sql,'viewer',workspace.id)).alerts).toHaveLength(1);
  expect((await workspaceAlertAssignees(sql,'owner',workspace.id,String(id))).members).toEqual([{id:'owner',login:'owner'}]);
  await expect(workspaceAlertAssignees(sql,'owner',other.id,String(id))).rejects.toMatchObject({status:404});
  await respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'assign',undefined,'owner');
  expect((await sql.query('SELECT assigned_to_user_id FROM alerts WHERE id=$1',[id])).rows).toEqual([{assigned_to_user_id:'owner'}]);
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'assign',undefined,'viewer')).rejects.toMatchObject({status:400});
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'assign',undefined,'stranger')).rejects.toMatchObject({status:404});
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'assign',undefined,'')).rejects.toMatchObject({status:400});
  await respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'assign',undefined,null);
  expect((await sql.query('SELECT assigned_to_user_id,assigned_to_login FROM alerts WHERE id=$1',[id])).rows).toEqual([{assigned_to_user_id:null,assigned_to_login:null}]);
  for(const action of ['acknowledge','resolve','reopen']){
   await expect(respondToWorkspaceAlert(sql,'viewer',workspace.id,String(id),action,'Reviewed evidence')).rejects.toMatchObject({status:403});
   await expect(respondToWorkspaceAlert(sql,'stranger',workspace.id,String(id),action,'Reviewed evidence')).rejects.toMatchObject({status:404});
   await expect(respondToWorkspaceAlert(sql,'owner',other.id,String(id),action,'Reviewed evidence')).rejects.toMatchObject({status:404});
  }
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect((await workspaceAlertDetail(sql,'owner',workspace.id,String(id))).events).toHaveLength(6);
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'resolve','Reviewed evidence')).rejects.toMatchObject({status:403});
  await sql.query('UPDATE product_workspaces SET archived_at=NULL WHERE id=$1',[workspace.id]);
  expect((await workspaceAlertDetail(sql,'owner',workspace.id,String(id))).events).toHaveLength(6);
  expect((await sql.query('SELECT id FROM jobs')).rows).toHaveLength(0);
  expect((await sql.query('SELECT report_json FROM uploaded_scans WHERE id=$1',['attempt'])).rows).toEqual([{report_json:{}}]);
  expect((await listWorkspaceAlerts(sql,'owner',other.id)).alerts).toHaveLength(0);
  await expect(workspaceAlertDetail(sql,'owner',other.id,String(id))).rejects.toMatchObject({status:404});
  await expect(listWorkspaceAlerts(sql,'owner',other.id,String(id))).rejects.toMatchObject({status:404});
  await expect(listWorkspaceAlerts(sql,'stranger',workspace.id)).rejects.toMatchObject({status:404});
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);
  await expect(workspaceAlertDetail(sql,'owner',workspace.id,String(id))).rejects.toMatchObject({status:404});
  await expect(respondToWorkspaceAlert(sql,'owner',workspace.id,String(id),'resolve','Reviewed evidence')).rejects.toMatchObject({status:404});
  await expect(sql.query('UPDATE alert_events SET detail=$1 WHERE alert_id=$2',['changed',id])).rejects.toThrow();
 }finally{await sql.close();}
});
