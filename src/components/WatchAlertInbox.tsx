import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import { alertStatusLabel, formatExposure, kindLabel } from "@/watch/format.ts";
import { watchHref, watchPath, type AlertTab } from "@/watch/routes.ts";
import { filterDeskAlerts, type DeskAlert } from "@/watch/verdict.ts";
import type { ReactNode } from "react";

const TABS: { id: AlertTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting" },
  { id: "mine", label: "Assigned to me" },
  { id: "done", label: "Resolved" },
];

export function WatchAlertInbox({
  search,
  tab,
  selectedId,
  alerts,
  login,
  previewing,
  loading,
  error,
  onExport,
  exportError,
  children,
}: {
  search: string;
  tab: AlertTab;
  selectedId: number | null;
  alerts: DeskAlert[];
  login: string;
  previewing: boolean;
  loading: boolean;
  error: string | null;
  onExport: () => void;
  exportError: string | null;
  children: ReactNode;
}) {
  const rows = filterDeskAlerts(alerts, tab, login);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-snow">Alerts</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
            Acknowledge, assign, and resolve stay available when coverage has ended or GitHub has
            suspended the App. New scans still wait for coverage and an unsuspended install.
          </p>
        </div>
        {!previewing ? (
          <div>
            <Button type="button" size="sm" variant="outline" onClick={onExport}>
              Export activity
            </Button>
            {exportError ? <p className="mt-2 text-sm text-danger">{exportError}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-1" role="tablist" aria-label="Alert views">
        {TABS.map((item) => {
          const count = filterDeskAlerts(alerts, item.id, login).length;
          const href = watchHref(watchPath("alerts"), search, {
            tab: item.id,
            alert: null,
          });
          return (
            <a
              key={item.id}
              href={href}
              role="tab"
              aria-selected={tab === item.id}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                  return;
                }
                event.preventDefault();
                navigate(href);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                tab === item.id ? "bg-white/10 text-snow" : "text-mute hover:text-snow",
              )}
            >
              {item.label}
              <span className="ml-2 text-[11px] text-dim">{count}</span>
            </a>
          );
        })}
      </div>

      {loading ? <p className="mt-8 text-sm text-dim">Loading…</p> : null}
      {error ? <p className="mt-8 text-sm text-danger">{error}</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-8 text-sm leading-relaxed text-mute">
          {tab === "done"
            ? "No resolved alerts on this install."
            : tab === "mine"
              ? "Nothing assigned to you."
              : "Quiet so far. That is the good state — until a repo goes public or a release ships a map."}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
          <ul className="max-h-[70vh] divide-y divide-white/5 overflow-auto rounded-lg border border-white/10">
            {rows.map((alert) => {
              const href = watchHref(watchPath("alerts"), search, { alert: alert.id, tab });
              const active = selected?.id === alert.id;
              const status = alertStatusLabel(alert);
              return (
                <li key={alert.id}>
                  <a
                    href={href}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                        return;
                      }
                      event.preventDefault();
                      navigate(href);
                    }}
                    className={cn(
                      "block px-4 py-3",
                      active ? "bg-white/8" : "hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          status === "resolved"
                            ? "bg-white/30"
                            : status === "acknowledged"
                              ? "bg-mute"
                              : "bg-danger",
                        )}
                      />
                      <p className="truncate text-sm text-snow">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-dim">
                      {kindLabel(alert.kind)} · {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
