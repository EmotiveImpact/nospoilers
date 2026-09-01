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
  return applyPolicy(report, policyFromExceptionRows(rows));
}
