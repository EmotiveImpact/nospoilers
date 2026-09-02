import { identityPlanDeniedFromBilling } from "./identity-signals.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";
import {
  NAMESPACE_INVALID_ERROR,
  NAMESPACE_SEARCH_SIZE,
  normalizeNpmScope,
  parseScopeSearchHits,
  registryScopeSearchUrl,
  verifyNamespaceOwnership,
  type NamespaceSearchHit,
} from "./namespace-names.ts";
import type { NpmPort } from "./npm.ts";
import { PUBLIC_NPM_HOST, PUBLIC_NPM_ORIGIN } from "./npm-registry.ts";
import type { AlertNotifier } from "./notifier.ts";
import type { ProtectedNamespaceRow, Store } from "./store.ts";

export {
  NAMESPACE_INVALID_ERROR,
  NAMESPACE_SEARCH_SIZE,
  normalizeNpmScope,
  parseScopeSearchHits,
  registryScopeSearchUrl,
  verifyNamespaceOwnership,
};
export type { NamespaceSearchHit };

export const NAMESPACE_CHECK_KIND = "namespace_check";
export const NAMESPACE_NEW_KIND = "identity_namespace_new";

export const NAMESPACE_UNPAID_ERROR =
  "Coverage ended. Subscribe to Team to watch an npm scope.";
export const NAMESPACE_SOLO_ERROR = "npm namespace watchlists are on Team.";
export const NAMESPACE_OWNED_ERROR =
  "Watch only the npm scope that matches this GitHub install login. Naming an arbitrary scope is not ownership.";
export const NAMESPACE_EXISTS_ERROR = "This install already watches an npm scope.";
export const NAMESPACE_UNKNOWN_ERROR = "Unknown npm scope watchlist.";

export type PublicNamespace = {
  id: number;
  installationId: number;
  scope: string;
  names: string[];
  createdByLogin: string;
  lastCheckedAt: string | null;
  createdAt: string;
};

export function publicNamespace(
  row: ProtectedNamespaceRow,
  names: string[] = row.names,
): PublicNamespace {
  return {
    id: row.id,
    installationId: row.installation_id,
    scope: row.scope,
    names,
    createdByLogin: row.created_by_login,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
  };
}

export function namespaceHourBucket(at: Date = new Date()): string {
  return at.toISOString().slice(0, 13);
}

async function requireHostedWork(store: Store, installationId: number): Promise<void> {
  const block = await store.installationWorkBlock(installationId);
  if (!block) return;
  const denied = httpErrorForWorkBlock(block, NAMESPACE_UNPAID_ERROR);
  throw Object.assign(new Error(denied.message), { status: denied.status });
}

async function requireTeamPlan(store: Store, installationId: number): Promise<void> {
  const billing = await store.installationBilling(installationId);
  const denied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
  if (!denied) return;
  throw Object.assign(
    new Error(denied.status === 402 ? NAMESPACE_UNPAID_ERROR : NAMESPACE_SOLO_ERROR),
    { status: denied.status },
  );
}

export async function enqueueNamespaceCheck(
  store: Store,
  row: ProtectedNamespaceRow,
  opts?: { now?: boolean },
): Promise<boolean> {
  if (await store.hasOpenNamespaceCheck(row.id)) return false;
  const deliveryId = opts?.now
    ? `namespace-check-now:${row.installation_id}:${row.scope}:${Date.now()}`
    : `namespace-check:${row.installation_id}:${row.scope}:${namespaceHourBucket()}`;
  const result = await store.enqueueJob({
    deliveryId,
    priority: "light",
    kind: NAMESPACE_CHECK_KIND,
    payload: {
      installationId: row.installation_id,
      namespaceId: row.id,
      scope: row.scope,
      registryOrigin: PUBLIC_NPM_ORIGIN,
      registryHost: PUBLIC_NPM_HOST,
    },
    installationId: row.installation_id,
  });
  return Boolean(result.inserted && result.id);
}

