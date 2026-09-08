export const workspaceOriginSchema=`
ALTER TABLE watched_origins ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
UPDATE watched_origins source SET workspace_id=c.workspace_id FROM product_workspace_installations c
WHERE c.installation_id=source.installation_id AND source.workspace_id IS NULL;
ALTER TABLE watched_origins ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE watched_origins ADD CONSTRAINT watched_origin_owner_required CHECK(workspace_id IS NOT NULL OR installation_id IS NOT NULL);
-- Preserve distinct legacy connection histories even when they monitored the
-- same URL. New independent sources have workspace-level uniqueness.
CREATE UNIQUE INDEX watched_origin_workspace_url ON watched_origins(workspace_id,origin_url) WHERE workspace_id IS NOT NULL AND installation_id IS NULL;
CREATE OR REPLACE FUNCTION preserve_origin_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.installation_id IS DISTINCT FROM NEW.installation_id OR (OLD.workspace_id IS NOT NULL AND OLD.workspace_id IS DISTINCT FROM NEW.workspace_id)) THEN
  RAISE EXCEPTION 'Website source ownership is immutable';
 END IF;
 IF NEW.installation_id IS NOT NULL THEN
  IF NEW.workspace_id IS NULL THEN
   SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=NEW.installation_id AND c.workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Website source workspace does not match its connection';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER watched_origin_workspace_owner BEFORE INSERT OR UPDATE ON watched_origins FOR EACH ROW EXECUTE FUNCTION preserve_origin_workspace();
`;
