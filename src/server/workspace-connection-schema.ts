/** Explicitly placed connections are governed by product membership, never login bootstrap. */
export const workspaceConnectionSchema = `
ALTER TABLE product_workspace_installations ADD COLUMN IF NOT EXISTS explicitly_assigned BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS product_connection_events (
  id UUID PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  source_workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  destination_workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS product_connection_event_immutable ON product_connection_events;
CREATE TRIGGER product_connection_event_immutable BEFORE UPDATE OR DELETE ON product_connection_events
  FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation();
DROP TRIGGER IF EXISTS product_connection_event_no_truncate ON product_connection_events;
CREATE TRIGGER product_connection_event_no_truncate BEFORE TRUNCATE ON product_connection_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
`;
