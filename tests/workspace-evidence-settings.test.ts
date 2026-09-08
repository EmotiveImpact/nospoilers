import {describe,it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {workspaceEvidenceSettings} from '../src/server/workspace-evidence-settings.ts';

describe('workspace evidence settings',()=>{
 it('scopes evidence and audit, supports read-only members and rejects foreign cursors',async()=>{
  const sql=await openSql('pglite://:memory:');try{
   await migrate(sql);const store=createStore(sql);
   for(const id of ['owner','viewer','stranger']){await store.upsertUser({id,login:id});await ensureUserWorkspaces(sql,id);}
   const workspace=(await listUserWorkspaces(sql,'owner'))[0];
   const other=(await listUserWorkspaces(sql,'stranger'))[0];
   await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
   const a='00000000-0000-0000-0000-000000000001';
   await sql.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action) VALUES($1,$2,'owner','created')",[a,workspace.id]);
   const owner=await workspaceEvidenceSettings(sql,'owner',workspace.id);
   expect(owner.workspace.organization_owner).toBe(true);
   expect(owner.events).toHaveLength(1);
   expect(owner.retention).toMatchObject({savedScans:0,activeScans:0,disconnect:'retain_history'});
   expect((await workspaceEvidenceSettings(sql,'viewer',workspace.id)).workspace).toMatchObject({role:'viewer',organization_owner:false});
   expect((await workspaceEvidenceSettings(sql,'owner',workspace.id,a)).events).toHaveLength(0);
   await expect(workspaceEvidenceSettings(sql,'stranger',workspace.id)).rejects.toMatchObject({status:404});
   await expect(workspaceEvidenceSettings(sql,'stranger',other.id,a)).rejects.toMatchObject({status:404});
   await expect(workspaceEvidenceSettings(sql,'owner',workspace.id,'invalid')).rejects.toMatchObject({status:400});
  }finally{await sql.close();}
 });
});
