import { logJson } from "./log.ts";
import type { Finding } from "../scanner/types.ts";
import {
  postSlackWebhook,
  slackAlertPayload,
} from "./slack.ts";
import {
  postSiemWebhook,
  siemAlertPayload,
  type WebhookHostLookup,
} from "./siem.ts";
import { postJiraIssue } from "./jira.ts";
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

export async function deliverSlackAlert(
  store: Store,
  input: {
    installationId: number;
    alertId: number | null;
    kind: string;
    title: string;
    body: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const dest = await store.getSlackWebhookForInstallation(input.installationId);
  if (!dest) return;
  const posted = await postSlackWebhook(
    dest.url,
    slackAlertPayload({ title: input.title, body: input.body, kind: input.kind }),
    fetchImpl,
  );
  await store.recordNotificationDelivery({
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    kind: "slack",
    status: posted.ok ? "sent" : "failed",
    error: posted.error,
  });
  logJson(posted.ok ? "info" : "error", posted.ok ? "alert.slack_sent" : "alert.slack_failed", {
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    status: posted.status,
  });
}

export async function deliverSiemAlert(
  store: Store,
  input: {
    installationId: number;
    alertId: number | null;
    kind: string;
    title: string;
    body: string;
  },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<void> {
  const dest = await store.getSiemWebhookForInstallation(input.installationId);
  if (!dest) return;
  const posted = await postSiemWebhook(
    dest.url,
    siemAlertPayload({ title: input.title, body: input.body, kind: input.kind }),
    opts,
  );
  await store.recordNotificationDelivery({
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    kind: "siem",
    status: posted.ok ? "sent" : "failed",
    error: posted.error,
  });
  logJson(posted.ok ? "info" : "error", posted.ok ? "alert.siem_sent" : "alert.siem_failed", {
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    status: posted.status,
  });
}

export async function deliverJiraAlert(
  store: Store,
  input: {
    installationId: number;
    alertId: number | null;
    kind: string;
    title: string;
    body: string;
  },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<void> {
  const dest = await store.getJiraAuthForInstallation(input.installationId);
  if (!dest) return;
  const posted = await postJiraIssue(
    dest.host,
    dest.projectKey,
    dest.secret,
    { title: input.title, body: input.body, kind: input.kind },
    opts,
  );
  await store.recordNotificationDelivery({
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    kind: "jira",
    status: posted.ok ? "sent" : "failed",
    error: posted.error,
  });
  logJson(posted.ok ? "info" : "error", posted.ok ? "alert.jira_sent" : "alert.jira_failed", {
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    status: posted.status,
  });
}

export function createLogNotifier(
  store: Store,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): AlertNotifier {
  const fetchImpl = opts.fetch ?? fetch;
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
      try {
        await deliverSlackAlert(
          store,
          {
            installationId: alert.installationId,
            alertId: id,
            kind: alert.kind,
            title: alert.title,
            body: alert.body,
          },
          fetchImpl,
        );
      } catch (error) {
        logJson("error", "alert.slack_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "Slack delivery failed.",
        });
      }
      try {
        await deliverSiemAlert(
          store,
          {
            installationId: alert.installationId,
            alertId: id,
            kind: alert.kind,
            title: alert.title,
            body: alert.body,
          },
          { fetch: fetchImpl, lookup: opts.lookup },
        );
      } catch (error) {
        logJson("error", "alert.siem_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "SIEM delivery failed.",
        });
      }
      try {
        await deliverJiraAlert(
          store,
          {
            installationId: alert.installationId,
            alertId: id,
            kind: alert.kind,
            title: alert.title,
            body: alert.body,
          },
          { fetch: fetchImpl, lookup: opts.lookup },
        );
      } catch (error) {
        logJson("error", "alert.jira_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "Jira delivery failed.",
        });
      }
    },
  };
}
