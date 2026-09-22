import {QuietSidePreview} from "./watch/design/QuietSidePreview";
import {QuietModalSurface} from "./watch/design/QuietModalSurface";
import "./watch/design/coverage-page.css";
import { Button } from "@/components/ui/button";
import {
  WatchSectionError,
  WatchSkeleton,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import {
  watchHref,
  watchPath,
  type SourceConfigure,
  type SourceFilter,
} from "@/watch/routes.ts";
import {
  filterSourceViewModels,
  type SourceKind,
  type WatchSetupViewModel,
  type WatchSourceViewModel,
} from "@/watch/view-models.ts";
import { latestSourceRelease } from "@/watch/release-brief.ts";
import type { ReleaseRevision } from "@/watch/types.ts";
import { Dialog, DialogTitle } from "@headlessui/react";
import { Box, CheckCircle2, GitBranch, Globe2, Map, Package, X, Plus, ArrowRight, ArrowUpRight, Activity } from "lucide-react";
import { useState } from "react";

const SOURCE_FILTERS: { value: SourceKind | "all"; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "github", label: "GitHub" },
  { value: "npm", label: "Packages" },
  { value: "website", label: "Websites" },
  { value: "map", label: "Map custody" },
];

function configureForKind(kind: SourceKind): SourceConfigure {
  return kind;
}

