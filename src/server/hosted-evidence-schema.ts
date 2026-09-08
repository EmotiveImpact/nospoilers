/** Private evidence complements, but never changes, the signed receipt. */
export const hostedEvidenceSchema=`
CREATE TABLE hosted_scan_evidence (
 receipt_id BIGINT PRIMARY KEY REFERENCES scan_receipts(id) ON DELETE RESTRICT,
 installation_id BIGINT NOT NULL REFERENCES installations(id) ON DELETE RESTRICT,
 workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT,
 report JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION guard_hosted_scan_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Hosted scan evidence is immutable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM scan_receipts r WHERE r.id=NEW.receipt_id AND r.installation_id=NEW.installation_id
   AND r.artifact_sha256=lower(COALESCE(NEW.report->>'artifactSha256','')) AND r.status=NEW.report->>'status') THEN
  RAISE EXCEPTION 'Hosted evidence does not match receipt';
 END IF;
 IF NEW.workspace_id IS NULL THEN
  SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
 ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations WHERE installation_id=NEW.installation_id AND workspace_id=NEW.workspace_id) THEN
  RAISE EXCEPTION 'Hosted evidence workspace mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hosted_evidence_identity BEFORE INSERT OR UPDATE OR DELETE ON hosted_scan_evidence FOR EACH ROW EXECUTE FUNCTION guard_hosted_scan_evidence();
CREATE TRIGGER hosted_evidence_no_truncate BEFORE TRUNCATE ON hosted_scan_evidence FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
`;
