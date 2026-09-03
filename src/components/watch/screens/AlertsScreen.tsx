import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { Alert, AlertEvent } from "@/watch/types";

export function AlertsScreen() {
  const { WatchAlertsWorkspace, activeInstallId, alertAssignees, alertBusyId, alertErrorById, alertEvents, alertNotes, alertSectionState, controller, ended, exportError, listedAlerts, loadJson, navigate, previewing, retryDeskSection, route, scopedApi, search, selectedAlert, setAlertAssignees, setAlertBusyId, setAlertErrorById, setAlertEvents, setAlertNotes, setAlerts, setExportError, teamOnly, watchHref, watchPath } = useWatchScreenContext();
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
    </>
  );
}
