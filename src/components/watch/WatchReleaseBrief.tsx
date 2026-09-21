import './design/release-journey.css';
import {ReleaseWorkspaceSummary} from "./ReleaseWorkspaceSummary";
import "./connected-release-workspace.css";
import { Button } from "@/components/ui/button";
import {HostedReleaseEvidence} from './HostedReleaseEvidence';
import {ReleasePassportDownload} from './ReleaseAssurancePanel';
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { buildReleaseBriefModel, releaseFamily } from "@/watch/release-brief";
import type { ReleaseRevision } from "@/watch/types";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  GitCommitHorizontal,
  Link2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type {Assessment} from '@/assurance/types';
import type {ScanReport} from '@/scanner/types';

function receiptStatusLabel(release: ReleaseRevision) {
  if (release.receiptStatus === "passed") return "Scan passed";
  if (release.receiptStatus === "failed-policy") return "Blocked";
  if (release.receiptStatus === "inconclusive") return "Inconclusive";
  return "Pending";
}

function releaseStatusLabel(release: ReleaseRevision) {
  if (release.mismatch) return "Digest changed";
  if (release.legalHold?.active) return "Legal hold";
  if (release.approval?.decision === "rejected") return "Rejected";
  if (release.receiptStatus === "passed") return "Scan passed";
  if (release.receiptStatus === "failed-policy") return "Blocked";
  if (release.receiptStatus === "inconclusive") return "Inconclusive";
  return "Pending";
}

