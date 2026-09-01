import { coverageFrom, type Coverage } from "../coverage.ts";

export const RETENTION_DEFAULT_DAYS = 90;
export const RETENTION_DAY_OPTIONS = [90, 180, 365, 0] as const;

export type RetentionDays = (typeof RETENTION_DAY_OPTIONS)[number];

export function parseRetentionDays(raw: unknown): RetentionDays | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
  if (value === 0 || value === 90 || value === 180 || value === 365) return value;
  return null;
}

export function retentionConfirmToken(days: RetentionDays): string {
  return days === 0 ? "keep" : String(days);
}

export function retentionPlanDenied(coverage: Coverage): { error: string; status: 402 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to keep configurable retention.", status: 402 };
  }
  return null;
}

export function retentionPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 } | null {
  return retentionPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function retentionWindow(
  days: RetentionDays,
  now = new Date(),
): { days: RetentionDays; since: string | null; until: string } {
  const until = now.toISOString();
  if (days === 0) return { days, since: null, until };
  return {
    days,
    since: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
    until,
  };
}

export function normalizeRetentionDays(raw: number | null | undefined): RetentionDays {
  return parseRetentionDays(raw) ?? RETENTION_DEFAULT_DAYS;
}

export const RETENTION_DAYS_ERROR =
  "Retention must be 90, 180, or 365 days, or keep while this install exists.";

export function retentionAuditSummary(days: RetentionDays): string {
  if (days === 0) return "Set retention to keep while this install exists";
  return `Set retention to ${days} days`;
}
