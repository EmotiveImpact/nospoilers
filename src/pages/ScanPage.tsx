import { Button as HeadlessButton, Description, Field, Label } from "@headlessui/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Finding, ScanReport } from "@/report-types"
import { ChevronRight, Loader2, Upload } from "lucide-react"
import { useCallback, useId, useState, type DragEvent, type ReactNode } from "react"

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
    hint: "The Grok / Claude class of leak",
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
    throw new Error("error" in body && body.error ? body.error : "Scan failed.")
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
    throw new Error("error" in body && body.error ? body.error : "Scan failed.")
  }
  return body as ScanReport
}

function severityVariant(severity: Finding["severity"]): "critical" | "warn" {
  return severity === "critical" ? "critical" : "warn"
}

export function ScanPage() {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<ViewState>({ status: "idle" })

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
      if (!file) return
      void run(file.name, () => scanFile(file))
    },
    [run],
  )

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-20">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">CI pack gate</p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Don’t ship the ending.
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute md:text-lg">
        Drop the tarball, zip, or Electron asar customers download. Secret scanners read git. This
        reads the packed bytes.
      </p>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div>
          <Field>
            <Label
              htmlFor={inputId}
              onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setDragOver(false)
                onFiles(event.dataTransfer.files)
              }}
              className={cn(
                "flex min-h-52 cursor-pointer flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dotted px-7 py-10 transition-colors",
                dragOver
                  ? "border-snow bg-white/[0.06]"
                  : "border-white/25 hover:border-white/45 hover:bg-white/[0.03]",
              )}
            >
              <Upload className="h-5 w-5 text-mute" aria-hidden />
              <p className="font-display text-lg text-snow">Drop a pack here</p>
              <Description className="text-sm text-dim">
                tarball, zip, or asar — or click to choose
              </Description>
              <input
                id={inputId}
                type="file"
                className="sr-only"
                accept=".tgz,.tar,.gz,.zip,.asar,.tar.gz"
                onChange={(event) => onFiles(event.target.files)}
              />
            </Label>
          </Field>

          <p className="mt-10 text-[11px] uppercase tracking-[0.22em] text-dim">Try a fixture</p>
          <ul className="mt-3 flex flex-col gap-2">
            {EXAMPLES.map((example) => (
              <li key={example.path}>
                <HeadlessButton
                  type="button"
                  className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3.5 text-left transition-colors data-hover:border-white/28 data-hover:bg-white/[0.07] data-active:bg-white/[0.1] data-focus:outline-none data-focus:ring-1 data-focus:ring-snow/40"
                  onClick={() => void run(example.label, () => scanPath(example.path))}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-snow">{example.label}</span>
                    <span className="mt-0.5 block text-xs text-dim">{example.hint}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-mute data-hover:text-snow group-data-hover:text-snow">
                    Run
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </HeadlessButton>
              </li>
            ))}
          </ul>
        </div>

        <ResultsPanel state={state} />
      </div>

      <section className="mt-20 grid gap-10 border-t border-white/5 pt-12 md:grid-cols-3">
        <Step n="01" title="Pack as usual">
          Run <code className="text-mute">npm pack</code> or build the Electron asar. Scan that
          file, not the git tree.
        </Step>
        <Step n="02" title="Fail the job">
          <code className="text-mute">npx nospoilers scan ./package.tgz</code> exits 1 if it finds
          spoilers.
        </Step>
        <Step n="03" title="Keep the map private">
          Upload hidden source maps to Sentry. Do not put them in the installer.
        </Step>
      </section>
    </main>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{n}</p>
      <h2 className="mt-3 font-display text-lg text-snow">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-dim">{children}</p>
    </div>
  )
}

function ResultsPanel({ state }: { state: ViewState }) {
  if (state.status === "idle") {
    return (
      <div className="flex min-h-52 flex-col justify-center rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <p className="text-sm text-dim">No scan yet.</p>
        <p className="mt-2 text-sm text-mute">Drop a pack or run a fixture. Empty is a good state.</p>
      </div>
    )
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-52 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <Loader2 className="h-4 w-4 animate-spin text-snow" aria-hidden />
        <p className="text-sm text-mute">Reading {state.label}…</p>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <p className="font-display text-lg text-snow">Could not scan</p>
        <p className="mt-2 text-sm text-mute">{state.message}</p>
      </div>
    )
  }

  const { report } = state
  const critical = report.findings.filter((f) => f.severity === "critical").length

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-8">
      <p className="text-[11px] uppercase tracking-[0.22em] text-dim">
        {report.ok ? "Allowed to ship" : `${critical} critical`} · {report.fileCount} files
      </p>
      <h2 className="mt-3 font-display text-2xl tracking-tight text-snow">
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
        <ul className="mt-6 divide-y divide-white/5">
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
