export const connectedUploadExceptionSchema=`
ALTER TABLE workspace_exceptions ADD COLUMN installation_id BIGINT REFERENCES installations(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION guard_workspace_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exception history is retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'status'-'decided_by'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'decided_by'-'decided_at') THEN RAISE EXCEPTION 'Exception scope is immutable'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM uploaded_scans s WHERE s.id=NEW.attempt_id AND s.workspace_id=NEW.workspace_id AND s.installation_id IS NOT DISTINCT FROM NEW.installation_id AND s.status='done'
   AND s.source_origin_id IS NOT DISTINCT FROM NEW.source_origin_id AND (NEW.source_origin_id IS NOT NULL OR s.artifact_sha256=NEW.artifact_sha256)) THEN RAISE EXCEPTION 'Exception evidence scope mismatch'; END IF;
  IF NEW.installation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=NEW.installation_id AND c.workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Exception connection scope mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
`;
