import type { DeskAlert } from "./verdict.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(value: number): number {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function exposureByDay(alerts: DeskAlert[], now = Date.now(), days = 7) {
  const today = utcDayStart(now);
  return Array.from({ length: days }, (_, index) => {
    const start = today - (days - index - 1) * DAY_MS;
    const end = start + DAY_MS;
    const exposedMs = alerts.reduce((total, alert) => {
      const opened = Date.parse(alert.created_at);
      const closed = alert.resolved_at ? Date.parse(alert.resolved_at) : now;
      if (!Number.isFinite(opened) || !Number.isFinite(closed)) return total;
      return total + Math.max(0, Math.min(closed, end) - Math.max(opened, start));
    }, 0);
    return {
      start,
      label: new Date(start).toLocaleDateString(undefined, {
        weekday: "short",
        timeZone: "UTC",
      }),
      exposedMs,
    };
  });
}
