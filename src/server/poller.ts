import { logJson } from "./log.ts";
import type { GithubPort } from "./github.ts";
import type { NpmPort } from "./npm.ts";
import { runNpmWatchPoll } from "./npm-watch.ts";
import { runWebOriginPoll } from "./web-watch.ts";
import { runMapCustodyPoll } from "./map-watch.ts";
import type { AlertNotifier } from "./notifier.ts";
import type { Store } from "./store.ts";

export async function runVisibilityPoll(deps: {
  store: Store;
  github: GithubPort;
  notifier: AlertNotifier;
}): Promise<number> {
  const repos = await deps.store.listAllRepos();
  let alerts = 0;
  for (const repo of repos) {
    if (!(await deps.store.installationWorkAllowed(repo.installation_id))) continue;
    const fresh = await deps.github.getRepo(repo.installation_id, repo.owner, repo.name);
    const wasPrivate = repo.last_private ?? repo.private;
    if (wasPrivate && !fresh.private) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const duplicate = await deps.store.hasRecentAlert(repo.id, "repo_publicized", since);
      if (!duplicate) {
        await deps.notifier.send({
          installationId: repo.installation_id,
          repoId: repo.id,
          repoFullName: fresh.full_name,
          kind: "repo_publicized",
          title: `${fresh.full_name} is public`,
          body: "Visibility poller: this repository was private last time we checked and is public now. A webhook may have been missed.",
        });
        alerts += 1;
      }
    }
    await deps.store.updateRepoCheck(repo.id, fresh.private);
  }
  return alerts;
}

export function startPoller(
  deps: {
    store: Store;
    github: GithubPort;
    notifier: AlertNotifier;
    npm: NpmPort;
    wakeWorker?: () => void;
  },
  intervalMs: number,
): { stop: () => void } {
  const timer = setInterval(() => {
    void (async () => {
      await runVisibilityPoll(deps);
      const npm = await runNpmWatchPoll(deps);
      const web = await runWebOriginPoll(deps);
      const maps = await runMapCustodyPoll(deps);
      if (npm.queued + web.queued + maps.queued > 0) deps.wakeWorker?.();
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logJson("error", "poller.failed", { message });
    });
  }, intervalMs);
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
