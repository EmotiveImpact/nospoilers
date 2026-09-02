import { createHash } from "node:crypto";
import type { NpmPort } from "./npm.ts";
import { normalizePackageName } from "./npm.ts";
import { discoverAndQueueProspects } from "./prospects.ts";
import type { Store } from "./store.ts";

export const MAX_PROSPECT_NPM_FEED = 8;
export const MAX_SCHEDULED_DISCOVERY = 3;
export const MAX_PROSPECT_FEED_QUEUE = 3;

export async function prospectCustomerWorkBusy(
  store: Store,
  staleAfterMs = 5 * 60 * 1000,
): Promise<boolean> {
  const health = await store.ownerQueueHealth(staleAfterMs);
  return health.customer.queued + health.customer.running > 0;
}

export async function prospectQueueSaturated(
  store: Store,
  staleAfterMs = 5 * 60 * 1000,
): Promise<boolean> {
  const health = await store.ownerQueueHealth(staleAfterMs);
  return health.prospect.queued + health.prospect.running >= MAX_PROSPECT_FEED_QUEUE;
}

export async function runProspectNpmFeed(input: {
  store: Store;
  npm: NpmPort;
  staleAfterMs?: number;
}): Promise<{ checked: number; queued: number; skipped?: "customer_busy" | "prospect_queue" }> {
  const staleAfterMs = input.staleAfterMs ?? 5 * 60 * 1000;
  if (await prospectCustomerWorkBusy(input.store, staleAfterMs)) {
    return { checked: 0, queued: 0, skipped: "customer_busy" };
  }
  if (await prospectQueueSaturated(input.store, staleAfterMs)) {
    return { checked: 0, queued: 0, skipped: "prospect_queue" };
  }
  const rows = await input.store.listNpmProspectsForFeed(32);
  const seen = new Set<string>();
  let checked = 0;
  let queued = 0;
  for (const row of rows) {
    if (checked >= MAX_PROSPECT_NPM_FEED) break;
    const packageName = normalizePackageName(row.package_name ?? "");
    if (!packageName || seen.has(packageName)) continue;
    seen.add(packageName);
    checked += 1;
    let pack: Awaited<ReturnType<NpmPort["getPack"]>> = null;
    try {
      pack = await input.npm.getPack(packageName);
    } catch {
      await input.store.touchProspectFeedCheck(row.id);
      continue;
    }
    await input.store.touchProspectFeedCheck(row.id);
    if (!pack) continue;
    if (pack.version === row.release_tag && pack.tarballUrl === row.artifact_url) continue;
    const inserted = await input.store.upsertProspect({
      source: "npm",
      owner: row.owner,
      repo: row.repo,
      repositoryUrl: row.repository_url,
      packageName,
      releaseTag: pack.version,
      artifactName: `${packageName.replace(/[^A-Za-z0-9_.-]+/g, "-")}-${pack.version}.tgz`,
      artifactUrl: pack.tarballUrl,
    });
    if (!inserted.inserted) continue;
    const key = createHash("sha256").update(pack.tarballUrl).digest("hex");
    const job = await input.store.enqueueJob({
      deliveryId: `prospect:${key}`,
      priority: "heavy",
      kind: "prospect_scan",
      payload: { prospectId: inserted.id },
    });
    if (job.inserted) queued += 1;
  }
  return { checked, queued };
}

export async function runScheduledProspectDiscovery(input: {
  store: Store;
  token?: string;
  maxAssetBytes: number;
  staleAfterMs?: number;
}): Promise<{
  repositories: number;
  found: number;
  queued: number;
  existing: number;
  errors: string[];
  skipped?: "no_token" | "customer_busy" | "prospect_queue";
}> {
  const staleAfterMs = input.staleAfterMs ?? 5 * 60 * 1000;
  if (!input.token?.trim()) {
    return { repositories: 0, found: 0, queued: 0, existing: 0, errors: [], skipped: "no_token" };
  }
  if (await prospectCustomerWorkBusy(input.store, staleAfterMs)) {
    return { repositories: 0, found: 0, queued: 0, existing: 0, errors: [], skipped: "customer_busy" };
  }
  if (await prospectQueueSaturated(input.store, staleAfterMs)) {
    return { repositories: 0, found: 0, queued: 0, existing: 0, errors: [], skipped: "prospect_queue" };
  }
  return {
    ...(await discoverAndQueueProspects(
      input.store,
      { limit: MAX_SCHEDULED_DISCOVERY },
      input.token,
      input.maxAssetBytes,
    )),
  };
}

export async function runProspectAcquisitionPoll(input: {
  store: Store;
  npm: NpmPort;
  discovery?: { token: string; maxAssetBytes: number };
  staleAfterMs?: number;
}): Promise<{ feedQueued: number; discoveryQueued: number }> {
  const feed = await runProspectNpmFeed(input);
  let discoveryQueued = 0;
  if (input.discovery?.token && feed.skipped !== "customer_busy" && feed.skipped !== "prospect_queue") {
    const discovery = await runScheduledProspectDiscovery({
      store: input.store,
      token: input.discovery.token,
      maxAssetBytes: input.discovery.maxAssetBytes,
      staleAfterMs: input.staleAfterMs,
    });
    discoveryQueued = discovery.queued;
  }
  return { feedQueued: feed.queued, discoveryQueued };
}
