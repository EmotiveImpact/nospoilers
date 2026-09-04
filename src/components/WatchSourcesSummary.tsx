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
  state: WatchSectionState;
  onRetry: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const filteredSources = filterSourceViewModels(sources, filter, attention);
  const selectedSource = sources.find((source) => source.key === selectedSourceKey) ?? null;

  if (state.status === "loading") {
    return (
      <div className="mb-8" aria-busy="true">
        <div className="h-9 w-80 max-w-full animate-pulse rounded bg-white/8 motion-reduce:animate-none" />
        <div className="mt-2 h-4 w-[34rem] max-w-full animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
        <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-8">
        <h1 className="watch-page-title">
          {mode === "setup" ? "Setup proof unavailable" : "Sources unavailable"}
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
      setup.done === setup.total
        ? "All five leak paths are covered."
        : `${setup.total - setup.done} leak path${setup.total - setup.done === 1 ? "" : "s"} still need proof.`;
    const goToStep = (key: (typeof setup.steps)[number]["key"]) =>
      navigate(
        watchHref(watchPath("sources"), search, {
          configure: key === "registry" ? "npm" : key === "production" ? "website" : "github",
        }),
      );

    return (
      <div className="watch-narrow mb-8">
        <WatchPageHeader
          title={headline}
          lede="Connected is not the same as proven. Unknown steps stay open until a real check supplies evidence."
        />
        <div className="watch-progress mt-[18px]">
          <div
            className="watch-ring"
            style={{
              background: `conic-gradient(#f4f4f5 ${(setup.done / setup.total) * 100}%, rgba(255,255,255,0.09) 0)`,
            }}
            aria-label={`${setup.done} of ${setup.total} leak paths covered`}
          >
            <span>
              {setup.done}/{setup.total}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <strong className="watch-small text-snow">
              {covered.length
                ? `${covered.map((step) => step.label).join(", ")} ${covered.length === 1 ? "is" : "are"} connected`
                : "Nothing connected yet"}
            </strong>
            <p className="watch-tiny mt-1 text-dim">
              {remaining.length
                ? `${remaining.map((step) => step.label).join(", ")} ${remaining.length === 1 ? "is" : "are"} not.`
                : "Every leak path in this pass has proof."}
            </p>
          </div>
        </div>
        <div className="mt-4">
          {setup.steps.map((step, index) => {
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
                    {done ? <CheckCircle2 className="size-3" aria-hidden /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="watch-small block text-snow">{step.label}</strong>
                    <p className="watch-tiny mt-[3px] text-dim">{step.summary}</p>
                  </div>
                  <span className="watch-tiny shrink-0 text-dim">
                    {step.proof === "check-needed" ? "check needed" : step.proof}
                  </span>
                </div>
                {active ? (
                  <div className="watch-stepbody">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-inset px-3.5 py-3">
                      <p className="watch-tiny min-w-0 flex-1 text-mute">{step.summary}</p>
                      <Button type="button" size="sm" onClick={() => goToStep(step.key)}>
                        {step.action}
                      </Button>
                    </div>
                  </div>
                ) : !done ? (
                  <div className="flex justify-end px-4 pb-3">
                    <Button type="button" size="sm" variant="outline" onClick={() => goToStep(step.key)}>
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
    <div className="mb-8">
      <WatchPageHeader
        title="Sources"
        lede="GitHub exposure, published artifacts, production web, and map custody."
        action={
          admin ? (
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              Add a source
            </Button>
          ) : undefined
        }
      />
      <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
        The artifact scanner also runs before release through Scan, CLI, or your existing CI.
      </p>
        <div className="mt-5 flex flex-wrap gap-2">
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
                className={filter === option.value ? "watch-chip watch-chip-ok min-h-9" : "watch-chip min-h-9"}
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
        </div>
      {sources.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/8 bg-panel px-5 py-9 text-center">
          <p className="text-sm text-snow">No sources yet.</p>
          <p className="mt-2 text-xs text-dim">
            Install on a private repository, connect a published package, or watch your production URL.
          </p>
          {admin ? (
            <Button type="button" size="sm" className="mt-4" onClick={() => setAdding(true)}>
              Add the first source
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
          {filteredSources.map((source) => (
            <li
              key={source.key}
              className={
                selectedSourceKey === source.key
                  ? "grid gap-3 bg-white/[0.035] px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
                  : "grid gap-3 px-4 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
              }
            >
              <span className="grid size-8 place-items-center rounded-md border border-white/8 bg-inset text-mute">
                {source.kind === "github" ? <GitBranch className="size-4" aria-hidden /> : source.kind === "npm" ? <Package className="size-4" aria-hidden /> : source.kind === "website" ? <Globe2 className="size-4" aria-hidden /> : <Map className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm text-snow">{source.name}</p>
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
                <p className="mt-1 text-xs text-dim">
                  {source.kindLabel} · {source.detail}
                  {source.digest ? ` · sha256 ${source.digest.slice(0, 12)}` : ""}
                  {source.lastCheckedAt ? ` · checked ${new Date(source.lastCheckedAt).toLocaleString()}` : ""}
                  {` · ${source.alertCount} open ${source.alertCount === 1 ? "alert" : "alerts"}`}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
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
          No sources match these filters.
        </p>
      ) : null}
      <Dialog open={adding} onClose={setAdding} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-[#0e0e11] p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-dim">Add source</p>
                <DialogTitle className="mt-1 font-display text-xl text-snow">Choose one source type</DialogTitle>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} aria-label="Close add source"><X className="size-4" aria-hidden /></Button>
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
      className="relative z-40"
    >
      <DialogBackdrop className="fixed inset-0 bg-black/55 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-inset p-6 shadow-2xl transition duration-150 data-closed:translate-x-full motion-reduce:transition-none">
          {selectedSource ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="watch-kicker">{selectedSource.kindLabel}</p>
                  <DialogTitle className="mt-2 break-words font-display text-2xl text-snow">
                    {selectedSource.name}
                  </DialogTitle>
                </div>
                <Button type="button" variant="ghost" size="sm" aria-label="Close source detail" onClick={() => navigate(watchHref(watchPath("sources"), search, { source: null }))}>
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="mt-6 divide-y divide-white/8 rounded-lg border border-white/8 bg-panel">
                {[
                  ["Status", selectedSource.status],
                  ["Freshness", selectedSource.lastCheckedAt ? new Date(selectedSource.lastCheckedAt).toLocaleString() : "Check needed"],
                  ["Digest / version", selectedSource.digest ? `sha256 ${selectedSource.digest}` : selectedSource.coordinate],
                  ["Open alerts", String(selectedSource.alertCount)],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-2 px-4 py-3 sm:grid-cols-[8rem_1fr]">
                    <span className="text-xs text-dim">{label}</span>
                    <span className="break-words text-sm text-snow">{value}</span>
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
                        ? `Last evidence ${new Date(selectedSource.lastCheckedAt).toLocaleString()}`
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
                {(selectedSource.kind === "npm" || selectedSource.kind === "github") ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(watchHref(watchPath("releases"), search))}
                  >
                    Open release evidence
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
