import { coverageFrom, type Coverage } from "../coverage.ts";

export const CONFIRM_MISSING_ERROR = "Type the identifier to confirm this action.";
export const CONFIRM_MISMATCH_ERROR = "Confirmation did not match.";

export const AUDIT_ACTIONS = [
  "destination.save",
  "destination.delete",
  "route.save",
  "route.delete",
  "registry.save",
  "registry.delete",
  "scan_token.mint",
  "scan_token.revoke",
  "exception.save",
  "exception.revoke",
  "baseline.save",
  "member.role_change",
  "member.remove",
  "invite.create",
  "invite.revoke",
  "setup_pr.create",
  "remediation_pr.create",
  "package.unwatch",
  "origin.unwatch",
  "map_destination.save",
  "map_destination.delete",
  "identity.allowlist",
  "identity.revoke_allowlist",
  "retention.save",
  "repo.make_private",
  "repo.delete_pack_assets",
  "repo.disable_workflow",
  "delivery_location.save",
  "release.approve",
  "release.reject",
  "release.hold",
  "release.release_hold",
  "release.publish_verify",
  "release.unpublish_verify",
  "release.attest",
  "identity.evidence",
  "identity.publish_advisory",
  "identity.unpublish_advisory",
  "namespace.protect",
  "namespace.unprotect",
  "billing.checkout",
  "billing.portal",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function typedConfirm(
  body: Record<string, unknown>,
  expected: string,
): { error: string } | null {
  const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
  const want = expected.trim();
  if (!want || !confirm) return { error: CONFIRM_MISSING_ERROR };
  if (confirm !== want) return { error: CONFIRM_MISMATCH_ERROR };
  return null;
}

export function auditPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team for the audit log.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "The audit log is on Team.", status: 403 };
  }
  return null;
}

export function auditPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return auditPlanDenied(coverageFrom(trialEndsAt, plan));
}
