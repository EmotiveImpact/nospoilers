import { QuietEmptyState } from '../design/QuietComponents';
import { WatchSkeleton } from "@/components/WatchDataState";
import { Button } from "@/components/ui/button";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { loadWatchJson, scopedWatchApi } from "@/watch/api";
import { useState } from "react";
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from "@/components/motion/select";
import "../design/journey-administration.css";

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

  const [filterNow]=useState(()=>Date.now());
  const [filters,setFilters]=useState({installationId,action:'all',days:'all'});
  const current=filters.installationId===installationId?filters:{installationId,action:'all',days:'all'};
  const rows=audit.status==='ready'?audit.rows:[];
  const actions=Array.from(new Set(rows.map(row=>row.action))).sort();
  const filtered=rows.filter(row=>(current.action==='all'||row.action===current.action)&&(current.days==='all'||Date.parse(row.at)>=filterNow-Number(current.days)*86400000));
  const canExport = !previewing && audit.status === "ready";

  return (
    <section className="journey-administration">
      <WatchPageHeader
        title="Who changed what."
        lede="Administrative changes, separate from scan activity."
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
      {canExport?<div className="journey-admin-toolbar"><Select value={current.action} onValueChange={action=>setFilters({...current,action})}><SelectTrigger aria-label="Audit event"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All changes</SelectItem>{actions.map(action=><SelectItem key={action} value={action}>{action.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Select value={current.days} onValueChange={days=>setFilters({...current,days})}><SelectTrigger aria-label="Audit date"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All recorded dates</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select><span>{filtered.length} of {rows.length} loaded events</span></div>:null}
      {exportError ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {exportError}
        </p>
      ) : null}
      {previewing ? (
        <>
          <p className="mt-6 text-[13px] leading-relaxed text-mute">
            Preview cannot export a live audit log. No invented incident.
          </p>
          <QuietEmptyState title="No admin writes recorded on this install yet."><p>Administrative changes will appear here when they are recorded. Scan findings remain in Releases.</p></QuietEmptyState>
        </>
      ) : audit.status === "solo" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">The audit log is on Team.</p>
      ) : audit.status === "ended" ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">Subscribe to Team to keep the audit log.</p>
      ) : audit.status === "error" ? (
        <p role="alert" className="mt-6 text-[13px] text-danger">
          {audit.message}
        </p>
      ) : audit.status === "loading" ? (
        <WatchSkeleton variant="list" className="mt-4" />
      ) : audit.rows.length === 0 ? (
        <QuietEmptyState title="No admin writes recorded on this install yet."><p>Administrative changes will appear here when they are recorded. Scan findings remain in Releases.</p></QuietEmptyState>
      ) : (
        <><div className="journey-admin-table"><table aria-label="Administrative changes"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Scope</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td><time dateTime={row.at}>{new Date(row.at).toLocaleString()}</time></td><td>{row.actorLogin}</td><td><strong>{row.action.replaceAll('_',' ')}</strong><small>{row.summary}</small></td><td>{installationId?`Installation ${installationId}`:'Current account'}</td></tr>)}</tbody></table></div>{filtered.length===0?<div className="watch-empty">No loaded events match these filters.</div>:null}<p className="journey-admin-note">Filters apply to loaded events. Export includes the available audit history for this scope. Secret values are excluded from the audit record.</p></>
      )}
    </section>
  );
}
