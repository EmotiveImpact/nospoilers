export type CoverageStatus = "trial" | "active" | "ended"

export const TRIAL_DAYS = 5

export type Coverage = {
  status: CoverageStatus
  plan: "trial" | "solo" | "team" | null
  daysLeft: number | null
  label: string
}

export function coverageFrom(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
  now = Date.now(),
): Coverage {
  if (plan === "solo" || plan === "team") {
    return {
      status: "active",
      plan,
      daysLeft: null,
      label: plan === "solo" ? "Solo" : "Team",
    }
  }
  const end = trialEndsAt ? new Date(trialEndsAt).getTime() : 0
  if (end > now) {
    const daysLeft = Math.max(1, Math.ceil((end - now) / 86_400_000))
    return {
      status: "trial",
      plan: "trial",
      daysLeft,
      label: `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    }
  }
  return { status: "ended", plan: null, daysLeft: 0, label: "Coverage ended" }
}

export function coverageIsOn(coverage: Coverage): boolean {
  return coverage.status === "trial" || coverage.status === "active"
}

export function preferCoverage(left: Coverage, right: Coverage): Coverage {
  const rank = (coverage: Coverage): number => {
    if (coverage.status === "active") return 2
    if (coverage.status === "trial") return 1
    return 0
  }
  const leftRank = rank(left)
  const rightRank = rank(right)
  if (rightRank !== leftRank) return rightRank > leftRank ? right : left
  if (left.status === "trial" && right.status === "trial") {
    return (right.daysLeft ?? 0) > (left.daysLeft ?? 0) ? right : left
  }
  return left
}

export function bestCoverage(rows: Coverage[]): Coverage {
  if (rows.length === 0) return coverageFrom(null, null)
  return rows.reduce(preferCoverage)
}
