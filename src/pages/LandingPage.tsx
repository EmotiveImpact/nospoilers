import { LogInButton } from "@/components/AuthControls.tsx"
import { ProductFrame } from "@/components/ProductFrame.tsx"
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

  function primary() {
    if (signedIn) navigate("/watch")
    else if (githubApp) window.location.assign("/api/auth/github")
    else navigate("/watch?as=trial")
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <section className="fade-up grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <h1 className="max-w-xl font-display text-[2.5rem] leading-[1.05] tracking-tight text-snow sm:text-6xl">
            Know what actually shipped.
            <br />
            Before customers find it.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-mute md:text-lg">
            NoSpoilers checks release packs, production websites, and GitHub exposure for source
            maps, secrets, and internal material added after code review.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="lg"
              className="bg-ember text-white data-hover:bg-[#ff6a3d] data-active:bg-[#e84412]"
              onClick={primary}
            >
              {signedIn ? "Open watch desk" : "Start 14-day trial"}
            </Button>
            {!signedIn ? <LogInButton githubApp={githubApp} size="lg" /> : null}
            <Button type="button" size="lg" variant="ghost" onClick={() => navigate("/pricing")}>
              Solo $29 · Team $99 →
            </Button>
          </div>
        </div>

        <div
          aria-hidden
          className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-white/8 bg-panel"
        >
          <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember/20 blur-3xl" />
          <div className="absolute inset-[12%] rounded-full border border-white/12" />
          <div className="absolute inset-[24%] rounded-full border border-white/8" />
          <div className="absolute inset-[38%] rounded-full border border-ember/40" />
          <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember" />
        </div>
      </section>

      <section className="mt-24 md:mt-32">
        <h2 className="max-w-xl font-display text-3xl tracking-tight text-snow md:text-4xl">
          One release firewall. Before and after deployment.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-mute">
          The same bounded scanner reads artifact and website bytes. GitHub Watch handles repository
          exposure events. Every finding reaches one desk.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-panel p-6 md:p-8">
            <p className="font-display text-xl tracking-tight text-snow">Pre-release gate</p>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Scan the exact tarball, zip, image, extension, or app package before publishing—by
              hand or automatically in your existing CI.
            </p>
            <p className="mt-5 font-mono text-xs text-dim">npx nospoilers scan ./package.tgz</p>
            <Button type="button" variant="ghost" className="mt-8 px-0" onClick={() => navigate("/scan")}>
              Open the drop zone →
            </Button>
          </article>
          <article className="rounded-xl border border-ember/50 bg-panel p-6 shadow-[0_0_40px_-12px_rgb(255_79_31_/_0.45)] md:p-8">
            <p className="font-display text-xl tracking-tight text-snow">Continuous coverage</p>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Watch published packs, deployed web assets, and GitHub visibility after the build is
              over. Trial is full coverage. Unpaid, the hosted watch goes quiet.
            </p>
            <Button
              type="button"
              className="mt-8 bg-ember text-white data-hover:bg-[#ff6a3d]"
              onClick={primary}
            >
              {signedIn ? "Open watch desk" : "Start 14-day trial"} →
            </Button>
          </article>
        </div>
      </section>

      <div className="mt-24 md:mt-32">
        <ProductFrame />
        <p className="mt-3 text-xs text-dim">The logged-in desk during trial. Click through.</p>
      </div>

      <ul className="mt-24 grid gap-10 border-t border-white/5 pt-12 sm:grid-cols-3 md:mt-32">
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">01</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">GitHub exposure</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Watch private → public, created-public, transfer, collaborator, fork, and Release events.
          </p>
        </li>
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">02</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">Release artifacts</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Inspect the exact npm tarball, GitHub Release, zip, image, extension, or asar customers
            receive—not merely the repository that produced it.
          </p>
        </li>
        <li>
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">03</p>
          <p className="mt-3 font-display text-xl tracking-tight text-snow">Production websites</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Check public HTML, JavaScript, CSS, exposed files, and source maps. Reconstruct embedded
            source in memory without retaining it.
          </p>
        </li>
      </ul>
    </main>
  )
}
