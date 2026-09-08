import {describe,it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {createWorkspace,ensureUserWorkspaces,listUserWorkspaces,updateWorkspace} from '../src/server/workspaces.ts';

describe('workspace management boundaries',()=>{
  it('serializes allowance, preserves trial and prevents cross-tenant management',async()=>{
    const sql=await openSql('pglite://:memory:');
    try{
      await migrate(sql);const store=createStore(sql);
      for(const id of ['owner','stranger']){await store.upsertUser({id,login:id});await ensureUserWorkspaces(sql,id);}
      const [initial]=await listUserWorkspaces(sql,'owner');
      const before=await sql.query('SELECT trial_ends_at,plan FROM users WHERE id=$1',['owner']);
      await expect(createWorkspace(sql,'stranger',initial.organization_id,'Unauthorized')).rejects.toMatchObject({status:403});
      const attempts=await Promise.allSettled([createWorkspace(sql,'owner',initial.organization_id,'Product'),createWorkspace(sql,'owner',initial.organization_id,'Other')]);
      expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
      expect(attempts.filter(result=>result.status==='rejected')).toHaveLength(1);
      const created=(await listUserWorkspaces(sql,'owner')).find(row=>row.id!==initial.id)!;
      expect(created.installation_id).toBeNull();
      await expect(updateWorkspace(sql,'stranger',created.id,{name:'Hijacked'})).rejects.toMatchObject({status:404});
      await expect(updateWorkspace(sql,'owner',initial.id,{archived:true})).rejects.toMatchObject({status:409});
      await updateWorkspace(sql,'owner',created.id,{name:'  Production  ',archived:true});
      const replacement=await createWorkspace(sql,'owner',initial.organization_id,'Staging');
      await expect(updateWorkspace(sql,'owner',created.id,{archived:false})).rejects.toMatchObject({status:409});
      await updateWorkspace(sql,'owner',replacement.id,{archived:true});
      await updateWorkspace(sql,'owner',created.id,{archived:false});
      const after=await sql.query('SELECT trial_ends_at,plan FROM users WHERE id=$1',['owner']);
      expect(after.rows).toEqual(before.rows);
      expect((await sql.query('SELECT * FROM personal_scan_usage')).rows).toHaveLength(0);
      expect((await listUserWorkspaces(sql,'owner')).find(row=>row.id===created.id)?.name).toBe('Production');
      expect((await sql.query('SELECT action FROM product_workspace_events')).rows).toHaveLength(6);
    }finally{await sql.close();}
  });
  it('does not copy source access to new workspaces and respects live revocations',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'admin',login:'admin'});
      await store.upsertInstallation({id:99,accountId:99,accountLogin:'team',accountType:'Organization'});
      await store.linkUserInstallation(99,'admin');
      const original=(await listUserWorkspaces(sql,'admin')).find(w=>w.installation_id!=null)!;
      const added=await createWorkspace(sql,'admin',original.organization_id,'Independent');
      expect((await listUserWorkspaces(sql,'admin')).find(w=>w.id===added.id)?.installation_id).toBeNull();
      await sql.query("UPDATE installation_users SET role='viewer' WHERE user_id='admin'");
      // Source permissions and billing organisation ownership are independent after migration.
      await updateWorkspace(sql,'admin',added.id,{name:'Still owned'});
      await expect(createWorkspace(sql,'admin',original.organization_id,'Over allowance')).rejects.toMatchObject({status:409});
      await sql.query('DELETE FROM product_organization_members WHERE organization_id=$1 AND user_id=$2',[original.organization_id,'admin']);
      await expect(createWorkspace(sql,'admin',original.organization_id,'Denied')).rejects.toMatchObject({status:403});
      await sql.query('DELETE FROM installations WHERE id=99');
      // A deliberately created workspace is product-owned; disconnecting GitHub does not
      // remove that explicit ownership. The migrated GitHub workspace still loses legacy access.
      expect((await listUserWorkspaces(sql,'admin')).some(w=>w.id===original.id)).toBe(false);
      expect((await listUserWorkspaces(sql,'admin')).some(w=>w.id===added.id)).toBe(true);
      expect((await sql.query('SELECT id FROM product_workspaces WHERE id=$1',[added.id])).rows).toHaveLength(1);
    }finally{await sql.close();}
  });
  it('rejects invalid identifiers and names before writes',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);
      await expect(createWorkspace(sql,'user','bad','\n')).rejects.toMatchObject({status:400});
      await expect(createWorkspace(sql,'user','bad','Valid')).rejects.toMatchObject({status:404});
      await expect(updateWorkspace(sql,'user','bad',{name:'Valid'})).rejects.toMatchObject({status:404});
    }finally{await sql.close();}
  });
});
