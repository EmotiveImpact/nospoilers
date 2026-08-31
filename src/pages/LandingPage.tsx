import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"
import { useEffect, useState } from "react"

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
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">No spoilers in production</p>
      <h1 className="mt-5 max-w-4xl font-display text-[2.5rem] leading-[1.05] tracking-tight text-snow sm:text-6xl md:text-7xl">
        We watch GitHub.
        <br />
        We read the pack they download.
      </h1>
      <p className="mt-6 max-w-lg text-base leading-relaxed text-mute md:text-lg">
        Secret scanners read git. That missed Claude Code’s <code className="text-snow">cli.js.map</code> on
        npm and maps inside a public installer. NoSpoilers is a GitHub App: private → public, then
        the tarball, zip, or asar. You pay for coverage on our servers, not a scan counter.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        {signedIn ? (
          <Button type="button" size="lg" onClick={() => navigate("/watch")}>
            Open watch desk
          </Button>
        ) : githubApp ? (
          <Button as="a" href="/api/auth/github" size="lg">
            Start 14-day trial
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={() => navigate("/watch")}>
            Start 14-day trial
          </Button>
        )}
        <Button type="button" size="lg" variant="outline" onClick={() => navigate("/pricing")}>
          Solo $29 · Team $99
        </Button>
      </div>
      <p className="mt-6 max-w-lg text-sm leading-relaxed text-dim">
        Trial is full coverage. When it ends unpaid, we stop jobs and alerts. The CLI on your laptop
        is a bonus. We do not pretend we can DRM it.
      </p>
      <ul className="mt-20 grid gap-10 border-t border-white/5 pt-12 sm:grid-cols-3">
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">01</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">Watch GitHub</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Publicize, created public, transfer, collaborator, fork. The doorbell answers in under a
            second. You cannot pirate that.
          </p>
        </li>
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">02</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">Read the pack</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Hosted unpack of npm tgz, zip, Electron asar. Included on the plan, fair use, no scan
            credits. We do not keep the bytes.
          </p>
        </li>
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">03</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">Fail closed in CI</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            <code className="text-mute">npx nospoilers scan ./package.tgz</code> for the build you
            remember to wire. The hosted app is for the release you forget.
          </p>
        </li>
      </ul>
    </main>
  )
}
