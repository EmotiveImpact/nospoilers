import { navigate } from "@/nav.ts";
import { VIEW_TITLE, type WatchView, watchHref, watchPath } from "@/watch/routes.ts";
import { useMemo, useState } from "react";

const PAGES: WatchView[] = [
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
];

export function WatchCommandPalette({
  open,
  search,
  teamOnly,
  adminOnly,
  alerts,
  sources,
  onClose,
}: {
  open: boolean;
  search: string;
  teamOnly: boolean;
  adminOnly: boolean;
  alerts: { id: number; title: string }[];
  sources: { name: string }[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = open ? query.trim().toLowerCase() : "";
  const pages = useMemo(
    () =>
      PAGES.filter((view) => {
        if (view === "timeline" || view === "audit") return teamOnly;
        if (view === "tokens" || view === "registries") return adminOnly;
        return true;
      }).filter((view) => VIEW_TITLE[view].toLowerCase().includes(q)),
    [adminOnly, q, teamOnly],
  );
  const alertHits = alerts.filter((row) => row.title.toLowerCase().includes(q)).slice(0, 6);
  const sourceHits = sources.filter((row) => row.name.toLowerCase().includes(q)).slice(0, 6);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="Close command palette" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, alerts, sources…"
          className="h-12 w-full border-b border-white/8 bg-transparent px-4 text-sm text-snow outline-none placeholder:text-dim"
        />
        <div className="max-h-80 overflow-auto py-2">
          {pages.map((view) => (
            <button
              key={view}
              type="button"
              className="flex w-full px-4 py-2 text-left text-sm text-mute hover:bg-white/5 hover:text-snow"
              onClick={() => {
                navigate(watchHref(watchPath(view), search));
                onClose();
              }}
            >
              {VIEW_TITLE[view]}
            </button>
          ))}
          {alertHits.map((row) => (
            <button
              key={`a-${row.id}`}
              type="button"
              className="flex w-full px-4 py-2 text-left text-sm text-mute hover:bg-white/5 hover:text-snow"
              onClick={() => {
                navigate(watchHref(watchPath("alerts"), search, { alert: row.id }));
                onClose();
              }}
            >
              Alert · {row.title}
            </button>
          ))}
          {sourceHits.map((row) => (
            <button
              key={`s-${row.name}`}
              type="button"
              className="flex w-full px-4 py-2 text-left font-mono text-sm text-mute hover:bg-white/5 hover:text-snow"
              onClick={() => {
                navigate(watchHref(watchPath("sources"), search));
                onClose();
              }}
            >
              {row.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
