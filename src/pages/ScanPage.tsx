import { Button as HeadlessButton, Description, Field, Label } from "@headlessui/react"
import { CoverageLock } from "@/components/CoverageLock.tsx"
import { Badge } from "@/components/ui/badge"
import { coverageFrom, type Coverage } from "@/coverage.ts"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"
import type { Finding, ScanReport } from "@/report-types"
import { watchHref, watchPath } from "@/watch/routes.ts"
import { Box, ChevronRight, FileJson, GitBranch, Globe2, Loader2, LockKeyhole, ShieldCheck, Upload } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react"
import { uploadArtifact, scanSubmissionUrl } from '@/watch/upload-transport'
import {GithubWorkspaceConnect} from '@/components/watch/GithubWorkspaceConnection'

type ViewState =
  | { status: "idle" }
  | { status: "loading"; label: string }
  | { status: "pending"; label: string }
  | { status: "error"; message: string }
  | { status: "done"; report: ScanReport; label: string }

type PendingScan = { pending: true; target: string; expiresInMinutes: number }
type QueuedScan = { queued: true; uploadId: string; target: string }
type ScanWorkspace = { id: number; account_login: string; trialEndsAt: string | null; plan: string | null; suspended: boolean; role?: 'admin'|'member'|'viewer' }
type ScanSubmission = ScanReport | PendingScan | QueuedScan

function isPendingScan(value: ScanSubmission): value is PendingScan {
  return "pending" in value && value.pending === true
}

function requireQueuedScan(value: unknown): asserts value is QueuedScan {
  if(!value || typeof value!=='object' || !('queued' in value) || value.queued!==true ||
    !('uploadId' in value) || typeof value.uploadId!=='string' || !value.uploadId.trim()) {
    throw new Error('The server did not confirm a saved attempt. Check Releases before retrying.');
  }
}

function requireSubmission(value: unknown): asserts value is PendingScan | QueuedScan {
  if(value && typeof value==='object' && 'pending' in value && value.pending===true &&
    'target' in value && typeof value.target==='string' && value.target.trim() &&
    'expiresInMinutes' in value && typeof value.expiresInMinutes==='number' && value.expiresInMinutes>0 && Number.isFinite(value.expiresInMinutes))return
  requireQueuedScan(value)
}

type ScanMode = "github" | "package" | "website" | "receipt"

function scanModeFromSearch(search: string): ScanMode {
  const params = new URLSearchParams(search)
  const mode = params.get("mode")
  // GitHub is the primary scan entry: packages, websites and receipts remain
  // explicit choices in the mode switcher.
  if (!mode && params.get('reveal') === '1') return 'package'
  return mode === "package" || mode === "website" || mode === "receipt" ? mode : "github"
}

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
    path: "fixtures/sourcemap.vsix",
    label: "VS Code VSIX with a map",
    hint: "ZIP magic, not the extension",
  },
  {
    path: "fixtures/sourcemap.crx",
    label: "Chrome CRX with a source map",
    hint: "CRX header stripped. Payload is not executed.",
  },
  {
    path: "fixtures/sourcemap.xpi",
    label: "Firefox XPI with a source map",
    hint: "ZIP magic. Extension code is not executed.",
  },
  {
    path: "fixtures/sourcemap.chrome.zip",
    label: "Chrome ZIP with a source map",
    hint: "WebExtension layout, not a CRX header. Extension code is not executed.",
  },
  {
    path: "fixtures/sourcemap.whl",
    label: "Python wheel with a source map",
    hint: "ZIP magic. Python is not executed.",
  },
  {
    path: "fixtures/sourcemap.sdist.tgz",
    label: "Python sdist with a source map",
    hint: "PKG-INFO layout. Python is not executed.",
  },
  {
    path: "fixtures/sourcemap.jar",
    label: "JAR with a source map",
    hint: "ZIP magic. Bytecode is not executed.",
  },
  {
    path: "fixtures/sourcemap.war",
    label: "WAR with a source map",
    hint: "WEB-INF layout. Bytecode is not executed.",
  },
  {
    path: "fixtures/sourcemap.nupkg",
    label: "NuGet pack with a source map",
    hint: "ZIP magic. Install scripts are not executed.",
  },
  {
    path: "fixtures/sourcemap.snupkg",
    label: "NuGet symbols pack with a source map",
    hint: "ZIP magic. Symbols are not loaded.",
  },
  {
    path: "fixtures/sourcemap.gem",
    label: "Ruby gem with a source map",
    hint: "Nested data.tar.gz. Ruby is not executed.",
  },
  {
    path: "fixtures/sourcemap.docker.tar",
    label: "Docker save with a source map",
    hint: "Image layers, never executed",
  },
  {
    path: "fixtures/sourcemap.oci.tar",
    label: "OCI image with a source map",
    hint: "Layout sniff. Layers are not executed.",
  },
  {
    path: "fixtures/sourcemap.apk",
    label: "Android APK with a source map",
    hint: "ZIP magic. DEX is not executed.",
  },
  {
    path: "fixtures/sourcemap.xapk",
    label: "Android XAPK with a source map",
    hint: "Nested APK. DEX is not executed.",
  },
  {
    path: "fixtures/sourcemap.aab",
    label: "Android AAB with a source map",
    hint: "BundleConfig layout. DEX is not executed.",
  },
  {
    path: "fixtures/sourcemap.ipa",
    label: "iOS IPA with a source map",
    hint: "ZIP magic. Mach-O is not executed.",
  },
  {
    path: "fixtures/sourcemap.lambda.zip",
    label: "Lambda zip with a source map",
    hint: "Handlers are not executed.",
  },
  {
    path: "fixtures/dotenv.tgz",
    label: "Pack with a .env",
    hint: "Should fail",
  },
  {
    path: "fixtures/workspace.tgz",
    label: "npm workspace pack",
    hint: "Lists members. Does not execute them.",
  },
  {
    path: "fixtures/inconclusive.encrypted.zip",
    label: "Encrypted zip",
    hint: "Not decrypted. Inconclusive, not a passing receipt.",
  },
  {
    path: "fixtures/inconclusive.crx",
    label: "CRX without a ZIP payload",
    hint: "Signing wrapper is not executed. Inconclusive, not a passing receipt.",
  },
  {
    path: "fixtures/inconclusive.encrypted.oci.tar",
    label: "OCI image with encrypted layers",
    hint: "Layers are not decrypted or executed. Inconclusive, not a passing receipt.",
  },
] as const

