import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import {GithubConnectionReturn} from '../GithubWorkspaceConnection';

export function SetupScreen() {
  const { CoverageLock, WatchSourcesSummary, adminOnly, ended, retryDeskSection, route, search, setup, setupSectionState, sourceRows } = useWatchScreenContext();
  if (route.view !== "setup") return null;
  if(new URLSearchParams(search).get('githubReturn')==='1')return <GithubConnectionReturn/>;
  return (
    <section className="relative min-h-72">
      {ended ? <CoverageLock variant="watch" title="Subscribe to keep watching." /> : null}
      <div inert={ended} className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
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
