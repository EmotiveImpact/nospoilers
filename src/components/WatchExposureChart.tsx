import type { DeskAlert } from "@/watch/verdict.ts";
import { buildTimelineLanes } from "@/watch/view-models.ts";
import { useId, useState } from "react";

export function WatchExposureChart({
  alerts,
  days = 7,
  compact = false,
}: {
  alerts: DeskAlert[];
  days?: number;
  compact?: boolean;
}) {
  const scrollHintId = useId();
  const [now] = useState(() => Date.now());
  const lanes = buildTimelineLanes(alerts, { days, now });
  const ticks = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now - (7 - index) * (days / 7) * 86_400_000);
    return index === 7
      ? "Today"
      : date.toLocaleDateString(undefined, {
          ...(days > 7 ? { day: "numeric" as const, month: "short" as const } : { weekday: "short" as const }),
          timeZone: "UTC",
        });
  });

  return (
    <section className="watch-gantt mt-6 overflow-hidden rounded-lg border border-white/8 bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/8 px-4 py-3">
        <h2 className="text-sm text-snow">Alert activity, last {days} days</h2>
        <span className="text-xs text-dim">
          {lanes.length === 0 ? "no activity" : lanes.some((lane) => lane.spans.some((span) => span.open)) ? "open alerts" : "all alerts closed"}
        </span>
      </div>
      {lanes.length === 0 ? (
        <p className="px-4 py-8 text-sm text-mute">No alert activity in this window.</p>
      ) : (
        <>
        <p id={scrollHintId} className="px-4 pt-3 text-xs text-mute">Scroll horizontally to see the full timeline. With keyboard focus on the chart, use the left and right arrow keys.</p>
        <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-snow" tabIndex={0} role="region" aria-label="Alert activity by source and retained time" aria-describedby={scrollHintId}>
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[minmax(150px,220px)_1fr] border-b border-white/8">
            <span className="px-4 py-2 text-xs uppercase tracking-[0.16em] text-dim">Source</span>
            <div className="grid grid-cols-8 px-3 py-2">
              {ticks.map((tick, index) => (
                <span key={`${tick}-${index}`} className="text-xs text-dim last:text-right">
                  {tick}
                </span>
              ))}
            </div>
          </div>
          {lanes.slice(0, compact ? 4 : undefined).map((lane) => (
            <div
              key={lane.key}
              className="grid min-h-14 grid-cols-[minmax(150px,220px)_1fr] border-b border-white/5 last:border-b-0"
            >
              <div className="min-w-0 px-4 py-3">
                <p className="truncate font-mono text-xs text-snow">{lane.label}</p>
                <p className="mt-1 truncate text-xs text-dim">{lane.detail}</p>
              </div>
              <div className="relative my-2 mr-3 overflow-hidden rounded-sm bg-white/[0.025] [background-image:linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:14.285%_100%]">
                {lane.spans.map((span) => (
                  <div
                    key={span.alertId}
                    tabIndex={0}
                    role="img"
                    aria-label={`${span.severity} alert · ${span.rule}: ${span.label}; started ${new Date(span.startedAt).toLocaleString()}; ${span.open ? "still open" : `resolved ${new Date(span.endedAt ?? span.startedAt).toLocaleString()}`}`}
                    className={
                      `absolute top-1/2 h-6 -translate-y-1/2 truncate rounded-sm px-2 py-1 text-xs text-snow ${span.severity === "critical"
                        ? span.open ? "bg-danger/80" : "bg-danger/25"
                        : span.open ? "bg-[#a8782f]/80" : "bg-[#a8782f]/30"}`
                    }
                    style={{ left: `${span.left}%`, width: `${span.width}%` }}
                    title={`${span.severity} alert · ${span.rule} · ${span.label} · ${new Date(span.startedAt).toLocaleString()}${span.open ? " · open" : ` · resolved ${new Date(span.endedAt ?? span.startedAt).toLocaleString()}`}`}
                  >
                    {span.rule}
                    {span.open ? " · open" : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        </div>
        </>
      )}
      {lanes.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-4 border-t border-white/8 px-4 py-3 text-xs text-mute" aria-label="Alert activity legend">
            <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-danger/80" aria-hidden />Open critical alert</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-danger/25" aria-hidden />Resolved critical alert</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#a8782f]/80" aria-hidden />Open warning</span>
            <span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-[#a8782f]/30" aria-hidden />Resolved warning</span>
          </div>
          <p className="px-4 pb-3 text-xs text-mute">Alert status records response activity. Closing an alert does not prove an artifact is clean.</p>
          <table className="sr-only">
            <caption>Alert activity timeline text equivalent</caption>
            <thead><tr><th>Source</th><th>Rule</th><th>Severity</th><th>Finding</th><th>Started</th><th>Ended</th></tr></thead>
            <tbody>
              {lanes.flatMap((lane) => lane.spans.map((span) => (
                <tr key={`text-${lane.key}-${span.alertId}`}>
                  <td>{lane.label}</td><td>{span.rule}</td><td>{span.severity}</td><td>{span.label}</td>
                  <td>{new Date(span.startedAt).toLocaleString()}</td>
                  <td>{span.endedAt ? new Date(span.endedAt).toLocaleString() : "Still open"}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