export function WatchReleaseBrief({ release }: { release: ReleaseRevision }) {
  const {
    Button: ContextButton,
    activeInstallId,
    attachingReleaseId,
    beginConfirm,
    canGovernReleases,
    canPublishVerify,
    confirming,
    confirmForm,
    deliveryError,
    deliveryUrlByRelease,
    downloadingReceiptId,
    formatSealedBytes,
    governanceReasonByRelease,
    installAdmin,
    loadJson,
    locked,
    navigate,
    receiptError,
    refreshSignedIn,
    releases,
    search,
    selectedInstallId,
    setAttachingReleaseId,
    setDeliveryError,
    setDeliveryUrlByRelease,
    setDownloadingReceiptId,
    setGovernanceReasonByRelease,
    setReceiptError,
    setVerifyingLocationId,
    verifyingLocationId,
    watchHref,
    watchPath,
  } = useWatchScreenContext();
  const [section,setSection]=useState('findings');
  const [recordedReport,setRecordedReport]=useState<{releaseId:number;report:ScanReport|null}|null>(null);
  const onReport=useCallback((report:ScanReport|null)=>setRecordedReport({releaseId:release.id,report}),[release.id]);
  const findingCount=recordedReport?.releaseId===release.id?recordedReport.report?.findings.length:undefined;
  const revealSection=useCallback((next:string)=>{setSection(next==='controls'?'history':next);if(next==='controls')document.getElementById(`history-nav-release-${release.id}-decisions`)?.click();},[release.id]);
  const revealFix=useCallback(()=>{setSection('history');document.getElementById(`history-nav-release-${release.id}-remediation`)?.click();},[release.id]);
  const [observed,setObserved]=useState<{record:ReleaseRevision;assessment:Assessment|null}|null>(null);
  const onAssessment=useCallback((assessment:Assessment|null)=>setObserved({record:release,assessment}),[release]);
  const brief = useMemo(() => buildReleaseBriefModel({...release,readiness:observed?.record===release?observed.assessment??undefined:release.readiness}), [release,observed]);
  const family = releaseFamily(release.coordinate);
  const history = releases.filter((row) => releaseFamily(row.coordinate) === family).slice(0, 5);

  const downloadReceipt = () => {
    setReceiptError(null);
    setDownloadingReceiptId(release.receiptId);
    void (async () => {
      try {
        const body = await loadJson<{ receipt: unknown; id: number }>(`/api/receipts/${release.receiptId}`);
        const blob = new Blob([`${JSON.stringify(body.receipt, null, 2)}\n`], {
          type: "application/json",
        });
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
    <section className="watch-release-brief journey-hosted-brief release-workspace" aria-labelledby="release-brief-title">
      <button
        type="button"
        className="watch-release-back"
        onClick={() => navigate(watchHref(watchPath("releases"), search, { release: null }))}
      >
        <ArrowLeft className="size-4" aria-hidden />
        All releases
      </button>

      <header className="watch-release-heading">
        <div className="min-w-0">
          <span className="watch-kicker">Release evidence</span>
          <h1 id="release-brief-title">{release.coordinate}</h1>
          <p>
            {release.channel} channel
            {release.sourceRevision ? ` · source revision ${release.sourceRevision}` : ""}
            {release.createdAt ? ` · ${new Date(release.createdAt).toLocaleString()}` : ""}
          </p>
        </div>
        <div className="connected-release-heading-actions"><Button variant="outline" onClick={downloadReceipt} disabled={downloadingReceiptId===release.receiptId}><Download className="size-4" aria-hidden/>{downloadingReceiptId===release.receiptId?'Saving…':'Receipt JSON'}</Button><Button onClick={revealFix}>Verify a fix</Button></div>
      </header>

      {receiptError ? <p className="watch-release-error">{receiptError}</p> : null}
      {deliveryError ? <p className="watch-release-error">{deliveryError}</p> : null}

      <ReleaseWorkspaceSummary findingCount={findingCount} title={brief.title} detail={brief.detail} tone={brief.status}
        scope="Artifact, source identity, delivery and approval are independent evidence. A saved scan alone does not establish release readiness."
        states={brief.steps.map(step=>({key:step.key,label:step.key==='artifact'?'Artifact inspection':step.key==='identity'?'Source identity':step.key==='delivery'?'Production delivery':'Release approval',status:step.status==='Not configured'?(step.key==='identity'?'No attestation recorded':step.key==='delivery'?'Not observed':step.key==='governance'?'No decision recorded':step.status):step.status,detail:step.evidence,tone:step.tone}))}/>
      <div className="journey-release-tabs" role="tablist" aria-label="Release evidence sections" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const i=tabs.indexOf(event.target as HTMLButtonElement);if(i<0)return;event.preventDefault();const n=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();}}>{['findings','files','history','proof'].map(tab=><button role="tab" id={`release-${release.id}-${tab}`} aria-controls={`release-${release.id}-section`} aria-selected={section===tab} tabIndex={section===tab?0:-1} key={tab} onClick={()=>setSection(tab)}>{tab.charAt(0).toUpperCase()+tab.slice(1)}{tab==='findings'&&findingCount!==undefined?<span className="connected-tab-count">{findingCount}</span>:null}</button>)}</div>
      <div role="tabpanel" id={`release-${release.id}-section`} aria-labelledby={`release-${release.id}-${section}`}>
      <div hidden={section!=='proof'}>
<div className="connected-proof-grid"><div className="connected-receipt-facts"><h2>Signed scan record</h2><p>The original record binds the saved outcome to these exact bytes. A valid signature does not mean the artifact passed.</p><dl><div><dt>Receipt status</dt><dd>{receiptStatusLabel(release)}</dd></div><div><dt>Media type</dt><dd>{release.mediaType??'Not recorded'}</dd></div><div><dt>Sealed size</dt><dd>{release.artifactBytes!=null?formatSealedBytes(release.artifactBytes):'Not recorded'}</dd></div><div className="connected-full-fact"><dt>Artifact SHA-256</dt><dd><code>{release.artifactSha256}</code></dd></div></dl>        <Button
          type="button"
          variant="outline"
          onClick={downloadReceipt}
          disabled={downloadingReceiptId === release.receiptId}
        >
          <Download className="size-4" aria-hidden />
          {downloadingReceiptId === release.receiptId ? "Saving…" : "Receipt JSON"}
        </Button><Button variant="outline" onClick={()=>{const current=new URLSearchParams(search);const next=new URLSearchParams({mode:'receipt'});for(const key of ['workspace','install']){const value=current.get(key);if(value)next.set(key,value);}navigate(`${watchPath('scan')}?${next}`);}}>Verify a downloaded record</Button><section className="connected-private-summary"><h3>Unsigned private summary</h3><p>An assurance passport summarizes the review. The original signed scan record remains the evidence of record.</p><ReleasePassportDownload kind="release" recordId={release.id}/></section></div>
<div className="connected-public-proof">
            <div className="watch-release-operation-card">
              <ExternalLink className="size-5" aria-hidden />
              <h3>Public verification</h3>
              <p>{release.publicPage?.enabled ? `Published at ${release.publicPage.path}` : "Private · no active verification page for this receipt."}</p>
              <p>Review the confirmation before publishing. Delivery matching is on demand, not scheduled verification.</p>
              {canPublishVerify?<ContextButton
                type="button"
                size="sm"
                variant="outline"
                onClick={() => beginConfirm({ kind: release.publicPage?.enabled ? "release-unpublish" : "release-publish", id: release.id, expected: release.coordinate })}
              >
                {release.publicPage?.enabled ? "Unpublish verification" : "Publish verification"}
              </ContextButton>:<p>Publishing controls are available to authorized workspace members.</p>}
            </div>
          </div></div>      </div><div hidden={section!=='history'}><section className="watch-release-history" aria-labelledby="release-history-heading">
        <div className="watch-release-section-heading"><div><span className="watch-kicker">History</span><h2 id="release-history-heading">Recent source revisions</h2></div></div>
        <div className="watch-release-history-table">
          {history.map((row) => (
            <button key={row.id} type="button" className={row.id === release.id ? "is-current" : undefined} onClick={() => navigate(watchHref(watchPath("releases"), search, { release: row.id }))}>
              <span>{row.coordinate}</span><span>{row.sourceRevision ?? row.artifactSha256.slice(0, 12)}</span><span>{releaseStatusLabel(row)}</span><span>{new Date(row.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </section>
      </div>        {confirmForm(
          Boolean(
            confirming &&
              "id" in confirming &&
              confirming.id === release.id &&
              ["release-attest", "release-publish", "release-unpublish", "release-approve", "release-reject", "release-hold", "release-hold-release"].includes(confirming.kind),
          ),
        )}<HostedReleaseEvidence releaseId={release.id} receiptId={release.receiptId} search={search} activeSection={section} onReveal={revealSection} onReviewFix={revealFix} onAssessment={onAssessment} onReport={onReport} decisionControls={<section className="watch-release-operations" aria-labelledby="release-operations-heading">
        <div className="watch-release-section-heading">
          <div><span className="watch-kicker">Controls</span><h2 id="release-operations-heading">Release controls</h2></div>
          <p>Actions remain scoped to this release.</p>
        </div>
        <div className="watch-release-operation-grid">
          <section className="watch-release-operation-card"><h3>Production delivery</h3><p>{brief.steps.find(step=>step.key==='delivery')?.evidence}</p>{(release.locations??[]).length?(              <ul className="watch-release-deliveries">
                {(release.locations ?? []).map((location) => (
                  <li key={location.id}>
                    <div><strong>{location.host}</strong><span>{location.lastStatus?.replace("_", " ") ?? "not checked"}</span></div>
                    {installAdmin ? (
                      <ContextButton
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={locked || verifyingLocationId === location.id}
                        onClick={() => {
                          setDeliveryError(null);
                          setVerifyingLocationId(location.id);
                          void fetch(`/api/releases/${release.id}/locations/${location.id}/verify`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ installationId: activeInstallId }),
                          })
                            .then(async (response) => {
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not verify that URL.");
                              await refreshSignedIn(selectedInstallId);
                            })
                            .catch((error: unknown) => setDeliveryError(error instanceof Error ? error.message : "Could not verify that URL."))
                            .finally(() => setVerifyingLocationId(null));
                        }}
                      >
                        {verifyingLocationId === location.id ? "Verifying…" : "Verify now"}
                      </ContextButton>
                    ) : null}
                  </li>
                ))}
              </ul>):<p>No production artifact URL is attached to this release.</p>}</section>
          {installAdmin ? (
            <form
              className="watch-release-operation-card"
              onSubmit={(event) => {
                event.preventDefault();
                if (locked || attachingReleaseId === release.id) return;
                setDeliveryError(null);
                setAttachingReleaseId(release.id);
                void fetch(`/api/releases/${release.id}/locations`, {
                  method: "POST",
                  credentials: "include",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ url: deliveryUrlByRelease[release.id] ?? "", installationId: activeInstallId }),
                })
                  .then(async (response) => {
                    const body = (await response.json()) as { error?: string };
                    if (!response.ok) throw new Error(body.error ?? "Could not attach that URL.");
                    setDeliveryUrlByRelease((current) => ({ ...current, [release.id]: "" }));
                    await refreshSignedIn(selectedInstallId);
                  })
                  .catch((error: unknown) => setDeliveryError(error instanceof Error ? error.message : "Could not attach that URL."))
                  .finally(() => setAttachingReleaseId(null));
              }}
            >
              <Link2 className="size-5" aria-hidden />
              <h3>Delivery proof</h3>
              <p>Attach the production artifact URL and verify its bytes against this receipt.</p>
              <input
                value={deliveryUrlByRelease[release.id] ?? ""}
                onChange={(event) => setDeliveryUrlByRelease((current) => ({ ...current, [release.id]: event.target.value }))}
                aria-label="Production artifact URL"
                placeholder="https://cdn.example.com/app.tgz"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
              />
              <ContextButton type="submit" size="sm" variant="outline" disabled={locked || attachingReleaseId === release.id}>
                {attachingReleaseId === release.id ? "Attaching…" : "Attach URL"}
              </ContextButton>
            </form>
          ) : null}

          <div className="watch-release-operation-card">
            <GitCommitHorizontal className="size-5" aria-hidden />
            <h3>Attestations</h3>
            <p>{(release.attestations ?? []).length ? `${release.attestations?.length} source attestation${release.attestations?.length === 1 ? "" : "s"} recorded.` : "No GitHub or registry attestation is recorded."}</p>
            {(release.attestations ?? []).map((row) => <code key={`${row.source}-${row.createdAt}`}>{row.source} · {row.status.replace("_", " ")}</code>)}
            {canGovernReleases ? (
              <ContextButton type="button" size="sm" variant="outline" onClick={() => beginConfirm({ kind: "release-attest", id: release.id, expected: release.coordinate })}>
                Refresh attestations
              </ContextButton>
            ) : null}
          </div>


        </div>

        {canGovernReleases ? (
          <div className="watch-release-governance">
            <label>
              <span>Approval or hold reason</span>
              <input
                value={governanceReasonByRelease[release.id] ?? ""}
                onChange={(event) => setGovernanceReasonByRelease((current) => ({ ...current, [release.id]: event.target.value }))}
                placeholder="Why this revision may ship, is rejected, or is held."
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div>
              <ContextButton type="button" size="sm" variant="outline" disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8} onClick={() => beginConfirm({ kind: "release-approve", id: release.id, expected: release.coordinate, reason: (governanceReasonByRelease[release.id] ?? "").trim() })}>Approve to ship</ContextButton>
              <ContextButton type="button" size="sm" variant="outline" disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8} onClick={() => beginConfirm({ kind: "release-reject", id: release.id, expected: release.coordinate, reason: (governanceReasonByRelease[release.id] ?? "").trim() })}>Reject</ContextButton>
              <ContextButton type="button" size="sm" variant="outline" disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8} onClick={() => beginConfirm({ kind: release.legalHold?.active ? "release-hold-release" : "release-hold", id: release.id, expected: release.coordinate, reason: (governanceReasonByRelease[release.id] ?? "").trim() })}>{release.legalHold?.active ? "Release hold" : "Legal hold"}</ContextButton>
            </div>
            <p>Separation of duties means another admin must release an active legal hold.</p>
          </div>
        ) : null}

      </section>}/></div>
    </section>
  );
}
