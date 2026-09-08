import type {SqlClient} from './sql.ts';
import type {StripeBillingPatch} from './stripe.ts';

export const personalStripeEventOrderSchema=`
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS stripe_event_created BIGINT;
ALTER TABLE personal_organization_billing ADD COLUMN IF NOT EXISTS retired_subscription_ids JSONB NOT NULL DEFAULT '[]';
`;

/** Personal organisations retain their existing user allowance and trial; no synthetic installation. */
export const personalBillingSchema = `
CREATE TABLE IF NOT EXISTS personal_organization_billing (
  organization_id UUID PRIMARY KEY REFERENCES product_organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_status TEXT,
  stripe_price_id TEXT,
  stripe_current_period_end TIMESTAMPTZ
);
CREATE OR REPLACE FUNCTION bind_personal_billing_owner() RETURNS trigger AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Billing ownership is immutable';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM product_organizations o WHERE o.id=NEW.organization_id AND o.legacy_personal_user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'Personal billing requires its existing organisation owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS personal_billing_owner ON personal_organization_billing;
CREATE TRIGGER personal_billing_owner BEFORE INSERT OR UPDATE ON personal_organization_billing FOR EACH ROW EXECUTE FUNCTION bind_personal_billing_owner();
INSERT INTO personal_organization_billing(organization_id,user_id)
  SELECT id,legacy_personal_user_id FROM product_organizations WHERE legacy_personal_user_id IS NOT NULL ON CONFLICT DO NOTHING;
`;

export async function managedPersonalBillingAccount(sql:SqlClient,userId:string,organizationId:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(organizationId))throw Object.assign(new Error('Organisation unavailable.'),{status:404});
  const {rows}=await sql.query<{user_id:string}>(`SELECT o.legacy_personal_user_id AS user_id FROM product_organizations o
    JOIN product_organization_members m ON m.organization_id=o.id AND m.user_id=$1 AND m.role IN ('owner','admin')
    WHERE o.id=$2 AND o.legacy_personal_user_id IS NOT NULL`,[userId,organizationId]);
  if(!rows[0])throw Object.assign(new Error('Organisation administrator access is required to manage billing.'),{status:403});
  await sql.query('INSERT INTO personal_organization_billing(organization_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[organizationId,rows[0].user_id]);
  return {organizationId,userId:rows[0].user_id};
}

export async function personalStripeState(sql:SqlClient,organizationId:string){
  const {rows}=await sql.query<{trialEndsAt:string|null;plan:string|null;stripeCustomerId:string|null;stripeSubscriptionId:string|null;stripeStatus:string|null;periodEnd:string|null}>(`SELECT u.trial_ends_at::text AS "trialEndsAt",u.plan,b.stripe_customer_id AS "stripeCustomerId",
    b.stripe_subscription_id AS "stripeSubscriptionId",b.stripe_status AS "stripeStatus",b.stripe_current_period_end::text AS "periodEnd"
    FROM personal_organization_billing b JOIN users u ON u.id=b.user_id WHERE b.organization_id=$1`,[organizationId]);
  return rows[0]??null;
}

/** Called only after webhook signature verification. Conflicting customer/organisation claims fail closed. */
export async function applyPersonalStripePatch(sql:SqlClient,input:StripeBillingPatch){
  return sql.transaction(async tx=>{
    if(input.installationId!==null)return {applied:false,organizationId:null};
    const legacy=await tx.query(`SELECT installation_id FROM billing_accounts WHERE
      ($1::text IS NOT NULL AND stripe_customer_id=$1) OR ($2::text IS NOT NULL AND stripe_subscription_id=$2)`,[input.customerId,input.subscriptionId]);
    if(legacy.rows.length)return {applied:false,organizationId:null};
    const {rows}=await tx.query<{organization_id:string;user_id:string;stripe_customer_id:string|null;stripe_subscription_id:string|null;stripe_status:string|null;stripe_event_created:number|string|null;retired_subscription_ids:string[]}>(`SELECT * FROM personal_organization_billing
      WHERE ($1::uuid IS NOT NULL AND organization_id=$1) OR ($2::text IS NOT NULL AND stripe_customer_id=$2)
        OR ($3::text IS NOT NULL AND stripe_subscription_id=$3) FOR UPDATE`,[input.organizationId??null,input.customerId,input.subscriptionId]);
    if(rows.length!==1)return {applied:false,organizationId:null};
    const row=rows[0];
    if(input.organizationId&&input.organizationId!==row.organization_id || input.customerId&&row.stripe_customer_id&&input.customerId!==row.stripe_customer_id)return {applied:false,organizationId:null};
    const eventTime=input.eventCreated;
    if(row.stripe_event_created!==null&&(!eventTime||eventTime<=Number(row.stripe_event_created)))return {applied:false,organizationId:null};
    if(input.subscriptionId&&row.retired_subscription_ids.includes(input.subscriptionId))return {applied:false,organizationId:null};
    const terminal=row.stripe_status==='canceled'||row.stripe_status==='incomplete_expired';
    const replacement=!!input.subscriptionId&&!!row.stripe_subscription_id&&input.subscriptionId!==row.stripe_subscription_id;
    if(replacement&&!(terminal&&input.organizationId===row.organization_id&&input.customerId&&input.customerId===row.stripe_customer_id&&eventTime&&row.stripe_event_created!==null&&
      ['customer.subscription.created','customer.subscription.updated'].includes(input.eventType??'')&&['active','trialing'].includes(input.status??'')&&input.plan&&!input.clearPlan))return {applied:false,organizationId:null};
    // A canceled subscription cannot be resurrected by a delayed invoice or checkout event.
    if(terminal&&!replacement&&input.status!==row.stripe_status)return {applied:false,organizationId:null};
    if(row.stripe_subscription_id&&!input.subscriptionId)return {applied:false,organizationId:null};
    await tx.query(`UPDATE personal_organization_billing SET stripe_customer_id=COALESCE($2,stripe_customer_id),stripe_subscription_id=COALESCE($3,stripe_subscription_id),
      stripe_status=COALESCE($4,stripe_status),stripe_price_id=COALESCE($5,stripe_price_id),stripe_current_period_end=COALESCE($6::timestamptz,stripe_current_period_end),
      stripe_event_created=COALESCE($7,stripe_event_created),retired_subscription_ids=CASE WHEN $8 THEN retired_subscription_ids||jsonb_build_array(stripe_subscription_id) ELSE retired_subscription_ids END
      WHERE organization_id=$1`,[row.organization_id,input.customerId,input.subscriptionId,input.status,input.priceId,input.periodEnd,eventTime??null,replacement]);
    // Same row used by all existing personal-workspace scans; workspace creation cannot reset usage or trial.
    await tx.query(`UPDATE users SET plan=CASE WHEN $2 THEN NULL ELSE COALESCE($3,plan) END,
      trial_ends_at=CASE WHEN $2 THEN LEAST(trial_ends_at,now()) ELSE trial_ends_at END WHERE id=$1`,[row.user_id,input.clearPlan,input.plan]);
    return {applied:true,organizationId:row.organization_id};
  });
}
