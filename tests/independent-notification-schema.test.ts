import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
it('keeps independent notification parents in one workspace and preserves delivery evidence on disconnect',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  const workspace=(await listUserWorkspaces(sql,'owner'))[0],other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  const insert=(id:string|null)=>sql.query<{id:number}>("INSERT INTO notification_destinations(workspace_id,kind,host,webhook_ciphertext) VALUES($1,'slack','hooks.slack.com','cipher') RETURNING id",[id]);
  await expect(insert(null)).rejects.toThrow('notification_destination_owner');
  const destination=(await insert(workspace.id)).rows[0].id;
  await expect(insert(workspace.id)).rejects.toThrow('independent_notification_kind');
  await expect(sql.query("INSERT INTO notification_routes(workspace_id,destination_id) VALUES($1,$2)",[other.id,destination])).rejects.toThrow('ownership mismatch');
  await sql.query("INSERT INTO notification_deliveries(workspace_id,destination_id,kind,status) VALUES($1,$2,'slack','sent')",[workspace.id,destination]);
  await expect(sql.query("UPDATE notification_deliveries SET status='failed'")).rejects.toThrow('append-only');
  await sql.query('DELETE FROM notification_destinations WHERE id=$1',[destination]);
  expect((await sql.query('SELECT workspace_id,installation_id,destination_id,status FROM notification_deliveries')).rows).toEqual([{workspace_id:workspace.id,installation_id:null,destination_id:null,status:'sent'}]);
 }finally{await sql.close();}
});
