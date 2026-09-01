import { logJson } from "./log.ts";
import type { Finding } from "../scanner/types.ts";
import type { Store } from "./store.ts";

export type AlertInput = {
  installationId: number;
  repoId?: number | null;
  kind: string;
  title: string;
  body: string;
  findings?: Finding[];
  githubDeliveryId?: string | null;
};

export type AlertNotifier = {
  send: (alert: AlertInput) => Promise<void>;
};

export function createLogNotifier(store: Store): AlertNotifier {
  return {
    async send(alert) {
      const id = await store.insertAlert(alert);
      logJson("info", "alert.sent", {
        id,
        kind: alert.kind,
        title: alert.title,
        installationId: alert.installationId,
        repoId: alert.repoId ?? null,
        findings: alert.findings?.length ?? 0,
      });
    },
  };
}
