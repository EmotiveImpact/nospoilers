import { navigate } from "@/nav.ts"
import type { MouseEvent } from "react"

export function ProductFrame() {
  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    navigate("/watch?as=trial")
  }

  return (
    <a
      href="/watch?as=trial"
      onClick={go}
      className="block overflow-hidden rounded-xl border border-white/10 bg-panel text-left transition-colors hover:border-white/20"
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
        <span className="size-1.5 rounded-full bg-white/25" aria-hidden />
        <span className="size-1.5 rounded-full bg-white/25" aria-hidden />
        <span className="size-1.5 rounded-full bg-white/25" aria-hidden />
        <span className="ml-2 font-mono text-[11px] text-dim">/watch</span>
        <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-dim">Product preview</span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-white/8 px-5 py-6 md:border-b-0 md:border-r">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Watch desk</p>
          <p className="mt-2 font-display text-xl text-snow">Nothing invented.</p>
          <p className="mt-3 text-xs leading-relaxed text-dim">
            Sign in to see repositories, releases, and alerts from your GitHub install.
          </p>
        </div>
        <div className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Overview</p>
          <p className="mt-2 text-sm text-snow">Live facts appear here after connection.</p>
          <p className="mt-3 text-xs leading-relaxed text-dim">
            Preview shows the product structure without pretending an incident occurred.
          </p>
        </div>
      </div>
    </a>
  )
}
