import { coverageFrom, type Coverage } from "../coverage.ts";

export const TIMELINE_DAYS = 90;
export const TIMELINE_LIMIT = 200;

export function timelinePlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team for the 90-day timeline.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "The 90-day timeline is on Team.", status: 403 };
  }
  return null;
}

export function timelinePlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return timelinePlanDenied(coverageFrom(trialEndsAt, plan));
}

export function timelineWindow(now = new Date()): { since: string; until: string } {
  const until = now.toISOString();
  const since = new Date(now.getTime() - TIMELINE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { since, until };
}
