/** Additive ownership backfill. Never merge tenants by login, email or shared membership. */
export const workspaceSchema = `
CREATE TABLE IF NOT EXISTS product_organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  legacy_installation_id BIGINT UNIQUE,
  legacy_personal_user_id TEXT UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (legacy_installation_id IS NOT NULL AND legacy_personal_user_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS product_workspaces (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES product_organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE TABLE IF NOT EXISTS product_workspace_members (
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS product_workspace_installations (
  installation_id BIGINT PRIMARY KEY REFERENCES installations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_linked_identities (
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,provider_subject)
);
INSERT INTO product_organizations(id,name,legacy_installation_id)
  SELECT md5('nospoilers:installation:'||id)::uuid,account_login,id FROM installations ON CONFLICT DO NOTHING;
INSERT INTO product_organizations(id,name,legacy_personal_user_id)
  SELECT md5('nospoilers:personal:'||id)::uuid,login||' personal',id FROM users ON CONFLICT DO NOTHING;
INSERT INTO product_workspaces(id,organization_id,name)
  SELECT md5('nospoilers:workspace:'||id)::uuid,id,name FROM product_organizations ON CONFLICT DO NOTHING;
INSERT INTO product_workspace_members(workspace_id,user_id,role)
  SELECT w.id,m.user_id,m.role FROM installation_users m
  JOIN product_organizations o ON o.legacy_installation_id=m.installation_id
  JOIN product_workspaces w ON w.organization_id=o.id ON CONFLICT DO NOTHING;
INSERT INTO product_workspace_members(workspace_id,user_id,role)
  SELECT w.id,o.legacy_personal_user_id,'owner' FROM product_organizations o
  JOIN product_workspaces w ON w.organization_id=o.id
  WHERE o.legacy_personal_user_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO product_workspace_installations(installation_id,workspace_id)
  SELECT o.legacy_installation_id,w.id FROM product_organizations o
  JOIN product_workspaces w ON w.organization_id=o.id
  WHERE o.legacy_installation_id IS NOT NULL ON CONFLICT DO NOTHING;
`;
