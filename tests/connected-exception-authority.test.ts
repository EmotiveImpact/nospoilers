import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {saveWorkspaceArtifactPolicy} from '../src/server/workspace-policy.ts';

it('uses live workspace authority for legacy exception revocation, not stale GitHub membership',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','reviewer'])await store.upsertUser({id,login:id});
  await store.upsertInstallation({id:921,accountId:921,accountLogin:'source',accountType:'Organization'});
  await store.linkUserInstallation(921,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===921)!;
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'reviewer','admin','explicit')",[workspace.id]);
  const create=()=>store.insertPolicyException({installationId:921,rule:'SRC-001',pathPattern:'types.d.ts',reason:'Public type declarations',actorUserId:'owner',actorLogin:'owner',expiresAt:'2027-09-01T00:00:00Z'});
  const first=await create();
  expect((await store.listExceptionsForUser('reviewer')).map(e=>e.id)).toContain(first.id);
  expect(await store.revokePolicyExceptionForUser(first.id,'reviewer','reviewer')).toMatchObject({id:first.id,revoked_by:'reviewer'});
  const second=await create();
  await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:false,expectedRevision:0,requireExceptionApproval:true});
  await expect(create()).rejects.toMatchObject({status:409});
  expect((await store.listExceptionsForUser('owner')).map(e=>e.id)).toContain(second.id);
  expect((await sql.query('SELECT id FROM policy_exceptions WHERE installation_id=921')).rows).toHaveLength(2);
  await sql.query("INSERT INTO installation_users(installation_id,user_id,role) VALUES(921,'reviewer','admin')");
  await sql.query("UPDATE product_workspace_members SET role='viewer' WHERE workspace_id=$1 AND user_id='reviewer'",[workspace.id]);
  expect(await store.revokePolicyExceptionForUser(second.id,'reviewer','reviewer')).toBeNull();
  await sql.query("UPDATE product_workspace_members SET role='admin' WHERE workspace_id=$1 AND user_id='reviewer'",[workspace.id]);
  await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'reviewer')",[workspace.id]);
  expect(await store.revokePolicyExceptionForUser(second.id,'reviewer','reviewer')).toBeNull();
  await sql.query('DELETE FROM product_workspace_revocations WHERE workspace_id=$1',[workspace.id]);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect(await store.revokePolicyExceptionForUser(second.id,'reviewer','reviewer')).toBeNull();
  expect((await sql.query<{revoked_at:string|null}>('SELECT revoked_at FROM policy_exceptions WHERE id=$1',[second.id])).rows[0].revoked_at).toBeNull();
 }finally{await sql.close();}
});
