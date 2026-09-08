import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';

it('keeps artifact source separate from immutable organisation payer and refunds only once',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:81,accountId:81,accountLogin:'Org',accountType:'Organization'});
  await store.linkUserInstallation(81,'owner');
  const source=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===81)!;
  const workspace=await createWorkspace(sql,'owner',source.organization_id,'Artifacts');
  const id=crypto.randomUUID();
  await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:workspace.id,target:'test.zip',bytes:new Uint8Array([1])});
  const row=(await sql.query<{id:number;installation_id:number|null;billing_installation_id:number;billing_user_id:string|null}>('SELECT id,installation_id,billing_installation_id,billing_user_id FROM jobs WHERE delivery_id=$1',[`upload:${id}`])).rows[0];
  expect(row).toMatchObject({installation_id:null,billing_installation_id:81,billing_user_id:null});
  await expect(sql.query('UPDATE jobs SET billing_installation_id=NULL WHERE id=$1',[row.id])).rejects.toThrow('immutable');
  await store.deleteInstallation(81);
  expect((await store.claimJob('heavy',2,'worker'))?.id).toBe(Number(row.id));
  await store.refundJobUnpack(Number(row.id),'wrong-worker');
  expect((await sql.query('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=81')).rows[0]).toEqual({heavy_jobs:1});
  await store.refundJobUnpack(Number(row.id),'worker');
  // Another successful reservation must not be accidentally refunded by failure cleanup.
  await sql.query('UPDATE hosted_usage_days SET heavy_jobs=1 WHERE installation_id=81');
  await store.failUploadedScan(id,true);await store.refundJobUnpack(Number(row.id),'worker');
  expect((await sql.query('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=81')).rows[0]).toEqual({heavy_jobs:1});
  await migrate(sql);
 }finally{await sql.close();}
});

it('groups personal jobs by payer, not actor, and recharges refunded retries against that payer',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'payer',login:'payer'});await store.upsertUser({id:'member',login:'member'});
  await ensureUserWorkspaces(sql,'payer');
  const workspace=(await listUserWorkspaces(sql,'payer'))[0];
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'member','member','explicit')",[workspace.id]);
  for(const actor of ['payer','member'])await store.queueUploadedScan({id:crypto.randomUUID(),userId:actor,installationId:null,workspaceId:workspace.id,target:'test.zip',bytes:new Uint8Array([1])});
  const first=await store.claimJob('heavy',4,'worker');expect(first).not.toBeNull();
  expect(await store.claimJob('heavy',4,'worker2')).toBeNull();
  expect((await sql.query('SELECT user_id,scans FROM personal_scan_usage')).rows).toEqual([{user_id:'payer',scans:2}]);
  await store.refundJobUnpack(first!.id,'worker');
  await sql.query("UPDATE jobs SET status='queued',locked_by=NULL,run_after=now() WHERE id=$1",[first!.id]);
  expect((await store.claimJob('heavy',4,'retry'))?.id).toBe(first!.id);
  expect((await sql.query('SELECT user_id,scans FROM personal_scan_usage')).rows).toEqual([{user_id:'payer',scans:2}]);
  await store.refundJobUnpack(first!.id,'retry');
  await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='payer'");
  await sql.query("UPDATE jobs SET status='queued',locked_by=NULL,run_after=now() WHERE id=$1",[first!.id]);
  expect(await store.claimJob('heavy',4,'expired')).toBeNull();
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows[0]).toEqual({scans:1});
 }finally{await sql.close();}
});

it('backfills existing queued jobs without changing usage or recharging already-refunded uploads',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'payer',login:'payer'});await ensureUserWorkspaces(sql,'payer');
  const workspace=(await listUserWorkspaces(sql,'payer'))[0];
  const id=crypto.randomUUID();
  await store.queueUploadedScan({id,userId:'payer',installationId:null,workspaceId:workspace.id,target:'test.zip',bytes:new Uint8Array([1])});
  await store.failUploadedScan(id,true);
  // Reconstruct the pre-087 shape in this isolated in-memory database only.
  await sql.exec(`DROP TRIGGER job_billing_owner ON jobs;
    ALTER TABLE jobs DROP COLUMN billing_installation_id;
    ALTER TABLE jobs DROP COLUMN billing_user_id;
    DELETE FROM schema_migrations WHERE id='087_job_billing_owner';
    UPDATE jobs SET usage_reserved=true;`);
  await migrate(sql);await migrate(sql);
  expect((await sql.query('SELECT billing_installation_id,billing_user_id,usage_reserved FROM jobs')).rows[0]).toEqual({billing_installation_id:null,billing_user_id:'payer',usage_reserved:false});
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows[0]).toEqual({scans:0});
 }finally{await sql.close();}
});
