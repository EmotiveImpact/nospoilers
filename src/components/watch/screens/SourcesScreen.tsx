import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";
import type { RemediationFileView, SetupStatusFacts } from "@/watch/types";

export function SourcesScreen() {
  const { Button, CoverageLock, DELETE_PACK_ASSETS_COPY, DISABLE_WORKFLOW_COPY, GithubResponseResult, MAKE_PRIVATE_COPY, RemediationPrResult, SetupPrResult, SetupStatusResult, WatchSourcesSummary, adminOnly, beginConfirm, confirmBusy, confirmForm, confirming, deletePackAssetsConfirm, deskRepos, ended, githubByRepo, githubRunnersReachable, hostedOrigin, installAdmin, locked, makePrivateConfirm, parseWorkflowPath, previewing, probingSetupId, refreshSignedIn, remediateByRepo, remediatingId, repos, retryDeskSection, route, scanError, scanningId, search, selectedInstallId, setGithubByRepo, setProbingSetupId, setRemediateByRepo, setRemediatingId, setScanError, setScanningId, setSetupByRepo, setSetupStatusByRepo, setSetuppingId, setWorkflowDraft, setup, setupByRepo, setupStatusByRepo, setuppingId, sourceRows, sourceSectionState, workflowDraft, workflowIsNoSpoilersScan } = useWatchScreenContext();
  return (
    <>
      {route.view === "sources" && (
                <section className="relative min-h-72">
                  {ended ? (
                    <CoverageLock variant="watch" title="Subscribe to keep watching." />
                  ) : null}
                  <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
                  <WatchSourcesSummary
                    mode="sources"
                    sources={sourceRows}
                    setup={setup}
                    admin={adminOnly}
                    search={search}
                    filter={route.sourceFilter}
                    attention={route.sourceAttention}
                    selectedSourceKey={route.sourceKey}
                    state={sourceSectionState}
                    onRetry={() => void retryDeskSection("sources")}
                  />
                  {route.view === "sources" &&
                  route.sourceConfigure === "github" &&
                  (previewing || sourceSectionState.status === "ready") ? (
                  <section id="watch-source-github" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
                  <h2 className="text-sm font-semibold text-snow">GitHub repositories</h2>
                  <p className="mt-2 text-sm text-mute">Repositories connected to this install and their current state.</p>
                  <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                    Setup PR adds packed-artifact CI that scans each{" "}
                    <code className="text-snow">package.tgz</code> or{" "}
                    <code className="text-snow">dist/</code> pack that exists, not only a hardcoded
                    package.tgz. The workflow vendors{" "}
                    <code className="text-snow">.github/actions/nospoilers</code> and POSTs packed bytes
                    to hosted scan. It needs a Watch token plus repository variable{" "}
                    <code className="text-snow">NOSPOILERS_API_URL</code>
                    {hostedOrigin ? (
                      <>
                        {" "}
                        (currently <code className="text-snow">{hostedOrigin}</code>
                        {githubRunnersReachable
                          ? ", which GitHub-hosted runners can reach"
                          : "; GitHub-hosted runners cannot reach loopback or HTTP"}
                        )
                      </>
                    ) : null}
                    . If none exist, that workflow
                    fails closed. Remediation PR adds ignore
                    rules, an empty .nospoilers.yml (no silent allowlist), bundler hints, and that CI
                    workflow if it is missing. Both PRs need Contents write and Pull requests write. They
                    commit the vendored Action; the workflow YAML stays copy-paste because the App does not
                    request Workflows write. They
                    are reviewable and never merged. They do not need Administration, and they do not make
                    the repository private or delete a Release asset.             After you merge the setup PR, mark the
                    NoSpoilers check required in branch protection if you want CI to block; the App does
                    not change branch protection and cannot see whether a check is required. Setup status
                    probes the vendored Action, the workflow YAML, and whether a NoSpoilers check ran.
                    It never invents an alert. A GitHub Release is scanned when it
                    is published, and again when pack assets are added or replaced. Scan latest release
                    unpacks that repo’s current Release pack, not the git tree. The hourly poller does
                    not download every latest release. Unpublishing or deleting
                    a release is an alert only; gone assets are not downloaded.
                  </p>
                  <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                    {MAKE_PRIVATE_COPY} {DELETE_PACK_ASSETS_COPY} {DISABLE_WORKFLOW_COPY} Setup and
                    remediation PRs do not need Administration. A confirmed GitHub response is not a
                    discovered incident.
                  </p>
                  {previewing ? (
                    <p className="mt-3 text-sm leading-relaxed text-mute">
                      Preview cannot open GitHub PRs, probe setup files, or change GitHub visibility. No
                      invented incident.
                    </p>
                  ) : null}
                  {!previewing && repos.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
                  {!previewing && repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
                  {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
                    <p className="mt-6 text-sm leading-relaxed text-mute">
                      Nothing on this install yet. Install NoSpoilers on a private throwaway repo.
                    </p>
                  )}
                  {deskRepos.length > 0 && (
                    <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                      {deskRepos.map((repo) => (
                        <li key={repo.id} className="py-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <a
                              href={repo.html_url}
                              className="font-mono text-sm text-snow underline-offset-4 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              {repo.full_name}
                            </a>
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              {repo.private ? "private" : "public"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-dim">
                            Last check{" "}
                            {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || scanningId === repo.id || locked}
                              onClick={() => {
                                if (previewing) return;
                                setScanError(null);
                                setScanningId(repo.id);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/repos/${repo.id}/scan-latest-release`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as { error?: string };
                                    if (!response.ok) throw new Error(body.error ?? "Could not queue scan.");
                                    await refreshSignedIn(selectedInstallId);
                                  } catch (error) {
                                    setScanError(error instanceof Error ? error.message : "Could not queue scan.");
                                  } finally {
                                    setScanningId(null);
                                  }
                                })();
                              }}
                            >
                              {scanningId === repo.id ? "Queuing…" : "Scan latest release"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || probingSetupId === repo.id || locked}
                              onClick={() => {
                                if (previewing) return;
                                setProbingSetupId(repo.id);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/repos/${repo.id}/setup-status`, {
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as {
                                      error?: string;
                                      status?: SetupStatusFacts;
                                    };
                                    if (!response.ok || !body.status) {
                                      throw new Error(body.error ?? "Could not probe setup files.");
                                    }
                                    setSetupStatusByRepo((current) => ({
                                      ...current,
                                      [repo.id]: { status: "ready", facts: body.status! },
                                    }));
                                  } catch (error) {
                                    setSetupStatusByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "error",
                                        message:
                                          error instanceof Error
                                            ? error.message
                                            : "Could not probe setup files.",
                                      },
                                    }));
                                  } finally {
                                    setProbingSetupId(null);
                                  }
                                })();
                              }}
                            >
                              {probingSetupId === repo.id ? "Probing…" : "Setup status"}
                            </Button>
                            {previewing || installAdmin ? (
                            <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || setuppingId === repo.id || locked}
                              onClick={() => {
                                if (previewing) return;
                                setSetuppingId(repo.id);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/repos/${repo.id}/setup-pr`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as {
                                      error?: string;
                                      reason?: string;
                                      workflow?: string;
                                      files?: { path: string; content: string }[];
                                      written?: string[];
                                      branch?: string;
                                      compareUrl?: string | null;
                                      htmlUrl?: string;
                                      number?: number;
                                      existing?: boolean;
                                      skipped?: string;
                                    };
                                    if (response.status === 409 && (body.files?.length || body.workflow)) {
                                      const files =
                                        body.files && body.files.length > 0
                                          ? body.files
                                          : [
                                              {
                                                path: ".github/workflows/nospoilers.yml",
                                                content: body.workflow ?? "",
                                              },
                                            ];
                                      setSetupByRepo((current) => ({
                                        ...current,
                                        [repo.id]: {
                                          status: "copy",
                                          reason: body.reason ?? "GitHub App cannot open a pull request.",
                                          files,
                                          written: body.written,
                                          branch: body.branch,
                                          compareUrl: body.compareUrl,
                                        },
                                      }));
                                      return;
                                    }
                                    if (!response.ok || !body.htmlUrl || typeof body.number !== "number") {
                                      throw new Error(body.error ?? body.reason ?? "Could not open a setup PR.");
                                    }
                                    const htmlUrl = body.htmlUrl;
                                    const number = body.number;
                                    setSetupByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "opened",
                                        htmlUrl,
                                        number,
                                        existing: Boolean(body.existing),
                                      },
                                    }));
                                  } catch (error) {
                                    setSetupByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "error",
                                        message:
                                          error instanceof Error ? error.message : "Could not open a setup PR.",
                                      },
                                    }));
                                  } finally {
                                    setSetuppingId(null);
                                  }
                                })();
                              }}
                            >
                              {setuppingId === repo.id ? "Opening…" : "Setup PR"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || remediatingId === repo.id || locked}
                              onClick={() => {
                                if (previewing) return;
                                setRemediatingId(repo.id);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/repos/${repo.id}/remediation-pr`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as {
                                      error?: string;
                                      reason?: string;
                                      files?: RemediationFileView[];
                                      written?: string[];
                                      branch?: string;
                                      compareUrl?: string | null;
                                      htmlUrl?: string;
                                      number?: number;
                                      existing?: boolean;
                                      skipped?: string;
                                    };
                                    if (response.status === 409 && Array.isArray(body.files) && body.files.length > 0) {
                                      setRemediateByRepo((current) => ({
                                        ...current,
                                        [repo.id]: {
                                          status: "copy",
                                          reason: body.reason ?? "GitHub App cannot open a pull request.",
                                          files: body.files ?? [],
                                          written: body.written,
                                          branch: body.branch,
                                          compareUrl: body.compareUrl,
                                        },
                                      }));
                                      return;
                                    }
                                    if (!response.ok || !body.htmlUrl || typeof body.number !== "number") {
                                      throw new Error(
                                        body.error ?? body.reason ?? "Could not open a remediation PR.",
                                      );
                                    }
                                    const htmlUrl = body.htmlUrl;
                                    const number = body.number;
                                    setRemediateByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "opened",
                                        htmlUrl,
                                        number,
                                        existing: Boolean(body.existing),
                                      },
                                    }));
                                  } catch (error) {
                                    setRemediateByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "error",
                                        message:
                                          error instanceof Error
                                            ? error.message
                                            : "Could not open a remediation PR.",
                                      },
                                    }));
                                  } finally {
                                    setRemediatingId(null);
                                  }
                                })();
                              }}
                            >
                              {remediatingId === repo.id ? "Opening…" : "Remediation PR"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || locked || confirmBusy}
                              onClick={() => {
                                if (previewing) return;
                                setGithubByRepo((current) => {
                                  const next = { ...current };
                                  delete next[repo.id];
                                  return next;
                                });
                                beginConfirm({
                                  kind: "make-private",
                                  id: repo.id,
                                  expected: makePrivateConfirm(repo.full_name),
                                });
                              }}
                            >
                              Make private
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={previewing || locked || confirmBusy}
                              onClick={() => {
                                if (previewing) return;
                                setGithubByRepo((current) => {
                                  const next = { ...current };
                                  delete next[repo.id];
                                  return next;
                                });
                                beginConfirm({
                                  kind: "delete-pack-assets",
                                  id: repo.id,
                                  expected: deletePackAssetsConfirm(repo.full_name),
                                });
                              }}
                            >
                              Remove pack assets
                            </Button>
                            </>
                            ) : null}
                          </div>
                          {previewing || installAdmin ? (
                            <div className="mt-3 max-w-xl">
                              <label className="block text-xs leading-relaxed text-dim">
                                Workflow path
                                <input
                                  value={workflowDraft[repo.id] ?? ""}
                                  onChange={(event) =>
                                    setWorkflowDraft((current) => ({
                                      ...current,
                                      [repo.id]: event.target.value,
                                    }))
                                  }
                                  placeholder=".github/workflows/release.yml"
                                  autoComplete="off"
                                  spellCheck={false}
                                  disabled={previewing || locked || confirmBusy}
                                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                                />
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                disabled={previewing || locked || confirmBusy}
                                onClick={() => {
                                  if (previewing) return;
                                  const parsed = parseWorkflowPath(workflowDraft[repo.id] ?? "");
                                  if (!parsed) {
                                    setGithubByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "error",
                                        message:
                                          "Type a workflow path under .github/workflows/, like .github/workflows/release.yml.",
                                      },
                                    }));
                                    return;
                                  }
                                  if (workflowIsNoSpoilersScan(parsed)) {
                                    setGithubByRepo((current) => ({
                                      ...current,
                                      [repo.id]: {
                                        status: "error",
                                        message:
                                          "That workflow is the NoSpoilers packed scan. Disable a release publisher, not the scanner.",
                                      },
                                    }));
                                    return;
                                  }
                                  setGithubByRepo((current) => {
                                    const next = { ...current };
                                    delete next[repo.id];
                                    return next;
                                  });
                                  beginConfirm({
                                    kind: "disable-workflow",
                                    id: repo.id,
                                    expected: parsed,
                                    workflow: parsed,
                                  });
                                }}
                              >
                                Disable workflow
                              </Button>
                            </div>
                          ) : null}
                          {confirmForm(confirming?.kind === "make-private" && confirming.id === repo.id)}
                          {confirmForm(
                            confirming?.kind === "delete-pack-assets" && confirming.id === repo.id,
                          )}
                          {confirmForm(
                            confirming?.kind === "disable-workflow" && confirming.id === repo.id,
                          )}
                          {githubByRepo[repo.id] ? (
                            <GithubResponseResult view={githubByRepo[repo.id]!} />
                          ) : null}
                          {setupStatusByRepo[repo.id] ? (
                            <SetupStatusResult view={setupStatusByRepo[repo.id]!} />
                          ) : null}
                          {setupByRepo[repo.id] ? <SetupPrResult view={setupByRepo[repo.id]!} /> : null}
                          {remediateByRepo[repo.id] ? (
                            <RemediationPrResult view={remediateByRepo[repo.id]!} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {scanError && <p className="mt-4 text-sm text-danger">{scanError}</p>}
                  </section>
                  ) : null}
                  </div>
                </section>
              )}
    </>
  );
}
