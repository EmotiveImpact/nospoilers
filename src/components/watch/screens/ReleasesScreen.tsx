import '../release-responsive.css';
import { useId } from "react";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { UploadedReleases } from '@/components/watch/UploadedReleases';
import {HostedDecisionList} from '../HostedDecisionList';
import { WatchReleaseBrief } from "@/components/watch/WatchReleaseBrief";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { buildReleaseBriefModel } from "@/watch/release-brief";
import type { ReleaseRevision } from "@/watch/types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  FileCheck2,
  GitCommitHorizontal,
} from "lucide-react";

function releaseStatus(release: ReleaseRevision) {
  const model = buildReleaseBriefModel(release);
  return {
    ...model,
    label: model.blocked ? "Blocked" : model.ready ? "Passes recorded checks" : model.status === 'review' ? 'Review' : 'Unknown',
  };
}

function StatusIcon({ status }: { status: import('@/assurance/types').Decision }) {
  if (status === "blocked") return <AlertTriangle className="size-4" aria-hidden />;
  if (status === "ready") return <CheckCircle2 className="size-4" aria-hidden />;
  return <Clock3 className="size-4" aria-hidden />;
}

function releaseDisplayName(coordinate:string){
  const upload=/^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}#(.+)$/i.exec(coordinate);
  return upload?.[1].split(/[\\/]/).filter(Boolean).at(-1)??coordinate;
}

