import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { Alert, AlertEvent } from "@/watch/types";

export function AlertsScreen() {
  const { AlertDeskItem, Button, WatchAlertsWorkspace, activeInstallId, alertAssignees, alertBusyId, alertErrorById, alertEvents, alertNotes, alertSectionState, alerts, cn, controller, ended, exportError, formatExposure, kindLabel, listedAlerts, loadJson, navigate, previewing, retryDeskSection, route, scopedApi, search, selectedAlert, setAlertAssignees, setAlertBusyId, setAlertErrorById, setAlertEvents, setAlertNotes, setAlerts, setExportError, teamOnly, watchHref, watchPath } = useWatchScreenContext();
  return (
    <>
      {route.view === "alerts" ? (
                <WatchAlertsWorkspace
                  alerts={listedAlerts}
                  rows={controller.alertRows}
                  selected={selectedAlert}
                  events={selectedAlert ? alertEvents[selectedAlert.id] ?? [] : []}
                  previewing={previewing}
                  ended={ended}
                  busy={Boolean(selectedAlert && alertBusyId === selectedAlert.id)}
                  note={selectedAlert ? alertNotes[selectedAlert.id] ?? "" : ""}
                  assignee={selectedAlert ? alertAssignees[selectedAlert.id] ?? "" : ""}
                  error={selectedAlert ? alertErrorById[selectedAlert.id] ?? null : null}
                  exportError={exportError}
                  state={alertSectionState}
                  activityState={controller.selectedActivityState}
                  detailOpen={route.alertId !== null}
                  tab={route.tab}
                  teamOnly={Boolean(teamOnly)}
                  onSelect={(alertId) =>
                    navigate(
                      watchHref(watchPath("alerts"), search, {
                        alert: alertId,
                        tab: route.tab,
                      }),
                    )
                  }
                  onBack={() =>
                    navigate(
                      watchHref(watchPath("alerts"), search, {
                        alert: null,
                        tab: route.tab,
                      }),
                    )
                  }
                  onRetry={() => void retryDeskSection("alerts")}
                  onRetryActivity={controller.retrySelectedActivity}
                  onTab={(tab) =>
                    navigate(
                      watchHref(watchPath("alerts"), search, {
                        alert: null,
                        tab,
                      }),
                    )
                  }
                  onNote={(value) => {
                    if (!selectedAlert) return;
                    setAlertNotes((current) => ({ ...current, [selectedAlert.id]: value }));
                  }}
                  onAssignee={(value) => {
                    if (!selectedAlert) return;
                    setAlertAssignees((current) => ({ ...current, [selectedAlert.id]: value }));
                  }}
                  onAction={(action) => {
                    if (previewing || !selectedAlert) return;
                    const alert = selectedAlert;
                    setAlertErrorById((current) => {
                      const next = { ...current };
                      delete next[alert.id];
                      return next;
                    });
                    setAlertBusyId(alert.id);
                    void (async () => {
                      try {
                        const payload =
                          action === "assign"
                            ? { login: (alertAssignees[alert.id] ?? "").trim() }
                            : action === "resolve"
                              ? { note: (alertNotes[alert.id] ?? "").trim() }
                              : undefined;
                        const response = await fetch(`/api/alerts/${alert.id}/${action}`, {
                          method: "POST",
                          credentials: "include",
                          headers: payload ? { "content-type": "application/json" } : undefined,
                          body: payload ? JSON.stringify(payload) : undefined,
                        });
                        const body = (await response.json()) as { error?: string; alert?: Alert };
                        if (!response.ok || !body.alert) {
                          throw new Error(body.error ?? "Could not update that alert.");
                        }
                        setAlerts((current) => {
                          if (current.status !== "ready") return current;
                          return {
                            status: "ready",
                            data: {
                              alerts: current.data.alerts.map((row) =>
                                row.id === body.alert!.id ? { ...row, ...body.alert } : row,
                              ),
                            },
                          };
                        });
                        const eventBody = await loadJson<{ events: AlertEvent[] }>(
                          `/api/alerts/${alert.id}/events`,
                        );
                        setAlertEvents((current) => ({ ...current, [alert.id]: eventBody.events }));
                      } catch (error) {
                        setAlertErrorById((current) => ({
                          ...current,
                          [alert.id]: error instanceof Error ? error.message : "Could not update that alert.",
                        }));
                      } finally {
                        setAlertBusyId(null);
                      }
                    })();
                  }}
                  onExport={() => {
                    setExportError(null);
                    void (async () => {
                      try {
                        const body = await loadJson<{ exportedAt: string; alerts: Alert[] }>(
                          scopedApi("/api/alerts/export", activeInstallId),
                        );
                        const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `nospoilers-alerts-${body.exportedAt.slice(0, 10)}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      } catch (error) {
                        setExportError(error instanceof Error ? error.message : "Could not export alerts.");
                      }
                    })();
                  }}
                />
              ) : null}
      {route.view === "alerts" && (
                <section className="hidden" aria-hidden="true">
                  <h1 className="font-display text-3xl tracking-tight text-snow">Alerts</h1>
                  <p className="mt-2 text-sm text-mute">Facts that need triage, ownership, or resolution.</p>
                  <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                    Acknowledge, assign, and resolve stay available when coverage has ended or GitHub has
                    suspended the App. New scans still wait for coverage and an unsuspended install.
                  </p>
                  {!previewing && (
                    <div className="mt-4">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExportError(null);
                          void (async () => {
                            try {
                              const body = await loadJson<{ exportedAt: string; alerts: Alert[] }>(
                                scopedApi("/api/alerts/export", activeInstallId),
                              );
                              const blob = new Blob([JSON.stringify(body, null, 2)], {
                                type: "application/json",
                              });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `nospoilers-alerts-${body.exportedAt.slice(0, 10)}.json`;
                              link.click();
                              URL.revokeObjectURL(url);
                            } catch (error) {
                              setExportError(
                                error instanceof Error ? error.message : "Could not export alerts.",
                              );
                            }
                          })();
                        }}
                      >
                        Export activity
                      </Button>
                      {exportError ? <p className="mt-2 text-sm text-danger">{exportError}</p> : null}
                    </div>
                  )}
                  {!previewing && alerts.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
                  {!previewing && alerts.status === "error" && <p className="mt-6 text-sm text-danger">{alerts.message}</p>}
                  {listedAlerts.length === 0 && (previewing || alerts.status === "ready") && (
                    <p className="mt-6 text-sm leading-relaxed text-mute">
                      {route.tab === "done"
                        ? "Nothing resolved on this install yet."
                        : route.tab === "waiting"
                          ? "Nothing waiting on rotation."
                          : route.tab === "mine"
                            ? "Nothing assigned to you."
                            : "Quiet so far. That is the good state — until a repo goes public or a release ships a map."}
                    </p>
                  )}
                  {listedAlerts.length > 0 && (
                    <div className="mt-5 grid overflow-hidden rounded-lg border border-white/8 bg-panel lg:grid-cols-[18rem_minmax(0,1fr)]">
                      <ol className="max-h-[46rem] divide-y divide-white/5 overflow-auto border-b border-white/8 lg:border-b-0 lg:border-r">
                        {listedAlerts.map((alert) => (
                          <li key={`summary-${alert.id}`}>
                            <button
                              type="button"
                              className={cn(
                                "w-full px-4 py-4 text-left hover:bg-white/5",
                                selectedAlert?.id === alert.id && "bg-white/5",
                              )}
                              onClick={() =>
                                navigate(
                                  watchHref(watchPath("alerts"), search, {
                                    alert: alert.id,
                                    tab: route.tab,
                                  }),
                                )
                              }
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-1.5 shrink-0 rounded-full",
                                    alert.resolved_at ? "bg-white/30" : "bg-danger",
                                  )}
                                  aria-hidden
                                />
                                <strong className="truncate text-sm text-snow">{alert.title}</strong>
                              </span>
                              <span className="mt-2 block truncate font-mono text-xs text-dim">
                                {alert.full_name ?? kindLabel(alert.kind)}
                              </span>
                              <span className="mt-1 block text-xs text-dim">
                                {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ol>
                      <ul className="min-w-0 px-5">
                      {selectedAlert ? [selectedAlert].map((alert) => (
                        <AlertDeskItem
                          key={alert.id}
                          alert={alert}
                          previewing={previewing}
                          events={alertEvents[alert.id] ?? []}
                          busy={alertBusyId === alert.id}
                          note={alertNotes[alert.id] ?? ""}
                          assignee={alertAssignees[alert.id] ?? ""}
                          error={alertErrorById[alert.id] ?? null}
                          onNote={(value) => setAlertNotes((current) => ({ ...current, [alert.id]: value }))}
                          onAssignee={(value) => setAlertAssignees((current) => ({ ...current, [alert.id]: value }))}
                          onAction={(action) => {
                            if (previewing) return;
                            setAlertErrorById((current) => {
                              const next = { ...current };
                              delete next[alert.id];
                              return next;
                            });
                            setAlertBusyId(alert.id);
                            void (async () => {
                              try {
                                const payload =
                                  action === "assign"
                                    ? { login: (alertAssignees[alert.id] ?? "").trim() }
                                    : action === "resolve"
                                      ? { note: (alertNotes[alert.id] ?? "").trim() }
                                      : undefined;
                                const response = await fetch(`/api/alerts/${alert.id}/${action}`, {
                                  method: "POST",
                                  credentials: "include",
                                  headers: payload ? { "content-type": "application/json" } : undefined,
                                  body: payload ? JSON.stringify(payload) : undefined,
                                });
                                const body = (await response.json()) as { error?: string; alert?: Alert };
                                if (!response.ok || !body.alert) {
                                  throw new Error(body.error ?? "Could not update that alert.");
                                }
                                setAlerts((current) => {
                                  if (current.status !== "ready") return current;
                                  return {
                                    status: "ready",
                                    data: {
                                      alerts: current.data.alerts.map((row) =>
                                        row.id === body.alert!.id ? { ...row, ...body.alert } : row,
                                      ),
                                    },
                                  };
                                });
                                const eventBody = await loadJson<{ events: AlertEvent[] }>(
                                  `/api/alerts/${alert.id}/events`,
                                );
                                setAlertEvents((current) => ({ ...current, [alert.id]: eventBody.events }));
                              } catch (error) {
                                setAlertErrorById((current) => ({
                                  ...current,
                                  [alert.id]:
                                    error instanceof Error ? error.message : "Could not update that alert.",
                                }));
                              } finally {
                                setAlertBusyId(null);
                              }
                            })();
                          }}
                        />
                      )) : null}
                      </ul>
                    </div>
                  )}
                </section>
              )}
    </>
  );
}
