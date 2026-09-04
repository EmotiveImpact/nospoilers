import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { cn } from "@/lib/utils";
import type { PermissionTest } from "@/watch/types";

function webhookStat(githubPaused: boolean, test?: PermissionTest | null) {
  if (githubPaused) {
    return { value: "paused", tone: "text-danger", note: "GitHub suspended the App" };
  }
  const delivery = test?.lastDelivery;
  if (!delivery) {
    return { value: "check needed", tone: "text-mute", note: "No invented delivery proof" };
  }
  const failed = delivery.status === "failed";
  return {
    value: delivery.status,
    tone: failed ? "text-danger" : "text-ok",
    note: `${delivery.kind} · ${new Date(delivery.at).toLocaleString()}`,
  };
}

function permissionStat(test?: PermissionTest | null) {
  if (!test) {
    return { value: "unknown", tone: "text-mute", note: "Run the live install test" };
  }
  if (test.administrationGranted) {
    return { value: test.ok ? "pass" : "fail", tone: "text-warn", note: "Administration granted — remove it" };
  }
  if (test.ok) {
    return { value: "pass", tone: "text-ok", note: "Administration off" };
  }
  return { value: "fail", tone: "text-danger", note: test.detail };
}

function fairUseStat(fairUse: { exhausted?: boolean; warning?: boolean } | null | undefined) {
  if (fairUse?.exhausted) return { value: "paused", tone: "text-danger", note: "Hosted unpacks · not scan credits" };
  if (fairUse?.warning) return { value: "near cap", tone: "text-warn", note: "Hosted unpacks · not scan credits" };
  if (fairUse) return { value: "ok", tone: "text-ok", note: "Hosted unpacks · not scan credits" };
  return { value: "unknown", tone: "text-mute", note: "Hosted unpacks · not scan credits" };
}

