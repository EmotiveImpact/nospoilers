import {it,expect} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
it('backfills notification ownership while retaining delivery evidence and rejecting mixed parents',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  const old=(c:SqlClient):SqlClient=>({...c,query:async<T>(q:string,p?:unknown[])=>Number(q.match(/^SELECT id FROM schema_migrations WHERE id='(\d+)_/)?.[1])>=105?{rows:[{id:'skip'} as T]}:c.query<T>(q,p),transaction:fn=>c.transaction(tx=>fn(old(tx)))});
  await migrate(old(sql));const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  for(const id of [7,8]){await store.upsertInstallation({id,accountId:id,accountLogin:`source${id}`,accountType:'User'});await store.linkUserInstallation(id,'owner');}
  const destination=(await sql.query<{id:number}>("INSERT INTO notification_destinations(installation_id,kind,host,webhook_ciphertext) VALUES(7,'slack','hooks.slack.com','encrypted-fixture') RETURNING id")).rows[0].id;
  await sql.query("INSERT INTO notification_deliveries(installation_id,destination_id,kind,status) VALUES(7,$1,'slack','sent')",[destination]);
  const before=(await sql.query('SELECT * FROM notification_deliveries')).rows[0];
  await migrate(sql);
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  expect((await sql.query('SELECT * FROM notification_deliveries')).rows).toEqual([{...before as object,workspace_id:workspace}]);
  await expect(sql.query("INSERT INTO notification_deliveries(installation_id,destination_id,kind,status) VALUES(8,$1,'slack','sent')",[destination])).rejects.toThrow('ownership mismatch');
  await expect(sql.query("UPDATE notification_deliveries SET status='failed'")).rejects.toThrow('append-only');
  await expect(sql.query('UPDATE notification_destinations SET workspace_id=NULL WHERE id=$1',[destination])).rejects.toThrow('immutable');
  await migrate(sql);
  expect((await sql.query('SELECT webhook_ciphertext FROM notification_destinations')).rows).toEqual([{webhook_ciphertext:'encrypted-fixture'}]);
 }finally{await sql.close();}
});
