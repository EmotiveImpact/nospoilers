export const independentTokenSchema=`
ALTER TABLE scan_api_tokens ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE scan_api_tokens ADD CONSTRAINT scan_token_owner_required CHECK(installation_id IS NOT NULL OR workspace_id IS NOT NULL);
CREATE OR REPLACE FUNCTION guard_scan_token_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.installation_id IS DISTINCT FROM NEW.installation_id THEN
   RAISE EXCEPTION 'Scan credential ownership is immutable';
  END IF;
 ELSIF NEW.installation_id IS NOT NULL THEN
  IF NEW.workspace_id IS NULL THEN
   SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations WHERE installation_id=NEW.installation_id AND workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Scan credential workspace does not match its connection';
  END IF;
 END IF;
 RETURN NEW;
END $$;
`;
