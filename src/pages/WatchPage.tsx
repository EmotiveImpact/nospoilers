import { lazy, Suspense } from "react";

const WatchWorkspace = lazy(() =>
  import("./WatchWorkspace.tsx").then((module) => ({ default: module.WatchWorkspace })),
);

export function WatchPage({ path = "/watch", search }: { path?: string; search: string }) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[70svh] place-items-center bg-ink px-5" aria-busy="true">
          <p className="text-sm text-mute">Loading Watch…</p>
        </main>
      }
    >
      <WatchWorkspace path={path} search={search} />
    </Suspense>
  );
}
