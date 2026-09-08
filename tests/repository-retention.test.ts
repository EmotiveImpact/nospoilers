import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
it('retains disconnected repository identity, stops work and prevents incidental or cross-tenant reconnection',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of [7,8])await store.upsertInstallation({id,accountId:id,accountLogin:`owner${id}`,accountType:'User'});
  const repo={id:99,installationId:7,owner:'owner7',name:'repo',fullName:'owner7/repo',private:true,htmlUrl:'https://github.com/owner7/repo'};
  await store.upsertRepo(repo);
  await store.removeRepo(99,8);expect(await store.getRepo(99)).not.toBeNull();
  await store.removeRepo(99,7);
  await store.upsertUser({id:'owner',login:'owner7'});await store.linkUserInstallation(7,'owner');
  await store.upsertUser({id:'outsider',login:'outsider'});await store.linkUserInstallation(8,'outsider');
  expect(await store.listDisconnectedReposForUser('owner',7)).toMatchObject([{id:99,fullName:'owner7/repo'}]);
  expect(await store.listDisconnectedReposForUser('outsider',7)).toEqual([]);
  expect(await store.listDisconnectedReposForUser('owner',8)).toEqual([]);
  expect((await sql.query('SELECT id FROM repos WHERE id=99 AND disconnected_at IS NOT NULL')).rows).toHaveLength(1);
  expect(await store.getRepo(99)).toBeNull();expect(await store.listReposForInstallation(7)).toHaveLength(0);
  expect(await store.repoWorkRevoked(99,7)).toBe(true);
  await store.upsertRepo(repo);expect(await store.getRepo(99)).toBeNull();
  await store.upsertRepo({...repo,installationId:8,reconnect:true});expect(await store.getRepo(99)).toBeNull();
  await store.upsertRepo({...repo,reconnect:true});expect(await store.getRepo(99)).toMatchObject({installation_id:7});
  expect(await store.repoWorkRevoked(99,7)).toBe(false);
 }finally{await sql.close();}
});
