import { Button } from "@/components/ui/button";
import {
  WatchSectionError,
  WatchSkeleton,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { cn } from "@/lib/utils";
import type { AlertListViewModel } from "@/watch/view-models.ts";
import type { AlertActivityEvent } from "@/watch/useWatchDeskController.ts";
import type { AlertTab } from "@/watch/routes.ts";
import { filterDeskAlerts } from "@/watch/verdict.ts";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowDown, ArrowLeft, ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  state,
  activityState,
  detailOpen,
  tab,
  teamOnly,
  onSelect,
  onBack,
  onRetry,
  onRetryActivity,
  onTab,
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
  state: WatchSectionState;
  activityState: WatchSectionState;
  detailOpen: boolean;
  tab: AlertTab;
  teamOnly: boolean;
  onSelect: (alertId: number) => void;
  onBack: () => void;
  onRetry: () => void;
  onRetryActivity: () => void;
  onTab: (tab: AlertTab) => void;
  onNote: (value: string) => void;
  onAssignee: (value: string) => void;
  onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void;
  onExport: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const { deskAlerts, user } = useWatchScreenContext();
  const login = user?.login ?? "";
  const queueCounts = {
    open: filterDeskAlerts(deskAlerts, "open", login).length,
    waiting: filterDeskAlerts(deskAlerts, "waiting", login).length,
    mine: filterDeskAlerts(deskAlerts, "mine", login).length,
    done: filterDeskAlerts(deskAlerts, "done", login).length,
  };
  const selectedIndex = selected ? alerts.findIndex((alert) => alert.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? alerts[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < alerts.length - 1 ? alerts[selectedIndex + 1] : null;
  const selectedRow = selected ? rows.find((row) => row.id === selected.id) : null;
  const listRef = useRef<HTMLOListElement>(null);
  const assignmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const saved = Number(sessionStorage.getItem("watch-alert-scroll"));
    if (Number.isFinite(saved)) list.scrollTop = saved;
    return () => sessionStorage.setItem("watch-alert-scroll", String(list.scrollTop));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (event.key === "j" || event.key === "J" || event.key === "ArrowDown") {
        if (!next) return;
        event.preventDefault();
        onSelect(next.id);
      }
      if (event.key === "k" || event.key === "K" || event.key === "ArrowUp") {
        if (!previous) return;
        event.preventDefault();
        onSelect(previous.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, onSelect, previous, selected]);

  return (
    <section className="-mx-5 -my-8 flex h-[calc(100svh-3.5rem)] min-h-[560px] flex-col md:-mx-8">
      <p className="sr-only" role="status" aria-live="polite">
        {error ??
          exportError ??
          (busy
            ? "Updating alert…"
            : selected?.resolved_at
              ? "Alert resolved."
              : selected?.acknowledged_at
                ? "Alert acknowledged."
                : "")}
      </p>
      {ended ? (
        <div className="flex items-center gap-3 border-b border-danger/25 bg-danger/8 px-5 py-2.5 text-xs text-snow">
          <span className="size-1.5 rounded-full bg-danger" />
          No new jobs run. Existing alerts can still be acknowledged, assigned, resolved, and reopened.
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className={cn("min-h-0 flex-col border-b border-white/8 bg-ink lg:flex lg:border-b-0 lg:border-r", detailOpen ? "hidden" : "flex")}>
          <div className="flex shrink-0 flex-col gap-2 border-b border-white/8 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <strong className="text-sm text-snow">Alerts</strong>
                <span
                  className={cn(
                    "rounded-full border border-white/10 px-2 py-0.5",
                    queueCounts.open > 0 ? "font-mono text-[11px] text-[#ff8a80]" : "text-xs text-dim",
                  )}
                >
                  {rows.length}
                </span>
              </div>
              {!previewing ? (
                <Button type="button" size="sm" variant="outline" onClick={onExport}>Export JSON</Button>
              ) : null}
            </div>
            <div className="watch-seg" role="tablist" aria-label="Alert queues">
              {([
                ["open", "Triage", queueCounts.open],
                ["waiting", "Waiting", queueCounts.waiting],
                ...(teamOnly ? [["mine", "Mine", queueCounts.mine] as const] : []),
                ["done", "Resolved", queueCounts.done],
              ] as [AlertTab, string, number][]).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-current={tab === value ? "page" : undefined}
                  className="watch-seg-item"
                  onClick={() => onTab(value)}
                >
                  {label}
                  {count > 0 ? (
                    <span className={value === "open" ? "watch-seg-n watch-seg-n-open" : "watch-seg-n"}>
                      {count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {exportError ? <p className="border-b border-white/8 px-4 py-2 text-xs text-danger">{exportError}</p> : null}
          {state.status === "loading" ? (
            <WatchSkeleton variant="list" className="min-h-0 flex-1 overflow-hidden" />
          ) : state.status === "error" ? (
            <WatchSectionError className="m-4" message={state.message} onRetry={onRetry} />
          ) : (
          <ol ref={listRef} className="min-h-0 flex-1 divide-y divide-white/5 overflow-auto">
            {rows.length === 0 ? (
              <li>
                <div className="watch-empty m-4">This view is clear. No real alerts match this filter.</div>
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
                      <span className="shrink-0 text-xs text-dim">{row.exposure}</span>
                    </span>
                    <span className="mt-1.5 block truncate pl-3.5 font-mono text-xs text-dim">
                      {row.coordinate} · {row.rule}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ol>
          )}
        </aside>

        <main className={cn("min-h-0 bg-ink lg:block", detailOpen ? "block" : "hidden")}>
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
                <Button type="button" size="sm" variant="ghost" className="lg:hidden" onClick={onBack}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to inbox
                </Button>
                {!selected.acknowledged_at && !selected.resolved_at ? (
                  <Button type="button" size="sm" className="min-h-12 lg:min-h-8" disabled={previewing || busy} onClick={() => onAction("acknowledge")}>
                    Acknowledge
                  </Button>
                ) : selected.acknowledged_at ? (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-mute">Acknowledged</span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-12 lg:min-h-8"
                  disabled={previewing || busy || (!selected.resolved_at && note.trim().length < 8)}
                  onClick={() => onAction(selected.resolved_at ? "reopen" : "resolve")}
                >
                  {selected.resolved_at ? "Reopen" : "Resolve"}
                </Button>
                {!selected.resolved_at ? (
                  <Button type="button" size="sm" variant="outline" className="min-h-12 lg:min-h-8" disabled={previewing || busy} onClick={() => setAssignOpen(true)}>
                    {selected.assigned_to_login ? `@${selected.assigned_to_login}` : "Assign"}
                  </Button>
                ) : null}
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="min-h-12 min-w-12 lg:min-h-8 lg:min-w-8" disabled={!previous} onClick={() => previous && onSelect(previous.id)} aria-label="Previous alert"><ArrowUp className="size-4" aria-hidden /></Button>
                  <Button type="button" size="sm" variant="ghost" className="min-h-12 min-w-12 lg:min-h-8 lg:min-w-8" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next alert"><ArrowDown className="size-4" aria-hidden /></Button>
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
                      {Array.isArray(selected.findings) && selected.findings.length ? (
                        selected.findings.map((finding) => (
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
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs text-snow">NS</span>
                        <p><span className="text-snow">NoSpoilers</span> opened this from {selected.kind} · {new Date(selected.created_at).toLocaleString()}</p>
                      </div>
                      {activityState.status === "loading" ? (
                        <WatchSkeleton variant="list" className="py-2" />
                      ) : activityState.status === "error" ? (
                        <WatchSectionError className="my-3" message={activityState.message} onRetry={onRetryActivity} />
                      ) : events.map((event) => (
                        <div key={event.id} className="flex gap-3 border-b border-white/5 py-3 text-xs text-mute last:border-b-0">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs text-snow">{event.actor_login.slice(0, 2).toUpperCase()}</span>
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

      <Dialog
        open={assignOpen && Boolean(selected)}
        onClose={setAssignOpen}
        initialFocus={assignmentInputRef}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel
            as="form"
            className="w-full max-w-md rounded-xl border border-white/15 bg-panel p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none"
            onSubmit={(event) => {
              event.preventDefault();
              if (!assignee.trim()) return;
              onAction("assign");
              setAssignOpen(false);
            }}
          >
            <p className="watch-kicker">Assign alert</p>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="mt-1 font-display text-xl text-snow">{selected?.title}</DialogTitle>
              <Button type="button" size="sm" variant="ghost" aria-label="Close assignment dialog" onClick={() => setAssignOpen(false)}><X className="size-4" aria-hidden /></Button>
            </div>
            <label className="mt-5 block">
              <span className="text-xs text-mute">GitHub login on this install</span>
              <input
                ref={assignmentInputRef}
                autoFocus
                value={assignee}
                onChange={(event) => onAssignee(event.target.value)}
                placeholder="teammate"
                className="mt-2 h-12 w-full rounded-md border border-white/15 bg-panel px-3 text-sm text-snow outline-none focus:border-white/40"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={busy || !assignee.trim()}>Assign</Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
