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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Each sweep is independent: one failing sweep is logged and treated as having
// queued nothing, so the remaining sweeps still run on this tick.
async function isolated<T>(sweep: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logJson("error", "poller.sweep_failed", { sweep, message: errorMessage(error) });
    return fallback;
  }
}

export async function runVisibilityPoll(deps: {
  store: Store;
  github: GithubPort;
  notifier: AlertNotifier;
}): Promise<number> {
  const repos = await deps.store.listAllRepos();
  let alerts = 0;
  for (const repo of repos) {
    if (!(await deps.store.installationWorkAllowed(repo.installation_id))) continue;
    let fresh: Awaited<ReturnType<GithubPort["getRepo"]>>;
    try {
      fresh = await deps.github.getRepo(repo.installation_id, repo.owner, repo.name);
    } catch (error) {
      // One unreachable repository (404/403, token mint failure) must not
      // abort the visibility check for every other repository.
      logJson("warn", "poller.visibility_repo_failed", {
        repoId: repo.id,
        installationId: repo.installation_id,
        message: errorMessage(error),
      });
      continue;
    }
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
  const visibilityAlerts = await isolated("visibility", 0, () => runVisibilityPoll(deps));
  const npm = await isolated("npm", { checked: 0, queued: 0 }, () => runNpmWatchPoll(deps));
  const namespaces = await isolated("namespace", { checked: 0, queued: 0 }, () => runNamespaceWatchPoll(deps));
  const web = await isolated("website", { queued: 0 }, () => runWebOriginPoll(deps));
  const workspaceWeb = await isolated("workspace_website", { queued: 0 }, () => runWorkspaceOriginPoll(deps));
  const webQueued = web.queued + workspaceWeb.queued;
  const maps = await isolated("map", { queued: 0 }, () => runMapCustodyPoll(deps));
  const prospects = await isolated("prospect", { feedQueued: 0, discoveryQueued: 0 }, () =>
    runProspectAcquisitionPoll({
      store: deps.store,
      npm: deps.npm,
      discovery: deps.prospectDiscovery,
      staleAfterMs: deps.staleAfterMs,
    }),
  );
  const expired = await isolated("disclosure_evidence", { attachments: 0, notes: 0 }, () =>
    sweepExpiredDisclosureEvidence(deps.store),
  );
  if (expired.attachments + expired.notes > 0) {
    logJson("info", "disclosure.evidence_expired", expired);
  }
  if (
    npm.queued +
      namespaces.queued +
      webQueued +
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
    webQueued,
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
