import { CoverageLock } from "@/components/CoverageLock.tsx"
import { EmptyState } from "@/components/EmptyState.tsx"
import { GithubMark } from "@/components/GithubMark.tsx"
import { LoggedInLook } from "@/components/LoggedInLook.tsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { coverageFromQuery, type Coverage } from "@/coverage.ts"
import { navigate } from "@/nav.ts"
import { PREVIEW_INSTALLATIONS, PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts"
import type { Finding } from "@/report-types"
import { Bell, FolderGit, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useState, type ReactNode } from "react"

type Me = {
  user: { id: string; login: string; avatarUrl: string | null } | null
  coverage?: Coverage
  installations: { id: number; account_login: string; account_type: string }[]
  githubApp: boolean
  installUrl?: string
}

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
  full_name?: string | null
}

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T }

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" })
  const body = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  return body
}

function kindBadge(kind: string): { label: string; variant: "critical" | "warn" | "muted" | "live" } {
  switch (kind) {
    case "repo_publicized":
      return { label: "Went public", variant: "critical" }
    case "repo_created_public":
      return { label: "Created public", variant: "critical" }
    case "repo_transferred":
      return { label: "Transferred", variant: "warn" }
    case "member_added":
      return { label: "Collaborator", variant: "warn" }
    case "fork":
      return { label: "Fork", variant: "warn" }
    case "release_scan":
    case "scan_latest_release":
      return { label: "Release pack", variant: "live" }
    case "push_sensitive_path":
      return { label: "Path watch", variant: "warn" }
    default:
      return { label: kind, variant: "muted" }
  }
}

