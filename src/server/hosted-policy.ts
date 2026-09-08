import { applyPolicy, POLICY_VERSION } from "../policy.ts";
import type { ScanPolicyShape, ScanReport } from "../scanner/types.ts";
import type { PolicyExceptionRow, Store } from "./store.ts";

export function policyFromExceptionRows(rows: PolicyExceptionRow[]): ScanPolicyShape | null {
  if (rows.length === 0) return null;
  return {
    version: POLICY_VERSION,
    strict: false,
    exceptions: rows.map((row) => ({
      rule: row.rule,
      pathPattern: row.path_pattern,
      reason: row.reason,
      expiresAt: row.expires_at,
      actor: row.actor_login,
    })),
  };
}

export async function applyHostedPolicy(
  store: Store,
  report: ScanReport,
  installationId: number,
  packageId?: number | null,
): Promise<ScanReport> {
  if (!Number.isFinite(installationId) || installationId <= 0) return report;
  const rows = await store.listActiveExceptions(installationId, packageId ?? null);
  const approved = await store.sql.query<{rule:string;exact_path:string;reason:string;expires_at:string;requested_login:string}>(`SELECT e.rule,e.exact_path,e.reason,e.expires_at,e.requested_login FROM workspace_exceptions e
    JOIN product_workspace_installations c ON c.workspace_id=e.workspace_id AND c.installation_id=e.installation_id
    WHERE e.installation_id=$1 AND e.source_origin_id IS NULL AND e.artifact_sha256=$2 AND e.status='approved' AND e.expires_at>now() ORDER BY e.created_at,e.id`,[installationId,report.artifactSha256]);
  const legacy=policyFromExceptionRows(rows);
  const policy=approved.rows.length?{version:POLICY_VERSION,strict:false,exceptions:[...(legacy?.exceptions??[]),...approved.rows.map(e=>({rule:e.rule,pathPattern:e.exact_path,pathMatch:'exact' as const,reason:e.reason,expiresAt:new Date(e.expires_at).toISOString(),actor:e.requested_login}))]}:legacy;
  return applyPolicy(report, policy);
}
