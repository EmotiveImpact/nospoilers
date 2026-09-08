import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
it('rejects read-only responders and records concurrent transitions only once',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'org',accountType:'Organization'});
  for(const user of ['owner','viewer']){await store.upsertUser({id:user,login:user});await store.linkUserInstallation(7,user);}
  await sql.query("UPDATE installation_users SET role='viewer' WHERE user_id='viewer'");
  const id=await store.insertAlert({installationId:7,kind:'repo_publicized',title:'Evidence',body:'Original'});
  await expect(store.acknowledgeAlertForUser(id,'viewer','viewer')).rejects.toMatchObject({status:403});
  await expect(store.resolveAlertForUser(id,'viewer','viewer','Reviewed exposure')).rejects.toMatchObject({status:403});
  await Promise.all([store.acknowledgeAlertForUser(id,'owner','owner'),store.acknowledgeAlertForUser(id,'owner','owner')]);
  const results=await Promise.allSettled([store.resolveAlertForUser(id,'owner','owner','Reviewed exposure'),store.resolveAlertForUser(id,'owner','owner','Reviewed exposure')]);
  expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
  await expect(store.reopenAlertForUser(id,'viewer','viewer')).rejects.toMatchObject({status:403});
  const reopened=await Promise.allSettled([store.reopenAlertForUser(id,'owner','owner'),store.reopenAlertForUser(id,'owner','owner')]);
  expect(reopened.filter(row=>row.status==='fulfilled')).toHaveLength(1);
  expect((await sql.query('SELECT action FROM alert_events WHERE alert_id=$1 ORDER BY id',[id])).rows).toEqual(['acknowledged','resolved','reopened'].map(action=>({action})));
  expect(await store.getAlertForUser(id,'owner')).toMatchObject({title:'Evidence',body:'Original',resolved_at:null});
 }finally{await sql.close();}
});
