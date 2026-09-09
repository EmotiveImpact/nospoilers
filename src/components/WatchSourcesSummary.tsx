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
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Box, CheckCircle2, GitBranch, Globe2, Map, Package, X } from "lucide-react";
import { useState } from "react";

const SOURCE_FILTERS: { value: SourceKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "github", label: "GitHub exposure" },
  { value: "npm", label: "Published packages" },
  { value: "website", label: "Production web" },
  { value: "map", label: "Private map custody" },
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
        title="Coverage"
        lede="Repositories, registry packages, production websites, and private map custody under continuous watch."
        action={
          admin && sources.length > 0 ? (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              Add coverage
            </Button>
          ) : undefined
        }
      />
      <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
        New Scan checks one release now. Coverage keeps watching the connected surfaces that can change later.
      </p>
        {sources.length > 0 ? <>
        <div className="coverage-summary" aria-label="Coverage summary">
          <div><span>Monitored surfaces</span><strong>{sources.length}</strong><p>Across your connected sources</p></div>
          <div><span>Needs attention</span><strong className="text-warn">{sources.filter(source => source.attention === "critical" || source.attention === "warning").length}</strong><p>Sources with a warning or critical signal</p></div>
          <div><span>Checked at least once</span><strong>{sources.filter(source => source.lastCheckedAt).length}</strong><p>Check time and scope vary by source</p></div>
        </div>
        <div className="coverage-filterbar mt-5 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((option) => {
            const count =
              option.value === "all" ? sources.length : sources.filter((source) => source.kind === option.value).length;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  navigate(
                    watchHref(watchPath("sources"), search, {
                      sourceType: option.value,
                    }),
                  )
                }
                className="min-h-11 rounded-lg border border-white/10 px-3 py-2 text-xs text-mute hover:bg-white/5 aria-pressed:bg-white/10 aria-pressed:text-snow"
                aria-pressed={filter === option.value}
              >
                {option.label} <span className="ml-1 text-dim">{count}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              navigate(
                watchHref(watchPath("sources"), search, {
                  attention: !attention,
                }),
              )
            }
            className={
              attention
                ? "min-h-12 rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger sm:ml-auto sm:min-h-9"
                : "min-h-12 rounded-full border border-white/8 px-3 py-1.5 text-xs text-mute hover:border-white/20 sm:ml-auto sm:min-h-9"
            }
            aria-pressed={attention}
          >
            Needs attention{" "}
            <span className="ml-1">
              {sources.filter((source) => source.attention === "critical" || source.attention === "warning").length}
            </span>
          </button>
        </div></> : null}
      {sources.length === 0 ? (
        <div className="watch-empty mt-5 max-w-2xl">
          <strong className="block text-sm font-medium text-snow">Add your first monitored surface</strong>
          <p className="mt-1.5 max-w-xl">
            GitHub is the quickest path to ongoing visibility and release checks. A one-off package
            scan creates a release result without adding permanent coverage.
          </p>
          {admin ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setAdding(true)}>
                Add coverage
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => navigate(watchHref(watchPath("scan"), search ?? ""))}>
                New scan
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="coverage-source-list mt-5 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
          {filteredSources.map((source) => (
            <li
              key={source.key}
              className={
                selectedSourceKey === source.key
                  ? "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 bg-white/[0.035] px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
                  : "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
              }
            >
              <span className="grid size-8 place-items-center rounded-md border border-white/8 bg-inset text-mute">
                {source.kind === "github" ? <GitBranch className="size-4" aria-hidden /> : source.kind === "npm" ? <Package className="size-4" aria-hidden /> : source.kind === "website" ? <Globe2 className="size-4" aria-hidden /> : <Map className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="coverage-source-name min-w-0 text-sm text-snow [overflow-wrap:anywhere]">{source.name}</p>
                  <span
                    className={
                      source.attention === "critical"
                        ? "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 text-xs text-danger"
                        : "rounded-full border border-white/10 px-2 py-0.5 text-xs text-dim"
                    }
                  >
                    {source.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-dim [overflow-wrap:anywhere]">
                  {source.kindLabel} · {source.detail}
                  {source.digest ? ` · sha256 ${source.digest.slice(0, 12)}` : ""}
                  </p>
                <p className="coverage-source-facts">
                  <span>{source.lastCheckedAt ? `Checked ${new Date(source.lastCheckedAt).toLocaleString()}` : "Not checked yet"}</span>
                  <span className={source.alertCount > 0 ? "text-warn" : "text-dim"}>{source.alertCount} open {source.alertCount === 1 ? "alert" : "alerts"}</span>
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="col-start-2 min-h-11 justify-self-start sm:col-start-3 sm:row-start-1"
                onClick={() => navigate(watchHref(watchPath("sources"), search, { source: source.key }))}
              >
                {source.primaryAction}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {sources.length > 0 && filteredSources.length === 0 ? (
        <p className="mt-5 rounded-lg border border-white/8 bg-panel p-6 text-sm text-mute">
          No coverage matches these filters.
        </p>
      ) : null}
      <Dialog open={adding} onClose={setAdding} className="watch-design-surface relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-panel p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">
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
          </DialogPanel>
        </div>
      </Dialog>
    </div>
    <Dialog
      open={Boolean(selectedSource)}
      onClose={() => navigate(watchHref(watchPath("sources"), search, { source: null }))}
      className="watch-design-surface relative z-40"
    >
      <DialogBackdrop className="fixed inset-0 bg-black/55 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-inset p-6 shadow-2xl transition duration-150 data-closed:translate-x-full motion-reduce:transition-none">
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
                <a className="text-sm underline underline-offset-4" href={watchHref('/watch/workspaces', search, {})}>Manage workspace connections</a>
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
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  type="button"
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
                  {selectedSource.primaryAction}
                </Button>
                {selectedSource.alertCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(watchHref(watchPath("alerts"), search, { tab: "open" }))}
                  >
                    Open related alerts
                  </Button>
                ) : null}
                {(selectedSource.kind === "npm" || selectedSource.kind === "github" || relatedRelease) ? (
                  <Button
                    type="button"
                    variant="ghost"
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
              </div>
            </>
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
    </>
  );
}
