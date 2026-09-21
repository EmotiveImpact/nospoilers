import type {SqlClient} from './sql.ts';
import {workspaceEvidenceSettings} from './workspace-evidence-settings.ts';
import {listWorkspaceOrigins} from './workspace-origins.ts';
import {websiteHealth} from '../watch/website-health.ts';
import {workspaceCoverageSummary} from './workspace-coverage-summary.ts';
import {ACTIONABLE_ALERT_SQL} from './workspace-alerts.ts';

/** Counts are SQL aggregates over the authorised workspace, not the first history page. */
export async function workspaceOverview(sql:SqlClient,userId:string,workspaceId:string,intervalMs=NaN){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);
 const connectedCoverage=await workspaceCoverageSummary(sql,workspaceId,intervalMs);
 const passed="status='done' AND report_json->'ok'='true'::jsonb AND (report_json->>'status' IS NULL OR report_json->>'status'='passed')";
 const [counts,recent,websites,alerts,hosted,jobs,priorityAlerts]=await Promise.all([
  sql.query<{total:number|string;active:number|string;attention:number|string;completed_attention:number|string;attempt_attention:number|string;passed:number|string}>(`SELECT count(*) AS total,
   count(*) FILTER(WHERE status IN ('queued','running')) AS active,
   count(*) FILTER(WHERE status='failed' OR status='done' AND NOT COALESCE((${passed}),false)) AS attention,
   count(*) FILTER(WHERE status='done' AND NOT COALESCE((${passed}),false)) AS completed_attention,
   count(*) FILTER(WHERE status='failed') AS attempt_attention,
   count(*) FILTER(WHERE ${passed}) AS passed FROM uploaded_scans WHERE workspace_id=$1`,[workspaceId]),
  sql.query<{id:string;target:string;status:string;created_at:string;completed_at:string|null;source_kind:'website'|'artifact';verdict:string}>(`SELECT id,target,status,created_at,completed_at,
   CASE WHEN source_origin_id IS NOT NULL THEN 'website' ELSE 'artifact' END AS source_kind,
   CASE WHEN status='queued' THEN 'Queued' WHEN status='running' THEN 'Scanning' WHEN status='failed' THEN 'Scan failed'
    WHEN report_json IS NULL THEN 'Result unavailable' WHEN report_json->>'status'='inconclusive' THEN 'Inconclusive'
    WHEN report_json->>'status' IS NOT NULL AND report_json->>'status' NOT IN ('passed','failed-policy','inconclusive') THEN 'Result unavailable'
    WHEN ${passed} THEN CASE WHEN jsonb_typeof(report_json->'suppressed')='array' AND report_json->'suppressed'!='[]'::jsonb THEN 'Policy passed with exceptions' ELSE 'Policy passed' END ELSE 'Review findings' END AS verdict
   FROM uploaded_scans WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 5`,[workspaceId]),
  listWorkspaceOrigins(sql,userId,workspaceId),
  sql.query<{open:string;waiting:string;done:string;mine:string}>(`SELECT
   count(*) FILTER(WHERE ${ACTIONABLE_ALERT_SQL} AND resolved_at IS NULL AND acknowledged_at IS NULL) AS open,
   count(*) FILTER(WHERE ${ACTIONABLE_ALERT_SQL} AND resolved_at IS NULL AND acknowledged_at IS NOT NULL) AS waiting,
   count(*) FILTER(WHERE ${ACTIONABLE_ALERT_SQL} AND resolved_at IS NOT NULL) AS done,
   count(*) FILTER(WHERE ${ACTIONABLE_ALERT_SQL} AND resolved_at IS NULL AND assigned_to_user_id=$2) AS mine
   FROM alerts WHERE workspace_id=$1`,[workspaceId,userId]),
  sql.query<{installation_id:number;account_login:string;total:string;passed:string;attention:string}>(`SELECT rr.installation_id,i.account_login,count(*) AS total,
   count(*) FILTER(WHERE sr.status='passed' AND NOT rr.mismatch) AS passed,
   count(*) FILTER(WHERE sr.status<>'passed' OR rr.mismatch) AS attention
   FROM release_revisions rr JOIN product_workspace_installations c ON c.installation_id=rr.installation_id
   JOIN scan_receipts sr ON sr.id=rr.receipt_id
   JOIN installations i ON i.id=rr.installation_id
   WHERE c.workspace_id=$1 AND NOT EXISTS(SELECT 1 FROM uploaded_scans u WHERE u.workspace_id=$1 AND u.revision_id=rr.id)
   AND (row_within_retention(rr.installation_id,rr.created_at) OR EXISTS(
    SELECT 1 FROM release_legal_holds h WHERE h.revision_id=rr.id AND h.action='place'
    AND NOT EXISTS(SELECT 1 FROM release_legal_holds later WHERE later.revision_id=h.revision_id AND later.id>h.id)))
   GROUP BY rr.installation_id,i.account_login ORDER BY i.account_login,rr.installation_id`,[workspaceId]),
  sql.query<{installation_id:number;account_login:string;queued:string;running:string}>(`SELECT j.installation_id,i.account_login,
   count(*) FILTER(WHERE j.status='queued') AS queued,
   count(*) FILTER(WHERE j.status='running') AS running
   FROM jobs j JOIN product_workspace_installations c ON c.installation_id=j.installation_id
   JOIN installations i ON i.id=j.installation_id
   WHERE c.workspace_id=$1 AND j.status IN ('queued','running')
   AND j.kind IN ('scan_latest_release','release_scan','npm_scan','web_origin_scan','map_custody_check')
   GROUP BY j.installation_id,i.account_login ORDER BY i.account_login,j.installation_id`,[workspaceId]),
  sql.query<{id:number;title:string;body:string;kind:string;findings:unknown;created_at:string;acknowledged_at:string|null;resolved_at:string|null;status:'open'|'waiting'}>(`SELECT id,title,body,kind,findings,created_at,acknowledged_at,resolved_at,
   CASE WHEN acknowledged_at IS NULL THEN 'open' ELSE 'waiting' END AS status
   FROM alerts WHERE workspace_id=$1 AND resolved_at IS NULL AND ${ACTIONABLE_ALERT_SQL}
   ORDER BY CASE
    WHEN kind IN ('repo_publicized','repo_created_public') THEN 0
    WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(findings)='array' THEN findings ELSE '[]'::jsonb END) finding WHERE lower(COALESCE(finding->>'severity',''))='critical') THEN 0
    WHEN jsonb_array_length(CASE WHEN jsonb_typeof(findings)='array' THEN findings ELSE '[]'::jsonb END)>0 THEN 1
    ELSE 2 END,
   CASE WHEN acknowledged_at IS NULL THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1`,[workspaceId])
 ]);
 const row=counts.rows[0];
 const now=Date.now(),health=websites.map(source=>websiteHealth(source,now));
 const websiteCoverage={total:websites.length,attention:health.filter(row=>row.attention).length,delayed:health.filter(row=>row.state==='delayed').length,unverified:health.filter(row=>row.state==='unverified').length,unchecked:health.filter(row=>row.state==='unchecked').length};
 const a=alerts.rows[0],alertCounts={open:Number(a.open),waiting:Number(a.waiting),done:Number(a.done),mine:Number(a.mine)};
 const hostedSources=hosted.rows.map(h=>({installationId:Number(h.installation_id),name:h.account_login,total:Number(h.total),passed:Number(h.passed),attention:Number(h.attention)}));
 const hostedReleases=hostedSources.reduce((sum,h)=>({total:sum.total+h.total,passed:sum.passed+h.passed,attention:sum.attention+h.attention}),{total:0,passed:0,attention:0});
 const connectedActivity=jobs.rows.map(j=>({installationId:Number(j.installation_id),name:j.account_login,queued:Number(j.queued),running:Number(j.running)}));
 return {workspace:{name:access.workspace.name,archived:!!access.workspace.archived_at},counts:{total:Number(row.total),active:Number(row.active),attention:Number(row.attention),completedAttention:Number(row.completed_attention),attemptAttention:Number(row.attempt_attention),passed:Number(row.passed)},recent:recent.rows,websiteCoverage,connectedCoverage,alertCounts,priorityAlert:priorityAlerts.rows[0]??null,hostedReleases,hostedSources,connectedActivity};
}
