import {describe,it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {inviteWorkspaceMember,acceptWorkspaceInvite,changeWorkspaceMember,pendingWorkspaceInvites,revokeWorkspaceInvite,workspaceTeam} from '../src/server/workspace-membership.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';

async function fixture(){
  const sql=await openSql('pglite://:memory:');await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','member','other']){await store.upsertUser({id,login:id});await ensureUserWorkspaces(sql,id);}
  const original=(await listUserWorkspaces(sql,'owner'))[0];
  const workspace=await createWorkspace(sql,'owner',original.organization_id,'Production');
  return {sql,store,original,workspace};
}
describe('explicit workspace membership',()=>{
  it('shows effective legacy roles and excludes revoked legacy access from the team',async()=>{
    const {sql,store}=await fixture();try{
      await store.upsertInstallation({id:98,accountId:98,accountLogin:'legacy',accountType:'Organization'});
      await store.linkUserInstallation(98,'owner');await store.linkUserInstallation(98,'member');
      const connected=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===98)!;
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=98 AND user_id='member'");
      expect((await workspaceTeam(sql,'owner',connected.id)).members.find(m=>m.user_id==='member')?.role).toBe('viewer');
      await sql.query("DELETE FROM installation_users WHERE installation_id=98 AND user_id='member'");
      expect((await workspaceTeam(sql,'owner',connected.id)).members.some(m=>m.user_id==='member')).toBe(false);
    }finally{await sql.close();}
  });
  it('projects explicit access to connected source APIs and prevents GitHub login from undoing removal',async()=>{
    const {sql,store}=await fixture();try{
      await store.upsertInstallation({id:99,accountId:99,accountLogin:'source-owner',accountType:'User'});
      await store.linkUserInstallation(99,'owner');
      await store.upsertRepo({id:101,installationId:99,owner:'source-owner',name:'app',fullName:'source-owner/app',private:true,htmlUrl:'https://github.com/source-owner/app'});
      const connected=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===99)!;
      const invite=await inviteWorkspaceMember(sql,'owner',connected.id,'member','member');await acceptWorkspaceInvite(sql,'member',invite.id);
      expect(await store.getInstallationRole('member',99)).toBe('member');
      expect(await store.listReposForUser('member',99)).toHaveLength(1);
      await store.setInstallationRoleForUser({actorUserId:'owner',installationId:99,targetUserId:'member',role:'viewer'});
      expect((await listUserWorkspaces(sql,'member')).find(w=>w.id===connected.id)?.role).toBe('viewer');
      await store.removeInstallationMemberForUser({actorUserId:'owner',installationId:99,targetUserId:'member'});
      expect(await store.listReposForUser('member',99)).toHaveLength(0);
      await store.linkUserInstallation(99,'member');
      await store.linkUserToAccountInstallations('member',99);
      await store.createSession('member');
      expect(await store.getInstallationRole('member',99)).toBeNull();
      expect((await listUserWorkspaces(sql,'member')).some(w=>w.id===connected.id)).toBe(false);
    }finally{await sql.close();}
  });
  it('does not publish results when access is revoked during parsing',async()=>{
    const {sql,store,workspace}=await fixture();try{
      const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'member','member');await acceptWorkspaceInvite(sql,'member',invite.id);
      const id='22222222-2222-4222-8222-222222222222';
      await store.queueUploadedScan({id,userId:'member',installationId:null,workspaceId:workspace.id,target:'test.zip',bytes:new Uint8Array([1])});
      await processUploadedScan(id,store,async()=>{
        await changeWorkspaceMember(sql,'owner',workspace.id,'member',null);
        return {target:'test.zip',kind:'zip',fileCount:1,findings:[],ok:true,status:'passed',scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null};
      },'test-secret');
      const result=await store.getUploadedScan('owner',id);
      expect(result?.status).toBe('failed');expect(result?.report_json).toBeNull();expect(result?.receipt_json).toBeNull();
      expect(await store.getUploadedScan('member',id)).toBeNull();
    }finally{await sql.close();}
  });
  it('binds an invitation to the intended account and grants only one workspace',async()=>{
    const {sql,store,workspace,original}=await fixture();try{
      const before=await sql.query('SELECT id,trial_ends_at,plan FROM users ORDER BY id');
      const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'member','member');
      expect((await pendingWorkspaceInvites(sql,'other'))).toHaveLength(0);
      await expect(acceptWorkspaceInvite(sql,'other',invite.id)).rejects.toMatchObject({status:404});
      expect((await listUserWorkspaces(sql,'member')).some(w=>w.id===workspace.id)).toBe(false);
      await acceptWorkspaceInvite(sql,'member',invite.id);
      expect((await listUserWorkspaces(sql,'member')).find(w=>w.id===workspace.id)?.role).toBe('member');
      expect((await listUserWorkspaces(sql,'member')).some(w=>w.id===original.id)).toBe(false);
      await expect(acceptWorkspaceInvite(sql,'member',invite.id)).rejects.toMatchObject({status:409});
      const id='11111111-1111-4111-8111-111111111111';
      await store.queueUploadedScan({id,userId:'member',installationId:null,workspaceId:workspace.id,target:'build.zip',bytes:new Uint8Array([1])});
      expect((await store.listUploadedScans('owner',undefined,workspace.id))).toHaveLength(1);
      expect(await store.getUploadedScan('other',id)).toBeNull();
      expect((await sql.query('SELECT user_id FROM personal_scan_usage')).rows).toEqual([{user_id:'owner'}]);
      expect((await sql.query('SELECT id,trial_ends_at,plan FROM users ORDER BY id')).rows).toEqual(before.rows);
    }finally{await sql.close();}
  });
  it('rejects viewers, expired invitations and invitations from revoked administrators',async()=>{
    const {sql,workspace}=await fixture();try{
      const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'member','viewer');await acceptWorkspaceInvite(sql,'member',invite.id);
      await expect(inviteWorkspaceMember(sql,'member',workspace.id,'other','member')).rejects.toMatchObject({status:403});
      await expect(changeWorkspaceMember(sql,'member',workspace.id,'owner','viewer')).rejects.toMatchObject({status:403});
      const expired=await inviteWorkspaceMember(sql,'owner',workspace.id,'other','viewer');
      await sql.query("UPDATE product_workspace_invites SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);
      await expect(acceptWorkspaceInvite(sql,'other',expired.id)).rejects.toMatchObject({status:409});
      await changeWorkspaceMember(sql,'owner',workspace.id,'member','admin');
      const revokedSender=await inviteWorkspaceMember(sql,'member',workspace.id,'other','member');
      await changeWorkspaceMember(sql,'owner',workspace.id,'member','viewer');
      await expect(acceptWorkspaceInvite(sql,'other',revokedSender.id)).rejects.toMatchObject({status:403});
    }finally{await sql.close();}
  });
  it('preserves the last owner under concurrent removal and keeps revocations across login',async()=>{
    const {sql,store,workspace}=await fixture();try{
      await expect(changeWorkspaceMember(sql,'owner',workspace.id,'owner',null)).rejects.toMatchObject({status:409});
      const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'member','member');await acceptWorkspaceInvite(sql,'member',invite.id);
      await changeWorkspaceMember(sql,'owner',workspace.id,'member','owner');
      const outcomes=await Promise.allSettled([changeWorkspaceMember(sql,'owner',workspace.id,'member',null),changeWorkspaceMember(sql,'member',workspace.id,'owner',null)]);
      expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);
      expect((await sql.query("SELECT user_id FROM product_workspace_members WHERE workspace_id=$1 AND role='owner'",[workspace.id])).rows).toHaveLength(1);
      await store.createSession('member');await store.createSession('owner');
      expect((await sql.query("SELECT user_id FROM product_workspace_members WHERE workspace_id=$1 AND role='owner'",[workspace.id])).rows).toHaveLength(1);
    }finally{await sql.close();}
  });
  it('revokes pending invitations and records membership activity',async()=>{
    const {sql,workspace}=await fixture();try{
      const invite=await inviteWorkspaceMember(sql,'owner',workspace.id,'member','viewer');
      await revokeWorkspaceInvite(sql,'owner',workspace.id,invite.id);
      await expect(acceptWorkspaceInvite(sql,'member',invite.id)).rejects.toMatchObject({status:409});
      expect((await pendingWorkspaceInvites(sql,'member'))).toHaveLength(0);
      expect((await workspaceTeam(sql,'owner',workspace.id)).events).toEqual(expect.arrayContaining([expect.objectContaining({action:'invite_revoked'})]));
      await expect(workspaceTeam(sql,'other',workspace.id)).rejects.toMatchObject({status:404});
    }finally{await sql.close();}
  });
});
