/** Legacy billing IDs remain stable aliases; their lifetime belongs to the organisation. */
export const billingDurabilitySchema=`
INSERT INTO product_organizations(id,name,legacy_installation_id)
  SELECT md5('nospoilers:installation:'||i.id)::uuid,i.account_login,i.id FROM installations i ON CONFLICT DO NOTHING;
ALTER TABLE billing_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES product_organizations(id) ON DELETE RESTRICT;
UPDATE billing_accounts b SET organization_id=o.id FROM product_organizations o
  WHERE o.legacy_installation_id=b.installation_id AND b.organization_id IS NULL;
ALTER TABLE billing_accounts ALTER COLUMN organization_id SET NOT NULL;
CREATE OR REPLACE FUNCTION bind_billing_organization() RETURNS trigger AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.installation_id IS DISTINCT FROM OLD.installation_id) THEN
    RAISE EXCEPTION 'Billing ownership is immutable';
  END IF;
  IF NEW.organization_id IS NULL THEN
    INSERT INTO product_organizations(id,name,legacy_installation_id)
      SELECT md5('nospoilers:installation:'||i.id)::uuid,i.account_login,i.id FROM installations i WHERE i.id=NEW.installation_id ON CONFLICT DO NOTHING;
    SELECT id INTO NEW.organization_id FROM product_organizations WHERE legacy_installation_id=NEW.installation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS billing_organization_binding ON billing_accounts;
CREATE TRIGGER billing_organization_binding BEFORE INSERT OR UPDATE ON billing_accounts FOR EACH ROW EXECUTE FUNCTION bind_billing_organization();
CREATE UNIQUE INDEX IF NOT EXISTS billing_accounts_organization_idx ON billing_accounts(organization_id);
ALTER TABLE billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_installation_id_fkey;
ALTER TABLE hosted_usage_days DROP CONSTRAINT IF EXISTS hosted_usage_days_installation_id_fkey;
ALTER TABLE hosted_usage_days DROP CONSTRAINT IF EXISTS hosted_usage_days_billing_fkey;
ALTER TABLE hosted_usage_days ADD CONSTRAINT hosted_usage_days_billing_fkey FOREIGN KEY(installation_id) REFERENCES billing_accounts(installation_id) ON DELETE RESTRICT;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_installation_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_billing_fkey;
ALTER TABLE jobs ADD CONSTRAINT jobs_billing_fkey FOREIGN KEY(installation_id) REFERENCES billing_accounts(installation_id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS product_billing_events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES product_organizations(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('checkout','portal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
