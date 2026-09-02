import { coverageFrom, type Coverage } from "../coverage.ts";
import type { ReleaseRevisionRow } from "./store.ts";

export const GOVERNANCE_REASON_ERROR = "Give a short reason (at least 8 characters).";
export const GOVERNANCE_DIRTY_ERROR =
  "Failed-policy and inconclusive releases are not allowed to ship.";
export const GOVERNANCE_MISMATCH_ERROR = "A digest-changed revision is not allowed to ship.";
export const GOVERNANCE_SOD_ATTACH_ERROR =
  "Separation of duties: you attached a delivery URL on this release.";
export const GOVERNANCE_SOD_HOLD_ERROR =
  "Separation of duties: another admin must release this legal hold.";
export const GOVERNANCE_DUPLICATE_ERROR = "That decision is already recorded.";
export const GOVERNANCE_HELD_ERROR = "This release is already on legal hold.";
export const GOVERNANCE_NOT_HELD_ERROR = "This release is not on legal hold.";

export const RELEASE_EXPORT_LIMIT = 200;

export type ApprovalDecision = "approved" | "rejected";
export type LegalHoldAction = "place" | "release";

export function governancePlanDenied(
  coverage: Coverage,
): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return {
      error:
        "Coverage ended. Subscribe to Team for release approval, legal hold, and ledger export.",
      status: 402,
    };
  }
  if (coverage.plan === "solo") {
    return {
      error: "Release approval, legal hold, and ledger export are on Team.",
      status: 403,
    };
  }
  return null;
}

export function governancePlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return governancePlanDenied(coverageFrom(trialEndsAt, plan));
}

export function parseGovernanceReason(raw: unknown): string {
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < 8 || reason.length > 200) {
    throw Object.assign(new Error(GOVERNANCE_REASON_ERROR), { status: 400 });
  }
  return reason;
}

export function parseApprovalDecision(raw: unknown): ApprovalDecision {
  if (raw === "approved" || raw === "rejected") return raw;
  throw Object.assign(new Error("Decision must be approved or rejected."), { status: 400 });
}

export function parseHoldAction(raw: unknown): LegalHoldAction {
  if (raw === "place" || raw === "release") return raw;
  throw Object.assign(new Error("Hold action must be place or release."), { status: 400 });
}

export function shippingBlockedReason(
  row: Pick<ReleaseRevisionRow, "mismatch" | "receipt_status">,
): string | null {
  if (row.mismatch) return GOVERNANCE_MISMATCH_ERROR;
  if (row.receipt_status !== "passed") return GOVERNANCE_DIRTY_ERROR;
  return null;
}

export function latestByRevision<T extends { revision_id: number; id: number }>(
  rows: T[],
): Map<number, T> {
  const latest = new Map<number, T>();
  for (const row of rows) {
    const current = latest.get(row.revision_id);
    if (!current || row.id > current.id) latest.set(row.revision_id, row);
  }
  return latest;
}

export function groupedByRevision<T extends { revision_id: number }>(rows: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const row of rows) {
    const list = groups.get(row.revision_id) ?? [];
    list.push(row);
    groups.set(row.revision_id, list);
  }
  return groups;
}
