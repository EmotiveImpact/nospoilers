import { CoverageLock } from "@/components/CoverageLock.tsx"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Coverage } from "@/coverage.ts"
import type { Finding } from "@/report-types"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type Repo = {
  id: number
  full_name: string
  private: boolean
  html_url: string
  last_checked_at: string | null
}

type Alert = {
  id: number
  kind: string
  title: string
  body: string
  findings: Finding[] | null
  created_at: string
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "repo_publicized":
      return "Went public"
    case "repo_created_public":
      return "Created public"
    case "repo_transferred":
      return "Transferred"
    case "member_added":
      return "Collaborator"
    case "fork":
      return "Fork"
    case "release_scan":
    case "scan_latest_release":
      return "Release pack"
    case "push_sensitive_path":
      return "Path watch"
    default:
      return kind
  }
}

function isPackKind(kind: string): boolean {
  return kind === "release_scan" || kind === "scan_latest_release"
}

function isVisibilityKind(kind: string): boolean {
  return (
    kind === "repo_publicized" ||
    kind === "repo_created_public" ||
    kind === "repo_transferred" ||
    kind === "fork" ||
    kind === "member_added"
  )
}

export function AtlasDashboard({
  login,
  watching,
  coverage,
  ended,
  repos,
  alerts,
  reposLoading,
  reposError,
  alertsLoading,
  alertsError,
  scanError,
  scanningId,
  installUrl,
  onScan,
}: {
  login: string
  watching: string[]
  coverage?: Coverage
  ended: boolean
  repos: Repo[]
  alerts: Alert[]
  reposLoading: boolean
  reposError: string | null
  alertsLoading: boolean
  alertsError: string | null
  scanError: string | null
  scanningId: number | null
  installUrl?: string
  onScan: (repoId: number) => void
}) {
  const privateCount = repos.filter((repo) => repo.private).length
  const publicCount = repos.length - privateCount
  const packAlerts = alerts.filter((alert) => isPackKind(alert.kind)).length
  const visibilityAlerts = alerts.filter((alert) => isVisibilityKind(alert.kind)).length
  const otherAlerts = alerts.length - packAlerts - visibilityAlerts
  const dirtyPacks = alerts.filter(
    (alert) => isPackKind(alert.kind) && Array.isArray(alert.findings) && alert.findings.length > 0,
  ).length
  const latestCheck = repos
    .map((repo) => repo.last_checked_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  const mix = [
    { label: "Visibility", value: visibilityAlerts, color: "bg-red-400" },
    { label: "Release packs", value: packAlerts, color: "bg-emerald-400" },
    { label: "Other", value: otherAlerts, color: "bg-zinc-500" },
  ]
  const mixMax = Math.max(1, ...mix.map((row) => row.value))

  return (
    <main className="relative space-y-5 p-4 md:p-6">
      {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{login}</p>
          <h2 className="mt-1 text-xl font-medium tracking-tight text-white">Coverage desk</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {watching.length > 0 ? `Watching ${watching.join(", ")}` : "No GitHub install linked yet"}
          </p>
        </div>
        {installUrl ? (
          <Button as="a" href={installUrl} variant="outline">
            Install on GitHub
          </Button>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          kicker="Repos watched"
          label="Install surface"
          value={String(repos.length)}
          hint={`${privateCount} private · ${publicCount} public`}
        />
        <Kpi
          kicker="Alerts"
          label="Doors that fired"
          value={String(alerts.length)}
          hint={alerts.length === 0 ? "Quiet is the good state" : `${visibilityAlerts} visibility · ${packAlerts} packs`}
        />
        <Kpi
          kicker="Dirty packs"
          label="Release findings"
          value={String(dirtyPacks)}
          hint="Source maps / secrets in a Release asset"
        />
        <Kpi
          kicker="Last check"
          label="Visibility poll"
          value={latestCheck ? timeLabel(latestCheck) : "—"}
          hint={latestCheck ? new Date(latestCheck).toLocaleDateString() : "No poll yet"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Alert mix" subtitle="What actually fired">
          {alerts.length === 0 ? (
            <p className="text-sm text-zinc-500">No alerts yet. The mix fills in when GitHub pings us.</p>
          ) : (
            <ul className="space-y-4">
              {mix.map((row) => (
                <li key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{row.label}</span>
                    <span className="tabular-nums text-zinc-500">{row.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn("h-full rounded-full", row.color)}
                      style={{ width: `${(row.value / mixMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Coverage" subtitle={coverage?.label ?? "Status"}>
          <p className="font-display text-3xl tracking-tight text-white">
            {ended ? "Off" : coverage?.status === "trial" ? "Trial" : coverage?.plan === "team" ? "Team" : coverage?.plan === "solo" ? "Solo" : "On"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {ended
              ? "Jobs and alerts are paused until a plan is active."
              : "Visibility stays fast. Release packs unpack when you publish a .tgz, .zip, or .asar."}
          </p>
        </Panel>

        <Panel title="Active lanes" subtitle="Newest alerts">
          {alertsLoading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
          {alertsError ? <p className="text-sm text-red-400">{alertsError}</p> : null}
          {!alertsLoading && !alertsError && alerts.length === 0 ? (
            <p className="text-sm text-zinc-500">Empty queue. That is success.</p>
          ) : null}
          {!alertsLoading && alerts.length > 0 ? (
            <ul className="space-y-3">
              {alerts.slice(0, 4).map((alert, index) => (
                <li key={alert.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-zinc-500">
                      [{String(index).padStart(2, "0")}] {kindLabel(alert.kind)}
                    </p>
                    <p className="truncate text-sm text-zinc-200">{alert.title}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#12141a]">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <h3 className="text-sm font-medium text-white">Repositories</h3>
            <p className="text-xs text-zinc-500">Scan the latest GitHub Release pack on a row</p>
          </div>
        </div>
        {reposLoading ? <p className="px-5 py-8 text-sm text-zinc-500">Loading…</p> : null}
        {reposError ? <p className="px-5 py-8 text-sm text-red-400">{reposError}</p> : null}
        {!reposLoading && !reposError && repos.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-500">
            Nothing on this install yet. Install NoSpoilers on a GitHub repo, then publish a Release with a pack
            attached.
          </p>
        ) : null}
        {repos.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Repo</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Last check</TableHead>
                <TableHead className="text-right">Release pack</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repos.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <a
                      href={repo.html_url}
                      className="font-mono text-sm text-white underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {repo.full_name}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {repo.private ? "private" : "public"}
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500">
                    {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={scanningId === repo.id || ended}
                      onClick={() => onScan(repo.id)}
                    >
                      {scanningId === repo.id ? "Queuing…" : "Scan"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
        {scanError ? <p className="px-5 py-3 text-sm text-red-400">{scanError}</p> : null}
      </section>
    </main>
  )
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function Kpi({
  kicker,
  label,
  value,
  hint,
}: {
  kicker: string
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-[#12141a] p-5">
      <p className="text-sm text-zinc-400">{kicker}</p>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-4 font-display text-3xl tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </article>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-[#12141a] p-5">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </article>
  )
}
