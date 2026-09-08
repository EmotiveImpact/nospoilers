import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {mintScanToken} from '../src/server/scan-api.ts';
it('requires immutable independent credential ownership without inventing an installation',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await store.createSession('owner');
  const workspace=(await listUserWorkspaces(sql,'owner'))[0],minted=mintScanToken();
  const insert=(workspaceId:string|null)=>sql.query<{id:number}>("INSERT INTO scan_api_tokens(workspace_id,name,token_prefix,token_hash,created_by_login) VALUES($1,'CI',$2,$3,'owner') RETURNING id",[workspaceId,minted.tokenPrefix,minted.tokenHash]);
  await expect(insert(null)).rejects.toThrow('scan_token_owner_required');
  const id=(await insert(workspace.id)).rows[0].id;
  expect((await sql.query('SELECT installation_id,workspace_id FROM scan_api_tokens WHERE id=$1',[id])).rows).toEqual([{installation_id:null,workspace_id:workspace.id}]);
  await expect(sql.query('UPDATE scan_api_tokens SET workspace_id=NULL WHERE id=$1',[id])).rejects.toThrow('immutable');
  // The legacy installation-only authenticator must never coerce this token to install 0.
  expect(await store.authenticateScanToken(minted.token)).toBeNull();
 }finally{await sql.close();}
});
