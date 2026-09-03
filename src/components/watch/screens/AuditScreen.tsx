import { Button } from "@/components/ui/button";
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

  return (
    <section className="mt-4">
      <h1 className="font-display text-3xl tracking-tight text-snow">Audit log</h1>
      <p className="mt-2 text-sm text-mute">Administrative changes and response activity for this install.</p>
      <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
        Team and trial installs can export this install’s admin writes, notification deliveries,
        and alert titles. Destructive actions require typing the public identifier. Webhook URLs,
        emails, tokens, and other secret values are never stored here.
      </p>
      {previewing ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">
          Preview cannot export a live audit log. No invented incident.
        </p>
      ) : audit.status === "solo" ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">The audit log is on Team.</p>
      ) : audit.status === "ended" ? (
        <p className="mt-6 text-sm leading-relaxed text-mute">Subscribe to Team to keep the audit log.</p>
      ) : audit.status === "error" ? (
        <p role="alert" className="mt-6 text-sm text-danger">{audit.message}</p>
      ) : audit.status === "loading" ? (
        <p className="mt-6 text-sm text-dim" aria-live="polite">Loading audit activity…</p>
      ) : (
        <>
          <div className="mt-4">
            <Button type="button" size="sm" variant="outline" onClick={() => void exportAudit()}>
              Export audit log
            </Button>
            {exportError ? <p role="alert" className="mt-2 text-sm text-danger">{exportError}</p> : null}
          </div>
          {audit.rows.length === 0 ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              No admin writes recorded on this install yet.
            </p>
          ) : (
            <div className="mt-6 max-w-3xl overflow-x-auto rounded-lg border border-white/8 bg-panel">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Administrative changes and response activity</caption>
                <thead>
                  <tr className="border-b border-white/8 text-xs text-dim">
                    <th className="px-4 py-3 font-normal">Time</th>
                    <th className="px-4 py-3 font-normal">Summary</th>
                    <th className="px-4 py-3 font-normal">Actor</th>
                    <th className="px-4 py-3 font-normal">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-dim">
                        <time dateTime={row.at}>{new Date(row.at).toLocaleString()}</time>
                      </td>
                      <td className="min-w-56 px-4 py-3 text-snow">{row.summary}</td>
                      <td className="px-4 py-3 font-mono text-xs text-mute">{row.actorLogin}</td>
                      <td className="px-4 py-3 font-mono text-xs text-mute">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
