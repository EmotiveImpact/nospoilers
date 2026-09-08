export const workspacePolicySchema=`
CREATE TABLE IF NOT EXISTS product_workspace_scan_policies (
  workspace_id UUID PRIMARY KEY REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  strict BOOLEAN NOT NULL DEFAULT false,
  revision INTEGER NOT NULL CHECK(revision>0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_workspace_policy_events (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  strict BOOLEAN NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,revision)
);
DROP TRIGGER IF EXISTS workspace_policy_event_immutable ON product_workspace_policy_events;
CREATE TRIGGER workspace_policy_event_immutable BEFORE UPDATE OR DELETE ON product_workspace_policy_events
  FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation();
DROP TRIGGER IF EXISTS workspace_policy_event_no_truncate ON product_workspace_policy_events;
CREATE TRIGGER workspace_policy_event_no_truncate BEFORE TRUNCATE ON product_workspace_policy_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
`;
