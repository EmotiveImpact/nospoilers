import { WatchExposureChart } from "@/components/WatchExposureChart";
import {
  WatchSectionError,
  WatchSkeleton,
  type WatchSectionState,
} from "@/components/WatchDataState";
import type { DeskAlert } from "@/watch/verdict";

type TimelineEntry = {
  type: "alert" | "alert_event" | "delivery";
  at: string;
  alertId?: number | null;
  title?: string;
  kind?: string;
  fullName?: string;
  action?: string;
  actorLogin?: string;
  deliveryStatus?: string;
};

type TimelineState =
  | { status: "loading" }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: TimelineEntry[]; days: number };

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
  return (
    <section className="mt-4">
      <h1 className="font-display text-3xl tracking-tight text-snow">
        {timeline.status === "ready" ? heading(timeline.days) : "Timeline"}
      </h1>
      <p className="mt-2 text-sm text-mute">Alert and response activity within the retained window.</p>
      <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
        Team and trial installs see this install’s alerts, acknowledgement activity, and
        notification deliveries{" "}
        {timeline.status === "ready" ? retainedWindow(timeline.days) : "for the list window"}.
        Titles only — no secret values, webhook URLs, or other tenants. Append-only evidence stays
        until uninstall.
      </p>
      {!previewing && timeline.status === "ready" && alertState.status === "ready" ? (
        <WatchExposureChart alerts={alerts} days={Math.max(7, timeline.days || 90)} />
      ) : timeline.status === "loading" || alertState.status === "loading" ? (
        <WatchSkeleton variant="detail" className="mt-6" />
      ) : alertState.status === "error" ? (
        <WatchSectionError className="mt-6 max-w-2xl" message={alertState.message} onRetry={onRetryAlerts} />
      ) : null}
      {previewing ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          Preview cannot show a live timeline. No invented incident.
        </p>
      ) : timeline.status === "solo" ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          The install timeline is on Team. Solo can still save a Watch email destination.
        </p>
      ) : timeline.status === "ended" ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          Subscribe to Team to keep the install timeline.
        </p>
      ) : timeline.status === "error" ? (
        <WatchSectionError className="mt-6 max-w-2xl" message={timeline.message} onRetry={onRetryTimeline} />
      ) : timeline.status !== "ready" ? null : timeline.entries.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          {timeline.days === 0
            ? "Nothing on this install yet."
            : `Nothing in the last ${timeline.days} days on this install.`}
        </p>
      ) : (
        <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
          {timeline.entries.map((entry, index) => (
            <li key={`${entry.type}-${entry.alertId ?? "x"}-${entry.at}-${index}`} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-snow">
                  {entry.type === "delivery"
                    ? `${destinationLabel(entry.kind ?? "")} ${entry.deliveryStatus ?? "delivery"}`
                    : entry.type === "alert_event"
                      ? `${entry.action ?? "activity"}${entry.actorLogin ? ` · ${entry.actorLogin}` : ""}`
                      : entry.title ?? entry.kind ?? "Alert"}
                </p>
                <time dateTime={entry.at} className="text-xs text-dim">
                  {new Date(entry.at).toLocaleString()}
                </time>
              </div>
              {entry.fullName ? <p className="mt-1 font-mono text-xs text-dim">{entry.fullName}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
