import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";
import type { PermissionTest } from "@/watch/types";

export function HealthScreen() {
  const { Button, FAIR_USE_EXHAUSTED, FAIR_USE_WARNING, activeInstallId, fairUse, githubPaused, installations, jobSummary, jobs, kindLabel, previewing, route, selectedInstall, setMe, setTestError, setTestingInstallId, testError, testingInstallId } = useWatchScreenContext();
  return (
    <>
      {route.view === "health" && (
              <section className="mt-4">
                <h1 className="font-display text-3xl tracking-tight text-snow">Install health</h1>
                <p className="mt-2 text-sm text-mute">Permissions, deliveries, and recent work for this GitHub install.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-white/8 bg-panel p-4">
                    <p className="watch-kicker">Webhook</p>
                    <p className={githubPaused ? "mt-2 text-lg text-danger" : "mt-2 text-lg text-snow"}>
                      {githubPaused ? "paused" : "check needed"}
                    </p>
                    <p className="mt-1 text-xs text-dim">
                      {githubPaused ? "GitHub suspended the App" : "No invented delivery proof"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-panel p-4">
                    <p className="watch-kicker">Permissions</p>
                    <p className={selectedInstall?.lastPermissionTest?.ok ? "mt-2 text-lg text-snow" : "mt-2 text-lg text-mute"}>
                      {selectedInstall?.lastPermissionTest?.ok ? "pass" : "unknown"}
                    </p>
                    <p className="mt-1 text-xs text-dim">
                      {selectedInstall?.lastPermissionTest
                        ? selectedInstall.lastPermissionTest.administrationGranted
                          ? "Administration granted — remove it"
                          : "Administration off"
                        : "Run the live install test"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-panel p-4">
                    <p className="watch-kicker">Queue</p>
                    <p className="mt-2 text-lg text-snow">{jobSummary.queued + jobSummary.running}</p>
                    <p className="mt-1 text-xs text-dim">
                      {jobSummary.done} done · {jobSummary.failed} failed
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-panel p-4">
                    <p className="watch-kicker">Fair use</p>
                    <p className={fairUse?.exhausted ? "mt-2 text-lg text-danger" : "mt-2 text-lg text-snow"}>
                      {fairUse?.exhausted ? "paused" : fairUse?.warning ? "near cap" : fairUse ? "ok" : "unknown"}
                    </p>
                    <p className="mt-1 text-xs text-dim">Hosted unpacks · not scan credits</p>
                  </div>
                </div>
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  Live permission tests talk to GitHub. They never create a Watch alert. Test install
                  reports Contents and Metadata reads, Members read (collaborator alerts), optional
                  Contents/Pull requests/Checks write, and whether Administration was granted — it should
                  not be. If the App requested a permission this install has not accepted, Test install
                  names it and links to GitHub’s Accept page. It does not ask for Administration. This
                  install’s recent jobs stay listed until they succeed or hit the retry cap. Global
                  queues stay owner-only.
                </p>
                {githubPaused ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-danger">
                    GitHub suspended the NoSpoilers App
                    {selectedInstall ? ` on ${selectedInstall.account_login}` : ""}
                    . This is not a billing change.
                  </p>
                ) : null}
                {!previewing && fairUse?.exhausted ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-danger">{FAIR_USE_EXHAUSTED}</p>
                ) : !previewing && fairUse?.warning ? (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">{FAIR_USE_WARNING}</p>
                ) : null}
                {previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Preview cannot reach GitHub. No invented incident.
                  </p>
                ) : (
                  <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                    {installations
                      .filter((row) => !activeInstallId || row.id === activeInstallId)
                      .map((install) => {
                      const test = install.lastPermissionTest;
                      return (
                        <li key={install.id} className="py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-mono text-sm text-snow">{install.account_login}</p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={testingInstallId === install.id}
                              onClick={() => {
                                setTestError(null);
                                setTestingInstallId(install.id);
                                void (async () => {
                                  try {
                                    const response = await fetch(`/api/installations/${install.id}/test`, {
                                      method: "POST",
                                      credentials: "include",
                                    });
                                    const body = (await response.json()) as {
                                      error?: string;
                                      inventedIncident?: boolean;
                                      test?: PermissionTest;
                                    };
                                    if (!response.ok || !body.test || body.inventedIncident) {
                                      throw new Error(body.error ?? "Could not test this install.");
                                    }
                                    const result = body.test;
                                    setMe((current) => {
                                      if (current.status !== "ready") return current;
                                      return {
                                        status: "ready",
                                        data: {
                                          ...current.data,
                                          installations: current.data.installations.map((row) =>
                                            row.id === install.id
                                              ? {
                                                  ...row,
                                                  lastPermissionTest: result,
                                                  lastPermissionTestAt: result.testedAt,
                                                }
                                              : row,
                                          ),
                                        },
                                      };
                                    });
                                  } catch (error) {
                                    setTestError(
                                      error instanceof Error ? error.message : "Could not test this install.",
                                    );
                                  } finally {
                                    setTestingInstallId(null);
                                  }
                                })();
                              }}
                            >
                              {testingInstallId === install.id ? "Testing…" : "Test install"}
                            </Button>
                          </div>
                          {test ? (
                            <>
                              <p className="mt-2 text-sm leading-relaxed text-mute">
                                {test.ok ? "Reads reachable. " : ""}
                                {test.detail} Last test {new Date(test.testedAt).toLocaleString()}.
                              </p>
                              {test.pendingAccepts && test.pendingAccepts.length > 0 && test.installUrl ? (
                                <p className="mt-2">
                                  <a
                                    href={test.installUrl}
                                    className="text-sm text-snow underline-offset-4 hover:underline"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Accept requested permissions
                                  </a>
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="mt-2 text-xs text-dim">No live permission test yet.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {testError ? <p className="mt-4 text-sm text-danger">{testError}</p> : null}
                {previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">No recent jobs.</p>
                ) : jobs.length === 0 ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">No recent jobs.</p>
                ) : (
                  <>
                    <p className="mt-6 text-xs text-dim">
                      {jobSummary.queued} queued · {jobSummary.running} running · {jobSummary.done} done ·{" "}
                      <span className={jobSummary.failed > 0 ? "text-danger" : undefined}>
                        {jobSummary.failed} failed
                      </span>
                    </p>
                    <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                      {jobs.map((job) => (
                        <li key={job.id} className="py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-mono text-sm text-snow">{kindLabel(job.kind)}</p>
                            <span
                              className={
                                job.status === "failed"
                                  ? "text-xs uppercase tracking-[0.16em] text-danger"
                                  : "text-xs uppercase tracking-[0.16em] text-dim"
                              }
                            >
                              {job.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-dim">
                            {job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}
                            {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                          </p>
                          {job.error ? (
                            <p className="mt-1 text-xs leading-relaxed text-mute">{job.error}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
              )}
    </>
  );
}
