import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";

export function ReleasesScreen() {
  const { Button, WatchSectionError, WatchSkeleton, activeInstallId, attachingReleaseId, attestationError, beginConfirm, canExportReleases, canGovernReleases, canPublishVerify, cn, confirmForm, confirming, datasetState, deliveryError, deliveryUrlByRelease, deskCoverage, downloadingReceiptId, formatSealedBytes, governanceReasonByRelease, installAdmin, ledgerExportError, loadJson, locked, navigate, previewing, receiptError, receiptStatusMark, refreshSignedIn, releases, retryDeskSection, route, scopedApi, search, selectedInstallId, selectedRelease, setAttachingReleaseId, setAttestationError, setDeliveryError, setDeliveryUrlByRelease, setDownloadingReceiptId, setGovernanceReasonByRelease, setLedgerExportError, setReceiptError, setVerifyingLocationId, verifyingLocationId, watchHref, watchPath } = useWatchScreenContext();
  return (
    <>
      {route.view === "releases" && (
              <section className="mt-4">
                <h1 className="font-display text-3xl tracking-tight text-snow">Releases and receipts</h1>
                <p className="mt-2 text-sm text-mute">Sealed artifact revisions, policy results, and delivery evidence.</p>
                <div className="watch-guidance mt-4 grid max-w-4xl gap-3 sm:grid-cols-2">
                  {[
                    {
                      title: "Receipt",
                      detail:
                        "The signed receipt identifies the exact bytes and policy result. Failed-policy and inconclusive are not clean.",
                    },
                    {
                      title: "Delivery match",
                      detail:
                        "Verify that npm, GitHub, or a customer URL still serves the same SHA-256. Downloaded bytes are discarded.",
                    },
                    {
                      title: "Approval and hold",
                      detail:
                        "Team admins approve or reject passing revisions. Failed-policy, inconclusive, and digest-changed revisions cannot be approved. A legal hold remains until another admin must release it.",
                    },
                    {
                      title: "Attestation",
                      detail:
                        "GitHub/npm documents and builder IDs are recorded as evidence. Sigstore verification is not claimed yet.",
                    },
                  ].map((item) => (
                    <article key={item.title} className="rounded-lg border border-white/8 bg-panel p-4">
                      <h2 className="text-xs uppercase tracking-[0.16em] text-snow">{item.title}</h2>
                      <p className="mt-2 text-xs leading-relaxed text-mute">{item.detail}</p>
                    </article>
                  ))}
                </div>
                <p className="watch-guidance mt-3 max-w-4xl text-xs leading-relaxed text-dim">
                  Failed-policy and inconclusive receipts are never clean. Failed-policy, inconclusive,
                  and digest-changed revisions cannot be approved. A legal hold remains until
                  another admin must release it. Solo may publish a passing verification page; delivery matching is
                  on demand and is not scheduled CDN verification.
                </p>
                {previewing ? (
                  <p className="mt-4 text-sm leading-relaxed text-mute">
                    Preview cannot approve or export releases. No invented incident.
                  </p>
                ) : deskCoverage?.plan === "solo" ? (
                  <p className="mt-4 text-sm leading-relaxed text-mute">
                    Subscribe to Team to approve shipping releases, place legal hold, export the ledger,
                    refresh GitHub or npm attestations, and set a signing policy.
                  </p>
                ) : null}
                {canExportReleases ? (
                  <div className="mt-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLedgerExportError(null);
                        void (async () => {
                          try {
                            const body = await loadJson<{ exportedAt: string }>(
                              scopedApi("/api/releases/export", activeInstallId),
                            );
                            const blob = new Blob([JSON.stringify(body, null, 2)], {
                              type: "application/json",
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `nospoilers-releases-${body.exportedAt.slice(0, 10)}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            setLedgerExportError(
                              error instanceof Error ? error.message : "Could not export the release ledger.",
                            );
                          }
                        })();
                      }}
                    >
                      Export ledger
                    </Button>
                    {ledgerExportError ? <p className="mt-2 text-sm text-danger">{ledgerExportError}</p> : null}
                  </div>
                ) : null}
                {receiptError ? <p className="mt-3 text-sm text-danger">{receiptError}</p> : null}
                {deliveryError ? <p className="mt-3 text-sm text-danger">{deliveryError}</p> : null}
                {attestationError ? <p className="mt-3 text-sm text-danger">{attestationError}</p> : null}
                {datasetState.releases.status === "loading" ? (
                  <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
                ) : datasetState.releases.status === "error" ? (
                  <WatchSectionError
                    className="mt-6 max-w-2xl"
                    message={datasetState.releases.message}
                    onRetry={() => void retryDeskSection("releases")}
                  />
                ) : previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
                ) : releases.length === 0 ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
                ) : (
                  <div className="mt-6 grid overflow-hidden rounded-lg border border-white/8 bg-panel lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <ol className="max-h-[52rem] divide-y divide-white/5 overflow-auto border-b border-white/8 lg:border-b-0 lg:border-r">
                      {releases.map((release) => (
                        <li key={`release-summary-${release.id}`}>
                          <button
                            type="button"
                            className={cn(
                              "w-full px-4 py-4 text-left hover:bg-white/5",
                              selectedRelease?.id === release.id && "bg-white/5",
                            )}
                            onClick={() =>
                              navigate(
                                watchHref(watchPath("releases"), search, { release: release.id }),
                              )
                            }
                          >
                            <strong className="block truncate font-mono text-sm text-snow">
                              {release.coordinate}
                            </strong>
                            <span className="mt-2 block text-xs text-dim">
                              {release.channel} · {release.artifactSha256.slice(0, 12)}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block text-xs uppercase tracking-[0.16em]",
                                release.mismatch ||
                                  release.receiptStatus === "failed-policy" ||
                                  release.receiptStatus === "inconclusive"
                                  ? "text-danger"
                                  : "text-dim",
                              )}
                            >
                              {release.mismatch
                                ? "digest changed"
                                : release.receiptStatus?.replace("-", " ") ?? "sealed"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <ul className="min-w-0 px-5">
                    {selectedRelease ? [selectedRelease].map((release) => (
                      <li key={release.id} className="py-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-sm text-snow">{release.coordinate}</p>
                            <p className="mt-1 text-xs text-dim">
                              {release.channel}
                              {release.sourceRevision ? ` · ${release.sourceRevision}` : ""}
                              {` · ${release.artifactSha256.slice(0, 12)}`}
                              {release.artifactBytes != null ? ` · ${formatSealedBytes(release.artifactBytes)}` : ""}
                              {release.mediaType ? ` · ${release.mediaType}` : ""}
                              {release.createdAt ? ` · ${release.createdAt.slice(0, 10)}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {release.mismatch ? (
                              <span className="text-xs uppercase tracking-[0.16em] text-danger">
                                digest changed
                              </span>
                            ) : null}
                            {receiptStatusMark(release.receiptStatus)}
                            {release.approval?.decision === "approved" ? (
                              <span className="text-xs uppercase tracking-[0.16em] text-dim">
                                approved to ship
                              </span>
                            ) : null}
                            {release.approval?.decision === "rejected" ? (
                              <span className="text-xs uppercase tracking-[0.16em] text-danger">
                                rejected
                              </span>
                            ) : null}
                            {release.legalHold?.active ? (
                              <span className="text-xs uppercase tracking-[0.16em] text-snow">
                                legal hold
                              </span>
                            ) : null}
                            {!release.mismatch && !release.receiptStatus ? (
                              <span className="text-xs uppercase tracking-[0.16em] text-dim">sealed</span>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={downloadingReceiptId === release.receiptId}
                              onClick={() => {
                                setReceiptError(null);
                                setDownloadingReceiptId(release.receiptId);
                                void (async () => {
                                  try {
                                    const body = await loadJson<{ receipt: unknown; id: number }>(
                                      `/api/receipts/${release.receiptId}`,
                                    );
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
                                    setReceiptError(
                                      error instanceof Error ? error.message : "Could not download that receipt.",
                                    );
                                  } finally {
                                    setDownloadingReceiptId(null);
                                  }
                                })();
                              }}
                            >
                              {downloadingReceiptId === release.receiptId ? "Saving…" : "Receipt JSON"}
                            </Button>
                          </div>
                        </div>
                        {(release.locations ?? []).length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {(release.locations ?? []).map((location) => (
                              <li key={location.id} className="flex flex-wrap items-center justify-between gap-3">
                                <p className="min-w-0 font-mono text-xs text-mute">
                                  {location.url}
                                  {location.lastStatus ? ` · ${location.lastStatus.replace("_", " ")}` : ""}
                                  {location.lastSha256 ? ` · ${location.lastSha256.slice(0, 12)}` : ""}
                                  {location.lastRedirectHosts
                                    ? ` · ${location.lastRedirectHosts.split(",").join(" to ")}`
                                    : ""}
                                  {location.lastRegion ? ` · ${location.lastRegion}` : ""}
                                  {location.lastCacheState ? ` · ${location.lastCacheState}` : ""}
                                </p>
                                {!previewing && installAdmin ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={locked || verifyingLocationId === location.id}
                                    onClick={() => {
                                      setDeliveryError(null);
                                      setVerifyingLocationId(location.id);
                                      void (async () => {
                                        try {
                                          const response = await fetch(
                                            `/api/releases/${release.id}/locations/${location.id}/verify`,
                                            {
                                              method: "POST",
                                              credentials: "include",
                                              headers: { "content-type": "application/json" },
                                              body: JSON.stringify({ installationId: activeInstallId }),
                                            },
                                          );
                                          const body = (await response.json()) as { error?: string };
                                          if (!response.ok) {
                                            throw new Error(body.error ?? "Could not verify that URL.");
                                          }
                                          await refreshSignedIn(selectedInstallId);
                                        } catch (error) {
                                          setDeliveryError(
                                            error instanceof Error ? error.message : "Could not verify that URL.",
                                          );
                                        } finally {
                                          setVerifyingLocationId(null);
                                        }
                                      })();
                                    }}
                                  >
                                    {verifyingLocationId === location.id ? "Verifying…" : "Verify now"}
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {!previewing && installAdmin ? (
                          <form
                            className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (locked || attachingReleaseId === release.id) return;
                              setDeliveryError(null);
                              setAttachingReleaseId(release.id);
                              void (async () => {
                                try {
                                  const response = await fetch(`/api/releases/${release.id}/locations`, {
                                    method: "POST",
                                    credentials: "include",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({
                                      url: deliveryUrlByRelease[release.id] ?? "",
                                      installationId: activeInstallId,
                                    }),
                                  });
                                  const body = (await response.json()) as { error?: string };
                                  if (!response.ok) {
                                    throw new Error(body.error ?? "Could not attach that URL.");
                                  }
                                  setDeliveryUrlByRelease((current) => ({ ...current, [release.id]: "" }));
                                  await refreshSignedIn(selectedInstallId);
                                } catch (error) {
                                  setDeliveryError(
                                    error instanceof Error ? error.message : "Could not attach that URL.",
                                  );
                                } finally {
                                  setAttachingReleaseId(null);
                                }
                              })();
                            }}
                          >
                            <label className="min-w-0 flex-1">
                              <span className="text-xs uppercase tracking-[0.16em] text-dim">
                                Delivery URL
                              </span>
                              <input
                                value={deliveryUrlByRelease[release.id] ?? ""}
                                onChange={(event) =>
                                  setDeliveryUrlByRelease((current) => ({
                                    ...current,
                                    [release.id]: event.target.value,
                                  }))
                                }
                                placeholder="https://cdn.example.com/app.tgz"
                                autoComplete="off"
                                spellCheck={false}
                                disabled={locked}
                                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                              />
                            </label>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={locked || attachingReleaseId === release.id}
                            >
                              {attachingReleaseId === release.id ? "Attaching…" : "Attach URL"}
                            </Button>
                          </form>
                        ) : null}
                        {release.approval ? (
                          <p className="mt-2 text-xs text-mute">
                            {release.approval.decision === "approved" ? "Approved" : "Rejected"} by{" "}
                            {release.approval.actorLogin}
                            {release.approval.reason ? ` · ${release.approval.reason}` : ""}
                          </p>
                        ) : null}
                        {release.legalHold?.active ? (
                          <p className="mt-1 text-xs text-mute">
                            Legal hold by {release.legalHold.actorLogin}
                            {release.legalHold.reason ? ` · ${release.legalHold.reason}` : ""}
                          </p>
                        ) : null}
                        {release.publicPage?.enabled ? (
                          <p className="mt-2 text-xs text-mute">
                            Public verification{" "}
                            <a href={release.publicPage.path} className="text-snow underline-offset-2 hover:underline">
                              {release.publicPage.path}
                            </a>
                          </p>
                        ) : null}
                        {(release.attestations ?? []).length > 0 ? (
                          <ul className="mt-3 space-y-1">
                            {(release.attestations ?? []).map((row) => (
                              <li key={`${row.source}-${row.createdAt}`} className="font-mono text-xs text-mute">
                                {row.source} attestation · {row.status.replace("_", " ")}
                                {row.predicateType ? ` · ${row.predicateType}` : ""}
                                {row.builderId ? ` · ${row.builderId}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {canGovernReleases ? (
                          <div className="mt-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAttestationError(null);
                                beginConfirm({
                                  kind: "release-attest",
                                  id: release.id,
                                  expected: release.coordinate,
                                });
                              }}
                            >
                              Refresh attestations
                            </Button>
                          </div>
                        ) : null}
                        {canPublishVerify ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {release.publicPage?.enabled ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  beginConfirm({
                                    kind: "release-unpublish",
                                    id: release.id,
                                    expected: release.coordinate,
                                  })
                                }
                              >
                                Unpublish verification
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  beginConfirm({
                                    kind: "release-publish",
                                    id: release.id,
                                    expected: release.coordinate,
                                  })
                                }
                              >
                                Publish verification
                              </Button>
                            )}
                            {confirmForm(
                              (confirming?.kind === "release-publish" ||
                                confirming?.kind === "release-unpublish") &&
                                confirming.id === release.id,
                            )}
                          </div>
                        ) : null}
                        {canGovernReleases ? (
                          <div className="mt-3 max-w-xl">
                            <label className="block">
                              <span className="text-xs uppercase tracking-[0.16em] text-dim">
                                Approval or hold reason
                              </span>
                              <input
                                value={governanceReasonByRelease[release.id] ?? ""}
                                onChange={(event) =>
                                  setGovernanceReasonByRelease((current) => ({
                                    ...current,
                                    [release.id]: event.target.value,
                                  }))
                                }
                                placeholder="Why this revision may ship, is rejected, or is held."
                                autoComplete="off"
                                spellCheck={false}
                                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                              />
                            </label>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                                onClick={() =>
                                  beginConfirm({
                                    kind: "release-approve",
                                    id: release.id,
                                    expected: release.coordinate,
                                    reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                                  })
                                }
                              >
                                Approve to ship
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                                onClick={() =>
                                  beginConfirm({
                                    kind: "release-reject",
                                    id: release.id,
                                    expected: release.coordinate,
                                    reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                                  })
                                }
                              >
                                Reject
                              </Button>
                              {release.legalHold?.active ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "release-hold-release",
                                      id: release.id,
                                      expected: release.coordinate,
                                      reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                                    })
                                  }
                                >
                                  Release hold
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "release-hold",
                                      id: release.id,
                                      expected: release.coordinate,
                                      reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                                    })
                                  }
                                >
                                  Legal hold
                                </Button>
                              )}
                            </div>
                            {confirmForm(
                              (confirming?.kind === "release-approve" ||
                                confirming?.kind === "release-reject" ||
                                confirming?.kind === "release-hold" ||
                                confirming?.kind === "release-hold-release") &&
                                confirming.id === release.id,
                            )}
                          </div>
                        ) : null}
                      </li>
                    )) : null}
                    </ul>
                  </div>
                )}
              </section>
              )}
    </>
  );
}
