export const WATCH_VIEWS = [
  "overview",
  "alerts",
  "sources",
  "releases",
  "timeline",
  "setup",
  "notifications",
  "policy",
  "team",
  "retention",
  "audit",
  "health",
  "tokens",
  "registries",
] as const;

export type WatchView = (typeof WATCH_VIEWS)[number];
export type AlertTab = "open" | "waiting" | "mine" | "done";
export type SourceFilter = "all" | "github" | "npm" | "website" | "map";
export type SourceConfigure = Exclude<SourceFilter, "all">;

export type WatchRoute = {
  view: WatchView;
  alertId: number | null;
  releaseId: number | null;
  sourceKey: string | null;
  sourceFilter: SourceFilter;
  sourceAttention: boolean;
  sourceConfigure: SourceConfigure | null;
  tab: AlertTab;
};

const VIEW_SET = new Set<string>(WATCH_VIEWS);
const TAB_SET = new Set<string>(["open", "waiting", "mine", "done"]);
const SOURCE_FILTER_SET = new Set<string>(["all", "github", "npm", "website", "map"]);

export const VIEW_TITLE: Record<WatchView, string> = {
  overview: "Overview",
  alerts: "Alerts",
  sources: "Sources",
  releases: "Releases",
  timeline: "Timeline",
  setup: "Finish setup",
  notifications: "Notifications",
  policy: "Policy & allowlist",
  team: "Team & roles",
  retention: "Retention",
  audit: "Audit log",
  health: "Install health",
  tokens: "Scan API tokens",
  registries: "Private registries",
};

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function parseWatchRoute(path: string, search: string): WatchRoute {
  const params = paramsOf(search);
  const rawAlert = Number(params.get("alert"));
  const alertId = Number.isFinite(rawAlert) && rawAlert > 0 ? rawAlert : null;
  const rawRelease = Number(params.get("release"));
  const releaseId = Number.isFinite(rawRelease) && rawRelease > 0 ? rawRelease : null;
  const rawSource = params.get("source")?.trim() ?? "";
  const sourceKey = /^(repo|npm|web|map)-\d+$/.test(rawSource) ? rawSource : null;
  const rawSourceFilter = params.get("sourceType") ?? "";
  const sourceFilter: SourceFilter = SOURCE_FILTER_SET.has(rawSourceFilter)
    ? (rawSourceFilter as SourceFilter)
    : "all";
  const sourceAttention = params.get("attention") === "1";
  const rawConfigure = params.get("configure") ?? "";
  const sourceConfigure: SourceConfigure | null =
    rawConfigure !== "all" && SOURCE_FILTER_SET.has(rawConfigure)
      ? (rawConfigure as SourceConfigure)
      : null;
  const rawTab = params.get("tab") ?? "";
  const tab: AlertTab = TAB_SET.has(rawTab) ? (rawTab as AlertTab) : "open";
  const trimmed = path.replace(/\/+$/, "") || "/watch";
  if (trimmed === "/watch") {
    return { view: "overview", alertId, releaseId, sourceKey, sourceFilter, sourceAttention, sourceConfigure, tab };
  }
  if (trimmed.startsWith("/watch/")) {
    const page = trimmed.slice("/watch/".length);
    if (VIEW_SET.has(page)) {
      return { view: page as WatchView, alertId, releaseId, sourceKey, sourceFilter, sourceAttention, sourceConfigure, tab };
    }
  }
  return { view: "overview", alertId, releaseId, sourceKey, sourceFilter, sourceAttention, sourceConfigure, tab };
}

export function watchPath(view: WatchView): string {
  return view === "overview" ? "/watch" : `/watch/${view}`;
}

export function watchHref(
  path: string,
  search: string,
  extra: {
    install?: number | null;
    alert?: number | null;
    release?: number | null;
    source?: string | null;
    sourceType?: SourceFilter | null;
    attention?: boolean | null;
    configure?: SourceConfigure | null;
    tab?: AlertTab | null;
  } = {},
): string {
  const params = paramsOf(search);
  if (extra.install !== undefined) {
    if (extra.install) params.set("install", String(extra.install));
    else params.delete("install");
  }
  if (extra.alert !== undefined) {
    if (extra.alert) params.set("alert", String(extra.alert));
    else params.delete("alert");
  }
  if (extra.release !== undefined) {
    if (extra.release) params.set("release", String(extra.release));
    else params.delete("release");
  }
  if (extra.source !== undefined) {
    if (extra.source) params.set("source", extra.source);
    else params.delete("source");
  }
  if (extra.sourceType !== undefined) {
    if (extra.sourceType && extra.sourceType !== "all") params.set("sourceType", extra.sourceType);
    else params.delete("sourceType");
  }
  if (extra.attention !== undefined) {
    if (extra.attention) params.set("attention", "1");
    else params.delete("attention");
  }
  if (extra.configure !== undefined) {
    if (extra.configure) params.set("configure", extra.configure);
    else params.delete("configure");
  }
  if (extra.tab !== undefined) {
    if (extra.tab && extra.tab !== "open") params.set("tab", extra.tab);
    else params.delete("tab");
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function isWatchDeskPath(path: string): boolean {
  return path === "/watch" || path.startsWith("/watch/");
}
