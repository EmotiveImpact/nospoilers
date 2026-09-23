import {
  WatchSectionError,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { DeskAlert } from "@/watch/verdict";
import { navigate } from "@/nav";
import { AlertTriangle, Bell, ChevronDown, ExternalLink, GitBranch, Globe2, History, Search, Send } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import "../design/timeline-page.css";

type TimelineEntry = {
  type: "alert" | "alert_event" | "delivery";
  at: string;
  alertId: number | null;
  repoId?: number | null;
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
    return entry.action?.replaceAll("_", " ") ?? "Response recorded";
  }
  if (isIncompleteReleaseCheck(entry)) return "No published release to inspect";
  if (entry.kind === "repos_added" || entry.kind === "repos_removed") return "Repository access changed";
  if (entry.kind === "repo_created_public") return "Repository created public";
  if (entry.kind === "repo_made_public") return "Repository became public";
  if (entry.kind === "push_sensitive_path") return "Sensitive-looking path changed";
  return entry.title ?? entry.kind?.replaceAll("_", " ") ?? "Alert recorded";
}

function isIncompleteReleaseCheck(entry: TimelineEntry): boolean {
  return entry.type === "alert" && isMissingReleaseRecord(entry);
}

function isMissingReleaseRecord(entry: TimelineEntry): boolean {
  return entry.kind === "scan_latest_release" && /^No release on\s+\S/i.test(entry.title?.trim() ?? "");
}

function entryContext(entry: TimelineEntry): string {
  if (entry.type === "delivery") return entry.alertId == null ? "No linked alert" : "Notification for a recorded alert";
  if (entry.type === "alert_event") return [entry.fullName ?? entry.title, entry.actorLogin ? `by ${entry.actorLogin}` : null].filter(Boolean).join(" · ") || "Recorded response";
  if (isIncompleteReleaseCheck(entry)) return entry.fullName ?? entry.title?.replace(/^No release on\s+/i, "") ?? "Connected repository";
  if (entry.kind === "repos_added" || entry.kind === "repos_removed") return entry.title ?? "GitHub installation";
  return entry.fullName ?? entry.title ?? "Recorded alert";
}

function entryTone(entry: TimelineEntry): string {
  if (isIncompleteReleaseCheck(entry)) return "incomplete";
  if (entry.type === "delivery") return "delivery";
  if (entry.type === "alert_event") return "response";
  if (entry.kind === "repos_added" || entry.kind === "repos_removed") return "connection";
  return "finding";
}

function entryIcon(entry: TimelineEntry) {
  if (isIncompleteReleaseCheck(entry)) return <AlertTriangle />;
  if (entry.type === "delivery") return <Send />;
  if (entry.type === "alert_event") return <History />;
  if (entry.kind === "repos_added" || entry.kind === "repos_removed") return <GitBranch />;
  if (entry.kind === "repo_created_public" || entry.kind === "repo_made_public") return <Globe2 />;
  return <Bell />;
}

function entryMatches(entry: TimelineEntry, query: string): boolean {
  return [entryLabel(entry), entryContext(entry), entry.title, entry.fullName, entry.kind, entry.action, entry.actorLogin]
    .some((value) => value?.toLocaleLowerCase().includes(query));
}

