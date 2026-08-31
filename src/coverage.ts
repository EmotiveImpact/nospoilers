export type CoverageStatus = "trial" | "active" | "ended"

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

export function coverageFromQuery(search: string): Coverage | null {
  const as = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("as")
  if (as === "ended") return coverageFrom("2000-01-01T00:00:00.000Z", null)
  if (as === "trial") {
    const inElevenDays = new Date(Date.now() + 11 * 86_400_000).toISOString()
    return coverageFrom(inElevenDays, "trial")
  }
  return null
}
