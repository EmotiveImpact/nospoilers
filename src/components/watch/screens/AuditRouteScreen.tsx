import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";

export function AuditRouteScreen() {
  const { AuditScreen, activeInstallId, audit, previewing, route } = useWatchScreenContext();
  return (
    <>
      {route.view === "audit" ? (
                <AuditScreen
                  key={activeInstallId ?? "preview"}
                  previewing={previewing}
                  audit={audit}
                  installationId={activeInstallId}
                />
              ) : null}
    </>
  );
}
