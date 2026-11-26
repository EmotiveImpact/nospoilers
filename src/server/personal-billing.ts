import type {SqlClient} from './sql.ts';

/** Migration 085 (historical Stripe ordering columns; dormant since billing moved to Polar). */
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
