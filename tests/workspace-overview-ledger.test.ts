import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {workspaceOverview} from '../src/server/workspace-overview.ts';
it('includes connected release evidence without counting uploaded revisions twice',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=7')).rows[0].workspace_id;
  const receipt=(await sql.query<{id:number}>("INSERT INTO scan_receipts(installation_id,coordinate,status,engine_version,manifest,finding_fingerprints,signature,receipt) VALUES(7,'test','passed','test','[]','[]','test','{}') RETURNING id")).rows[0].id;
  const revision=await store.insertReleaseRevision({installationId:7,receiptId:receipt,coordinate:'test',channel:'stable',artifactSha256:'hash',mismatch:false});
  expect((await workspaceOverview(sql,'owner',workspace)).hostedReleases).toEqual({total:1,passed:1,attention:0});
  expect((await workspaceOverview(sql,'owner',workspace)).hostedSources).toEqual([{installationId:7,name:'owner',total:1,passed:1,attention:0}]);
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,installation_id,target,artifact_sha256,status,revision_id,report_json) VALUES('upload','owner',$1,7,'test','hash','done',$2,'{\"ok\":true,\"status\":\"passed\"}')",[workspace,revision.id]);
  const result=await workspaceOverview(sql,'owner',workspace);
  expect(result.hostedReleases).toEqual({total:0,passed:0,attention:0});expect(result.counts.total).toBe(1);
  await store.insertReleaseRevision({installationId:7,receiptId:receipt,coordinate:'changed',channel:'stable',artifactSha256:'different',mismatch:true});
  expect((await workspaceOverview(sql,'owner',workspace)).hostedReleases).toEqual({total:1,passed:0,attention:1});
  await store.upsertInstallation({id:8,accountId:8,accountLogin:'foreign',accountType:'User'});
  await sql.query(`INSERT INTO jobs(installation_id,priority,kind,payload,status) VALUES
   (7,'heavy','release_scan','{}','queued'),(7,'heavy','npm_scan','{}','running'),
   (7,'heavy','uploaded_scan','{}','queued'),(7,'heavy','workspace_origin_scan','{}','running'),
   (7,'light','member_added','{}','queued'),(7,'heavy','release_scan','{}','done'),
   (8,'heavy','release_scan','{}','queued')`);
  expect((await workspaceOverview(sql,'owner',workspace)).connectedActivity).toEqual([{installationId:7,name:'owner',queued:1,running:1}]);
 }finally{await sql.close();}
});
