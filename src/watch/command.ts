import { VIEW_TITLE, type WatchView, watchHref, watchPath } from "./routes.ts";

const PAGES: WatchView[] = [
  "overview", "alerts", "sources", "releases", "timeline", "setup", "notifications",
  "policy", "team", "retention", "audit", "health", "tokens", "registries",
];

export type PaletteItem = {
  id: string;
  group: "Recent" | "Jump" | "Do";
  label: string;
  detail?: string;
  href: string;
};

export function nextPaletteIndex(
  current: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
  length: number,
): number {
  if (length <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowDown") return current < 0 || current >= length - 1 ? 0 : current + 1;
  return current <= 0 ? length - 1 : current - 1;
}

export function buildPaletteItems(input: {
  query: string;
  search: string;
  teamOnly: boolean;
  adminOnly: boolean;
  alerts: { id: number; title: string }[];
  sources: { key: string; name: string }[];
  releases: { id: number; coordinate: string }[];
}): PaletteItem[] {
  const query = input.query.trim().toLowerCase();
  const pageItems: PaletteItem[] = PAGES.filter((view) => {
    if (view === "timeline" || view === "audit") return input.teamOnly;
    if (view === "tokens" || view === "registries") return input.adminOnly;
    return true;
  }).map((view) => ({
    id: `page-${view}`,
    group: query ? "Jump" : "Recent",
    label: VIEW_TITLE[view],
    href: watchHref(watchPath(view), input.search),
  }));
  const entityItems: PaletteItem[] = [
    ...input.alerts.map((row) => ({
      id: `alert-${row.id}`, group: "Jump" as const, label: row.title, detail: "Alert",
      href: watchHref(watchPath("alerts"), input.search, { alert: row.id }),
    })),
    ...input.sources.map((row) => ({
      id: `source-${row.key}`, group: "Jump" as const, label: row.name, detail: "Source",
      href: watchHref(watchPath("sources"), input.search, { source: row.key }),
    })),
    ...input.releases.map((row) => ({
      id: `release-${row.id}`, group: "Jump" as const, label: row.coordinate, detail: "Release",
      href: watchHref(watchPath("releases"), input.search, { release: row.id }),
    })),
  ];
  const actions: PaletteItem[] = [
    ...(input.adminOnly ? [{
      id: "do-add-source", group: "Do" as const, label: "Add a source",
      href: watchHref(watchPath("sources"), input.search),
    }] : []),
    {
      id: "do-health", group: "Do", label: "Test install health",
      href: watchHref(watchPath("health"), input.search),
    },
    {
      id: "do-setup", group: "Do", label: "Finish setup",
      href: watchHref(watchPath("setup"), input.search),
    },
  ];
  const all = query
    ? [...pageItems, ...entityItems, ...actions]
    : [
        ...pageItems.filter((item) =>
          ["page-overview", "page-alerts", "page-sources", "page-setup"].includes(item.id),
        ),
        ...actions,
      ];
  return all
    .filter((item) =>
      !query || `${item.label} ${item.detail ?? ""}`.toLowerCase().includes(query),
    )
    .slice(0, query ? 24 : 8);
}
