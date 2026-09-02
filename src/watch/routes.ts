export const DESK_VIEWS = [
  "overview",
  "alerts",
  "sources",
  "releases",
  "timeline",
  "setup",
] as const;

export const SETTINGS_VIEWS = [
  "notifications",
  "policy",
  "team",
  "retention",
  "audit",
  "health",
  "tokens",
  "registries",
] as const;

export type DeskView = (typeof DESK_VIEWS)[number];
export type SettingsView = (typeof SETTINGS_VIEWS)[number];
export type WatchView = DeskView | SettingsView;
export type WatchWall = "desk" | "settings";
export type AlertTab = "open" | "waiting" | "mine" | "done";

export type WatchRoute = {
  wall: WatchWall;
  view: WatchView;
  alertId: number | null;
  tab: AlertTab;
};

const DESK_SET = new Set<string>(DESK_VIEWS);
const SETTINGS_SET = new Set<string>(SETTINGS_VIEWS);
const TAB_SET = new Set<string>(["open", "waiting", "mine", "done"]);

function paramsOf(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function parseWatchRoute(path: string, search: string): WatchRoute {
  const params = paramsOf(search);
  const rawAlert = Number(params.get("alert"));
  const alertId = Number.isFinite(rawAlert) && rawAlert > 0 ? rawAlert : null;
  const rawTab = params.get("tab") ?? "";
  const tab: AlertTab = TAB_SET.has(rawTab) ? (rawTab as AlertTab) : "open";

  const trimmed = path.replace(/\/+$/, "") || "/watch";
  if (trimmed === "/watch") {
    return { wall: "desk", view: "overview", alertId, tab };
  }
  if (trimmed === "/watch/settings") {
    return { wall: "settings", view: "notifications", alertId, tab };
  }
  if (trimmed.startsWith("/watch/settings/")) {
    const panel = trimmed.slice("/watch/settings/".length);
    if (SETTINGS_SET.has(panel)) {
      return { wall: "settings", view: panel as SettingsView, alertId, tab };
    }
    return { wall: "settings", view: "notifications", alertId, tab };
  }
  if (trimmed.startsWith("/watch/")) {
    const page = trimmed.slice("/watch/".length);
    if (DESK_SET.has(page)) {
      return { wall: "desk", view: page as DeskView, alertId, tab };
    }
    if (SETTINGS_SET.has(page)) {
      return { wall: "settings", view: page as SettingsView, alertId, tab };
    }
  }
  return { wall: "desk", view: "overview", alertId, tab };
}

export function watchPath(view: WatchView): string {
  if (view === "overview") return "/watch";
  if (SETTINGS_SET.has(view)) return `/watch/settings/${view}`;
  return `/watch/${view}`;
}

export function watchHref(
  path: string,
  search: string,
  extra: { install?: number | null; alert?: number | null; tab?: AlertTab | null } = {},
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
  if (extra.tab !== undefined) {
    if (extra.tab && extra.tab !== "open") params.set("tab", extra.tab);
    else params.delete("tab");
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function deskHref(search: string, install?: number | null): string {
  return watchHref("/watch", search, install !== undefined ? { install } : {});
}

export function settingsHref(search: string, view: SettingsView = "notifications"): string {
  return watchHref(watchPath(view), search);
}

export function isWatchDeskPath(path: string): boolean {
  return path === "/watch" || path.startsWith("/watch/");
}
