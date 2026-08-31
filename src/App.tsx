import { useCallback, useId, useState, type ReactNode } from "react";
import { Clapperboard, FileArchive, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Finding, ScanReport } from "@/report-types";

type ViewState =
  | { status: "idle" }
  | { status: "loading"; label: string }
  | { status: "error"; message: string }
  | { status: "done"; report: ScanReport; label: string };

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
] as const;

async function scanPath(path: string): Promise<ScanReport> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const body = (await response.json()) as ScanReport | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Scan failed.");
  }
  return body as ScanReport;
}

async function scanFile(file: File): Promise<ScanReport> {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "X-Filename": file.name },
    body: file,
  });
  const body = (await response.json()) as ScanReport | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : "Scan failed.");
  }
  return body as ScanReport;
}

function severityVariant(severity: Finding["severity"]): "critical" | "warn" {
  return severity === "critical" ? "critical" : "warn";
}

export default function App() {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<ViewState>({ status: "idle" });

  const run = useCallback(async (label: string, job: () => Promise<ScanReport>) => {
    setState({ status: "loading", label });
    try {
      const report = await job();
      setState({ status: "done", report, label });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Scan failed.",
      });
    }
  }, []);

  const onFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0];
      if (!file) return;
      void run(file.name, () => scanFile(file));
    },
    [run],
  );

  return (
    <div className="min-h-svh">
      <header className="border-b border-[#2c281f]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <Clapperboard className="h-4 w-4 text-[#c23b22]" aria-hidden />
            <p className="font-[Fraunces] text-xl tracking-tight text-[#f4ecda]">NoSpoilers</p>
          </div>
          <p className="hidden text-xs uppercase tracking-[0.22em] text-[#8a7f6c] sm:block">
            no spoilers in production
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 md:py-14">
        <section className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[#c23b22]">CI pack gate</p>
          <h1 className="mt-3 font-[Fraunces] text-4xl leading-[1.1] tracking-tight text-[#f4ecda] md:text-5xl">
            Don’t ship the ending.
          </h1>
          <p className="mt-4 max-w-xl text-base text-[#c4b79a] md:text-lg">
            Secret scanners read git. This reads the bytes customers download. Drop an npm
            tarball, zip, or Electron asar. If a source map, private key, or{" "}
            <code className="rounded bg-[#1c1914] px-1.5 py-0.5 text-sm text-[#f4ecda]">.env</code>{" "}
            is inside, the release fails.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Scan an artifact</CardTitle>
              <CardDescription>
                The real pack: <code>npm pack</code> output, <code>app.asar</code>, or a zip.
                Not the src folder.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label
                htmlFor={inputId}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  onFiles(event.dataTransfer.files);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors ${
                  dragOver
                    ? "border-[#e8dfc8] bg-[#1c1914]"
                    : "border-[#3a3428] bg-[#100e0b] hover:border-[#6a5f4a]"
                }`}
              >
                <FileArchive className="h-8 w-8 text-[#8a7f6c]" aria-hidden />
                <div>
                  <p className="text-sm text-[#f4ecda]">Drop a tarball, zip, or asar</p>
                  <p className="mt-1 text-xs text-[#8a7f6c]">or click to choose a file</p>
                </div>
                <input
                  id={inputId}
                  type="file"
                  className="sr-only"
                  accept=".tgz,.tar,.gz,.zip,.asar,.tar.gz"
                  onChange={(event) => onFiles(event.target.files)}
                />
              </label>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#8a7f6c]">
                  Or try a packed fixture
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((example) => (
                    <Button
                      key={example.path}
                      type="button"
                      variant="outline"
                      className="h-auto flex-col items-start py-3 text-left"
                      onClick={() => void run(example.label, () => scanPath(example.path))}
                    >
                      <span>{example.label}</span>
                      <span className="text-[11px] font-normal text-[#8a7f6c]">{example.hint}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <ResultsPanel state={state} />
        </div>

        <section className="grid gap-4 border-t border-[#2c281f] pt-8 md:grid-cols-3">
          <Step n="01" title="Pack as usual">
            Run <code>npm pack</code> or build the Electron asar. Scan that file, not the git tree.
          </Step>
          <Step n="02" title="Fail the job">
            <code>npx nospoilers scan ./package.tgz</code> exits 1 if it finds spoilers.
          </Step>
          <Step n="03" title="Ship the blur, keep the map">
            Upload hidden source maps to Sentry privately. Do not put them in the installer.
          </Step>
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#c23b22]">{n}</p>
      <h2 className="mt-2 font-[Fraunces] text-xl text-[#f4ecda]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[#a39882]">{children}</p>
    </div>
  );
}

function ResultsPanel({ state }: { state: ViewState }) {
  if (state.status === "idle") {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-[#8a7f6c]">No scan yet.</p>
          <p className="mt-2 text-sm text-[#a39882]">
            Drop a pack or run a fixture. Empty is a good state.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "loading") {
    return (
      <Card className="flex min-h-[280px] items-center justify-center">
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[#e8dfc8]" aria-hidden />
          <p className="text-sm text-[#c4b79a]">Reading {state.label}…</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="min-h-[280px] border-[#c23b22]/40">
        <CardHeader>
          <CardTitle>Could not scan</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { report } = state;
  const critical = report.findings.filter((f) => f.severity === "critical").length;

  return (
    <Card className="min-h-[280px]">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            {report.ok ? (
              <ShieldCheck className="h-5 w-5 text-[#8fbfa0]" aria-hidden />
            ) : (
              <ShieldAlert className="h-5 w-5 text-[#c23b22]" aria-hidden />
            )}
            {report.ok ? "Allowed to ship" : "Spoilers in the pack"}
          </CardTitle>
          <CardDescription>
            {state.label} · {report.fileCount} files · {report.kind}
          </CardDescription>
        </div>
        <Badge variant={report.ok ? "clean" : "critical"}>
          {report.ok ? "pass" : `${critical} critical`}
        </Badge>
      </CardHeader>
      <CardContent>
        {report.findings.length === 0 ? (
          <p className="text-sm text-[#a39882]">
            No source maps, no embedded original source, no env files, no keys, no .git. This is
            the cut you can release.
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-3 overflow-auto pr-1">
            {report.findings.map((finding) => (
              <li
                key={`${finding.rule}-${finding.path}-${finding.title}`}
                className="rounded-lg border border-[#2c281f] bg-[#100e0b] p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={severityVariant(finding.severity)}>{finding.rule}</Badge>
                  <span className="truncate font-mono text-xs text-[#c4b79a]">{finding.path}</span>
                </div>
                <p className="mt-2 text-sm text-[#f4ecda]">{finding.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a7f6c]">{finding.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