export async function protectNamespace(
  store: Store,
  input: {
    installationId: number;
    scope: string;
    actorLogin: string;
  },
): Promise<{ namespace: PublicNamespace; queued: boolean }> {
  await requireHostedWork(store, input.installationId);
  await requireTeamPlan(store, input.installationId);
  const scope = normalizeNpmScope(input.scope);
  if (!scope) {
    throw Object.assign(new Error(NAMESPACE_INVALID_ERROR), { status: 400 });
  }
  const installation = await store.getInstallation(input.installationId);
  if (!installation) {
    throw Object.assign(new Error("Unknown GitHub installation."), { status: 404 });
  }
  if (!verifyNamespaceOwnership(scope, installation.account_login)) {
    throw Object.assign(new Error(NAMESPACE_OWNED_ERROR), { status: 403 });
  }
  const existing = await store.getProtectedNamespaceForInstallation(input.installationId);
  if (existing) {
    throw Object.assign(new Error(NAMESPACE_EXISTS_ERROR), { status: 409 });
  }
  const row = await store.insertProtectedNamespace({
    installationId: input.installationId,
    scope,
    createdByLogin: input.actorLogin,
  });
  if (!row) {
    throw Object.assign(new Error(NAMESPACE_EXISTS_ERROR), { status: 409 });
  }
  const queued = await enqueueNamespaceCheck(store, row, { now: true });
  return { namespace: publicNamespace(row, []), queued };
}

export async function unprotectNamespace(
  store: Store,
  input: { id: number; userId: string },
): Promise<ProtectedNamespaceRow | null> {
  return store.deleteProtectedNamespaceForUser(input.id, input.userId);
}

export async function runNamespaceCheck(input: {
  store: Store;
  npm: NpmPort;
  notifier?: AlertNotifier;
  namespaceId: number;
}): Promise<{ names: string[]; alerts: number }> {
  const row = await input.store.getProtectedNamespace(input.namespaceId);
  if (!row) return { names: [], alerts: 0 };
  if (!(await input.store.installationWorkAllowed(row.installation_id))) {
    return { names: row.names, alerts: 0 };
  }
  const billing = await input.store.installationBilling(row.installation_id);
  if (identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan)) {
    await input.store.touchProtectedNamespaceChecked(row.id);
    return { names: row.names, alerts: 0 };
  }
  let hits: NamespaceSearchHit[] = [];
  try {
    hits = await input.npm.searchScope(row.scope);
  } catch {
    return { names: row.names, alerts: 0 };
  }
  const names = hits.map((hit) => hit.name);
  const previous = await input.store.latestNamespaceSnapshot(row.id);
  await input.store.insertNamespaceSnapshot({
    namespaceId: row.id,
    installationId: row.installation_id,
    names,
  });
  await input.store.touchProtectedNamespaceChecked(row.id);
  if (!previous) return { names, alerts: 0 };
  const seen = new Set(previous.names);
  const added = names.filter((name) => !seen.has(name));
  let alerts = 0;
  for (const name of added) {
    const payload = {
      installationId: row.installation_id,
      packageName: row.scope,
      kind: NAMESPACE_NEW_KIND,
      title: `New npm name in ${row.scope}: ${name}`,
      body: `${name} appeared on the public npm search for owned scope ${row.scope}. This is a registry name fact, not a malware verdict. The tarball was not downloaded.`,
      githubDeliveryId: `identity-namespace:${row.installation_id}:${row.scope}:${name}`,
    };
    if (input.notifier) await input.notifier.send(payload);
    else await input.store.insertAlert(payload);
    alerts += 1;
  }
  return { names, alerts };
}

export async function runNamespaceWatchPoll(deps: {
  store: Store;
  npm: NpmPort;
}): Promise<{ checked: number; queued: number }> {
  const rows = await deps.store.listDueProtectedNamespaces();
  let checked = 0;
  let queued = 0;
  for (const row of rows) {
    checked += 1;
    if (!(await deps.store.installationWorkAllowed(row.installation_id))) continue;
    const billing = await deps.store.installationBilling(row.installation_id);
    if (identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan)) continue;
    if (await enqueueNamespaceCheck(deps.store, row)) queued += 1;
  }
  return { checked, queued };
}
