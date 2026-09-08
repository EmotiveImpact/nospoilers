import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';

it('uses live workspace administrator authority for token revocation without a legacy membership row',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountLogin:'source',accountId:7,accountType:'User'});
  await store.linkUserInstallation(7,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  const token=await store.insertScanApiToken({installationId:7,name:'CI',createdByLogin:'owner'});
  expect((await sql.query<{workspace_id:string}>('SELECT workspace_id FROM scan_api_tokens WHERE id=$1',[token.id])).rows[0].workspace_id).toBe(workspace.id);
  await expect(sql.query('UPDATE scan_api_tokens SET workspace_id=NULL WHERE id=$1',[token.id])).rejects.toThrow('ownership is immutable');
  await migrate(sql);
  expect(await store.authenticateScanToken(token.token)).not.toBeNull();
  await sql.query("UPDATE product_workspace_members SET role='admin',access_source='explicit' WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
  await sql.query("DELETE FROM installation_users WHERE installation_id=7 AND user_id='owner'");
  expect(await store.revokeScanApiTokenForUser(token.id,'stranger')).toBe(false);
  for(const role of ['viewer','member']){
   await sql.query('UPDATE product_workspace_members SET role=$2 WHERE workspace_id=$1',[workspace.id,role]);
   expect(await store.revokeScanApiTokenForUser(token.id,'owner')).toBe(false);
  }
  await sql.query("UPDATE product_workspace_members SET role='admin' WHERE workspace_id=$1",[workspace.id]);
  await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'owner')",[workspace.id]);
  expect(await store.revokeScanApiTokenForUser(token.id,'owner')).toBe(false);
  await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect(await store.authenticateScanToken(token.token)).toBeNull();
  expect(await store.revokeScanApiTokenForUser(token.id,'owner')).toBe(false);
  await sql.query('UPDATE product_workspaces SET archived_at=NULL WHERE id=$1',[workspace.id]);
  expect(await store.authenticateScanToken(token.token)).not.toBeNull();
  expect(await store.revokeScanApiTokenForUser(token.id,'owner')).toBe(true);
  expect(await store.authenticateScanToken(token.token)).toBeNull();
  expect(await store.revokeScanApiTokenForUser(token.id,'owner')).toBe(false);
  const requests=await Promise.allSettled(Array.from({length:7},(_,i)=>store.insertScanApiToken({installationId:7,name:`CI ${i}`,createdByLogin:'owner'})));
  expect(requests.filter(result=>result.status==='fulfilled')).toHaveLength(5);
  expect(requests.filter(result=>result.status==='rejected')).toHaveLength(2);
  expect(Number((await sql.query<{total:string}>('SELECT count(*) AS total FROM scan_api_tokens WHERE installation_id=7 AND revoked_at IS NULL')).rows[0].total)).toBe(5);
 }finally{await sql.close();}
});
