import { Button } from "@/components/ui/button";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import { formatAgo, formatExposure, kindLabel, leadFinding, shortDigest } from "@/watch/format.ts";
import { watchHref, watchPath } from "@/watch/routes.ts";
import { newestOpenAlert, type DeskAlert, type DeskVerdict } from "@/watch/verdict.ts";
import {
  alertSeverity,
  buildPackSpark,
  countOpenAlerts,
  coverageDonut,
  latestDeliveryAt,
  latestSealedReleases,
  nextExceptionExpiry,
  receiptDotTone,
  sourceKindCounts,
  type WatchSourceViewModel,
} from "@/watch/view-models.ts";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

function Tile({
  span,
  label,
  onOpen,
  alarm,
  dashed,
  banner,
  children,
}: {
  span: string;
  label: string;
  onOpen: () => void;
  alarm?: boolean;
  dashed?: boolean;
  banner?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "watch-tile",
        span,
        alarm && "watch-tile-alarm",
        dashed && "watch-tile-dashed",
        banner && "watch-tile-banner",
      )}
    >
      <button type="button" className="watch-tile-hit" onClick={onOpen} aria-label={label} />
      <span className="watch-tile-go" aria-hidden>
        <ArrowRight className="size-3.5" />
      </span>
      <div className="watch-tile-body">{children}</div>
    </div>
  );
}

function HeroTile({
  search,
  ended,
  githubPaused,
  installUrl,
  verdict,
  lead,
  href,
}: {
  search: string;
  ended: boolean;
  githubPaused: boolean;
  installUrl?: string;
  verdict: DeskVerdict;
  lead: DeskAlert | null;
  href: (view: "alerts" | "setup") => string;
}) {
  const finding = lead ? leadFinding(lead) : null;
  if (ended || githubPaused) {
    return (
      <Tile span="watch-w4" label="See plans" alarm onOpen={() => navigate("/pricing")}>
        <span className="watch-kicker text-danger">Hosted coverage is off</span>
        <h2 className="mt-3 font-display text-[19px] tracking-tight text-snow">{verdict.title}</h2>
        <p className="watch-small mt-[7px] max-w-[56ch] text-mute">{verdict.detail}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3.5">
          <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
            See plans
          </Button>
          <Button type="button" size="sm" variant="outline" disabled>
            Locked scan
          </Button>
        </div>
      </Tile>
    );
  }
  if (verdict.tone === "empty") {
    return (
      <Tile
        span="watch-w4"
        label="Install on GitHub"
        dashed
        onOpen={() => (installUrl ? (window.location.href = installUrl) : navigate(href("setup")))}
      >
        <span className="watch-kicker">Start here</span>
        <h2 className="mt-3 font-display text-[19px] tracking-tight text-snow">
          Install NoSpoilers on one repository.
        </h2>
        <p className="watch-small mt-[7px] max-w-[54ch] text-mute">
          Every tile on this page fills itself in from what you connect. Nothing here needs
          configuring first — a private throwaway repo is enough to see the whole loop.
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3.5">
          {installUrl ? (
            <Button as="a" href={installUrl} size="sm">
              Install on GitHub
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => navigate(href("setup"))}>
              Finish setup
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => navigate("/scan")}>
            Scan a pack by hand
          </Button>
        </div>
      </Tile>
    );
  }
  if (lead) {
    const severity = alertSeverity(lead);
    return (
      <Tile
        span="watch-w4"
        label={`Open ${lead.title}`}
        alarm
        onOpen={() => navigate(watchHref(watchPath("alerts"), search, { alert: lead.id }))}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={severity === "critical" ? "watch-pill watch-pill-crit" : "watch-pill watch-pill-warn"}>
            {finding?.rule ?? kindLabel(lead.kind)} · {severity}
          </span>
          <span className="watch-tiny text-dim">
            {formatExposure(lead.exposure_ms, lead.created_at, lead.resolved_at)} exposed
          </span>
        </div>
        <h2 className="mt-3 font-display text-[19px] tracking-tight text-snow">{lead.title}</h2>
        <p className="watch-small mt-[7px] max-w-[56ch] text-mute">
          {lead.full_name ? <code className="text-snow">{lead.full_name}</code> : null}
          {finding ? (
            <>
              {lead.full_name ? " · " : null}
              <code className="text-snow">{finding.path}</code>
            </>
          ) : null}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3.5">
          <Button
            type="button"
            size="sm"
            onClick={() => navigate(watchHref(watchPath("alerts"), search, { alert: lead.id }))}
          >
            Open rotation checklist
          </Button>
        </div>
      </Tile>
    );
  }
  return (
    <Tile span="watch-w4" label="Open inbox" onOpen={() => navigate(href("alerts"))}>
      <span className="watch-kicker">Exposure now</span>
      <h2 className="mt-3 font-display text-[19px] tracking-tight text-snow">{verdict.title}</h2>
      <p className="watch-small mt-[7px] max-w-[56ch] text-mute">{verdict.detail}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-3.5">
        <Button type="button" size="sm" variant="outline" onClick={() => navigate(href("alerts"))}>
          Open inbox
        </Button>
      </div>
    </Tile>
  );
}

