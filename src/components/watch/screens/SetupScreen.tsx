import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";

export function SetupScreen() {
  const { CoverageLock, WatchSourcesSummary, adminOnly, ended, retryDeskSection, route, search, setup, setupSectionState, sourceRows } = useWatchScreenContext();
  if (route.view !== "setup") return null;
  return (
    <section className="relative min-h-72">
      {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
      <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
        <WatchSourcesSummary
          mode="setup"
          sources={sourceRows}
          setup={setup}
          admin={adminOnly}
          search={search}
          filter={route.sourceFilter}
          attention={route.sourceAttention}
          selectedSourceKey={route.sourceKey}
          state={setupSectionState}
          onRetry={() => void retryDeskSection("sources")}
        />
      </div>
    </section>
  );
}
