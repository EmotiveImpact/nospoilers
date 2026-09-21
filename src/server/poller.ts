import { logJson } from "./log.ts";
import type { GithubPort } from "./github.ts";
import type { NpmPort } from "./npm.ts";
import { runNpmWatchPoll } from "./npm-watch.ts";
import { runWebOriginPoll } from "./web-watch.ts";
import { runWorkspaceOriginPoll } from './workspace-origin-schedule.ts';
import { runMapCustodyPoll } from "./map-watch.ts";
import { runProspectAcquisitionPoll } from "./prospect-feed.ts";
import { runNamespaceWatchPoll } from "./namespace-watch.ts";
import { sweepExpiredDisclosureEvidence } from "./disclosure.ts";
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

export type PollerTickResult = {
  visibilityAlerts: number;
  npmQueued: number;
  namespacesQueued: number;
  webQueued: number;
  mapsQueued: number;
  prospectsFeedQueued: number;
  prospectsDiscoveryQueued: number;
};

export async function runPollerTick(deps: {
  store: Store;
  github: GithubPort;
  notifier: AlertNotifier;
  npm: NpmPort;
  wakeWorker?: () => void;
  prospectDiscovery?: { token: string; maxAssetBytes: number };
  staleAfterMs?: number;
}): Promise<PollerTickResult> {
  const visibilityAlerts = await runVisibilityPoll(deps);
  const npm = await runNpmWatchPoll(deps);
  const namespaces = await runNamespaceWatchPoll(deps);
  const web = await runWebOriginPoll(deps);
  const workspaceWeb = await runWorkspaceOriginPoll(deps);
  web.queued += workspaceWeb.queued;
  const maps = await runMapCustodyPoll(deps);
  const prospects = await runProspectAcquisitionPoll({
    store: deps.store,
    npm: deps.npm,
    discovery: deps.prospectDiscovery,
    staleAfterMs: deps.staleAfterMs,
  });
  const expired = await sweepExpiredDisclosureEvidence(deps.store);
  if (expired.attachments + expired.notes > 0) {
    logJson("info", "disclosure.evidence_expired", expired);
  }
  if (
    npm.queued +
      namespaces.queued +
      web.queued +
      maps.queued +
      prospects.feedQueued +
      prospects.discoveryQueued >
    0
  ) {
    deps.wakeWorker?.();
  }
  return {
    visibilityAlerts,
    npmQueued: npm.queued,
    namespacesQueued: namespaces.queued,
    webQueued: web.queued,
    mapsQueued: maps.queued,
    prospectsFeedQueued: prospects.feedQueued,
    prospectsDiscoveryQueued: prospects.discoveryQueued,
  };
}

export function startPoller(
  deps: {
    store: Store;
    github: GithubPort;
    notifier: AlertNotifier;
    npm: NpmPort;
    wakeWorker?: () => void;
    prospectDiscovery?: { token: string; maxAssetBytes: number };
    staleAfterMs?: number;
  },
  intervalMs: number,
): { stop: () => Promise<void> } {
  let active: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (active) return;
    active = runPollerTick(deps).then(() => undefined).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logJson("error", "poller.failed", { message });
    }).finally(() => { active = undefined; });
  }, intervalMs);
  return {
    async stop() {
      clearInterval(timer);
      await active;
    },
  };
}
