import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin,verifyWorkspaceOrigin,changeWorkspaceOrigin} from '../src/server/workspace-origins.ts';
it('pauses admission and disconnects with typed confirmation, retaining immutable audit and source identity',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];const origin=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
  await verifyWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'dns',async(_h,_t,method)=>({method,detail:'matched'}));
  await changeWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'pause');
  await expect(store.queueUploadedScan({id:'paused',userId:'owner',installationId:null,workspaceId:workspace.id,sourceOriginId:origin.id,target:origin.origin_url,bytes:new Uint8Array()})).rejects.toMatchObject({status:409});
  await changeWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'resume');
  await expect(changeWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'disconnect','wrong')).rejects.toMatchObject({status:400});
  await changeWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'disconnect',origin.origin_url);
  await changeWorkspaceOrigin(sql,'owner',workspace.id,origin.id,'reconnect');
  const source=(await sql.query<{verified_at:unknown;verification_token:string}>('SELECT verified_at,verification_token FROM watched_origins WHERE id=$1',[origin.id])).rows[0];expect(source.verified_at).toBeNull();expect(source.verification_token).not.toBe(origin.verification_token);
  expect((await sql.query('SELECT action FROM workspace_origin_events ORDER BY id')).rows).toEqual(['connected','verified','paused','resumed','disconnected','reconnected'].map(action=>({action})));
  await expect(sql.query('DELETE FROM workspace_origin_events')).rejects.toThrow('append-only');
 }finally{await sql.close();}
});
