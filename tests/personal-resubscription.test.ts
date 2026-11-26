import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {managedPersonalBillingAccount} from '../src/server/personal-billing.ts';
import {applyPolarPatch,polarBillingState,polarPatchDecision} from '../src/server/polar-billing.ts';
import type {PolarBillingPatch} from '../src/server/polar.ts';

const at=(minute:number)=>`2026-11-26T10:${String(minute).padStart(2,'0')}:00.000000Z`;

it('replaces only an ended subscription from a checkout for the same organisation and rejects stale or retired events',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');await managedPersonalBillingAccount(sql,'owner',workspace.organization_id);
  const account={organizationId:workspace.organization_id,installationId:null};
  const patch:PolarBillingPatch={eventType:'subscription.created',organizationId:workspace.organization_id,installationId:null,customerId:'cus',subscriptionId:'old',status:'active',productId:'team',periodEnd:null,modifiedAt:at(0),plan:'team',clearPlan:false};
  expect((await applyPolarPatch(sql,patch)).applied).toBe(true);
  // A second live subscription cannot take over a covered account.
  expect((await applyPolarPatch(sql,{...patch,subscriptionId:'new',modifiedAt:at(20)})).applied).toBe(false);
  const cancel={...patch,eventType:'subscription.revoked',status:'canceled',plan:null,clearPlan:true,modifiedAt:at(10)};
  expect((await applyPolarPatch(sql,cancel)).applied).toBe(true);
  const trial=(await polarBillingState(sql,account))?.trialEndsAt;
  // Older or unordered versions of the ended subscription are ignored.
  for(const bad of [{modifiedAt:at(9)},{modifiedAt:null}])expect((await applyPolarPatch(sql,{...patch,...bad})).applied).toBe(false);
  // A replacement needs this organisation's checkout metadata and a covering plan.
  for(const bad of [{organizationId:null},{status:'incomplete',plan:null},{plan:null,clearPlan:true}]){
   expect((await applyPolarPatch(sql,{...patch,subscriptionId:'new',modifiedAt:at(12),...bad})).applied).toBe(false);
  }
  // A different payer may resubscribe the organisation once the old subscription has ended.
  expect((await applyPolarPatch(sql,{...patch,subscriptionId:'new',customerId:'cus_new_payer',modifiedAt:at(12)})).applied).toBe(true);
  expect((await applyPolarPatch(sql,{...cancel,modifiedAt:at(30)})).applied).toBe(false);
  expect(await polarBillingState(sql,account)).toMatchObject({polarSubscriptionId:'new',polarCustomerId:'cus_new_payer',plan:'team',trialEndsAt:trial});
  expect((await applyPolarPatch(sql,{...cancel,subscriptionId:'new',modifiedAt:at(40)})).applied).toBe(true);
  expect((await applyPolarPatch(sql,{...patch,modifiedAt:at(50)})).applied).toBe(false);
  expect((await sql.query('SELECT polar_retired_subscription_ids FROM personal_organization_billing WHERE organization_id=$1',[workspace.organization_id])).rows[0])
   .toEqual({polar_retired_subscription_ids:['old']});
 }finally{await sql.close();}
});

it('applies equal versions idempotently and treats past due, paused and incomplete as still alive',()=>{
 const patch:PolarBillingPatch={eventType:'subscription.updated',organizationId:null,installationId:null,customerId:'cus',subscriptionId:'sub',status:'active',productId:'p',periodEnd:null,modifiedAt:at(0),plan:'solo',clearPlan:false};
 expect(polarPatchDecision({subscriptionId:'sub',status:'active',retired:[],stale:false},patch)).toEqual({apply:true,replacement:false});
 expect(polarPatchDecision({subscriptionId:'sub',status:'active',retired:[],stale:true},patch).apply).toBe(false);
 for(const status of ['past_due','paused','incomplete','trialing'])expect(polarPatchDecision({subscriptionId:'other',status,retired:[],stale:false},patch).apply).toBe(false);
 for(const status of ['canceled','unpaid','incomplete_expired','trial_ended'])expect(polarPatchDecision({subscriptionId:'other',status,retired:[],stale:false},patch)).toEqual({apply:true,replacement:true});
 expect(polarPatchDecision({subscriptionId:null,status:null,retired:['sub'],stale:false},patch).apply).toBe(false);
});
