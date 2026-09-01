import { lookup as dnsLookup } from "node:dns/promises";
import { coverageFrom, type Coverage } from "../coverage.ts";
import { isBlockedRegistryHost } from "./npm-registry.ts";
import { SLACK_WEBHOOK_HOST } from "./slack.ts";

export type SiemWebhook = {
  url: string;
  host: string;
};

export type WebhookHostLookup = (
  host: string,
) => Promise<Array<{ address: string; family: number }>>;

const HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function ipv4Octets(host: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

export function isPrivateOrReservedIPv4(address: string): boolean {
  const ip = ipv4Octets(address);
  if (!ip) return true;
  const [a, b] = ip;
  if (a === 0 || a === 10 || a === 127 || a === 224 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
  return false;
}

export function isBlockedResolvedAddress(address: string, family: number): boolean {
  if (family === 4) return isPrivateOrReservedIPv4(address);
  const v = address.trim().toLowerCase();
  if (!v) return true;
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80:") || v.startsWith("ff") || v.startsWith("fc") || v.startsWith("fd")) {
    return true;
  }
  if (v.startsWith("::ffff:")) {
    return isPrivateOrReservedIPv4(v.slice("::ffff:".length));
  }
  return false;
}

export function parseSiemWebhook(raw: string): SiemWebhook | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  if (trimmed.includes("..") || trimmed.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253) return null;
  if (host === SLACK_WEBHOOK_HOST) return null;
  if (isBlockedRegistryHost(host)) return null;
  if (!HOST_RE.test(host)) return null;
  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 80) return null;
  }
  if (url.pathname.includes("..") || url.pathname.includes("//") || url.pathname.includes("\\")) {
    return null;
  }
  const port = url.port && url.port !== "443" ? `:${url.port}` : "";
  const path = url.pathname === "/" ? "" : url.pathname;
  const search = url.search;
  return { url: `https://${host}${port}${path}${search}`, host };
}

export function siemPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to send SIEM webhooks.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "SIEM webhooks are on Team.", status: 403 };
  }
  return null;
}

export function siemPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return siemPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function siemTestPayload(accountLogin: string): Record<string, unknown> {
  const login = accountLogin.trim() || "this install";
  return {
    inventedIncident: false,
    source: "nospoilers",
    text: `NoSpoilers delivery test on ${login}. This is not a security incident.`,
  };
}

export function siemAlertPayload(input: { title: string; body: string; kind: string }): Record<string, unknown> {
  return {
    inventedIncident: false,
    source: "nospoilers",
    kind: input.kind.replace(/\s+/g, " ").trim().slice(0, 64),
    title: input.title.replace(/\s+/g, " ").trim().slice(0, 200),
    body: input.body.replace(/\s+/g, " ").trim().slice(0, 500),
  };
}

export async function lookupWebhookHost(host: string): Promise<Array<{ address: string; family: number }>> {
  return await dnsLookup(host, { all: true, verbatim: true });
}

export async function assertPublicWebhookHost(
  host: string,
  lookupFn: WebhookHostLookup = lookupWebhookHost,
): Promise<boolean> {
  if (isBlockedRegistryHost(host) || host === SLACK_WEBHOOK_HOST) return false;
  try {
    const records = await lookupFn(host);
    if (!records.length) return false;
    return records.every((row) => !isBlockedResolvedAddress(row.address, row.family));
  } catch {
    return false;
  }
}

export async function postSiemWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const parsed = parseSiemWebhook(webhookUrl);
  if (!parsed) {
    return { ok: false, status: 0, error: "SIEM webhook host is not allowed." };
  }
  const publicHost = await assertPublicWebhookHost(parsed.host, opts.lookup ?? lookupWebhookHost);
  if (!publicHost) {
    return { ok: false, status: 0, error: "SIEM webhook resolved to a private address." };
  }
  const fetchImpl = opts.fetch ?? fetch;
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
        error: `SIEM webhook returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "SIEM delivery failed.",
    };
  }
}
