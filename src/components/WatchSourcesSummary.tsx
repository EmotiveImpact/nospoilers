import type { setupProgress } from "@/watch/verdict.ts";

type SourceRow = {
  key: string;
  kind: string;
  name: string;
  meta: string;
};

export function WatchSourcesSummary({
  mode,
  sources,
  setup,
}: {
  mode: "sources" | "setup";
  sources: SourceRow[];
  setup: ReturnType<typeof setupProgress>;
}) {
  if (mode === "setup") {
    return (
      <div className="mb-10">
        <h1 className="font-display text-3xl tracking-tight text-snow">Finish setup</h1>
        <p className="mt-2 text-sm text-mute">
          Cover each path customers can use to receive a production artifact.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {setup.steps.map((step) => (
            <li key={step.key} className="rounded-lg border border-white/8 bg-panel p-4">
              <p className="text-sm text-snow">{step.label}</p>
              <p className="mt-1 text-xs text-dim">{step.done ? "Connected" : "Not connected"}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <h1 className="font-display text-3xl tracking-tight text-snow">Everything we watch</h1>
      <p className="mt-2 text-sm text-mute">
        GitHub, registries, production websites, and map custody in one list.
      </p>
      {sources.length === 0 ? (
        <div className="mt-5 rounded-lg border border-white/8 bg-panel p-5">
          <p className="text-sm text-snow">No sources connected</p>
          <p className="mt-1 text-xs text-dim">Use the controls below to connect the first source.</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel">
          {sources.map((source) => (
            <li key={source.key} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-snow">{source.name}</p>
                <p className="mt-1 text-xs text-dim">{source.meta}</p>
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-dim">
                {source.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
