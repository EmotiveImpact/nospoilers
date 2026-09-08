import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {saveWorkspaceNotification,disconnectWorkspaceNotification} from '../src/server/workspace-notifications.ts';
import {decryptSecret} from '../src/server/secret-box.ts';
it('validates and encrypts independent destinations without sending and enforces administrator and plan',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);for(const id of ['owner','viewer']){await store.upsertUser({id,login:id});await store.createSession(id);}
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const save=(actor:string,kind:string,value:string)=>saveWorkspaceNotification(sql,actor,workspace.id,kind,value,'test-key');
  await expect(save('viewer','email','owner@example.com')).rejects.toMatchObject({status:403});
  await expect(save('owner','slack','https://localhost/secret')).rejects.toMatchObject({status:400});
  const result=await save('owner','email','owner@example.com');
  expect(JSON.stringify(result)).not.toContain('owner@example.com');
  const row=(await sql.query<{webhook_ciphertext:string;installation_id:null}>('SELECT webhook_ciphertext,installation_id FROM notification_destinations')).rows[0];
  expect(row.installation_id).toBeNull();expect(row.webhook_ciphertext).not.toBe('owner@example.com');expect(decryptSecret(row.webhook_ciphertext,'test-key')).toBe('owner@example.com');
  await save('owner','email','updated@example.com');expect((await sql.query('SELECT id FROM notification_destinations')).rows).toHaveLength(1);
  expect((await sql.query('SELECT id FROM notification_deliveries')).rows).toHaveLength(0);
  const events=(await sql.query<{detail:unknown}>("SELECT detail FROM product_workspace_events WHERE action='notification_saved' AND workspace_id=$1",[workspace.id])).rows;
  expect(events).toHaveLength(2);expect(JSON.stringify(events)).not.toMatch(/owner@example|updated@example|cipher/);
  await sql.query("INSERT INTO notification_deliveries(workspace_id,destination_id,kind,status) VALUES($1,$2,'email','sent')",[workspace.id,result.destination.id]);
  await expect(disconnectWorkspaceNotification(sql,'owner',workspace.id,String(result.destination.id),'wrong')).rejects.toMatchObject({status:400});
  await expect(disconnectWorkspaceNotification(sql,'viewer',workspace.id,String(result.destination.id),'example.com')).rejects.toMatchObject({status:403});
  await disconnectWorkspaceNotification(sql,'owner',workspace.id,String(result.destination.id),'example.com');
  expect((await sql.query('SELECT destination_id,status FROM notification_deliveries')).rows).toEqual([{destination_id:null,status:'sent'}]);
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE action='notification_disconnected' AND workspace_id=$1",[workspace.id])).rows).toHaveLength(1);
  await sql.query("UPDATE users SET plan='solo' WHERE id='owner'");
  await expect(save('owner','slack','https://hooks.slack.com/services/T1/B1/secret')).rejects.toMatchObject({status:403});
 }finally{await sql.close();}
});
