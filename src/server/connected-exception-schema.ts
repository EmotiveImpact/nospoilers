/** Preserve the identity and original scope of existing connected allowlists. */
export const connectedExceptionSchema=`
ALTER TABLE policy_exceptions ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
UPDATE policy_exceptions e SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=e.installation_id;
CREATE INDEX connected_exception_workspace ON policy_exceptions(workspace_id,id);
CREATE FUNCTION guard_connected_exception_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at'-'revoked_by') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoked_by') THEN
   RAISE EXCEPTION 'Connected exception scope and evidence are immutable';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND (NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by) THEN
   RAISE EXCEPTION 'Connected exception revocation is immutable';
  END IF;
 ELSE
  IF NEW.workspace_id IS NULL THEN
   SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations WHERE installation_id=NEW.installation_id AND workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Connected exception workspace mismatch';
  END IF;
  IF NEW.package_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM watched_packages WHERE id=NEW.package_id AND installation_id=NEW.installation_id) THEN
   RAISE EXCEPTION 'Connected exception package mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER connected_exception_scope BEFORE INSERT OR UPDATE ON policy_exceptions FOR EACH ROW EXECUTE FUNCTION guard_connected_exception_scope();
`;
