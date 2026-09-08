import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { Alert, AlertEvent } from "@/watch/types";
import {AlertRelatedReleases} from '@/components/watch/AlertRelatedReleases';
import {AlertRecheck} from '@/components/watch/AlertRecheck';

export function AlertsScreen() {
  const { selectedInstall } = useWatchScreenContext();
  const canRespond = selectedInstall?.role === "admin" || selectedInstall?.role === "member";
  const { WatchAlertsWorkspace, activeInstallId, alertAssignees, alertBusyId, alertErrorById, alertEvents, alertNotes, alertSectionState, controller, deskAlerts, ended, exportError, listedAlerts, loadJson, navigate, previewing, retryDeskSection, route, scopedApi, search, selectedAlert, setAlertAssignees, setAlertBusyId, setAlertErrorById, setAlertEvents, setAlertNotes, setAlerts, setExportError, sourceRows, teamOnly, user, watchHref, watchPath } = useWatchScreenContext();
  return (
    <>
      {route.view === "alerts" ? (
                <WatchAlertsWorkspace
                  alerts={listedAlerts}
                  allAlerts={deskAlerts}
                  sourceCount={sourceRows.length}
                  login={user?.login ?? ""}
                  rows={controller.alertRows}
                  selected={selectedAlert}
                  relatedReleases={selectedAlert && activeInstallId ? <><AlertRecheck alertId={selectedAlert.id} installationId={activeInstallId} workspaceId={new URLSearchParams(search).get('workspace')} canRespond={canRespond&&!previewing} ended={ended}/><AlertRelatedReleases alertId={selectedAlert.id} installationId={activeInstallId} workspaceId={new URLSearchParams(search).get('workspace')}/></> : null}
                  events={selectedAlert ? alertEvents[selectedAlert.id] ?? [] : []}
                  previewing={previewing}
                  canRespond={canRespond}
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
                  assignedToMe={new URLSearchParams(search).get('mine')==='1'}
                  onAssignedToMe={() => {
                    const params=new URLSearchParams(search);
                    if(params.get('mine')==='1' || route.tab==='mine') params.delete('mine');
                    else params.set('mine','1');
                    if(route.tab==='mine')params.delete('tab');
                    params.delete('alert');
                    navigate(`${watchPath('alerts')}?${params}`);
                  }}
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
                    if (previewing || !canRespond || !selectedAlert) return;
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
                            ? { userId: alertAssignees[alert.id]===CLEAR_ALERT_ASSIGNMENT?null:(alertAssignees[alert.id] ?? "").trim() }
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
                        // Follow this exact alert into its new status, never silently select a different one.
                        const updated=body.alert;
                        const params=new URLSearchParams(search);
                        params.set('alert',String(updated.id));
                        params.set('tab',updated.resolved_at?'done':updated.acknowledged_at?'waiting':'open');
                        if(params.get('mine')==='1' && updated.assigned_to_user_id!==user?.id)params.delete('mine');
                        navigate(`${watchPath('alerts')}?${params}`);
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
                  onConnectSource={() => navigate(watchHref(watchPath("sources"), search))}
                />
              ) : null}
    </>
  );
}
import {CLEAR_ALERT_ASSIGNMENT} from '../AlertMemberSelect';
