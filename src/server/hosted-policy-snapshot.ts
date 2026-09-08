import {applyPolicy, POLICY_VERSION} from '../policy.ts';
import type {ScanPolicyShape, ScanReport} from '../scanner/types.ts';
import type {SqlClient} from './sql.ts';

type Candidate = ScanPolicyShape['exceptions'][number] & {artifactSha256: string | null};
export type HostedPolicySnapshot = {evaluatedAt: string; candidates: Candidate[]};

/** One statement freezes legacy and approval-backed candidates before parsing.
 * Digest matching happens afterwards, without consulting mutable policy again. */
export async function captureHostedPolicy(
  sql: SqlClient, installationId: number, packageId: number | null = null,
): Promise<HostedPolicySnapshot> {
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    throw new Error('A valid source connection is required for a policy snapshot.');
  }
  const result = await sql.query<{
    evaluated_at: string | Date;
    candidates: Array<{rule:string;path_pattern:string|null;path_match:'exact'|'glob';reason:string;expires_at:string;actor:string;artifact_sha256:string|null}>;
  }>(`WITH candidates AS (
    SELECT rule,path_pattern,'glob'::text AS path_match,reason,expires_at,actor_login AS actor,
      NULL::text AS artifact_sha256,0 AS kind,lpad(id::text,20,'0') AS sort_id,created_at
    FROM policy_exceptions WHERE installation_id=$1 AND revoked_at IS NULL AND expires_at>statement_timestamp()
      AND (package_id IS NULL OR package_id=$2::bigint)
    UNION ALL
    SELECT e.rule,e.exact_path,'exact',e.reason,e.expires_at,e.requested_login,e.artifact_sha256,1,e.id::text,e.created_at
    FROM workspace_exceptions e
    JOIN product_workspace_installations c ON c.workspace_id=e.workspace_id AND c.installation_id=e.installation_id
    WHERE e.installation_id=$1 AND e.source_origin_id IS NULL AND e.status='approved' AND e.expires_at>statement_timestamp()
  ) SELECT statement_timestamp() AS evaluated_at,
    COALESCE((SELECT json_agg(c ORDER BY kind,CASE WHEN kind=1 THEN created_at END,sort_id) FROM candidates c),'[]'::json) AS candidates`,[installationId,packageId]);
  const row=result.rows[0];
  if(!row)throw new Error('Policy snapshot unavailable.');
  return {evaluatedAt:new Date(row.evaluated_at).toISOString(),candidates:row.candidates.map(c=>({
    rule:c.rule,pathPattern:c.path_pattern,...(c.path_match==='exact'?{pathMatch:'exact' as const}:{}),
    reason:c.reason,expiresAt:new Date(c.expires_at).toISOString(),actor:c.actor,artifactSha256:c.artifact_sha256,
  }))};
}

export function applyHostedPolicySnapshot(report:ScanReport,snapshot:HostedPolicySnapshot):ScanReport {
  const exceptions=snapshot.candidates.filter(c=>c.artifactSha256===null||c.artifactSha256===report.artifactSha256)
    .map(({artifactSha256: _digest,...exception})=>exception);
  return applyPolicy(report,exceptions.length?{version:POLICY_VERSION,strict:false,exceptions}:null,new Date(snapshot.evaluatedAt));
}
