import { LogInButton } from "@/components/AuthControls.tsx"
import { PageHeader } from "@/components/PageHeader.tsx"
import { ProductFrame } from "@/components/ProductFrame.tsx"
import { GithubMark } from "@/components/GithubMark.tsx"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { navigate } from "@/nav.ts"
import { Bell, Package, ShieldCheck } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

type Me = {
  user: { login: string } | null
  githubApp: boolean
}

export function LandingPage() {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as Me
        if (!cancelled && response.ok) setMe(body)
      })
      .catch(() => {
        if (!cancelled) setMe({ user: null, githubApp: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signedIn = Boolean(me?.user)
  const githubApp = Boolean(me?.githubApp)

  return (
    <main className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <div className="fade-up">
        <PageHeader
          size="hero"
          kicker="No spoilers in production"
          title={
            <>
              Catch the leak in the file
              <br className="hidden sm:block" /> people actually download.
            </>
          }
          description="Secret scanners read git. That missed Claude Code’s cli.js.map on npm. NoSpoilers watches GitHub, then opens the Release pack — the tarball, zip, or asar customers get."
        />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {signedIn ? (
            <Button type="button" size="lg" onClick={() => navigate("/watch")}>
              Open watch desk
            </Button>
          ) : githubApp ? (
            <Button as="a" href="/api/auth/github" size="lg">
              <GithubMark />
              Start 14-day trial
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => navigate("/watch?as=trial")}>
              Preview the desk
            </Button>
          )}
          {!signedIn && githubApp ? <LogInButton githubApp={githubApp} size="lg" label="Log in" /> : null}
          <Button type="button" size="lg" variant="outline" onClick={() => navigate("/pricing")}>
            Solo $29 · Team $99
          </Button>
        </div>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-dim">
          Trial is full coverage. When it ends unpaid, we stop jobs and alerts. Scan a pack on your
          laptop anytime — that is not the bill.
        </p>
      </div>

      <div className="fade-up-delay mt-14 grid gap-4 md:grid-cols-2">
        <DoorCard
          icon={<Bell className="h-5 w-5 text-signal" aria-hidden />}
          step="Door 1"
          title="The repo doors"
          body="Private becomes public. New public repo. Transfer, collaborator, fork. We ping you. Making git private later does not un-publish an installer already out there — this is the alarm for the GitHub side."
        />
        <DoorCard
          icon={<Package className="h-5 w-5 text-ok" aria-hidden />}
          step="Door 2"
          title="The box they download"
          body="You publish a GitHub Release with a .tgz, .zip, or .asar. We download that file and scan it. That is automatic. npm publish with no Release is a scan-before-ship step (CLI or Action)."
        />
      </div>

      <div className="fade-up-delay mt-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-dim">The desk</p>
        <h2 className="mt-3 font-display text-2xl tracking-tight text-snow md:text-3xl">
          Repos on the left. Alerts on the right.
        </h2>
        <p className="mt-2 max-w-lg text-sm text-mute">Click through to a sample watch desk.</p>
        <div className="mt-6">
          <ProductFrame />
        </div>
      </div>

      <ol className="mt-20 grid gap-4 border-t border-white/6 pt-12 md:grid-cols-3">
        <HowStep n="01" title="Install the GitHub App" icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
          Pick the repos we should watch. GitHub talks to our servers. You do not leave a laptop open.
        </HowStep>
        <HowStep n="02" title="Ship a Release pack" icon={<Package className="h-4 w-4" aria-hidden />}>
          Attach the tarball, zip, or asar people download. We open those bytes and look for maps, secrets, .git.
        </HowStep>
        <HowStep n="03" title="Get told if it spoils" icon={<Bell className="h-4 w-4" aria-hidden />}>
          Visibility alerts stay fast. Dirty packs show findings. Quiet is the good state.
        </HowStep>
      </ol>
    </main>
  )
}

function DoorCard({
  icon,
  step,
  title,
  body,
}: {
  icon: ReactNode
  step: string
  title: string
  body: string
}) {
  return (
    <Card className="border-white/10 bg-panel/70">
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-inset">
          {icon}
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-dim">{step}</p>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="leading-relaxed">{body}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function HowStep({
  n,
  title,
  icon,
  children,
}: {
  n: string
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <li className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{n}</p>
        <span className="text-mute">{icon}</span>
      </div>
      <h3 className="mt-4 font-display text-lg tracking-tight text-snow">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-dim">{children}</p>
    </li>
  )
}
