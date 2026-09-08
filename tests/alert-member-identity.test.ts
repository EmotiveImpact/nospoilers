import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
it('assigns stable internal identities, preserves the display snapshot and rejects outsiders and viewers',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'org',accountType:'Organization'});
  for(const [id,login] of [['owner','owner'],['person','before'],['outsider','outsider']])await store.upsertUser({id,login});
  await store.linkUserInstallation(7,'owner');await store.linkUserInstallation(7,'person');
  const id=await store.insertAlert({installationId:7,kind:'repo_publicized',title:'Exposure',body:'Evidence'});
  expect(await store.listAlertAssignees(id,'outsider')).toBeNull();
  expect(await store.listAlertAssignees(id,'owner')).toMatchObject([{id:'person',login:'before'},{id:'owner',login:'owner'}]);
  expect(await store.assignAlertForUser(id,'owner','owner','','person')).toMatchObject({assigned_to_user_id:'person',assigned_to_login:'before'});
  await store.upsertUser({id:'person',login:'after'});
  expect(await store.getAlertForUser(id,'owner')).toMatchObject({assigned_to_user_id:'person',assigned_to_login:'after'});
  expect((await sql.query<{assigned_to_login:string}>('SELECT assigned_to_login FROM alerts WHERE id=$1',[id])).rows[0].assigned_to_login).toBe('before');
  await expect(store.assignAlertForUser(id,'owner','owner','','outsider')).rejects.toMatchObject({status:400});
  await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=7 AND user_id='person'");
  await expect(store.assignAlertForUser(id,'person','after','','owner')).rejects.toMatchObject({status:403});
  await sql.query("DELETE FROM installation_users WHERE installation_id=7 AND user_id='person'");
  await expect(store.assignAlertForUser(id,'owner','owner','','person')).rejects.toMatchObject({status:400});
  expect(await store.getAlertForUser(id,'owner')).toMatchObject({assigned_to_user_id:'person'});
  expect(await store.assignAlertForUser(id,'owner','owner','',null)).toMatchObject({assigned_to_user_id:null,assigned_to_login:null});
  expect((await sql.query('SELECT detail FROM alert_events WHERE alert_id=$1 ORDER BY id DESC LIMIT 1',[id])).rows).toEqual([{detail:'Assignment cleared'}]);
 }finally{await sql.close();}
});
