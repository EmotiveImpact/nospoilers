/** Organisation-level allowance: never a new trial or scan-usage bucket. */
export const workspaceManagementSchema = `
ALTER TABLE product_organizations ADD COLUMN IF NOT EXISTS workspace_limit INTEGER NOT NULL DEFAULT 2
  CHECK(workspace_limit BETWEEN 1 AND 10000);
UPDATE product_organizations o SET workspace_limit=5
  WHERE EXISTS(SELECT 1 FROM billing_accounts b WHERE b.installation_id=o.legacy_installation_id AND b.plan='team')
     OR EXISTS(SELECT 1 FROM users u WHERE u.id=o.legacy_personal_user_id AND u.plan='team');
CREATE TABLE IF NOT EXISTS product_workspace_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created','renamed','archived','restored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
