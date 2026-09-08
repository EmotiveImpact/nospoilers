import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {mintWorkspaceToken,listWorkspaceTokens} from '../src/server/workspace-tokens.ts';
it('shares one atomic cap between legacy connection tokens and independent workspace tokens',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===7)!;
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>i%2
   ?mintWorkspaceToken(sql,'owner',workspace.id,`Workspace ${i}`)
   :store.insertScanApiToken({installationId:7,name:`Legacy ${i}`,createdByLogin:'owner'})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(5);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(5);
  expect((await listWorkspaceTokens(sql,'owner',workspace.id)).tokens).toHaveLength(5);
 }finally{await sql.close();}
});
it('mints independent workspace credentials atomically with authority, entitlement and audit',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','viewer']){await store.upsertUser({id,login:id});await store.createSession(id);}
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  await expect(mintWorkspaceToken(sql,'viewer',workspace.id,'CI')).rejects.toMatchObject({status:403});
  await expect(mintWorkspaceToken(sql,'owner',workspace.id,'bad\nname')).rejects.toMatchObject({status:400});
  const results=await Promise.allSettled(Array.from({length:7},(_,i)=>mintWorkspaceToken(sql,'owner',workspace.id,`CI ${i}`)));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(5);
  expect(results.filter(r=>r.status==='rejected')).toHaveLength(2);
  const tokens=await listWorkspaceTokens(sql,'owner',workspace.id);
  expect(tokens.tokens.every(t=>t.installation_id===null)).toBe(true);
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE workspace_id=$1 AND action='token_minted'",[workspace.id])).rows).toHaveLength(5);
  expect((await sql.query('SELECT id FROM installations')).rows).toHaveLength(0);
  await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='owner'");
  await expect(mintWorkspaceToken(sql,'owner',workspace.id,'Expired')).rejects.toMatchObject({status:402});
 }finally{await sql.close();}
});
