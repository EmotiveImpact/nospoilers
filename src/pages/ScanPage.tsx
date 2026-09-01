import { Button as HeadlessButton, Description, Field, Label } from "@headlessui/react"
import { CoverageLock } from "@/components/CoverageLock.tsx"
import { LoggedInLook } from "@/components/LoggedInLook.tsx"
import { PageHeader } from "@/components/PageHeader.tsx"
import { Badge } from "@/components/ui/badge"
import { coverageFromQuery, type Coverage } from "@/coverage.ts"
import { cn } from "@/lib/utils"
import type { Finding, ScanReport } from "@/report-types"
import { ChevronRight, Loader2, Upload } from "lucide-react"
import { useCallback, useEffect, useId, useState, type DragEvent, type ReactNode } from "react"

type ViewState =
  | { status: "idle" }
  | { status: "loading"; label: string }
  | { status: "error"; message: string }
  | { status: "done"; report: ScanReport; label: string }

const EXAMPLES = [
  {
    path: "fixtures/clean.tgz",
    label: "Clean npm pack",
    hint: "Should pass",
  },
  {
    path: "fixtures/sourcemap.tgz",
    label: "Pack with a source map",
    hint: "The Claude Code class of leak",
  },
  {
    path: "fixtures/sourcemap.asar",
    label: "Electron asar with a map",
    hint: "What installers actually ship",
  },
  {
    path: "fixtures/sourcemap.zip",
    label: "Zip with a source map",
    hint: "Same leak, zip wrapper",
  },
  {
    path: "fixtures/dotenv.tgz",
    label: "Pack with a .env",
    hint: "Should fail",
  },
] as const

async function scanPath(path: string): Promise<ScanReport> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  })
  const body = (await response.json()) as ScanReport | { error?: string }
  if (!response.ok) {
    throw new Error(
      response.status === 402
        ? "Coverage ended. Subscribe to unpack on our servers."
        : "error" in body && body.error
          ? body.error
          : "Scan failed.",
    )
  }
  return body as ScanReport
}

async function scanFile(file: File): Promise<ScanReport> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "X-Filename": file.name },
    body: file,
  })
  const body = (await response.json()) as ScanReport | { error?: string }
  if (!response.ok) {
    throw new Error(
      response.status === 402
        ? "Coverage ended. Subscribe to unpack on our servers."
        : "error" in body && body.error
          ? body.error
          : "Scan failed.",
    )
  }
  return body as ScanReport
}

function severityVariant(severity: Finding["severity"]): "critical" | "warn" {
  return severity === "critical" ? "critical" : "warn"
}

