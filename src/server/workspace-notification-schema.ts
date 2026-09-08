export const workspaceNotificationSchema=`
ALTER TABLE notification_destinations ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
ALTER TABLE notification_routes ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
ALTER TABLE notification_deliveries ADD COLUMN workspace_id UUID REFERENCES product_workspaces(id) ON DELETE RESTRICT;
UPDATE notification_destinations d SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=d.installation_id;
UPDATE notification_routes d SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=d.installation_id;
ALTER TABLE notification_deliveries DISABLE TRIGGER notification_deliveries_no_update;
UPDATE notification_deliveries d SET workspace_id=c.workspace_id FROM product_workspace_installations c WHERE c.installation_id=d.installation_id;
ALTER TABLE notification_deliveries ENABLE TRIGGER notification_deliveries_no_update;
CREATE INDEX workspace_notification_destinations ON notification_destinations(workspace_id);
CREATE INDEX workspace_notification_deliveries ON notification_deliveries(workspace_id,id DESC);
CREATE FUNCTION guard_notification_workspace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.installation_id IS DISTINCT FROM NEW.installation_id THEN
   RAISE EXCEPTION 'Notification ownership is immutable';
  END IF;
 ELSE
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
  IF NEW.alert_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM alerts a WHERE a.id=NEW.alert_id AND a.installation_id IS NOT DISTINCT FROM NEW.installation_id AND a.workspace_id IS NOT DISTINCT FROM NEW.workspace_id) THEN
   RAISE EXCEPTION 'Notification alert ownership mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_destination_workspace BEFORE INSERT OR UPDATE ON notification_destinations FOR EACH ROW EXECUTE FUNCTION guard_notification_workspace();
CREATE TRIGGER notification_route_workspace BEFORE INSERT OR UPDATE ON notification_routes FOR EACH ROW EXECUTE FUNCTION guard_notification_workspace();
CREATE TRIGGER notification_delivery_workspace BEFORE INSERT OR UPDATE ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION guard_notification_workspace();
`;
