/** Billing administration is a product permission, never inferred from a later source grant. */
export const organizationOwnershipSchema = `
CREATE TABLE IF NOT EXISTS product_organization_members (
  organization_id UUID NOT NULL REFERENCES product_organizations(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN ('owner','admin')),
  PRIMARY KEY(organization_id,user_id)
);
INSERT INTO product_organization_members(organization_id,user_id,role)
  SELECT id,legacy_personal_user_id,'owner' FROM product_organizations WHERE legacy_personal_user_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO product_organization_members(organization_id,user_id,role)
  SELECT o.id,m.user_id,'owner' FROM product_organizations o
  JOIN product_workspaces w ON w.organization_id=o.id AND w.id=md5('nospoilers:workspace:'||o.id)::uuid
  JOIN product_workspace_members m ON m.workspace_id=w.id AND m.access_source='legacy'
  JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id AND legacy.role='admin'
  ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS product_organization_events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES product_organizations(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('role_changed','administrator_removed')),
  detail JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
