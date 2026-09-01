import { coverageFrom, type Coverage } from "../coverage.ts";
import { assertPublicWebhookHost, type WebhookHostLookup } from "./siem.ts";

export const JIRA_CLOUD_HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/;
export const JIRA_PROJECT_KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;

export type JiraSite = { host: string };
export type JiraSecret = {
  email: string;
  token: string;
  issueType: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseJiraSite(raw: string): JiraSite | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 200) return null;
  if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("@")) return null;
  let host = trimmed;
  if (trimmed.includes("://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    host = url.hostname.toLowerCase();
  } else if (trimmed.includes("/") || trimmed.includes("?") || trimmed.includes("#")) {
    return null;
  } else if (!host.endsWith(".atlassian.net")) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) return null;
    host = `${host}.atlassian.net`;
  }
  if (!JIRA_CLOUD_HOST_RE.test(host)) return null;
  return { host };
}

export function parseJiraProjectKey(raw: string): string | null {
  const key = raw.trim().toUpperCase();
  return JIRA_PROJECT_KEY_RE.test(key) ? key : null;
}

export function parseJiraEmail(raw: string): string | null {
  const email = raw.trim();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function parseJiraToken(raw: string): string | null {
  const token = raw.trim();
  if (token.length < 8 || token.length > 8192) return null;
  if (/\s/.test(token)) return null;
  return token;
}

export function parseJiraIssueType(raw: string): string {
  const value = raw.trim() || "Task";
  if (value.length > 64 || /[\r\n]/.test(value)) return "Task";
  return value;
}

export function encodeJiraSecret(input: JiraSecret): string {
  return JSON.stringify({
    email: input.email,
    token: input.token,
    issueType: input.issueType,
  });
}

export function decodeJiraSecret(raw: string): JiraSecret | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    const email = typeof rec.email === "string" ? parseJiraEmail(rec.email) : null;
    const token = typeof rec.token === "string" ? parseJiraToken(rec.token) : null;
    if (!email || !token) return null;
    return {
      email,
      token,
      issueType: parseJiraIssueType(typeof rec.issueType === "string" ? rec.issueType : "Task"),
    };
  } catch {
    return null;
  }
}

export function jiraPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to send Jira tickets.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "Jira tickets are on Team.", status: 403 };
  }
  return null;
}

export function jiraPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return jiraPlanDenied(coverageFrom(trialEndsAt, plan));
}

function jiraAdf(text: string): Record<string, unknown> {
  const value = text.replace(/\s+/g, " ").trim().slice(0, 4000) || " ";
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  };
}

export function jiraIssuePayload(input: {
  projectKey: string;
  issueType: string;
  summary: string;
  body: string;
}): Record<string, unknown> {
  const summary = input.summary.replace(/\s+/g, " ").trim().slice(0, 200) || "NoSpoilers alert";
  return {
    fields: {
      project: { key: input.projectKey },
      issuetype: { name: input.issueType },
      summary,
      description: jiraAdf(
        `NoSpoilers Watch alert. This is not an invented incident. ${input.body.replace(/\s+/g, " ").trim().slice(0, 500)}`,
      ),
    },
  };
}

function jiraAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`, "utf8").toString("base64")}`;
}

function jiraApiUrl(host: string, path: string): string | null {
  if (!JIRA_CLOUD_HOST_RE.test(host)) return null;
  if (!path.startsWith("/rest/api/3/") || path.includes("..") || path.includes("//")) return null;
  return `https://${host}${path}`;
}

async function jiraFetch(
  host: string,
  path: string,
  secret: JiraSecret,
  init: { method: "GET" | "POST"; body?: string },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup },
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const url = jiraApiUrl(host, path);
  if (!url) return { ok: false, status: 0, error: "Jira Cloud host is not allowed." };
  const publicHost = await assertPublicWebhookHost(host, opts.lookup);
  if (!publicHost) {
    return { ok: false, status: 0, error: "Jira Cloud host resolved to a private address." };
  }
  const fetchImpl = opts.fetch ?? fetch;
  try {
    const response = await fetchImpl(url, {
      method: init.method,
      redirect: "error",
      headers: {
        authorization: jiraAuthHeader(secret.email, secret.token),
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      ...(init.body ? { body: init.body } : {}),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Jira returned HTTP ${response.status}.`,
      };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Jira delivery failed.",
    };
  }
}

export async function testJiraDestination(
  host: string,
  projectKey: string,
  secret: JiraSecret,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const key = parseJiraProjectKey(projectKey);
  if (!key) return { ok: false, status: 0, error: "Jira project key is not allowed." };
  const me = await jiraFetch(host, "/rest/api/3/myself", secret, { method: "GET" }, opts);
  if (!me.ok) return me;
  return await jiraFetch(host, `/rest/api/3/project/${key}`, secret, { method: "GET" }, opts);
}

export async function postJiraIssue(
  host: string,
  projectKey: string,
  secret: JiraSecret,
  input: { title: string; body: string; kind: string },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null }> {
  const key = parseJiraProjectKey(projectKey);
  if (!key) return { ok: false, status: 0, error: "Jira project key is not allowed." };
  const payload = jiraIssuePayload({
    projectKey: key,
    issueType: secret.issueType,
    summary: input.title,
    body: `${input.kind}: ${input.body}`,
  });
  return await jiraFetch(
    host,
    "/rest/api/3/issue",
    secret,
    { method: "POST", body: JSON.stringify(payload) },
    opts,
  );
}