async function scanPath(path: string, search: string): Promise<ScanSubmission> {
  const scope = new URLSearchParams(search)
  const response = await fetch(scanSubmissionUrl(scope.get('install'),scope.get('workspace')), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  })
  const body = (await response.json()) as ScanSubmission | { error?: string }
  if (!response.ok) {
    throw new Error(
      "error" in body && body.error
          ? body.error
          : "Scan failed.",
    )
  }
  return body as ScanSubmission
}

async function scanFile(file: File, onProgress:(percent:number)=>void, signal:AbortSignal): Promise<ScanSubmission> {
  const params = new URLSearchParams(window.location.search)
  const install = params.get('install')
  const response = await uploadArtifact(file,install,onProgress,signal,new URLSearchParams(window.location.search).get('workspace'))
  const body = (await response.json()) as ScanSubmission | { error?: string }
  if (!response.ok) {
    throw new Error(
      response.status === 402
        ? "Coverage ended. Subscribe to unpack on our servers."
        : "error" in body && body.error
          ? body.error
          : "Scan failed.",
    )
  }
  return body as ScanSubmission
}

function severityVariant(severity: Finding["severity"]): "critical" | "warn" {
  return severity === "critical" ? "critical" : "warn"
}

type ReceiptCheck = {
  ok: boolean
  code?: import('../receipt').ReceiptVerifyResult['code']
  reason?: string
  error?: string
  status?: string
  receiptOk?: boolean
  coordinate?: string
  artifactSha256?: string
  findingCount?: number
  inconclusiveReason?: string | null
}

