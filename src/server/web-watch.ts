import type { AlertNotifier } from "./notifier.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";
import type { Store, WatchedOriginRow } from "./store.ts";
import { MAX_WATCHED_ORIGINS, parseWatchOrigin } from "./web-origin.ts";

export function webOriginScanDeliveryId(
  installationId: number,
  originId: number,
  token: string,
): string {
  return `web-origin:${installationId}:${originId}:${token}`;
}

async function requireHostedWork(
  store: Store,
  installationId: number,
  unpaidMessage: string,
): Promise<void> {
  const block = await store.installationWorkBlock(installationId);
  if (!block) return;
  const denied = httpErrorForWorkBlock(block, unpaidMessage);
  throw Object.assign(new Error(denied.message), { status: denied.status });
}

export async function connectWatchedOrigin(
  store: Store,
  input: { installationId: number; url: string },
): Promise<{ queued: boolean; origin: WatchedOriginRow }> {
  const parsed = parseWatchOrigin(input.url);
  if (!parsed) {
    throw Object.assign(
      new Error("Use an https website URL on a public host. Local, private, and metadata hosts are blocked."),
      { status: 400 },
    );
  }
  await requireHostedWork(
    store,
    input.installationId,
    "Coverage ended. Subscribe to keep watching production websites.",
  );
  const count = await store.countWatchedOrigins(input.installationId);
  if (count >= MAX_WATCHED_ORIGINS) {
    throw Object.assign(
      new Error(`This install already watches ${MAX_WATCHED_ORIGINS} websites.`),
      { status: 400 },
    );
  }
  const inserted = await store.insertWatchedOrigin(input.installationId, parsed.url, parsed.host);
  if (!inserted) {
    throw Object.assign(new Error("That website is already on this install."), { status: 409 });
  }
  const result = await store.enqueueJob({
    deliveryId: webOriginScanDeliveryId(input.installationId, inserted.id, "initial"),
    priority: "light",
    kind: "web_origin_scan",
    payload: {
      installationId: input.installationId,
      originId: inserted.id,
      url: parsed.url,
      reason: "first",
    },
  });
  return { queued: result.inserted, origin: inserted };
}

export async function checkWatchedOrigin(
  store: Store,
  origin: WatchedOriginRow,
  _notifier?: AlertNotifier,
): Promise<{ queued: boolean }> {
  await requireHostedWork(
    store,
    origin.installation_id,
    "Coverage ended. Subscribe to keep watching production websites.",
  );
  const token = `check:${new Date().toISOString().slice(0, 16)}`;
  const result = await store.enqueueJob({
    deliveryId: webOriginScanDeliveryId(origin.installation_id, origin.id, token),
    priority: "light",
    kind: "web_origin_scan",
    payload: {
      installationId: origin.installation_id,
      originId: origin.id,
      url: origin.origin_url,
      reason: "check",
    },
  });
  return { queued: result.inserted };
}

export async function runWebOriginPoll(deps: {
  store: Store;
}): Promise<{ queued: number }> {
  const origins = await deps.store.listAllWatchedOrigins();
  const hour = new Date().toISOString().slice(0, 13);
  let queued = 0;
  for (const origin of origins) {
    if (!(await deps.store.installationWorkAllowed(origin.installation_id))) continue;
    const result = await deps.store.enqueueJob({
      deliveryId: webOriginScanDeliveryId(origin.installation_id, origin.id, `hour:${hour}`),
      priority: "light",
      kind: "web_origin_scan",
      payload: {
        installationId: origin.installation_id,
        originId: origin.id,
        url: origin.origin_url,
        reason: "poll",
      },
    });
    if (result.inserted) queued += 1;
  }
  return { queued };
}
