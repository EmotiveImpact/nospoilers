export const workspaceAlertSchema=`
ALTER TABLE alerts ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
ALTER TABLE alerts ADD COLUMN source_origin_id BIGINT REFERENCES watched_origins(id) ON DELETE RESTRICT;
ALTER TABLE alerts ADD COLUMN scan_attempt_id TEXT REFERENCES uploaded_scans(id) ON DELETE RESTRICT;
UPDATE alerts a SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=a.installation_id;
ALTER TABLE alerts ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE alerts ADD CONSTRAINT independent_alert_source CHECK(installation_id IS NOT NULL OR (workspace_id IS NOT NULL AND source_origin_id IS NOT NULL AND scan_attempt_id IS NOT NULL AND repo_id IS NULL));
CREATE UNIQUE INDEX website_alert_attempt ON alerts(scan_attempt_id) WHERE scan_attempt_id IS NOT NULL;
CREATE INDEX workspace_alert_feed ON alerts(workspace_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION guard_alert_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.installation_id IS DISTINCT FROM NEW.installation_id OR OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.source_origin_id IS DISTINCT FROM NEW.source_origin_id OR OLD.scan_attempt_id IS DISTINCT FROM NEW.scan_attempt_id) THEN
  RAISE EXCEPTION 'Alert ownership and evidence identity are immutable';
 END IF;
 IF TG_OP='INSERT' AND NEW.installation_id IS NOT NULL THEN
  IF NEW.workspace_id IS NULL THEN SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.installation_id=NEW.installation_id AND c.workspace_id=NEW.workspace_id) THEN RAISE EXCEPTION 'Alert workspace does not match its source'; END IF;
 END IF;
 IF NEW.scan_attempt_id IS NOT NULL OR NEW.source_origin_id IS NOT NULL THEN
  IF NEW.installation_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM uploaded_scans s JOIN watched_origins o ON o.id=s.source_origin_id
   WHERE s.id=NEW.scan_attempt_id AND s.source_origin_id=NEW.source_origin_id AND s.workspace_id=NEW.workspace_id AND o.workspace_id=NEW.workspace_id
    AND s.installation_id IS NULL AND o.installation_id IS NULL AND s.status='done' AND s.report_json IS NOT NULL)
  THEN RAISE EXCEPTION 'Website alert requires completed evidence from its own source and workspace'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER alerts_workspace_guard BEFORE INSERT OR UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION guard_alert_workspace();
ALTER TABLE alert_events ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
-- This migration owns an exclusive table lock; only the new ownership column
-- is backfilled. Reinstate append-only protection before the transaction commits.
ALTER TABLE alert_events DISABLE TRIGGER alert_events_no_update;
UPDATE alert_events e SET workspace_id=a.workspace_id FROM alerts a WHERE a.id=e.alert_id;
ALTER TABLE alert_events ENABLE TRIGGER alert_events_no_update;
ALTER TABLE alert_events ALTER COLUMN installation_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION guard_alert_event_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent alerts%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM alerts WHERE id=NEW.alert_id;
 IF NOT FOUND OR NEW.installation_id IS DISTINCT FROM parent.installation_id THEN RAISE EXCEPTION 'Alert event source mismatch'; END IF;
 IF NEW.workspace_id IS NULL THEN NEW.workspace_id=parent.workspace_id;
 ELSIF NEW.workspace_id IS DISTINCT FROM parent.workspace_id THEN RAISE EXCEPTION 'Alert event workspace mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER alert_event_workspace_guard BEFORE INSERT ON alert_events FOR EACH ROW EXECUTE FUNCTION guard_alert_event_workspace();
`;