export function WatchSourcesSummary({
  mode,
  sources,
  setup,
  admin = false,
  search = "",
  filter = "all",
  attention = false,
  selectedSourceKey = null,
  releases = [],
  state,
  onRetry,
}: {
  mode: "sources" | "setup";
  sources: WatchSourceViewModel[];
  setup: WatchSetupViewModel;
  admin?: boolean;
  search?: string;
  filter?: SourceFilter;
  attention?: boolean;
  selectedSourceKey?: string | null;
  releases?: ReleaseRevision[];
  state: WatchSectionState;
  onRetry: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const filteredSources = filterSourceViewModels(sources, filter, attention);
  const selectedSource = sources.find((source) => source.key === selectedSourceKey) ?? null;
  const relatedRelease = selectedSource ? latestSourceRelease(selectedSource, releases) : null;

  if (state.status === "loading") {
    return (
      <div className="mb-8" aria-busy="true">
        <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-8">
        <h1 className="watch-page-title">
          {mode === "setup" ? "Setup proof unavailable" : "Coverage unavailable"}
        </h1>
        <p className="watch-page-lede">
          Existing connections are not treated as empty while this read is failing.
        </p>
        <WatchSectionError className="mt-6 max-w-2xl" message={state.message} onRetry={onRetry} />
      </div>
    );
  }

  if (mode === "setup") {
    const covered = setup.steps.filter((step) => step.proof === "covered");
    const remaining = setup.steps.filter((step) => step.proof !== "covered");
    const headline =
      setup.done === 0
        ? "Start with one source."
        : setup.done === setup.total
        ? "Configured capabilities have recorded evidence."
        : "Review your optional coverage capabilities.";
    const goToStep = (key: (typeof setup.steps)[number]["key"]) =>
      navigate(
        watchHref(watchPath("sources"), search, {
          configure: key === "registry" ? "npm" : key === "production" ? "website" : "github",
        }),
      );

    return (
      <div className="setup-capabilities watch-narrow mb-8">
        <WatchPageHeader
          title={headline}
          lede={
            setup.done === 0
              ? "Choose the release path you already use. You do not need to connect every source before NoSpoilers can produce useful evidence."
              : "These are optional capabilities, not required onboarding steps. Connected is not the same as checked; each result has its own scope and time."
          }
        />
        <div className="watch-progress mt-[18px]">
          <div
            className="watch-ring"
            style={{
              background: `conic-gradient(#f4f4f5 ${(setup.done / setup.total) * 100}%, rgba(255,255,255,0.09) 0)`,
            }}
            aria-label={`${setup.done} of ${setup.total} optional capabilities have evidence`}
          >
            <span>
              {setup.done}/{setup.total}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <strong className="watch-small text-snow">
              {covered.length
                ? `${covered.map((step) => step.label).join(", ")} ${covered.length === 1 ? "has" : "have"} proof`
                : "No capability evidence recorded yet"}
            </strong>
            <p className="watch-tiny mt-1 text-dim">
              {remaining.length
                ? `Not yet evidenced: ${remaining.map((step) => step.label).join(", ")}. Configure only what you use.`
                : "Inspect the individual records for scope and freshness; this is not a global safety score."}
            </p>
          </div>
        </div>
        <div className="setup-capability-grid">
          {setup.steps.map((step) => {
            const active = setup.next?.key === step.key;
            const done = step.proof === "covered";
            return (
              <article
                key={step.key}
                className={cn(
                  "watch-stepcard",
                  done && "watch-stepcard-done",
                  active && "watch-stepcard-active",
                )}
              >
                <div className="watch-stephead">
                  <span
                    className={cn("watch-mark", done && "watch-mark-done", active && "watch-mark-now")}
                    aria-hidden
                  >
                    {done ? <CheckCircle2 className="size-4" aria-hidden /> : <Box className="size-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="watch-small block text-snow">{step.label}</strong>
                    <p className="watch-tiny mt-[3px] text-dim">{step.summary}</p>
                  </div>
                  <span className="watch-tiny shrink-0 text-dim">
                    {step.proof === "check-needed" ? "check needed" : step.proof}
                  </span>
                </div>
                {!done ? (
                  <div className="setup-capability-action">
                    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => goToStep(step.key)}>
                      {step.action}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="coverage-page mb-8">
      <WatchPageHeader
        title="Know what’s being checked."
        lede="Connection, monitoring and latest result are separate states."
        action={admin ? <Button type="button" size="sm" onClick={() => setAdding(true)}>Connect source<Plus className="size-4" aria-hidden /></Button> : undefined}
      />
      <div className="coverage-journey-tabs" role="tablist" aria-label="Source types">
        {SOURCE_FILTERS.map((option,index) => {
          const count=option.value === "all" ? sources.length : sources.filter(source=>source.kind===option.value).length;
          return <button key={option.value} type="button" role="tab" id={`coverage-tab-${option.value}`} aria-selected={filter===option.value} aria-controls="coverage-source-panel" tabIndex={filter===option.value?0:-1}
            onClick={()=>navigate(watchHref(watchPath('sources'),search,{sourceType:option.value}))}
            onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?SOURCE_FILTERS.length-1:(index+(event.key==='ArrowRight'?1:SOURCE_FILTERS.length-1))%SOURCE_FILTERS.length;document.getElementById(`coverage-tab-${SOURCE_FILTERS[next].value}`)?.focus();navigate(watchHref(watchPath('sources'),search,{sourceType:SOURCE_FILTERS[next].value}));}}
          >{option.label}{" "}<span>{count}</span></button>;
        })}
      </div>
      <div key={filter} className="watch-content-enter" id="coverage-source-panel" role="tabpanel" aria-labelledby={`coverage-tab-${filter}`}>
        {sources.length > 0 ? <div className="coverage-attention-filter"><label><input type="checkbox" checked={attention} onChange={()=>navigate(watchHref(watchPath('sources'),search,{attention:!attention}))}/>Needs attention <span>{sources.filter(source=>source.attention==='critical'||source.attention==='warning').length}</span></label></div> : null}
        {sources.length === 0 ? <div className="coverage-journey-empty"><Box aria-hidden/><h2>Connect your first source</h2><p>Connect GitHub or add a website to keep release checks in one place.</p>{admin?<Button type="button" onClick={()=>setAdding(true)}>Connect source<Plus className="size-4" aria-hidden/></Button>:<p>A workspace administrator can connect a source.</p>}</div> : filteredSources.length===0 ? <p className="coverage-no-match">No coverage matches these filters.</p> : <div className="coverage-table-wrap"><table className="coverage-table"><thead><tr><th>Source</th><th>Connection</th><th>Latest check</th><th><span className="sr-only">Source actions</span></th></tr></thead><tbody>{filteredSources.map(source=>{
          const verificationNeeded=source.kind==='website'&&source.status==='verification required';
          const checkLabel=source.kind==='github'?(source.lastCheckedAt?(source.status==='private'?'Private repository':'Public repository'):'Not checked'):source.status==='passed'?(source.kind==='map'?'Check passed':'Policy passed'):source.status==='failed-policy'?'Needs review':source.status==='check needed'?'Not checked':source.status==='checked'?'Metadata checked':source.status==='verification required'?'Not scanned':source.status.replace(/_/g,' ');
          const checkTone=source.kind==='github'?'neutral':source.status==='passed'?'passed':['failed-policy','public map found'].includes(source.status)?'review':['error','inconclusive','failed'].includes(source.status)?'warn':'neutral';
          const recordedAt=source.kind==='npm'?source.lastScannedAt:source.lastCheckedAt;
          return <tr key={source.key} className={selectedSourceKey===source.key?'is-selected':undefined}><td><button className="coverage-entity" onClick={()=>navigate(watchHref(watchPath('sources'),search,{source:source.key}))}><span className="coverage-icon">{source.kind==='github'?<GitBranch aria-hidden/>:source.kind==='npm'?<Package aria-hidden/>:source.kind==='website'?<Globe2 aria-hidden/>:<Map aria-hidden/>}</span><span><strong>{source.name}</strong><small>{source.kind==='github'?'GitHub · repository visibility':source.kind==='npm'?'Package registry':source.kind==='website'?'Production website':'Private map custody'}</small></span></button></td><td><span className={`coverage-status ${verificationNeeded?'warn':'neutral'}`}>{verificationNeeded?'Verify ownership':'Configured'}</span>{source.connectionLabel?<small>{source.connectionLabel}</small>:null}</td><td><span className={`coverage-status ${checkTone}`}>{checkLabel}</span>{recordedAt?<small>{new Date(recordedAt).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small>:null}</td><td><Button type="button" size="sm" variant="outline" onClick={()=>navigate(watchHref(watchPath('sources'),search,{source:source.key}))}>View details</Button></td></tr>;
        })}</tbody></table></div>}
      </div>
      {sources.length>0?<section className="coverage-health"><h2>Connection health</h2><div className="coverage-health-notice"><Activity aria-hidden/><div><strong>{sources.some(source=>source.status==='verification required')?`${sources.filter(source=>source.status==='verification required').length} ${sources.filter(source=>source.status==='verification required').length===1?'website needs':'websites need'} verification`:sources.some(source=>source.monitoring?.freshness==='delayed')?'Some source checks are delayed':'Connection and scan evidence are separate'}</strong><p>{sources.some(source=>source.status==='verification required')?'Repository access alone does not establish ownership of a production domain.':sources.some(source=>source.monitoring?.freshness==='delayed')?'Open a source to review its latest recorded check and configured cadence.':'Configured sources are not a guarantee of current access or a passing release. Review the recorded check for its scope.'}</p></div><button className="coverage-health-link" onClick={()=>navigate(watchHref(watchPath('setup'),search))}>Review<ArrowRight aria-hidden/></button></div></section>:null}
      <Dialog open={adding} onClose={setAdding} className="watch-design-surface relative z-50">
        <QuietModalSurface>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-dim">Add coverage</p>
                <DialogTitle className="mt-1 font-display text-xl text-snow">Choose a monitored surface</DialogTitle>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} aria-label="Close add coverage"><X className="size-4" aria-hidden /></Button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {([
                ["github", "GitHub repository", "Visibility, release assets, and packed CI"],
                ["npm", "npm package", "The tarball and channels the registry serves"],
                ["website", "Production website", "Same-origin assets and public maps"],
                ["map", "Map custody", "Sentry or Bugsnag private upload proof"],
              ] as [SourceConfigure, string, string][]).map(([configure, label, detail]) => (
                <button
                  key={configure}
                  type="button"
                  className="min-h-24 rounded-lg border border-white/8 bg-panel p-4 text-left transition-colors duration-150 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 motion-reduce:transition-none"
                  onClick={() => {
                    setAdding(false);
                    navigate(watchHref(watchPath("sources"), search, { configure }));
                  }}
                >
                  <span className="text-sm text-snow">{label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-dim">{detail}</span>
                </button>
              ))}
            </div>
          </QuietModalSurface>
      </Dialog>
    </div>
    <Dialog
      open={Boolean(selectedSource)}
      onClose={() => navigate(watchHref(watchPath("sources"), search, { source: null }))}
      className="watch-design-surface relative z-40"
    >
      <QuietSidePreview>
          {selectedSource ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="watch-kicker">{selectedSource.kindLabel}</p>
                  <DialogTitle className="mt-2 font-display text-2xl text-snow [overflow-wrap:anywhere]">
                    {selectedSource.name}
                  </DialogTitle>
                </div>
                <Button type="button" variant="ghost" size="sm" className="size-11 shrink-0 p-0" aria-label="Close coverage detail" onClick={() => navigate(watchHref(watchPath("sources"), search, { source: null }))}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="coverage-detail-actions mt-5 flex flex-wrap gap-2">
                {selectedSource.kind === "github" ? (
                  <Button
                    as="a"
                    href={`https://github.com/${selectedSource.coordinate.split('/').map(encodeURIComponent).join('/')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${selectedSource.name} on GitHub (new tab)`}
                  >
                    <GitBranch className="size-4" aria-hidden />
                    Open repository
                    <ArrowUpRight className="size-4" aria-hidden />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={selectedSource.kind === "github" ? "outline" : "default"}
                  onClick={() => {
                    navigate(
                      watchHref(watchPath("sources"), search, {
                        source: null,
                        configure: configureForKind(selectedSource.kind),
                      }),
                    );
                  }}
                >
                  <Box className="size-4" aria-hidden />
                  {selectedSource.kind === "github" ? "Manage checks" : selectedSource.primaryAction}
                </Button>
                {(selectedSource.kind === "npm" || selectedSource.kind === "github" || relatedRelease) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        watchHref(watchPath("releases"), search, {
                          release: relatedRelease?.id ?? null,
                        }),
                      )
                    }
                  >
                    {relatedRelease ? "Open latest release brief" : "View release history"}
                  </Button>
                ) : null}
                {selectedSource.alertCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(watchHref(watchPath("alerts"), search, { tab: "open" }))}
                  >
                    Open related alerts
                  </Button>
                ) : null}
              </div>
              <div className="mt-6 divide-y divide-white/8 rounded-lg border border-white/8 bg-panel">
                {[
                  ["Status", selectedSource.status],
                  [selectedSource.kind === "npm" ? "Metadata checked" : "Last check", selectedSource.lastCheckedAt ? new Date(selectedSource.lastCheckedAt).toLocaleString() : "No check recorded"],
                  ...(["npm", "website"].includes(selectedSource.kind) ? [["Last scan", selectedSource.lastScannedAt ? new Date(selectedSource.lastScannedAt).toLocaleString() : "No scan time recorded"]] : []),
                  ["Scope", selectedSource.scope ?? "See the saved check for its recorded scope."],
                  ["Configured cadence", selectedSource.monitoring?.intervalMs ? `Every ${Math.round(selectedSource.monitoring.intervalMs / 60_000)} minutes` : "Not available"],
                  ["Check freshness", selectedSource.monitoring?.freshness === 'delayed' ? 'Delayed — no recorded check within two configured intervals' : selectedSource.monitoring?.freshness === 'recent' ? 'Recent check recorded; not a safety verdict' : 'Unknown'],
                  ["Next dispatch", "Exact dispatch time is not recorded. Cadence does not guarantee worker availability."],
                  ["Connection", selectedSource.connectionId ? `${selectedSource.connectionLabel ?? "GitHub App"} · connection ${selectedSource.connectionId}` : "Connection identity unavailable"],
                  ["Digest / version", selectedSource.digest ? `sha256 ${selectedSource.digest}` : selectedSource.coordinate],
                  ["Open alerts", String(selectedSource.alertCount)],
                ].map(([label, value]) => (
                  <div key={label} className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <span className="text-xs text-dim">{label}</span>
                    <span className="min-w-0 text-sm text-snow [overflow-wrap:anywhere]">{value}</span>
                  </div>
                ))}
              </div>
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-snow">Evidence and related work</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/[0.035] p-4">
                    <p className="text-xs text-dim">Health and checks</p>
                    <p className="mt-2 text-sm text-snow">{selectedSource.status}</p>
                    <p className="mt-1 text-xs leading-relaxed text-mute">
                      {selectedSource.lastCheckedAt
                        ? `Last ${selectedSource.kind === "npm" ? "metadata check" : "check"} ${new Date(selectedSource.lastCheckedAt).toLocaleString()}. This timestamp alone does not establish a successful scan.`
                        : "No completed check evidence yet."}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.035] p-4">
                    <p className="text-xs text-dim">Alerts</p>
                    <p className="mt-2 text-sm text-snow">{selectedSource.alertCount} open</p>
                    <p className="mt-1 text-xs leading-relaxed text-mute">
                      Counts come from alerts whose coordinates match this source.
                    </p>
                  </div>
                </div>
              </section>
              <div className="mt-6 flex items-start gap-3 rounded-lg bg-white/[0.035] p-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden />
                <p className="text-xs leading-relaxed text-mute">
                  {selectedSource.detail}. Checks, alerts, release evidence, and remediation actions remain scoped to this real source.
                </p>
              </div>
              <a className="mt-6 inline-flex text-sm text-mute underline underline-offset-4 hover:text-snow" href={watchHref('/watch/workspaces', search, {})}>Manage workspace connections</a>
            </>
          ) : null}
        </QuietSidePreview>
    </Dialog>
    </>
  );
}
