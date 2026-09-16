import {
  WatchSectionError,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { DeskAlert } from "@/watch/verdict";
import { navigate } from "@/nav";
import { Bell, ExternalLink, History, Send } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import "../design/timeline-page.css";

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

function destinationLabel(kind: string): string {
  if (kind === "email") return "Email";
  if (kind === "slack") return "Slack";
  if (kind === "siem") return "SIEM";
  if (kind === "jira") return "Jira";
  if (kind === "pagerduty") return "PagerDuty";
  return kind || "Notification";
}

type TimelineFilter = "all" | "alerts" | "responses" | "deliveries";

const timelineFilters = [
  ["all", "All activity"],
  ["alerts", "Alerts"],
  ["responses", "Responses"],
  ["deliveries", "Deliveries"],
] as const;

function entryLabel(entry: TimelineEntry): string {
  if (entry.type === "delivery") {
    return `${destinationLabel(entry.kind ?? "")} ${entry.deliveryStatus ?? "delivery"}`;
  }
  if (entry.type === "alert_event") {
    const action = entry.action?.replaceAll("_", " ") ?? "Response recorded";
    return entry.actorLogin ? `${action} · ${entry.actorLogin}` : action;
  }
  return entry.title ?? entry.kind?.replaceAll("_", " ") ?? "Alert recorded";
}

export function TimelineScreen({
  previewing,
  timeline,
  search,
  onRetryTimeline,
}: {
  previewing: boolean;
  timeline: TimelineState;
  alerts: DeskAlert[];
  alertState: WatchSectionState;
  search: string;
  onRetryTimeline: () => void;
  onRetryAlerts: () => void;
}) {
  const ready = timeline.status === "ready";
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const filteredEntries = useMemo(() => {
    if (!ready || filter === "all") return ready ? timeline.entries : [];
    if (filter === "alerts") return timeline.entries.filter((entry) => entry.type === "alert");
    if (filter === "responses") return timeline.entries.filter((entry) => entry.type === "alert_event");
    return timeline.entries.filter((entry) => entry.type === "delivery");
  }, [filter, ready, timeline]);
  const openEntry = (entry: TimelineEntry) => {
    if (entry.alertId == null) return;
    const params = new URLSearchParams(search);
    params.set("alert", String(entry.alertId));
    navigate(`/watch/alerts?${params}`);
  };
  const moveFilterFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = timelineFilters.findIndex(([value]) => value === filter);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % timelineFilters.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + timelineFilters.length) % timelineFilters.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = timelineFilters.length - 1;
    else return;
    event.preventDefault();
    const nextFilter = timelineFilters[nextIndex][0];
    setFilter(nextFilter);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#timeline-filter-${nextFilter}`)
      ?.focus();
  };
  return (
    <section className="timeline-page mt-4 min-w-0">
      <WatchPageHeader
        title="The story behind each release."
        lede="Recorded alerts, responses, and delivery events in one place."
      />
      {ready ? (
        <div className="timeline-filter-tabs" role="tablist" aria-label="Timeline activity">
          {timelineFilters.map(([value, label]) => (
            <button
              key={value}
              id={`timeline-filter-${value}`}
              type="button"
              role="tab"
              aria-selected={filter === value}
              aria-controls="timeline-activity-panel"
              tabIndex={filter === value ? 0 : -1}
              onClick={() => setFilter(value)}
              onKeyDown={moveFilterFocus}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        id={ready ? "timeline-activity-panel" : undefined}
        role={ready ? "tabpanel" : undefined}
        aria-labelledby={ready ? `timeline-filter-${filter}` : undefined}
      >
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
      ) : filteredEntries.length === 0 ? (
        <div className="watch-empty">No {filter} activity in this retained window.</div>
      ) : (
        <section className="timeline-feed"><header><h2>Recorded activity</h2><p>{windowLabel(timeline.days)} · newest first</p></header><ul className="timeline-events mt-6 w-full min-w-0">
          {filteredEntries.map((entry, index) => (
            <li key={`${entry.type}-${entry.alertId ?? "x"}-${entry.at}-${index}`} className="timeline-day-entry">
              {index === 0 || new Date(entry.at).toLocaleDateString() !== new Date(filteredEntries[index-1].at).toLocaleDateString() ? <h3 className="timeline-date">{new Date(entry.at).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"})}</h3> : null}
              <div className="timeline-event min-w-0">
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              <span className="timeline-event-icon" aria-hidden>
                {entry.type === "delivery" ? <Send /> : entry.type === "alert_event" ? <History /> : <Bell />}
              </span>
              <div>
                <strong>{entryLabel(entry)}</strong>
                <p>{entry.fullName ?? new Date(entry.at).toLocaleDateString()}</p>
              </div>
              {entry.alertId != null ? (
                <button type="button" className="timeline-event-link" onClick={() => openEntry(entry)}>
                  View <ExternalLink aria-hidden />
                </button>
              ) : <span className="timeline-event-unlinked">Recorded delivery</span>}
              </div>
            </li>
          ))}
        </ul></section>
      )}
      </div>
    </section>
  );
}
