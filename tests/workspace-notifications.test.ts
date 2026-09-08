import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {workspaceNotifications} from '../src/server/workspace-notifications.ts';
it('scopes notification metadata and pages delivery history without credentials or raw provider errors',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  for(const id of [7,8]){await store.upsertInstallation({id,accountId:id,accountLogin:`source${id}`,accountType:'User'});await store.linkUserInstallation(id,'owner');}
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===7)!;
  await sql.query("INSERT INTO notification_destinations(installation_id,kind,host,webhook_ciphertext,last_delivery_error) VALUES(7,'slack','hooks.slack.com','secret-ciphertext','sensitive-provider-error'),(8,'slack','foreign.invalid','foreign-secret',NULL)");
  await sql.query("INSERT INTO notification_deliveries(installation_id,kind,status,error) SELECT 7,'slack','failed','sensitive-provider-error' FROM generate_series(1,61)");
  const foreign=(await sql.query<{id:number}>("INSERT INTO notification_deliveries(installation_id,kind,status) VALUES(8,'slack','sent') RETURNING id")).rows[0].id;
  const first=await workspaceNotifications(sql,'owner',workspace.id);
  expect(first.destinations).toHaveLength(1);expect(first.destinations[0].host).toBe('hooks.slack.com');
  expect(first.deliveries).toHaveLength(50);expect(first.canManage).toBe(true);
  expect(first.deliveries.every(d=>d.error_code==='unknown')).toBe(true);
  expect(JSON.stringify(first)).not.toMatch(/ciphertext|sensitive-provider-error|foreign/);
  const last=await workspaceNotifications(sql,'owner',workspace.id,first.nextCursor!);
  expect(last.deliveries).toHaveLength(11);expect(last.nextCursor).toBeNull();
  expect(new Set([...first.deliveries,...last.deliveries].map(d=>d.id)).size).toBe(61);
  await expect(workspaceNotifications(sql,'owner',workspace.id,String(foreign))).rejects.toMatchObject({status:404});
  await expect(workspaceNotifications(sql,'stranger',workspace.id)).rejects.toMatchObject({status:404});
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect((await workspaceNotifications(sql,'owner',workspace.id)).canManage).toBe(false);
 }finally{await sql.close();}
});
