import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertListViewModel } from "@/watch/view-models.ts";
import type { AlertActivityEvent } from "@/watch/useWatchDeskController.ts";
import { useState } from "react";

export type WatchAlertDetail = {
  id: number;
  kind: string;
  title: string;
  body: string;
  findings: { rule: string; path: string }[] | null;
  created_at: string;
  full_name?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by_login?: string | null;
  assigned_to_login?: string | null;
  resolved_at?: string | null;
  resolved_by_login?: string | null;
  resolution_note?: string | null;
  exposure_ms?: number;
  rotation_checklist?: string[];
};

export function WatchAlertsWorkspace({
  alerts,
  rows,
  selected,
  events,
  previewing,
  ended,
  busy,
  note,
  assignee,
  error,
  exportError,
  onSelect,
  onNote,
  onAssignee,
  onAction,
  onExport,
}: {
  alerts: WatchAlertDetail[];
  rows: AlertListViewModel[];
  selected: WatchAlertDetail | null;
  events: AlertActivityEvent[];
  previewing: boolean;
  ended: boolean;
  busy: boolean;
  note: string;
  assignee: string;
  error: string | null;
  exportError: string | null;
  onSelect: (alertId: number) => void;
  onNote: (value: string) => void;
  onAssignee: (value: string) => void;
  onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void;
  onExport: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const selectedIndex = selected ? alerts.findIndex((alert) => alert.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? alerts[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < alerts.length - 1 ? alerts[selectedIndex + 1] : null;
  const selectedRow = selected ? rows.find((row) => row.id === selected.id) : null;

  return (
    <section className="-mx-5 -my-8 flex h-[calc(100svh-3.5rem)] min-h-[560px] flex-col md:-mx-8">
      {ended ? (
        <div className="flex items-center gap-3 border-b border-danger/25 bg-danger/8 px-5 py-2.5 text-xs text-snow">
          <span className="size-1.5 rounded-full bg-danger" />
          No new jobs run. Existing alerts can still be acknowledged, assigned, resolved, and reopened.
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/8 bg-[#0d0d10] lg:border-b-0 lg:border-r">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-4">
            <div className="flex items-center gap-2">
              <strong className="text-sm text-snow">Inbox</strong>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-dim">{rows.length}</span>
            </div>
            {!previewing ? (
              <Button type="button" size="sm" variant="ghost" onClick={onExport}>Export JSON</Button>
            ) : null}
          </div>
          {exportError ? <p className="border-b border-white/8 px-4 py-2 text-xs text-danger">{exportError}</p> : null}
          <ol className="min-h-0 flex-1 divide-y divide-white/5 overflow-auto">
            {rows.length === 0 ? (
              <li className="px-5 py-10 text-center">
                <p className="text-sm text-snow">This view is clear.</p>
                <p className="mt-1 text-xs text-dim">No real alerts match this saved view.</p>
              </li>
            ) : (
              rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full border-l-2 border-transparent px-4 py-3 text-left hover:bg-white/[0.035]",
                      selected?.id === row.id && "border-l-snow bg-white/[0.055]",
                    )}
                    onClick={() => onSelect(row.id)}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          row.status === "resolved"
                            ? "bg-white/25"
                            : row.severity === "critical"
                              ? "bg-danger"
                              : "bg-[#b18134]",
                        )}
                      />
                      <strong className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-snow">{row.title}</strong>
                      <span className="shrink-0 text-[10px] text-dim">{row.exposure}</span>
                    </span>
                    <span className="mt-1.5 block truncate pl-3.5 font-mono text-[10px] text-dim">
                      {row.coordinate} · {row.rule}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ol>
        </aside>

        <main className="min-h-0 bg-ink">
          {!selected || !selectedRow ? (
            <div className="grid h-full place-items-center px-5 text-center">
              <div>
                <p className="text-sm text-snow">Nothing selected.</p>
                <p className="mt-1 text-xs text-dim">Findings, exposure, and activity open here.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="sticky top-0 z-10 flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-white/8 bg-ink/95 px-4 py-2 backdrop-blur">
                {!selected.acknowledged_at && !selected.resolved_at ? (
                  <Button type="button" size="sm" disabled={previewing || busy} onClick={() => onAction("acknowledge")}>
                    Acknowledge
                  </Button>
                ) : selected.acknowledged_at ? (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-mute">Acknowledged</span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={previewing || busy || (!selected.resolved_at && note.trim().length < 8)}
                  onClick={() => onAction(selected.resolved_at ? "reopen" : "resolve")}
                >
                  {selected.resolved_at ? "Reopen" : "Resolve"}
                </Button>
                {!selected.resolved_at ? (
                  <Button type="button" size="sm" variant="outline" disabled={previewing || busy} onClick={() => setAssignOpen(true)}>
                    {selected.assigned_to_login ? `@${selected.assigned_to_login}` : "Assign"}
                  </Button>
                ) : null}
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" disabled={!previous} onClick={() => previous && onSelect(previous.id)} aria-label="Previous alert">↑</Button>
                  <Button type="button" size="sm" variant="ghost" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next alert">↓</Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-5 py-6 lg:px-8">
                <div className="mx-auto max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className={selected.resolved_at ? "watch-pill watch-pill-ok" : selectedRow.severity === "critical" ? "watch-pill watch-pill-crit" : "watch-pill watch-pill-warn"}>
                      {selected.resolved_at ? "resolved" : selectedRow.severity}
                    </span>
                    <span className="watch-pill">{selectedRow.rule}</span>
                    <span className="watch-pill">{selectedRow.status} · {selectedRow.exposure} exposed</span>
                  </div>
                  <h1 className="mt-4 font-display text-2xl leading-tight text-snow md:text-3xl">{selected.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">{selected.body}</p>

                  <section className="mt-8">
                    <p className="watch-kicker">Where</p>
                    <div className="mt-2 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
                      {(selected.findings ?? []).length ? (
                        selected.findings?.map((finding) => (
                          <div key={`${finding.rule}:${finding.path}`} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                            <span className="font-mono text-xs text-snow">{finding.rule}</span>
                            <span className="truncate font-mono text-xs text-mute">{finding.path}</span>
                            <span className={selectedRow.severity === "critical" ? "watch-pill watch-pill-crit" : "watch-pill watch-pill-warn"}>{selectedRow.severity}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-xs text-mute">{selected.full_name ?? selected.kind}</div>
                      )}
                    </div>
                  </section>

                  <section className="mt-7">
                    <p className="watch-kicker">Exposure</p>
                    <div className="mt-2 grid gap-4 rounded-lg border border-white/8 bg-panel p-4 sm:grid-cols-2">
                      <div>
                        <p className="watch-kicker">Reachable for</p>
                        <p className={selected.resolved_at ? "mt-1 font-display text-2xl text-snow" : "mt-1 font-display text-2xl text-danger"}>{selectedRow.exposure}</p>
                      </div>
                      <div>
                        <p className="watch-kicker">Opened</p>
                        <p className="mt-1 font-display text-2xl text-snow">{new Date(selected.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </section>

                  <section className="mt-7">
                    <p className="watch-kicker">Rotation checklist · read-only</p>
                    <div className="mt-2 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                      {(selected.rotation_checklist ?? []).length ? (
                        selected.rotation_checklist?.map((item) => (
                          <label key={item} className="flex gap-3 py-3 text-xs leading-relaxed text-mute">
                            <input type="checkbox" disabled className="mt-0.5" />
                            {item}
                          </label>
                        ))
                      ) : (
                        <p className="py-3 text-xs text-dim">No checklist was attached to this alert.</p>
                      )}
                    </div>
                  </section>

                  <section className="mt-7 pb-10">
                    <p className="watch-kicker">Activity</p>
                    <div className="mt-2 rounded-lg border border-white/8 bg-panel px-4">
                      <div className="flex gap-3 border-b border-white/5 py-3 text-xs text-mute">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-[10px] text-snow">NS</span>
                        <p><span className="text-snow">NoSpoilers</span> opened this from {selected.kind} · {new Date(selected.created_at).toLocaleString()}</p>
                      </div>
                      {events.map((event) => (
                        <div key={event.id} className="flex gap-3 border-b border-white/5 py-3 text-xs text-mute last:border-b-0">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-[10px] text-snow">{event.actor_login.slice(0, 2).toUpperCase()}</span>
                          <p><span className="text-snow">@{event.actor_login}</span> {event.action}{event.detail ? ` · ${event.detail}` : ""} · {new Date(event.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    {!selected.resolved_at ? (
                      <label className="mt-4 block">
                        <span className="watch-kicker">Resolution note</span>
                        <textarea
                          value={note}
                          onChange={(event) => onNote(event.target.value)}
                          placeholder="What changed. Do not paste secret values."
                          disabled={previewing || busy}
                          rows={3}
                          className="mt-2 w-full rounded-md border border-white/15 bg-panel px-3 py-2 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                        />
                      </label>
                    ) : selected.resolution_note ? (
                      <p className="mt-4 text-xs text-mute">Resolution note · {selected.resolution_note}</p>
                    ) : null}
                    {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
                    {previewing ? <p className="mt-3 text-xs text-dim">Preview does not mutate alerts.</p> : null}
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {assignOpen && selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <button type="button" className="absolute inset-0" aria-label="Close assignment dialog" onClick={() => setAssignOpen(false)} />
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-alert-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-white/15 bg-[#0e0e11] p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (!assignee.trim()) return;
              onAction("assign");
              setAssignOpen(false);
            }}
          >
            <p className="watch-kicker">Assign alert</p>
            <h2 id="assign-alert-title" className="mt-1 font-display text-xl text-snow">{selected.title}</h2>
            <label className="mt-5 block">
              <span className="text-xs text-mute">GitHub login on this install</span>
              <input
                autoFocus
                value={assignee}
                onChange={(event) => onAssignee(event.target.value)}
                placeholder="teammate"
                className="mt-2 h-10 w-full rounded-md border border-white/15 bg-panel px-3 text-sm text-snow outline-none focus:border-white/40"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={busy || !assignee.trim()}>Assign</Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
