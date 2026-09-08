import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {sourceBillingTarget,managedBillingAccount} from '../src/server/organization-access.ts';

it('inherits organisation entitlement and usage while retaining source and original job payer',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  for(const id of [1,2]){await store.upsertInstallation({id,accountId:id,accountLogin:`org${id}`,accountType:'Organization'});await store.linkUserInstallation(id,'owner');}
  const workspaces=await listUserWorkspaces(sql,'owner');const first=workspaces.find(w=>Number(w.installation_id)===1)!;const second=workspaces.find(w=>Number(w.installation_id)===2)!;
  // Isolated fixture for the forthcoming binding coordinator, not an exposed reassignment API.
  await sql.query('UPDATE product_workspace_installations SET workspace_id=$1 WHERE installation_id=2',[first.id]);
  const target=await sourceBillingTarget(sql,{installationId:2});
  expect(await managedBillingAccount(sql,'owner',target)).toMatchObject({installationId:1});
  await expect(sourceBillingTarget(sql,{installationId:2,organizationId:second.organization_id})).rejects.toMatchObject({status:403});
  await expect(managedBillingAccount(sql,'stranger',target)).rejects.toMatchObject({status:403});
  // A second source needs no second subscription or trial record.
  await sql.query("INSERT INTO installations(id,account_id,account_login,account_type) VALUES(99,99,'additional','Organization')");
  await sql.query('INSERT INTO product_workspace_installations(installation_id,workspace_id) VALUES(99,$1)',[first.id]);
  await store.upsertInstallation({id:99,accountId:99,accountLogin:'renamed-additional',accountType:'Organization'});
  expect((await sql.query('SELECT 1 FROM product_organizations WHERE legacy_installation_id=99')).rows).toHaveLength(0);
  const additional=await store.enqueueJob({installationId:99,priority:'light',kind:'test',payload:{installationId:99}});
  expect(additional.inserted).toBe(true);
  expect((await sql.query('SELECT installation_id,billing_installation_id FROM jobs WHERE id=$1',[additional.id])).rows[0]).toEqual({installation_id:99,billing_installation_id:1});
  expect((await sql.query('SELECT 1 FROM billing_accounts WHERE installation_id=99')).rows).toHaveLength(0);
  await expect(sql.query("INSERT INTO jobs(installation_id,billing_installation_id,priority,kind,payload) VALUES(999,1,'light','test','{}')")).rejects.toThrow(/jobs_source_fkey/);
  await sql.query("UPDATE billing_accounts SET plan='solo',retention_days=180 WHERE installation_id=1");
  expect(await store.installationBilling(2)).toMatchObject({plan:'solo',retentionDays:180});
  await store.setRetentionDays(2,365);
  expect((await store.installationBilling(1))?.retentionDays).toBe(365);
  expect((await store.listInstallationsForUser('owner')).find(i=>i.id===2)?.plan).toBe('solo');
  const queued=await store.enqueueJob({installationId:2,priority:'heavy',kind:'test',deliveryId:'source-two',payload:{installationId:2}});
  expect(queued.inserted).toBe(true);
  expect((await sql.query('SELECT installation_id,billing_installation_id FROM jobs WHERE id=$1',[queued.id])).rows[0]).toEqual({installation_id:2,billing_installation_id:1});
  expect((await sql.query('SELECT installation_id,heavy_jobs FROM hosted_usage_days')).rows).toEqual([{installation_id:1,heavy_jobs:1}]);
  expect(await store.consumeHostedUnpack(2)).toBe(true);await store.refundHostedUnpack(2);
  await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=1");
  expect(await store.installationWorkAllowed(2)).toBe(false);expect(await store.installationHasCoverage(2)).toBe(false);
  // Reassignment is not available in the product. Even such a DB change must not redirect an existing refund.
  await sql.query('UPDATE product_workspace_installations SET workspace_id=$1 WHERE installation_id=2',[second.id]);
  await store.refundJobUnpack(queued.id!);
  expect((await sql.query('SELECT installation_id,heavy_jobs FROM hosted_usage_days')).rows).toEqual([{installation_id:1,heavy_jobs:0}]);
 }finally{await sql.close();}
});

it('uses the personal payer and does not fall back to an installation trial',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:3,accountId:3,accountLogin:'repo-owner',accountType:'User'});await store.linkUserInstallation(3,'owner');
  const personal=(await listUserWorkspaces(sql,'owner')).find(w=>w.installation_id===null)!;
  await sql.query('UPDATE product_workspace_installations SET workspace_id=$1 WHERE installation_id=3',[personal.id]);
  expect(await sourceBillingTarget(sql,{installationId:3})).toEqual({organizationId:personal.organization_id});
  await sql.query("UPDATE users SET plan='solo' WHERE id='owner'");
  const job=await store.enqueueJob({installationId:3,priority:'heavy',kind:'test',payload:{installationId:3}});
  expect(job.inserted).toBe(true);
  expect((await sql.query('SELECT installation_id,billing_installation_id,billing_user_id FROM jobs')).rows[0]).toEqual({installation_id:3,billing_installation_id:null,billing_user_id:'owner'});
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows[0]).toEqual({scans:1});
  const second=await store.enqueueJob({installationId:3,priority:'heavy',kind:'test',payload:{installationId:3}});
  expect(second.inserted).toBe(true);
  expect(await store.claimJob('heavy',4,'first')).not.toBeNull();
  expect(await store.claimJob('heavy',4,'second')).toBeNull();
  await expect(store.setRetentionDays(3,365)).rejects.toMatchObject({status:409});
  await sql.query("UPDATE personal_scan_usage SET scans=8 WHERE user_id='owner'");
  expect((await store.hostedUsageStatus(3)).exhausted).toBe(true);
  expect(await store.consumeHostedUnpack(3)).toBe(false);
  await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='owner'");
  expect(await store.installationWorkAllowed(3)).toBe(false);
  expect((await store.installationBilling(3))?.plan).toBeNull();
 }finally{await sql.close();}
});
