import {ReleaseDecisionPanel} from "./design/ReleaseDecisionPanel";
import { Button } from "@/components/ui/button";
import {HostedReleaseEvidence} from './HostedReleaseEvidence';
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { cn } from "@/lib/utils";
import { buildReleaseBriefModel, releaseFamily } from "@/watch/release-brief";
import type { ReleaseProofStep } from "@/watch/release-brief";
import type { ReleaseRevision } from "@/watch/types";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  GitCommitHorizontal,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type {Assessment} from '@/assurance/types';

function StepIcon({ tone }: { tone: ReleaseProofStep["tone"] }) {
  if (tone === "clean") return <CheckCircle2 className="size-4" aria-hidden />;
  if (tone === "blocked") return <AlertTriangle className="size-4" aria-hidden />;
  if (tone === "waiting") return <Clock3 className="size-4" aria-hidden />;
  return <CircleDashed className="size-4" aria-hidden />;
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
  const [observed,setObserved]=useState<{record:ReleaseRevision;assessment:Assessment|null}|null>(null);
  const onAssessment=useCallback((assessment:Assessment|null)=>setObserved({record:release,assessment}),[release]);
  const brief = useMemo(() => buildReleaseBriefModel({...release,readiness:observed?.record===release?observed.assessment??undefined:release.readiness}), [release,observed]);
  const [selectedStepKey, setSelectedStepKey] = useState<ReleaseProofStep["key"]>(
    brief.steps.find((step) => step.tone === "blocked")?.key ?? brief.steps[0].key,
  );
  const selectedStep = brief.steps.find((step) => step.key === selectedStepKey) ?? brief.steps[0];
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
    <section className="watch-release-brief" aria-labelledby="release-brief-title">
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
          <span className="watch-kicker">Release readiness brief</span>
          <h1 id="release-brief-title">{release.coordinate}</h1>
          <p>
            {release.channel} channel
            {release.sourceRevision ? ` · source revision ${release.sourceRevision}` : ""}
            {release.createdAt ? ` · ${new Date(release.createdAt).toLocaleString()}` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={downloadReceipt}
          disabled={downloadingReceiptId === release.receiptId}
        >
          <Download className="size-4" aria-hidden />
          {downloadingReceiptId === release.receiptId ? "Saving…" : "Receipt JSON"}
        </Button>
      </header>

      {receiptError ? <p className="watch-release-error">{receiptError}</p> : null}
      {deliveryError ? <p className="watch-release-error">{deliveryError}</p> : null}

      <div className="watch-release-decision-grid">
        <ReleaseDecisionPanel tone={brief.status} icon={brief.blocked ? <AlertTriangle /> : brief.ready ? <ShieldCheck /> : <Clock3 />} kicker="Release decision" title={brief.title} description={brief.detail} summary={<div className="watch-release-score" aria-label={brief.applicableChecks?`${brief.cleanChecks} of ${brief.applicableChecks} before-deployment evidence checks passed`:"No verified release assessment"}>
            <FileCheck2 className="size-7" aria-hidden />
            <strong>{brief.applicableChecks?`${brief.cleanChecks} of ${brief.applicableChecks}`:"—"}</strong>
            <span>{brief.applicableChecks?"recorded checks passed":"assessment unavailable"}</span>
          </div>}>
            <Button
              type="button"
              onClick={() =>
                document.getElementById(`release-proof-${selectedStep.key}`)?.focus()
              }
            >
              {brief.blocked ? "Review blocking evidence" : "Review release proof"}
            </Button>
        </ReleaseDecisionPanel>

        <aside className="watch-release-evidence-summary">
          <div className="watch-release-card-title">
            <span className="watch-kicker">Evidence</span>
            <span className={cn("watch-release-state", `is-${brief.status}`)}>{releaseStatusLabel(release)}</span>
          </div>
          <dl>
            <div><dt>Artifact digest</dt><dd>{release.artifactSha256.slice(0, 16)}…</dd></div>
            <div><dt>Media type</dt><dd>{release.mediaType ?? "Not recorded"}</dd></div>
            <div><dt>Sealed size</dt><dd>{release.artifactBytes != null ? formatSealedBytes(release.artifactBytes) : "Not recorded"}</dd></div>
            <div><dt>Receipt status</dt><dd>{releaseStatusLabel(release)}</dd></div>
          </dl>
        </aside>
      </div>

      <section className="watch-release-proof" aria-labelledby="release-proof-heading">
        <div className="watch-release-section-heading">
          <div><span className="watch-kicker">Release proof</span><h2 id="release-proof-heading">Evidence and observations</h2></div>
          <p>Select a check to inspect its real evidence.</p>
        </div>
        <div className="watch-release-proof-layout">
          <ol className="watch-release-proof-list">
            {brief.steps.map((step, index) => (
              <li key={step.key}>
                <button
                  id={`release-proof-${step.key}`}
                  type="button"
                  className={cn("watch-release-proof-row", selectedStep.key === step.key && "is-selected")}
                  onClick={() => setSelectedStepKey(step.key)}
                  aria-pressed={selectedStep.key === step.key}
                >
                  <span className="watch-release-proof-number">{index + 1}</span>
                  <span className={cn("watch-release-proof-icon", `is-${step.tone}`)}><StepIcon tone={step.tone} /></span>
                  <span className="watch-release-proof-copy"><strong>{step.label}</strong><small>{step.summary}</small></span>
                  <span className={cn("watch-release-proof-status", `is-${step.tone}`)}>{step.status}</span>
                </button>
              </li>
            ))}
          </ol>
          <article className={cn("watch-release-proof-detail", `is-${selectedStep.tone}`)} aria-live="polite">
            <span className="watch-kicker">{selectedStep.evidenceLabel}</span>
            <h3>{selectedStep.label}: {selectedStep.status}</h3>
            <p>{selectedStep.evidence}</p>
            {selectedStep.key === "artifact" ? (
              <div className="watch-release-proof-fact"><span>sha256</span><code>{release.artifactSha256}</code></div>
            ) : null}
            {selectedStep.key === "delivery" && (release.locations ?? []).length > 0 ? (
              <ul className="watch-release-deliveries">
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
              </ul>
            ) : null}
          </article>
        </div>
      </section>

      <section className="watch-release-operations" aria-labelledby="release-operations-heading">
        <div className="watch-release-section-heading">
          <div><span className="watch-kicker">Controls</span><h2 id="release-operations-heading">Evidence and governance</h2></div>
          <p>Actions remain scoped to this release.</p>
        </div>
        <div className="watch-release-operation-grid">
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

          {canPublishVerify ? (
            <div className="watch-release-operation-card">
              <ExternalLink className="size-5" aria-hidden />
              <h3>Public verification</h3>
              <p>{release.publicPage?.enabled ? `Published at ${release.publicPage.path}` : "Publish a read-only verification page for this receipt."}</p>
              <p>Solo may publish. Delivery matching is on demand, not scheduled CDN verification.</p>
              <ContextButton
                type="button"
                size="sm"
                variant="outline"
                onClick={() => beginConfirm({ kind: release.publicPage?.enabled ? "release-unpublish" : "release-publish", id: release.id, expected: release.coordinate })}
              >
                {release.publicPage?.enabled ? "Unpublish verification" : "Publish verification"}
              </ContextButton>
            </div>
          ) : null}
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
        {confirmForm(
          Boolean(
            confirming &&
              "id" in confirming &&
              confirming.id === release.id &&
              ["release-attest", "release-publish", "release-unpublish", "release-approve", "release-reject", "release-hold", "release-hold-release"].includes(confirming.kind),
          ),
        )}
      </section>

      <section className="watch-release-history" aria-labelledby="release-history-heading">
        <div className="watch-release-section-heading"><div><span className="watch-kicker">History</span><h2 id="release-history-heading">Recent revisions</h2></div></div>
        <div className="watch-release-history-table">
          {history.map((row) => (
            <button key={row.id} type="button" className={row.id === release.id ? "is-current" : undefined} onClick={() => navigate(watchHref(watchPath("releases"), search, { release: row.id }))}>
              <span>{row.coordinate}</span><span>{row.sourceRevision ?? row.artifactSha256.slice(0, 12)}</span><span>{releaseStatusLabel(row)}</span><span>{new Date(row.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </section>
      <HostedReleaseEvidence releaseId={release.id} receiptId={release.receiptId} search={search} onAssessment={onAssessment}/>
    </section>
  );
}
