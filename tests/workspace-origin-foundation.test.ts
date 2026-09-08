import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace,ensureUserWorkspaces} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin,verifyWorkspaceOrigin} from '../src/server/workspace-origins.ts';
it('creates an unverified website owned by an independent workspace without a GitHub installation or scan',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await ensureUserWorkspaces(sql,'owner');
  const first=(await listUserWorkspaces(sql,'owner'))[0];
  const second=await createWorkspace(sql,'owner',first.organization_id,'Second');
  const origin=await createWorkspaceOrigin(sql,'owner',first.id,'https://example.com');
  expect(origin).toMatchObject({workspace_id:first.id,host:'example.com'});expect(origin.verification_token.length).toBeGreaterThan(30);
  expect((await sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
  expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(0);
  expect(await store.listAllWatchedOrigins()).toEqual([]);
  await expect(createWorkspaceOrigin(sql,'owner',first.id,'https://example.com')).rejects.toMatchObject({status:409});
  await expect(createWorkspaceOrigin(sql,'stranger',first.id,'https://another.example.com')).rejects.toMatchObject({status:403});
  await expect(sql.query('UPDATE watched_origins SET workspace_id=$1 WHERE id=$2',[second.id,origin.id])).rejects.toThrow('immutable');
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[first.id,'owner']);
  await expect(createWorkspaceOrigin(sql,'owner',first.id,'https://another.example.com')).rejects.toMatchObject({status:403});
 }finally{await sql.close();}
});
it('verifies independent ownership without jobs and rejects revoked access after the network check',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  const first=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
  const verified=await verifyWorkspaceOrigin(sql,'owner',workspace.id,first.id,'dns',async(host,token,method)=>{
   expect(host).toBe('example.com');expect(token).toBe(first.verification_token);return {method,detail:'DNS matched'};
  });expect(verified).toMatchObject({id:first.id,method:'dns'});
  const second=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://second.example.com');
  await expect(verifyWorkspaceOrigin(sql,'owner',workspace.id,second.id,'http',async(_host,_token,method)=>{
   await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);return {method,detail:'matched'};
  })).rejects.toMatchObject({status:403});
  expect((await sql.query<{verified_at:unknown}>('SELECT verified_at FROM watched_origins WHERE id=$1',[second.id])).rows[0].verified_at).toBeNull();
  expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
