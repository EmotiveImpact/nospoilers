import {expect,it} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';

it('uses a sentinel for sized release pages, preserves scope and pages in the actual sort order',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  await store.upsertInstallation({id:8,accountId:8,accountLogin:'foreign',accountType:'User'});
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  const receipt=(await sql.query<{id:number}>("INSERT INTO scan_receipts(installation_id,coordinate,status,engine_version,manifest,finding_fingerprints,signature,receipt) VALUES(7,'test','passed','test','[]','[]','test','{}') RETURNING id")).rows[0].id;
  await sql.query(`INSERT INTO release_revisions(installation_id,receipt_id,channel,coordinate,artifact_sha256,created_at)
    SELECT 7,$1,'stable','app-'||n,'hash',now()-n*interval '1 minute' FROM generate_series(1,65) n`,[receipt]);
  await sql.query("INSERT INTO release_revisions(installation_id,receipt_id,channel,coordinate,artifact_sha256) VALUES(8,$1,'stable','foreign','hash')",[receipt]);
  const secret='pagination-test-session';
  const cookie=`ns_session=${signSession(secret,await store.createSession('owner'))}`;
  const app=createApp({store,config:loadConfig({sessionSecret:secret,receiptSecret:'test-secret'}),github:stubGithub()});
  const request=async(query:string)=>{
   const response=await app.request(`/api/releases?installationId=7&workspace=${workspace}${query}`,{headers:{cookie}});
   expect(response.status).toBe(200);return await response.json() as {releases:{id:number;coordinate:string}[];nextCursor:string|null};
  };
  expect((await request('')).releases).toHaveLength(50);
  for(const pageSize of [10,30,60]){
   let before:string|null=null;const names:string[]=[];
   do{
    const page=await request(`&pageSize=${pageSize}${before?`&before=${before}`:''}`);
    expect(page.releases.length).toBeLessThanOrEqual(pageSize);
    names.push(...page.releases.map(row=>row.coordinate));before=page.nextCursor;
   }while(before);
   expect(names).toEqual(Array.from({length:65},(_,n)=>`app-${n+1}`));
  }
  expect((await request('&pageSize=60&hostedDecision=all')).releases).toHaveLength(60);
  expect((await app.request(`/api/releases?installationId=8&workspace=${workspace}&pageSize=10`,{headers:{cookie}})).status).toBe(404);
  expect((await app.request(`/api/releases?installationId=7&pageSize=10&before=99999`,{headers:{cookie}})).status).toBe(404);
 }finally{await sql.close();}
});
