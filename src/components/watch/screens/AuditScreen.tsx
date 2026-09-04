import { Button } from "@/components/ui/button";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { loadWatchJson, scopedWatchApi } from "@/watch/api";
import { useState } from "react";

type AuditRow = {
  id: number;
  at: string;
  actorLogin: string;
  action: string;
  summary: string;
};

type AuditState =
  | { status: "loading" }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string }
  | { status: "ready"; rows: AuditRow[] };

export function AuditScreen({
  previewing,
  audit,
  installationId,
}: {
  previewing: boolean;
  audit: AuditState;
  installationId: number | null;
}) {
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportAudit(): Promise<void> {
    setExportError(null);
    try {
      const body = await loadWatchJson<{ exportedAt: string }>(
        scopedWatchApi("/api/audit/export", installationId),
      );
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nospoilers-audit-${body.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the audit log.");
    }
  }

  const canExport = !previewing && audit.status === "ready";

  return (
    <section className="watch-narrow">
      <WatchPageHeader
        title="Audit log"
        lede="Administrative changes and response activity for this install."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canExport}
            onClick={() => void exportAudit()}
          >
            Export audit JSON
          </Button>
        }
      />
      <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
        Team and trial installs can export this install’s admin writes, notification deliveries,
        and alert titles. Destructive actions require typing the public identifier. Webhook URLs,
        emails, tokens, and other secret values are never stored here.
      </p>
      {exportError ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {exportError}
        </p>
      ) : null}
      {previewing ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Preview cannot export a live audit log. No invented incident.
        </p>
      ) : audit.status === "solo" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">The audit log is on Team.</p>
      ) : audit.status === "ended" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">Subscribe to Team to keep the audit log.</p>
      ) : audit.status === "error" ? (
        <p role="alert" className="mt-6 text-[13px] text-danger">
          {audit.message}
        </p>
      ) : audit.status === "loading" ? (
        <p className="mt-6 text-[13px] text-dim" aria-live="polite">
          Loading audit activity…
        </p>
      ) : audit.rows.length === 0 ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          No admin writes recorded on this install yet.
        </p>
      ) : (
        <div className="watch-card mt-4">
          {audit.rows.map((row) => (
            <div key={row.id} className="watch-kv items-start">
              <div className="min-w-0">
                <p className="text-[13px] text-snow">{row.summary}</p>
                <p className="watch-tiny mt-1 font-mono text-dim">
                  {row.actorLogin} · {row.action}
                </p>
              </div>
              <time className="watch-tiny shrink-0 text-dim" dateTime={row.at}>
                {new Date(row.at).toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
