import {describe,it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {createWorkspace,ensureUserWorkspaces,listUserWorkspaces,uploadWorkspaceScope} from '../src/server/workspaces.ts';
import {moveUnusedWorkspaceConnection} from '../src/server/workspace-connections.ts';
import {workspaceConnectionSchema} from '../src/server/workspace-connection-schema.ts';

async function setup(){
  const sql=await openSql('pglite://:memory:');await migrate(sql);await sql.exec(workspaceConnectionSchema);
  const store=createStore(sql);
  for(const id of ['owner','old','new','stranger'])await store.upsertUser({id,login:id});
  await store.upsertInstallation({id:81,accountId:81,accountLogin:'source',accountType:'User'});
  await store.linkUserInstallation(81,'owner');await store.linkUserInstallation(81,'old');
  const source=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===81)!;
  const destination=await createWorkspace(sql,'owner',source.organization_id,'Engineering');
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'new','viewer','explicit')",[destination.id]);
  return {sql,store,source,destination};
}
describe('explicit workspace connection placement',()=>{
  it('moves an unused connection, retains billing and prevents GitHub refresh from regranting access',async()=>{
    const {sql,store,source,destination}=await setup();try{
      const billing=(await sql.query('SELECT * FROM billing_accounts WHERE installation_id=81')).rows;
      await moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id);
      expect((await uploadWorkspaceScope(sql,'owner',81)).id).toBe(destination.id);
      expect((await uploadWorkspaceScope(sql,null,81)).id).toBe(destination.id);
      expect((await sql.query('SELECT user_id,role FROM installation_users WHERE installation_id=81 ORDER BY user_id')).rows)
        .toEqual([{user_id:'new',role:'viewer'},{user_id:'owner',role:'admin'}]);
      await store.linkUserInstallation(81,'old');await store.linkUserInstallation(81,'stranger');
      await store.linkUserToAccountInstallations('stranger',81);
      await store.upsertInstallation({id:81,accountId:81,accountLogin:'renamed',accountType:'User'});
      for(const user of ['owner','old','new','stranger'])await ensureUserWorkspaces(sql,user);
      expect((await sql.query('SELECT user_id FROM installation_users WHERE installation_id=81 ORDER BY user_id')).rows)
        .toEqual([{user_id:'new'},{user_id:'owner'}]);
      expect((await listUserWorkspaces(sql,'old')).find(w=>w.id===source.id)?.role).toBe('member');
      expect((await listUserWorkspaces(sql,'new')).some(w=>w.id===source.id)).toBe(false);
      expect((await listUserWorkspaces(sql,'owner')).find(w=>w.id===destination.id)?.installation_ids.map(Number)).toEqual([81]);
      expect((await sql.query('SELECT * FROM billing_accounts WHERE installation_id=81')).rows).toEqual(billing);
      expect((await sql.query('SELECT actor_user_id FROM product_connection_events')).rows).toEqual([{actor_user_id:'owner'}]);
      await expect(sql.query("UPDATE product_connection_events SET actor_user_id='stranger'")).rejects.toThrow();
      await expect(sql.query('DELETE FROM product_connection_events')).rejects.toThrow();
      await expect(sql.query('TRUNCATE product_connection_events')).rejects.toThrow();
    }finally{await sql.close();}
  });
  it('rejects populated connections without changing access or ownership',async()=>{
    const {sql,store,source,destination}=await setup();try{
      await store.queueUploadedScan({id:crypto.randomUUID(),userId:'owner',installationId:81,workspaceId:source.id,target:'test.tgz',bytes:new Uint8Array([1])});
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id)).rejects.toMatchObject({status:409});
      expect((await sql.query('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=81')).rows[0]).toEqual({workspace_id:source.id});
      expect((await sql.query("SELECT user_id FROM installation_users WHERE installation_id=81 AND user_id='old'")).rows).toHaveLength(1);
      expect((await sql.query('SELECT id FROM product_connection_events')).rows).toHaveLength(0);
    }finally{await sql.close();}
  });
  it('requires authority at all boundaries and refuses archived or cross-organisation destinations',async()=>{
    const {sql,source,destination}=await setup();try{
      await expect(moveUnusedWorkspaceConnection(sql,'old',81,source.id,destination.id)).rejects.toMatchObject({status:403});
      await sql.query("UPDATE product_workspace_members SET role='viewer' WHERE workspace_id=$1 AND user_id='owner'",[destination.id]);
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id)).rejects.toMatchObject({status:403});
      await sql.query("UPDATE product_workspace_members SET role='owner' WHERE workspace_id=$1 AND user_id='owner'",[destination.id]);
      await sql.query("DELETE FROM product_organization_members WHERE organization_id=$1 AND user_id='owner'",[source.organization_id]);
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id)).rejects.toMatchObject({status:403});
      await sql.query("INSERT INTO product_organization_members(organization_id,user_id,role) VALUES($1,'owner','owner')",[source.organization_id]);
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=81 AND user_id='owner'");
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id)).rejects.toMatchObject({status:403});
      await sql.query("UPDATE installation_users SET role='admin' WHERE installation_id=81 AND user_id='owner'");
      await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[destination.id]);
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,destination.id)).rejects.toMatchObject({status:409});
      const personal=(await listUserWorkspaces(sql,'owner')).find(w=>!w.installation_id&&w.id!==destination.id)!;
      await expect(moveUnusedWorkspaceConnection(sql,'owner',81,source.id,personal.id)).rejects.toMatchObject({status:409});
    }finally{await sql.close();}
  });
});
