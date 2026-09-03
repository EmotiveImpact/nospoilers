import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";
import type { ProtectionImportResult, ReleaseDiffView } from "@/watch/types";

export function RegistriesScreen() {
  const { Button, activeInstallId, allowReasonByCandidate, approvingId, baselineByPackage, baselineReason, beginConfirm, canManageEvidence, canReadEvidence, candidatesByPackage, checkingId, checkingNamespaceId, confirmBusy, confirmForm, confirming, deskCoverage, deskPackages, diffByPackage, diffingId, downloadingEvidenceId, ended, evidenceByPackage, identitySignals, importError, importNames, importResults, importingPackages, installAdmin, installations, loadJson, locked, namespaceError, namespaceScope, namespaces, packageError, packageName, packages, previewing, protectingId, protectionImportStatusLabel, protections, refreshSignedIn, registries, registryError, registryOriginInput, registryToken, riskByPackage, route, savingNamespace, savingRegistry, selectedInstallId, setAllowReasonByCandidate, setApprovingId, setCheckingId, setCheckingNamespaceId, setDiffByPackage, setDiffingId, setDownloadingEvidenceId, setImportError, setImportNames, setImportResults, setImportingPackages, setNamespaceError, setNamespaceScope, setPackageError, setPackageName, setProtectingId, setRegistryError, setRegistryOriginInput, setRegistryToken, setSavingNamespace, setSavingRegistry, setWatchRegistryOrigin, setWatchingPackage, sourceSectionState, user, watchRegistryOrigin, watchingPackage } = useWatchScreenContext();
  return (
    <>
      {(route.view === "registries" ||
                (route.view === "sources" &&
                  route.sourceConfigure === "npm" &&
                  (previewing || sourceSectionState.status === "ready"))) && (
              <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
                {route.view === "registries" ? (
                  <h1 className="mb-5 font-display text-3xl tracking-tight text-snow">Private registries</h1>
                ) : null}
                <section id="watch-source-npm" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                <h2 className="text-sm font-semibold text-snow">
                  {route.view === "registries" ? "Registry credentials" : "npm packages"}
                </h2>
                <p className="mt-2 text-sm text-mute">
                  {route.view === "registries"
                    ? "Encrypted read credentials for private package hosts."
                    : "Packages watched as customers receive them from the registry."}
                </p>
                {route.view === "registries" ? (
                  <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                    Save one read-only registry origin and token at a time. Tokens are encrypted,
                    never shown again, and tarball hosts must match the saved origin.
                  </p>
                ) : (
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  We fetch the tarball a registry serves for <code className="text-snow">latest</code>, and
                  also <code className="text-snow">next</code>, <code className="text-snow">beta</code>,{" "}
                  <code className="text-snow">canary</code>, rc, alpha, and preview when those tags point at
                  another packed version. Other dist-tag moves stay a tag-only alert and do not download.
                  Public packs use registry.npmjs.org. Private registries need an encrypted token (never
                  shown again). Tarball hosts must match the saved registry. Source is not kept. If the
                  registry later has no package under that name after we recorded a version, Watch records
                  that fact without downloading. A later pack that is twice as large, or at least 5 MiB
                  larger unpacked, raises SIZE-003 against the
                  approved baseline or the previous receipt. Protect identity only after the npm scope or
                  GitHub repository field matches this install. Paste a list of names to protect owned
                  packs in one pass — registry metadata only, no tarball download, no scan queue. Trial and
                  Team installs can watch the npm scope that matches this GitHub login. New names on that
                  public search are a Watch fact. The tarball is not downloaded. Other
                  people’s packs are not added to this watch list. A later change of who published latest,
                  or whether it used an npm trusted publisher, is a Watch fact. Email and OIDC config ids
                  are not stored. Trial and Team installs then generate bounded
                  lookalike names and watch dormant resurrection, release bursts, new dependencies that
                  point at newly created packages, packument unpacked-size jumps, and whether npm
                  attestations or registry signature keyids disappear or change. Those last facts are
                  packument presence only — we do not fetch or verify attestations. Watch shows a
                  deterministic signal total for a protected pack, decomposed into those facts. That is
                  not a malware verdict. Trial and Team admins can assemble a human-reviewed evidence pack
                  and publish a consumer advisory page. We never send that pack to npm or GitHub and never
                  call it malware.
                </p>
                )}
                {previewing ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Preview cannot watch lookalike names. No invented incident.
                  </p>
                ) : deskCoverage?.plan === "solo" ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Lookalike, dormant, burst, new-dependency, packument-size, provenance, namespace
                    watchlists, identity evidence, and consumer advisories are on Team.
                  </p>
                ) : ended ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
                    Subscribe to Team to watch lookalike names, an owned npm scope, and assemble identity
                    evidence.
                  </p>
                ) : identitySignals.status === "error" ? (
                  <p className="mt-4 max-w-xl text-sm text-danger">{identitySignals.message}</p>
                ) : null}
                {route.view === "sources" && !previewing && user && installations.length > 0 && identitySignals.status === "ready" && (
                  <div className="mt-6 max-w-xl">
                    <p className="text-xs uppercase tracking-[0.16em] text-dim">npm scope watchlist</p>
                    <p className="mt-2 text-sm leading-relaxed text-mute">
                      Public npm search only. Cap {20} names. First check is a baseline. Later new names
                      alert. Nothing is downloaded or auto-watched.
                    </p>
                    {installAdmin && namespaces.length === 0 ? (
                      <form
                        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (locked || savingNamespace) return;
                          const scope = namespaceScope.trim();
                          if (!scope) return;
                          setNamespaceError(null);
                          setSavingNamespace(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/namespaces", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  scope,
                                  confirm: scope,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not watch that scope.");
                              setNamespaceScope("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setNamespaceError(
                                error instanceof Error ? error.message : "Could not watch that scope.",
                              );
                            } finally {
                              setSavingNamespace(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">Scope</span>
                          <input
                            value={namespaceScope}
                            onChange={(event) => setNamespaceScope(event.target.value)}
                            placeholder="@scope"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={locked}
                            className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" disabled={locked || savingNamespace || !namespaceScope.trim()}>
                          {savingNamespace ? "Watching…" : "Watch scope"}
                        </Button>
                      </form>
                    ) : null}
                    {namespaceError ? <p className="mt-3 text-sm text-danger">{namespaceError}</p> : null}
                    {namespaces.length > 0 ? (
                      <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {namespaces.map((row) => (
                          <li key={row.id} className="py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-mono text-xs text-snow">{row.scope}</p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={locked || checkingNamespaceId === row.id}
                                  onClick={() => {
                                    setCheckingNamespaceId(row.id);
                                    setNamespaceError(null);
                                    void (async () => {
                                      try {
                                        const response = await fetch(`/api/namespaces/${row.id}/check`, {
                                          method: "POST",
                                          credentials: "include",
                                        });
                                        const body = (await response.json()) as { error?: string };
                                        if (!response.ok) {
                                          throw new Error(body.error ?? "Could not check that scope.");
                                        }
                                        await refreshSignedIn(selectedInstallId);
                                      } catch (error) {
                                        setNamespaceError(
                                          error instanceof Error ? error.message : "Could not check that scope.",
                                        );
                                      } finally {
                                        setCheckingNamespaceId(null);
                                      }
                                    })();
                                  }}
                                >
                                  {checkingNamespaceId === row.id ? "Checking…" : "Check now"}
                                </Button>
                                {installAdmin ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={locked || confirmBusy}
                                    onClick={() =>
                                      beginConfirm({
                                        kind: "namespace-unprotect",
                                        id: row.id,
                                        expected: row.scope,
                                      })
                                    }
                                  >
                                    Stop
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-mute">
                              {row.names.length === 0
                                ? "No names on the last public search."
                                : row.names.join(", ")}
                            </p>
                            {confirmForm(confirming?.kind === "namespace-unprotect" && confirming.id === row.id)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}
                {route.view === "sources" && !previewing && packages.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
                {route.view === "sources" && !previewing && packages.status === "error" && (
                  <p className="mt-6 text-sm text-danger">{packages.message}</p>
                )}
                {!previewing && user && installations.length > 0 && installAdmin && (
                  <form
                    className="mt-6 flex max-w-xl flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || savingRegistry) return;
                      setRegistryError(null);
                      setSavingRegistry(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/registries", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              origin: registryOriginInput,
                              token: registryToken,
                              installationId: activeInstallId,
                            }),
                          });
                          const body = (await response.json()) as { error?: string };
                          if (!response.ok) throw new Error(body.error ?? "Could not save registry.");
                          setRegistryToken("");
                          setRegistryOriginInput("");
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setRegistryError(error instanceof Error ? error.message : "Could not save registry.");
                        } finally {
                          setSavingRegistry(false);
                        }
                      })();
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-dim">Private registry</p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="min-w-0 flex-1">
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">Origin</span>
                        <input
                          value={registryOriginInput}
                          onChange={(event) => setRegistryOriginInput(event.target.value)}
                          placeholder="https://npm.pkg.github.com"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={locked}
                          className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                        />
                      </label>
                      <label className="min-w-0 flex-1">
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">Token</span>
                        <input
                          type="password"
                          value={registryToken}
                          onChange={(event) => setRegistryToken(event.target.value)}
                          placeholder="read-only token"
                          autoComplete="new-password"
                          disabled={locked}
                          className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                        />
                      </label>
                      <Button type="submit" disabled={locked || savingRegistry || !registryOriginInput.trim() || !registryToken.trim()}>
                        {savingRegistry ? "Saving…" : "Save token"}
                      </Button>
                    </div>
                  </form>
                )}
                {registryError && <p className="mt-4 text-sm text-danger">{registryError}</p>}
                {!previewing && registries.length > 0 && (
                  <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {registries.map((registry) => (
                      <li key={registry.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs text-mute">{registry.origin}</p>
                        {installAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={locked || confirmBusy}
                          onClick={() =>
                            beginConfirm({
                              kind: "registry",
                              id: registry.id,
                              expected: registry.origin,
                            })
                          }
                        >
                          Remove
                        </Button>
                        ) : null}
                        </div>
                        {confirmForm(confirming?.kind === "registry" && confirming.id === registry.id)}
                      </li>
                    ))}
                  </ul>
                )}
                {route.view === "sources" ? (
                <>
                {!previewing && user && installations.length > 0 && (
                  <form
                    className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || watchingPackage) return;
                      setPackageError(null);
                      setWatchingPackage(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/packages", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              packageName,
                              installationId: activeInstallId,
                              registryOrigin: watchRegistryOrigin,
                            }),
                          });
                          const body = (await response.json()) as { error?: string };
                          if (!response.ok) throw new Error(body.error ?? "Could not watch package.");
                          setPackageName("");
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setPackageError(error instanceof Error ? error.message : "Could not watch package.");
                        } finally {
                          setWatchingPackage(false);
                        }
                      })();
                    }}
                  >
                    <label className="min-w-0 flex-1">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Package name</span>
                      <input
                        value={packageName}
                        onChange={(event) => setPackageName(event.target.value)}
                        placeholder="@scope/name"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <label className="min-w-0 sm:w-56">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Registry</span>
                      <select
                        value={watchRegistryOrigin}
                        onChange={(event) => setWatchRegistryOrigin(event.target.value)}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                      >
                        <option value="https://registry.npmjs.org">registry.npmjs.org</option>
                        {registries.map((registry) => (
                          <option key={registry.id} value={registry.origin}>
                            {registry.host}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" disabled={locked || watchingPackage || !packageName.trim()}>
                      {watchingPackage ? "Connecting…" : "Watch package"}
                    </Button>
                  </form>
                )}
                {!previewing && user && installations.length > 0 && (
                  <form
                    className="mt-8 flex max-w-xl flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || importingPackages) return;
                      setImportError(null);
                      setImportResults(null);
                      setImportingPackages(true);
                      void (async () => {
                        try {
                          const response = await fetch("/api/protections/import", {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              names: importNames,
                              installationId: activeInstallId,
                              registryOrigin: watchRegistryOrigin,
                            }),
                          });
                          const body = (await response.json()) as {
                            error?: string;
                            queued?: boolean;
                            results?: ProtectionImportResult[];
                          };
                          if (!response.ok) throw new Error(body.error ?? "Could not import protections.");
                          setImportNames("");
                          setImportResults(body.results ?? []);
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setImportError(
                            error instanceof Error ? error.message : "Could not import protections.",
                          );
                        } finally {
                          setImportingPackages(false);
                        }
                      })();
                    }}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-dim">Protect identities</p>
                    <p className="text-sm leading-relaxed text-mute">
                      Up to 20 npm names, one per line or comma-separated. We read registry metadata only —
                      no tarball download and no scan job. Protect only when the npm scope or GitHub
                      repository field matches this install. Names you do not own stay off this watch list.
                    </p>
                    <label className="min-w-0">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Package names</span>
                      <textarea
                        value={importNames}
                        onChange={(event) => setImportNames(event.target.value)}
                        placeholder={"@you/app\nleft-pad"}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        rows={4}
                        className="mt-2 w-full resize-y rounded-md border border-white/15 bg-transparent px-3 py-2 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="min-w-0 sm:w-56">
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">Registry</span>
                        <select
                          value={watchRegistryOrigin}
                          onChange={(event) => setWatchRegistryOrigin(event.target.value)}
                          disabled={locked}
                          className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                        >
                          <option value="https://registry.npmjs.org">registry.npmjs.org</option>
                          {registries.map((registry) => (
                            <option key={registry.id} value={registry.origin}>
                              {registry.host}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button type="submit" disabled={locked || importingPackages || !importNames.trim()}>
                        {importingPackages ? "Importing…" : "Import protections"}
                      </Button>
                    </div>
                  </form>
                )}
                {importError && <p className="mt-4 text-sm text-danger">{importError}</p>}
                {importResults && importResults.length > 0 && (
                  <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {importResults.map((row) => (
                      <li key={`${row.name}:${row.status}`} className="py-3">
                        <p className="font-mono text-sm text-snow">{row.name}</p>
                        <p className="mt-1 text-xs text-dim">
                          {protectionImportStatusLabel(row.status)}
                          {row.verifiedVia ? ` · ${row.verifiedVia}` : ""}
                          {row.githubRepo ? ` ${row.githubRepo}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {packageError && <p className="mt-4 text-sm text-danger">{packageError}</p>}
                {deskPackages.length === 0 && (previewing || packages.status === "ready") && (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    No packages yet. Connect a public pack, or save a private registry token and watch from
                    that host.
                  </p>
                )}
                {deskPackages.length > 0 && (
                  <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {deskPackages.map((pkg) => {
                      const diffState = diffByPackage[pkg.id];
                      const protection = protections.find((row) => row.packageId === pkg.id);
                      const candidates = candidatesByPackage[pkg.id] ?? [];
                      const evidence = evidenceByPackage[pkg.id] ?? null;
                      const risk = riskByPackage[pkg.id] ?? null;
                      return (
                        <li key={pkg.id} className="py-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm text-snow">{pkg.package_name}</p>
                              <p className="mt-1 text-xs text-dim">
                                {pkg.registry_origin && pkg.registry_origin !== "https://registry.npmjs.org"
                                  ? `${pkg.registry_origin} · `
                                  : ""}
                                {pkg.last_version ? `@${pkg.last_version}` : "not scanned yet"}
                                {pkg.last_scan_status ? ` · ${pkg.last_scan_status}` : ""}
                                {pkg.last_sha256 ? ` · ${pkg.last_sha256.slice(0, 12)}` : ""}
                                {pkg.last_checked_at
                                  ? ` · checked ${new Date(pkg.last_checked_at).toLocaleString()}`
                                  : ""}
                                {baselineByPackage[pkg.id]
                                  ? ` · baseline ${baselineByPackage[pkg.id]?.actorLogin} ${new Date(baselineByPackage[pkg.id]?.createdAt ?? "").toLocaleDateString()}`
                                  : ""}
                                {protection
                                  ? ` · protected via ${protection.verifiedVia}${protection.githubRepo ? ` ${protection.githubRepo}` : ""}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={previewing || locked || checkingId === pkg.id}
                                onClick={() => {
                                  setPackageError(null);
                                  setCheckingId(pkg.id);
                                  void (async () => {
                                    try {
                                      const response = await fetch(`/api/packages/${pkg.id}/check`, {
                                        method: "POST",
                                        credentials: "include",
                                      });
                                      const body = (await response.json()) as { error?: string };
                                      if (!response.ok) throw new Error(body.error ?? "Could not check package.");
                                      await refreshSignedIn(selectedInstallId);
                                    } catch (error) {
                                      setPackageError(
                                        error instanceof Error ? error.message : "Could not check package.",
                                      );
                                    } finally {
                                      setCheckingId(null);
                                    }
                                  })();
                                }}
                              >
                                {checkingId === pkg.id ? "Checking…" : "Check now"}
                              </Button>
                              {!protection && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={previewing || locked || protectingId === pkg.id}
                                  onClick={() => {
                                    setPackageError(null);
                                    setProtectingId(pkg.id);
                                    void (async () => {
                                      try {
                                        const response = await fetch(`/api/packages/${pkg.id}/protect`, {
                                          method: "POST",
                                          credentials: "include",
                                        });
                                        const body = (await response.json()) as { error?: string };
                                        if (!response.ok) {
                                          throw new Error(body.error ?? "Could not protect package.");
                                        }
                                        await refreshSignedIn(selectedInstallId);
                                      } catch (error) {
                                        setPackageError(
                                          error instanceof Error ? error.message : "Could not protect package.",
                                        );
                                      } finally {
                                        setProtectingId(null);
                                      }
                                    })();
                                  }}
                                >
                                  {protectingId === pkg.id ? "Protecting…" : "Protect identity"}
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={previewing || locked || diffingId === pkg.id}
                                onClick={() => {
                                  setPackageError(null);
                                  setDiffingId(pkg.id);
                                  void (async () => {
                                    try {
                                      const body = await loadJson<ReleaseDiffView>(
                                        `/api/packages/${pkg.id}/diff`,
                                      );
                                      setDiffByPackage((current) => ({ ...current, [pkg.id]: body }));
                                    } catch (error) {
                                      setDiffByPackage((current) => ({
                                        ...current,
                                        [pkg.id]: {
                                          error:
                                            error instanceof Error ? error.message : "Could not load diff.",
                                        },
                                      }));
                                    } finally {
                                      setDiffingId(null);
                                    }
                                  })();
                                }}
                              >
                                {diffingId === pkg.id ? "Diffing…" : "Diff"}
                              </Button>
                              {installAdmin ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={previewing || locked || approvingId === pkg.id}
                                onClick={() => {
                                  setPackageError(null);
                                  setApprovingId(pkg.id);
                                  void (async () => {
                                    try {
                                      const response = await fetch(`/api/packages/${pkg.id}/baseline`, {
                                        method: "POST",
                                        credentials: "include",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({ reason: baselineReason }),
                                      });
                                      const body = (await response.json()) as { error?: string };
                                      if (!response.ok) {
                                        throw new Error(body.error ?? "Could not approve baseline.");
                                      }
                                      await refreshSignedIn(selectedInstallId);
                                    } catch (error) {
                                      setPackageError(
                                        error instanceof Error ? error.message : "Could not approve baseline.",
                                      );
                                    } finally {
                                      setApprovingId(null);
                                    }
                                  })();
                                }}
                              >
                                {approvingId === pkg.id ? "Approving…" : "Approve baseline"}
                              </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={previewing || locked || confirmBusy}
                                onClick={() =>
                                  beginConfirm({
                                    kind: "package",
                                    id: pkg.id,
                                    expected: pkg.package_name,
                                  })
                                }
                              >
                                Stop
                              </Button>
                            </div>
                          </div>
                          {confirmForm(confirming?.kind === "package" && confirming.id === pkg.id)}
                          {protection && identitySignals.status === "ready" && risk ? (
                            <div className="mt-4 max-w-xl">
                              <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                Identity signals {risk.total} / {risk.max}
                              </p>
                              <p className="mt-1 text-xs text-mute">{risk.note}</p>
                              {risk.signals.length > 0 ? (
                                <ul className="mt-2 divide-y divide-white/5">
                                  {risk.signals.map((signal) => (
                                    <li
                                      key={signal.kind}
                                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                                    >
                                      <p className="text-xs text-snow">{signal.title}</p>
                                      <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                        {signal.count > 1 ? `${signal.count} · ` : ""}
                                        {signal.points}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-xs text-mute">No open identity signals.</p>
                              )}
                            </div>
                          ) : null}
                          {protection && identitySignals.status === "ready" && candidates.length > 0 ? (
                            <div className="mt-4 max-w-xl">
                              <p className="text-xs uppercase tracking-[0.16em] text-dim">Lookalike names</p>
                              <ul className="mt-2 divide-y divide-white/5">
                                {candidates.map((candidate) => (
                                  <li key={candidate.id} className="py-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <p className="font-mono text-xs text-snow">{candidate.candidateName}</p>
                                      <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                        {candidate.transformation.replaceAll("_", " ")}
                                        {candidate.allowlisted ? " · allowlisted" : ""}
                                        {candidate.registeredAt && !candidate.allowlisted
                                          ? ` · registered${candidate.lastVersion ? ` ${candidate.lastVersion}` : ""}`
                                          : ""}
                                      </p>
                                    </div>
                                    {candidate.allowlisted && candidate.allowlistReason ? (
                                      <p className="mt-1 text-xs text-mute">{candidate.allowlistReason}</p>
                                    ) : null}
                                    {installAdmin && !candidate.allowlisted ? (
                                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                                        <label className="min-w-0 flex-1">
                                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                                            Reason
                                          </span>
                                          <input
                                            value={allowReasonByCandidate[candidate.id] ?? ""}
                                            onChange={(event) =>
                                              setAllowReasonByCandidate((current) => ({
                                                ...current,
                                                [candidate.id]: event.target.value,
                                              }))
                                            }
                                            placeholder="Benign package we already trust"
                                            autoComplete="off"
                                            spellCheck={false}
                                            disabled={previewing || locked}
                                            className="mt-1 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                                          />
                                        </label>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={
                                            previewing ||
                                            locked ||
                                            confirmBusy ||
                                            !(allowReasonByCandidate[candidate.id] ?? "").trim()
                                          }
                                          onClick={() =>
                                            beginConfirm({
                                              kind: "identity-allowlist",
                                              packageId: pkg.id,
                                              id: candidate.id,
                                              expected: candidate.candidateName,
                                              reason: (allowReasonByCandidate[candidate.id] ?? "").trim(),
                                            })
                                          }
                                        >
                                          Allowlist
                                        </Button>
                                      </div>
                                    ) : null}
                                    {installAdmin && candidate.allowlisted ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="mt-2"
                                        disabled={previewing || locked || confirmBusy}
                                        onClick={() =>
                                          beginConfirm({
                                            kind: "identity-revoke",
                                            packageId: pkg.id,
                                            id: candidate.id,
                                            expected: candidate.candidateName,
                                          })
                                        }
                                      >
                                        Revoke allowlist
                                      </Button>
                                    ) : null}
                                    {confirmForm(
                                      (confirming?.kind === "identity-allowlist" ||
                                        confirming?.kind === "identity-revoke") &&
                                        confirming.id === candidate.id,
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {protection && canReadEvidence ? (
                            <div className="mt-4 max-w-xl">
                              <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                Identity evidence
                              </p>
                              {evidence ? (
                                <>
                                  <p className="mt-2 text-xs text-mute">
                                    Assembled {new Date(evidence.assembledAt).toLocaleString()}. Not a malware
                                    verdict. Not sent to npm or GitHub.
                                  </p>
                                  {evidence.advisory.enabled && evidence.advisory.path ? (
                                    <p className="mt-2 text-xs text-mute">
                                      Public advisory{" "}
                                      <a
                                        href={evidence.advisory.path}
                                        className="text-snow underline-offset-2 hover:underline"
                                      >
                                        {evidence.advisory.path}
                                      </a>
                                    </p>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={downloadingEvidenceId === pkg.id}
                                      onClick={() => {
                                        setDownloadingEvidenceId(pkg.id);
                                        try {
                                          const blob = new Blob(
                                            [JSON.stringify(evidence.takedown, null, 2)],
                                            { type: "application/json" },
                                          );
                                          const url = URL.createObjectURL(blob);
                                          const link = document.createElement("a");
                                          link.href = url;
                                          link.download = `nospoilers-identity-${pkg.package_name.replaceAll("/", "-")}.json`;
                                          link.click();
                                          URL.revokeObjectURL(url);
                                        } finally {
                                          setDownloadingEvidenceId(null);
                                        }
                                      }}
                                    >
                                      {downloadingEvidenceId === pkg.id ? "Saving…" : "Download evidence"}
                                    </Button>
                                    {canManageEvidence ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          disabled={previewing || locked || confirmBusy}
                                          onClick={() =>
                                            beginConfirm({
                                              kind: "identity-evidence",
                                              id: pkg.id,
                                              expected: pkg.package_name,
                                            })
                                          }
                                        >
                                          Reassemble
                                        </Button>
                                        {evidence.advisory.enabled ? (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={previewing || locked || confirmBusy}
                                            onClick={() =>
                                              beginConfirm({
                                                kind: "identity-unpublish-advisory",
                                                id: pkg.id,
                                                expected: pkg.package_name,
                                              })
                                            }
                                          >
                                            Unpublish advisory
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={previewing || locked || confirmBusy}
                                            onClick={() =>
                                              beginConfirm({
                                                kind: "identity-publish-advisory",
                                                id: pkg.id,
                                                expected: pkg.package_name,
                                              })
                                            }
                                          >
                                            Publish advisory
                                          </Button>
                                        )}
                                      </>
                                    ) : null}
                                  </div>
                                </>
                              ) : canManageEvidence ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  disabled={previewing || locked || confirmBusy}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "identity-evidence",
                                      id: pkg.id,
                                      expected: pkg.package_name,
                                    })
                                  }
                                >
                                  Assemble evidence
                                </Button>
                              ) : (
                                <p className="mt-2 text-xs text-mute">No evidence pack yet.</p>
                              )}
                              {confirmForm(
                                (confirming?.kind === "identity-evidence" ||
                                  confirming?.kind === "identity-publish-advisory" ||
                                  confirming?.kind === "identity-unpublish-advisory") &&
                                  confirming.id === pkg.id,
                              )}
                            </div>
                          ) : null}
                          {diffState && "error" in diffState ? (
                            <p className="mt-3 text-sm text-danger">{diffState.error}</p>
                          ) : null}
                          {diffState && "diff" in diffState ? (
                            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                              {!diffState.previous || !diffState.current || !diffState.diff ? (
                                <p className="text-sm text-mute">
                                  {diffState.baseline
                                    ? "Current receipt is the approved baseline."
                                    : "Need two receipts, or an approved baseline, before a release diff exists."}
                                </p>
                              ) : (
                                <>
                                  <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                    {diffState.versus === "baseline" ? "vs baseline · " : ""}
                                    {diffState.previous.coordinate} → {diffState.current.coordinate}
                                  </p>
                                  {diffState.diff.unexpectedSizeJump ? (
                                    <p className="mt-2 text-sm text-snow">
                                      SIZE-003 · unpacked {diffState.diff.nextBytes} bytes versus{" "}
                                      {diffState.diff.previousBytes} on the{" "}
                                      {diffState.versus === "baseline" ? "approved baseline" : "previous scan"}{" "}
                                      (2× or 5 MiB jump).
                                    </p>
                                  ) : null}
                                  <p className="mt-2 text-xs text-dim">
                                    +{diffState.diff.added.length} −{diffState.diff.removed.length} ~
                                    {diffState.diff.changed.length} · {diffState.diff.sizeDelta >= 0 ? "+" : ""}
                                    {diffState.diff.sizeDelta} bytes
                                  </p>
                                  <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-mute">
                                    {diffState.diff.added.map((entry) => (
                                      <li key={`a-${entry.path}`}>+ {entry.path}</li>
                                    ))}
                                    {diffState.diff.removed.map((entry) => (
                                      <li key={`r-${entry.path}`}>− {entry.path}</li>
                                    ))}
                                    {diffState.diff.changed.map((entry) => (
                                      <li key={`c-${entry.path}`}>~ {entry.path}</li>
                                    ))}
                                  </ul>
                                </>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
                </>
                ) : null}
                </section>
              </section>
              )}
    </>
  );
}
