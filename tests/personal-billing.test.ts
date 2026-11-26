import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace,ensureUserWorkspaces} from '../src/server/workspaces.ts';
import {personalBillingSchema,managedPersonalBillingAccount} from '../src/server/personal-billing.ts';
import {applyPolarPatch,polarBillingState} from '../src/server/polar-billing.ts';
import {parsePolarEvent,polarSubscriptionPatch,type PolarBillingPatch} from '../src/server/polar.ts';

it('binds personal billing without installations, preserves trial/usage and applies shared entitlements',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);await sql.exec(personalBillingSchema);const store=createStore(sql);
  await store.upsertUser({id:'personal',login:'personal'});await store.upsertUser({id:'other',login:'other'});
  await ensureUserWorkspaces(sql,'personal');
  const original=(await listUserWorkspaces(sql,'personal'))[0];
  const account={organizationId:original.organization_id,installationId:null};
  await managedPersonalBillingAccount(sql,'personal',original.organization_id);
  const before=await polarBillingState(sql,account);
  await expect(managedPersonalBillingAccount(sql,'other',original.organization_id)).rejects.toMatchObject({status:403});
  await sql.query("INSERT INTO personal_scan_usage(user_id,day,scans) VALUES('personal',current_date,3)");
  const patch:PolarBillingPatch={eventType:'subscription.active',organizationId:original.organization_id,installationId:null,customerId:'cus_personal',subscriptionId:'sub_personal',status:'active',productId:'team',periodEnd:null,modifiedAt:'2026-11-26T10:00:00.000000Z',plan:'team',clearPlan:false};
  expect(await applyPolarPatch(sql,patch)).toMatchObject({applied:true});
  await createWorkspace(sql,'personal',original.organization_id,'Second');
  expect((await listUserWorkspaces(sql,'personal')).every(w=>w.plan==='team')).toBe(true);
  expect((await polarBillingState(sql,account))?.trialEndsAt).toBe(before?.trialEndsAt);
  expect((await sql.query("SELECT scans FROM personal_scan_usage WHERE user_id='personal'")).rows[0]).toEqual({scans:3});
  expect((await sql.query('SELECT count(*) AS count FROM installations')).rows[0]).toEqual({count:0});
  // Once bound, the subscription identifies the account without metadata.
  expect(await applyPolarPatch(sql,{...patch,organizationId:null,clearPlan:true,plan:null,status:'canceled',modifiedAt:'2026-11-26T11:00:00.000000Z'})).toMatchObject({applied:true});
  expect((await polarBillingState(sql,account))?.plan).toBeNull();
  await expect(sql.query("UPDATE personal_organization_billing SET user_id='other'")).rejects.toThrow('immutable');
 }finally{await sql.close();}
});

it('carries organisation metadata independently of installation metadata',()=>{
 const id='71a701c7-7d7a-4705-8426-4710762104d1';
 const event=parsePolarEvent({type:'subscription.updated',data:{id:'sub',customer_id:'cus',status:'active',product_id:'team',metadata:{organizationId:id}}},'msg')!;
 expect(polarSubscriptionPatch(event,{soloMonthly:'solo',soloYearly:'soloy',teamMonthly:'team',teamYearly:'teamy'})).toMatchObject({organizationId:id,installationId:null,plan:'team'});
});
