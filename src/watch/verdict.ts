import { formatExposure, leadFinding } from "./format.ts";
import type { AlertTab } from "./routes.ts";

export type DeskAlert = {
  id: number;
  kind: string;
  title: string;
  body: string;
  findings: { rule: string; path: string }[] | null;
  created_at: string;
  full_name?: string | null;
  acknowledged_at?: string | null;
  assigned_to_login?: string | null;
  resolved_at?: string | null;
  exposure_ms?: number;
};

export type DeskSource = {
  key: string;
  kind: "repo" | "npm" | "origin" | "map";
  name: string;
  meta: string;
  href?: string | null;
};

export type DeskVerdict = {
  title: string;
  detail: string;
  tone: "ok" | "warn" | "crit" | "ended" | "empty";
};

export function isOpenAlert(alert: DeskAlert): boolean {
  return !alert.resolved_at;
}

export function filterDeskAlerts(alerts: DeskAlert[], tab: AlertTab, login: string): DeskAlert[] {
  if (tab === "done") return alerts.filter((row) => Boolean(row.resolved_at));
  if (tab === "waiting") {
    return alerts.filter((row) => !row.resolved_at && !row.acknowledged_at);
  }
  if (tab === "mine") {
    const who = login.trim().toLowerCase();
    return alerts.filter((row) => (row.assigned_to_login ?? "").trim().toLowerCase() === who);
  }
  return alerts.filter(isOpenAlert);
}

export function newestOpenAlert(alerts: DeskAlert[]): DeskAlert | null {
  const open = alerts.filter(isOpenAlert);
  if (open.length === 0) return null;
  return [...open].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0] ?? null;
}

export function deskVerdict(input: {
  ended: boolean;
  githubPaused: boolean;
  sourceCount: number;
  alerts: DeskAlert[];
}): DeskVerdict {
  const open = input.alerts.filter(isOpenAlert);
  if (input.ended) {
    return {
      title: "We stopped looking.",
      detail:
        "Trial ended. We stop new jobs and scans until Solo $29 or Team $99 is active. Repos stay listed. Existing alerts can still be acknowledged and resolved.",
      tone: "ended",
    };
  }
  if (input.githubPaused) {
    return {
      title: "GitHub suspended the NoSpoilers App.",
      detail: "Repositories stay listed. We do not scan until GitHub unsuspends it.",
      tone: "ended",
    };
  }
  if (input.sourceCount === 0) {
    return {
      title: "Nothing is being watched yet.",
      detail: "Install on one private repo. Settings stays empty until there is an install to configure.",
      tone: "empty",
    };
  }
  if (open.length === 0) {
    return {
      title: "Nothing is exposed right now.",
      detail: "Quiet so far. That is the good state — until a repo goes public or a release ships a map.",
      tone: "ok",
    };
  }
  const lead = newestOpenAlert(open);
  const finding = lead ? leadFinding(lead) : null;
  const clock = lead ? formatExposure(lead.exposure_ms, lead.created_at, lead.resolved_at) : "";
  const where = finding ? `${finding.rule} · ${finding.path}` : (lead?.full_name ?? lead?.title ?? "");
  return {
    title: open.length === 1 ? "One thing is exposed right now." : `${open.length} things are exposed right now.`,
    detail: lead ? `${lead.title}${clock ? ` · exposed ${clock}` : ""}${where ? ` · ${where}` : ""}` : "",
    tone: "crit",
  };
}

export function longestOpenExposure(alerts: DeskAlert[]): string {
  const open = alerts.filter(isOpenAlert);
  if (open.length === 0) return "0";
  let best = 0;
  let label = "under a minute";
  for (const row of open) {
    const start = Date.parse(row.created_at);
    const ms =
      typeof row.exposure_ms === "number" && Number.isFinite(row.exposure_ms)
        ? row.exposure_ms
        : Number.isFinite(start)
          ? Math.max(0, Date.now() - start)
          : 0;
    if (ms >= best) {
      best = ms;
      label = formatExposure(row.exposure_ms, row.created_at, row.resolved_at);
    }
  }
  return label;
}
