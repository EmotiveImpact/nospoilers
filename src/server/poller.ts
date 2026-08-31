import type { GithubPort } from "./github.ts";
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
    const fresh = await deps.github.getRepo(repo.installation_id, repo.owner, repo.name);
    const wasPrivate = repo.last_private ?? repo.private;
    if (wasPrivate && !fresh.private) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const duplicate = await deps.store.hasRecentAlert(repo.id, "repo_publicized", since);
      if (!duplicate) {
        await deps.notifier.send({
          installationId: repo.installation_id,
          repoId: repo.id,
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
  },
  intervalMs: number,
): { stop: () => void } {
  const timer = setInterval(() => {
    void runVisibilityPoll(deps).catch((error: unknown) => {
      console.error("visibility poll failed", error);
    });
  }, intervalMs);
  return {
    stop() {
      clearInterval(timer);
    },
  };
}
