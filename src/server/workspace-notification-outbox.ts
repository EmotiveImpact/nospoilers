import type { SqlClient } from './sql.ts';
import { randomUUID } from 'node:crypto';

export const workspaceNotificationOutboxSchema = `
ALTER TABLE notification_destinations ADD COLUMN configuration_version UUID NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE workspace_notification_jobs (
 id UUID PRIMARY KEY,
 workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
 destination_id BIGINT NOT NULL REFERENCES notification_destinations(id) ON DELETE CASCADE,
 configuration_version UUID NOT NULL,
 alert_id BIGINT REFERENCES alerts(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('alert','test')),
 request_key UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','sent','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lease_id UUID,
 leased_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK((purpose='alert' AND alert_id IS NOT NULL) OR (purpose='test' AND alert_id IS NULL)),
 UNIQUE(destination_id,request_key)
);
CREATE UNIQUE INDEX workspace_notification_alert_once ON workspace_notification_jobs(destination_id,alert_id) WHERE purpose='alert';
CREATE INDEX workspace_notification_jobs_ready ON workspace_notification_jobs(available_at) WHERE status IN ('queued','running');
CREATE FUNCTION guard_workspace_notification_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.destination_id IS DISTINCT FROM OLD.destination_id OR NEW.configuration_version IS DISTINCT FROM OLD.configuration_version OR NEW.alert_id IS DISTINCT FROM OLD.alert_id OR NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.request_key IS DISTINCT FROM OLD.request_key) THEN
  RAISE EXCEPTION 'Notification job identity is immutable';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM notification_destinations WHERE id=NEW.destination_id AND workspace_id=NEW.workspace_id AND installation_id IS NULL AND configuration_version=NEW.configuration_version) THEN
   RAISE EXCEPTION 'Notification job destination mismatch';
  END IF;
  IF NEW.alert_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM alerts WHERE id=NEW.alert_id AND workspace_id=NEW.workspace_id AND installation_id IS NULL) THEN
   RAISE EXCEPTION 'Notification job alert mismatch';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_notification_job_identity BEFORE INSERT OR UPDATE ON workspace_notification_jobs FOR EACH ROW EXECUTE FUNCTION guard_workspace_notification_job();
`;

// Call inside the alert publication transaction; no secrets or finding bodies
// are copied into jobs. Replacement destinations cannot inherit queued sends.
export async function enqueueWorkspaceAlertNotifications(sql: SqlClient, workspaceId: string, alertId: number) {
  await sql.query(`INSERT INTO workspace_notification_jobs(id,workspace_id,destination_id,configuration_version,alert_id,purpose,request_key)
    SELECT gen_random_uuid(),d.workspace_id,d.id,d.configuration_version,a.id,'alert',$3
    FROM notification_destinations d JOIN alerts a ON a.id=$2 AND a.workspace_id=d.workspace_id
    JOIN product_workspaces w ON w.id=d.workspace_id AND w.archived_at IS NULL
    WHERE d.workspace_id=$1 AND d.installation_id IS NULL AND d.kind IN ('slack','email')
    ON CONFLICT DO NOTHING`, [workspaceId, alertId, randomUUID()]);
}

export async function claimWorkspaceNotification(sql: SqlClient) {
  const leaseId = randomUUID();
  return (await sql.query<{id:string;workspace_id:string;destination_id:number;configuration_version:string;alert_id:number|null;purpose:'alert'|'test';attempts:number;lease_id:string}>(`
    WITH ready AS (
      SELECT id FROM workspace_notification_jobs WHERE
      (status='queued' AND available_at<=now()) OR (status='running' AND leased_until<now())
      ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE workspace_notification_jobs j SET status='running',attempts=attempts+1,lease_id=$1,leased_until=now()+interval '60 seconds'
      FROM ready WHERE j.id=ready.id RETURNING j.*`, [leaseId])).rows[0] ?? null;
}
