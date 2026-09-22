import { WatchSkeleton } from "@/components/WatchDataState";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { WatchedOrigin } from "@/watch/types";
import { useState } from "react";

export function SourcesProductionScreens() {
  const workspaceId=new URLSearchParams(useWatchScreenContext().search).get('workspace');
  const { Button, activeInstallId, beginConfirm, checkingMapId, checkingOriginId, confirmBusy, confirmForm, confirming, ended, installAdmin, installations, loadJson, locked, mapDestinations, mapError, mapHost, mapKind, mapOrg, mapProject, mapToken, originError, originUrl, origins, previewing, refreshSignedIn, route, savingMap, scopedApi, selectedInstallId, setCheckingMapId, setCheckingOriginId, setMapError, setMapHost, setMapKind, setMapOrg, setMapProject, setMapToken, setOriginError, setOriginUrl, setSavingMap, setWatchingOrigin, sourceSectionState, user, watchingOrigin } = useWatchScreenContext();
  const [verifyingOriginId, setVerifyingOriginId] = useState<number | null>(null);
  const [deployTokenOriginId, setDeployTokenOriginId] = useState<number | null>(null);
  const [deployTokens, setDeployTokens] = useState<Record<number, {
    token: string;
    endpoint: string;
  }>>({});

  async function waitForWebsiteScan(originId: number, previousCheckedAt: string | null) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      try {
        const body = await loadJson<{
          origins: Array<{
            id: number;
            last_checked_at: string | null;
            last_scan_status: string | null;
          }>;
        }>(scopedApi("/api/origins", activeInstallId));
        const current = body.origins.find((origin) => origin.id === originId);
        if (
          current?.last_checked_at &&
          current.last_checked_at !== previousCheckedAt &&
          current.last_scan_status
        ) {
          await refreshSignedIn(selectedInstallId);
          return;
        }
      } catch {
        // A transient status read must not cancel the durable scan job.
      }
    }
    await refreshSignedIn(selectedInstallId);
    setOriginError("The website scan is still running. You can leave this page; its result will appear here.");
  }

  async function generateVerification(originId: number) {
    setVerifyingOriginId(originId);
    setOriginError(null);
    try {
      await loadJson(`/api/origins/${originId}/verification`, { method: "POST" });
      await refreshSignedIn(selectedInstallId);
    } catch (error) {
      setOriginError(error instanceof Error ? error.message : "Could not create verification.");
    } finally {
      setVerifyingOriginId(null);
    }
  }

  async function verifyOrigin(origin: WatchedOrigin, method: "dns" | "http") {
    setVerifyingOriginId(origin.id);
    setOriginError(null);
    try {
      const body = await loadJson<{ queued: boolean; detail: string }>(
        `/api/origins/${origin.id}/verify`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ method }),
        },
      );
      await refreshSignedIn(selectedInstallId);
      if (body.queued) await waitForWebsiteScan(origin.id, origin.last_checked_at);
    } catch (error) {
      setOriginError(error instanceof Error ? error.message : "Could not verify this domain.");
    } finally {
      setVerifyingOriginId(null);
    }
  }

  async function createDeployToken(originId: number) {
    setDeployTokenOriginId(originId);
    setOriginError(null);
    try {
      const body = await loadJson<{ token: string; endpoint: string }>(
        `/api/origins/${originId}/deploy-token`,
        { method: "POST" },
      );
      setDeployTokens((current) => ({ ...current, [originId]: body }));
      await refreshSignedIn(selectedInstallId);
    } catch (error) {
      setOriginError(error instanceof Error ? error.message : "Could not create deployment trigger.");
    } finally {
      setDeployTokenOriginId(null);
    }
  }

  return (
    <>
      {route.view === "sources" &&
                route.sourceConfigure === "website" &&
                (!route.sourceFilter || route.sourceFilter === 'all' || route.sourceFilter === 'website') &&
                (previewing || sourceSectionState.status === "ready") && (
              <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
                <section id="watch-source-web" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <h2 className="text-sm font-semibold text-snow">Production web</h2>
                <p className="mt-2 text-sm text-mute">
                  What customers can publicly download from your deployed website.
                </p>
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  We fetch the HTTPS page you name, then same-origin JavaScript, CSS, maps, and a bounded
                  probe of exposed files. Embedded source maps are reconstructed in memory so credential,
                  private-key, AI-context, and internal-route findings identify the original source path.
                  Local, private, and metadata hosts are blocked. JavaScript is not executed. Source,
                  maps, and matched credential values are deleted after the scan.
                </p>
                <p className="mt-3 max-w-xl text-xs leading-relaxed text-dim">
                  Add the public site root, such as <code className="text-mute">https://app.example.com</code>.
                  Paths and query strings are normalized to that root.
                </p>
                {previewing ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Preview cannot watch a website. No invented incident.
                  </p>
                ) : ended ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Subscribe to unpack production websites on our servers.
                  </p>
                ) : null}
                {!previewing && origins.status === "loading" && <WatchSkeleton variant="list" className="mt-4" />}
                {!previewing && origins.status === "error" && (
                  <p className="mt-6 text-sm text-danger">{origins.message}</p>
                )}
                {!workspaceId && !previewing && user && installations.length > 0 && (
                  <form
                    className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || watchingOrigin) return;
                      setOriginError(null);
                      setWatchingOrigin(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/origins", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              url: originUrl,
                              installationId: activeInstallId,
                            }),
                          });
                          const body = (await response.json()) as {
                            error?: string;
                            queued?: boolean;
                            origin?: { id: number; last_checked_at: string | null };
                          };
                          if (!response.ok) throw new Error(body.error ?? "Could not watch website.");
                          setOriginUrl("");
                          await refreshSignedIn(selectedInstallId);
                          if (body.queued && body.origin) {
                            await waitForWebsiteScan(body.origin.id, body.origin.last_checked_at);
                          }
                        } catch (error) {
                          setOriginError(error instanceof Error ? error.message : "Could not watch website.");
                        } finally {
                          setWatchingOrigin(false);
                        }
                      })();
                    }}
                  >
                    <label className="min-w-0 flex-1">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">HTTPS origin</span>
                      <input
                        value={originUrl}
                        onChange={(event) => setOriginUrl(event.target.value)}
                        placeholder="https://app.example.com/"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <Button type="submit" disabled={locked || watchingOrigin || !originUrl.trim()}>
                      {watchingOrigin ? "Adding website…" : "Add website"}
                    </Button>
                  </form>
                )}
                {originError && <p className="mt-4 text-sm text-danger">{originError}</p>}
                {!previewing && origins.status === "ready" && origins.data.origins.length > 0 && (
                  <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {origins.data.origins.map((row) => (
                      <li key={row.id} className="py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-snow">{row.origin_url}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
                              {row.verification && !row.verification.verifiedAt
                                ? "verification required"
                                : row.last_scan_status ?? "waiting to scan"}
                              {row.last_checked_at
                                ? ` · ${new Date(row.last_checked_at).toLocaleString()}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                locked ||
                                Boolean(row.verification && !row.verification.verifiedAt) ||
                                checkingOriginId === row.id
                              }
                              onClick={() => {
                                setCheckingOriginId(row.id);
                                setOriginError(null);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/origins/${row.id}/check`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as {
                                      error?: string;
                                      queued?: boolean;
                                    };
                                    if (!response.ok) throw new Error(body.error ?? "Could not check website.");
                                    if (!body.queued) {
                                      throw new Error("The website scan could not be queued. Try again.");
                                    }
                                    await waitForWebsiteScan(row.id, row.last_checked_at);
                                  } catch (error) {
                                    setOriginError(
                                      error instanceof Error ? error.message : "Could not check website.",
                                    );
                                  } finally {
                                    setCheckingOriginId(null);
                                  }
                                })();
                              }}
                            >
                              {checkingOriginId === row.id ? "Scanning website…" : "Scan website now"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={previewing || locked || confirmBusy}
                              onClick={() =>
                                beginConfirm({
                                  kind: "origin",
                                  id: row.id,
                                  expected: row.origin_url,
                                })
                              }
                            >
                              Stop
                            </Button>
                          </div>
                        </div>
                        {!row.verification ? (
                          <div className="mt-4 rounded-lg border border-white/8 bg-inset p-4">
                            <p className="text-sm text-snow">Prove you control this domain</p>
                            <p className="mt-1 text-xs leading-relaxed text-mute">
                              Verification prevents NoSpoilers from being used to inspect someone else’s website.
                            </p>
                            {installAdmin ? (
                              <Button
                                type="button"
                                size="sm"
                                className="mt-3"
                                disabled={verifyingOriginId === row.id}
                                onClick={() => void generateVerification(row.id)}
                              >
                                Create verification
                              </Button>
                            ) : null}
                          </div>
                        ) : !row.verification.verifiedAt ? (
                          <div className="mt-4 rounded-lg border border-white/8 bg-inset p-4">
                            <p className="text-sm text-snow">Choose one verification method</p>
                            <div className="mt-3 grid gap-3">
                              <div className="rounded-md border border-white/8 bg-panel p-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-dim">DNS TXT</p>
                                <p className="mt-2 break-all font-mono text-xs text-snow">
                                  {row.verification.dnsName}
                                </p>
                                <p className="mt-1 break-all font-mono text-xs text-mute">
                                  {row.verification.dnsValue}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="mt-3"
                                  disabled={!installAdmin || verifyingOriginId === row.id}
                                  onClick={() => void verifyOrigin(row, "dns")}
                                >
                                  Verify DNS
                                </Button>
                              </div>
                              <div className="rounded-md border border-white/8 bg-panel p-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-dim">HTTPS file</p>
                                <p className="mt-2 break-all font-mono text-xs text-snow">
                                  {row.verification.httpUrl}
                                </p>
                                <p className="mt-1 break-all font-mono text-xs text-mute">
                                  {row.verification.httpBody}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="mt-3"
                                  disabled={!installAdmin || verifyingOriginId === row.id}
                                  onClick={() => void verifyOrigin(row, "http")}
                                >
                                  Verify HTTPS file
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-lg border border-white/8 bg-inset p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-snow">
                                  Domain verified by {row.verification.method?.toUpperCase()}
                                </p>
                                <p className="mt-1 text-xs text-dim">
                                  {new Date(row.verification.verifiedAt).toLocaleString()}
                                  {row.deployTokenPrefix ? ` · trigger ${row.deployTokenPrefix}…` : ""}
                                </p>
                              </div>
                              {installAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={deployTokenOriginId === row.id}
                                  onClick={() => void createDeployToken(row.id)}
                                >
                                  {row.deployTokenPrefix ? "Rotate deploy token" : "Create deploy trigger"}
                                </Button>
                              ) : null}
                            </div>
                            {deployTokens[row.id] ? (
                              <div className="mt-3 rounded-md border border-white/8 bg-panel p-3">
                                <p className="text-xs text-mute">
                                  Shown once. Store this token as a secret in your existing deployment pipeline.
                                </p>
                                <code className="mt-2 block overflow-x-auto whitespace-pre-wrap break-all text-xs text-snow">
                                  {`curl -X POST ${deployTokens[row.id]?.endpoint} \\\n  -H "Authorization: Bearer ${deployTokens[row.id]?.token}" \\\n  -H "content-type: application/json" \\\n  -d '{"provider":"generic","deploymentId":"YOUR_DEPLOYMENT_ID"}'`}
                                </code>
                              </div>
                            ) : null}
                          </div>
                        )}
                        {confirmForm(confirming?.kind === "origin" && confirming.id === row.id)}
                      </li>
                    ))}
                  </ul>
                )}
                </section>
              </section>
              )}
      {route.view === "sources" &&
                route.sourceConfigure === "map" &&
                (!route.sourceFilter || route.sourceFilter === 'all' || route.sourceFilter === 'map') &&
                (previewing || sourceSectionState.status === "ready") && (
              <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
                <section id="watch-source-map" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <h2 className="text-sm font-semibold text-snow">Private map custody</h2>
                <p className="mt-2 text-sm text-mute">Confirm maps are held by your error tracker, not served publicly.</p>
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  This custody check asks whether Sentry has the debug ID or Bugsnag has the release
                  version; it does not download private map source. Production Web separately inspects a
                  map only when your public website serves it. Tokens are encrypted and never returned.
                  Bugsnag matches a release version; it cannot look up a debug ID.
                </p>
                {previewing ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Preview cannot connect map custody. No invented incident.
                  </p>
                ) : ended ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Subscribe to keep checking private map uploads.
                  </p>
                ) : null}
                {!previewing && user && installations.length > 0 && installAdmin && (
                  <form
                    className="mt-6 flex max-w-xl flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || savingMap) return;
                      setMapError(null);
                      setSavingMap(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/map-destinations", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              installationId: activeInstallId,
                              kind: mapKind,
                              host: mapHost,
                              org: mapOrg,
                              project: mapProject,
                              token: mapToken,
                            }),
                          });
                          const body = (await response.json()) as { error?: string };
                          if (!response.ok) throw new Error(body.error ?? "Could not save map custody.");
                          setMapToken("");
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setMapError(error instanceof Error ? error.message : "Could not save map custody.");
                        } finally {
                          setSavingMap(false);
                        }
                      })();
                    }}
                  >
                    <div>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Destination</span>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={mapKind === "sentry" ? "default" : "outline"}
                          disabled={locked}
                          onClick={() => setMapKind("sentry")}
                        >
                          Sentry
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={mapKind === "bugsnag" ? "default" : "outline"}
                          disabled={locked}
                          onClick={() => setMapKind("bugsnag")}
                        >
                          Bugsnag
                        </Button>
                      </div>
                    </div>
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Host (optional)</span>
                      <input
                        value={mapHost}
                        onChange={(event) => setMapHost(event.target.value)}
                        placeholder={mapKind === "sentry" ? "sentry.io" : "api.bugsnag.com"}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    {mapKind === "sentry" ? (
                      <label>
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">Organization slug</span>
                        <input
                          value={mapOrg}
                          onChange={(event) => setMapOrg(event.target.value)}
                          placeholder="acme"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={locked}
                          className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                        />
                      </label>
                    ) : null}
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
                        {mapKind === "sentry" ? "Project slug" : "Project id"}
                      </span>
                      <input
                        value={mapProject}
                        onChange={(event) => setMapProject(event.target.value)}
                        placeholder={mapKind === "sentry" ? "web" : "project-id"}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Auth token</span>
                      <input
                        type="password"
                        value={mapToken}
                        onChange={(event) => setMapToken(event.target.value)}
                        placeholder="never shown again"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <Button type="submit" disabled={locked || savingMap || !mapProject.trim() || !mapToken.trim()}>
                      {savingMap ? "Saving…" : "Save map custody"}
                    </Button>
                  </form>
                )}
                {mapError ? <p className="mt-4 text-sm text-danger">{mapError}</p> : null}
                {!previewing && mapDestinations.length > 0 && (
                  <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {mapDestinations.map((row) => (
                      <li key={row.id} className="py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs text-snow">
                              {row.kind} · {row.host}
                              {row.orgSlug ? ` · ${row.orgSlug}/${row.projectSlug}` : ` · ${row.projectSlug}`}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
                              {row.lastStatus ?? "queued"}
                              {row.lastCheckedAt ? ` · ${new Date(row.lastCheckedAt).toLocaleString()}` : ""}
                            </p>
                            {row.lastError ? <p className="mt-1 text-xs text-mute">{row.lastError}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={locked || checkingMapId === row.id}
                              onClick={() => {
                                setCheckingMapId(row.id);
                                setMapError(null);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/map-destinations/${row.id}/check`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as { error?: string };
                                    if (!response.ok) throw new Error(body.error ?? "Could not check map custody.");
                                    await refreshSignedIn(selectedInstallId);
                                  } catch (error) {
                                    setMapError(
                                      error instanceof Error ? error.message : "Could not check map custody.",
                                    );
                                  } finally {
                                    setCheckingMapId(null);
                                  }
                                })();
                              }}
                            >
                              {checkingMapId === row.id ? "Checking…" : "Check now"}
                            </Button>
                            {installAdmin ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={previewing || locked || confirmBusy}
                                onClick={() =>
                                  beginConfirm({
                                    kind: "map-destination",
                                    id: row.id,
                                    expected: row.host,
                                  })
                                }
                              >
                                Disconnect
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {confirmForm(confirming?.kind === "map-destination" && confirming.id === row.id)}
                      </li>
                    ))}
                  </ul>
                )}
                </section>
              </section>
              )}
    </>
  );
}
