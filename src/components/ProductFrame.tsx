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
      <div className="grid min-h-80 md:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="hidden border-r border-white/8 bg-[#0d0d10] p-4 md:block">
          <p className="font-display text-sm text-snow">NoSpoilers</p>
          <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-dim">Work</p>
          <p className="mt-2 rounded bg-white/8 px-2 py-1.5 text-xs text-snow">Overview</p>
          <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-dim">Evidence</p>
          <p className="mt-2 px-2 text-xs text-mute">Coverage</p>
          <p className="mt-2 px-2 text-xs text-mute">Releases</p>
          <p className="mt-2 px-2 text-xs text-mute">Timeline</p>
        </div>
        <div className="p-5 md:p-7">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Empty trial desk</p>
          <p className="mt-2 font-display text-2xl text-snow">Nothing is being watched yet.</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-dim">
            Connect a real source to create evidence. This preview does not invent incidents.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[
              ["GitHub exposure", "0 connected"],
              ["Release artifacts", "No receipt"],
              ["Production web", "0 origins"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/8 bg-white/[0.025] p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-dim">{label}</p>
                <p className="mt-3 text-sm text-snow">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-white/10 p-4">
            <p className="text-xs text-snow">First action</p>
            <p className="mt-1 text-xs text-dim">Install the GitHub App or add a production URL.</p>
          </div>
        </div>
      </div>
    </a>
  )
}
