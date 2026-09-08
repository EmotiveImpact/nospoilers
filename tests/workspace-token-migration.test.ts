import {it,expect} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {mintScanToken} from '../src/server/scan-api.ts';

it('backfills existing token ownership without changing credential material or revocation history',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  const old=(client:SqlClient):SqlClient=>({...client,
   query:async<T>(text:string,params?:unknown[])=>Number(text.match(/^SELECT id FROM schema_migrations WHERE id='(\d+)_/)?.[1])>=102?{rows:[{id:'skip'} as T]}:client.query<T>(text,params),
   transaction:fn=>client.transaction(tx=>fn(old(tx))),
  });
  await migrate(old(sql));const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountLogin:'owner',accountType:'User',accountId:7});
  await store.linkUserInstallation(7,'owner');
  const insertLegacy=async(name:string)=>{
   const minted=mintScanToken();
   const row=(await sql.query<{id:number}>("INSERT INTO scan_api_tokens(installation_id,name,token_prefix,token_hash,created_by_login) VALUES(7,$1,$2,$3,'owner') RETURNING id",[name,minted.tokenPrefix,minted.tokenHash])).rows[0];
   return {id:row.id,token:minted.token};
  };
  const live=await insertLegacy('Existing CI');
  const revoked=await insertLegacy('Retired CI');
  await store.revokeScanApiTokenForUser(revoked.id,'owner');
  const before=(await sql.query<Record<string,unknown>>('SELECT * FROM scan_api_tokens ORDER BY id')).rows;
  await migrate(sql);
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  expect((await sql.query('SELECT * FROM scan_api_tokens ORDER BY id')).rows).toEqual(before.map(row=>({...row,workspace_id:workspace})));
  expect(await store.authenticateScanToken(live.token)).toEqual({id:live.id,installationId:7});
  expect(await store.authenticateScanToken(revoked.token)).toBeNull();
  await migrate(sql);
  expect((await sql.query('SELECT * FROM scan_api_tokens ORDER BY id')).rows).toEqual(before.map(row=>({...row,workspace_id:workspace})));
 }finally{await sql.close();}
});
