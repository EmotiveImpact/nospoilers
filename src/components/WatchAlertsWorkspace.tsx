import { Button } from "@/components/ui/button";
import {AlertMemberSelect} from './watch/AlertMemberSelect';
import './watch/design/alerts-page.css';
import {
  WatchSectionError,
  WatchSkeleton,
  type WatchSectionState,
} from "@/components/WatchDataState";
import { cn } from "@/lib/utils";
import type { AlertListViewModel } from "@/watch/view-models.ts";
import type { AlertActivityEvent } from "@/watch/useWatchDeskController.ts";
import type { AlertTab } from "@/watch/routes.ts";
import { filterDeskAlerts } from "@/watch/verdict.ts";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowDown, ArrowLeft, ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function alertQueueCopy(row: AlertListViewModel) {
  const missingRelease = row.operational && row.title.startsWith("No release on ");
  return {
    title: missingRelease ? row.title.slice("No release on ".length) : row.title,
    summary: missingRelease ? "No published release" : row.operational ? "Release check incomplete" :
      row.coordinate !== row.rule && !row.title.includes(row.coordinate) ? row.coordinate : null,
  };
}

import type {KeyboardEvent,ReactNode} from 'react';

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
  allAlerts = alerts,
  sourceCount = alerts.length > 0 ? 1 : 0,
  login = "",
  userId,
  rows,
  selected,
  selectedViewModel,
  events,
  previewing,
  canRespond = false,
  ended,
  busy,
  note,
  assignee,
  error,
  exportError,
  state,
  activityState,
  activityPagination,
  detailOpen,
  tab,
  assignedToMe = false,
  onAssignedToMe,
  onSelect,
  onBack,
  onRetry,
  onRetryActivity,
  onTab,
  onNote,
  onAssignee,
  onAction,
  onExport,
  onConnectSource = () => window.location.assign("/watch/sources"),
  relatedReleases,
  workspaceId,
  counts,
  pagination,
  exportLabel='Export JSON',
}: {
  alerts: WatchAlertDetail[];
  allAlerts?: WatchAlertDetail[];
  sourceCount?: number;
  login?: string;
  userId?: string;
  rows: AlertListViewModel[];
  selected: WatchAlertDetail | null;
  selectedViewModel?: AlertListViewModel;
  events: AlertActivityEvent[];
  previewing: boolean;
  canRespond?: boolean;
  ended: boolean;
  busy: boolean;
  note: string;
  assignee: string;
  error: string | null;
  exportError: string | null;
  state: WatchSectionState;
  activityState: WatchSectionState;
  activityPagination?: import('react').ReactNode;
  detailOpen: boolean;
  tab: AlertTab;
  assignedToMe?: boolean;
  onAssignedToMe?: () => void;
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
  onConnectSource?: () => void;
  relatedReleases?: ReactNode;
  workspaceId?: string;
  counts?: {open:number;waiting:number;mine:number;done:number};
  pagination?: ReactNode;
  exportLabel?: string;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const responseDisabled = previewing || !canRespond || busy;
  const hasSources = sourceCount > 0;
  const queueCounts = counts ?? {
    open: filterDeskAlerts(allAlerts, "open", login).length,
    waiting: filterDeskAlerts(allAlerts, "waiting", login).length,
    mine: filterDeskAlerts(allAlerts, "mine", login, false, userId).length,
    done: filterDeskAlerts(allAlerts, "done", login).length,
  };
  const selectedIndex = selected ? alerts.findIndex((alert) => alert.id === selected.id) : -1;
  const previous = selectedIndex > 0 ? alerts[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < alerts.length - 1 ? alerts[selectedIndex + 1] : null;
  const selectedRow = selected ? (selectedViewModel?.id===selected.id?selectedViewModel:rows.find((row) => row.id === selected.id)) : null;
  const listRef = useRef<HTMLOListElement>(null);
  const assignmentInputRef = useRef<HTMLSelectElement>(null);
  const assignmentCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const saved = Number(sessionStorage.getItem("watch-alert-scroll"));
    if (Number.isFinite(saved)) list.scrollTop = saved;
    return () => sessionStorage.setItem("watch-alert-scroll", String(list.scrollTop));
  }, []);

  function navigateQueue(event:KeyboardEvent<HTMLElement>) {
    if (!selected || state.status !== 'ready' || busy || assignOpen || event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const target=event.target;
    if (!(target instanceof HTMLElement) || target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"]') || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const fromQueue=!!listRef.current?.contains(target);
    if ((event.key==='ArrowDown'||event.key==='ArrowUp')&&!fromQueue) return;
    const destination=['j','J','ArrowDown'].includes(event.key)?next:['k','K','ArrowUp'].includes(event.key)?previous:null;
    if(!destination)return;
    event.preventDefault();onSelect(destination.id);
    // On desktop both panes remain visible. Mobile navigation opens detail instead.
    if(fromQueue && window.matchMedia('(min-width: 1024px)').matches){
      const button=listRef.current?.querySelector<HTMLButtonElement>(`[data-alert-id="${destination.id}"]`);
      button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',behavior:'auto'});
    }
  }

  return (
    <section className="alerts-designed alerts-journey flex h-full min-h-0 flex-col" onKeyDown={navigateQueue}>
      <p className="sr-only" role="status" aria-live="polite">
        {error ||
          exportError ||
          (busy
            ? "Updating alert…"
            : selected?.resolved_at
              ? `Alert resolved. Selected alert: ${selected.title}`
              : selected?.acknowledged_at
                ? `Alert acknowledged. Selected alert: ${selected.title}`
                : selected ? `Selected alert: ${selected.title}` : "")}
      </p>
      {ended ? (
        <div className="flex items-center gap-3 border-b border-danger/25 bg-danger/8 px-5 py-2.5 text-xs text-snow">
          <span className="size-1.5 rounded-full bg-danger" />
          No new jobs run. Existing alerts can still be acknowledged, assigned, resolved, and reopened.
        </div>
      ) : null}
      <div className="alerts-journey-header flex shrink-0 items-center gap-4 px-5 py-4 md:px-8">
        <div className="min-w-0"><h1 className="watch-page-title">Alerts.</h1><p className="mt-2 text-sm text-mute">Review findings and incomplete checks without mixing them together.</p></div>
        {!previewing ? (
          <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={onExport}>
            {exportLabel}
          </Button>
        ) : null}
      </div>
      <div className="alert-queue-toolbar alerts-journey-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 md:px-8">
      <div className="flex min-w-0 flex-wrap items-center gap-3"><div className="alert-queue-tabs alerts-journey-tabs inline-flex" role="tablist" aria-label="Alert queues">
        {([
          ["open", "Open", queueCounts.open],
          ["waiting", "In progress", queueCounts.waiting],
          ["done", "Resolved", queueCounts.done],
        ] as [AlertTab, string, number][]).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={(tab==='mine'?'open':tab) === value}
            tabIndex={(tab==='mine'?'open':tab) === value?0:-1}
            className="alerts-journey-tab flex min-h-11 items-center justify-center text-xs text-mute aria-selected:text-snow"
            onClick={() => onTab(value)}
            onKeyDown={(event)=>{
              const keys=['ArrowRight','ArrowLeft','Home','End'];
              if(!keys.includes(event.key))return;
              event.preventDefault();
              const tabs=Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const index=tabs.indexOf(event.currentTarget);
              const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
              tabs[next].focus();tabs[next].click();
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="watch-queue-label">{label}</span>
              <span
                className={cn(
                  "watch-queue-count min-w-5 px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums text-mute",
                  value === "open" && count > 0 && "text-danger-text",
                )}
              >
                {count}
              </span>
            </span>
          </button>
        ))}
      </div></div>
      {onAssignedToMe ? <Button type="button" size="sm" variant="outline" className="min-h-11 aria-pressed:bg-white/10 aria-pressed:text-snow" aria-pressed={assignedToMe || tab==='mine'} onClick={onAssignedToMe}>Assigned to me</Button> : null}
      </div>
      <div key={tab} className={cn("alerts-journey-inbox watch-content-enter grid min-h-0 flex-1",rows.length===0&&state.status!=="loading"&&state.status!=="error"&&!detailOpen&&"is-empty")}>
        <aside className={cn("alerts-journey-list min-h-0 flex-col border-b border-white/8 lg:flex lg:border-b-0 lg:border-r", detailOpen ? "hidden" : "flex")}>
          <p className="alerts-journey-shortcuts border-b border-white/8 px-4 py-2 text-xs text-mute">J / K moves through the queue. Arrow keys work while the list is focused.</p>
          {exportError ? <p className="border-b border-white/8 px-4 py-2 text-xs text-danger">{exportError}</p> : null}
          {state.status === "loading" ? (
            <WatchSkeleton variant="list" className="min-h-0 flex-1 overflow-hidden" />
          ) : state.status === "error" ? (
            <WatchSectionError className="m-4" message={state.message} onRetry={onRetry} />
          ) : (
          <ol ref={listRef} className="alerts-journey-rows min-h-0 flex-1 overflow-auto">
            {rows.length === 0 ? (
              <li>
                <div className="watch-empty m-4">
                  <strong className="block text-sm font-medium text-snow">
                    {hasSources ? "No alerts match this view" : "The inbox starts after your first source"}
                  </strong>
                  <p className="mt-1.5">
                    {hasSources
                      ? "There are no real alerts in this queue."
                      : "Connect and check a source before treating an empty inbox as a clear release."}
                  </p>
                  {!hasSources ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4"
                      onClick={onConnectSource}
                    >
                      Connect a source
                    </Button>
                  ) : null}
                </div>
              </li>
            ) : (
              rows.map((row) => {
                const copy=alertQueueCopy(row);
                return <li key={row.id}>
                  <button
                    type="button"
                    data-alert-id={row.id}
                    aria-label={[copy.title,copy.summary].filter(Boolean).join(". ")}
                    aria-pressed={selected?.id===row.id}
                    className={cn(
                      "alerts-journey-row w-full px-3 py-4 text-left",
                      selected?.id === row.id && "is-selected",
                    )}
                    onClick={() => onSelect(row.id)}
                  >
                    <strong className="alerts-journey-row-title line-clamp-2 min-w-0 [overflow-wrap:anywhere] text-[13px] leading-snug text-snow">{copy.title}</strong>
                    {copy.summary?<span className={cn("alerts-journey-row-summary mt-1.5 block truncate text-xs",row.status === "resolved" ? "text-dim" : row.severity === "critical" ? "text-danger-text" : "text-mute")}>{copy.summary}</span>:null}
                  </button>
                </li>;
              })
            )}
          </ol>
        )}
        {pagination}
        </aside>

        <main className={cn("alerts-journey-detail min-h-0 lg:block", detailOpen ? "block" : "hidden")}>
          {state.status === "loading" ? null : !selected || !selectedRow ? (
            <div className="grid h-full place-items-center px-5 text-center">
              <div>
                <p className="text-sm text-snow">
                  {detailOpen ? "Alert unavailable in this view." : hasSources ? "Nothing selected." : "No evidence yet."}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-dim">
                  {detailOpen ? "It may have moved to another status, no longer match your filters, or be outside your access." : hasSources
                    ? "Findings, exposure, and activity open here."
                    : "Once a connected source produces a finding, its exposure and response activity will open here."}
                </p>
                {detailOpen ? <Button className="mt-4" variant="outline" onClick={onBack}>Back to alerts</Button> : null}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="alerts-journey-actions sticky top-0 z-10 flex min-h-12 shrink-0 flex-wrap items-center gap-2 px-4 py-2">
                <Button type="button" size="sm" variant="ghost" className="lg:hidden" onClick={onBack}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to inbox
                </Button>
                {!selected.acknowledged_at && !selected.resolved_at ? (
                  <Button type="button" size="sm" className="min-h-12 lg:min-h-8" disabled={responseDisabled} onClick={() => onAction("acknowledge")}>
                    Acknowledge
                  </Button>
                ) : selected.acknowledged_at ? (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-mute">Acknowledged</span>
                ) : null}
                {selected.resolved_at ? (
                  <Button type="button" size="sm" variant="outline" disabled={responseDisabled} onClick={() => onAction("reopen")}>
                    Reopen
                  </Button>
                ) : null}
                {!selected.resolved_at ? (
                  <Button type="button" size="sm" variant="outline" className="min-h-12 lg:min-h-8" disabled={responseDisabled} onClick={() => setAssignOpen(true)}>
                    {selected.assigned_to_login ? `@${selected.assigned_to_login}` : "Assign"}
                  </Button>
                ) : null}
                <div className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="ghost" className="min-h-12 min-w-12 lg:min-h-8 lg:min-w-8" disabled={!previous} onClick={() => previous && onSelect(previous.id)} aria-label="Previous alert"><ArrowUp className="size-4" aria-hidden /></Button>
                  <Button type="button" size="sm" variant="ghost" className="min-h-12 min-w-12 lg:min-h-8 lg:min-w-8" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next alert"><ArrowDown className="size-4" aria-hidden /></Button>
                </div>
              </div>
              <div className="alerts-journey-detail-scroll min-h-0 flex-1 overflow-auto px-5 py-6 lg:px-8">
                <div className="alerts-journey-detail-content mx-auto max-w-3xl">
                  <div className="alerts-journey-context flex flex-wrap gap-2">
                    <span className={selected.resolved_at ? "watch-pill watch-pill-ok" : selectedRow.operational || selectedRow.severity !== "critical" ? "watch-pill watch-pill-warn" : "watch-pill watch-pill-crit"}>
                      {selected.resolved_at ? "Response recorded" : selectedRow.operational ? "Check incomplete" : "Finding needs review"}
                    </span>
                  </div>
                  <h1 className="mt-4 font-display text-2xl leading-tight text-snow [overflow-wrap:anywhere] md:text-3xl">{selected.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute [overflow-wrap:anywhere]">{selected.body}</p>

                  {!selectedRow.operational ? <>
                  <section className="alerts-journey-section mt-8">
                    <p className="watch-kicker">Where</p>
                    <div className="alerts-journey-surface mt-2 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
                      {Array.isArray(selected.findings) && selected.findings.length ? (
                        selected.findings.map((finding) => (
                          <div key={`${finding.rule}:${finding.path}`} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                            <span className="font-mono text-xs text-snow">{finding.rule}</span>
                            <span className="truncate font-mono text-xs text-mute">{finding.path}</span>
                            <span className={selectedRow.severity === "critical" ? "watch-pill watch-pill-crit" : "watch-pill watch-pill-warn"}>{selectedRow.severity}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="px-4 py-3 text-xs text-mute">{selected.full_name ?? (selectedRow.operational && selected.title.startsWith("No release on ") ? alertQueueCopy(selectedRow).title : selectedRow.operational ? "Repository not recorded" : selected.kind)}</div>
                          {selectedRow.operational ? (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-dim">
                              <span>Technical check</span>
                              <code className="text-[11px] text-mute">{selected.kind}</code>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </section>

                  </> : null}

                  {relatedReleases}
                  {!selectedRow.operational ? <>
                  <section className="alerts-journey-section mt-7">
                    <p className="watch-kicker">{selectedRow.operational?'Check status':'Exposure'}</p>
                    <div className="alerts-journey-surface mt-2 grid gap-4 rounded-lg border border-white/8 bg-panel p-4 sm:grid-cols-2">
                      <div>
                        <p className="watch-kicker">{selectedRow.operational?'Result':'Reachable for'}</p>
                        <p className={selected.resolved_at||selectedRow.operational ? "mt-1 font-display text-2xl text-snow" : "mt-1 font-display text-2xl text-danger"}>{selectedRow.operational?'No scanned release':selectedRow.exposure}</p>
                      </div>
                      <div>
                        <p className="watch-kicker">Opened</p>
                        <p className="mt-1 font-display text-2xl text-snow">{new Date(selected.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </section>

                  </> : null}

                  {!selectedRow.operational?<section className="alerts-journey-section mt-7">
                    <p className="watch-kicker">Rotation checklist · read-only</p>
                    <div className="alerts-journey-surface mt-2 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
                  </section>:<p className="mt-7 text-sm text-mute">An incomplete check is not evidence of exposed content. Resolving this alert records your response; it does not establish a passing scan.</p>}

                  <section className="alerts-journey-section alerts-journey-activity mt-7 pb-10">
                    <p className="watch-kicker">Activity</p>
                    <div className="alerts-journey-surface mt-2 rounded-lg border border-white/8 bg-panel px-4">
                      <div className="flex gap-3 border-b border-white/5 py-3 text-xs text-mute">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs text-snow">NS</span>
                        <p><span className="text-snow">NoSpoilers</span> opened this from {selectedRow.operational ? "a latest release check" : selected.kind} · {new Date(selected.created_at).toLocaleString()}</p>
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
                      {activityPagination}
                    </div>
                    {!selected.resolved_at ? (
                      <div className="mt-5">
                      <label className="block">
                        <span className="watch-kicker">Resolve this alert</span>
                        <textarea
                          aria-label="Resolution note"
                          aria-describedby="alert-resolution-help"
                          value={note}
                          onChange={(event) => onNote(event.target.value)}
                          placeholder="What changed. Do not paste secret values."
                          disabled={responseDisabled}
                          rows={3}
                          className="mt-2 w-full rounded-md border border-white/15 bg-panel px-3 py-2 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p id="alert-resolution-help" className="text-xs text-mute">Add a note of at least 8 characters to record what changed.</p>
                        <Button type="button" size="sm" variant="outline" disabled={responseDisabled || note.trim().length < 8} onClick={() => onAction("resolve")}>
                          Resolve
                        </Button>
                      </div>
                      </div>
                    ) : selected.resolution_note ? (
                      <p className="mt-4 text-xs text-mute">Resolution note · {selected.resolution_note}</p>
                    ) : null}
                    {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
                    {previewing ? <p className="mt-3 text-xs text-dim">Preview does not mutate alerts.</p> : null}
                    {!canRespond && !previewing && activityState.status !== "loading" ? <p className="mt-3 text-xs text-dim">Read-only access. A workspace member or administrator can respond to this alert.</p> : null}
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog
        open={assignOpen && Boolean(selected) && canRespond && !previewing}
        onClose={setAssignOpen}
        initialFocus={assignmentCloseRef}
        className="watch-design-surface relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel
            as="form"
            className="w-full max-w-md rounded-xl border border-white/15 bg-panel p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none"
            onSubmit={(event) => {
              event.preventDefault();
              if (responseDisabled || !assignee.trim()) return;
              onAction("assign");
              setAssignOpen(false);
            }}
          >
            <p className="watch-kicker">Assign alert</p>
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="mt-1 font-display text-xl text-snow">{selected?.title}</DialogTitle>
              <button ref={assignmentCloseRef} type="button" className="inline-flex size-8 items-center justify-center rounded-md text-mute hover:bg-white/5 focus-visible:outline focus-visible:outline-white/50" aria-label="Close assignment dialog" onClick={() => setAssignOpen(false)}><X className="size-4" aria-hidden /></button>
            </div>
            {selected?<AlertMemberSelect key={`${workspaceId??'legacy'}:${selected.id}`} workspaceId={workspaceId} alertId={selected.id} value={assignee} onChange={onAssignee} inputRef={assignmentInputRef}/>:null}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={responseDisabled || !assignee.trim()}>Assign</Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
