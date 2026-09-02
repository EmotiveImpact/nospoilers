import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  name?: string;
  githubApp: boolean;
  stripe?: boolean;
  resend?: boolean;
  role?: "all" | "web" | "worker";
  ui?: boolean;
  database: { mode: string };
  worker: { recoveryIntervalMs: number; visibilityPollIntervalMs: number };
};

export function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/health");
        const body = (await response.json()) as Health & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Health check failed.");
        if (cancelled) return;
        setHealth(body);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load status.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Operations</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Status
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
        Public liveness only. No tenant data, no connection strings, no invented incidents.
      </p>
      {error ? <p className="mt-10 text-sm text-danger">{error}</p> : null}
      {!error && !health ? <p className="mt-10 text-sm text-dim">Checking…</p> : null}
      {health ? (
        <ul className="mt-10 max-w-lg divide-y divide-white/5">
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Application</p>
            <p className="text-sm text-snow">{health.ok ? "up" : "down"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">GitHub App</p>
            <p className="text-sm text-snow">{health.githubApp ? "configured" : "not configured"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Stripe</p>
            <p className="text-sm text-snow">{health.stripe ? "configured" : "not configured"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Resend</p>
            <p className="text-sm text-snow">{health.resend ? "configured" : "not configured"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Process role</p>
            <p className="text-sm text-snow">{health.role ?? "all"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Built UI</p>
            <p className="text-sm text-snow">{health.ui ? "on disk" : "not on disk"}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Database</p>
            <p className="text-sm text-snow">{health.database.mode}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Worker recovery</p>
            <p className="text-sm text-snow">{Math.round(health.worker.recoveryIntervalMs / 60000)} min</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Visibility poller</p>
            <p className="text-sm text-snow">
              {Math.round(health.worker.visibilityPollIntervalMs / 3600000)} h
            </p>
          </li>
        </ul>
      ) : null}
    </main>
  );
}
