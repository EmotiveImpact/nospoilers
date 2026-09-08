export const workspaceTokenSchema=`
ALTER TABLE scan_api_tokens ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
UPDATE scan_api_tokens t SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=t.installation_id;
CREATE INDEX workspace_scan_tokens ON scan_api_tokens(workspace_id) WHERE revoked_at IS NULL;
CREATE FUNCTION guard_scan_token_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.installation_id IS DISTINCT FROM NEW.installation_id THEN
   RAISE EXCEPTION 'Scan credential ownership is immutable';
  END IF;
 ELSE
  IF NEW.workspace_id IS NULL THEN
   SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations WHERE installation_id=NEW.installation_id AND workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Scan credential workspace does not match its connection';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER scan_token_workspace_guard BEFORE INSERT OR UPDATE ON scan_api_tokens FOR EACH ROW EXECUTE FUNCTION guard_scan_token_workspace();
`;
