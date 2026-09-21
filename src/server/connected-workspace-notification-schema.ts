export const connectedWorkspaceNotificationSchema = `
CREATE OR REPLACE FUNCTION guard_notification_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.installation_id IS DISTINCT FROM NEW.installation_id THEN
   RAISE EXCEPTION 'Notification ownership is immutable';
  END IF;
 ELSIF NEW.installation_id IS NOT NULL THEN
  IF NEW.workspace_id IS NULL THEN
   SELECT workspace_id INTO NEW.workspace_id FROM product_workspace_installations WHERE installation_id=NEW.installation_id;
  ELSIF NOT EXISTS(SELECT 1 FROM product_workspace_installations WHERE installation_id=NEW.installation_id AND workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Notification workspace does not match its connection';
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('notification_routes','notification_deliveries') THEN
  IF NEW.destination_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM notification_destinations d WHERE d.id=NEW.destination_id AND d.installation_id IS NOT DISTINCT FROM NEW.installation_id AND d.workspace_id IS NOT DISTINCT FROM NEW.workspace_id) THEN
   RAISE EXCEPTION 'Notification destination ownership mismatch';
  END IF;
 END IF;
 IF TG_TABLE_NAME='notification_deliveries' THEN
  IF NEW.alert_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM alerts a LEFT JOIN notification_destinations d ON d.id=NEW.destination_id
   WHERE a.id=NEW.alert_id AND a.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
    AND (
     a.installation_id IS NOT DISTINCT FROM NEW.installation_id
     OR (
      NEW.installation_id IS NULL AND NEW.destination_id IS NOT NULL
      AND d.installation_id IS NULL AND d.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
     )
    )
  ) THEN
   RAISE EXCEPTION 'Notification alert ownership mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION guard_workspace_notification_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.destination_id IS DISTINCT FROM OLD.destination_id OR NEW.configuration_version IS DISTINCT FROM OLD.configuration_version OR NEW.alert_id IS DISTINCT FROM OLD.alert_id OR NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.request_key IS DISTINCT FROM OLD.request_key) THEN
  RAISE EXCEPTION 'Notification job identity is immutable';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM notification_destinations WHERE id=NEW.destination_id AND workspace_id=NEW.workspace_id AND installation_id IS NULL AND configuration_version=NEW.configuration_version) THEN
   RAISE EXCEPTION 'Notification job destination mismatch';
  END IF;
  IF NEW.alert_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM alerts WHERE id=NEW.alert_id AND workspace_id=NEW.workspace_id) THEN
   RAISE EXCEPTION 'Notification job alert mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION enqueue_workspace_alert_notification_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.workspace_id IS NOT NULL THEN
  INSERT INTO workspace_notification_jobs(id,workspace_id,destination_id,configuration_version,alert_id,purpose,request_key)
   SELECT gen_random_uuid(),d.workspace_id,d.id,d.configuration_version,NEW.id,'alert',gen_random_uuid()
   FROM notification_destinations d
   JOIN product_workspaces w ON w.id=d.workspace_id AND w.archived_at IS NULL
   WHERE d.workspace_id=NEW.workspace_id AND d.installation_id IS NULL AND d.kind IN ('slack','email')
   ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enqueue_workspace_alert_notification_jobs
 AFTER INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION enqueue_workspace_alert_notification_jobs();
`;
