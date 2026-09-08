import type { AlertNotifier } from "./notifier.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";
import type { Store, WatchedOriginRow } from "./store.ts";
import { MAX_WATCHED_ORIGINS, parseWatchRoot } from "./web-origin.ts";

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
  options: { enqueue?: boolean } = {},
): Promise<{ queued: boolean; origin: WatchedOriginRow }> {
  const parsed = parseWatchRoot(input.url);
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
  const result =
    options.enqueue === false
      ? { inserted: false }
      : await store.enqueueJob({
          deliveryId: webOriginScanDeliveryId(input.installationId, inserted.id, `initial:${inserted.connection_generation??'0'}`),
          priority: "heavy",
          kind: "web_origin_scan",
          payload: {
            installationId: input.installationId,
            originId: inserted.id,
            connectionGeneration: inserted.connection_generation??'0',
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
  if (origin.paused_at) {
    throw Object.assign(new Error("Resume monitoring before scanning this production website."), { status: 409 });
  }
  if (origin.verification_token && !origin.verified_at) {
    throw Object.assign(
      new Error("Verify domain control before scanning this production website."),
      { status: 409 },
    );
  }
  await requireHostedWork(
    store,
    origin.installation_id,
    "Coverage ended. Subscribe to keep watching production websites.",
  );
  const token = `check:${crypto.randomUUID()}`;
  const result = await store.enqueueJob({
    deliveryId: webOriginScanDeliveryId(origin.installation_id, origin.id, token),
    priority: "heavy",
    kind: "web_origin_scan",
    payload: {
      installationId: origin.installation_id,
      originId: origin.id,
      connectionGeneration: origin.connection_generation??'0',
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
    if (origin.verification_token && !origin.verified_at) continue;
    if (!(await deps.store.installationWorkAllowed(origin.installation_id))) continue;
    const result = await deps.store.enqueueJob({
      deliveryId: webOriginScanDeliveryId(origin.installation_id, origin.id, `hour:${hour}:connection:${origin.connection_generation??'0'}`),
      priority: "heavy",
      kind: "web_origin_scan",
      payload: {
        installationId: origin.installation_id,
        originId: origin.id,
        connectionGeneration: origin.connection_generation??'0',
        url: origin.origin_url,
        reason: "poll",
      },
    });
    if (result.inserted) queued += 1;
  }
  return { queued };
}
