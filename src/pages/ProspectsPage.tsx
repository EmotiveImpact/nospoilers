import { Field, Input, Label } from "@headlessui/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Finding } from "@/report-types"
import { ExternalLink, RefreshCw, Search, ShieldAlert } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

type ProspectStatus = "new" | "contacted" | "fixed" | "ignored"
type ScanStatus = "queued" | "scanning" | "complete" | "failed"

type Prospect = {
  id: number
  source: "github_release" | "npm"
  owner: string
  repo: string
  repository_url: string
  package_name: string | null
  release_tag: string | null
  artifact_name: string
  artifact_url: string
  artifact_bytes: number | null
  status: ProspectStatus
  scan_status: ScanStatus
  file_count: number | null
  critical_count: number | null
  warning_count: number | null
  findings: Finding[] | null
  error: string | null
  discovered_at: string
  scanned_at: string | null
}

type ProspectData = {
  prospects: Prospect[]
  stats: { total: number; actionable: number; queued: number; contacted: number }
  policy: {
    publicArtifactsOnly: boolean
    sourceRetained: boolean
    outreachAutomatic: boolean
  }
}

type LoadState =
  | { status: "loading" }
  | { status: "unauthorized"; login?: string; tokenConfigured?: boolean }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProspectData }

const DEFAULT_QUERY =
  "topic:electron fork:false archived:false stars:10..5000 pushed:>2026-01-01"

