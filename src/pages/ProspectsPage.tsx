import { Field, Input, Label, Textarea } from "@headlessui/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DisclosureCasePanel,
  type DisclosureSummary,
  type DncMatch,
  type DuplicateMatch,
} from "@/pages/DisclosureCasePanel.tsx"
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
  workspace_members: string[]
  error: string | null
  discovered_at: string
  scanned_at: string | null
  disclosure: DisclosureSummary | null
}

type InternalNotice = {
  id: number
  kind: "verified_critical" | "deadline_missed"
  prospectId: number
  title: string
  rules: string[]
  readAt: string | null
}

type DeskCampaign = {
  id: number
  name: string
  query: string
  enabled: boolean
  lastRanAt: string | null
  lastQueued: number | null
}
type DeskTemplate = { id: number; name: string; subject: string; body: string }
type DeskDnc = {
  id: number
  owner: string | null
  repo: string | null
  packageName: string | null
  contact: string | null
  reason: string
}

type ProspectData = {
  prospects: Prospect[]
  stats: { total: number; actionable: number; queued: number; contacted: number }
  campaigns?: DeskCampaign[]
  notifications?: {
    unread: number
    items: InternalNotice[]
  }
  policy: {
    publicArtifactsOnly: boolean
    sourceRetained: boolean
    outreachAutomatic: boolean
    disclosureSend: boolean
    criticalNotifyUnverified: boolean
    doNotContactEnforced?: boolean
    deadlineRemindInternal?: boolean
    campaignsConfigurable?: boolean
  }
}

type OwnerQueueHealth = {
  customer: { queued: number; running: number; failed: number }
  prospect: { queued: number; running: number; failed: number }
  heavyQueued: number
  lightQueued: number
  staleRunning: number
  oldestQueuedAgeMs: number | null
  usage: {
    customerHeavyToday: number
    installsWarning: number
    installsExhausted: number
  }
}

