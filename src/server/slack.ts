import { coverageFrom, type Coverage } from "../coverage.ts";

export const SLACK_WEBHOOK_HOST = "hooks.slack.com";

export type SlackWebhook = {
  url: string;
  host: typeof SLACK_WEBHOOK_HOST;
};

const PATH = /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+$/;

export function parseSlackWebhook(raw: string): SlackWebhook | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 300) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "443") return null;
  if (url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (host !== SLACK_WEBHOOK_HOST) return null;
  if (!PATH.test(url.pathname)) return null;
  return { url: `https://${SLACK_WEBHOOK_HOST}${url.pathname}`, host: SLACK_WEBHOOK_HOST };
}

export function slackPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to send Slack alerts.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "Slack alerts are on Team.", status: 403 };
  }
  return null;
}

export function slackPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return slackPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function slackTestText(accountLogin: string): string {
  const login = accountLogin.trim() || "this install";
  return `NoSpoilers delivery test on ${login}. This is not a security incident.`;
}

export function slackAlertPayload(input: { title: string; body: string; kind: string }): {
  text: string;
} {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 200);
  const body = input.body.replace(/\s+/g, " ").trim().slice(0, 500);
  const kind = input.kind.replace(/\s+/g, " ").trim().slice(0, 64);
  const text = [title, body && `_${kind}_ ${body}`].filter(Boolean).join("\n");
  return { text };
}

export async function postSlackWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const parsed = parseSlackWebhook(webhookUrl);
  if (!parsed) {
    return { ok: false, status: 0, error: "Slack webhook host is not allowed." };
  }
  try {
    const response = await fetchImpl(parsed.url, {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Slack returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Slack delivery failed.",
    };
  }
}
