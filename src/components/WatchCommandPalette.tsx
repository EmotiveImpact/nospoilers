import { navigate } from "@/nav.ts";
import { VIEW_TITLE, type WatchView, watchHref, watchPath } from "@/watch/routes.ts";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

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
  const commandMatches = [
    { label: "Add a source", view: "sources" as const },
    { label: "Test install health", view: "health" as const },
    { label: "Finish setup", view: "setup" as const },
  ].filter((command) => command.label.toLowerCase().includes(q));

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      document.querySelector<HTMLButtonElement>("[data-palette-item]")?.focus();
      return;
    }
    if (event.key === "Enter" && pages[0]) {
      event.preventDefault();
      navigate(watchHref(watchPath(pages[0]), search));
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="Close command palette" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Search pages, alerts, sources…"
          className="h-12 w-full border-b border-white/8 bg-transparent px-4 text-sm text-snow outline-none placeholder:text-dim"
        />
        <div className="max-h-80 overflow-auto py-2">
          <p className="px-4 pb-1 pt-1 text-[10px] uppercase tracking-[0.18em] text-dim">Jump</p>
          {pages.map((view) => (
            <button
              key={view}
              data-palette-item
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
          {commandMatches.length > 0 ? (
            <p className="mt-2 border-t border-white/8 px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-dim">Do</p>
          ) : null}
          {commandMatches.map((command) => (
            <button
              key={command.label}
              data-palette-item
              type="button"
              className="flex w-full items-center px-4 py-2 text-left text-sm text-mute hover:bg-white/5 hover:text-snow focus:bg-white/5 focus:text-snow focus:outline-none"
              onClick={() => {
                navigate(watchHref(watchPath(command.view), search));
                onClose();
              }}
            >
              <span className="mr-2 text-dim">→</span>
              {command.label}
            </button>
          ))}
          {alertHits.length > 0 ? (
            <p className="mt-2 border-t border-white/8 px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-dim">Alerts</p>
          ) : null}
          {alertHits.map((row) => (
            <button
              key={`a-${row.id}`}
              data-palette-item
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
          {sourceHits.length > 0 ? (
            <p className="mt-2 border-t border-white/8 px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em] text-dim">Sources</p>
          ) : null}
          {sourceHits.map((row) => (
            <button
              key={`s-${row.name}`}
              data-palette-item
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
