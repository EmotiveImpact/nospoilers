import { PageHeader } from "@/components/PageHeader.tsx"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { navigate } from "@/nav.ts"
import { GithubMark } from "@/components/GithubMark.tsx"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"

const SOLO = [
  "One GitHub user or one org they own",
  "All repos they grant the App",
  "Visibility alerts, unlimited-feeling",
  "Hosted pack scans, fair use",
  "CLI included",
  "Email",
]

const TEAM = [
  "A company org",
  "All repos in that install",
  "Visibility alerts, unlimited-feeling",
  "Hosted pack scans, higher fair use",
  "CLI included",
  "Slack + 90-day timeline",
]

export function PricingPage() {
  const [githubApp, setGithubApp] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as { githubApp?: boolean }
        if (!cancelled) setGithubApp(Boolean(body.githubApp))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  function startTrial() {
    if (githubApp) {
      window.location.href = "/api/auth/github"
      return
    }
    navigate("/watch?as=trial")
  }

  return (
    <main className="fade-up mx-auto max-w-6xl px-5 py-14 md:py-20">
      <PageHeader
        kicker="Coverage subscription"
        title="Pay to keep the bot thinking."
        description="Not scan credits. Credits train people to turn it off. 14-day full trial, then the card bills. Yearly is 10 months for the price of 12."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <PlanCard name="Solo" price={29} items={SOLO} onStart={startTrial} githubApp={githubApp} />
        <PlanCard
          name="Team"
          price={99}
          items={TEAM}
          featured
          onStart={startTrial}
          githubApp={githubApp}
        />
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-dim">
        When the trial ends unpaid: we stop processing webhooks (still 200 so GitHub is happy), stop
        the poller, and Watch says subscribe to keep watching. Stripe checkout is next — locally the
        trial button {githubApp ? "starts GitHub sign-in" : "opens the dashboard"}. Yearly: ~$290
        Solo · ~$990 Team.
      </p>
    </main>
  )
}

function PlanCard({
  name,
  price,
  items,
  featured,
  onStart,
  githubApp,
}: {
  name: string
  price: number
  items: string[]
  featured?: boolean
  onStart: () => void
  githubApp: boolean
}) {
  return (
    <Card
      className={
        featured
          ? "border-snow/25 bg-panel/80 shadow-[0_24px_80px_-48px_rgb(251_146_60_/_0.45)]"
          : "border-white/10 bg-panel/60"
      }
    >
      <CardHeader className="p-7 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{name}</p>
          {featured ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-snow">
              For companies
            </span>
          ) : null}
        </div>
        <CardTitle className="mt-3 font-display text-5xl tracking-tight">
          ${price}
          <span className="text-lg font-sans font-normal text-dim"> / month</span>
        </CardTitle>
        <CardDescription>14-day full trial. Cancel before it bills.</CardDescription>
      </CardHeader>
      <CardContent className="px-7 pb-8 md:px-8">
        <ul className="flex flex-col gap-2.5 text-sm text-mute">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Button type="button" className="mt-8 w-full sm:w-auto" onClick={onStart}>
          {githubApp ? <GithubMark /> : null}
          Start trial
        </Button>
      </CardContent>
    </Card>
  )
}