type VerifyView =
  | { status: "idle" }
  | { status: "working"; label: string }
  | { status: "error"; message: string }
  | { status: "done"; result: ReceiptCheck }

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function checkReceipt(receiptFile: File, packFile: File | null, signal: AbortSignal): Promise<ReceiptCheck> {
  let receipt: unknown
  try {
    receipt = JSON.parse(await receiptFile.text()) as unknown
  } catch {
    throw new Error("That file is not valid JSON.")
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("A receipt must be a JSON object.")
  }
  const payload: { receipt: unknown; sha256?: string } = { receipt }
  if (packFile) payload.sha256 = await sha256Hex(packFile)
  signal.throwIfAborted()
  const response = await fetch("/api/receipts/verify", {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json()) as ReceiptCheck
  if (!body || typeof body !== 'object') throw new Error('Invalid verification response. Try again.')
  if (response.status === 429) {
    throw new Error(body.error ?? "Too many receipt checks from this address.")
  }
  if (response.status === 400 && body.ok === false) return body
  if (!response.ok) {
    throw new Error(body.error ?? "Could not check that receipt.")
  }
  if (typeof body.ok !== 'boolean') throw new Error('Invalid verification response. Try again.')
  return body
}

export function ScanPage({ search, embedded = false,workspace }: { search: string; embedded?: boolean;workspace?:import('@/watch/workspace-types').ProductWorkspace }) {
  const params=new URLSearchParams(search)
  return <ScanPageScope key={JSON.stringify([workspace?.id??params.get('workspace'),params.get('install')])} search={search} embedded={embedded} productWorkspace={workspace}/>;
}

function ScanPageScope({ search, embedded = false,productWorkspace }: { search: string; embedded?: boolean;productWorkspace?:import('@/watch/workspace-types').ProductWorkspace }) {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<ViewState>({ status: "idle" })
  const [mode, setMode] = useState<ScanMode>(() => scanModeFromSearch(search))
  const [session, setSession] = useState<{ login: string; coverage: Coverage; personalCoverage?: Coverage; installations?: ScanWorkspace[]; installUrl?: string } | null>(null)
  const [auth, setAuth] = useState<{ githubApp: boolean; developmentLogin?: boolean }>({ githubApp: false })
  const [sessionReady,setSessionReady]=useState(false)
  const [sessionError,setSessionError]=useState<string|null>(null)
  const [sessionRetry,setSessionRetry]=useState(0)
  const [claimRetry,setClaimRetry]=useState(0)
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [savingWebsite, setSavingWebsite] = useState(false)
  const uploadController=useRef<AbortController|null>(null)
  const mounted=useRef(true)
  const [uploadProgress,setUploadProgress]=useState<number|null>(null)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;uploadController.current?.abort();}},[])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        if(!response.ok)throw new Error('Could not check your sign-in and workspace permissions.')
        const body = (await response.json()) as { user?: { login: string } | null; coverage?: Coverage; personalCoverage?: Coverage; installations?: ScanWorkspace[]; githubApp?: boolean; developmentLogin?: boolean; installUrl?: string }
        if (cancelled) return
        setAuth({ githubApp: Boolean(body.githubApp), developmentLogin: body.developmentLogin })
        if (body.user && body.coverage) setSession({ login: body.user.login, coverage: body.coverage, personalCoverage: body.personalCoverage, installations: body.installations, installUrl: body.installUrl })
        else setSession(null)
        setSessionReady(true)
        setSessionError(null)
      })
      .catch(() => {if(!cancelled)setSessionError('Could not check your sign-in and workspace permissions. Please retry before uploading.')})
    return () => {
      cancelled = true
    }
  }, [sessionRetry])

  useEffect(() => {
    const params=new URLSearchParams(search)
    if (params.get("reveal") !== "1") return
    let cancelled = false
    setState({ status: "loading", label: "your staged artifact" })
    void fetch(scanSubmissionUrl(params.get('install'),params.get('workspace'),'claim'), { method: 'POST', credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as ScanReport | QueuedScan | { error?: string }
        if (cancelled) return
        if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Could not reveal this scan.")
        requireQueuedScan(body)
        const destination = new URLSearchParams({ upload: body.uploadId })
        for (const key of ['workspace', 'install']) {
          const value = params.get(key)
          if (value) destination.set(key, value)
        }
        navigate(`/watch/releases?${destination}`)
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : "Could not reveal this scan." })
      })
    return () => {
      cancelled = true
    }
  }, [search,claimRetry])

  useEffect(() => {
    setMode(scanModeFromSearch(search))
  }, [search])

  const selectedInstall = new URLSearchParams(search).get('install')
  const workspace = session?.installations?.find(item => String(item.id) === selectedInstall)
  const coverage = productWorkspace?coverageFrom(productWorkspace.trial_ends_at,productWorkspace.plan):selectedInstall ? (workspace ? coverageFrom(workspace.trialEndsAt, workspace.plan) : undefined) : session?.personalCoverage ?? session?.coverage
  const lockReason = !sessionReady ? 'Checking sign-in and workspace permissions…' : productWorkspace?.archived_at?'This workspace is archived. Restore it before starting a scan.':(productWorkspace?.role??workspace?.role)==='viewer' ? 'Viewer access is read-only. Ask an administrator for permission to start scans.' : workspace?.suspended ? 'This GitHub connection is suspended. An administrator needs to reconnect it.' : session && selectedInstall && !workspace ? 'This workspace is unavailable or outside your access. Choose another workspace.' : null
  const locked = coverage?.status === "ended" || lockReason!==null

  const continueWebsite = async () => {
    if (session) {
      const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      params.set("configure", "website")
      params.set("origin", websiteUrl.trim())
      navigate(`${watchPath("sources")}?${params.toString()}`)
      return
    }
    setWebsiteError(null)
    setSavingWebsite(true)
    try {
      const response = await fetch("/api/origin-intent", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      })
      const body = (await response.json()) as { authUrl?: string; error?: string }
      if (!response.ok || !body.authUrl) throw new Error(body.error ?? "Could not continue with that website.")
      window.location.assign(body.authUrl)
    } catch (error) {
      setWebsiteError(error instanceof Error ? error.message : "Could not continue with that website.")
      setSavingWebsite(false)
    }
  }

  const chooseMode = (next: ScanMode) => {
    setMode(next)
    const params = new URLSearchParams(search)
    if (next === "github" && params.get('reveal') !== '1') params.delete("mode")
    else params.set("mode", next)
    window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`)
  }

  const run = useCallback(async (label: string, job: () => Promise<ScanSubmission>) => {
    setState({ status: "loading", label })
    try {
      const report = await job()
      if(!mounted.current)return
      requireSubmission(report)
      if ('queued' in report) {
        requireQueuedScan(report)
        const params = new URLSearchParams({ upload: report.uploadId })
        if (selectedInstall) params.set('install', selectedInstall)
        const workspaceId=new URLSearchParams(search).get('workspace');if(workspaceId)params.set('workspace',workspaceId)
        navigate(`/watch/releases?${params}`)
        return
      }
      setState(isPendingScan(report) ? { status: "pending", label: report.target } : { status: "done", report, label })
    } catch (error) {
      if(!mounted.current)return
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Scan failed.",
      })
    }
  }, [selectedInstall,search])

  const onFiles = useCallback(
    (list: FileList | null) => {
      const file = list?.[0]
      if (!file || locked || uploadController.current) return
      const limit=(session?80:25)*1024*1024
      if(!file.size || file.size>limit){setState({status:'error',message:`Choose a non-empty artifact no larger than ${session?80:25} MiB.`});return;}
      const controller=new AbortController()
      uploadController.current=controller
      setUploadProgress(0)
      void run(file.name, () => scanFile(file,setUploadProgress,controller.signal)).finally(()=>{
        uploadController.current=null
        setUploadProgress(null)
      })
    },
    [locked, run, session],
  )

  return (
    <main className={cn("scan-workspace mx-auto w-full max-w-6xl", embedded ? "pb-12" : "px-5 py-12 md:py-16")}>
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">New evidence</p>
      <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        What do you want to prove?
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-mute md:text-lg">
        Choose the release surface. Each scan records its supported checks, findings and limitations.
        Verify an existing proof separately without starting a new scan.
      </p>

      <div className="scan-mode-grid" role="tablist" aria-label="Evidence type">
        <button type="button" role="tab" aria-selected={mode === "github"} className={cn(mode === "github" && "is-selected")} onClick={() => chooseMode("github")}>
          <GitBranch aria-hidden />
          <strong>GitHub repository</strong>
          <span>Connect a repo and keep watching releases.</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === "package"} className={cn(mode === "package" && "is-selected")} onClick={() => chooseMode("package")}>
          <Box aria-hidden />
          <strong>Package or build</strong>
          <span>Upload npm, archive, installer, or CI output.</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === "website"} className={cn(mode === "website" && "is-selected")} onClick={() => chooseMode("website")}>
          <Globe2 aria-hidden />
          <strong>Production website</strong>
          <span>Inspect the assets a browser can download.</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === "receipt"} className={cn(mode === "receipt" && "is-selected")} onClick={() => chooseMode("receipt")}>
          <ShieldCheck aria-hidden />
          <strong>Verify release proof</strong>
          <span>Check proof shared by a supplier or teammate.</span>
        </button>
      </div>

      {mode === "github" ? (
        <section className="scan-website-panel" aria-labelledby="github-connect-title">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">GitHub repository</p>
            <h2 id="github-connect-title" className="mt-3 font-display text-3xl text-snow">Connect the repository behind your release.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
              GitHub creates ongoing Coverage and queues the first release check. NoSpoilers watches
              visibility, release assets, and packed CI output without treating the source tree as the shipped artifact.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {session ? (selectedInstall ? (
                <HeadlessButton type="button" className="scan-primary-action" onClick={() => navigate(watchHref(watchPath("sources"), search, { configure: "github" }))}>
                  Choose repository <ChevronRight className="size-4" aria-hidden />
                </HeadlessButton>
              ) : null) : auth.githubApp ? (
                <a className="scan-primary-action" href="/api/auth/github">
                  Sign in with GitHub <ChevronRight className="size-4" aria-hidden />
                </a>
              ) : (
                <HeadlessButton type="button" className="scan-primary-action" onClick={() => navigate("/watch")}>
                  Continue to sign in <ChevronRight className="size-4" aria-hidden />
                </HeadlessButton>
              )}
              {session&&new URLSearchParams(search).get('workspace')?<GithubWorkspaceConnect workspaceId={new URLSearchParams(search).get('workspace')!} disabledReason={lockReason}/>:null}
            </div>
          </div>
          <aside>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">What this creates</p>
            <ol>
              <li><span>1</span><div><strong>Repository coverage</strong><small>Visibility and release events stay monitored.</small></div></li>
              <li><span>2</span><div><strong>Initial release check</strong><small>The latest shipped artifact becomes a Release.</small></div></li>
              <li><span>3</span><div><strong>Actionable alerts</strong><small>Exposure changes route to the right owner.</small></div></li>
            </ol>
          </aside>
        </section>
      ) : null}

      {mode === "package" ? (
        <>
          <div className="scan-launch-layout">
            <section className="scan-launch-panel" aria-labelledby="package-scan-title">
              <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Package or build</p>
              <h2 id="package-scan-title" className="mt-3 font-display text-2xl text-snow">Drop the exact artifact you plan to release.</h2>
              {productWorkspace?<p className="mt-5 text-sm text-mute">Saving in <strong className="text-snow">{productWorkspace.name}</strong></p>:session ? <label className="mt-5 block text-sm text-mute">Save this release in
                <select className="mt-2 block w-full rounded-lg border border-white/15 bg-black p-3 text-snow" value={selectedInstall ?? ''} onChange={event => {
                  const params = new URLSearchParams(search)
                  if (event.target.value) params.set('install', event.target.value)
                  else params.delete('install')
                  navigate(`${embedded ? '/watch/scan' : '/scan'}?${params}`)
                }}>
                  <option value="">Personal workspace</option>
                  {session.installations?.map(item => <option key={item.id} value={item.id}>{item.account_login}{item.suspended ? ' · suspended' : ''}</option>)}
                </select>
              </label> : null}
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
                Choose packed bytes—not the source tree. Before login the artifact is only staged;
                scanning starts after coverage is active. Archives are opened but never executed.
                {session && coverage?.status === "trial" ? " Hosted scanning is active for your trial." : null}
              </p>
              <div className="relative mt-7 min-h-52">
                {sessionError ? <div role="alert"><p>{sessionError}</p><HeadlessButton type="button" onClick={()=>{setSessionError(null);setSessionRetry(value=>value+1)}}>Retry permissions check</HeadlessButton></div> : lockReason ? <p role="status" className="mb-4 text-sm text-mute">{lockReason}</p> : locked ? <CoverageLock variant="scan" title="Subscribe to unpack here." /> : null}
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
                    className={cn("scan-dropzone", locked && "is-locked", !locked && dragOver && "is-dragging")}
                  >
                    <Upload className="h-6 w-6 text-mute" aria-hidden />
                    <strong>Drop a package or build here</strong>
                    <Description>tarball, zip, asar, VSIX, container image, APK, IPA, wheel, JAR, or Lambda zip</Description>
                    {!locked ? (
                      <input id={inputId} type="file" className="sr-only" accept=".tgz,.tar,.gz,.zip,.asar,.tar.gz,.vsix,.crx,.xpi,.whl,.jar,.war,.nupkg,.snupkg,.gem,.oci,.docker.tar,.apk,.aab,.ipa,.xapk,.lambda.zip" onChange={(event) => onFiles(event.target.files)} />
                    ) : null}
                  </Label>
                </Field>
              </div>
            </section>
            {uploadProgress!==null ? <section className="uploaded-detail" aria-label="Artifact upload"><h2>Uploading artifact</h2><progress aria-label="Upload progress" value={uploadProgress} max={100}/><p role="status">{uploadProgress<100?`${uploadProgress}% uploaded`:'Upload sent. Waiting for the server to accept the scan.'}</p><HeadlessButton type="button" onClick={()=>uploadController.current?.abort()}>Stop upload</HeadlessButton><p className="text-mute">Stopping the transfer cannot cancel a scan already accepted by the server.</p></section> : <ResultsPanel state={state} locked={locked} lockReason={lockReason} auth={auth} />}
          </div>

          {new URLSearchParams(search).get('reveal')==='1' && state.status==='error' ? <div className="mt-4"><HeadlessButton type="button" onClick={()=>setClaimRetry(value=>value+1)}>Retry staged upload</HeadlessButton><p className="mt-2 text-sm text-mute">Retry after resolving the permission or connection problem. If the staged artifact has expired, upload it again. An already accepted attempt is reopened, not scanned twice.</p></div> : null}
          {auth.developmentLogin ? <details className={cn("scan-examples", locked && "pointer-events-none opacity-40")}>
            <summary>Local review examples</summary>
            <p className="text-sm text-mute">Development only. These fixtures use the same workspace scan queue and limits as uploads, and create saved attempts. This library is not available on the production website.</p>
            <ul>
              {EXAMPLES.map((example) => (
                <li key={example.path}>
                  <HeadlessButton type="button" disabled={locked || state.status==='loading'} onClick={() => !locked && state.status!=='loading' && void run(example.label, () => scanPath(example.path, search))}>
                    <span><strong>{example.label}</strong><small>{example.hint}</small></span>
                    <span>Run <ChevronRight className="h-3.5 w-3.5" aria-hidden /></span>
                  </HeadlessButton>
                </li>
              ))}
            </ul>
          </details> : null}
        </>
      ) : null}

      {mode === "website" ? (
        <section className="scan-website-panel" aria-labelledby="website-connect-title">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Production website</p>
            <h2 id="website-connect-title" className="mt-3 font-display text-3xl text-snow">Start with the origin you control.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
              {session ? 'Enter the public URL, then verify ownership in this workspace before starting a check. Monitoring is enabled separately.' : 'Enter the public URL now, then sign in to verify ownership before starting a check.'}
              {' '}NoSpoilers does not scan or expose evidence for an unverified third-party site.
            </p>
            <form className="scan-website-form" onSubmit={(event) => { event.preventDefault(); void continueWebsite() }}>
              <label htmlFor="scan-website-url">HTTPS production URL</label>
              <div>
                <input id="scan-website-url" type="url" required inputMode="url" placeholder="https://app.example.com/" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
                <HeadlessButton type="submit" className="scan-primary-action" disabled={savingWebsite || !websiteUrl.trim()}>
                  {savingWebsite ? "Saving…" : session ? "Continue to verification" : "Sign in to continue"}
                  <ChevronRight className="size-4" aria-hidden />
                </HeadlessButton>
              </div>
              {websiteError ? <p role="alert">{websiteError}</p> : null}
            </form>
          </div>
          <aside>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">What happens next</p>
            <ol>
              <li><span>1</span><div><strong>Add the origin</strong><small>Enter the exact production hostname.</small></div></li>
              <li><span>2</span><div><strong>Verify ownership</strong><small>Keep private evidence away from unauthorised scans.</small></div></li>
              <li><span>3</span><div><strong>Run a scoped check</strong><small>Inspect supported same-origin assets within the scan limits. Enable monitoring separately.</small></div></li>
            </ol>
          </aside>
        </section>
      ) : null}

      {mode === "receipt" ? <ReceiptVerifyPanel /> : null}

      {mode === "package" && !locked ? (
        <section className="mt-20 grid gap-10 border-t border-white/5 pt-12 md:grid-cols-3">
          <Step n="01" title="Pack as usual">
            Run <code className="text-mute">npm pack</code> or build the Electron asar. Scan that
            file, not the git tree.
          </Step>
          <Step n="02" title="Review the evidence">
            Your authenticated scan runs in a queue. Open Releases to follow its progress and inspect the saved findings.
          </Step>
          <Step n="03" title="Keep the map private">
            Upload hidden source maps to Sentry. Do not put them in the installer.
          </Step>
        </section>
      ) : null}

      <p className="scan-trust-note">
        <LockKeyhole className="size-4" aria-hidden />
        {mode === "package"
          ? "Uploaded bytes are staged for processing, then removed after completion or failure. The scan record and findings remain in your workspace."
          : mode === "github"
            ? "Repository access is scoped through the GitHub App and can be removed from Coverage at any time."
            : mode === "website"
              ? "Website evidence is private and only appears after ownership verification."
              : "Proof verification checks authenticity without starting a paid scan."}
      </p>
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

export function verifyHeadline(result: ReceiptCheck): { kicker: string; title: string; detail: string } {
  if (!result.ok) {
    if (result.code === 'artifact-mismatch') return {
      kicker: 'Authentic signature · different artifact',
      title: 'This package does not match the release proof.',
      detail: 'The signature matches this instance, but the selected package has a different SHA-256. This proof does not verify these bytes.',
    }
    return {
      kicker: "Verification unsuccessful",
      title: result.code === 'unrecognized-signature' ? 'The signature is not recognized by this instance.' : result.code === 'unsupported-version' ? 'This receipt version is not supported.' : 'This release proof could not be verified.',
      detail: result.reason ?? "Signature, version, or artifact hash failed.",
    }
  }
  if (result.status === "inconclusive") {
    return {
      kicker: "Authentic · inconclusive",
      title: "Not a passing result.",
      detail:
        result.inconclusiveReason ??
        "The signature is valid. Inconclusive is not a clean bill of health.",
    }
  }
  if (result.status === "failed-policy" || result.receiptOk === false) {
    return {
      kicker: "Authentic · spoilers",
      title: "The proof is authentic. The pack was not allowed to ship.",
      detail: `${result.findingCount ?? 0} finding${(result.findingCount ?? 0) === 1 ? "" : "s"} on ${result.coordinate ?? "this artifact"}. Authentic failed-policy is not clean.`,
    }
  }
  if (result.status === "passed") {
    return {
      kicker: "Authentic · allowed to ship",
      title: "This instance signed a passing release proof.",
      detail: result.coordinate ?? "Coordinate recorded on the receipt.",
    }
  }
  return {
    kicker: "Authentic",
    title: "The signature matches. Read the status before you ship.",
    detail: result.status ? `Status ${result.status} is not automatically a clean pack.` : "Status missing.",
  }
}

export function ReceiptVerifyPanel() {
  const receiptId = useId()
  const packId = useId()
  const [receiptOver, setReceiptOver] = useState(false)
  const [packOver, setPackOver] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [packFile, setPackFile] = useState<File | null>(null)
  const [view, setView] = useState<VerifyView>({ status: "idle" })
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => { activeRequest.current?.abort() }, [])

  const run = useCallback(async (nextReceipt: File, nextPack: File | null) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setView({
      status: "working",
      label: nextPack ? `Hashing ${nextPack.name} in this browser…` : `Checking ${nextReceipt.name}…`,
    })
    try {
      const result = await checkReceipt(nextReceipt, nextPack, controller.signal)
      if (controller.signal.aborted) return
      setView({ status: "done", result })
    } catch (error) {
      if (controller.signal.aborted) return
      setView({
        status: "error",
        message: error instanceof Error ? error.message : "Could not check that receipt.",
      })
    }
  }, [])

  const onReceipt = useCallback(
    (list: FileList | null) => {
      const file = list?.[0]
      if (!file) return
      setReceiptFile(file)
      void run(file, packFile)
    },
    [packFile, run],
  )

  const onPack = useCallback(
    (list: FileList | null) => {
      const file = list?.[0]
      if (!file) return
      setPackFile(file)
      if (receiptFile) void run(receiptFile, file)
    },
    [receiptFile, run],
  )

  const headline = view.status === "done" ? verifyHeadline(view.result) : null

  return (
    <section className="mt-20 border-t border-white/5 pt-12">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Signed release proof</p>
      <h2 className="mt-4 max-w-2xl font-display text-2xl tracking-tight text-snow md:text-3xl">
        Check release proof you already have.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
        This is not a new hosted scan. Drop the signed proof JSON. Optionally drop the pack so this browser can
        SHA-256 it — pack bytes never leave the machine for this check. An authentic failed-policy or
        inconclusive receipt is not a clean bill of health. Coverage ended still allows this.
        Local: <code className="text-snow">npx nospoilers verify ./package.tgz --receipt receipt.json</code>
        . A delivery URL:{" "}
        <code className="text-snow">npx nospoilers verify --receipt receipt.json --url https://example.com/app.tgz</code>
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label
              htmlFor={receiptId}
              onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setReceiptOver(true)
              }}
              onDragLeave={() => setReceiptOver(false)}
              onDrop={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setReceiptOver(false)
                onReceipt(event.dataTransfer.files)
              }}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dotted px-5 py-8 transition-colors",
                receiptOver
                  ? "border-snow bg-white/[0.06]"
                  : "border-white/25 hover:border-white/45 hover:bg-white/[0.03]",
              )}
            >
              <FileJson className="h-5 w-5 text-mute" aria-hidden />
              <p className="font-display text-base text-snow">Release proof JSON</p>
              <Description className="text-xs text-dim">
                {receiptFile ? receiptFile.name : "Drop or choose the signed release proof"}
              </Description>
              <input
                id={receiptId}
                type="file"
                className="sr-only"
                accept=".json,application/json"
                onChange={(event) => onReceipt(event.target.files)}
              />
            </Label>
          </Field>
          <Field>
            <Label
              htmlFor={packId}
              onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setPackOver(true)
              }}
              onDragLeave={() => setPackOver(false)}
              onDrop={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault()
                setPackOver(false)
                onPack(event.dataTransfer.files)
              }}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-start justify-center gap-3 rounded-2xl border-2 border-dotted px-5 py-8 transition-colors",
                packOver
                  ? "border-snow bg-white/[0.06]"
                  : "border-white/25 hover:border-white/45 hover:bg-white/[0.03]",
              )}
            >
              <Upload className="h-5 w-5 text-mute" aria-hidden />
              <p className="font-display text-base text-snow">Pack (optional)</p>
              <Description className="text-xs text-dim">
                {packFile ? `${packFile.name} · hashed here` : "Hashed in this browser. Never uploaded."}
              </Description>
              <input
                id={packId}
                type="file"
                className="sr-only"
                accept=".tgz,.tar,.gz,.zip,.asar,.tar.gz,.vsix,.crx,.xpi,.whl,.jar,.war,.nupkg,.snupkg,.gem,.oci,.docker.tar,.apk,.aab,.ipa,.xapk,.lambda.zip,.json"
                onChange={(event) => onPack(event.target.files)}
              />
            </Label>
          </Field>
        </div>

        <div className="flex min-h-40 flex-col justify-center rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-8">
          {view.status === "idle" ? (
            <>
              <p className="text-sm text-dim">No receipt checked yet.</p>
              <p className="mt-2 text-sm text-mute">
                The signature is checked against this instance. We do not store the JSON or the pack.
              </p>
            </>
          ) : null}
          {view.status === "working" ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-snow" aria-hidden />
              <p className="text-sm text-mute">{view.label}</p>
            </div>
          ) : null}
          {view.status === "error" ? (
            <>
              <p className="font-display text-lg text-snow">Could not check</p>
              <p className="mt-2 text-sm text-mute">{view.message}</p>
            </>
          ) : null}
          {headline ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.22em] text-dim">{headline.kicker}</p>
              <h3 className="mt-3 font-display text-xl tracking-tight text-snow">{headline.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{headline.detail}</p>
              {view.status === "done" && view.result.artifactSha256 ? (
                <p className="mt-3 break-all font-mono text-[11px] text-dim">
                  {view.result.artifactSha256}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function ResultsPanel({ state, locked, lockReason, auth }: { state: ViewState; locked: boolean; lockReason: string|null; auth: { githubApp: boolean; developmentLogin?: boolean } }) {
  if (locked && state.status === "idle") {
    return (
      <div className="flex min-h-52 flex-col justify-center rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Report</p>
        <h2 className="mt-3 font-display text-2xl tracking-tight text-snow">No hosted scan yet.</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          {lockReason??'Choose an active workspace or renew coverage to start a hosted scan.'} Existing release records remain separate from new scan access.
        </p>
      </div>
    )
  }

  if (state.status === "idle") {
    return (
      <div className="flex min-h-52 flex-col justify-center rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <p className="text-sm text-dim">No scan yet.</p>
        <p className="mt-2 text-sm text-mute">
          {auth.developmentLogin ? "Drop the packed artifact you intend to release, or choose a local review fixture below." : "Drop the packed artifact you intend to release."}
        </p>
      </div>
    )
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-52 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-10">
        <Loader2 className="h-4 w-4 animate-spin text-snow" aria-hidden />
        <p className="text-sm text-mute">Submitting {state.label}… Waiting for the server to confirm the saved attempt.</p>
      </div>
    )
  }

  if (state.status === "pending") {
    const href = auth.githubApp
      ? "/api/auth/github"
      : auth.developmentLogin
        ? "/api/auth/development"
        : "/watch"
    return (
      <div className="scan-private-result rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Artifact secured · scan not started</p>
        <h2 className="mt-3 font-display text-2xl tracking-tight text-snow">Ready when you sign in.</h2>
        <p className="mt-3 text-sm leading-relaxed text-mute">
          Sign in to start scanning <span className="text-snow">{state.label}</span>. That begins your five-day trial; no scanning work has run yet.
        </p>
        <HeadlessButton as="a" href={href} className="scan-primary-action">
          {auth.developmentLogin && !auth.githubApp ? "Start in local review" : "Sign in and start scan"}
          <ChevronRight className="size-4" aria-hidden />
        </HeadlessButton>
        <p className="mt-4 text-xs text-dim">The staged artifact expires and is deleted after one hour.</p>
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
  const status = report.status ?? (report.ok ? "passed" : "failed-policy")
  const critical = report.findings.filter((f) => f.severity === "critical").length
  const inconclusive = status === "inconclusive"
  const headline = inconclusive
    ? "Inconclusive"
    : report.ok
      ? "Clean pack"
      : "Spoilers in the pack"
  const kicker = inconclusive
    ? "Not a passing result"
    : report.ok
      ? "Allowed to ship"
      : `${critical} critical`

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-6 py-8">
      <p className="text-[11px] uppercase tracking-[0.22em] text-dim">
        {kicker} · {report.fileCount} files
      </p>
      <h2 className="mt-3 font-display text-2xl tracking-tight text-snow">{headline}</h2>
      <p className="mt-1 text-sm text-dim">
        {state.label} · {report.kind}
        {report.artifactSha256 ? ` · ${report.artifactSha256.slice(0, 12)}` : ""}
      </p>
      {inconclusive ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          {report.inconclusiveReason ?? "The scan could not finish."} This is not a clean bill of
          health. No passing receipt.
        </p>
      ) : report.findings.length === 0 ? (
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
      {report.suppressed && report.suppressed.length > 0 ? (
        <div className="mt-8 border-t border-white/5 pt-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">
            Suppressed by policy · {report.suppressed.length}
          </p>
          <ul className="mt-4 divide-y divide-white/5">
            {report.suppressed.map((row) => (
              <li
                key={`${row.finding.rule}-${row.finding.path}-${row.reason}`}
                className="py-3 first:pt-0"
              >
                <p className="font-mono text-xs text-dim">
                  {row.finding.rule} · {row.finding.path}
                </p>
                <p className="mt-1 text-xs text-mute">
                  {row.reason} · {row.actor} · expires {row.expiresAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {report.workspaces && report.workspaces.length > 0 ? (
        <div className="mt-8 border-t border-white/5 pt-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-dim">
            Workspaces · {report.workspaces.length}
          </p>
          <ul className="mt-4 divide-y divide-white/5">
            {report.workspaces.map((workspace) => (
              <li key={`${workspace.kind}-${workspace.root}-${workspace.configPath}`} className="py-3 first:pt-0">
                <p className="text-sm text-snow">
                  {workspace.kind} workspace
                  <span className="ml-2 font-mono text-xs text-dim">{workspace.root}</span>
                </p>
                {workspace.members.length === 0 ? (
                  <p className="mt-1 text-xs text-mute">No packed members matched the workspace globs.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1">
                    {workspace.members.map((member) => (
                      <li key={`${member.path}-${member.name}`} className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-mono text-xs text-mute">{member.name}</span>
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-dim">
                          {member.private ? "private" : "publishable"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
