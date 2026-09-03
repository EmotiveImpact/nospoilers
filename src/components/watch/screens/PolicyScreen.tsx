import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";

export function PolicyScreen() {
  const { Button, SIGNING_POLICY_CLEAR_CONFIRM, SIGNING_POLICY_CONFIRM, activeInstallId, allowExpires, allowPath, allowReason, allowRule, baselineReason, beginConfirm, canManageSigningPolicy, confirmBusy, confirmForm, confirming, exceptions, installAdmin, locked, previewing, refreshSignedIn, route, savingAllow, selectedInstallId, setAllowExpires, setAllowPath, setAllowReason, setAllowRule, setBaselineReason, setPackageError, setSavingAllow, setSigningDraft, setSigningError, signingDraft, signingError, signingPolicy } = useWatchScreenContext();
  return (
    <>
      {route.view === "policy" && (
              <section className="mt-4">
                <h1 className="font-display text-3xl tracking-tight text-snow">Policy &amp; allowlist</h1>
                <p className="mt-2 text-sm text-mute">Shipping evidence, time-bound exceptions, and approved baselines.</p>
                <h2 className="mt-8 text-xs uppercase tracking-[0.22em] text-dim">Signing policy</h2>
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  Trial and Team can require a present GitHub or npm attestation document, or a builder
                  prefix, before a passing revision is approved to ship. Type signing-policy to save.
                  Type clear-signing-policy to remove it. Expired policies do not block. This is not
                  Sigstore verification and not a malware verdict.
                </p>
                {previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Preview cannot change a live signing policy. No invented incident.
                  </p>
                ) : signingPolicy.status === "ended" ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Subscribe to Team to set a signing policy.
                  </p>
                ) : signingPolicy.status === "solo" ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Subscribe to Team to set a signing policy.
                  </p>
                ) : signingPolicy.status === "error" ? (
                  <p className="mt-6 text-sm text-danger">{signingPolicy.message}</p>
                ) : signingPolicy.status === "loading" ? (
                  <p className="mt-6 text-sm text-dim">Loading…</p>
                ) : (
                  <div className="mt-6 max-w-xl space-y-3">
                    <label className="flex items-center gap-2 text-sm text-snow">
                      <input
                        type="checkbox"
                        checked={signingDraft.requireGithub}
                        disabled={!canManageSigningPolicy || confirmBusy}
                        onChange={(event) =>
                          setSigningDraft((current) => ({
                            ...current,
                            requireGithub: event.target.checked,
                          }))
                        }
                      />
                      Require a present GitHub attestation
                    </label>
                    <label className="flex items-center gap-2 text-sm text-snow">
                      <input
                        type="checkbox"
                        checked={signingDraft.requireNpm}
                        disabled={!canManageSigningPolicy || confirmBusy}
                        onChange={(event) =>
                          setSigningDraft((current) => ({
                            ...current,
                            requireNpm: event.target.checked,
                          }))
                        }
                      />
                      Require a present npm attestation
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
                        Builder prefix
                      </span>
                      <input
                        value={signingDraft.builderPrefix}
                        disabled={!canManageSigningPolicy || confirmBusy}
                        onChange={(event) =>
                          setSigningDraft((current) => ({
                            ...current,
                            builderPrefix: event.target.value,
                          }))
                        }
                        placeholder="https://github.com/actions"
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Expires</span>
                      <input
                        value={signingDraft.expiresAt}
                        disabled={!canManageSigningPolicy || confirmBusy}
                        onChange={(event) =>
                          setSigningDraft((current) => ({
                            ...current,
                            expiresAt: event.target.value,
                          }))
                        }
                        placeholder="2026-12-01T00:00:00.000Z"
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                      />
                    </label>
                    {signingError ? <p className="text-sm text-danger">{signingError}</p> : null}
                    {canManageSigningPolicy ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={confirmBusy}
                          onClick={() => {
                            setSigningError(null);
                            beginConfirm({
                              kind: "signing-policy-save",
                              expected: SIGNING_POLICY_CONFIRM,
                            });
                          }}
                        >
                          Save signing policy
                        </Button>
                        {signingPolicy.policy ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={confirmBusy}
                            onClick={() => {
                              setSigningError(null);
                              beginConfirm({
                                kind: "signing-policy-clear",
                                expected: SIGNING_POLICY_CLEAR_CONFIRM,
                              });
                            }}
                          >
                            Clear signing policy
                          </Button>
                        ) : null}
                        {confirmForm(
                          confirming?.kind === "signing-policy-save" ||
                            confirming?.kind === "signing-policy-clear",
                        )}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed text-mute">
                        An install admin has to change this policy.
                      </p>
                    )}
                  </div>
                )}
              </section>
              )}
      {route.view === "policy" && (
              <section className="mt-4">
                <h2 className="text-xs uppercase tracking-[0.22em] text-dim">Allowlist and baseline</h2>
                <p className="mt-2 text-sm text-mute">Time-bound exceptions and the approved comparison receipt.</p>
                <p className="watch-guidance mt-3 max-w-2xl text-sm leading-relaxed text-mute">
                  Exceptions are exact-rule, attributable, and they expire. They never suppress a different
                  rule. Approve a packed receipt as the shipping baseline; later diffs use that receipt
                  instead of whichever scan happened last.
                </p>
                {!previewing && installAdmin && (
                  <label className="mt-6 block max-w-xl">
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">Baseline reason</span>
                    <input
                      value={baselineReason}
                      onChange={(event) => setBaselineReason(event.target.value)}
                      disabled={locked}
                      className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                    />
                  </label>
                )}
                {!previewing && installAdmin && (
                  <form
                    className="mt-6 grid gap-4 md:grid-cols-[7rem_1fr_1fr_8rem_auto] md:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || savingAllow) return;
                      setPackageError(null);
                      setSavingAllow(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/exceptions", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              installationId: activeInstallId,
                              rule: allowRule,
                              path: allowPath,
                              reason: allowReason,
                              expires: allowExpires,
                            }),
                          });
                          const body = (await response.json()) as { error?: string };
                          if (!response.ok) throw new Error(body.error ?? "Could not save allowlist entry.");
                          setAllowRule("");
                          setAllowPath("");
                          setAllowReason("");
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setPackageError(
                            error instanceof Error ? error.message : "Could not save allowlist entry.",
                          );
                        } finally {
                          setSavingAllow(false);
                        }
                      })();
                    }}
                  >
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Rule</span>
                      <input
                        value={allowRule}
                        onChange={(event) => setAllowRule(event.target.value)}
                        placeholder="SRC-001"
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Path glob</span>
                      <input
                        value={allowPath}
                        onChange={(event) => setAllowPath(event.target.value)}
                        placeholder="**/*.d.ts"
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Reason</span>
                      <input
                        value={allowReason}
                        onChange={(event) => setAllowReason(event.target.value)}
                        placeholder="Published TypeScript types"
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Expires</span>
                      <input
                        type="date"
                        value={allowExpires}
                        onChange={(event) => setAllowExpires(event.target.value)}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none focus:border-white/40"
                      />
                    </label>
                    <Button type="submit" disabled={locked || savingAllow || !allowRule.trim() || !allowReason.trim()}>
                      {savingAllow ? "Saving…" : "Allow"}
                    </Button>
                  </form>
                )}
                {previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Sign in to manage allowlist entries on your installations. Preview does not invent
                    packages or exceptions.
                  </p>
                ) : exceptions.length === 0 ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">No active allowlist entries.</p>
                ) : (
                  <ul className="mt-6 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {exceptions.map((entry) => (
                      <li key={entry.id} className="py-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm text-snow">
                            {entry.rule}
                            {entry.pathPattern ? `  ${entry.pathPattern}` : "  *"}
                          </p>
                          <p className="mt-1 text-xs text-dim">
                            {entry.reason} · {entry.actorLogin} · expires{" "}
                            {entry.expiresAt.slice(0, 10)}
                            {entry.active ? "" : " · expired"}
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
                              kind: "exception",
                              id: entry.id,
                              expected: entry.rule,
                            })
                          }
                        >
                          Revoke
                        </Button>
                        ) : null}
                        </div>
                        {confirmForm(confirming?.kind === "exception" && confirming.id === entry.id)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              )}
    </>
  );
}
