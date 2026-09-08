import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';

it('returns only scoped token metadata and live management permissions',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql),cookies:Record<string,string>={};
  for(const id of ['owner','viewer','stranger']){await store.upsertUser({id,login:id});cookies[id]=`ns_session=${signSession('tokens-test',await store.createSession(id))}`;}
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===7)!;
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const token=await store.insertScanApiToken({installationId:7,name:'CI',createdByLogin:'owner'});
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'tokens-test',appBaseUrl:'http://127.0.0.1:4347'})});
  const url=`/api/workspaces/${workspace.id}/tokens`,get=(actor:string)=>app.request(url,{headers:{cookie:cookies[actor]??''}});
  expect((await get('')).status).toBe(401);expect((await get('stranger')).status).toBe(404);
  const response=await get('owner');expect(response.headers.get('cache-control')).toBe('no-store');
  const body=await response.json() as {tokens:Array<Record<string,unknown>>;canManage:boolean};
  expect(body.canManage).toBe(true);expect(body.tokens).toHaveLength(1);expect(body.tokens[0].name).toBe('CI');
  expect(body.tokens[0]).not.toHaveProperty('token_hash');expect(JSON.stringify(body)).not.toContain(token.token);
  expect((await (await get('viewer')).json() as {canManage:boolean}).canManage).toBe(false);
  const mint=(actor:string,name:unknown='Workspace CI',origin='http://127.0.0.1:4347')=>app.request(url,{method:'POST',headers:{cookie:cookies[actor]??'',origin,'content-type':'application/json'},body:JSON.stringify({name})});
  expect((await mint('')).status).toBe(401);
  expect((await mint('stranger')).status).toBe(404);
  expect((await mint('viewer')).status).toBe(403);
  expect((await mint('owner','CI','https://attacker.invalid')).status).toBe(403);
  expect((await mint('owner',{invalid:true})).status).toBe(400);
  const mintedResponse=await mint('owner');expect(mintedResponse.status).toBe(200);
  expect(mintedResponse.headers.get('cache-control')).toBe('no-store');
  const minted=await mintedResponse.json() as {token:string;scanToken:{id:number}};
  expect(minted.token).toMatch(/^nsp_[a-f0-9]{64}$/);
  const listed=await (await get('owner')).text();expect(listed).not.toContain(minted.token);expect(listed).not.toContain('token_hash');
  expect((await sql.query('SELECT installation_id FROM scan_api_tokens WHERE id=$1',[minted.scanToken.id])).rows).toEqual([{installation_id:null}]);
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE workspace_id=$1 AND action='token_minted'",[workspace.id])).rows).toHaveLength(1);
  const revoke=(actor:string,confirm:string,origin='http://127.0.0.1:4347')=>app.request(`${url}/${token.id}`,{method:'DELETE',headers:{cookie:cookies[actor]??'',origin,'content-type':'application/json'},body:JSON.stringify({confirm})});
  expect((await revoke('viewer','CI')).status).toBe(403);
  expect((await revoke('owner','wrong')).status).toBe(400);
  expect((await revoke('owner','CI','https://attacker.invalid')).status).toBe(403);
  expect(await store.authenticateScanToken(token.token)).not.toBeNull();
  const responses=await Promise.all([revoke('owner','CI'),revoke('owner','CI')]);
  expect(responses.map(r=>r.status)).toEqual([200,200]);
  expect(await store.authenticateScanToken(token.token)).toBeNull();
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE workspace_id=$1 AND action='token_revoked'",[workspace.id])).rows).toHaveLength(1);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  expect((await mint('owner')).status).toBe(403);
  expect((await (await get('owner')).json() as {canManage:boolean}).canManage).toBe(false);
  await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'viewer')",[workspace.id]);
  expect((await get('viewer')).status).toBe(404);
  await sql.query('UPDATE product_workspaces SET archived_at=NULL WHERE id=$1',[workspace.id]);
  await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=7");
  expect((await mint('owner')).status).toBe(402);
  expect((await sql.query("SELECT id FROM product_workspace_events WHERE workspace_id=$1 AND action='token_minted'",[workspace.id])).rows).toHaveLength(1);
 }finally{await sql.close();}
});
