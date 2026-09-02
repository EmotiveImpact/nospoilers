/** Daily hosted unpack budget. Not a scan-credit meter and not a Pricing change. */

import { FAIR_USE_EXHAUSTED, FAIR_USE_WARNING } from "../fair-use-copy.ts";

export { FAIR_USE_EXHAUSTED, FAIR_USE_WARNING };

export const SOLO_HEAVY_PER_UTC_DAY = 8;
export const TEAM_HEAVY_PER_UTC_DAY = 24;
export const USAGE_WARNING_RATIO = 0.8;

export const FAIR_USE_ALERT_KIND = "fair_use_budget";

export function heavyUsageCap(
  plan: string | null | undefined,
  trialEndsAt: string | Date | null | undefined,
  now = Date.now(),
): number {
  if (plan === "solo") return SOLO_HEAVY_PER_UTC_DAY;
  if (plan === "team") return TEAM_HEAVY_PER_UTC_DAY;
  const end = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  if (end > now) return TEAM_HEAVY_PER_UTC_DAY;
  return SOLO_HEAVY_PER_UTC_DAY;
}

export function heavyUsageCapSql(): string {
  return `CASE
    WHEN b.plan = 'solo' THEN ${SOLO_HEAVY_PER_UTC_DAY}
    WHEN b.plan = 'team' THEN ${TEAM_HEAVY_PER_UTC_DAY}
    WHEN b.trial_ends_at IS NOT NULL AND b.trial_ends_at > now() THEN ${TEAM_HEAVY_PER_UTC_DAY}
    ELSE ${SOLO_HEAVY_PER_UTC_DAY}
  END`;
}

export function utcDayString(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function usageResetsAt(now = new Date()): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Date(next).toISOString();
}

export function secondsUntilUtcMidnight(now = Date.now()): number {
  const date = new Date(now);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

export function usageIsWarning(used: number, cap: number): boolean {
  if (cap <= 0 || used < 0) return false;
  return used >= Math.ceil(cap * USAGE_WARNING_RATIO) && used < cap;
}

export function usageIsExhausted(used: number, cap: number): boolean {
  return cap > 0 && used >= cap;
}

export function fairUseDeliveryId(installationId: number, day = utcDayString()): string {
  return `fair-use:${installationId}:${day}`;
}

export type HostedUsageStatus = {
  warning: boolean;
  exhausted: boolean;
  resetsAt: string;
};

export function hostedUsageStatus(used: number, cap: number, now = new Date()): HostedUsageStatus {
  return {
    warning: usageIsWarning(used, cap),
    exhausted: usageIsExhausted(used, cap),
    resetsAt: usageResetsAt(now),
  };
}
