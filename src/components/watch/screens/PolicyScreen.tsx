import { WatchSkeleton } from "@/components/WatchDataState";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { useLayoutEffect, useRef, useState } from "react";
import {QuietSettingRow} from "../design/QuietComponents";
import "../design/policy-page.css";

export function PolicyScreen({section}:{section?:"signing"|"allowlist"}={}) {
  const exceptionRuleRef = useRef<HTMLInputElement>(null);
  const allowRequest = useRef<AbortController | null>(null);
  const [allowError, setAllowError] = useState<{installationId:number|null;message:string}|null>(null);
  const {search,watchHref} = useWatchScreenContext();
  const { Button, SIGNING_POLICY_CLEAR_CONFIRM, SIGNING_POLICY_CONFIRM, activeInstallId, allowExpires, allowPath, allowReason, allowRule, baselineReason, beginConfirm, canManageSigningPolicy, confirmBusy, confirmForm, confirming, exceptions, installAdmin, locked, previewing, refreshSignedIn, route, savingAllow, selectedInstallId, setAllowExpires, setAllowPath, setAllowReason, setAllowRule, setBaselineReason, setPackageError, setSavingAllow, setSigningDraft, setSigningError, signingDraft, signingError, signingPolicy } = useWatchScreenContext();
  useLayoutEffect(() => () => {
    const request = allowRequest.current;
    if (request) {
      allowRequest.current = null;
      request.abort();
      setSavingAllow(false);
    }
  }, [activeInstallId, selectedInstallId, setSavingAllow]);
  const activeExceptions = exceptions.filter((entry) => entry.active).length;
  const signingLabel =
    signingPolicy.status === "ready" ? (signingPolicy.policy ? "on" : "off") : "—";
  return (
    <>
      {route.view === "policy" && (
              <section className="policy-connection-section" aria-label={section === "signing" ? "Signing settings" : section === "allowlist" ? "GitHub allowlist settings" : "Connection policy"}>
                {!section && <>
                <WatchPageHeader
                  title="Policy & allowlist"
                  lede="Time-bound exceptions and shipping evidence."
                  action={
                    !previewing && installAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => exceptionRuleRef.current?.focus()}
                      >
                        Write exception
                      </Button>
                    ) : undefined
                  }
                />
                <div className="mt-[18px] grid gap-3 sm:grid-cols-2">
                  <div className="watch-stat">
                    <span className="watch-kicker">Active</span>
                    <p className={`watch-stat-n ${activeExceptions ? "text-warn" : "text-dim"}`}>
                      {activeExceptions}
                    </p>
                    <p className="watch-tiny mt-1 text-dim">Exact-rule exceptions</p>
                  </div>
                  <div className="watch-stat">
                    <span className="watch-kicker">Signing</span>
                    <p className={`watch-stat-n ${signingLabel === "on" ? "text-snow" : "text-dim"}`}>
                      {signingLabel}
                    </p>
                    <p className="watch-tiny mt-1 text-dim">Not Sigstore verification</p>
                  </div>
                </div>
                </>}
                {section !== "allowlist" && <section className="policy-signing">
                <div className="policy-section-heading"><h2>Signing policy</h2><p>Require attestation documents for the selected GitHub connection.</p></div>
                <p className="policy-scope-caveat">Checks document presence and declared builder identity. This is not Sigstore verification and not a malware verdict.</p>
                <details className="policy-scope-note"><summary>Scope and confirmation</summary><p>Trial and Team can require a present GitHub or npm attestation document, or a builder prefix, before a passing revision is approved to ship. Type signing-policy to save. Type clear-signing-policy to remove it. Expired policies do not block.</p></details>
                {previewing ? (
                  <>
                    <p className="mt-6 text-[13px] leading-relaxed text-mute">
                      Preview cannot change a live signing policy. No invented incident.
                    </p>
                    <div className="watch-empty">No exceptions written.</div>
                  </>
                ) : signingPolicy.status === "ended" ? (
                  <p className="mt-6 text-[13px] leading-relaxed text-mute">
                    Subscribe to Team to set a signing policy.
                  </p>
                ) : signingPolicy.status === "solo" ? (
                  <p className="mt-6 text-[13px] leading-relaxed text-mute">
                    Subscribe to Team to set a signing policy.
                  </p>
                ) : signingPolicy.status === "error" ? (
                  <p className="mt-6 text-[13px] text-danger">{signingPolicy.message}</p>
                ) : signingPolicy.status === "loading" ? (
                  <WatchSkeleton variant="list" className="mt-4" />
                ) : (
                  <div className="policy-signing-form">
                    <QuietSettingRow label="Require a present GitHub attestation" description="Check for a GitHub attestation document." checked={signingDraft.requireGithub} disabled={!canManageSigningPolicy || confirmBusy} onChange={checked=>setSigningDraft(current=>({...current,requireGithub:checked}))}/>
                    <QuietSettingRow label="Require a present npm attestation" description="Check for an npm attestation document." checked={signingDraft.requireNpm} disabled={!canManageSigningPolicy || confirmBusy} onChange={checked=>setSigningDraft(current=>({...current,requireNpm:checked}))}/>
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
                </section>}
                {section !== "signing" && <section className="policy-allowlist">
                <div className="policy-section-heading"><h2>GitHub allowlist</h2><p>Time-bound exceptions for the selected connection.</p></div>
                <p className="policy-scope-caveat">Exceptions accept bounded risk; they do not fix a finding or rewrite saved evidence.</p>
                <p className="policy-scope-caveat">Request a scoped exception from a saved release finding. <a className="underline underline-offset-4" href={watchHref('/watch/releases',search,{install:activeInstallId})}>Open saved releases</a></p>
                <details className="policy-scope-note"><summary>Scope and approval rules</summary><p>Exceptions are exact-rule, attributable, and they expire. They never suppress a different rule. If your workspace requires independent approval, direct allowlist creation below is blocked; another administrator must approve the request. Historical entries remain available for review and revocation.</p><p>Approve a packed receipt as the shipping baseline; later diffs use that receipt instead of whichever scan happened last.</p></details>
                {allowError?.installationId === activeInstallId && <p role="alert" className="mt-3 text-sm text-danger">{allowError.message}</p>}
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
                    aria-label="Create a scoped exception"
                    className="policy-allowlist-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || savingAllow || allowRequest.current) return;
                      const request = new AbortController();
                      allowRequest.current = request;
                      setPackageError(null);
                      setAllowError(null);
                      setSavingAllow(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/exceptions", {
                            method: "POST",
                            signal: request.signal,
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
                          if (request.signal.aborted || allowRequest.current !== request) return;
                          if (!response.ok) throw new Error(body.error ?? "Could not save allowlist entry.");
                          setAllowRule("");
                          setAllowPath("");
                          setAllowReason("");
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          if (request.signal.aborted || allowRequest.current !== request) return;
                          setAllowError({installationId:activeInstallId,message:error instanceof Error ? error.message : "Could not save allowlist entry."});
                          setPackageError(
                            error instanceof Error ? error.message : "Could not save allowlist entry.",
                          );
                        } finally {
                          if (allowRequest.current === request) {
                            allowRequest.current = null;
                            setSavingAllow(false);
                          }
                        }
                      })();
                    }}
                  >
                    <label>
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Rule</span>
                      <input
                        ref={exceptionRuleRef}
                        id="policy-exception-rule"
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
                    <Button className="justify-self-start" type="submit" disabled={locked || savingAllow || !allowRule.trim() || !allowReason.trim()}>
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
                  <div className="watch-empty">No active allowlist entries.</div>
                ) : (
                  <ul className="policy-allowlist-entries">
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
                </section>}
              </section>
              )}
    </>
  );
}
