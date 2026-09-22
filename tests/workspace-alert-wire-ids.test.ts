import {expect,it} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listWorkspaceAlerts,workspaceAlertDetail,respondToWorkspaceAlert} from '../src/server/workspace-alerts.ts';

// Match node-postgres's BIGINT wire representation while exercising the real
// SQL, permissions and response code against the local database.
function postgresIds(sql:SqlClient):SqlClient{
 return {...sql,query:async<T>(query:string,params?:unknown[])=>{
  const result=await sql.query<Record<string,unknown>>(query,params);
  return {rows:result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[
   key,['id','installation_id','repo_id','source_origin_id'].includes(key)&&typeof value==='number'?String(value):value,
  ]))) as T[]};
 },transaction:fn=>sql.transaction(tx=>fn(postgresIds(tx)))};
}

it('returns safe numeric alert identities consistently from Postgres list, detail and response endpoints',async()=>{
 const sql=await openSql('pglite://:memory:');
 try{
  await migrate(sql);
  const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});
  await store.linkUserInstallation(7,'owner');
  await store.upsertRepo({id:9001,installationId:7,owner:'owner',name:'repo',fullName:'owner/repo',private:false,htmlUrl:'https://github.com/owner/repo'});
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  await sql.query("INSERT INTO alerts(installation_id,repo_id,kind,title,body) VALUES(7,9001,'push_sensitive_path','Sensitive path in owner/repo','Evidence')");
  const pg=postgresIds(sql);
  const list=await listWorkspaceAlerts(pg,'owner',workspace);
  const alert=list.alerts[0];
  expect(alert).toMatchObject({id:1,installation_id:7,repo_id:9001,source_origin_id:null,scan_attempt_id:null,workspace_id:workspace});
  expect(list.counts.open).toBe(1);
  const detail=await workspaceAlertDetail(pg,'owner',workspace,String(alert.id));
  expect(detail.alert.id).toBe(alert.id);
  expect(detail.alert.installation_id).toBe(7);
  const response=await respondToWorkspaceAlert(pg,'owner',workspace,String(alert.id),'acknowledge');
  expect(response.alert.id).toBe(alert.id);
  expect(response.alert.acknowledged_at).toBeTruthy();
  expect(response.events[0].id).toBe(1);
  expect((await listWorkspaceAlerts(pg,'owner',workspace,undefined,{status:'waiting'})).alerts[0].id).toBe(alert.id);
  const unsafe:SqlClient={...pg,query:async<T>(query:string,params?:unknown[])=>{
   const result=await pg.query<T>(query,params);
   return query.startsWith('SELECT id,installation_id,workspace_id,repo_id,source_origin_id')
    ?{rows:result.rows.map(row=>({...row,id:'9007199254740993'}))}:result;
  }};
  await expect(listWorkspaceAlerts(unsafe,'owner',workspace)).rejects.toThrow('Invalid alert record identifier.');
 }finally{await sql.close();}
});
