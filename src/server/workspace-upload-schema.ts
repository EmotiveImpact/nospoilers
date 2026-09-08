export const workspaceUploadSchema=`
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS billing_installation_id BIGINT;
ALTER TABLE uploaded_scans ADD COLUMN IF NOT EXISTS billing_user_id TEXT;
UPDATE uploaded_scans s SET workspace_id=w.id,
  billing_installation_id=o.legacy_installation_id,billing_user_id=o.legacy_personal_user_id
  FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
  WHERE s.workspace_id IS NULL AND w.id=md5('nospoilers:workspace:'||o.id)::uuid AND
  (s.installation_id=o.legacy_installation_id OR (s.installation_id IS NULL AND s.user_id=o.legacy_personal_user_id));
CREATE INDEX IF NOT EXISTS uploaded_scans_workspace_idx ON uploaded_scans(workspace_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION guard_upload_workspace() RETURNS trigger AS $$
BEGIN
  IF OLD.workspace_id IS NOT NULL AND (
    NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR
    NEW.billing_installation_id IS DISTINCT FROM OLD.billing_installation_id OR
    NEW.billing_user_id IS DISTINCT FROM OLD.billing_user_id
  ) THEN RAISE EXCEPTION 'Scan workspace ownership is immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS uploaded_workspace_immutable ON uploaded_scans;
CREATE TRIGGER uploaded_workspace_immutable BEFORE UPDATE ON uploaded_scans FOR EACH ROW EXECUTE FUNCTION guard_upload_workspace();
`;
