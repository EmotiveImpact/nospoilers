import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";

export function TimelineRouteScreen() {
  const { TimelineScreen, alertSectionState, deskAlerts, previewing, retryDeskSection, route, timeline } = useWatchScreenContext();
  return (
    <>
      {route.view === "timeline" ? (
                <TimelineScreen
                  previewing={previewing}
                  timeline={timeline}
                  alerts={deskAlerts}
                  alertState={alertSectionState}
                  onRetryTimeline={() => void retryDeskSection("timeline")}
                  onRetryAlerts={() => void retryDeskSection("alerts")}
                />
              ) : null}
    </>
  );
}
