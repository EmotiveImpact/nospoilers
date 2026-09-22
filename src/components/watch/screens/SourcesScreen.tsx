import {navigate} from '@/nav';
import {watchHref} from '@/watch/routes';
import {ArrowLeft,GitBranch,PackageSearch,GitPullRequest,ShieldAlert} from 'lucide-react';
import {RepositoryPicker} from '../RepositoryPicker';
import {WatchPageHeader} from "../WatchPageHeader";
import { WatchSkeleton } from "@/components/WatchDataState";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import type { RemediationFileView, SetupStatusFacts } from "@/watch/types";
import {DisconnectedRepositories} from '../DisconnectedRepositories';
import {RetainedSources} from '../RetainedSources';
import {SourceMonitoringControls} from '../SourceMonitoringControls';
import {WorkspaceCoverageHealth,hasWorkspaceCoverageHealthFilter} from '../WorkspaceCoverageHealth';

export function SourcesScreen() {
  const { Button, CoverageLock, GithubResponseResult, RemediationPrResult, SetupPrResult, SetupStatusResult, WatchSourcesSummary, adminOnly, beginConfirm, confirmBusy, confirmForm, confirming, deletePackAssetsConfirm, deskRepos, ended, githubByRepo, installAdmin, locked, makePrivateConfirm, parseWorkflowPath, previewing, probingSetupId, refreshSignedIn, releases, remediateByRepo, remediatingId, repos, retryDeskSection, route, scanError, scanningId, search, selectedInstallId, setGithubByRepo, setProbingSetupId, setRemediateByRepo, setRemediatingId, setScanError, setScanningId, setSetupByRepo, setSetupStatusByRepo, setSetuppingId, setWorkflowDraft, setup, setupByRepo, setupStatusByRepo, setuppingId, sourceRows, sourceSectionState, workflowDraft, workflowIsNoSpoilersScan } = useWatchScreenContext();
  const manageGithub=sourceSectionState.status!=='error'&&route.sourceConfigure==='github'&&(!route.sourceFilter||['all','github'].includes(route.sourceFilter));
  const managedRepos=(previewing||repos?.status==='ready')?(deskRepos??[]).filter(repo=>`repo-${repo.id}`===route.sourceKey):[];
  const healthWorkspace=new URLSearchParams(search).get('workspace');
  if(route.view==='sources'&&healthWorkspace&&hasWorkspaceCoverageHealthFilter(search))return <WorkspaceCoverageHealth workspaceId={healthWorkspace} search={search}/>;
  if(route.view==='sources'&&sourceSectionState.status==='loading')return <section aria-busy="true"><WatchPageHeader title="Know what’s being checked." lede="Connection, monitoring and latest result are separate states."/></section>;
  return (
    <>
      {route.view === "sources" && (
                <section className="relative min-h-72">
                  {!manageGithub&&new URLSearchParams(search).get('workspace')?<WorkspaceCoverageHealth workspaceId={new URLSearchParams(search).get('workspace')!} search={search}/>:null}
                  {!manageGithub&&selectedInstallId?<DisconnectedRepositories key={selectedInstallId} installationId={selectedInstallId} refreshKey={JSON.stringify(sourceRows)}/>:null}
                  {!manageGithub&&selectedInstallId?<RetainedSources key={`retained-${selectedInstallId}`} installationId={selectedInstallId} search={search} refreshKey={JSON.stringify(sourceRows)}/>:null}
                  {!manageGithub&&selectedInstallId?<SourceMonitoringControls key={`monitoring-${selectedInstallId}`} installationId={selectedInstallId} refreshKey={JSON.stringify(sourceRows)}/>:null}
                  {ended ? (
                    <CoverageLock variant="watch" title="Subscribe to keep watching." />
                  ) : null}
                  <div inert={ended} className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
                  {!manageGithub?<WatchSourcesSummary
                    mode="sources"
                    sources={sourceRows}
                    setup={setup}
                    admin={adminOnly}
                    search={search}
                    filter={route.sourceFilter}
                    attention={route.sourceAttention}
                    selectedSourceKey={route.sourceKey}
                    releases={releases}
                    state={sourceSectionState}
                    onRetry={() => void retryDeskSection("sources")}
                  />:null}
                  {route.view === "sources" &&
                  manageGithub &&
                  (previewing || sourceSectionState.status === "ready") ? (
                  <section id="watch-source-github" tabIndex={-1} className="coverage-repo-tools mx-auto w-full max-w-4xl px-4 py-6 text-snow sm:px-8 sm:py-8">
                  <Button variant="ghost" size="sm" onClick={()=>navigate(watchHref('/watch/sources',search,{configure:null,source:null,sourceType:'github'}))}><ArrowLeft className="size-4" aria-hidden/>Back to Coverage</Button>
                  <div className="mt-6"><WatchPageHeader title="Repository checks." lede="Inspect a published release, set up CI, or manage repository exposure."/></div>
                  <label htmlFor="managed-repository" className="mb-2 block text-sm text-mute">Repository</label>
                  <RepositoryPicker id="managed-repository" repos={deskRepos??[]} value={managedRepos[0]?String(managedRepos[0].id):''} onChange={id=>navigate(watchHref('/watch/sources',search,{source:`repo-${id}`,sourceType:'github',configure:'github'}))}/>

                  {managedRepos.length===0&&deskRepos.length>0?<p className="mt-6 text-sm text-mute">Choose the repository you want to manage. Each action applies only to that repository.</p>:null}
                  {previewing ? (
                    <p className="mt-3 text-sm leading-relaxed text-mute">
                      Preview cannot open GitHub PRs, probe setup files, or change GitHub visibility. No
                      invented incident.
                    </p>
                  ) : null}
                  {!previewing && repos.status === "loading" && <WatchSkeleton variant="list" className="mt-4" />}
                  {!previewing && repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
                  {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
                    <p className="mt-6 text-sm leading-relaxed text-mute">
                      No repositories are available for this GitHub connection. Review repository access in workspace settings.
                    </p>
                  )}
                  {deskRepos.length > 0 && (
                    <ul className="mt-6">
                      {managedRepos.map((repo) => (
                        <li key={repo.id} className="py-5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <a
                              href={repo.html_url}
                              className="flex min-w-0 items-center gap-2 break-all text-base font-semibold text-snow underline-offset-4 hover:underline"
                              rel="noreferrer"
                            >
                              <GitBranch className="size-4 shrink-0" aria-hidden/>{repo.full_name}
                            </a>
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              {repo.private ? "private" : "public"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-dim">
                            Last check{" "}
                            {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                          </p>
                          <div className="mt-6 space-y-6">
                          <section className="rounded-lg bg-[#101012] p-5" aria-label="Release check">
                            <h3 className="flex items-center gap-2 text-base font-semibold"><PackageSearch className="size-4" aria-hidden/>Check a release</h3>
                            <p className="mt-2 text-sm leading-relaxed text-mute">Scan latest release unpacks this repository’s current Release pack, not the git tree. The hourly poller does not download every latest release.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
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
                            </div></section>
                            <section className="rounded-lg bg-[#101012] p-5" aria-label="CI setup">
                            <h3 className="flex items-center gap-2 text-base font-semibold"><GitPullRequest className="size-4" aria-hidden/>Set up release checks in CI</h3>
                            <p className="mt-2 text-sm leading-relaxed text-mute">Check the existing setup or open a pull request for review. Pull requests are never merged automatically; workflow and branch-protection setup may still be required.</p>
                            <p className="mt-2 text-xs leading-relaxed text-dim">Setup status never invents an alert and cannot see whether a check is required. Setup and remediation PRs do not need Administration.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
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
                            </> ) : null}
                            </div></section>
                            {previewing || installAdmin ? <section className="rounded-lg bg-[#101012] p-5" aria-label="Repository actions">
                            <h3 className="flex items-center gap-2 text-base font-semibold"><ShieldAlert className="size-4" aria-hidden/>Repository actions</h3>
                            <p className="mt-2 text-sm leading-relaxed text-mute">These actions change GitHub. Making a repository private changes access; removing pack assets deletes published files. Each requires confirmation.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={repo.private || previewing || locked || confirmBusy}
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
                          </div>
                            <div className="mt-5 border-t border-white/10 pt-5">
                              <p className="mb-3 text-sm text-mute">Disable a release-publishing workflow by its path. The NoSpoilers scan workflow cannot be disabled here.</p>
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
                          </section> : null}
                          </div>
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
