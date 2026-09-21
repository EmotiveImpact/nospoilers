import "../design/journey-settings.css";
import { WatchSkeleton } from "@/components/WatchDataState";
import { Button } from "@/components/ui/button";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import type { ReactNode } from "react";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/motion/select";

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
    <section className="journey-retention">
      <WatchPageHeader title="Keep evidence deliberately." lede="Understand what stays available and what expires." />
      <div className="journey-settings-split">
        <div>
          {previewing ? <p>Preview cannot change live retention.</p> : ended ? <p>Subscribe to keep configurable retention.</p> : retention.status === "error" ? <p role="alert">{retention.message}</p> : !ready ? <WatchSkeleton variant="list" /> : <>
            <div className="journey-setting-row"><div><h2>Operational history window</h2><p>How long alerts, jobs, receipts, revisions and audit rows stay visible in lists.</p></div><Select value={String(draft)} disabled={!canChange||busy} onValueChange={value=>onDraft(Number(value) as RetentionDays)}><SelectTrigger aria-label="Operational history window" className="w-full sm:w-44"><SelectValue/></SelectTrigger><SelectContent>{WINDOWS.map(option=><SelectItem key={option.days} value={String(option.days)}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="journey-setting-row"><div><h2>Saved evidence</h2><p>Changing the list window does not delete append-only evidence.</p></div><span>Retained</span></div>
            <div className="journey-setting-row"><div><h2>Current window</h2><p>Changes take effect only after confirmation.</p></div><span>{WINDOWS.find(option=>option.days===retention.days)?.label}</span></div>
            {canChange ? <div className="journey-savebar"><span>Review the effect before saving.</span><Button disabled={busy || draft===retention.days} onClick={onSave}>Review changes</Button></div> : <p className="mt-6 text-sm text-mute">An install admin has to change this window.</p>}
            {confirmation}
          </>}
        </div>
        <aside className="journey-side-note"><h3>A list window is not deletion</h3><p>Older records can disappear from operational lists without their underlying evidence being erased.</p><h3>Check the scope</h3><p>This setting applies to the selected GitHub installation. Workspace history and deletion requests have their own authority and retention checks.</p></aside>
      </div>
    </section>
  );
}
