import { navigate } from "@/nav.ts";
import { kindLabel } from "@/watch/format.ts";
import { watchHref, watchPath, type WatchView } from "@/watch/routes.ts";
import { isOpenAlert, type DeskAlert, type DeskSource } from "@/watch/verdict.ts";
import { useEffect, useMemo, useState } from "react";

type Hit = { id: string; label: string; hint: string; href: string };

export function WatchCommandPalette({
  open,
  onClose,
  search,
  alerts,
  sources,
}: {
  open: boolean;
  onClose: () => void;
  search: string;
  alerts: DeskAlert[];
  sources: DeskSource[];
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const hits = useMemo(() => {
    const views: { view: WatchView; label: string; hint: string }[] = [
      { view: "overview", label: "Overview", hint: "Desk" },
      { view: "alerts", label: "Alerts", hint: "Desk" },
      { view: "sources", label: "Sources", hint: "Desk" },
      { view: "releases", label: "Releases", hint: "Desk" },
      { view: "timeline", label: "Timeline", hint: "Desk" },
      { view: "notifications", label: "Notifications", hint: "Settings" },
      { view: "policy", label: "Allowlist", hint: "Settings" },
      { view: "team", label: "Team", hint: "Settings" },
      { view: "retention", label: "Retention", hint: "Settings" },
      { view: "audit", label: "Audit log", hint: "Settings" },
      { view: "health", label: "Install health", hint: "Settings" },
      { view: "tokens", label: "Scan API", hint: "Settings" },
      { view: "registries", label: "Registries", hint: "Settings" },
    ];
    const rows: Hit[] = [
      ...views.map((item) => ({
        id: `view-${item.view}`,
        label: item.label,
        hint: item.hint,
        href: watchHref(watchPath(item.view), search),
      })),
      ...alerts.filter(isOpenAlert).map((alert) => ({
        id: `alert-${alert.id}`,
        label: alert.title,
        hint: kindLabel(alert.kind),
        href: watchHref(watchPath("alerts"), search, { alert: alert.id }),
      })),
      ...sources.map((source) => ({
        id: source.key,
        label: source.name,
        hint: source.meta,
        href: watchHref(watchPath("sources"), search),
      })),
    ];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows.slice(0, 12);
    return rows
      .filter((row) => `${row.label} ${row.hint}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [alerts, query, search, sources]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/70 px-4 pt-[12vh] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close jump menu"
        onClick={() => {
          setQuery("");
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-label="Jump"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl"
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to a page, open alert, or source"
          className="h-12 w-full border-b border-white/10 bg-transparent px-4 text-sm text-snow outline-none placeholder:text-dim"
        />
        <ul className="max-h-80 overflow-auto py-1">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-dim">Nothing matches on this install.</li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                  onClick={() => {
                    navigate(hit.href);
                    setQuery("");
                    onClose();
                  }}
                >
                  <span className="truncate text-sm text-snow">{hit.label}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-dim">{hit.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