function formatQueueAge(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "none"
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${Math.round(ms / 3_600_000)}h`
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
  const [campaignName, setCampaignName] = useState("")
  const [repository, setRepository] = useState("")
  const [working, setWorking] = useState<"discover" | "repository" | "feed" | "campaign" | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [queue, setQueue] = useState<OwnerQueueHealth | null>(null)
  const [templates, setTemplates] = useState<DeskTemplate[]>([])
  const [dncEntries, setDncEntries] = useState<DeskDnc[]>([])
  const [templateName, setTemplateName] = useState("")
  const [templateSubject, setTemplateSubject] = useState("")
  const [templateBody, setTemplateBody] = useState("")
  const [dncOwner, setDncOwner] = useState("")
  const [dncRepo, setDncRepo] = useState("")
  const [dncPackage, setDncPackage] = useState("")
  const [dncContact, setDncContact] = useState("")
  const [dncReason, setDncReason] = useState("")

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
        duplicates?: DuplicateMatch[]
        dnc?: DncMatch[]
      }
      if (response.status === 401) {
        setState({
          status: "unauthorized",
          login: body.githubLogin,
          tokenConfigured: body.tokenConfigured,
        })
        throw new Error(body.error ?? "Admin access required.")
      }
      if (!response.ok) {
        const failed = new Error(body.error ?? `Request failed (${response.status}).`) as Error & {
          duplicates?: DuplicateMatch[]
          dnc?: DncMatch[]
        }
        failed.duplicates = body.duplicates
        failed.dnc = body.dnc
        throw failed
      }
      return body
    },
    [token],
  )

  const load = useCallback(async () => {
    try {
      const data = await request<ProspectData>("/api/internal/prospects")
      setState({ status: "ready", data })
      try {
        setQueue(await request<OwnerQueueHealth>("/api/internal/queue"))
      } catch {
        setQueue(null)
      }
      try {
        const [templateBody, dncBody] = await Promise.all([
          request<{ templates: DeskTemplate[] }>("/api/internal/disclosure/templates"),
          request<{ entries: DeskDnc[] }>("/api/internal/disclosure/do-not-contact"),
        ])
        setTemplates(templateBody.templates)
        setDncEntries(dncBody.entries)
      } catch {
        setTemplates([])
        setDncEntries([])
      }
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
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
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

  async function checkNpmFeed() {
    setWorking("feed")
    setNotice(null)
    try {
      const result = await request<{
        checked: number
        queued: number
        skipped?: "customer_busy" | "prospect_queue"
      }>("/api/internal/prospects/feed", { method: "POST" })
      if (result.skipped === "customer_busy") {
        setNotice("Skipped npm feed. Customer jobs are running or queued.")
      } else if (result.skipped === "prospect_queue") {
        setNotice("Skipped npm feed. Prospect queue is already at the cap.")
      } else {
        setNotice(`Checked ${result.checked} npm leads · queued ${result.queued} new versions.`)
      }
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "npm feed failed.")
    } finally {
      setWorking(null)
    }
  }

  async function saveCampaign() {
    setWorking("campaign")
    setNotice(null)
    try {
      await request("/api/internal/prospects/campaigns", {
        method: "POST",
        body: JSON.stringify({ name: campaignName, query, confirm: query }),
      })
      setCampaignName("")
      setNotice("Saved a discovery campaign. The hourly poller rotates one enabled campaign after customer work.")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save that campaign.")
    } finally {
      setWorking(null)
    }
  }

  async function setCampaignEnabled(campaign: DeskCampaign, enabled: boolean) {
    setWorking("campaign")
    setNotice(null)
    try {
      await request(`/api/internal/prospects/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      })
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update that campaign.")
    } finally {
      setWorking(null)
    }
  }

  async function removeCampaign(campaign: DeskCampaign) {
    setWorking("campaign")
    setNotice(null)
    try {
      await request(`/api/internal/prospects/campaigns/${campaign.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: campaign.query }),
      })
      setNotice("Removed that discovery campaign.")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove that campaign.")
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

  async function markNoticeRead(id: number) {
    try {
      await request(`/api/internal/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      })
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not mark notification read.")
    }
  }

  async function saveTemplate() {
    setNotice(null)
    try {
      await request("/api/internal/disclosure/templates", {
        method: "POST",
        body: JSON.stringify({
          name: templateName,
          subject: templateSubject,
          body: templateBody,
        }),
      })
      setTemplateName("")
      setTemplateSubject("")
      setTemplateBody("")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the template.")
    }
  }

  async function saveDnc() {
    setNotice(null)
    try {
      await request("/api/internal/disclosure/do-not-contact", {
        method: "POST",
        body: JSON.stringify({
          owner: dncOwner || undefined,
          repo: dncRepo || undefined,
          packageName: dncPackage || undefined,
          contact: dncContact || undefined,
          reason: dncReason,
        }),
      })
      setDncOwner("")
      setDncRepo("")
      setDncPackage("")
      setDncContact("")
      setDncReason("")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save do-not-contact.")
    }
  }

  async function removeDnc(id: number) {
    setNotice(null)
    try {
      await request(`/api/internal/disclosure/do-not-contact/${id}`, { method: "DELETE" })
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove do-not-contact.")
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
            Find public release packs with real findings. Inspect also lists public npm workspace
            members from the repo workspace config (cap 8) and never auto-watches them. The hourly
            poller, after customer work, checks known npm leads for a new latest and can run one
            saved campaign (or the default search) for three public repos when a discovery token
            is set. Customer jobs stay first. No source
            or secret values are retained. Disclosure Desk verifies a finding, previews a draft,
            records a simulated acknowledgement, and enforces do-not-contact. Missed
            deadlines stay as internal reminders. Nothing is sent or publicly named.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          <RefreshCw className="size-3.5" aria-hidden />
          Refresh
        </Button>
      </div>

      {data.notifications?.items.length ? (
        <section className="mt-10 rounded-lg border border-white/10 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-dim">
              Internal notifications
            </h2>
            <p className="text-xs text-dim">
              {data.notifications.unread} unread · never mailed · never unverified
            </p>
          </div>
          <ul className="mt-4 divide-y divide-white/8">
            {data.notifications.items.map((notice) => (
              <li key={notice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-snow">{notice.title}</p>
                  <p className="mt-1 font-mono text-xs text-dim">
                    {notice.kind === "deadline_missed"
                      ? "deadline missed"
                      : notice.rules.join(" · ") || "critical fingerprints"}
                    {notice.readAt ? " · read" : " · unread"}
                  </p>
                </div>
                {!notice.readAt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void markNoticeRead(notice.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {queue ? (
        <section className="mt-10 rounded-lg border border-white/10 p-5">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-dim">Global queue</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Counts only. Payloads, tenant names, and credential values are not listed. Prospect
            scans stay behind customer unpacks.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/8 sm:grid-cols-4">
            {[
              ["Customer queued", queue.customer.queued],
              ["Customer running", queue.customer.running],
              ["Customer failed", queue.customer.failed],
              ["Oldest wait", formatQueueAge(queue.oldestQueuedAgeMs)],
              ["Prospect queued", queue.prospect.queued],
              ["Prospect running", queue.prospect.running],
              ["Heavy waiting", queue.heavyQueued],
              ["Stale locks", queue.staleRunning],
            ].map(([label, value]) => (
              <div key={label} className="bg-panel px-4 py-5">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-dim">{label}</dt>
                <dd className="mt-2 font-display text-2xl text-snow">{value}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-white/8 sm:grid-cols-3">
            {[
              ["Customer unpacks today", queue.usage.customerHeavyToday],
              ["Installs at warning", queue.usage.installsWarning],
              ["Installs at cap", queue.usage.installsExhausted],
            ].map(([label, value]) => (
              <div key={label} className="bg-panel px-4 py-5">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-dim">{label}</dt>
                <dd className="mt-2 font-display text-2xl text-snow">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

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
          <Field className="mt-3">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">Save as campaign</Label>
            <Input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="name"
              className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
          </Field>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-dim">
              Run now checks five public repos. Saving stores the query for the hourly three-repo
              rotation. Type the query to confirm.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(working) || !campaignName.trim() || !query.trim()}
                onClick={() => void saveCampaign()}
              >
                {working === "campaign" ? "Saving…" : "Save campaign"}
              </Button>
              <Button type="submit" disabled={Boolean(working)}>
                <Search className="size-3.5" aria-hidden />
                {working === "discover" ? "Checking…" : "Run discovery"}
              </Button>
            </div>
          </div>
          {(data.campaigns ?? []).length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-white/8 pt-4">
              {(data.campaigns ?? []).map((campaign) => (
                <li key={campaign.id} className="flex items-start justify-between gap-3 text-xs text-mute">
                  <span>
                    <span className="text-snow">{campaign.name}</span>
                    <span className="mt-1 block font-mono text-dim">{campaign.query}</span>
                    <span className="mt-1 block text-dim">
                      {campaign.enabled ? "enabled" : "paused"}
                      {campaign.lastRanAt ? ` · last run queued ${campaign.lastQueued ?? 0}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(working)}
                      onClick={() => void setCampaignEnabled(campaign, !campaign.enabled)}
                    >
                      {campaign.enabled ? "Pause" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(working)}
                      onClick={() => void removeCampaign(campaign)}
                    >
                      Remove
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
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
            <p className="text-xs text-dim">
              Release packs, the root npm package, and up to eight public workspace members.
            </p>
            <Button type="submit" variant="outline" disabled={!repository.trim() || Boolean(working)}>
              {working === "repository" ? "Checking…" : "Inspect repo"}
            </Button>
          </div>
        </form>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={Boolean(working)}
          onClick={() => void checkNpmFeed()}
        >
          {working === "feed" ? "Checking…" : "Check npm versions"}
        </Button>
        <p className="text-xs text-dim">
          Metadata only. New latest tarballs queue behind customer jobs. Ignored and fixed leads
          are skipped.
        </p>
      </div>

      {notice && <p className="mt-4 text-sm text-mute">{notice}</p>}

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Disclosure templates</p>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            Placeholders: {"{{coordinate}}"} {"{{package}}"} {"{{fingerprints}}"} {"{{channel}}"}.
            Preview still never sends.
          </p>
          {templates.length > 0 ? (
            <ul className="mt-3 space-y-1 font-mono text-xs text-dim">
              {templates.map((template) => (
                <li key={template.id}>{template.name}</li>
              ))}
            </ul>
          ) : null}
          <Field className="mt-4">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">Name</Label>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
            />
          </Field>
          <Field className="mt-3">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">Subject</Label>
            <Input
              value={templateSubject}
              onChange={(event) => setTemplateSubject(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none data-focus:border-white/40"
            />
          </Field>
          <Field className="mt-3">
            <Label className="text-[11px] uppercase tracking-[0.2em] text-dim">Body</Label>
            <Textarea
              value={templateBody}
              onChange={(event) => setTemplateBody(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-snow outline-none data-focus:border-white/40"
            />
          </Field>
          <Button type="button" size="sm" className="mt-4" onClick={() => void saveTemplate()}>
            Save template
          </Button>
        </div>
        <div className="rounded-lg border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Do not contact</p>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            Owner/repo, package, or contact. Always blocks <span className="text-snow">contacted</span>.
            Research-only cases may still be opened.
          </p>
          {dncEntries.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {dncEntries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-xs text-mute">
                  <span>
                    {[
                      entry.owner && entry.repo ? `${entry.owner}/${entry.repo}` : null,
                      entry.packageName,
                      entry.contact,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    <span className="mt-1 block text-dim">{entry.reason}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeDnc(entry.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              value={dncOwner}
              onChange={(event) => setDncOwner(event.target.value)}
              placeholder="owner"
              className="h-10 rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
            <Input
              value={dncRepo}
              onChange={(event) => setDncRepo(event.target.value)}
              placeholder="repo"
              className="h-10 rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
            <Input
              value={dncPackage}
              onChange={(event) => setDncPackage(event.target.value)}
              placeholder="package"
              className="h-10 rounded-md border border-white/15 bg-transparent px-3 font-mono text-xs text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
            <Input
              value={dncContact}
              onChange={(event) => setDncContact(event.target.value)}
              placeholder="contact"
              className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-xs text-snow outline-none placeholder:text-dim data-focus:border-white/40"
            />
          </div>
          <Input
            value={dncReason}
            onChange={(event) => setDncReason(event.target.value)}
            placeholder="reason"
            className="mt-3 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim data-focus:border-white/40"
          />
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => void saveDnc()}>
            Add do-not-contact
          </Button>
        </div>
      </section>

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
                        <Badge variant={prospect.critical_count ? "critical" : "clean"}>
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
                      {prospect.workspace_members?.length ? (
                        <p className="mt-2 font-mono text-xs text-dim">
                          Workspace members · {prospect.workspace_members.join(", ")} · not
                          auto-watched
                        </p>
                      ) : null}
                      {prospect.error && <p className="mt-3 text-sm text-danger">{prospect.error}</p>}
                      <DisclosureCasePanel
                        prospectId={prospect.id}
                        summary={prospect.disclosure}
                        request={request}
                        token={token}
                        onChanged={load}
                      />
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
