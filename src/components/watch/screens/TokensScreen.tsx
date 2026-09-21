import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { useEffect,useRef } from "react";

export function TokensScreen() {
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const { Button, activeInstallId, beginConfirm, confirmBusy, confirmForm, confirming, ended, githubRunnersReachable, hostedOrigin, installAdmin, installations, locked, mintingScanToken, previewing, refreshSignedIn, revealedScanToken, route, scanTokenError, scanTokenName, scanTokens, selectedInstallId, setMintingScanToken, setRevealedScanToken, setScanTokenError, setScanTokenName, user } = useWatchScreenContext();
  const mintRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{mintRequest.current?.abort();mintRequest.current=null;setMintingScanToken(false);setRevealedScanToken(null);},[activeInstallId,route.view,setMintingScanToken,setRevealedScanToken]);
  const canMint = !previewing && Boolean(user && installations.length > 0 && installAdmin);
  return (
    <>
      {route.view === "tokens" && (
              <section className="mt-4 min-w-0 [overflow-wrap:anywhere]">
                <WatchPageHeader
                  title="Scan API tokens"
                  lede="Credentials for packed-artifact CI scans."
                  action={
                    canMint ? (
                      <Button type="button" size="sm" disabled={locked||mintingScanToken} onClick={() => tokenNameRef.current?.focus()}>
                        Mint token
                      </Button>
                    ) : undefined
                  }
                />
                {ended?<p className="mt-4 text-sm text-mute">Coverage has ended. Saved token details remain readable; creating and revoking credentials requires active coverage.</p>:null}
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
                          if (locked || mintingScanToken || mintRequest.current) return;
                          const controller=new AbortController();mintRequest.current=controller;
                          setScanTokenError(null);
                          setRevealedScanToken(null);
                          setMintingScanToken(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/scan-tokens", {
                                signal:controller.signal,
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  name: scanTokenName,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string; token?: string };
                              if(controller.signal.aborted)return;
                              if (!response.ok) throw new Error(body.error ?? "Could not mint token.");
                              if(typeof body.token!=="string"||!body.token.trim())throw new Error("The token secret was not received. Check the token list before trying again.");
                              if (body.token) setRevealedScanToken(body.token);
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              if(!controller.signal.aborted)setScanTokenError(
                                error instanceof Error ? error.message : "Could not mint token.",
                              );
                            } finally {
                              if(mintRequest.current===controller)mintRequest.current=null;
                              if(!controller.signal.aborted)setMintingScanToken(false);
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
                    {scanTokenError && <p role="alert" className="mt-4 text-sm text-danger">{scanTokenError}</p>}
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
                        <Button type="button" variant="outline" className="mt-4" onClick={()=>setRevealedScanToken(null)}>I’ve saved it</Button>
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