export function WatchBentoBoard({
  search,
  ended,
  githubPaused,
  installUrl,
  alerts,
  sources,
  verdict,
}: {
  search: string;
  ended: boolean;
  githubPaused: boolean;
  installUrl?: string;
  alerts: DeskAlert[];
  sources: WatchSourceViewModel[];
  verdict: DeskVerdict;
}) {
  const {
    destinationKindLabel,
    destinations,
    deskCoverage,
    exceptions,
    jobSummary,
    members,
    releases,
    retention,
    routes,
    teamOnly,
    user,
  } = useWatchScreenContext();
  const href = (view: "alerts" | "releases" | "health" | "sources" | "setup" | "policy" | "team" | "notifications") =>
    watchHref(watchPath(view), search);
  const lead = newestOpenAlert(alerts.filter((alert) => !alert.resolved_at));
  const open = countOpenAlerts(alerts, user?.login ?? "");
  const kinds = sourceKindCounts(sources);
  const donut = coverageDonut(sources);
  const spark = buildPackSpark(releases);
  const sealed = latestSealedReleases(releases);
  const activeExceptions = exceptions.filter((row) => row.active);
  const nextExpiry = nextExceptionExpiry(exceptions);
  const lastDelivery = latestDeliveryAt(destinations);
  const inQueue = jobSummary.queued + jobSummary.running;
  const queueState = jobSummary.running > 0 ? "Running" : jobSummary.queued > 0 ? "Queued" : "Idle";
  const solo = deskCoverage?.plan === "solo";
  const trial = deskCoverage?.status === "trial";
  const retentionLabel =
    retention.status === "ready" && retention.days > 0 ? `${retention.days}-day retention` : null;

  return (
    <div className="watch-bento mt-8">
      <HeroTile
        search={search}
        ended={ended}
        githubPaused={githubPaused}
        installUrl={installUrl}
        verdict={verdict}
        lead={lead}
        href={href}
      />

      <Tile span="watch-w2 watch-h2" label="Open coverage" onOpen={() => navigate(href("sources"))}>
        <span className="watch-kicker">Coverage</span>
        {donut.total === 0 ? (
          <p className="watch-small mt-4 text-dim">Nothing connected yet.</p>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <div
              className="watch-donut"
              style={{
                background: `conic-gradient(var(--color-ok) 0 ${donut.okEnd}%, var(--color-warn) ${donut.okEnd}% ${donut.warnEnd}%, var(--color-danger) ${donut.warnEnd}% 100%)`,
              }}
              aria-label={`${donut.pct}% clean`}
            >
              <span className={donut.crit ? "text-danger" : donut.warn ? "text-warn" : "text-ok"}>
                {donut.pct}%
              </span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-mute">
              <span className="flex items-center gap-2">
                <i className="watch-dot watch-dot-ok" /> {donut.clean} clean
              </span>
              <span className="flex items-center gap-2">
                <i className="watch-dot watch-dot-warn" /> {donut.warn} warn
              </span>
              <span className="flex items-center gap-2">
                <i className="watch-dot watch-dot-crit" /> {donut.crit} critical
              </span>
            </div>
          </div>
        )}
        <hr className="my-[15px] h-px border-0 bg-line" />
        <div>
          {(
            [
              ["GitHub repos", kinds.github],
              ["npm packages", kinds.npm],
              ["Websites", kinds.website],
              ["Map custody", kinds.map],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="watch-mini">
              <span className="min-w-0 flex-1">{label}</span>
              <span className={count ? "text-snow" : "text-dim"}>{count}</span>
            </div>
          ))}
        </div>
        <span className="watch-tile-foot">Add a source</span>
      </Tile>

      <Tile span="watch-w2" label="Open alerts" onOpen={() => navigate(href("alerts"))}>
        <span className="watch-kicker">Open alerts</span>
        <div className={cn("watch-tile-n", open.open ? "text-danger" : "text-dim")}>{open.open}</div>
        <span className="watch-tile-foot">
          {open.open
            ? `${open.critical} critical · ${open.warning} warn · ${open.assigned} assigned to you`
            : "Nothing on this install yet"}
        </span>
      </Tile>

      <Tile span="watch-w2" label="Open install health" onOpen={() => navigate(href("health"))}>
        <span className="watch-kicker">Queue</span>
        <div className={cn("watch-tile-n", inQueue ? "text-warn" : "text-snow")}>{inQueue}</div>
        <span className="watch-tile-foot">
          {jobSummary.done === 0 && jobSummary.failed === 0 && inQueue === 0
            ? "Idle · nothing has run"
            : `${queueState} · ${jobSummary.done} done · ${jobSummary.failed} failed`}
        </span>
      </Tile>

      <Tile span="watch-w3" label="Open releases" onOpen={() => navigate(href("releases"))}>
        <span className="watch-kicker">Packs read, 30 days</span>
        {spark.packCount === 0 ? (
          <p className="watch-small mt-4 text-dim">No packs in the last 30 days.</p>
        ) : (
          <div className="watch-spark" aria-hidden>
            {spark.bars.map((bar, index) => (
              <i
                key={`${bar.tone}-${index}`}
                className={bar.tone === "ok" ? undefined : bar.tone}
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
        )}
        <span className="watch-tile-foot">
          {spark.packCount
            ? `${spark.packCount} pack${spark.packCount === 1 ? "" : "s"} · ${spark.failedPolicy} failed policy`
            : "Nothing sealed yet"}
        </span>
      </Tile>

      <Tile span="watch-w3" label="Open latest sealed releases" onOpen={() => navigate(href("releases"))}>
        <span className="watch-kicker">Latest sealed releases</span>
        {sealed.length === 0 ? (
          <p className="watch-small mt-4 text-dim">No sealed releases yet.</p>
        ) : (
          <div className="mt-2.5">
            {sealed.map((row) => {
              const tone = receiptDotTone(row.receiptStatus);
              return (
                <div key={row.id} className="watch-mini">
                  <i className={cn("watch-dot", tone === "dim" ? undefined : `watch-dot-${tone}`)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-snow">
                    {row.coordinate}
                  </span>
                  <span className="watch-tiny text-dim">{shortDigest(row.artifactSha256)}</span>
                </div>
              );
            })}
          </div>
        )}
        <span className="watch-tile-foot">
          {releases.length
            ? `${releases.length} receipt${releases.length === 1 ? "" : "s"} available to download`
            : "Receipts appear after the first sealed pack"}
        </span>
      </Tile>

      {solo ? (
        <Tile span="watch-w2" label="Compare plans" dashed onOpen={() => navigate("/pricing")}>
          <span className="watch-kicker">Delivery</span>
          <p className="watch-small mt-3 text-mute">Slack, SIEM, and Jira tickets are on Team.</p>
          <span className="watch-tile-foot">Compare plans</span>
        </Tile>
      ) : (
        <Tile span="watch-w2" label="Open delivery" onOpen={() => navigate(href("notifications"))}>
          <span className="watch-kicker">Delivery</span>
          {destinations.length === 0 ? (
            <p className="watch-small mt-3.5 text-dim">No destinations yet</p>
          ) : (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {destinations.slice(0, 3).map((row) => (
                <span key={row.id} className="watch-chip watch-chip-ok">
                  <i className="watch-dot watch-dot-ok" />
                  {destinationKindLabel(row.kind)}
                </span>
              ))}
            </div>
          )}
          <span className="watch-tile-foot">
            {destinations.length === 0
              ? "Alerts stay in the desk until you add one"
              : `${lastDelivery ? `Last delivery ${formatAgo(lastDelivery)}` : "No delivery yet"} · ${routes.length} route${routes.length === 1 ? "" : "s"}`}
          </span>
        </Tile>
      )}

      <Tile span="watch-w2" label="Open policy" onOpen={() => navigate(href("policy"))}>
        <span className="watch-kicker">Policy</span>
        <div className={cn("watch-tile-n", activeExceptions.length ? "text-warn" : "text-dim")}>
          {activeExceptions.length}
        </div>
        <span className="watch-tile-foot">
          {activeExceptions.length
            ? `Active exceptions${nextExpiry ? ` · next expires ${nextExpiry.slice(0, 10)}` : ""}`
            : "No exceptions written"}
        </span>
      </Tile>

      {solo || !teamOnly ? (
        <Tile span="watch-w2" label="Compare plans" dashed onOpen={() => navigate("/pricing")}>
          <span className="watch-kicker">Team & audit</span>
          <p className="watch-small mt-3 text-mute">
            Roles, the install timeline, and the audit log are on Team.
          </p>
          <span className="watch-tile-foot">Subscribe to Team to keep the audit log</span>
        </Tile>
      ) : (
        <Tile span="watch-w2" label="Open team" onOpen={() => navigate(href("team"))}>
          <span className="watch-kicker">Team</span>
          {members.length === 0 ? (
            <p className="watch-small mt-3.5 text-dim">No members loaded yet.</p>
          ) : (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {members.slice(0, 2).map((row) => (
                <span key={row.userId} className="watch-chip">
                  @{row.login} {row.role}
                </span>
              ))}
              {members.length > 2 ? <span className="watch-chip">+{members.length - 2}</span> : null}
            </div>
          )}
          <span className="watch-tile-foot">{retentionLabel ?? "Team seats on this install"}</span>
        </Tile>
      )}

      {trial ? (
        <Tile span="watch-w6" label="Compare plans" banner onOpen={() => navigate("/pricing")}>
          <div className="flex flex-wrap items-center gap-3">
            <i className="watch-dot watch-dot-info" />
            <strong className="watch-small min-w-0 flex-1 text-snow">
              Your trial ends in {deskCoverage?.daysLeft ?? 0} day
              {(deskCoverage?.daysLeft ?? 0) === 1 ? "" : "s"}. Solo $29 keeps GitHub watch and pack
              reads for one person; Team $99 adds routing, roles, audit, and lookalike signals.
            </strong>
            <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
              Compare plans
            </Button>
          </div>
        </Tile>
      ) : null}

      {solo ? (
        <Tile span="watch-w6" label="Compare plans" banner onOpen={() => navigate("/pricing")}>
          <div className="flex flex-wrap items-center gap-3">
            <i className="watch-dot watch-dot-info" />
            <strong className="watch-small min-w-0 flex-1 text-snow">
              On Solo, delivery and team tiles stay as upgrade prompts rather than disappearing — so
              the shape of the page does not change when you upgrade.
            </strong>
            <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
              Compare plans
            </Button>
          </div>
        </Tile>
      ) : null}
    </div>
  );
}
