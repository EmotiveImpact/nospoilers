import { Button } from "@/components/ui/button";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { ReactNode } from "react";

type RetentionDays = 0 | 90 | 180 | 365;
type RetentionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; days: RetentionDays };

export function RetentionScreen({
  previewing,
  ended,
  retention,
  draft,
  canChange,
  busy,
  confirmation,
  onDraft,
  onSave,
}: {
  previewing: boolean;
  ended: boolean;
  retention: RetentionState;
  draft: RetentionDays;
  canChange: boolean;
  busy: boolean;
  confirmation: ReactNode;
  onDraft: (days: RetentionDays) => void;
  onSave: () => void;
}) {
  const ready = retention.status === "ready";
  return (
    <section className="watch-narrow mt-4">
      <WatchPageHeader
        title="Retention"
        lede="How long operational lists remain visible."
        action={
          canChange && ready ? (
            <div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || draft === retention.days}
                onClick={onSave}
              >
                Save
              </Button>
              {confirmation}
            </div>
          ) : undefined
        }
      />
      <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
        Lists hide older alerts, jobs, receipts, revisions, and audit rows after this window.
        Append-only evidence is not deleted. Uninstall still drops the tenant.
      </p>
      {previewing ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Preview cannot change live retention. No invented incident.
        </p>
      ) : ended ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Subscribe to keep configurable retention.
        </p>
      ) : retention.status === "error" ? (
        <p role="alert" className="mt-6 text-[13px] text-danger">{retention.message}</p>
      ) : retention.status === "loading" ? (
        <p className="mt-6 text-[13px] text-dim" aria-live="polite">Loading retention…</p>
      ) : (
        <div className="watch-card mt-[18px] p-5">
          <label className="flex flex-col gap-1">
            <span className="watch-kicker">List window</span>
            <select
              value={draft}
              disabled={!canChange || busy}
              onChange={(event) => onDraft(Number(event.target.value) as RetentionDays)}
              className="mt-2 h-12 rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40 disabled:opacity-50"
            >
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
              <option value={0}>Keep while this install exists</option>
            </select>
          </label>
          {!canChange ? (
            <p className="mt-3 text-[13px] leading-relaxed text-mute">
              An install admin has to change this window.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
