import { formatExposure, leadFinding } from "./format.ts";
import type { AlertTab } from "./routes.ts";

export type DeskAlert = {
  id: number;
  kind: string;
  title: string;
  body: string;
  findings: { rule: string; path: string; severity?: string }[] | null;
  created_at: string;
  full_name?: string | null;
  acknowledged_at?: string | null;
  assigned_to_login?: string | null;
  assigned_to_user_id?: string | null;
  resolved_at?: string | null;
  exposure_ms?: number;
};

export type DeskVerdict = {
  title: string;
  detail: string;
  tone: "ok" | "warn" | "crit" | "pending" | "paused" | "ended" | "empty";
};

export function isOpenAlert(alert: DeskAlert): boolean {
  return !alert.resolved_at;
}

export function alertAssignedTo(alert:DeskAlert,login:string,userId?:string):boolean{
  if(userId)return alert.assigned_to_user_id===userId;
  const who=login.trim().toLowerCase();
  return !!who&&(alert.assigned_to_login??'').trim().toLowerCase()===who;
}

export function filterDeskAlerts<T extends DeskAlert>(
  alerts: T[],
  tab: AlertTab,
  login: string,
  assignedOnly = false,
  userId?:string,
): T[] {
  if(assignedOnly){
    alerts=alerts.filter(row=>alertAssignedTo(row,login,userId));
  }
  if (tab === "done") return alerts.filter((row) => Boolean(row.resolved_at));
  if (tab === "waiting") {
    return alerts.filter((row) => !row.resolved_at && Boolean(row.acknowledged_at));
  }
  if (tab === "mine") {
    return alerts.filter(
      (row) => !row.resolved_at && alertAssignedTo(row,login,userId),
    );
  }
  return alerts.filter(row => !row.resolved_at && !row.acknowledged_at);
}

export function newestOpenAlert(alerts: DeskAlert[]): DeskAlert | null {
  const open = alerts.filter(isOpenAlert);
  if (open.length === 0) return null;
  return (
    [...open].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0] ??
    null
  );
}

export function deskVerdict(input: {
  ended: boolean;
  githubPaused: boolean;
  sourceCount: number;
  checkedSourceCount?: number;
  criticalSourceCount?: number;
  checksInFlight?: number;
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
      tone: "paused",
    };
  }
  if (input.sourceCount === 0) {
    return {
      title: "Nothing is being watched yet.",
      detail: "Install on one private repo and this sentence starts telling you the truth about your releases.",
      tone: "empty",
    };
  }
  if (open.length > 0) {
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
  if ((input.criticalSourceCount ?? 0) > 0) {
    const count = input.criticalSourceCount ?? 0;
    return {
      title: count === 1 ? "One source needs attention." : `${count} sources need attention.`,
      detail:
        "A connected source reports exposure evidence. Review the source now even if its alert has not reached the inbox yet.",
      tone: "crit",
    };
  }
  const checkedSourceCount = Math.min(input.sourceCount, Math.max(0, input.checkedSourceCount ?? 0));
  const uncheckedSourceCount = input.sourceCount - checkedSourceCount;
  if ((input.checksInFlight ?? 0) > 0) {
    return {
      title: "A check is running.",
      detail:
        "A source is connected, but there is no release verdict yet. This page will update when the current check produces evidence.",
      tone: "pending",
    };
  }
  if (checkedSourceCount === 0) {
    return {
      title: "Connected. Not checked yet.",
      detail:
        "NoSpoilers can see the source, but it has not produced evidence yet. Run the first check before treating this release as clear.",
      tone: "pending",
    };
  }
  if (uncheckedSourceCount > 0) {
    return {
      title: "Some sources still need proof.",
      detail: `${checkedSourceCount} of ${input.sourceCount} ${input.sourceCount === 1 ? "source has" : "sources have"} recorded evidence. Check the remaining ${uncheckedSourceCount} before relying on a clean verdict.`,
      tone: "warn",
    };
  }
  return {
    title: "No exposure is known from the latest checks.",
    detail: `${checkedSourceCount} ${checkedSourceCount === 1 ? "source has" : "sources have"} recorded evidence and no open exposure alerts. NoSpoilers will keep checking for changes.`,
    tone: "ok",
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

export function setupProgress(input: {
  repos: number;
  packages: number;
  origins: number;
  maps: number;
  tokens: number;
}): { done: number; total: number; steps: { key: string; label: string; done: boolean }[] } {
  const steps = [
    { key: "repos", label: "Watch a GitHub repository", done: input.repos > 0 },
    { key: "packages", label: "Watch what the registry actually serves", done: input.packages > 0 },
    { key: "origins", label: "Watch a production website", done: input.origins > 0 },
    { key: "maps", label: "Connect map custody", done: input.maps > 0 },
    { key: "tokens", label: "Mint a Scan API token", done: input.tokens > 0 },
  ];
  return { done: steps.filter((step) => step.done).length, total: steps.length, steps };
}