function formatBytes(value: number | null): string {
  if (!value) return ""
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function ProspectsPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem("nospoilers-admin-token") ?? "")
  const [draftToken, setDraftToken] = useState(token)
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [repository, setRepository] = useState("")
  const [working, setWorking] = useState<"discover" | "repository" | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const request = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })
      const body = (await response.json()) as T & {
        error?: string
        githubLogin?: string
        tokenConfigured?: boolean
      }
      if (response.status === 401) {
        setState({
          status: "unauthorized",
          login: body.githubLogin,
          tokenConfigured: body.tokenConfigured,
        })
        throw new Error(body.error ?? "Admin access required.")
      }
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`)
      return body
    },
    [token],
  )

  const load = useCallback(async () => {
    try {
      const data = await request<ProspectData>("/api/internal/prospects")
      setState({ status: "ready", data })
    } catch (error) {
      setState((current) =>
        current.status === "unauthorized"
          ? current
          : {
              status: "error",
              message: error instanceof Error ? error.message : "Could not load Artifact Leads.",
            },
      )
    }
  }, [request])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (state.status !== "ready" || state.data.stats.queued === 0) return
    const timer = window.setTimeout(() => void load(), 1500)
    return () => window.clearTimeout(timer)
  }, [load, state])

  async function runDiscovery() {
    setWorking("discover")
    setNotice(null)
    try {
      const result = await request<{
        repositories: number
        found: number
        queued: number
        existing: number
        errors: string[]
      }>("/api/internal/prospects/discover", {
        method: "POST",
        body: JSON.stringify({ query, limit: 5 }),
      })
      setNotice(
        `Checked ${result.repositories} repos · found ${result.found} artifacts · queued ${result.queued}.`,
      )
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Discovery failed.")
    } finally {
      setWorking(null)
    }
  }

  async function inspectRepository() {
    setWorking("repository")
    setNotice(null)
    try {
      const result = await request<{ found: number; queued: number; existing: number }>(
        "/api/internal/prospects/repository",
        {
          method: "POST",
          body: JSON.stringify({ repository }),
        },
      )
      setNotice(
        `Found ${result.found} public artifacts · queued ${result.queued} · already known ${result.existing}.`,
      )
      setRepository("")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Repository inspection failed.")
    } finally {
      setWorking(null)
    }
  }

  async function updateStatus(id: number, status: ProspectStatus) {
    try {
      await request(`/api/internal/prospects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update lead.")
    }
  }

  async function rescan(id: number) {
    try {
      await request(`/api/internal/prospects/${id}/rescan`, { method: "POST" })
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not queue scan.")
    }
  }

  if (state.status === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-5 py-20">
        <p className="text-sm text-dim">Opening Artifact Leads…</p>
      </main>
    )
  }

  if (state.status === "unauthorized") {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <p className="text-[11px] uppercase tracking-[0.28em] text-danger">Internal</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight text-snow">Artifact Leads</h1>
        <p className="mt-4 text-sm leading-relaxed text-mute">
          Sign in as <span className="text-snow">{state.login ?? "the configured admin"}</span>, or
          enter the internal token. The token stays in this browser session.
        </p>
        <Field className="mt-8">
          <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">Admin token</Label>
          <Input
            type="password"
            value={draftToken}
            onChange={(event) => setDraftToken(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              sessionStorage.setItem("nospoilers-admin-token", draftToken)
              setToken(draftToken)
              setState({ status: "loading" })
            }}
          >
            Open internal desk
          </Button>
          <Button as="a" href="/api/auth/github" variant="outline">
            Log in with GitHub
          </Button>
        </div>
        {!state.tokenConfigured && (
          <p className="mt-5 text-xs leading-relaxed text-dim">
            No server token is configured yet. Set <code className="text-mute">ADMIN_TOKEN</code> in{" "}
            <code className="text-mute">.env</code> and restart.
          </p>
        )}
      </main>
    )
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto max-w-xl px-5 py-20">
        <h1 className="font-display text-3xl text-snow">Artifact Leads could not load</h1>
        <p className="mt-3 text-sm text-danger">{state.message}</p>
        <Button type="button" variant="outline" className="mt-6" onClick={() => void load()}>
          Try again
        </Button>
      </main>
    )
  }

  const { data } = state
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <p className="text-[11px] uppercase tracking-[0.28em] text-danger">Internal · public artifacts only</p>
      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-snow md:text-5xl">Artifact Leads</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
            Find public release packs with real findings. No source or secret values are retained.
            Nothing contacts or publicly names a maintainer for you.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-3.5" aria-hidden />
          Refresh
        </Button>
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/8 sm:grid-cols-4">
        {[
          ["Artifacts", data.stats.total],
          ["Actionable", data.stats.actionable],
          ["Scanning", data.stats.queued],
          ["Contacted", data.stats.contacted],
        ].map(([label, value]) => (
          <div key={label} className="bg-panel px-4 py-5">
            <dt className="text-[11px] uppercase tracking-[0.18em] text-dim">{label}</dt>
            <dd className="mt-2 font-display text-2xl text-snow">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-lg border border-white/10 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void runDiscovery()
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Discover from GitHub</p>
          <Field className="mt-4">
            <Label className="sr-only">GitHub repository search</Label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none data-focus:border-white/40"
            />
          </Field>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-dim">Checks five recently updated public repositories.</p>
            <Button type="submit" disabled={Boolean(working)}>
              <Search className="size-3.5" aria-hidden />
              {working === "discover" ? "Checking…" : "Run discovery"}
            </Button>
          </div>
        </form>

        <form
          className="rounded-lg border border-white/10 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void inspectRepository()
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Inspect one repository</p>
          <Field className="mt-4">
            <Label className="sr-only">GitHub repository</Label>
            <Input
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="owner/repository"
              className="h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
          </Field>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs text-dim">Release packs plus its root npm package.</p>
            <Button type="submit" variant="outline" disabled={!repository.trim() || Boolean(working)}>
              {working === "repository" ? "Checking…" : "Inspect repo"}
            </Button>
          </div>
        </form>
      </section>

      {notice && <p className="mt-4 text-sm text-mute">{notice}</p>}

      <section className="mt-14">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Private outreach queue</h2>
          <p className="text-xs text-dim">Critical findings first</p>
        </div>
        {data.prospects.length === 0 ? (
          <div className="mt-4 rounded-lg border border-white/10 px-5 py-12">
            <ShieldAlert className="size-5 text-dim" aria-hidden />
            <p className="mt-4 text-sm text-snow">No artifacts inspected yet.</p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-dim">
              Run discovery or inspect a repository. Results here always come from real public
              artifacts.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/8 border-y border-white/8">
            {data.prospects.map((prospect) => {
              const findings = Array.isArray(prospect.findings) ? prospect.findings : []
              return (
                <li key={prospect.id} className="py-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={prospect.critical_count ? "critical" : "default"}>
                          {prospect.scan_status === "complete"
                            ? `${prospect.critical_count ?? 0} critical`
                            : prospect.scan_status}
                        </Badge>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                          {prospect.source === "npm" ? "npm" : "GitHub Release"}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                          {prospect.status}
                        </span>
                      </div>
                      <a
                        href={prospect.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 font-mono text-sm text-snow underline-offset-4 hover:underline"
                      >
                        {prospect.owner}/{prospect.repo}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                      <p className="mt-1 truncate font-mono text-xs text-mute">
                        {prospect.package_name ?? prospect.artifact_name}
                        {prospect.release_tag ? ` · ${prospect.release_tag}` : ""}
                        {prospect.artifact_bytes ? ` · ${formatBytes(prospect.artifact_bytes)}` : ""}
                      </p>
                      {prospect.error && <p className="mt-3 text-sm text-danger">{prospect.error}</p>}
                      {findings.length > 0 && (
                        <ul className="mt-4 flex max-w-2xl flex-col gap-1.5">
                          {findings.slice(0, 8).map((finding) => (
                            <li
                              key={`${finding.rule}-${finding.path}`}
                              className="flex min-w-0 items-baseline gap-2 font-mono text-xs"
                            >
                              <span
                                className={
                                  finding.severity === "critical" ? "text-danger" : "text-dim"
                                }
                              >
                                {finding.rule}
                              </span>
                              <span className="truncate text-mute">{finding.path}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {(["new", "contacted", "fixed", "ignored"] as const).map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={prospect.status === status ? "default" : "outline"}
                          onClick={() => void updateStatus(prospect.id, status)}
                        >
                          {status[0]?.toUpperCase()}
                          {status.slice(1)}
                        </Button>
                      ))}
                      {prospect.scan_status === "failed" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void rescan(prospect.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
