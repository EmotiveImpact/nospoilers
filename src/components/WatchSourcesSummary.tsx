import { Button } from "@/components/ui/button";
import { navigate } from "@/nav.ts";
import { watchHref, watchPath, type SourceFilter } from "@/watch/routes.ts";
import {
  filterSourceViewModels,
  type SourceKind,
  type WatchSetupViewModel,
  type WatchSourceViewModel,
} from "@/watch/view-models.ts";
import { useState } from "react";

const SOURCE_FILTERS: { value: SourceKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "github", label: "GitHub repos" },
  { value: "npm", label: "npm packages" },
  { value: "website", label: "Websites" },
  { value: "map", label: "Map custody" },
];

function revealSourceForm(id: string) {
  const details = document.getElementById(id);
  if (details instanceof HTMLDetailsElement) {
    details.open = true;
    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
}: {
  mode: "sources" | "setup";
  sources: WatchSourceViewModel[];
  setup: WatchSetupViewModel;
  admin?: boolean;
  search?: string;
  filter?: SourceFilter;
  attention?: boolean;
  selectedSourceKey?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const filteredSources = filterSourceViewModels(sources, filter, attention);

  if (mode === "setup") {
    return (
      <div className="mb-8 max-w-3xl">
        <h1 className="font-display text-3xl tracking-tight text-snow">
          {setup.done === setup.total
            ? "All five leak paths are covered."
            : `${setup.total - setup.done} leak path${setup.total - setup.done === 1 ? "" : "s"} still need proof.`}
        </h1>
        <p className="mt-2 text-sm text-mute">
          Connected is not the same as proven. Unknown steps stay open until a real check supplies evidence.
        </p>
        <div className="mt-5 flex items-center gap-5 rounded-lg border border-white/8 bg-panel p-5">
          <div
            className="grid size-20 shrink-0 place-items-center rounded-full"
            style={{
              background: `conic-gradient(#f4f4f5 ${(setup.done / setup.total) * 360}deg, #252529 0)`,
            }}
            aria-label={`${setup.done} of ${setup.total} leak paths covered`}
          >
            <span className="grid size-[66px] place-items-center rounded-full bg-panel font-display text-lg text-snow">
              {setup.done}/{setup.total}
            </span>
          </div>
          <div>
            <p className="text-sm text-snow">{setup.done} paths have direct proof</p>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              GitHub visibility, release assets, packed-artifact checks, registry tarballs, and production/map handling.
            </p>
          </div>
        </div>
        {setup.next ? (
          <section className="mt-4 overflow-hidden rounded-lg border border-white/12 bg-panel">
            <div className="flex items-start gap-3 p-5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/20 text-xs text-snow">
                {setup.steps.indexOf(setup.next) + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-snow">{setup.next.label}</h2>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-dim">
                    {setup.next.proof === "unknown" ? "check needed" : "open"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-mute">{setup.next.summary}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  revealSourceForm(
                    setup.next?.key === "registry"
                      ? "watch-source-npm"
                      : setup.next?.key === "production"
                        ? "watch-source-web"
                        : "watch-source-github",
                  )
                }
              >
                {setup.next.action}
              </Button>
            </div>
          </section>
        ) : null}
        <ol className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
          {setup.steps.map((step, index) => (
            <li key={step.key} className="flex items-center gap-3 px-4 py-3">
              <span
                className={
                  step.proof === "covered"
                    ? "grid size-6 place-items-center rounded-full bg-white text-xs text-ink"
                    : "grid size-6 place-items-center rounded-full border border-white/15 text-[10px] text-dim"
                }
              >
                {step.proof === "covered" ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-snow">{step.label}</p>
                <p className="mt-0.5 text-xs text-dim">{step.summary}</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-dim">
                {step.proof === "unknown" ? "check needed" : step.proof}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-snow">Everything we watch, one list.</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Repositories, registry packs, production origins, and map custody report into the same inbox.
          </p>
        </div>
        {admin ? (
          <Button type="button" onClick={() => setAdding(true)}>
            + Add a source
          </Button>
        ) : null}
      </div>
      {sources.length > 0 ? (
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
                className={
                  filter === option.value
                    ? "rounded-full border border-white/25 bg-white/8 px-3 py-1.5 text-xs text-snow"
                    : "rounded-full border border-white/8 px-3 py-1.5 text-xs text-mute hover:border-white/20"
                }
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
                ? "ml-auto rounded-full border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-danger"
                : "ml-auto rounded-full border border-white/8 px-3 py-1.5 text-xs text-mute hover:border-white/20"
            }
          >
            Needs attention{" "}
            <span className="ml-1">
              {sources.filter((source) => source.attention === "critical" || source.attention === "warning").length}
            </span>
          </button>
        </div>
      ) : null}
      {sources.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/8 bg-panel px-5 py-9 text-center">
          <p className="text-sm text-snow">No sources yet.</p>
          <p className="mt-2 text-xs text-dim">Install on a private repository or connect a real package name.</p>
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
              <span className="grid size-8 place-items-center rounded-md border border-white/8 bg-inset text-xs text-mute">
                {source.kind === "github" ? "⌥" : source.kind === "npm" ? "▣" : source.kind === "website" ? "⬡" : "⎔"}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm text-snow">{source.name}</p>
                  <span
                    className={
                      source.attention === "critical"
                        ? "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 text-[10px] text-danger"
                        : "rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-dim"
                    }
                  >
                    {source.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-dim">
                  {source.kindLabel} · {source.detail}
                  {source.digest ? ` · sha256 ${source.digest.slice(0, 12)}` : ""}
                  {source.lastCheckedAt ? ` · checked ${new Date(source.lastCheckedAt).toLocaleString()}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigate(watchHref(watchPath("sources"), search, { source: source.key }));
                  window.setTimeout(
                    () =>
                      revealSourceForm(
                        source.kind === "github"
                          ? "watch-source-github"
                          : source.kind === "npm"
                            ? "watch-source-npm"
                            : source.kind === "website"
                              ? "watch-source-web"
                              : "watch-source-map",
                      ),
                    0,
                  );
                }}
              >
                Open
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
      {adding ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" role="presentation">
          <button type="button" className="absolute inset-0" aria-label="Close add source" onClick={() => setAdding(false)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-source-title"
            className="relative z-10 w-full max-w-xl rounded-xl border border-white/15 bg-[#0e0e11] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-dim">Add source</p>
                <h2 id="add-source-title" className="mt-1 font-display text-xl text-snow">What customers receive</h2>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Close</Button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                ["watch-source-github", "GitHub repository", "Visibility, release assets, and packed CI"],
                ["watch-source-npm", "npm package", "The tarball and channels the registry serves"],
                ["watch-source-web", "Production website", "Same-origin assets and public maps"],
                ["watch-source-map", "Map custody", "Sentry or Bugsnag private upload proof"],
              ].map(([id, label, detail]) => (
                <button
                  key={id}
                  type="button"
                  className="rounded-lg border border-white/8 bg-panel p-4 text-left hover:border-white/20"
                  onClick={() => {
                    setAdding(false);
                    window.setTimeout(() => revealSourceForm(id), 0);
                  }}
                >
                  <span className="text-sm text-snow">{label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-dim">{detail}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
