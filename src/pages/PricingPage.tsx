import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"
import { useEffect, useState } from "react"
import { PUBLIC_LINKS } from "@/website/page-paths.ts"
import "@/website/website.css"

type Me = {
  user: { login: string } | null
  githubApp?: boolean
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

  function openWatch() {
    if (me?.user) {
      navigate("/watch")
    } else if (me?.githubApp) {
      window.location.assign("/api/auth/github")
    } else {
      navigate("/watch")
    }
  }

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
    <div className="nsw">
      <a className="nsw-skip" href="#nsw-main">Skip to pricing</a>
      <main id="nsw-main" className="nsw-public-main">
        <header className="nsw-public-hero">
          <p className="nsw-eyebrow">Coverage subscription</p>
          <h1 className="nsw-title">Evaluate with a real release.</h1>
          <p className="nsw-lede">A five-day trial, then an active subscription for new scans and monitoring. There is no permanent free scanner. Verification of an existing proof is a separate operation.</p>
        </header>
        {canceled ? <p role="status" className="nsw-note">Checkout cancelled. Coverage is unchanged.</p> : null}
        {adminInstalls.length > 1 ? <label className="nsw-field">
          GitHub connection for the existing checkout flow
          <select value={selected?.id ?? ""} onChange={event => setInstallId(Number(event.target.value))}>
            {adminInstalls.map(row => <option key={row.id} value={row.id}>{row.account_login}</option>)}
          </select>
        </label> : null}
        <div className="nsw-price-grid">
          {([{ key: 'solo', name: 'Solo', monthly: 29, yearly: 290, description: 'For an individual release workflow.' }, { key: 'team', name: 'Team', monthly: 99, yearly: 990, description: 'For collaborative release review and response.' }] as const).map(plan => <article className="nsw-price-plan" key={plan.key}>
            <h2>{plan.name}</h2>
            <div className="nsw-price">${plan.monthly}<small> USD / month</small></div>
            <p>${plan.yearly} USD / year, billed annually</p>
            <p>{plan.description}</p>
            <ul>
              <li>Authenticated hosted scanning, subject to entitlement and fair-use limits.</li>
              <li>Saved release evidence with recorded scope and policy.</li>
              <li>{plan.key === 'team' ? 'Workspace invitations and supported team notification paths.' : 'A focused starting point for package and source checks.'}</li>
            </ul>
            {canCheckout ? <div className="nsw-actions">
              <Button className="nsw-button nsw-primary" type="button" disabled={Boolean(busy)} onClick={() => void startCheckout(plan.key, 'month')}>{busy === `${plan.key}:month` ? 'Starting…' : 'Subscribe monthly'}</Button>
              <Button className="nsw-button" type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void startCheckout(plan.key, 'year')}>{busy === `${plan.key}:year` ? 'Starting…' : 'Subscribe yearly'}</Button>
            </div> : <Button className="nsw-button nsw-primary" type="button" onClick={openWatch}>{me?.user ? 'Open app' : 'Start trial'}</Button>}
          </article>)}
        </div>
        {error ? <p role="alert" className="nsw-note nsw-warning">{error}</p> : null}
        <div className="nsw-prose">
          <section className="nsw-section" aria-labelledby="pricing-terms"><h2 id="pricing-terms">Understand the commercial boundary</h2>
            <p>Annual prices equal ten monthly payments for a year of coverage. Prices are shown in US dollars. Review the configured checkout, its final total and applicable terms before confirming a purchase.</p>
            <p>Additional workspaces share the organisation’s subscription and allowance; they do not create new trials or unlimited scan capacity. Seat counts and workspace caps are not published as confirmed plan promises here.</p>
            <p>{me === null ? 'Checking whether this host can offer the existing checkout flow…' : stripeLive ? 'Checkout is available only to an eligible administrator through the existing billing flow.' : 'Checkout availability is not confirmed on this host. Open the app or contact support; no payment is taken by these pages.'} Independent-workspace billing is managed in the application; this public page preserves the existing connection-based checkout flow.</p>
          </section>
          <section className="nsw-section" aria-labelledby="pricing-trial"><h2 id="pricing-trial">What happens after the trial?</h2>
            <p>New scans and monitoring require active entitlement. An unpaid trial does not grant permanent scanning access. Creating a new workspace does not reset the trial. Selecting a file publicly is intake, not an anonymous scan or a vulnerability report.</p>
            <p>Do not assume that starting a trial automatically enters a payment contract. Any card collection and subscription action use the configured checkout, not a simulated form on this site.</p>
          </section>
          <section className="nsw-section" aria-labelledby="pricing-enterprise"><h2 id="pricing-enterprise">Evaluate with your team</h2>
            <p>Enterprise scope, identity requirements, operational readiness and commercial terms need an explicit agreement. We do not publish an enterprise price or imply SSO, SCIM, dedicated hosting or contractual service guarantees are available.</p>
            <p><a href="/enterprise">Plan an enterprise evaluation</a> or <a href="/docs/getting-started">read the first-scan guide</a>. <a href="/terms">Contract material remains a review draft</a> until approved.</p>
          </section>
        </div>
        <nav className="nsw-public-nav" aria-label="Explore NoSpoilers">{PUBLIC_LINKS.map(([href,label]) => <a key={href} href={href}>{label}</a>)}</nav>
      </main>
    </div>
  )
}
