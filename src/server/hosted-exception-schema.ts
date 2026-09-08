export const hostedExceptionSchema=`
ALTER TABLE workspace_exceptions ALTER COLUMN attempt_id DROP NOT NULL;
ALTER TABLE workspace_exceptions ADD COLUMN receipt_id BIGINT REFERENCES hosted_scan_evidence(receipt_id) ON DELETE RESTRICT;
ALTER TABLE workspace_exceptions ADD CONSTRAINT exception_one_evidence CHECK((attempt_id IS NOT NULL)::int+(receipt_id IS NOT NULL)::int=1);
CREATE OR REPLACE FUNCTION guard_workspace_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exception history is retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'status'-'decided_by'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'decided_by'-'decided_at') THEN RAISE EXCEPTION 'Exception scope is immutable'; END IF;
 ELSE
  IF NEW.attempt_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM uploaded_scans s WHERE s.id=NEW.attempt_id AND s.workspace_id=NEW.workspace_id AND s.installation_id IS NOT DISTINCT FROM NEW.installation_id AND s.status='done'
    AND s.source_origin_id IS NOT DISTINCT FROM NEW.source_origin_id AND (NEW.source_origin_id IS NOT NULL OR s.artifact_sha256=NEW.artifact_sha256)) THEN RAISE EXCEPTION 'Exception evidence scope mismatch'; END IF;
  ELSE
   IF NEW.source_origin_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM hosted_scan_evidence e JOIN scan_receipts r ON r.id=e.receipt_id
    WHERE e.receipt_id=NEW.receipt_id AND e.workspace_id=NEW.workspace_id AND e.installation_id=NEW.installation_id AND r.artifact_sha256=NEW.artifact_sha256) THEN RAISE EXCEPTION 'Exception hosted evidence scope mismatch'; END IF;
  END IF;
  IF NEW.installation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=NEW.installation_id AND c.workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Exception connection scope mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
`;
