import type { SqlClient } from './sql.ts';
import { claimWorkspaceNotification } from './workspace-notification-outbox.ts';
import { sendWorkspaceNotification } from './workspace-notification-transport.ts';
import { emailPlanDeniedFromBilling } from './email.ts';
import { slackPlanDeniedFromBilling } from './slack.ts';

type Options = Omit<Parameters<typeof sendWorkspaceNotification>[1], 'purpose'>;

export async function runWorkspaceNotification(sql: SqlClient, options: Options): Promise<boolean> {
 const job = await claimWorkspaceNotification(sql);
 if (!job) return false;
 await sql.transaction(async tx => {
  // Match management's workspace -> destination order. The transport has an
  // eight-second deadline; these locks serialize disconnect/archive with send.
  const workspace = (await tx.query<{archived_at:string|null;plan:string|null;trial_ends_at:string|null}>(`
   SELECT w.archived_at, CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.plan ELSE u.plan END AS plan,
    CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.trial_ends_at ELSE u.trial_ends_at END AS trial_ends_at
   FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
   LEFT JOIN billing_accounts b ON b.installation_id=o.legacy_installation_id
   LEFT JOIN users u ON u.id=o.legacy_personal_user_id WHERE w.id=$1 FOR SHARE OF w`, [job.workspace_id])).rows[0];
  const destination = (await tx.query<{kind:string;webhook_ciphertext:string;configuration_version:string}>(`
   SELECT kind,webhook_ciphertext,configuration_version FROM notification_destinations
   WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL FOR UPDATE`, [job.destination_id,job.workspace_id])).rows[0];
  const owned = (await tx.query(`SELECT id FROM workspace_notification_jobs
   WHERE id=$1 AND status='running' AND lease_id=$2 AND leased_until>now() FOR UPDATE`, [job.id,job.lease_id])).rows.length;
  if (!owned) return;
  const denied = !workspace || workspace.archived_at || !destination || destination.configuration_version !== job.configuration_version ||
   (destination.kind === 'slack' ? slackPlanDeniedFromBilling(workspace.trial_ends_at,workspace.plan) : emailPlanDeniedFromBilling(workspace.trial_ends_at,workspace.plan));
  if (denied) {
   await tx.query("UPDATE workspace_notification_jobs SET status='cancelled',lease_id=NULL,leased_until=NULL WHERE id=$1",[job.id]);
   return;
  }
  const result = await sendWorkspaceNotification(destination, {...options,purpose:job.purpose});
  await tx.query(`INSERT INTO notification_deliveries(workspace_id,destination_id,alert_id,kind,status,error)
   VALUES($1,$2,$3,$4,$5,$6)`,[job.workspace_id,job.destination_id,job.alert_id,destination.kind,result.ok?'sent':'failed',result.ok?null:result.code]);
  await tx.query(`UPDATE notification_destinations SET last_delivery_at=now(),last_delivery_status=$2,last_delivery_error=$3 WHERE id=$1`,[job.destination_id,result.ok?'sent':'failed',result.ok?null:result.code]);
  const status=result.ok?'sent':result.retryable&&job.attempts<5?'queued':'failed';
  await tx.query(`UPDATE workspace_notification_jobs SET status=$2,lease_id=NULL,leased_until=NULL,
   available_at=now()+($3::integer*interval '1 second') WHERE id=$1`,[job.id,status,Math.min(3600,30*2**Math.min(job.attempts,7))]);
 });
 return true;
}
