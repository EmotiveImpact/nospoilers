import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { Alert, AlertEvent } from "@/watch/types";
import {AlertRelatedReleases} from '@/components/watch/AlertRelatedReleases';
import {AlertRecheck} from '@/components/watch/AlertRecheck';
import {isAlertQueueActionable} from '@/watch/view-models';

export function AlertsScreen() {
  const { selectedInstall } = useWatchScreenContext();
  const canRespond = selectedInstall?.role === "admin" || selectedInstall?.role === "member";
  const { WatchAlertsWorkspace, activeInstallId, alertAssignees, alertBusyId, alertErrorById, alertEvents, alertNotes, alertSectionState, controller, deskAlerts, ended, exportError, listedAlerts, loadJson, navigate, previewing, retryDeskSection, route, scopedApi, search, selectedAlert, setAlertAssignees, setAlertBusyId, setAlertErrorById, setAlertEvents, setAlertNotes, setAlerts, setExportError, sourceRows, teamOnly, user, watchHref, watchPath } = useWatchScreenContext();
  const actionableAlerts=listedAlerts.filter(isAlertQueueActionable);
  const actionableDeskAlerts=deskAlerts.filter(isAlertQueueActionable);
  const actionableIds=new Set(actionableAlerts.map(alert=>alert.id));
  const actionableRows=controller.alertRows.filter(row=>actionableIds.has(row.id));
  const actionableSelected=route.alertId===null
    ? actionableAlerts[0]??null
    : selectedAlert&&isAlertQueueActionable(selectedAlert)?selectedAlert:null;
  const actionableActivityState=actionableSelected?.id===selectedAlert?.id
    ? controller.selectedActivityState
    : {status:'ready' as const};
  return (
    <>
      {route.view === "alerts" ? (
                <WatchAlertsWorkspace
                  alerts={actionableAlerts}
                  allAlerts={actionableDeskAlerts}
                  sourceCount={sourceRows.length}
                  login={user?.login ?? ""}
                  rows={actionableRows}
                  selected={actionableSelected}
                  relatedReleases={actionableSelected && activeInstallId ? <><AlertRecheck alertId={actionableSelected.id} installationId={activeInstallId} workspaceId={new URLSearchParams(search).get('workspace')} canRespond={canRespond&&!previewing} ended={ended}/><AlertRelatedReleases hideEmpty alertId={actionableSelected.id} installationId={activeInstallId} workspaceId={new URLSearchParams(search).get('workspace')}/></> : null}
                  events={actionableSelected ? alertEvents[actionableSelected.id] ?? [] : []}
                  previewing={previewing}
                  canRespond={canRespond}
                  ended={ended}
                  busy={Boolean(actionableSelected && alertBusyId === actionableSelected.id)}
                  note={actionableSelected ? alertNotes[actionableSelected.id] ?? "" : ""}
                  assignee={actionableSelected ? alertAssignees[actionableSelected.id] ?? "" : ""}
                  error={actionableSelected ? alertErrorById[actionableSelected.id] ?? null : null}
                  exportError={exportError}
                  state={alertSectionState}
                  activityState={actionableActivityState}
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
                    if (!actionableSelected) return;
                    setAlertNotes((current) => ({ ...current, [actionableSelected.id]: value }));
                  }}
                  onAssignee={(value) => {
                    if (!actionableSelected) return;
                    setAlertAssignees((current) => ({ ...current, [actionableSelected.id]: value }));
                  }}
                  onAction={(action) => {
                    if (previewing || !canRespond || !actionableSelected) return;
                    const alert = actionableSelected;
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
                  onReviewReleases={() => navigate(watchHref(watchPath("releases"), search))}
                />
              ) : null}
    </>
  );
}
import {CLEAR_ALERT_ASSIGNMENT} from '../AlertMemberSelect';
