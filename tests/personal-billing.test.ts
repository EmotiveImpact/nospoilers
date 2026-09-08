import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace,ensureUserWorkspaces} from '../src/server/workspaces.ts';
import {personalBillingSchema,managedPersonalBillingAccount,personalStripeState,applyPersonalStripePatch} from '../src/server/personal-billing.ts';
import {stripeEventPatch} from '../src/server/stripe.ts';

it('binds personal billing without installations, preserves trial/usage and applies shared entitlements',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);await sql.exec(personalBillingSchema);const store=createStore(sql);
  await store.upsertUser({id:'personal',login:'personal'});await store.upsertUser({id:'other',login:'other'});
  await ensureUserWorkspaces(sql,'personal');
  const original=(await listUserWorkspaces(sql,'personal'))[0];
  await managedPersonalBillingAccount(sql,'personal',original.organization_id);
  const before=await personalStripeState(sql,original.organization_id);
  await expect(managedPersonalBillingAccount(sql,'other',original.organization_id)).rejects.toMatchObject({status:403});
  await sql.query("INSERT INTO personal_scan_usage(user_id,day,scans) VALUES('personal',current_date,3)");
  const patch={organizationId:original.organization_id,installationId:null,customerId:'cus_personal',subscriptionId:'sub_personal',status:'active',priceId:'price_team',periodEnd:null,plan:'team' as const,clearPlan:false};
  expect(await applyPersonalStripePatch(sql,patch)).toMatchObject({applied:true});
  await createWorkspace(sql,'personal',original.organization_id,'Second');
  expect((await listUserWorkspaces(sql,'personal')).every(w=>w.plan==='team')).toBe(true);
  expect((await personalStripeState(sql,original.organization_id))?.trialEndsAt).toBe(before?.trialEndsAt);
  expect((await sql.query("SELECT scans FROM personal_scan_usage WHERE user_id='personal'")).rows[0]).toEqual({scans:3});
  expect((await sql.query('SELECT count(*) AS count FROM installations')).rows[0]).toEqual({count:0});
  expect(await applyPersonalStripePatch(sql,{...patch,customerId:'cus_foreign'})).toMatchObject({applied:false});
  expect(await applyPersonalStripePatch(sql,{...patch,organizationId:undefined,clearPlan:true,plan:null,status:'canceled'})).toMatchObject({applied:true});
  expect((await personalStripeState(sql,original.organization_id))?.plan).toBeNull();
  await expect(sql.query("UPDATE personal_organization_billing SET user_id='other'")).rejects.toThrow('immutable');
 }finally{await sql.close();}
});

it('carries organisation metadata independently of installation metadata',()=>{
 const id='71a701c7-7d7a-9705-3426-4710762104d1';
 expect(stripeEventPatch({id:'evt',type:'customer.subscription.updated',data:{object:{id:'sub',customer:'cus',status:'active',metadata:{organizationId:id},items:{data:[{price:{id:'team'}}]}}}},{soloMonthly:'solo',soloYearly:'soloy',teamMonthly:'team',teamYearly:'teamy'})).toMatchObject({organizationId:id,installationId:null,plan:'team'});
});
