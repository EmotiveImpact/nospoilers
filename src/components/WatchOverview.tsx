import { CoverageLock } from "@/components/CoverageLock.tsx";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import { formatExposure, kindLabel, leadFinding } from "@/watch/format.ts";
import { watchHref, watchPath } from "@/watch/routes.ts";
import {
  deskVerdict,
  isOpenAlert,
  longestOpenExposure,
  newestOpenAlert,
  type DeskAlert,
  type DeskSource,
} from "@/watch/verdict.ts";
import type { ReactNode } from "react";

export function WatchOverview({
  search,
  ended,
  githubPaused,
  loading,
  error,
  alerts,
  sources,
  releaseCount,
  queued,
  running,
  failed,
  installUrl,
  hasInstall,
  hasRepo,
  hasPackage,
  hasOrigin,
  hasRoute,
  forceSetup = false,
}: {
  search: string;
  ended: boolean;
  githubPaused: boolean;
  loading: boolean;
  error: string | null;
  alerts: DeskAlert[];
  sources: DeskSource[];
  releaseCount: number;
  queued: number;
  running: number;
  failed: number;
  installUrl?: string;
  hasInstall: boolean;
  hasRepo: boolean;
  hasPackage: boolean;
  hasOrigin: boolean;
  hasRoute: boolean;
  forceSetup?: boolean;
}) {
  const open = alerts.filter(isOpenAlert);
  const verdict = deskVerdict({
    ended,
    githubPaused,
    sourceCount: sources.length,
    alerts,
  });
  const lead = newestOpenAlert(alerts);
  const finding = lead ? leadFinding(lead) : null;
  const setupDone = hasInstall && hasRepo && (hasPackage || hasOrigin);
  const inFlight = queued + running;

  return (
    <div className="mx-auto max-w-3xl">
      {loading ? <p className="text-sm text-dim">Loading this install…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <h1 className="font-display text-3xl tracking-tight text-snow md:text-4xl">{verdict.title}</h1>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-mute">{verdict.detail}</p>

      {lead && !ended ? (
        <div className="mt-8 flex gap-4 rounded-lg border border-white/10 bg-panel p-5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger/15 text-sm text-danger"
            aria-hidden
          >
            !
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
              {kindLabel(lead.kind)} · exposed {formatExposure(lead.exposure_ms, lead.created_at, lead.resolved_at)}
            </p>
            <h2 className="mt-2 text-lg text-snow">{lead.title}</h2>
            {finding ? (
              <p className="mt-2 font-mono text-xs text-mute">
                {finding.rule} · {finding.path}
              </p>
            ) : lead.full_name ? (
              <p className="mt-2 font-mono text-xs text-mute">{lead.full_name}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => navigate(watchHref(watchPath("alerts"), search, { alert: lead.id }))}
              >
                Open alert
              </Button>
            </div>
          </div>
          {finding ? (
            <span className="self-start text-[11px] uppercase tracking-[0.16em] text-danger">{finding.rule}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatLink
          href={watchHref(watchPath("alerts"), search)}
          label="Open alerts"
          value={String(open.length)}
          hint={open.length === 0 ? "inbox clear" : `${open.filter((row) => !row.acknowledged_at).length} waiting`}
          danger={open.length > 0}
        />
        <Stat
          label="Exposed now"
          value={open.length === 0 ? "0" : longestOpenExposure(alerts)}
          hint="longest open clock"
          danger={open.length > 0}
        />
        <StatLink
          href={watchHref(watchPath("releases"), search)}
          label="Sealed revisions"
          value={String(releaseCount)}
          hint="append-only release ledger"
        />
        <StatLink
          href={watchHref(watchPath("health"), search)}
          label="Queue"
          value={String(inFlight)}
          hint={
            failed > 0
              ? `${failed} failed`
              : inFlight === 0
                ? "idle"
                : `${queued} queued · ${running} running`
          }
          danger={failed > 0}
        />
      </div>

      <section className="relative mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Sources</h2>
          <button
            type="button"
            className="text-xs text-dim hover:text-snow"
            onClick={() => navigate(watchHref(watchPath("sources"), search))}
          >
            {sources.length === 0 ? "Add a source →" : `All ${sources.length} →`}
          </button>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-white/10">
          {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
          <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
            {sources.length === 0 ? (
              <p className="px-5 py-8 text-sm leading-relaxed text-mute">
                Nothing on this install yet. Install NoSpoilers on a private throwaway repo.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {sources.slice(0, 6).map((source) => (
                  <li key={source.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-snow">{source.name}</p>
                      <p className="mt-1 text-xs text-dim">{source.meta}</p>
                    </div>
                    {source.href ? (
                      <a
                        href={source.href}
                        className="text-xs text-mute underline-offset-4 hover:text-snow hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {forceSetup || !setupDone || sources.length === 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Finish setup</h2>
            <button
              type="button"
              className="text-xs text-dim hover:text-snow"
              onClick={() => navigate(watchHref(watchPath("setup"), search))}
            >
              Setup →
            </button>
          </div>
          <ol className="divide-y divide-white/5 rounded-lg border border-white/10">
            <SetupStep
              done={hasInstall}
              title="Install the GitHub App"
              body="The first GitHub user to connect this install is admin. Later users become members."
              action={
                installUrl ? (
                  <Button as="a" href={installUrl} size="sm">
                    Install on GitHub
                  </Button>
                ) : null
              }
            />
            <SetupStep
              done={hasRepo}
              title="Watch a private throwaway repo"
              body="Nothing on this install yet until a repository is linked."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(watchHref(watchPath("sources"), search))}
                >
                  Open sources
                </Button>
              }
            />
            <SetupStep
              done={hasPackage || hasOrigin}
              title="Watch what the registry or origin actually serves"
              body="The clean release asset and the published tarball are not always the same file."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(watchHref(watchPath("sources"), search))}
                >
                  Watch npm or a site
                </Button>
              }
            />
            <SetupStep
              done={hasRoute}
              title="Route alerts off this desk"
              body="Slack, SIEM, and Jira tickets are on Team. Email for Solo waits on Resend."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(watchHref(watchPath("notifications"), search))}
                >
                  Open notifications
                </Button>
              }
            />
          </ol>
        </section>
      ) : null}

      {open.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Exposure clock</h2>
            <button
              type="button"
              className="text-xs text-dim hover:text-snow"
              onClick={() => navigate(watchHref(watchPath("alerts"), search))}
            >
              Inbox →
            </button>
          </div>
          <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
            {open.slice(0, 5).map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 px-5 py-3 text-left"
                  onClick={() => navigate(watchHref(watchPath("alerts"), search, { alert: alert.id }))}
                >
                  <span className="truncate font-mono text-xs text-snow">{alert.full_name ?? alert.title}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-danger">
                    {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-dim">{label}</p>
      <p className={cn("mt-2 font-display text-3xl tracking-tight", danger ? "text-danger" : "text-snow")}>
        {value}
      </p>
      <p className="mt-1 text-xs text-dim">{hint}</p>
    </div>
  );
}

function StatLink({
  href,
  label,
  value,
  hint,
  danger,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <button type="button" className="text-left" onClick={() => navigate(href)}>
      <Stat label={label} value={value} hint={hint} danger={danger} />
    </button>
  );
}

function SetupStep({
  done,
  title,
  body,
  action,
}: {
  done: boolean;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px]",
          done ? "bg-white/10 text-dim" : "bg-snow text-ink",
        )}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-snow">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-dim">{body}</p>
      </div>
      {done ? <span className="text-[11px] uppercase tracking-[0.16em] text-dim">done</span> : action}
    </li>
  );
}
