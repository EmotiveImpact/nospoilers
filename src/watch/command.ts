import { VIEW_TITLE, type WatchView, watchHref, watchPath } from "./routes.ts";

const PAGES: WatchView[] = [
  "overview", "alerts", "sources", "releases", "timeline", "setup", "notifications",
  "policy", "team", "retention", "audit", "health", "tokens", "registries",
  "workspaces",
];
const ARTIFACT_PAGES:WatchView[]=['overview','alerts','sources','releases','team','policy','retention','audit','tokens','notifications','workspaces'];

export type PaletteItem = {
  id: string;
  group: "Pages" | "Alerts" | "Sources" | "Releases" | "Actions";
  label: string;
  detail?: string;
  keywords?: string;
  href: string;
};

const PAGE_KEYWORDS: Partial<Record<WatchView, string>> = {
  overview: "dashboard home summary",
  alerts: "findings issues inbox response",
  sources: "source sources repo repos repository repositories packages websites coverage",
  releases: "build builds artifact artifacts upload uploads evidence results attempts",
  timeline: "activity history events",
  notifications: "email slack destinations messages",
  policy: "rules allowlist exceptions",
  team: "people members invite invitations access roles permissions",
  retention: "storage delete cleanup",
  audit: "activity history access log",
  health: "connection diagnostics github",
  tokens: "api credentials automation",
  registries: "npm packages registry credentials",
  workspaces: "settings organisation organization workspace",
};
const GROUPS: PaletteItem["group"][] = ["Pages", "Alerts", "Sources", "Releases", "Actions"];
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function matchScore(item: PaletteItem, query: string): number {
  const label = normalize(item.label);
  const terms = query.split(" ");
  const searchable = normalize(`${item.label} ${item.detail ?? ""} ${item.keywords ?? ""}`);
  if (!terms.every(term => searchable.includes(term))) return Infinity;
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (terms.every(term => label.split(" ").some(word => word.startsWith(term)))) return 2;
  if (label.includes(query)) return 3;
  if (terms.every(term => label.includes(term))) return 4;
  return 5;
}

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
  artifactOnly?: boolean;
  alerts: { id: number; title: string }[];
  sources: { key: string; name: string }[];
  releases: { id: number; coordinate: string }[];
}): PaletteItem[] {
  const query = normalize(input.query);
  const pageItems: PaletteItem[] = PAGES.filter((view) => {
    if(input.artifactOnly)return ARTIFACT_PAGES.includes(view);
    if (view === "timeline" || view === "audit") return input.teamOnly;
    if (view === "tokens" || view === "registries") return input.adminOnly;
    return true;
  }).map((view) => ({
    id: `page-${view}`,
    group: "Pages",
    label: input.artifactOnly&&view==='policy'?'Scan policy':VIEW_TITLE[view],
    keywords: PAGE_KEYWORDS[view],
    href: watchHref(watchPath(view), input.search),
  }));
  const billingSearch = new URLSearchParams(input.search);
  billingSearch.set("workspaceTab", "billing");
  pageItems.push({id:"page-billing",group:"Pages",label:"Plan & billing",keywords:"subscription pricing payment trial invoices",href:watchHref(watchPath("workspaces"),billingSearch.toString())});
  const entityItems: PaletteItem[] = input.artifactOnly?[]:[
    ...input.alerts.map((row) => ({
      id: `alert-${row.id}`, group: "Alerts" as const, label: row.title, detail: "Alert",
      href: watchHref(watchPath("alerts"), input.search, { alert: row.id }),
    })),
    ...input.sources.map((row) => ({
      id: `source-${row.key}`, group: "Sources" as const, label: row.name, detail: "Source",
      href: watchHref(watchPath("sources"), input.search, { source: row.key }),
    })),
    ...input.releases.map((row) => ({
      id: `release-${row.id}`, group: "Releases" as const, label: row.coordinate, detail: "Release",
      href: watchHref(watchPath("releases"), input.search, { release: row.id }),
    })),
  ];
  const actions: PaletteItem[] = [
    {
      id: "do-new-scan", group: "Actions", label: "New scan", keywords: "upload build check artifact",
      href: watchHref(watchPath("scan"), input.search),
    },
    ...(input.adminOnly&&!input.artifactOnly ? [{
      id: "do-add-source", group: "Actions" as const, label: "Add a source", keywords: "connect monitoring",
      href: watchHref(watchPath("sources"), input.search),
    }] : []),
    ...(!input.artifactOnly?[{
      id: "do-health", group: "Actions", label: "Test install health",
      href: watchHref(watchPath("health"), input.search),
    },
    {
      id: "do-setup", group: "Actions", label: "Finish setup",
      href: watchHref(watchPath("setup"), input.search),
    }] as PaletteItem[]:[]),
  ];
  const all = query
    ? [...pageItems, ...entityItems, ...actions]
    : [
        ...pageItems.filter((item) =>
          input.artifactOnly || ["page-overview", "page-alerts", "page-sources", "page-releases", "page-team", "page-billing"].includes(item.id),
        ),
        ...actions,
      ];
  if (!query) return all;
  // Keep each category together, ordering its best name matches before keyword matches.
  const groups = GROUPS.map(group => all
    .filter(item => item.group === group)
    .map(item => ({item, score: matchScore(item, query)}))
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score))
    .filter(group => group.length)
    .sort((a, b) => a[0].score - b[0].score);
  return groups.flatMap(group => group.map(result => result.item)).slice(0, 24);
}
