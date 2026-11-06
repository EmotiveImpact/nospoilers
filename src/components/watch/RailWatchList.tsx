import { useEffect, useState, type MouseEvent } from "react";
import { navigate } from "@/nav.ts";
import { uploadVerdict } from "@/watch/upload-verdict";
import type { ScanReport } from "@/report-types";

type Tone = "exposed" | "attention" | "clear" | "pending";
export type RailEntry = { id: string; label: string; kind: "website" | "artifact"; tone: Tone; verdict: string };

/** Maps a saved scan's verdict to the sidebar's status dot. */
export function railTone(verdict: string): Tone {
  if (verdict === "Review findings") return "exposed";
  if (verdict === "Policy passed" || verdict === "Policy passed with exceptions") return "clear";
  if (verdict === "Queued" || verdict === "Inspecting artifact") return "pending";
  return "attention";
}

/** The latest saved scan per package or site, newest first. */
export function railEntries(rows: { id: string; target: string; status?: string; report_json?: ScanReport | null }[]): RailEntry[] {
  const seen = new Set<string>();
  const out: RailEntry[] = [];
  for (const row of rows) {
    if (typeof row.id !== "string" || typeof row.target !== "string") continue;
    const kind = /^https?:\/\//i.test(row.target) ? "website" : "artifact";
    const label = kind === "website" ? row.target.replace(/^https?:\/\//i, "").replace(/\/$/, "") : row.target;
    const key = `${kind}:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const verdict = typeof row.status === "string" ? uploadVerdict(row.status, row.report_json ?? null) : "Result unavailable";
    out.push({ id: row.id, label, kind, tone: railTone(verdict), verdict });
  }
  return out;
}

export function useRailEntries(workspaceId: string | null) {
  const [state, setState] = useState<{ id: string; rows: RailEntry[] } | null>(null);
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    fetch(`/api/uploads?workspaceId=${encodeURIComponent(workspaceId)}&collection=uploads&pageSize=60`, { signal: controller.signal, credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (controller.signal.aborted) return;
        setState({ id: workspaceId, rows: railEntries(Array.isArray(body?.uploads) ? body.uploads : []) });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [workspaceId]);
  return workspaceId && state?.id === workspaceId ? state.rows : [];
}

const TONE_LABEL: Record<Tone, string> = { exposed: "needs review", attention: "needs a look", clear: "clear", pending: "checking" };

/** Sidebar lists of the workspace's packages and sites, each with its latest result as a dot. */
export function RailWatchList({ workspaceId, search, onNavigate, limit = 5 }: { workspaceId: string | null; search: string; onNavigate?: () => void; limit?: number }) {
  const rows = useRailEntries(workspaceId);
  const groups: [string, RailEntry[]][] = [
    ["Packages", rows.filter((row) => row.kind === "artifact").slice(0, limit)],
    ["Sites", rows.filter((row) => row.kind === "website").slice(0, limit)],
  ];
  const hrefFor = (id: string) => {
    const params = new URLSearchParams(search);
    params.set("upload", id);
    params.set("uploadView", "detail");
    return `/watch/releases?${params}`;
  };
  const open = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
    onNavigate?.();
  };
  if (!rows.length) return null;
  return (
    <>
      {groups.map(([title, items]) => items.length ? (
        <div key={title} className="watch-rail-watch flex flex-col gap-0" aria-label={title} role="group">
          <p className="watch-kicker px-2.5 pb-1.5">{title}</p>
          {items.map((item) => (
            <a key={item.id} href={hrefFor(item.id)} onClick={(event) => open(event, hrefFor(item.id))} className="watch-rail-link watch-rail-watch-link flex items-center gap-3 px-3 text-[13px] text-mute hover:text-snow" title={`${item.label}: ${item.verdict}`}>
              <i className={`watch-rail-dot is-${item.tone}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="sr-only">, {TONE_LABEL[item.tone]}</span>
            </a>
          ))}
        </div>
      ) : null)}
    </>
  );
}

/** One line for a page header: how the workspace's latest saved scans stand. */
export function releaseSummary(rows: RailEntry[]): { tone: Tone; text: string } | undefined {
  if (!rows.length) return undefined;
  const exposed = rows.filter((row) => row.tone === "exposed").length;
  const attention = rows.filter((row) => row.tone === "attention").length;
  const clear = rows.filter((row) => row.tone === "clear").length;
  const parts = [exposed ? `${exposed} need${exposed === 1 ? "s" : ""} review` : "", attention ? `${attention} need${attention === 1 ? "s" : ""} a look` : "", clear ? `${clear} passed` : ""].filter(Boolean);
  return { tone: exposed ? "exposed" : attention ? "attention" : "clear", text: `${parts.join(" · ")} · latest scan of each build` };
}
