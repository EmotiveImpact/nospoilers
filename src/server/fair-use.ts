/** Concurrent hosted unpacks per install. Not a scan-credit meter. */
export const SOLO_HEAVY_FAIR_USE = 1;
export const TEAM_HEAVY_FAIR_USE = 3;

export function heavyFairUseCap(
  plan: string | null | undefined,
  trialEndsAt: string | Date | null | undefined,
  now = Date.now(),
): number {
  if (plan === "solo") return SOLO_HEAVY_FAIR_USE;
  if (plan === "team") return TEAM_HEAVY_FAIR_USE;
  const end = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  if (end > now) return TEAM_HEAVY_FAIR_USE;
  return SOLO_HEAVY_FAIR_USE;
}

export function heavyFairUseCaseSql(): string {
  return `CASE
    WHEN b.plan = 'solo' THEN ${SOLO_HEAVY_FAIR_USE}
    WHEN b.plan = 'team' THEN ${TEAM_HEAVY_FAIR_USE}
    WHEN b.trial_ends_at IS NOT NULL AND b.trial_ends_at > now() THEN ${TEAM_HEAVY_FAIR_USE}
    ELSE ${SOLO_HEAVY_FAIR_USE}
  END`;
}
