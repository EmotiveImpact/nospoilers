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
import { postPagerDutyAlert } from "./pagerduty.ts";
import { emailAlertText, postResendEmail } from "./email.ts";
import {
  alertSeverity,
  destinationReceives,
  routeMatches,
  type RouteSample,
} from "./routing.ts";
import type { Store } from "./store.ts";

export type AlertInput = {
  installationId: number;
  repoId?: number | null;
  repoFullName?: string | null;
  packageName?: string | null;
  kind: string;
  title: string;
  body: string;
  findings?: Finding[];
  githubDeliveryId?: string | null;
  releaseRevisionIds?: number[];
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

export async function deliverPagerDutyAlert(
  store: Store,
  input: {
    installationId: number;
    alertId: number | null;
    kind: string;
    title: string;
    body: string;
    severity: "info" | "warn" | "critical";
  },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<void> {
  const dest = await store.getPagerDutyKeyForInstallation(input.installationId);
  if (!dest) return;
  const posted = await postPagerDutyAlert(
    dest.routingKey,
    {
      title: input.title,
      body: input.body,
      kind: input.kind,
      severity: input.severity,
    },
    opts,
  );
  await store.recordNotificationDelivery({
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    kind: "pagerduty",
    status: posted.ok ? "sent" : "failed",
    error: posted.error,
  });
  logJson(posted.ok ? "info" : "error", posted.ok ? "alert.pagerduty_sent" : "alert.pagerduty_failed", {
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    status: posted.status,
  });
}

export async function deliverEmailAlert(
  store: Store,
  input: {
    installationId: number;
    alertId: number | null;
    kind: string;
    title: string;
    body: string;
  },
  opts: { fetch?: typeof fetch; apiKey?: string; fromEmail?: string } = {},
): Promise<void> {
  const dest = await store.getDestinationWebhookForInstallation(input.installationId, "email");
  if (!dest) return;
  const posted = await postResendEmail(
    {
      apiKey: opts.apiKey ?? "",
      from: opts.fromEmail ?? "",
      to: dest.url,
      ...emailAlertText({ title: input.title, body: input.body, kind: input.kind }),
    },
    opts.fetch ?? fetch,
  );
  await store.recordNotificationDelivery({
    installationId: input.installationId,
    destinationId: dest.id,
    alertId: input.alertId,
    kind: "email",
    status: posted.ok ? "sent" : "failed",
    error: posted.error,
  });
  logJson(posted.ok ? "info" : "error", posted.ok ? "alert.email_sent" : "alert.email_failed", {
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

async function sampleForAlert(store: Store, alert: AlertInput): Promise<RouteSample> {
  let repoFullName = alert.repoFullName ?? null;
  if (!repoFullName && alert.repoId) {
    const repo = await store.getRepo(alert.repoId);
    repoFullName = repo?.full_name ?? null;
  }
  return {
    severity: alertSeverity(alert),
    repoFullName,
    packageName: alert.packageName ?? null,
  };
}

export function createLogNotifier(
  store: Store,
  opts: {
    fetch?: typeof fetch;
    lookup?: WebhookHostLookup;
    resend?: { apiKey: string; fromEmail: string };
  } = {},
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
      const routes = await store.listNotificationRoutesForInstallation(alert.installationId);
      const sample = await sampleForAlert(store, alert);
      const payload = {
        installationId: alert.installationId,
        alertId: id,
        kind: alert.kind,
        title: alert.title,
        body: alert.body,
        severity: sample.severity,
      };
      try {
        const dest = await store.getSlackWebhookForInstallation(alert.installationId);
        if (
          dest &&
          destinationReceives(
            routes.filter((row) => row.destinationId === dest.id),
            sample,
          )
        ) {
          await deliverSlackAlert(store, payload, fetchImpl);
        }
      } catch (error) {
        logJson("error", "alert.slack_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "Slack delivery failed.",
        });
      }
      try {
        const dest = await store.getSiemWebhookForInstallation(alert.installationId);
        if (
          dest &&
          destinationReceives(
            routes.filter((row) => row.destinationId === dest.id),
            sample,
          )
        ) {
          await deliverSiemAlert(store, payload, { fetch: fetchImpl, lookup: opts.lookup });
        }
      } catch (error) {
        logJson("error", "alert.siem_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "SIEM delivery failed.",
        });
      }
      try {
        const dest = await store.getJiraAuthForInstallation(alert.installationId);
        if (
          dest &&
          destinationReceives(
            routes.filter((row) => row.destinationId === dest.id),
            sample,
          )
        ) {
          await deliverJiraAlert(store, payload, { fetch: fetchImpl, lookup: opts.lookup });
        }
      } catch (error) {
        logJson("error", "alert.jira_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "Jira delivery failed.",
        });
      }
      try {
        const dest = await store.getDestinationWebhookForInstallation(alert.installationId, "email");
        if (
          dest &&
          destinationReceives(
            routes.filter((row) => row.destinationId === dest.id),
            sample,
          )
        ) {
          await deliverEmailAlert(store, payload, {
            fetch: fetchImpl,
            apiKey: opts.resend?.apiKey,
            fromEmail: opts.resend?.fromEmail,
          });
        }
      } catch (error) {
        logJson("error", "alert.email_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "Email delivery failed.",
        });
      }
      try {
        const dest = await store.getPagerDutyKeyForInstallation(alert.installationId);
        if (
          dest &&
          destinationReceives(
            routes.filter((row) => row.destinationId === dest.id),
            sample,
          )
        ) {
          await deliverPagerDutyAlert(store, payload, { fetch: fetchImpl, lookup: opts.lookup });
        }
      } catch (error) {
        logJson("error", "alert.pagerduty_failed", {
          id,
          installationId: alert.installationId,
          error: error instanceof Error ? error.message : "PagerDuty delivery failed.",
        });
      }
      const assignee = routes.find(
        (row) => row.teamLogin && routeMatches(row, sample),
      )?.teamLogin;
      if (assignee) {
        await store.assignAlertFromRouting(id, alert.installationId, assignee);
      }
    },
  };
}
