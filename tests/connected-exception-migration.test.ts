import {it,expect} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';

it('retains legacy exception evidence while backfilling and enforcing immutable workspace scope',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  const old=(c:SqlClient):SqlClient=>({...c,query:async<T>(q:string,p?:unknown[])=>Number(q.match(/^SELECT id FROM schema_migrations WHERE id='(\d+)_/)?.[1])>=112?{rows:[{id:'skip'} as T]}:c.query<T>(q,p),transaction:fn=>c.transaction(tx=>fn(old(tx)))});
  await migrate(old(sql));const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  for(const id of [7,8]){await store.upsertInstallation({id,accountId:id,accountLogin:`source${id}`,accountType:'User'});await store.linkUserInstallation(id,'owner');}
  const entry=await store.insertPolicyException({installationId:7,rule:'SRC-001',pathPattern:'**/*.d.ts',reason:'Public type declarations',actorUserId:'owner',actorLogin:'owner',expiresAt:'2027-09-01T00:00:00Z'});
  const before=(await sql.query('SELECT * FROM policy_exceptions WHERE id=$1',[entry.id])).rows[0];
  await migrate(sql);
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  expect((await sql.query('SELECT * FROM policy_exceptions WHERE id=$1',[entry.id])).rows[0]).toEqual({...before as object,workspace_id:workspace});
  await expect(sql.query('UPDATE policy_exceptions SET installation_id=8 WHERE id=$1',[entry.id])).rejects.toThrow('immutable');
  await expect(sql.query('UPDATE policy_exceptions SET workspace_id=NULL WHERE id=$1',[entry.id])).rejects.toThrow('immutable');
  await expect(sql.query("UPDATE policy_exceptions SET path_pattern='**' WHERE id=$1",[entry.id])).rejects.toThrow('immutable');
  await expect(sql.query("INSERT INTO policy_exceptions(installation_id,workspace_id,rule,reason,actor_user_id,actor_login,expires_at) VALUES(8,$1,'SRC-001','Incorrect workspace','owner','owner','2027-09-01')",[workspace])).rejects.toThrow('workspace mismatch');
  expect(await store.revokePolicyExceptionForUser(entry.id,'owner','owner')).toMatchObject({id:entry.id,revoked_by:'owner'});
  await expect(sql.query('UPDATE policy_exceptions SET revoked_at=NULL WHERE id=$1',[entry.id])).rejects.toThrow('revocation is immutable');
  const retained=(await sql.query('SELECT * FROM policy_exceptions WHERE id=$1',[entry.id])).rows;
  await migrate(sql);expect((await sql.query('SELECT * FROM policy_exceptions WHERE id=$1',[entry.id])).rows).toEqual(retained);
 }finally{await sql.close();}
});
