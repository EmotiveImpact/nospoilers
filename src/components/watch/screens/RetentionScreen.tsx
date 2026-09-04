import { Button } from "@/components/ui/button";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { ReactNode } from "react";

type RetentionDays = 0 | 90 | 180 | 365;
type RetentionState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; days: RetentionDays };

const WINDOWS: { days: RetentionDays; label: string; note: string }[] = [
  { days: 90, label: "90 days", note: "Lists hide after 90 days" },
  { days: 180, label: "180 days", note: "Lists hide after 180 days" },
  { days: 365, label: "365 days", note: "Lists hide after a year" },
  { days: 0, label: "Keep", note: "While this install exists" },
];

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
        <>
          <p className="mt-6 text-[13px] leading-relaxed text-mute">
            Preview cannot change live retention. No invented incident.
          </p>
          <div className="mt-[18px] grid gap-3 sm:grid-cols-2">
            {WINDOWS.map((option) => (
              <div key={option.days} className="watch-stat">
                <span className="watch-kicker">{option.label}</span>
                <p className="watch-tiny mt-2 text-dim">{option.note}</p>
              </div>
            ))}
          </div>
        </>
      ) : ended ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Subscribe to keep configurable retention.
        </p>
      ) : retention.status === "error" ? (
        <p role="alert" className="mt-6 text-[13px] text-danger">{retention.message}</p>
      ) : retention.status === "loading" ? (
        <p className="mt-6 text-[13px] text-dim" aria-live="polite">Loading retention…</p>
      ) : (
        <>
          <div className="mt-[18px] grid gap-3 sm:grid-cols-2">
            {WINDOWS.map((option) => {
              const selected = draft === option.days;
              const current = retention.days === option.days;
              return (
                <button
                  key={option.days}
                  type="button"
                  disabled={!canChange || busy}
                  onClick={() => onDraft(option.days)}
                  className={`watch-stat text-left ${selected ? "border-line-strong" : ""}`}
                  aria-pressed={selected}
                >
                  <span className="watch-kicker">{option.label}</span>
                  <p className="watch-tiny mt-2 text-dim">
                    {current ? "Current" : option.note}
                  </p>
                </button>
              );
            })}
          </div>
          {!canChange ? (
            <p className="mt-3 text-[13px] leading-relaxed text-mute">
              An install admin has to change this window.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
