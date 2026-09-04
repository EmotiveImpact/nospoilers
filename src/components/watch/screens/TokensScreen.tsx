import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { useRef } from "react";

export function TokensScreen() {
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const { Button, activeInstallId, beginConfirm, confirmBusy, confirmForm, confirming, ended, githubRunnersReachable, hostedOrigin, installAdmin, installations, locked, mintingScanToken, previewing, refreshSignedIn, revealedScanToken, route, scanTokenError, scanTokenName, scanTokens, selectedInstallId, setMintingScanToken, setRevealedScanToken, setScanTokenError, setScanTokenName, user } = useWatchScreenContext();
  const canMint = !previewing && Boolean(user && installations.length > 0 && installAdmin);
  return (
    <>
      {route.view === "tokens" && (
              <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
                <WatchPageHeader
                  title="Scan API tokens"
                  lede="Credentials for packed-artifact CI scans."
                  action={
                    canMint ? (
                      <Button type="button" size="sm" onClick={() => tokenNameRef.current?.focus()}>
                        Mint token
                      </Button>
                    ) : undefined
                  }
                />
                <div className="watch-card mt-[18px]">
                  <div className="watch-kv">
                    <span>Tokens</span>
                    <span className={(!previewing && scanTokens.length) ? "text-snow" : "text-dim"}>{previewing ? 0 : scanTokens.length}</span>
                  </div>
                  <div className="watch-kv">
                    <span>Shown once</span>
                    <span className="text-dim">hashed after</span>
                  </div>
                </div>
                <p className="watch-guidance mt-3 max-w-xl text-[13px] leading-relaxed text-mute">
                  Mint a token to <code className="text-snow">POST</code> a packed artifact to{" "}
                  <code className="text-snow">/api/v1/scan</code>. We hash the secret, show it once, and
                  delete the bytes after the scan. Generated Setup CI needs this token plus repository
                  variable <code className="text-snow">NOSPOILERS_API_URL</code>.
                </p>
                {!previewing && hostedOrigin ? (
                  <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-dim">
                      Repository variable NOSPOILERS_API_URL
                    </p>
                    <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
                      {hostedOrigin}
                    </pre>
                    <p className="mt-3 text-sm leading-relaxed text-mute">
                      {githubRunnersReachable
                        ? "GitHub-hosted runners can POST packed bytes here. If this origin changes, update the repository variable. Do not use localhost."
                        : "GitHub-hosted runners cannot reach this origin (loopback or not HTTPS). Set NOSPOILERS_API_URL to the HTTPS origin GitHub already uses for webhooks once that host is public. Do not grant Administration."}
                    </p>
                  </div>
                ) : null}
                {previewing ? (
                  <div className="watch-empty">No scan tokens yet.</div>
                ) : (
                  <>
                    {user && installations.length > 0 && installAdmin && (
                      <form
                        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (locked || mintingScanToken) return;
                          setScanTokenError(null);
                          setRevealedScanToken(null);
                          setMintingScanToken(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/scan-tokens", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  name: scanTokenName,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string; token?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not mint token.");
                              if (body.token) setRevealedScanToken(body.token);
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setScanTokenError(
                                error instanceof Error ? error.message : "Could not mint token.",
                              );
                            } finally {
                              setMintingScanToken(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">Name</span>
                          <input
                            ref={tokenNameRef}
                            id="scan-token-name"
                            value={scanTokenName}
                            onChange={(event) => setScanTokenName(event.target.value)}
                            placeholder="CI"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" disabled={locked || mintingScanToken}>
                          {mintingScanToken ? "Minting…" : "Mint token"}
                        </Button>
                      </form>
                    )}
                    {scanTokenError && <p className="mt-4 text-sm text-danger">{scanTokenError}</p>}
                    {revealedScanToken ? (
                      <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">
                          Copy now. We will not show this again.
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-dim">
                          Repository secret NOSPOILERS_API_TOKEN
                        </p>
                        <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
                          {revealedScanToken}
                        </pre>
                        {hostedOrigin ? (
                          <>
                            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-dim">
                              Repository variable NOSPOILERS_API_URL
                            </p>
                            <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
                              {hostedOrigin}
                            </pre>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {scanTokens.length === 0 ? (
                      <div className="watch-empty">No scan tokens yet.</div>
                    ) : (
                      <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {scanTokens.map((token) => (
                          <li key={token.id} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm text-snow">{token.name}</p>
                              <p className="mt-0.5 font-mono text-xs text-dim">{token.token_prefix}…</p>
                              <p className="mt-1 text-xs text-dim">
                                created {new Date(token.created_at).toLocaleDateString()}
                                {token.last_used_at
                                  ? ` · last used ${new Date(token.last_used_at).toLocaleString()}`
                                  : " · never used"}
                                {token.created_by_login ? ` · @${token.created_by_login}` : ""}
                              </p>
                            </div>
                            {installAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={locked || confirmBusy}
                              onClick={() =>
                                beginConfirm({
                                  kind: "token",
                                  id: token.id,
                                  expected: token.name,
                                })
                              }
                            >
                              Revoke
                            </Button>
                            ) : null}
                            </div>
                            {confirmForm(confirming?.kind === "token" && confirming.id === token.id)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
              )}
    </>
  );
}
