import { coverageFrom, type Coverage } from "../coverage.ts";
import { assertPublicWebhookHost, type WebhookHostLookup } from "./siem.ts";

export const PAGERDUTY_EVENTS_HOST = "events.pagerduty.com";
export const PAGERDUTY_ENQUEUE_URL = `https://${PAGERDUTY_EVENTS_HOST}/v2/enqueue`;
export const PAGERDUTY_CHANGE_URL = `https://${PAGERDUTY_EVENTS_HOST}/v2/change/enqueue`;

export type PagerDutySeverity = "critical" | "error" | "warning" | "info";

const KEY_RE = /^[A-Za-z0-9]{32}$/;

export function parsePagerDutyRoutingKey(raw: string): string | null {
  const key = raw.trim();
  if (!KEY_RE.test(key)) return null;
  return key;
}

export function pagerDutyPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to send PagerDuty alerts.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "PagerDuty alerts are on Team.", status: 403 };
  }
  return null;
}

export function pagerDutyPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return pagerDutyPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function pagerDutySeverity(severity: "info" | "warn" | "critical"): PagerDutySeverity {
  if (severity === "critical") return "critical";
  if (severity === "warn") return "warning";
  return "info";
}

export function pagerDutyTestPayload(accountLogin: string): Record<string, unknown> {
  const login = accountLogin.trim() || "this install";
  return {
    payload: {
      summary: `NoSpoilers delivery test on ${login}. This is not a security incident.`,
      source: "nospoilers",
    },
  };
}

export function pagerDutyAlertPayload(input: {
  title: string;
  body: string;
  kind: string;
  severity: "info" | "warn" | "critical";
}): Record<string, unknown> {
  return {
    event_action: "trigger",
    payload: {
      summary: input.title.replace(/\s+/g, " ").trim().slice(0, 1024) || "NoSpoilers alert",
      severity: pagerDutySeverity(input.severity),
      source: "nospoilers",
      component: input.kind.replace(/\s+/g, " ").trim().slice(0, 64),
      custom_details: {
        kind: input.kind.replace(/\s+/g, " ").trim().slice(0, 64),
        body: input.body.replace(/\s+/g, " ").trim().slice(0, 500),
      },
    },
  };
}

async function postPagerDuty(
  url: string,
  routingKey: string,
  payload: Record<string, unknown>,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const key = parsePagerDutyRoutingKey(routingKey);
  if (!key) {
    return { ok: false, status: 0, error: "PagerDuty routing key is not allowed." };
  }
  const publicHost = await assertPublicWebhookHost(PAGERDUTY_EVENTS_HOST, opts.lookup);
  if (!publicHost) {
    return { ok: false, status: 0, error: "PagerDuty events host resolved to a private address." };
  }
  const fetchImpl = opts.fetch ?? fetch;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, routing_key: key }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `PagerDuty returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "PagerDuty delivery failed.",
    };
  }
}

export async function testPagerDutyDestination(
  routingKey: string,
  accountLogin: string,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  return await postPagerDuty(PAGERDUTY_CHANGE_URL, routingKey, pagerDutyTestPayload(accountLogin), opts);
}

export async function postPagerDutyAlert(
  routingKey: string,
  payload: {
    title: string;
    body: string;
    kind: string;
    severity: "info" | "warn" | "critical";
  },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  return await postPagerDuty(PAGERDUTY_ENQUEUE_URL, routingKey, pagerDutyAlertPayload(payload), opts);
}
