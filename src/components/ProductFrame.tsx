import { Badge } from "@/components/ui/badge"
import { navigate } from "@/nav.ts"
import { PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts"
import { ArrowUpRight } from "lucide-react"
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
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-panel/80 text-left shadow-[0_24px_80px_-40px_rgb(0_0_0_/_0.9)] transition-colors hover:border-white/20"
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="size-2 rounded-full bg-white/20" aria-hidden />
        <span className="size-2 rounded-full bg-white/20" aria-hidden />
        <span className="size-2 rounded-full bg-white/20" aria-hidden />
        <span className="ml-2 font-mono text-[11px] text-dim">nospoilers.dev/watch</span>
        <span className="ml-auto hidden items-center gap-2 sm:flex">
          <Badge variant="live">Trial · 11 days left</Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-dim group-hover:text-snow">
            Open desk
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </span>
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-white/8 px-5 py-6 md:border-b-0 md:border-r">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{PREVIEW_LOGIN}</p>
          <p className="mt-2 font-display text-xl text-snow">Dashboard</p>
          <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</p>
          {repos.map((repo) => (
            <div key={repo.id} className="mt-3 rounded-xl border border-white/8 bg-inset px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-sm text-snow">{repo.full_name}</p>
                <Badge variant="muted">private</Badge>
              </div>
              <p className="mt-1 text-xs text-dim">Last check 2 minutes ago</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</p>
          {alerts.map((alert) => (
            <div key={alert.id} className="mt-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-3">
              <Badge variant="critical">Went public</Badge>
              <p className="mt-2 text-sm text-snow">{alert.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-dim">{alert.body}</p>
            </div>
          ))}
        </div>
      </div>
    </a>
  )
}
