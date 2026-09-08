export const independentNotificationSchema=`
ALTER TABLE notification_destinations ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE notification_routes ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE notification_deliveries ALTER COLUMN installation_id DROP NOT NULL;
ALTER TABLE notification_destinations ADD CONSTRAINT notification_destination_owner CHECK(installation_id IS NOT NULL OR workspace_id IS NOT NULL);
ALTER TABLE notification_routes ADD CONSTRAINT notification_route_owner CHECK(installation_id IS NOT NULL OR workspace_id IS NOT NULL);
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_delivery_owner CHECK(installation_id IS NOT NULL OR workspace_id IS NOT NULL);
CREATE UNIQUE INDEX independent_notification_kind ON notification_destinations(workspace_id,kind) WHERE installation_id IS NULL;
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
  IF NEW.alert_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM alerts a WHERE a.id=NEW.alert_id AND a.installation_id IS NOT DISTINCT FROM NEW.installation_id AND a.workspace_id IS NOT DISTINCT FROM NEW.workspace_id) THEN
   RAISE EXCEPTION 'Notification alert ownership mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;
`;
