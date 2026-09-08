/** Explicit product invitations never imply a GitHub account/installation grant. */
export const workspaceMembershipSchema = `
ALTER TABLE product_workspace_members ADD COLUMN IF NOT EXISTS access_source TEXT NOT NULL DEFAULT 'legacy'
  CHECK(access_source IN ('legacy','explicit'));
UPDATE product_workspace_members m SET access_source='explicit' FROM product_workspaces w
  WHERE w.id=m.workspace_id AND w.id<>md5('nospoilers:workspace:'||w.organization_id)::uuid;
CREATE TABLE IF NOT EXISTS product_workspace_revocations (
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS product_workspace_invites (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN ('admin','member','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days',
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS workspace_invites_recipient ON product_workspace_invites(recipient_user_id,created_at DESC);
ALTER TABLE product_workspace_events DROP CONSTRAINT IF EXISTS product_workspace_events_action_check;
ALTER TABLE product_workspace_events ADD CONSTRAINT product_workspace_events_action_check
  CHECK(action IN ('created','renamed','archived','restored','invited','invite_revoked','invite_accepted','role_changed','member_removed'));
ALTER TABLE product_workspace_events ADD COLUMN IF NOT EXISTS subject_user_id TEXT;
ALTER TABLE product_workspace_events ADD COLUMN IF NOT EXISTS detail JSONB NOT NULL DEFAULT '{}';
`;
