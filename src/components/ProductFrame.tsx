import { navigate } from "@/nav.ts"
import { PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts"
import type { MouseEvent } from "react"

export function ProductFrame() {
  const repos = previewRepos()
  const alerts = previewAlerts()

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
        <span className="ml-auto text-[11px] uppercase tracking-[0.16em] text-dim">Trial · 11 days left</span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-white/8 px-5 py-6 md:border-b-0 md:border-r">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{PREVIEW_LOGIN}</p>
          <p className="mt-2 font-display text-xl text-snow">Watch desk</p>
          <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</p>
          {repos.map((repo) => (
            <div key={repo.id} className="mt-3">
              <p className="font-mono text-sm text-snow">{repo.full_name}</p>
              <p className="mt-1 text-xs text-dim">private · last check 2 minutes ago</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</p>
          {alerts.map((alert) => (
            <div key={alert.id} className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-danger">Went public</p>
              <p className="mt-2 text-sm text-snow">{alert.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-dim">{alert.body}</p>
            </div>
          ))}
        </div>
      </div>
    </a>
  )
}