export function ReleasesScreen() {
  const browserId=useId();
  const {
    Button,
    WatchSectionError,
    WatchSkeleton,
    activeInstallId,
    canExportReleases,
    datasetState,
    downloadingReceiptId,
    formatSealedBytes,
    ledgerExportError,
    loadJson,
    navigate,
    receiptError,
    releases,
    retryDeskSection,
    route,
    scopedApi,
    search,
    selectedRelease,
    setDownloadingReceiptId,
    setLedgerExportError,
    setReceiptError,
    watchHref,
    watchPath,
  } = useWatchScreenContext();

  if (route.view !== "releases") return null;
  if (route.releaseId && selectedRelease) return <WatchReleaseBrief release={selectedRelease} />;
  if (['all','passed','attention'].includes(new URLSearchParams(search).get('hostedDecision')??'') && new URLSearchParams(search).get('install')) return <HostedDecisionList key={search} search={search}/>;

  const readyCount = releases.filter((release) => releaseStatus(release).ready).length;
  const blockedCount = releases.filter((release) => releaseStatus(release).blocked).length;
  const preview = selectedRelease;
  const previewModel = preview ? releaseStatus(preview) : null;
  const params=new URLSearchParams(search);
  // Saved attempts belong to the workspace, including websites without GitHub.
  // The selected installation only scopes the separate repository ledger.
  const uploadInstallationId=params.has('workspace') || params.has('upload') && !params.has('install') ? null : activeInstallId;
  const showRepositoryLedger=activeInstallId!==null || releases.length>0;
  if(params.get('uploadView')==='detail')return <UploadedReleases search={search} installationId={uploadInstallationId}/>;
  const browser=showRepositoryLedger&&(route.releaseId||route.releasePreviewId||(!params.has('upload')&&params.get('releaseView')==='connected'))?'connected':'attempts';
  const chooseBrowser=(next:'attempts'|'connected')=>{
    if(next===browser)return;
    const query=new URLSearchParams(search);query.set('releaseView',next);
    query.delete('hostedDecision');query.delete('before');
    if(next==='attempts'){query.delete('release');query.delete('preview');}
    else for(const key of ['upload','uploadView','uploadFinding','uploadTab'])query.delete(key);
    navigate(`/watch/releases?${query}`);
  };

  const exportLedger = () => {
    setLedgerExportError(null);
    void (async () => {
      try {
        const body = await loadJson<{ exportedAt: string }>(
          scopedApi("/api/releases/export", activeInstallId),
        );
        const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `nospoilers-releases-${body.exportedAt.slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setLedgerExportError(error instanceof Error ? error.message : "Could not export the release ledger.");
      }
    })();
  };

  const downloadReceipt = (release: ReleaseRevision) => {
    setReceiptError(null);
    setDownloadingReceiptId(release.receiptId);
    void (async () => {
      try {
        const body = await loadJson<{ receipt: unknown; id: number }>(`/api/receipts/${release.receiptId}`);
        const blob = new Blob([`${JSON.stringify(body.receipt, null, 2)}\n`], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const safe = release.coordinate.replace(/[^a-zA-Z0-9._@+-]+/g, "-").slice(0, 80);
        link.download = `nospoilers-receipt-${safe || "artifact"}-${body.id}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setReceiptError(error instanceof Error ? error.message : "Could not download that receipt.");
      } finally {
        setDownloadingReceiptId(null);
      }
    })();
  };

  return (
    <section className="watch-release-index" aria-label="Releases">
      <WatchPageHeader
        title="Releases"
        lede="Choose a revision for a quick decision preview, then open its complete evidence brief."
        action={
          canExportReleases && showRepositoryLedger && browser==='connected' ? (
            <Button type="button" size="sm" variant="outline" onClick={exportLedger}>
              Export ledger
            </Button>
          ) : undefined
        }
      />

      <div className="mt-5 flex flex-wrap gap-1 border-b border-white/10" role="tablist" aria-label="Release history type" onKeyDown={event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const index=tabs.indexOf(event.target as HTMLButtonElement);if(index<0)return;event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        tabs[next].focus();tabs[next].click();
      }}>
        {(['attempts','connected'] as const).filter(value=>value==='attempts'||showRepositoryLedger).map(value=><button key={value} type="button" role="tab" id={`${browserId}-${value}`} aria-controls={`${browserId}-panel`} aria-selected={browser===value} tabIndex={browser===value?0:-1} className="min-h-11 border-b-2 border-transparent px-3 text-sm text-mute aria-selected:border-white/60 aria-selected:text-snow" onClick={()=>chooseBrowser(value)}>{value==='attempts'?'Saved attempts':'Connected revisions'}</button>)}
      </div>
      <div role="tabpanel" id={`${browserId}-panel`} aria-labelledby={`${browserId}-${browser}`}>
      {browser==='attempts'?<UploadedReleases search={search} installationId={uploadInstallationId} />:null}
      {browser==='connected' ? <>
      <div className="watch-release-index-stats" aria-label="Release ledger summary">
        <div><span>Revisions</span><strong>{releases.length}</strong><small>On this install</small></div>
        <div><span>Ready</span><strong className="is-ready">{readyCount}</strong><small>Clean required evidence</small></div>
        <div><span>Blocked</span><strong className={blockedCount ? "is-blocked" : "is-ready"}>{blockedCount}</strong><small>Needs attention</small></div>
      </div>

      <p className="watch-release-index-guidance">
        Failed-policy, inconclusive, and digest-changed revisions are never clean. Select any revision to compare its decision before opening the complete brief.
      </p>

      {ledgerExportError ? <p className="watch-release-error">{ledgerExportError}</p> : null}
      {receiptError ? <p className="watch-release-error">{receiptError}</p> : null}

      {datasetState.releases.status === "loading" ? (
        <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
      ) : datasetState.releases.status === "error" ? (
        <WatchSectionError
          className="mt-6 max-w-2xl"
          message={datasetState.releases.message}
          onRetry={() => void retryDeskSection("releases")}
        />
      ) : releases.length === 0 ? (
        <div className="watch-empty mt-6">
          <strong className="block text-sm font-medium text-snow">No repository-linked revisions yet</strong>
          <p className="mt-1.5">Choose Saved attempts for uploads, website checks and queued or failed work. This ledger contains signed revisions saved to the selected GitHub connection.</p>
        </div>
      ) : (
        <div className="watch-release-browser">
          <section className="watch-release-list" aria-labelledby="release-list-heading">
            <div className="watch-release-list-heading">
              <div><span className="watch-kicker">Ledger</span><h2 id="release-list-heading">Connected revisions</h2></div>
              <span>{releases.length}</span>
            </div>
            <ol>
              {releases.map((release) => {
                const state = releaseStatus(release);
                const selected = preview?.id === release.id;
                return (
                  <li key={release.id}>
                    <button
                      type="button"
                      className={selected ? "is-selected" : undefined}
                      aria-pressed={selected}
                      onClick={() =>
                        navigate(
                          watchHref(watchPath("releases"), search, {
                            release: null,
                            previewRelease: release.id,
                          }),
                        )
                      }
                    >
                      <span className={`watch-release-list-icon is-${state.status}`}><StatusIcon status={state.status} /></span>
                      <span className="watch-release-list-copy">
                        <strong title={release.coordinate}>{releaseDisplayName(release.coordinate)}</strong>
                        <small>{release.channel} · {release.sourceRevision ?? release.artifactSha256.slice(0, 12)} · {new Date(release.createdAt).toLocaleDateString()}</small>
                      </span>
                      <span className={`watch-release-list-status is-${state.status}`}>{state.label}</span>
                      <ArrowRight className="watch-release-list-arrow size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {preview && previewModel ? (
            <article className={`watch-release-preview is-${previewModel.status}`} aria-live="polite">
              <div className="watch-release-preview-topline">
                <span className="watch-kicker">Selected revision</span>
                <span className={`watch-release-state is-${previewModel.status}`}><StatusIcon status={previewModel.status} /> {previewModel.label}</span>
              </div>
              <h2 title={preview.coordinate}>{releaseDisplayName(preview.coordinate)}</h2>
              <p className="watch-release-preview-meta">
                {preview.channel} channel · {preview.sourceRevision ? `source revision ${preview.sourceRevision}` : `sha256 ${preview.artifactSha256.slice(0, 12)}`} · {new Date(preview.createdAt).toLocaleString()}
              </p>

              <div className="watch-release-preview-verdict">
                <div className={`watch-release-preview-verdict-icon is-${previewModel.status}`}><StatusIcon status={previewModel.status} /></div>
                <div><span>Release decision</span><strong>{previewModel.title}</strong><p>{previewModel.detail}</p></div>
                <div className="watch-release-preview-score"><strong>{previewModel.cleanChecks}/{previewModel.applicableChecks}</strong><span>required checks clean</span></div>
              </div>

              <div className="watch-release-preview-proof" aria-label="Proof summary">
                {previewModel.steps.map((step) => (
                  <div key={step.key}>
                    <span className={`is-${step.tone}`}>
                      {step.tone === "clean" ? <CheckCircle2 className="size-4" aria-hidden /> : step.tone === "blocked" ? <AlertTriangle className="size-4" aria-hidden /> : step.tone === "waiting" ? <Clock3 className="size-4" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
                    </span>
                    <p><strong>{step.label}</strong><small>{step.status}</small></p>
                  </div>
                ))}
              </div>

              <dl className="watch-release-preview-facts">
                <div><dt><GitCommitHorizontal className="size-4" aria-hidden /> Digest</dt><dd>{preview.artifactSha256.slice(0, 16)}…</dd></div>
                <div><dt><FileCheck2 className="size-4" aria-hidden /> Receipt</dt><dd>{preview.receiptStatus?.replace("-", " ") ?? "pending"}</dd></div>
                <div><dt>Size</dt><dd>{preview.artifactBytes != null ? formatSealedBytes(preview.artifactBytes) : "Not recorded"}</dd></div>
              </dl>

              <div className="watch-release-preview-actions">
                <Button
                  type="button"
                  onClick={() =>
                    navigate(
                      watchHref(watchPath("releases"), search, {
                        previewRelease: preview.id,
                        release: preview.id,
                      }),
                    )
                  }
                >
                  Open full release brief <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={downloadingReceiptId === preview.receiptId}
                  onClick={() => downloadReceipt(preview)}
                >
                  <Download className="size-4" aria-hidden />
                  {downloadingReceiptId === preview.receiptId ? "Saving…" : "Receipt JSON"}
                </Button>
              </div>
            </article>
          ) : (
            <div className="watch-release-preview-empty">Select a revision to inspect it.</div>
          )}
        </div>
      )}
      </> : null}
      </div>
    </section>
  );
}
