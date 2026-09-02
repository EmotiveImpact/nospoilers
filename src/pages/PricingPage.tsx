import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"
import { useEffect, useState } from "react"

type Me = {
  user: { login: string } | null
  stripe?: boolean
  installations?: {
    id: number
    account_login: string
    role?: "admin" | "member"
  }[]
}

export function PricingPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [installId, setInstallId] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canceled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled") === "1"

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/me")
        const body = (await response.json()) as Me
        if (cancelled) return
        setMe(body)
        const admin = (body.installations ?? []).find((row) => row.role === "admin")
        setInstallId(admin?.id ?? body.installations?.[0]?.id ?? null)
      } catch {
        if (!cancelled) setMe({ user: null, stripe: false, installations: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const stripeLive = Boolean(me?.stripe)
  const adminInstalls = (me?.installations ?? []).filter((row) => row.role === "admin")
  const selected = adminInstalls.find((row) => row.id === installId) ?? adminInstalls[0] ?? null
  const canCheckout = Boolean(me?.user && stripeLive && selected)

  async function startCheckout(plan: "solo" | "team", interval: "month" | "year") {
    if (!selected) {
      navigate("/watch")
      return
    }
    setBusy(`${plan}:${interval}`)
    setError(null)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationId: selected.id, plan, interval }),
      })
      const body = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !body.url) {
        throw new Error(body.error ?? "Could not start checkout.")
      }
      window.location.assign(body.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.")
      setBusy(null)
    }
  }

  return (
    <main className="fade-up mx-auto max-w-5xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Coverage subscription</p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Pay to keep the bot thinking.
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute md:text-lg">
        Not scan credits. Credits train people to turn it off. 14-day full trial, then the card
        bills. Yearly is 10 months for the price of 12.
      </p>
      {canceled ? (
        <p className="mt-6 text-sm text-mute">Checkout canceled. Coverage is unchanged.</p>
      ) : null}
      {adminInstalls.length > 1 ? (
        <label className="mt-8 flex max-w-sm flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-dim">GitHub install</span>
          <select
            value={selected?.id ?? ""}
            onChange={(event) => setInstallId(Number(event.target.value))}
            className="h-10 rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
          >
            {adminInstalls.map((row) => (
              <option key={row.id} value={row.id}>
                {row.account_login}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <article className="border border-white/10 p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Solo</p>
          <p className="mt-4 font-display text-5xl tracking-tight text-snow">
            $29<span className="text-lg text-dim"> / month</span>
          </p>
          <p className="mt-2 text-sm text-dim">$290 / year</p>
          <ul className="mt-6 flex flex-col gap-2 text-sm leading-relaxed text-mute">
            <li>One GitHub user or one org they own</li>
            <li>All repos they grant the App</li>
            <li>Unlimited-feeling visibility alerts</li>
            <li>Hosted pack scans, fair use</li>
            <li>CLI included</li>
            <li>Email</li>
            <li>Configurable retention</li>
          </ul>
          {canCheckout ? (
            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={Boolean(busy)} onClick={() => void startCheckout("solo", "month")}>
                {busy === "solo:month" ? "Starting…" : "Subscribe monthly"}
              </Button>
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void startCheckout("solo", "year")}>
                {busy === "solo:year" ? "Starting…" : "Subscribe yearly"}
              </Button>
            </div>
          ) : (
            <Button type="button" className="mt-8" onClick={() => navigate(me?.user ? "/watch" : "/watch?as=trial")}>
              {me?.user ? "Open watch desk" : "Start trial"}
            </Button>
          )}
        </article>
        <article className="border border-white/10 p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Team</p>
          <p className="mt-4 font-display text-5xl tracking-tight text-snow">
            $99<span className="text-lg text-dim"> / month</span>
          </p>
          <p className="mt-2 text-sm text-dim">$990 / year</p>
          <ul className="mt-6 flex flex-col gap-2 text-sm leading-relaxed text-mute">
            <li>A company org</li>
            <li>All repos in that install</li>
            <li>Unlimited-feeling visibility alerts</li>
            <li>Hosted pack scans, higher fair use</li>
            <li>CLI included</li>
            <li>Slack + Jira + routing + 90-day timeline + roles + audit export + identity signals + configurable retention</li>
          </ul>
          {canCheckout ? (
            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              <Button type="button" disabled={Boolean(busy)} onClick={() => void startCheckout("team", "month")}>
                {busy === "team:month" ? "Starting…" : "Subscribe monthly"}
              </Button>
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void startCheckout("team", "year")}>
                {busy === "team:year" ? "Starting…" : "Subscribe yearly"}
              </Button>
            </div>
          ) : (
            <Button type="button" className="mt-8" onClick={() => navigate(me?.user ? "/watch" : "/watch?as=trial")}>
              {me?.user ? "Open watch desk" : "Start trial"}
            </Button>
          )}
        </article>
      </div>
      {error ? <p className="mt-6 text-sm text-danger">{error}</p> : null}
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-dim">
        When the trial ends unpaid: we stop processing webhooks (still 200 so GitHub is happy), stop
        the poller, and Watch says subscribe to keep watching. Checkout collects a card through
        Stripe before the remaining trial days bill. Yearly: $290 Solo · $990 Team. This host
        {stripeLive ? " can start Checkout when you are an install admin." : " does not take cards until Stripe keys are set."}
      </p>
    </main>
  )
}
