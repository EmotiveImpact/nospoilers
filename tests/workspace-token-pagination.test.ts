import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {listWorkspaceTokens} from '../src/server/workspace-tokens.ts';

it('pages retained credentials without exposing a foreign workspace or skipping records',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  for(const id of [7,8]){await store.upsertInstallation({id,accountId:id,accountLogin:`source${id}`,accountType:'User'});await store.linkUserInstallation(id,'owner');}
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===7)!;
  await sql.query(`INSERT INTO scan_api_tokens(installation_id,name,token_prefix,token_hash,created_by_login,revoked_at)
   SELECT 7,'Old CI '||n,'prefix','fixture-'||n,'owner',now() FROM generate_series(1,121) n`);
  const foreign=await store.insertScanApiToken({installationId:8,name:'Foreign',createdByLogin:'owner'});
  const first=await listWorkspaceTokens(sql,'owner',workspace.id);
  const second=await listWorkspaceTokens(sql,'owner',workspace.id,first.nextCursor!);
  const third=await listWorkspaceTokens(sql,'owner',workspace.id,second.nextCursor!);
  expect([first.tokens.length,second.tokens.length,third.tokens.length]).toEqual([50,50,21]);
  expect(third.nextCursor).toBeNull();
  expect(new Set([...first.tokens,...second.tokens,...third.tokens].map(t=>t.id)).size).toBe(121);
  expect(first.tokens.some(t=>t.name==='Foreign')).toBe(false);
  await expect(listWorkspaceTokens(sql,'owner',workspace.id,String(foreign.id))).rejects.toMatchObject({status:404});
  await expect(listWorkspaceTokens(sql,'owner',workspace.id,'invalid')).rejects.toMatchObject({status:400});
 }finally{await sql.close();}
});
