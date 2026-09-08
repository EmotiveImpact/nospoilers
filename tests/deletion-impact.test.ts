import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {deletionImpact} from '../src/server/deletion-impact.ts';
it('reports exact authorised scope without authorising or performing deletion',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status) VALUES('saved','owner',$1,'saved.zip','hash','failed'),('other','owner',$2,'other.zip','hash','queued')`,[workspace.id,other.id]);
  await sql.query(`INSERT INTO uploaded_proof_shares(id,upload_id,token_hash,projection) VALUES('00000000-0000-0000-0000-000000000001','saved','token','{}')`);
  await sql.query(`INSERT INTO jobs(delivery_id,priority,kind,payload) VALUES('upload:other','heavy','uploaded_scan','{"uploadId":"other"}')`);
  const impact=await deletionImpact(sql,'owner',workspace.organization_id,{scope:'workspace_history',workspaceId:workspace.id});
  expect(impact).toMatchObject({executionAvailable:false,holdsChecked:false,counts:{workspaces:1,savedUploadRecords:1,activeUploads:0,activeJobs:0,sourceConnections:0,publicLinks:1}});
  expect((await deletionImpact(sql,'owner',workspace.organization_id,{scope:'organization_closure'})).counts).toMatchObject({workspaces:2,savedUploadRecords:1,activeUploads:1,activeJobs:1,publicLinks:1});
  expect((await sql.query('SELECT id FROM uploaded_scans')).rows).toHaveLength(2);
  await expect(deletionImpact(sql,'stranger',workspace.organization_id,{scope:'organization_closure'})).rejects.toMatchObject({status:403});
  await expect(deletionImpact(sql,'owner',workspace.organization_id,{scope:'organization_closure',workspaceId:workspace.id})).rejects.toMatchObject({status:400});
 }finally{await sql.close();}
});
