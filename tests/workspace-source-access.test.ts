import {describe,it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {workspaceSourceAccess} from '../src/server/workspace-source-access.ts';

describe('workspace authority over source projection',()=>{
  it('uses explicit membership instead of stale projected roles and preserves archived read access',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'owner',login:'owner'});
      await store.upsertInstallation({id:391,accountLogin:'source',accountType:'User',accountId:391});
      await store.linkUserInstallation(391,'owner');
      await store.upsertRepo({id:391,installationId:391,owner:'source',name:'repo',fullName:'source/repo',private:true,htmlUrl:'https://github.com/source/repo'});
      const alertId=await store.insertAlert({installationId:391,repoId:391,kind:'test',title:'Private finding',body:'Evidence'});
      const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===391)!;
      expect(await workspaceSourceAccess(sql,'owner',391)).toEqual({role:'admin',archived:false});
      await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'owner')",[workspace.id]);
      expect((await workspaceSourceAccess(sql,'owner',391)).role).toBeNull();
      expect(await store.listInstallationsForUser('owner')).toEqual([]);
      expect(await store.listReposForUser('owner')).toEqual([]);
      expect(await store.listAlertsForUser('owner')).toEqual([]);
      expect(await store.getAlertForUser(alertId,'owner')).toBeNull();
      expect(await store.listInstallationMembersForUser('owner',391)).toEqual([]);
      expect((await store.listJobsForUser('owner',391)).fairUse).toBeNull();
      await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
      await sql.query("UPDATE product_workspace_members SET role='viewer',access_source='explicit' WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
      expect(await workspaceSourceAccess(sql,'owner',391)).toEqual({role:'viewer',archived:false});
      expect((await store.listInstallationsForUser('owner'))[0]?.role).toBe('viewer');
      // Explicit membership still works if the old compatibility row is absent.
      await sql.query("DELETE FROM installation_users WHERE installation_id=391 AND user_id='owner'");
      expect(await store.listReposForUser('owner')).toHaveLength(1);
      expect(await store.listAlertsForUser('owner')).toHaveLength(1);
      expect((await store.listInstallationsForUser('owner'))[0]?.role).toBe('viewer');
      await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
      expect(await workspaceSourceAccess(sql,'owner',391)).toEqual({role:'viewer',archived:true});
      await sql.query('UPDATE product_workspace_installations SET explicitly_assigned=true WHERE installation_id=391');
      await sql.query("DELETE FROM product_workspace_members WHERE workspace_id=$1 AND user_id='owner'",[workspace.id]);
      expect((await workspaceSourceAccess(sql,'owner',391)).role).toBeNull();
    }finally{await sql.close();}
  });
  it('does not grant a different user source access',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'owner',login:'owner'});
      await store.upsertInstallation({id:392,accountLogin:'source',accountType:'User',accountId:392});
      await store.linkUserInstallation(392,'owner');
      expect(await workspaceSourceAccess(sql,'stranger',392)).toEqual({role:null,archived:false});
      expect(await workspaceSourceAccess(sql,'stranger',999)).toEqual({role:null,archived:false});
    }finally{await sql.close();}
  });
});
