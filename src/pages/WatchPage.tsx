import { lazy, Suspense } from "react";
import {WatchLoadingBoundary,WatchLoadingSignal} from '@/components/watch/WatchLighthouse';

const WatchWorkspace = lazy(() =>
  import("./WatchWorkspace.tsx").then((module) => ({ default: module.WatchWorkspace })),
);

export function WatchPage({ path = "/watch", search }: { path?: string; search: string }) {
  return (
    <WatchLoadingBoundary><Suspense
      fallback={
        <WatchLoadingSignal/>
      }
    >
      <WatchWorkspace path={path} search={search} />
    </Suspense></WatchLoadingBoundary>
  );
}
