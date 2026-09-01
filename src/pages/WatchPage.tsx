import { CoverageLock } from "@/components/CoverageLock.tsx"
import { EmptyState } from "@/components/EmptyState.tsx"
import { LoggedInLook } from "@/components/LoggedInLook.tsx"
import { PageHeader } from "@/components/PageHeader.tsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { coverageFromQuery, type Coverage } from "@/coverage.ts"
import { navigate } from "@/nav.ts"
import { PREVIEW_INSTALLATIONS, PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts"
import type { Finding } from "@/report-types"
import { GithubMark } from "@/components/GithubMark.tsx"
import { useCallback, useEffect, useState } from "react"

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
      <main className="flex min-h-[70svh] items-center justify-center px-5">
        <p className="text-sm text-dim">Checking GitHub session…</p>
      </main>
    )
  }

  if (me.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24">
        <p className="font-display text-3xl text-snow">Could not load the watch desk</p>
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
      <main className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <PageHeader
          kicker="Watch desk"
          title="Sign in so we can watch for you."
          description="Install the GitHub App, then we alarm on visibility changes and scan Release packs. Coverage is Solo $29 or Team $99 after a 14-day trial."
          actions={
            <>
              <Button as="a" href="/api/auth/github" size="lg">
                <GithubMark />
                Sign in with GitHub
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => navigate("/watch?as=trial")}>
                Preview the desk
              </Button>
            </>
          }
        />
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

  return (
    <main className="fade-up mx-auto max-w-6xl px-5 py-10 md:py-14">
      {previewing ? <LoggedInLook current={ended ? "ended" : "trial"} /> : null}

      <PageHeader
        kicker={login}
        title="Watch desk"
        description={
          ended
            ? "Coverage ended. The bot is quiet until you subscribe."
            : watching.length > 0
              ? `Watching ${watching.join(", ")}. Hosted pack scans are on${coverage?.status === "trial" ? " for this trial" : ""}.`
              : "No installs linked yet. Install on GitHub, then publish a Release with a pack attached."
        }
        actions={
          <>
            {coverage && (
              <Badge variant={ended ? "ended" : "live"}>{coverage.label}</Badge>
            )}
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
          </>
        }
      />

      <div className="relative mt-12 grid min-h-72 gap-6 lg:grid-cols-2">
        {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
        <section className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</h2>
          {!previewing && repos.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {!previewing && repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
          {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
            <EmptyState
              className="mt-4"
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
          )}
          {deskRepos.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {deskRepos.map((repo) => (
                <li key={repo.id}>
                  <Card className="border-white/10 bg-panel/70">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a
                          href={repo.html_url}
                          className="font-mono text-sm text-snow underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {repo.full_name}
                        </a>
                        <Badge variant={repo.private ? "muted" : "warn"}>
                          {repo.private ? "private" : "public"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-dim">
                        Last check{" "}
                        {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-4"
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
                        {scanningId === repo.id ? "Queuing…" : "Scan latest release"}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          {scanError && <p className="mt-4 text-sm text-danger">{scanError}</p>}
        </section>

        <section className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</h2>
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
            <ul className="mt-4 flex max-h-[36rem] flex-col gap-3 overflow-auto pr-1">
              {deskAlerts.map((alert) => {
                const badge = kindBadge(alert.kind)
                return (
                  <li key={alert.id}>
                    <Card className="border-white/10 bg-panel/70">
                      <CardContent className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span className="text-xs text-dim">{new Date(alert.created_at).toLocaleString()}</span>
                        </div>
                        <p className="mt-3 text-sm text-snow">{alert.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-dim">{alert.body}</p>
                        {Array.isArray(alert.findings) && alert.findings.length > 0 && (
                          <ul className="mt-3 flex flex-col gap-1">
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
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
