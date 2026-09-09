import { WatchExposureChart } from "@/components/WatchExposureChart";
import {
  WatchSectionError,
  WatchSkeleton,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { DeskAlert } from "@/watch/verdict";

type TimelineEntry = {
  type: "alert" | "alert_event" | "delivery";
  at: string;
  alertId: number | null;
  title: string | null;
  kind: string | null;
  fullName: string | null;
  action: string | null;
  actorLogin: string | null;
  deliveryStatus: "sent" | "failed" | null;
  inventedIncident: false | null;
};

type TimelineState =
  | { status: "loading" }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: TimelineEntry[]; days: number };

function windowLabel(days: number): string {
  return days === 0 ? "life of install" : `${days} days`;
}

function retainedWindow(days: number): string {
  return days === 0 ? "for the life of this install" : `for the last ${days} days`;
}

function heading(days: number): string {
  return days === 0 ? "Install timeline" : `${days}-day timeline`;
}

function destinationLabel(kind: string): string {
  if (kind === "email") return "Email";
  if (kind === "slack") return "Slack";
  if (kind === "siem") return "SIEM";
  if (kind === "jira") return "Jira";
  if (kind === "pagerduty") return "PagerDuty";
  return kind || "Notification";
}

export function TimelineScreen({
  previewing,
  timeline,
  alerts,
  alertState,
  onRetryTimeline,
  onRetryAlerts,
}: {
  previewing: boolean;
  timeline: TimelineState;
  alerts: DeskAlert[];
  alertState: WatchSectionState;
  onRetryTimeline: () => void;
  onRetryAlerts: () => void;
}) {
  const ready = timeline.status === "ready";
  return (
    <section className="timeline-page mt-4 min-w-0">
      <WatchPageHeader
        title={ready ? heading(timeline.days) : "Timeline"}
        lede="Alert and response activity within the retained window."
      />
      <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
        Team and trial installs see this install’s alerts, acknowledgement activity, and
        notification deliveries {ready ? retainedWindow(timeline.days) : "for the list window"}.
        Titles only — no secret values, webhook URLs, or other tenants. Append-only evidence stays
        until uninstall.
      </p>
      <div className="timeline-summary watch-card mt-[18px]">
        <div className="watch-kv">
          <span>Events</span>
          <span className={ready && timeline.entries.length > 0 ? "text-snow" : "text-dim"}>
            {ready ? timeline.entries.length : previewing ? 0 : "—"}
          </span>
        </div>
        <div className="watch-kv">
          <span>Window</span>
          <span className="text-dim">{ready ? windowLabel(timeline.days) : "—"}</span>
        </div>
      </div>
      {!previewing && ready && alertState.status === "ready" ? (
        <details className="timeline-chart-disclosure">
          <summary><span>Activity by source</span><span>Explore the retained alert chart</span></summary>
          <WatchExposureChart alerts={alerts} days={Math.max(7, timeline.days || 90)} />
        </details>
      ) : timeline.status === "loading" || alertState.status === "loading" ? (
        <WatchSkeleton variant="detail" className="mt-6" />
      ) : alertState.status === "error" ? (
        <WatchSectionError className="mt-6 max-w-2xl" message={alertState.message} onRetry={onRetryAlerts} />
      ) : null}
      {previewing ? (
        <>
          <p className="mt-6 text-[13px] leading-relaxed text-mute">
            Preview cannot show a live timeline. No invented incident.
          </p>
          <div className="watch-empty">No exposure to plot from real alert history.</div>
        </>
      ) : timeline.status === "solo" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          The install timeline is on Team. Solo can still save a Watch email destination.
        </p>
      ) : timeline.status === "ended" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Subscribe to Team to keep the install timeline.
        </p>
      ) : timeline.status === "error" ? (
        <WatchSectionError className="mt-6 max-w-2xl" message={timeline.message} onRetry={onRetryTimeline} />
      ) : !ready ? null : timeline.entries.length === 0 ? (
        <div className="watch-empty">
          {timeline.days === 0
            ? "Nothing on this install yet."
            : `Nothing in the last ${timeline.days} days on this install.`}
        </div>
      ) : (
        <section className="timeline-feed"><header><h2>Recorded activity</h2><p>Alerts, responses and notification deliveries</p></header><ul className="timeline-events mt-6 w-full min-w-0 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
          {timeline.entries.map((entry, index) => (
            <li key={`${entry.type}-${entry.alertId ?? "x"}-${entry.at}-${index}`} className="min-w-0 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 max-w-full text-sm text-snow [overflow-wrap:anywhere]">
                  {entry.type === "delivery"
                    ? `${destinationLabel(entry.kind ?? "")} ${entry.deliveryStatus ?? "delivery"}`
                    : entry.type === "alert_event"
                      ? `${entry.action ?? "activity"}${entry.actorLogin ? ` · ${entry.actorLogin}` : ""}`
                      : entry.title ?? entry.kind ?? "Alert"}
                </p>
                <time dateTime={entry.at} className="max-w-full text-xs text-dim [overflow-wrap:anywhere]">
                  {new Date(entry.at).toLocaleString()}
                </time>
              </div>
              {entry.fullName ? <p className="mt-1 max-w-full font-mono text-xs text-dim [overflow-wrap:anywhere]">{entry.fullName}</p> : null}
            </li>
          ))}
        </ul></section>
      )}
    </section>
  );
}
