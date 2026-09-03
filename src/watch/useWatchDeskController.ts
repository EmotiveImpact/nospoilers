import { parseWatchRoute, type WatchRoute } from "./routes.ts";
import { filterDeskAlerts, type DeskAlert } from "./verdict.ts";
import {
  buildAlertListViewModels,
  buildSetupViewModel,
  buildSourceViewModels,
  buildTimelineLanes,
  type WatchSetupViewModel,
  type WatchSourceViewModel,
} from "./view-models.ts";
import { useEffect, useMemo } from "react";

export type AlertActivityEvent = {
  id: number;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export type WatchDeskControllerInput = {
  path: string;
  search: string;
  login: string;
  previewing: boolean;
  repos: Parameters<typeof buildSourceViewModels>[0]["repos"];
  alerts: DeskAlert[];
  packages: Parameters<typeof buildSourceViewModels>[0]["packages"];
  origins: Parameters<typeof buildSourceViewModels>[0]["origins"];
  maps: Parameters<typeof buildSourceViewModels>[0]["maps"];
  releases: { id: number }[];
  setupProbes: Parameters<typeof buildSetupViewModel>[0]["setupProbes"];
  alertEvents: Record<number, AlertActivityEvent[]>;
  setAlertEvents: React.Dispatch<React.SetStateAction<Record<number, AlertActivityEvent[]>>>;
  onActivityError?: (alertId: number, message: string) => void;
};

export type WatchDeskController = {
  route: WatchRoute;
  sources: WatchSourceViewModel[];
  setup: WatchSetupViewModel;
  timelineLanes: ReturnType<typeof buildTimelineLanes>;
  listedAlerts: DeskAlert[];
  alertRows: ReturnType<typeof buildAlertListViewModels>;
  selectedAlert: DeskAlert | null;
  counts: {
    open: number;
    waiting: number;
    mine: number;
    resolved: number;
  };
};

export async function loadSelectedAlertActivity(
  alertId: number,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AlertActivityEvent[]> {
  const response = await fetcher(`/api/alerts/${alertId}/events`, {
    credentials: "include",
    signal,
  });
  const body = (await response.json()) as { events?: AlertActivityEvent[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? `Could not load alert activity (${response.status}).`);
  return body.events ?? [];
}

export function shouldLoadAlertActivity(input: {
  previewing: boolean;
  selectedAlertId: number | null;
  alertEvents: Record<number, AlertActivityEvent[]>;
}): boolean {
  return Boolean(
    !input.previewing &&
      input.selectedAlertId &&
      !Object.prototype.hasOwnProperty.call(input.alertEvents, input.selectedAlertId),
  );
}

export function useWatchDeskController(input: WatchDeskControllerInput): WatchDeskController {
  const route = useMemo(() => parseWatchRoute(input.path, input.search), [input.path, input.search]);
  const sources = useMemo(
    () =>
      buildSourceViewModels({
        repos: input.repos,
        packages: input.packages,
        origins: input.origins,
        maps: input.maps,
        alerts: input.alerts,
      }),
    [input.alerts, input.maps, input.origins, input.packages, input.repos],
  );
  const setup = useMemo(
    () =>
      buildSetupViewModel({
        repoCount: input.repos.length,
        releases: input.releases,
        setupProbes: input.setupProbes,
        packages: input.packages,
        origins: input.origins,
        maps: input.maps,
      }),
    [input.maps, input.origins, input.packages, input.releases, input.repos.length, input.setupProbes],
  );
  const listedAlerts = useMemo(
    () => filterDeskAlerts(input.alerts, route.tab, input.login),
    [input.alerts, input.login, route.tab],
  );
  const selectedAlert =
    listedAlerts.find((alert) => alert.id === route.alertId) ?? listedAlerts[0] ?? null;
  const alertRows = useMemo(
    () =>
      buildAlertListViewModels(listedAlerts, (alert) => {
        const opened = Date.parse(alert.created_at);
        const ended = alert.resolved_at ? Date.parse(alert.resolved_at) : Date.now();
        const ms =
          typeof alert.exposure_ms === "number"
            ? alert.exposure_ms
            : Number.isFinite(opened) && Number.isFinite(ended)
              ? Math.max(0, ended - opened)
              : 0;
        if (ms < 60_000) return "<1m";
        if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
        if (ms < 172_800_000) return `${Math.floor(ms / 3_600_000)}h`;
        return `${Math.floor(ms / 86_400_000)}d`;
      }),
    [listedAlerts],
  );
  const timelineLanes = useMemo(() => buildTimelineLanes(input.alerts), [input.alerts]);

  useEffect(() => {
    const selectedAlertId = selectedAlert?.id ?? null;
    if (
      !shouldLoadAlertActivity({
        previewing: input.previewing,
        selectedAlertId,
        alertEvents: input.alertEvents,
      }) ||
      !selectedAlertId
    ) {
      return;
    }
    const controller = new AbortController();
    void loadSelectedAlertActivity(selectedAlertId, fetch, controller.signal)
      .then((events) => {
        input.setAlertEvents((current) => ({ ...current, [selectedAlertId]: events }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        input.onActivityError?.(
          selectedAlertId,
          error instanceof Error ? error.message : "Could not load alert activity.",
        );
      });
    return () => controller.abort();
  }, [
    input.alertEvents,
    input.onActivityError,
    input.previewing,
    input.setAlertEvents,
    selectedAlert?.id,
  ]);

  return {
    route,
    sources,
    setup,
    timelineLanes,
    listedAlerts,
    alertRows,
    selectedAlert,
    counts: {
      open: input.alerts.filter((alert) => !alert.resolved_at).length,
      waiting: filterDeskAlerts(input.alerts, "waiting", input.login).length,
      mine: filterDeskAlerts(input.alerts, "mine", input.login).length,
      resolved: filterDeskAlerts(input.alerts, "done", input.login).length,
    },
  };
}
