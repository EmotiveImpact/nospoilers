import type { DeskAlert } from "@/watch/verdict.ts";
import { exposureByDay } from "@/watch/exposure.ts";

function durationLabel(ms: number): string {
  if (ms <= 0) return "No exposure";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min exposed`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h exposed`;
}

export function WatchExposureChart({ alerts }: { alerts: DeskAlert[] }) {
  const days = exposureByDay(alerts);
  const peak = Math.max(...days.map((day) => day.exposedMs), 1);

  return (
    <section className="mt-6 rounded-lg border border-white/8 bg-panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm text-snow">Exposure, last 7 days</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-dim">Live alerts</span>
      </div>
      <div className="mt-6 grid h-36 grid-cols-7 items-end gap-2" aria-label="Exposure by day">
        {days.map((day) => (
          <div key={day.start} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end rounded-sm bg-white/3">
              <div
                className="w-full rounded-sm bg-danger/70"
                style={{ height: day.exposedMs ? `${Math.max(5, (day.exposedMs / peak) * 100)}%` : "0%" }}
                title={durationLabel(day.exposedMs)}
              />
            </div>
            <span className="text-[10px] text-dim">{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
