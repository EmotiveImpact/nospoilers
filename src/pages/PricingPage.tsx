import { AppSelect } from "@/components/ui/app-select";
import { navigate } from "@/nav.ts"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import "@/website/website.css"
import "./pricing.css"

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

type Interval = "month" | "year"

const PLANS = [
  {
    key: "solo",
    name: "Solo",
    monthly: 29,
    yearly: 290,
    description: "For one person checking their own releases.",
    features: [
      "Hosted scanning, within fair-use limits",
      "Saved release evidence with its scope and policy",
      "Package and source checks",
    ],
  },
  {
    key: "team",
    name: "Team",
    monthly: 99,
    yearly: 990,
    description: "For teams that review and respond to releases together.",
    features: [
      "Everything in Solo",
      "Invite named teammates with workspace roles",
      "Team notification paths you configure",
    ],
  },
] as const

const QUESTIONS = [
  {
    q: "What happens when the trial ends?",
    a: "New scans and monitoring pause until a plan is active. Your saved evidence stays in place, and anyone can still verify an existing release proof for free. Creating another workspace does not restart the trial.",
  },
  {
    q: "Does starting a trial sign me up to pay?",
    a: "No. A trial does not start a subscription. Payment only happens if you choose a plan and confirm it in the secure checkout, which shows the final total and terms first.",
  },
  {
    q: "How does yearly billing work?",
    a: "A yearly plan costs the same as ten monthly payments for twelve months of coverage. All prices are in US dollars.",
  },
  {
    q: "Do extra workspaces cost more?",
    a: "Additional workspaces share your organisation’s subscription and allowance. They do not add new trials or unlimited scan capacity. Seat counts and workspace caps are not published plan promises yet.",
  },
  {
    q: "Is there an enterprise plan?",
    a: "Not as a published price. Larger rollouts, identity requirements and commercial terms are agreed directly. We do not claim SSO, SCIM, dedicated hosting or service guarantees today.",
  },
] as const

export function PricingPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [installId, setInstallId] = useState<number | null>(null)
  const [interval, setBillingInterval] = useState<Interval>("month")
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

  async function startCheckout(plan: "solo" | "team", chosen: Interval) {
    if (!selected) {
      navigate("/watch")
      return
    }
    setBusy(`${plan}:${chosen}`)
    setError(null)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ installationId: selected.id, plan, interval: chosen }),
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

  const checkoutNote =
    me === null
      ? "Checking whether checkout is available…"
      : stripeLive
        ? "Checkout is open to workspace administrators. Independent workspace billing is managed inside the app."
        : "Checkout is not open on this site yet. Start a trial in the app or contact us; these pages never take payment."

  return (
    <div className="nsw nsp">
      <a className="nsw-skip" href="#nsw-main">Skip to pricing</a>
      <main id="nsw-main" className="nsp-main">
        <header className="nsp-hero">
          <p className="nsp-eyebrow"><i aria-hidden="true" />Pricing</p>
          <h1>Try it on a real release.</h1>
          <p>Five days with everything switched on. After that, a plan keeps new scans and monitoring running. Verifying an existing release proof is always free.</p>
        </header>

        {canceled ? <p role="status" className="nsp-banner">Checkout cancelled. Your coverage has not changed.</p> : null}

        <div className="nsp-controls">
          <div className="nsp-toggle" role="radiogroup" aria-label="Billing interval">
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                className={interval === value ? "is-on" : undefined}
                onClick={() => setBillingInterval(value)}
              >
                {value === "month" ? "Monthly" : "Yearly"}
                {value === "year" ? <span>2 months free</span> : null}
              </button>
            ))}
          </div>
          {adminInstalls.length > 1 ? (
            <label className="nsp-billing-for">
              <span>Billing for</span>
              <AppSelect label="GitHub connection to bill" value={selected?.id ?? ""} onValueChange={(nextValue) => setInstallId(Number(nextValue))}>
                {adminInstalls.map((row) => <option key={row.id} value={row.id}>{row.account_login}</option>)}
              </AppSelect>
            </label>
          ) : null}
        </div>

        <div className="nsp-plans">
          {PLANS.map((plan) => {
            const yearly = interval === "year"
            const label = busy === `${plan.key}:${interval}` ? "Starting…" : canCheckout ? `Subscribe ${yearly ? "yearly" : "monthly"}` : me?.user ? "Open app" : "Start five-day trial"
            return (
              <article className={`nsp-plan${plan.key === "team" ? " nsp-featured" : ""}`} key={plan.key}>
                <div className="nsp-plan-head">
                  <h2>{plan.name}</h2>
                  {plan.key === "team" ? <span className="nsp-tag">Recommended</span> : null}
                </div>
                <div className="nsp-price">
                  ${yearly ? plan.yearly : plan.monthly}
                  <small>USD / {yearly ? "year" : "month"}</small>
                </div>
                <p className="nsp-sub">{yearly ? `Same as $${(plan.yearly / 12).toFixed(2)} a month, billed once a year` : `Or $${plan.yearly} a year, billed annually`}</p>
                <p className="nsp-desc">{plan.description}</p>
                <button
                  type="button"
                  className={`nsp-cta${plan.key === "team" ? " nsp-red" : ""}`}
                  disabled={Boolean(busy)}
                  onClick={() => (canCheckout ? void startCheckout(plan.key, interval) : openWatch())}
                >
                  {label}
                </button>
                <ul>
                  {plan.features.map((feature) => <li key={feature}><Check aria-hidden="true" />{feature}</li>)}
                </ul>
              </article>
            )
          })}
          <article className="nsp-plan nsp-custom">
            <div className="nsp-plan-head"><h2>Custom</h2></div>
            <div className="nsp-price nsp-talk">Let’s talk.</div>
            <p className="nsp-sub">For higher volumes or a security review</p>
            <p className="nsp-desc">Tell us about your release pipeline and your organisation’s requirements, and we will scope an evaluation together.</p>
            <a className="nsp-cta" href="/enterprise">Plan an evaluation</a>
            <ul>
              <li><Check aria-hidden="true" />Higher-volume processing</li>
              <li><Check aria-hidden="true" />Your organisation’s requirements</li>
              <li><Check aria-hidden="true" />Terms agreed directly</li>
            </ul>
          </article>
        </div>

        {error ? <p role="alert" className="nsp-banner nsp-warning">{error}</p> : null}
        <p className="nsp-note">{checkoutNote}</p>

        <section className="nsp-faq" aria-labelledby="pricing-questions">
          <div className="nsp-faq-head">
            <p className="nsp-eyebrow">Before you choose</p>
            <h2 id="pricing-questions">Pricing questions.</h2>
            <p>Still unsure? <a href="/docs/getting-started">Read the first-scan guide</a> or <a href="/support">talk to us</a>. Contract material remains a <a href="/terms">review draft</a> until approved.</p>
          </div>
          <div className="nsp-faq-list">
            {QUESTIONS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}<span aria-hidden="true" /></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
