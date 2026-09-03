import type { DeskAlert } from "@/watch/verdict.ts";
import { buildTimelineLanes } from "@/watch/view-models.ts";
import { useState } from "react";

export function WatchExposureChart({
  alerts,
  days = 7,
  compact = false,
}: {
  alerts: DeskAlert[];
  days?: number;
  compact?: boolean;
}) {
  const [now] = useState(() => Date.now());
  const lanes = buildTimelineLanes(alerts, { days, now });
  const ticks = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now - (7 - index) * (days / 7) * 86_400_000);
    return index === 7
      ? "Today"
      : date.toLocaleDateString(undefined, {
          weekday: "short",
          timeZone: "UTC",
        });
  });

  return (
    <section className="watch-gantt mt-6 overflow-hidden rounded-lg border border-white/8 bg-panel">
      <div className="flex items-baseline justify-between gap-3 border-b border-white/8 px-4 py-3">
        <h2 className="text-sm text-snow">Exposure, last {days} days</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-dim">
          {lanes.some((lane) => lane.spans.some((span) => span.open)) ? "open exposure" : "all closed"}
        </span>
      </div>
      {lanes.length === 0 ? (
        <p className="px-4 py-8 text-sm text-mute">No exposure to plot from real alert history.</p>
      ) : (
        <div className="min-w-[620px]" aria-label="Exposure by source and retained time">
          <div className="grid grid-cols-[minmax(150px,220px)_1fr] border-b border-white/8">
            <span className="px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-dim">Source</span>
            <div className="grid grid-cols-8 px-3 py-2">
              {ticks.map((tick, index) => (
                <span key={`${tick}-${index}`} className="text-[10px] text-dim last:text-right">
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
                <p className="mt-1 truncate text-[10px] text-dim">{lane.detail}</p>
              </div>
              <div className="relative my-2 mr-3 overflow-hidden rounded-sm bg-white/[0.025] [background-image:linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:14.285%_100%]">
                {lane.spans.map((span) => (
                  <div
                    key={span.alertId}
                    className={
                      span.open
                        ? "absolute top-1/2 h-6 -translate-y-1/2 truncate rounded-sm bg-danger/80 px-2 py-1 text-[10px] text-white"
                        : span.severity === "critical"
                          ? "absolute top-1/2 h-6 -translate-y-1/2 truncate rounded-sm bg-danger/25 px-2 py-1 text-[10px] text-snow"
                          : "absolute top-1/2 h-6 -translate-y-1/2 truncate rounded-sm bg-[#a8782f]/55 px-2 py-1 text-[10px] text-snow"
                    }
                    style={{ left: `${span.left}%`, width: `${span.width}%` }}
                    title={`${span.rule} · ${span.label}${span.open ? " · open" : " · resolved"}`}
                  >
                    {span.rule}
                    {span.open ? " · open" : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