function localDayKey(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
  const [query, setQuery] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const filteredEntries = useMemo(() => {
    if (!ready) return [];
    const needle = query.trim().toLocaleLowerCase();
    return timeline.entries.filter((entry) => {
      if (filter === "alerts" && entry.type !== "alert") return false;
      if (filter === "responses" && entry.type !== "alert_event") return false;
      if (filter === "deliveries" && entry.type !== "delivery") return false;
      return !needle || entryMatches(entry, needle);
    });
  }, [filter, query, ready, timeline]);
  const days = useMemo(() => {
    const grouped = new Map<string, TimelineEntry[]>();
    for (const entry of filteredEntries) {
      const day = localDayKey(entry.at);
      grouped.set(day, [...(grouped.get(day) ?? []), entry]);
    }
    return [...grouped].map(([day, entries]) => ({ day, entries }));
  }, [filteredEntries]);
  const openEntry = (entry: TimelineEntry) => {
    const params = new URLSearchParams(search);
    if (isMissingReleaseRecord(entry)) {
      params.delete("alert");
      params.delete("tab");
      params.delete("before");
      params.delete("mine");
      params.set("sourceType", "github");
      params.set("configure", "github");
      if (entry.repoId != null) params.set("source", `repo-${entry.repoId}`);
      else params.delete("source");
      navigate(`/watch/sources?${params}`);
      return;
    }
    if (entry.alertId == null) return;
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
  const toggleDay = (day: string) => {
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };
  const renderEntry = (entry: TimelineEntry, key: string, child = false) => (
    <li key={key} className={`timeline-event timeline-event-${entryTone(entry)}${child ? " timeline-event-child" : ""}`}>
      <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
      <span className="timeline-event-icon" aria-hidden>{entryIcon(entry)}</span>
      <div className="timeline-event-copy">
        <strong>{child && isIncompleteReleaseCheck(entry) ? entryContext(entry) : entryLabel(entry)}</strong>
        <p>{child && isIncompleteReleaseCheck(entry) ? "No published release available for inspection" : entryContext(entry)}</p>
      </div>
      {entry.alertId != null ? (
        <button type="button" className="timeline-event-link" onClick={() => openEntry(entry)}>
          {isMissingReleaseRecord(entry) ? "Open source" : entry.type === "delivery" ? "Open related alert" : entry.type === "alert_event" ? "Open response" : "Open alert"}
          <ExternalLink aria-hidden />
        </button>
      ) : <span className="timeline-event-unlinked">Recorded delivery</span>}
    </li>
  );
  return (
    <section className="timeline-page mt-4 min-w-0">
      <WatchPageHeader
        title="The story behind each release."
        lede="What changed, what was checked, and how your team responded."
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
      ) : (
        <section className="timeline-feed" aria-label="Recorded activity">
          <header className="timeline-feed-header">
            <div><h2>Recorded activity</h2><p>{windowLabel(timeline.days)} · newest first</p></div>
            <label className="timeline-search"><Search aria-hidden /><span className="sr-only">Search source or event</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source or event" /></label>
          </header>
          {days.length === 0 ? <div className="watch-empty">No activity matches this search and tab.</div> : (
            <ul className="timeline-days">
              {days.map(({ day, entries }) => {
                const incomplete = entries.filter(isIncompleteReleaseCheck);
                const grouped = incomplete.length > 1;
                let groupRendered = false;
                return (
                  <li key={day} className="timeline-day">
                    <h3 className="timeline-date">{new Date(entries[0].at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3>
                    <ul className="timeline-events">
                      {entries.map((entry, index) => {
                        if (!grouped || !isIncompleteReleaseCheck(entry)) return renderEntry(entry, `${day}-${index}`);
                        if (groupRendered) return null;
                        groupRendered = true;
                        const expanded = expandedDays.has(day);
                        const groupId = `timeline-checks-${day}`;
                        return (
                          <li key={`${day}-checks`} className="timeline-check-group">
                            <div className="timeline-event timeline-event-incomplete timeline-event-group">
                              <time dateTime={entry.at}>{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                              <span className="timeline-event-icon" aria-hidden><AlertTriangle /></span>
                              <div className="timeline-event-copy"><strong>No published release to inspect <span className="timeline-check-count">{incomplete.length} checks</span></strong><p>Across connected repositories · no published artifact was inspected by these checks</p></div>
                              <button type="button" className="timeline-event-link timeline-group-toggle" aria-expanded={expanded} aria-controls={groupId} onClick={() => toggleDay(day)}>{expanded ? "Hide checks" : "Show checks"}<ChevronDown aria-hidden /></button>
                            </div>
                            <ul id={groupId} className="timeline-check-children" hidden={!expanded}>{expanded ? incomplete.map((check, childIndex) => renderEntry(check, `${day}-check-${childIndex}`, true)) : null}</ul>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      </div>
    </section>
  );
}
