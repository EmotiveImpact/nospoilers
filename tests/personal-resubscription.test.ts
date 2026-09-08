import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {personalStripeEventOrderSchema,managedPersonalBillingAccount,applyPersonalStripePatch,personalStripeState} from '../src/server/personal-billing.ts';
import {parseStripeEvent,stripeEventPatch} from '../src/server/stripe.ts';

it('replaces only a terminal subscription with fresh same-customer provider metadata and rejects stale/retired events',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);await sql.exec(personalStripeEventOrderSchema);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');await managedPersonalBillingAccount(sql,'owner',workspace.organization_id);
  const patch={organizationId:workspace.organization_id,installationId:null,customerId:'cus',subscriptionId:'old',status:'active',priceId:'team',periodEnd:null,plan:'team' as const,clearPlan:false,eventCreated:100,eventType:'customer.subscription.created'};
  expect((await applyPersonalStripePatch(sql,patch)).applied).toBe(true);
  expect((await applyPersonalStripePatch(sql,{...patch,subscriptionId:'new',eventCreated:200})).applied).toBe(false);
  const cancel={...patch,status:'canceled',plan:null,clearPlan:true,eventCreated:110,eventType:'customer.subscription.deleted'};
  expect((await applyPersonalStripePatch(sql,cancel)).applied).toBe(true);
  const trial=(await personalStripeState(sql,workspace.organization_id))?.trialEndsAt;
  for(const bad of [{eventCreated:109},{eventCreated:110},{eventCreated:undefined},{customerId:'other'},{organizationId:undefined},{eventType:'invoice.paid'}]){
   expect((await applyPersonalStripePatch(sql,{...patch,subscriptionId:'new',eventCreated:120,...bad})).applied).toBe(false);
  }
  expect((await applyPersonalStripePatch(sql,{...patch,eventCreated:120,eventType:'invoice.paid'})).applied).toBe(false);
  expect((await applyPersonalStripePatch(sql,{...patch,subscriptionId:'new',eventCreated:120})).applied).toBe(true);
  expect((await applyPersonalStripePatch(sql,{...cancel,eventCreated:130})).applied).toBe(false);
  expect((await personalStripeState(sql,workspace.organization_id))).toMatchObject({stripeSubscriptionId:'new',plan:'team',trialEndsAt:trial});
  expect((await applyPersonalStripePatch(sql,{...cancel,subscriptionId:'new',eventCreated:140})).applied).toBe(true);
  expect((await applyPersonalStripePatch(sql,{...patch,eventCreated:150})).applied).toBe(false);
 }finally{await sql.close();}
});
it('carries provider event ordering only from validated numeric event creation time',()=>{
 const event=parseStripeEvent({id:'evt',type:'customer.subscription.deleted',created:123,data:{object:{id:'sub'}}})!;
 expect(stripeEventPatch(event,{soloMonthly:'solo',soloYearly:'solo-y',teamMonthly:'team',teamYearly:'team-y'})).toMatchObject({eventCreated:123,eventType:'customer.subscription.deleted'});
 expect(parseStripeEvent({id:'evt',type:'x',created:'123'})).not.toHaveProperty('created');
});
