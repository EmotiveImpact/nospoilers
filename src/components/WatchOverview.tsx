import { CoverageLock } from "@/components/CoverageLock.tsx";
import { Button } from "@/components/ui/button";
import { navigate } from "@/nav.ts";
import { formatExposure, leadFinding } from "@/watch/format.ts";
import { watchHref, watchPath } from "@/watch/routes.ts";
import {
  deskVerdict,
  isOpenAlert,
  longestOpenExposure,
  newestOpenAlert,
  setupProgress,
  type DeskAlert,
} from "@/watch/verdict.ts";

type SourceRow = {
  key: string;
  kind: string;
  name: string;
  meta: string;
};

export function WatchOverview({
  search,
  ended,
  githubPaused,
  installUrl,
  alerts,
  sources,
  packsRead,
  failedPolicy,
  queueDepth,
  lastRunLabel,
  setup,
}: {
  search: string;
  ended: boolean;
  githubPaused: boolean;
  installUrl?: string;
  alerts: DeskAlert[];
  sources: SourceRow[];
  packsRead: number;
  failedPolicy: number;
  queueDepth: number;
  lastRunLabel: string;
  setup: ReturnType<typeof setupProgress>;
}) {
  const verdict = deskVerdict({
    ended,
    githubPaused,
    sourceCount: sources.length,
    alerts,
  });
  const open = alerts.filter(isOpenAlert);
  const lead = newestOpenAlert(open);
  const finding = lead ? leadFinding(lead) : null;
  const href = (view: "alerts" | "releases" | "health" | "sources" | "setup" | "policy") =>
    watchHref(watchPath(view), search);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl tracking-tight text-snow md:text-4xl">{verdict.title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">{verdict.detail}</p>
      {verdict.tone === "ended" ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" onClick={() => navigate("/pricing")}>
            See plans
          </Button>
        </div>
      ) : null}
      {verdict.tone === "empty" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {installUrl ? (
            <Button as="a" href={installUrl}>
              Install on GitHub
            </Button>
          ) : (
            <Button type="button" onClick={() => navigate(href("setup"))}>
              Finish setup
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => navigate("/scan")}>
            Scan a pack by hand
          </Button>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => navigate(href("alerts"))}
          className="rounded-lg border border-white/8 bg-panel p-4 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Open alerts</p>
          <p className={`mt-2 font-display text-3xl ${open.length ? "text-danger" : "text-snow"}`}>
            {open.length}
          </p>
          <p className="mt-1 text-[11px] text-dim">{open.length ? "needs triage" : "inbox clear"}</p>
        </button>
        <div className="rounded-lg border border-white/8 bg-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Exposed now</p>
          <p className={`mt-2 font-display text-3xl ${open.length ? "text-danger" : "text-snow"}`}>
            {open.length ? longestOpenExposure(open) : "0"}
          </p>
          <p className="mt-1 text-[11px] text-dim">oldest open alert</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(href("releases"))}
          className="rounded-lg border border-white/8 bg-panel p-4 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Packs read, 30 d</p>
          <p className="mt-2 font-display text-3xl text-snow">{packsRead}</p>
          <p className="mt-1 text-[11px] text-dim">
            {failedPolicy ? `${failedPolicy} failed policy` : "listed revisions"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate(href("health"))}
          className="rounded-lg border border-white/8 bg-panel p-4 text-left"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Queue</p>
          <p className="mt-2 font-display text-3xl text-snow">{queueDepth}</p>
          <p className="mt-1 text-[11px] text-dim">{lastRunLabel}</p>
        </button>
      </div>

      {lead && !ended ? (
        <section className="mt-8 rounded-lg border border-danger/30 bg-danger/8 p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-danger">
            {finding?.rule ?? lead.kind}
          </p>
          <h2 className="mt-2 font-display text-xl text-snow">{lead.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-mute">
            {lead.full_name ? <code className="text-snow">{lead.full_name}</code> : null}
            {finding ? (
              <>
                {" "}
                · <code className="text-snow">{finding.path}</code>
              </>
            ) : null}
            {" · exposed "}
            {formatExposure(lead.exposure_ms, lead.created_at, lead.resolved_at)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => navigate(href("alerts"))}>
              Open rotation checklist
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => navigate(href("policy"))}>
              Write an exception
            </Button>
          </div>
        </section>
      ) : null}

      <section className="relative mt-10">
        {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
        <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Sources</h2>
            <button
              type="button"
              className="text-xs text-dim hover:text-snow"
              onClick={() => navigate(href("sources"))}
            >
              All {sources.length || ""} →
            </button>
          </div>
          {sources.length === 0 ? (
            <p className="mt-4 text-sm text-mute">
              No sources yet. A private throwaway repo or a public npm package name is enough to start.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8">
              {sources.slice(0, 6).map((row) => (
                <li key={row.key} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-mono text-sm text-snow">{row.name}</p>
                    <p className="mt-1 text-[11px] text-dim">
                      {row.kind} · {row.meta}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">
            {setup.done === setup.total
              ? "Leak paths covered"
              : `${setup.total - setup.done} leak path${setup.total - setup.done === 1 ? "" : "s"} still open`}
          </h2>
          <button
            type="button"
            className="text-xs text-dim hover:text-snow"
            onClick={() => navigate(href("setup"))}
          >
            Setup →
          </button>
        </div>
        <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8">
          {setup.steps.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm text-snow">{step.label}</p>
                <p className="mt-1 text-[11px] text-dim">{step.done ? "Connected" : "Not connected"}</p>
              </div>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                {step.done ? "done" : "open"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