export function ScanPage({ search }: { search: string }) {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<ViewState>({ status: "idle" })
  const [session, setSession] = useState<{ login: string; coverage: Coverage } | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as { user?: { login: string } | null; coverage?: Coverage }
        if (cancelled) return
        if (body.user && body.coverage) setSession({ login: body.user.login, coverage: body.coverage })
        else setSession(null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [search])

  const queryCoverage = coverageFromQuery(search)
  const coverage = session?.coverage ?? queryCoverage
  const locked = coverage?.status === "ended"
  const previewing = !session && Boolean(queryCoverage)

  const run = useCallback(async (label: string, job: () => Promise<ScanReport>) => {
    setState({ status: "loading", label })
    try {
      const report = await job()
      setState({ status: "done", report, label })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Scan failed.",
      })
    }
  }, [])

  const onFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0]
      if (!file || locked) return
      void run(file.name, () => scanFile(file))
    },
    [locked, run],
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {previewing ? <LoggedInLook current={locked ? "ended" : "trial"} /> : null}

      <PageHeader
        kicker={session || previewing ? "Hosted pack gate" : "Pack gate"}
        title="Don’t ship the ending."
        description={
          locked
            ? "Logged in, trial over. We still show the drop zone so you remember what you lost. We do not unpack on our machines until a plan is active."
            : "Drop the tarball, zip, or Electron asar customers download. This is the same scanner the Release webhook uses — here you can try it by hand."
        }
      />
      {(session || previewing) && coverage?.status === "trial" ? (
        <p className="mt-3 text-sm text-dim">Hosted scan is on for this trial.</p>
      ) : null}

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-10">
        <div>
          <div className="relative min-h-56">
            {locked && <CoverageLock variant="scan" title="Subscribe to unpack here." />}
            <Field>
              <Label
                htmlFor={locked ? undefined : inputId}
                onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault()
                  if (!locked) setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault()
                  setDragOver(false)
                  if (!locked) onFiles(event.dataTransfer.files)
                }}
                className={cn(
                  "flex min-h-56 flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dashed px-7 py-10 transition-colors",
                  locked ? "cursor-default border-white/15 opacity-40" : "cursor-pointer",
                  !locked && dragOver
                    ? "border-snow bg-white/[0.06]"
                    : !locked
                      ? "border-white/20 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.04]"
                      : "",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-inset">
                  <Upload className="h-4 w-4 text-mute" aria-hidden />
                </span>
                <p className="font-display text-xl text-snow">Drop a pack here</p>
                <Description className="text-sm text-dim">
                  .tgz, .zip, or .asar — or click to choose
                </Description>
                {!locked && (
                  <input
                    id={inputId}
                    type="file"
                    className="sr-only"
                    accept=".tgz,.tar,.gz,.zip,.asar,.tar.gz"
                    onChange={(event) => onFiles(event.target.files)}
                  />
                )}
              </Label>
            </Field>
          </div>

          <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-dim">
            {locked ? "Fixtures" : "Try a known leak"}
          </p>
          <ul className={cn("mt-3 flex flex-col gap-2", locked && "pointer-events-none opacity-40")}>
            {EXAMPLES.map((example) => (
              <li key={example.path}>
                <HeadlessButton
                  type="button"
                  disabled={locked}
                  className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition-colors data-hover:border-white/25 data-hover:bg-white/[0.07] data-active:bg-white/[0.1] data-disabled:cursor-default data-focus:outline-none data-focus:ring-1 data-focus:ring-snow/40"
                  onClick={() => {
                    if (locked) return
                    void run(example.label, () => scanPath(example.path))
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-snow">{example.label}</span>
                    <span className="mt-0.5 block text-xs text-dim">{example.hint}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-mute group-data-hover:text-snow">
                    Run
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </HeadlessButton>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:sticky lg:top-24">
          <ResultsPanel state={state} locked={locked} />
        </div>
      </div>

      {!locked && (
        <section className="mt-16 grid gap-4 border-t border-white/6 pt-12 md:grid-cols-3">
          <Step n="01" title="Pack as usual">
            Run <code className="text-mute">npm pack</code> or build the Electron asar. Scan that
            file, not the git tree.
          </Step>
          <Step n="02" title="Or fail the job">
            <code className="text-mute">npx nospoilers scan ./package.tgz</code> exits 1 if it finds
            spoilers. Use this when you publish to npm without a GitHub Release.
          </Step>
          <Step n="03" title="Keep the map private">
            Upload hidden source maps to Sentry. Do not put them in the installer.
          </Step>
        </section>
      )}
    </main>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{n}</p>
      <h2 className="mt-3 font-display text-lg text-snow">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-dim">{children}</p>
    </div>
  )
}

function ResultsPanel({ state, locked }: { state: ViewState; locked: boolean }) {
  if (locked && state.status === "idle") {
    return (
      <div className="flex min-h-56 flex-col justify-center rounded-2xl border border-white/8 bg-panel/70 px-6 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Report</p>
        <h2 className="mt-3 font-display text-2xl tracking-tight text-snow">No hosted scan yet.</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Local still works: <code className="text-snow">npx nospoilers scan ./package.tgz</code>{" "}
          exits 1 if it finds spoilers.
        </p>
      </div>
    )
  }

  if (state.status === "idle") {
    return (
      <div className="flex min-h-56 flex-col justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10">
        <p className="font-display text-xl text-snow">Waiting for a pack</p>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Drop a file or run a fixture. Empty is a good state.
        </p>
      </div>
    )
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-56 items-center gap-3 rounded-2xl border border-white/8 bg-panel/70 px-6 py-10">
        <Loader2 className="h-4 w-4 animate-spin text-snow" aria-hidden />
        <p className="text-sm text-mute">Reading {state.label}…</p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-danger/20 bg-danger/5 px-6 py-10">
        <p className="font-display text-lg text-snow">Could not scan</p>
        <p className="mt-2 text-sm text-mute">{state.message}</p>
      </div>
    )
  }

  const { report } = state
  const critical = report.findings.filter((f) => f.severity === "critical").length

  return (
    <div
      className={cn(
        "rounded-2xl border px-6 py-8",
        report.ok ? "border-ok/25 bg-ok/5" : "border-danger/25 bg-danger/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={report.ok ? "clean" : "critical"}>
          {report.ok ? "Allowed to ship" : `${critical} critical`}
        </Badge>
        <span className="text-xs text-dim">{report.fileCount} files</span>
      </div>
      <h2 className="mt-4 font-display text-2xl tracking-tight text-snow">
        {report.ok ? "Clean pack" : "Spoilers in the pack"}
      </h2>
      <p className="mt-1 text-sm text-dim">
        {state.label} · {report.kind}
      </p>
      {report.findings.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          No source maps, no embedded original source, no env files, no keys, no .git.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/8">
          {report.findings.map((finding) => (
            <li key={`${finding.rule}-${finding.path}-${finding.title}`} className="py-4 first:pt-0">
              <div className="flex items-center gap-2">
                <Badge variant={severityVariant(finding.severity)}>{finding.rule}</Badge>
                <span className="truncate font-mono text-xs text-dim">{finding.path}</span>
              </div>
              <p className="mt-2 text-sm text-snow">{finding.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-dim">{finding.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
