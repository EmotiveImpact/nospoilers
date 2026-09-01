import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"

export function PricingPage() {
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
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <article className="border border-white/10 p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Solo</p>
          <p className="mt-4 font-display text-5xl tracking-tight text-snow">
            $29<span className="text-lg text-dim"> / month</span>
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-sm leading-relaxed text-mute">
            <li>One GitHub user or one org they own</li>
            <li>All repos they grant the App</li>
            <li>Unlimited-feeling visibility alerts</li>
            <li>Hosted pack scans, fair use</li>
            <li>CLI included</li>
            <li>Email</li>
          </ul>
          <Button type="button" className="mt-8" onClick={() => navigate("/watch?as=trial")}>
            Start trial
          </Button>
        </article>
        <article className="border border-white/10 p-6 md:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Team</p>
          <p className="mt-4 font-display text-5xl tracking-tight text-snow">
            $99<span className="text-lg text-dim"> / month</span>
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-sm leading-relaxed text-mute">
            <li>A company org</li>
            <li>All repos in that install</li>
            <li>Unlimited-feeling visibility alerts</li>
            <li>Hosted pack scans, higher fair use</li>
            <li>CLI included</li>
            <li>Slack + 90-day timeline + roles</li>
          </ul>
          <Button type="button" className="mt-8" onClick={() => navigate("/watch?as=trial")}>
            Start trial
          </Button>
        </article>
      </div>
      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-dim">
        When the trial ends unpaid: we stop processing webhooks (still 200 so GitHub is happy), stop
        the poller, and Watch says subscribe to keep watching. Stripe checkout is Phase B — locally
        the trial button opens the watch desk. Yearly: ~$290 Solo · ~$990 Team.
      </p>
    </main>
  )
}
