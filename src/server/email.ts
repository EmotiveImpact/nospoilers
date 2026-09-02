import { coverageFrom, type Coverage } from "../coverage.ts";

export const RESEND_API_URL = "https://api.resend.com/emails";
export const EMAIL_NOT_LIVE_ERROR =
  "Email alerts are not live on this host. Set RESEND_API_KEY and RESEND_FROM_EMAIL.";
export const EMAIL_ADDRESS_ERROR =
  "Use one public email address. Local, private, and display-name addresses are not allowed.";

const ADDRESS =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const BLOCKED_LABELS = new Set(["localhost", "local", "internal", "intranet", "invalid"]);

export type ParsedEmail = {
  address: string;
  domain: string;
  redacted: string;
};

export function parseEmailAddress(raw: string): ParsedEmail | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254) return null;
  if (trimmed.includes(" ") || trimmed.includes("<") || trimmed.includes(">")) return null;
  if (!ADDRESS.test(trimmed)) return null;
  const at = trimmed.lastIndexOf("@");
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!local || !domain || local.includes("..") || domain.includes("..")) return null;
  const labels = domain.split(".");
  if (labels.some((label) => BLOCKED_LABELS.has(label))) return null;
  if (labels.some((label) => /^\d+$/.test(label) && labels.length === 4)) return null;
  return {
    address: trimmed,
    domain,
    redacted: `${local[0] ?? "x"}***@${domain}`,
  };
}

export function parseFromEmail(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  const angled = trimmed.match(/^[\w .'-]{1,64}\s<([^>]+)>$/);
  const address = parseEmailAddress(angled ? angled[1] : trimmed);
  if (!address) return null;
  return angled ? `${trimmed.slice(0, trimmed.indexOf("<") + 1)}${address.address}>` : address.address;
}

export function emailPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to keep email alerts.", status: 402 };
  }
  return null;
}

export function emailPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return emailPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function emailTestText(accountLogin: string): string {
  const login = accountLogin.trim() || "this install";
  return `NoSpoilers delivery test on ${login}. This is not a security incident.`;
}

export function emailAlertText(input: { title: string; body: string; kind: string }): {
  subject: string;
  text: string;
} {
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 180);
  const body = input.body.replace(/\s+/g, " ").trim().slice(0, 500);
  const kind = input.kind.replace(/\s+/g, " ").trim().slice(0, 64);
  return {
    subject: title || "NoSpoilers alert",
    text: [title, kind && `Kind: ${kind}`, body].filter(Boolean).join("\n"),
  };
}

export async function postResendEmail(
  input: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    text: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const to = parseEmailAddress(input.to);
  if (!to) {
    return { ok: false, status: 0, error: EMAIL_ADDRESS_ERROR };
  }
  const from = parseFromEmail(input.from);
  if (!input.apiKey.trim() || !from) {
    return { ok: false, status: 503, error: EMAIL_NOT_LIVE_ERROR };
  }
  try {
    const response = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to.address],
        subject: input.subject.slice(0, 200),
        text: input.text.slice(0, 2000),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Resend returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Email delivery failed.",
    };
  }
}
