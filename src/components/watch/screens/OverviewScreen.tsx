import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import {ArtifactOverview} from '../ArtifactOverview';

export function OverviewScreen() {
  const { WatchOverview, deskAlerts, ended, githubApp, githubPaused, installUrl, jobSummary, overviewSectionState, releases, retryDeskSection, route, search, setup, sourceRows, user } = useWatchScreenContext();
  const workspaceId=new URLSearchParams(search).get('workspace');
  if(route.view==='overview'&&workspaceId)return <ArtifactOverview workspaceId={workspaceId} search={search} nowLabel={new Date().toLocaleDateString()}/>;
  return (
    <>
      {route.view === "overview" ? (
                <WatchOverview
                  search={search}
                  ended={ended}
                  githubPaused={githubPaused}
                  installUrl={installUrl && githubApp && user ? installUrl : undefined}
                  alerts={deskAlerts}
                  sources={sourceRows}
                  packsRead={releases.length}
                  failedPolicy={releases.filter((row) => row.receiptStatus === "failed-policy").length}
                  queueDepth={jobSummary.queued + jobSummary.running}
                  lastRunLabel={
                    jobSummary.running > 0 ? "running" : jobSummary.queued > 0 ? "queued" : "idle"
                  }
                  setup={setup}
                  state={overviewSectionState}
                  onRetry={() => void retryDeskSection("overview")}
                />
              ) : null}
    </>
  );
}
