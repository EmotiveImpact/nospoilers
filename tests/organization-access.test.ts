import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {inviteWorkspaceMember,acceptWorkspaceInvite} from '../src/server/workspace-membership.ts';
import {listManagedOrganizations,changeOrganizationAccess,organizationAccess} from '../src/server/organization-access.ts';
it('separates workspace administration from subscription ownership and preserves the last organisation owner',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    for(const id of ['owner','admin','stranger']){await store.upsertUser({id,login:id});await ensureUserWorkspaces(sql,id);}
    const workspace=(await listUserWorkspaces(sql,'owner'))[0];
    const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'admin','admin');await acceptWorkspaceInvite(sql,'admin',invite.id);
    expect((await listManagedOrganizations(sql,'admin')).some(o=>o.id===workspace.organization_id)).toBe(false);
    await expect(createWorkspace(sql,'admin',workspace.organization_id,'Denied')).rejects.toMatchObject({status:403});
    await expect(changeOrganizationAccess(sql,'owner',workspace.organization_id,'stranger','owner')).rejects.toMatchObject({status:404});
    await expect(changeOrganizationAccess(sql,'owner',workspace.organization_id,'owner',null)).rejects.toMatchObject({status:409});
    await changeOrganizationAccess(sql,'owner',workspace.organization_id,'admin','admin');
    const added=await createWorkspace(sql,'admin',workspace.organization_id,'Allowed');
    expect(added.organization_id).toBe(workspace.organization_id);
    await expect(changeOrganizationAccess(sql,'admin',workspace.organization_id,'owner','admin')).rejects.toMatchObject({status:403});
    await changeOrganizationAccess(sql,'owner',workspace.organization_id,'admin','owner');
    await changeOrganizationAccess(sql,'admin',workspace.organization_id,'owner',null);
    await ensureUserWorkspaces(sql,'owner');
    expect((await listManagedOrganizations(sql,'owner')).some(o=>o.id===workspace.organization_id)).toBe(false);
    expect((await listUserWorkspaces(sql,'owner')).some(w=>w.id===workspace.id)).toBe(true);
    expect((await organizationAccess(sql,'admin',workspace.organization_id)).events).toHaveLength(3);
  }finally{await sql.close();}
});
