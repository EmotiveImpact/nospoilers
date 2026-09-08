import { describe,it,expect } from 'vitest';
import { openSql,migrate } from '../src/server/sql.ts';
import { createStore } from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces,uploadWorkspaceScope} from '../src/server/workspaces.ts';
describe('workspace foundation migration',()=>{
  it('returns one workspace with all of its connections instead of duplicate workspace rows',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'multi',login:'multi'});
      for(const id of [31,32]){await store.upsertInstallation({id,accountId:id,accountLogin:`source-${id}`,accountType:'Organization'});await store.linkUserInstallation(id,'multi');}
      const first=(await listUserWorkspaces(sql,'multi')).find(w=>Number(w.installation_id)===31)!;
      await sql.query('UPDATE product_workspace_installations SET workspace_id=$1 WHERE installation_id=32',[first.id]);
      const rows=await listUserWorkspaces(sql,'multi');
      expect(rows.filter(w=>w.id===first.id)).toHaveLength(1);
      expect(rows.find(w=>w.id===first.id)?.installation_ids.map(Number)).toEqual([31,32]);
      expect((await uploadWorkspaceScope(sql,'multi',32)).id).toBe(first.id);
      expect((await uploadWorkspaceScope(sql,null,32)).id).toBe(first.id);
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=32 AND user_id='multi'");
      await expect(store.queueUploadedScan({id:crypto.randomUUID(),userId:'multi',installationId:32,workspaceId:first.id,target:'x.zip',bytes:new Uint8Array([1])})).rejects.toMatchObject({status:403});
    }finally{await sql.close();}
  });
  it('bootstraps new users and respects subsequent source membership revocation',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'new',login:'new-user'});
      await store.upsertInstallation({id:9,accountId:9,accountLogin:'org',accountType:'Organization'});
      await store.linkUserInstallation(9,'new');
      await ensureUserWorkspaces(sql,'new');await ensureUserWorkspaces(sql,'new');
      expect(await listUserWorkspaces(sql,'new')).toHaveLength(2);
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=9");
      expect((await listUserWorkspaces(sql,'new')).find(row=>row.installation_id!=null)?.role).toBe('viewer');
      await sql.query("DELETE FROM installation_users WHERE installation_id=9");
      expect(await listUserWorkspaces(sql,'new')).toHaveLength(1);
      expect(await listUserWorkspaces(sql,'stranger')).toHaveLength(0);
    }finally{await sql.close();}
  });
  it('backfills separate tenants without moving evidence or promoting installation members',async()=>{
    const sql=await openSql('pglite://:memory:');
    try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'person',login:'same-person'});
      for(const id of [7,8]){
        await store.upsertInstallation({id,accountId:id,accountLogin:`org-${id}`,accountType:'Organization'});
        // Seed legacy rows directly: linking through today's store already bootstraps workspaces.
        await sql.query("INSERT INTO installation_users(installation_id,user_id,role) VALUES($1,'person','admin')",[id]);
      }
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=8");
      await sql.query("DELETE FROM schema_migrations WHERE id='071_workspace_foundation'");
      await migrate(sql);
      expect((await sql.query('SELECT id FROM product_organizations')).rows).toHaveLength(3);
      expect((await sql.query('SELECT id FROM product_workspaces')).rows).toHaveLength(3);
      expect((await sql.query('SELECT installation_id FROM product_workspace_installations')).rows).toHaveLength(2);
      const rows=await sql.query<{role:string}>(`SELECT m.role FROM product_workspace_members m JOIN product_workspaces w ON w.id=m.workspace_id JOIN product_organizations o ON o.id=w.organization_id WHERE o.legacy_installation_id=8`);
      expect(rows.rows[0].role).toBe('viewer');
      // Subsequent migrations must not recreate removed membership.
      await sql.query("DELETE FROM product_workspace_members WHERE role='viewer'");
      await migrate(sql);
      expect((await sql.query("SELECT role FROM product_workspace_members WHERE role='viewer'")).rows).toHaveLength(0);
      expect((await sql.query('SELECT id FROM installations')).rows).toHaveLength(2);
    }finally{await sql.close();}
  });
});