export function HealthScreen() {
  const {
    Button,
    FAIR_USE_EXHAUSTED,
    FAIR_USE_WARNING,
    activeInstallId,
    fairUse,
    githubPaused,
    installations,
    jobSummary,
    jobs,
    kindLabel,
    previewing,
    route,
    selectedInstall,
    setMe,
    setTestError,
    setTestingInstallId,
    testError,
    testingInstallId,
  } = useWatchScreenContext();
  if (route.view !== "health") return null;

  const visibleInstalls = installations.filter((row) => !activeInstallId || row.id === activeInstallId);
  const headerInstall = selectedInstall ?? visibleInstalls[0] ?? null;
  const webhook = webhookStat(githubPaused, selectedInstall?.lastPermissionTest);
  const permissions = permissionStat(selectedInstall?.lastPermissionTest);
  const usage = fairUseStat(fairUse);

  async function testInstall(installId: number) {
    setTestError(null);
    setTestingInstallId(installId);
    try {
      const response = await fetch(`/api/installations/${installId}/test`, {
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
              row.id === installId
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
      setTestError(error instanceof Error ? error.message : "Could not test this install.");
    } finally {
      setTestingInstallId(null);
    }
  }

  return (
    <section className="watch-narrow">
      <WatchPageHeader
        title="Install health"
        lede="Permissions, deliveries, and recent work for this GitHub install."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={previewing || !headerInstall || testingInstallId === headerInstall?.id}
            onClick={() => headerInstall && void testInstall(headerInstall.id)}
          >
            {headerInstall && testingInstallId === headerInstall.id ? "Testing…" : "Test install"}
          </Button>
        }
      />

      <div className="mt-[18px] grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="watch-stat">
          <span className="watch-kicker">Webhook</span>
          <p className={cn("watch-stat-n", webhook.tone)}>{webhook.value}</p>
          <p className="watch-tiny mt-1 text-dim">{webhook.note}</p>
        </div>
        <div className="watch-stat">
          <span className="watch-kicker">Permissions</span>
          <p className={cn("watch-stat-n", permissions.tone)}>{permissions.value}</p>
          <p className="watch-tiny mt-1 text-dim">{permissions.note}</p>
        </div>
        <div className="watch-stat">
          <span className="watch-kicker">Queue</span>
          <p className={`watch-stat-n ${jobSummary.queued + jobSummary.running ? "text-warn" : "text-dim"}`}>
            {jobSummary.queued + jobSummary.running}
          </p>
          <p className="watch-tiny mt-1 text-dim">
            {jobSummary.done} done · {jobSummary.failed} failed
          </p>
        </div>
        <div className="watch-stat">
          <span className="watch-kicker">Fair use</span>
          <p className={cn("watch-stat-n", usage.tone)}>{usage.value}</p>
          <p className="watch-tiny mt-1 text-dim">{usage.note}</p>
        </div>
      </div>

      <div className="watch-capability">
        <span className="watch-kicker">When the cap is reached</span>
        <p className="watch-guidance watch-small mt-[5px] text-dim">
          Live permission tests talk to GitHub. They never create a Watch alert. Test install
          reports Contents and Metadata reads, Members read (collaborator alerts), optional
          Contents/Pull requests/Checks write, and whether Administration was granted — it should
          not be. If the App requested a permission this install has not accepted, Test install
          names it and links to GitHub’s Accept page. It does not ask for Administration. This
          install’s recent jobs stay listed until they succeed or hit the retry cap. Global
          queues stay owner-only.
        </p>
      </div>

      {githubPaused ? (
        <p className="mt-4 text-[13px] leading-relaxed text-danger">
          GitHub suspended the NoSpoilers App
          {selectedInstall ? ` on ${selectedInstall.account_login}` : ""}. This is not a billing change.
        </p>
      ) : null}
      {!previewing && fairUse?.exhausted ? (
        <p className="mt-4 text-[13px] leading-relaxed text-danger">{FAIR_USE_EXHAUSTED}</p>
      ) : !previewing && fairUse?.warning ? (
        <p className="mt-4 text-[13px] leading-relaxed text-mute">{FAIR_USE_WARNING}</p>
      ) : null}

      {previewing ? (
        <p className="mt-6 text-[13px] leading-relaxed text-mute">
          Preview cannot reach GitHub. No invented incident.
        </p>
      ) : visibleInstalls.length === 0 ? (
        <div className="watch-empty">
          Nothing on this install yet. Health fills in after the GitHub app can see a repo.
        </div>
      ) : (
        <div className="watch-card mt-6">
          {visibleInstalls.map((install) => {
            const test = install.lastPermissionTest;
            return (
              <div key={install.id} className="watch-kv items-start">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-snow">{install.account_login}</p>
                  {test ? (
                    <p className="watch-tiny mt-1 text-mute">
                      {test.ok ? "Reads reachable. " : ""}
                      {test.detail} Last test {new Date(test.testedAt).toLocaleString()}.
                    </p>
                  ) : (
                    <p className="watch-tiny mt-1 text-dim">No live permission test yet.</p>
                  )}
                  {test?.pendingAccepts && test.pendingAccepts.length > 0 && test.installUrl ? (
                    <a
                      href={test.installUrl}
                      className="watch-tiny mt-1 inline-block text-snow underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Accept requested permissions
                    </a>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingInstallId === install.id}
                  onClick={() => void testInstall(install.id)}
                >
                  {testingInstallId === install.id ? "Testing…" : "Test install"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {testError ? <p className="mt-4 text-[13px] text-danger">{testError}</p> : null}

      {previewing || jobs.length === 0 ? (
        <div className="watch-empty">No jobs on this install yet. The list fills after a real scan or webhook.</div>
      ) : (
        <div className="watch-card mt-6">
          {jobs.map((job) => (
            <div key={job.id} className="watch-kv items-start">
              <div className="min-w-0">
                <p className="font-mono text-[13px] text-snow">{kindLabel(job.kind)}</p>
                <p className="watch-tiny mt-1 text-dim">
                  {job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}
                  {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                </p>
                {job.error ? <p className="watch-tiny mt-1 text-mute">{job.error}</p> : null}
              </div>
              <span className={cn("watch-tiny shrink-0 uppercase tracking-[0.16em]", job.status === "failed" ? "text-danger" : "text-dim")}>
                {job.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