export function WatchPage({ search }: { search: string }) {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" })
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" })
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" })
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanningId, setScanningId] = useState<number | null>(null)

  const refreshSignedIn = useCallback(async () => {
    setRepos({ status: "loading" })
    setAlerts({ status: "loading" })
    try {
      const [repoBody, alertBody] = await Promise.all([
        loadJson<{ repos: Repo[] }>("/api/repos"),
        loadJson<{ alerts: Alert[] }>("/api/alerts"),
      ])
      setRepos({ status: "ready", data: repoBody })
      setAlerts({ status: "ready", data: alertBody })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load."
      setRepos({ status: "error", message })
      setAlerts({ status: "error", message })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const body = await loadJson<Me>("/api/me")
        if (cancelled) return
        setMe({ status: "ready", data: body })
        if (body.user) await refreshSignedIn()
        else {
          setRepos({ status: "ready", data: { repos: [] } })
          setAlerts({ status: "ready", data: { alerts: [] } })
        }
      } catch (error) {
        if (cancelled) return
        setMe({
          status: "error",
          message: error instanceof Error ? error.message : "Could not reach NoSpoilers.",
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshSignedIn])

  if (me.status === "loading") {
    return (
      <main className="flex min-h-[60svh] items-center justify-center px-5">
        <p className="text-sm text-dim">Checking GitHub session…</p>
      </main>
    )
  }

  if (me.status === "error") {
    return (
      <main className="px-6 py-16">
        <p className="font-display text-3xl text-snow">Could not load the dashboard</p>
        <p className="mt-3 text-mute">{me.message}</p>
      </main>
    )
  }

  const { user, githubApp, installUrl, installations, coverage: sessionCoverage } = me.data
  const queryCoverage = coverageFromQuery(search)
  const previewing = !user
  const coverage: Coverage | undefined = user
    ? sessionCoverage
    : (queryCoverage ?? coverageFromQuery("?as=trial") ?? undefined)

  if (!user && githubApp && !queryCoverage) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-dim">Dashboard</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-snow">Sign in to open the desk.</h1>
        <p className="mt-4 text-base leading-relaxed text-mute">
          This is the hosted product: visibility alarms and Release pack scans. Preview the layout
          first if you want.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button as="a" href="/api/auth/github" size="lg">
            <GithubMark />
            Sign in with GitHub
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => navigate("/watch?as=trial")}>
            Preview dashboard
          </Button>
        </div>
      </main>
    )
  }

  const ended = coverage?.status === "ended"
  const login = user?.login ?? PREVIEW_LOGIN
  const watching = user
    ? installations.map((row) => row.account_login)
    : PREVIEW_INSTALLATIONS.map((row) => row.account_login)
  const deskRepos = previewing ? previewRepos() : repos.status === "ready" ? repos.data.repos : []
  const deskAlerts = previewing ? previewAlerts() : alerts.status === "ready" ? alerts.data.alerts : []
  const privateCount = deskRepos.filter((repo) => repo.private).length
  const latestCheck = deskRepos
    .map((repo) => repo.last_checked_at)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <main className="fade-up px-4 py-6 md:px-6 md:py-8">
      {previewing ? <LoggedInLook current={ended ? "ended" : "trial"} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dim">{login}</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-snow">Dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-mute">
            {ended
              ? "Coverage ended. The bot is quiet until you subscribe."
              : watching.length > 0
                ? `Watching ${watching.join(", ")}.`
                : "Install on GitHub, then we watch repos and scan Release packs."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {installUrl && githubApp && user && (
            <Button as="a" href={installUrl}>
              Install on GitHub
            </Button>
          )}
          {ended && (
            <Button type="button" onClick={() => navigate("/pricing")}>
              Subscribe
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FolderGit className="h-4 w-4" aria-hidden />}
          label="Repos"
          value={String(deskRepos.length)}
          hint={watching.length ? watching.join(", ") : "No install yet"}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          label="Private"
          value={String(privateCount)}
          hint="Visibility door"
        />
        <StatCard
          icon={<Bell className="h-4 w-4" aria-hidden />}
          label="Alerts"
          value={String(deskAlerts.length)}
          hint={deskAlerts.length === 0 ? "Quiet is good" : "Newest first"}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          label="Last check"
          value={latestCheck ? new Date(latestCheck).toLocaleTimeString() : "—"}
          hint={latestCheck ? new Date(latestCheck).toLocaleDateString() : "No poll yet"}
        />
      </div>

      <div className="relative mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
        <Card className={ended ? "pointer-events-none border-white/10 bg-panel/70 opacity-25" : "border-white/10 bg-panel/70"}>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-display text-lg text-snow">Repositories</h2>
              <p className="text-xs text-dim">Scan the latest GitHub Release pack</p>
            </div>
            {!previewing && repos.status === "loading" && <p className="px-5 pb-6 text-sm text-dim">Loading…</p>}
            {!previewing && repos.status === "error" && (
              <p className="px-5 pb-6 text-sm text-danger">{repos.message}</p>
            )}
            {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
              <div className="px-5 pb-6">
                <EmptyState
                  title="Nothing on this install yet"
                  body="Install NoSpoilers on a GitHub repo. When that repo publishes a Release with a .tgz, .zip, or .asar, we scan it. If it goes public, we alert."
                  action={
                    installUrl && githubApp && user ? (
                      <Button as="a" href={installUrl}>
                        Install on GitHub
                      </Button>
                    ) : null
                  }
                />
              </div>
            )}
            {deskRepos.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repo</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Last check</TableHead>
                    <TableHead className="text-right">Pack</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deskRepos.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell>
                        <a
                          href={repo.html_url}
                          className="font-mono text-sm text-snow underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {repo.full_name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={repo.private ? "muted" : "warn"}>
                          {repo.private ? "private" : "public"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-dim">
                        {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={previewing || scanningId === repo.id || ended}
                          onClick={() => {
                            if (previewing) return
                            setScanError(null)
                            setScanningId(repo.id)
                            void (async () => {
                              try {
                                const response = await fetch(`/api/repos/${repo.id}/scan-latest-release`, {
                                  method: "POST",
                                  credentials: "include",
                                })
                                const body = (await response.json()) as { error?: string }
                                if (!response.ok) throw new Error(body.error ?? "Could not queue scan.")
                                await refreshSignedIn()
                              } catch (error) {
                                setScanError(error instanceof Error ? error.message : "Could not queue scan.")
                              } finally {
                                setScanningId(null)
                              }
                            })()
                          }}
                        >
                          {scanningId === repo.id ? "Queuing…" : "Scan release"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {scanError ? <p className="px-5 py-3 text-sm text-danger">{scanError}</p> : null}
          </CardContent>
        </Card>

        <Card className={ended ? "pointer-events-none border-white/10 bg-panel/70 opacity-25" : "border-white/10 bg-panel/70"}>
          <CardContent className="p-5">
            <h2 className="font-display text-lg text-snow">Activity</h2>
            {!previewing && alerts.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
            {!previewing && alerts.status === "error" && <p className="mt-6 text-sm text-danger">{alerts.message}</p>}
            {deskAlerts.length === 0 && (previewing || alerts.status === "ready") && (
              <EmptyState
                className="mt-4"
                title="Quiet so far"
                body="That is the good state — until a repo goes public or a Release ships a map."
              />
            )}
            {deskAlerts.length > 0 && (
              <ol className="mt-5 max-h-[32rem] space-y-0 overflow-auto">
                {deskAlerts.map((alert, index) => {
                  const badge = kindBadge(alert.kind)
                  return (
                    <li key={alert.id} className="relative flex gap-3 pb-6 last:pb-0">
                      {index < deskAlerts.length - 1 ? (
                        <span className="absolute top-5 left-[7px] h-[calc(100%-8px)] w-px bg-white/10" aria-hidden />
                      ) : null}
                      <span className="relative z-[1] mt-1 size-3.5 shrink-0 rounded-full border border-white/20 bg-inset" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span className="text-xs text-dim">{new Date(alert.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-sm text-snow">{alert.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-dim">{alert.body}</p>
                        {Array.isArray(alert.findings) && alert.findings.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {alert.findings.map((finding) => (
                              <li
                                key={`${alert.id}-${finding.rule}-${finding.path}`}
                                className="font-mono text-[11px] text-mute"
                              >
                                {finding.rule} · {finding.path}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="border-white/10 bg-panel/70">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-dim">
          <p className="text-[11px] uppercase tracking-[0.16em]">{label}</p>
          {icon}
        </div>
        <p className="mt-3 font-display text-2xl tracking-tight text-snow">{value}</p>
        <p className="mt-1 truncate text-xs text-dim">{hint}</p>
      </CardContent>
    </Card>
  )
}
