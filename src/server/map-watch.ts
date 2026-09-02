import { httpErrorForWorkBlock } from "./install-health.ts";
import type { MapDestinationKind } from "./map-custody.ts";
import type { Store, MapDestinationRow } from "./store.ts";

export function mapCustodyDeliveryId(
  installationId: number,
  destinationId: number,
  token: string,
): string {
  return `map-custody:${installationId}:${destinationId}:${token}`;
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

export async function enqueueMapCustodyChecks(
  store: Store,
  installationId: number,
  token: string,
): Promise<{ queued: number }> {
  if (!(await store.installationWorkAllowed(installationId))) {
    return { queued: 0 };
  }
  const destinations = await store.listMapDestinationsForInstall(installationId);
  let queued = 0;
  for (const destination of destinations) {
    const result = await store.enqueueJob({
      deliveryId: mapCustodyDeliveryId(installationId, destination.id, token),
      installationId,
      priority: "light",
      kind: "map_custody_check",
      payload: {
        installationId,
        destinationId: destination.id,
        kind: destination.kind,
        reason: token,
      },
    });
    if (result.inserted) queued += 1;
  }
  return { queued };
}

export async function checkMapDestination(
  store: Store,
  destination: MapDestinationRow,
): Promise<{ queued: boolean }> {
  await requireHostedWork(
    store,
    destination.installation_id,
    "Coverage ended. Subscribe to keep checking map custody.",
  );
  const token = `check:${new Date().toISOString().slice(0, 16)}`;
  const result = await store.enqueueJob({
    deliveryId: mapCustodyDeliveryId(destination.installation_id, destination.id, token),
    installationId: destination.installation_id,
    priority: "light",
    kind: "map_custody_check",
    payload: {
      installationId: destination.installation_id,
      destinationId: destination.id,
      kind: destination.kind,
      reason: "check",
    },
  });
  return { queued: result.inserted };
}

export async function enqueueMapCustodyAfterConnect(
  store: Store,
  destination: MapDestinationRow,
): Promise<{ queued: boolean }> {
  await requireHostedWork(
    store,
    destination.installation_id,
    "Coverage ended. Subscribe to keep checking map custody.",
  );
  const result = await store.enqueueJob({
    deliveryId: mapCustodyDeliveryId(destination.installation_id, destination.id, "initial"),
    installationId: destination.installation_id,
    priority: "light",
    kind: "map_custody_check",
    payload: {
      installationId: destination.installation_id,
      destinationId: destination.id,
      kind: destination.kind,
      reason: "first",
    },
  });
  return { queued: result.inserted };
}

export async function runMapCustodyPoll(deps: { store: Store }): Promise<{ queued: number }> {
  const destinations = await deps.store.listAllMapDestinations();
  const hour = new Date().toISOString().slice(0, 13);
  let queued = 0;
  for (const destination of destinations) {
    if (!(await deps.store.installationWorkAllowed(destination.installation_id))) continue;
    const result = await deps.store.enqueueJob({
      deliveryId: mapCustodyDeliveryId(
        destination.installation_id,
        destination.id,
        `hour:${hour}`,
      ),
      installationId: destination.installation_id,
      priority: "light",
      kind: "map_custody_check",
      payload: {
        installationId: destination.installation_id,
        destinationId: destination.id,
        kind: destination.kind as MapDestinationKind,
        reason: "poll",
      },
    });
    if (result.inserted) queued += 1;
  }
  return { queued };
}
