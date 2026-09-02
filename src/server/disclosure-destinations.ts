import { typedConfirm } from "./audit.ts";
import {
  buildDisclosureReport,
  DisclosureError,
  type DisclosureReport,
} from "./disclosure.ts";
import {
  decodeJiraSecret,
  encodeJiraSecret,
  parseJiraEmail,
  parseJiraIssueType,
  parseJiraProjectKey,
  parseJiraSite,
  parseJiraToken,
  postJiraIssue,
  testJiraDestination,
  type JiraSecret,
} from "./jira.ts";
import {
  assertPublicWebhookHost,
  parseSiemWebhook,
  postSiemWebhook,
  type WebhookHostLookup,
} from "./siem.ts";
import type { Store } from "./store.ts";

export const DISCLOSURE_DESTINATION_KINDS = ["webhook", "jira"] as const;
export type DisclosureDestinationKind = (typeof DISCLOSURE_DESTINATION_KINDS)[number];

export const DISCLOSURE_DESTINATION_URL_ERROR =
  "Use an HTTPS webhook URL. Private, local, Slack, and credentialed URLs are not allowed.";
export const DISCLOSURE_DESTINATION_JIRA_ERROR =
  "Use a Jira Cloud site, email, API token, and project key. The token is encrypted and never shown again.";
export const DISCLOSURE_DESTINATION_UNKNOWN_ERROR = "Unknown disclosure destination.";
export const DISCLOSURE_NOTIFY_STATE_ERROR =
  "Verify the finding before filing it to a destination.";
export const DISCLOSURE_NOTIFY_MISSING_ERROR = "Choose a saved webhook or Jira destination.";

export type DisclosureDestinationRow = {
  id: number;
  kind: DisclosureDestinationKind;
  host: string;
  project_key: string | null;
  secret_ciphertext: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DisclosureDestinationView = {
  id: number;
  kind: DisclosureDestinationKind;
  host: string;
  projectKey: string | null;
};

export function asDisclosureDestinationKind(value: string): DisclosureDestinationKind {
  if (value === "webhook" || value === "jira") return value;
  throw new DisclosureError(DISCLOSURE_DESTINATION_UNKNOWN_ERROR, 400);
}

export function publicDisclosureDestination(
  row: Pick<DisclosureDestinationRow, "id" | "kind" | "host" | "project_key">,
): DisclosureDestinationView {
  return {
    id: row.id,
    kind: row.kind,
    host: row.host,
    projectKey: row.project_key,
  };
}

export function disclosureDestinationConfirmValue(
  row: Pick<DisclosureDestinationRow, "kind" | "host" | "project_key">,
): string {
  return row.kind === "jira" ? (row.project_key ?? "") : row.host;
}

export function disclosureWebhookTestPayload(): Record<string, unknown> {
  return {
    inventedIncident: false,
    source: "nospoilers-disclosure",
    text: "NoSpoilers Disclosure Desk delivery test. This is not a security incident.",
  };
}

export function disclosureDestinationPayload(report: DisclosureReport): Record<string, unknown> {
  return {
    inventedIncident: false,
    source: "nospoilers-disclosure",
    sent: false,
    notesIncluded: false,
    attachmentBytesIncluded: false,
    coordinate: report.coordinate,
    packageName: report.packageName,
    artifact: {
      name: report.artifact.name,
      version: report.artifact.version,
      sha256: report.artifact.sha256,
    },
    state: report.state,
    fingerprints: report.fingerprints,
    findingCategory: report.findingCategory,
    vendorChannel: report.vendorChannel,
    reviewState: report.reviewState,
    assignee: report.assignee,
  };
}

export async function saveDisclosureWebhook(
  store: Store,
  input: {
    actor: string;
    url: unknown;
    confirm: unknown;
    lookup?: WebhookHostLookup;
  },
): Promise<DisclosureDestinationView> {
  const parsed = parseSiemWebhook(typeof input.url === "string" ? input.url : "");
  if (!parsed) throw new DisclosureError(DISCLOSURE_DESTINATION_URL_ERROR, 400);
  const confirmError = typedConfirm(
    { confirm: typeof input.confirm === "string" ? input.confirm : "" },
    parsed.host,
  );
  if (confirmError) throw new DisclosureError(confirmError.error, 400);
  const publicHost = await assertPublicWebhookHost(parsed.host, input.lookup);
  if (!publicHost) throw new DisclosureError(DISCLOSURE_DESTINATION_URL_ERROR, 400);
  const row = await store.upsertDisclosureDestination({
    kind: "webhook",
    host: parsed.host,
    projectKey: null,
    secret: parsed.url,
    createdBy: input.actor,
  });
  return publicDisclosureDestination(row);
}

export async function saveDisclosureJira(
  store: Store,
  input: {
    actor: string;
    site: unknown;
    email: unknown;
    token: unknown;
    projectKey: unknown;
    issueType?: unknown;
    confirm: unknown;
  },
): Promise<DisclosureDestinationView> {
  const site = parseJiraSite(typeof input.site === "string" ? input.site : "");
  const email = parseJiraEmail(typeof input.email === "string" ? input.email : "");
  const token = parseJiraToken(typeof input.token === "string" ? input.token : "");
  const projectKey = parseJiraProjectKey(
    typeof input.projectKey === "string" ? input.projectKey : "",
  );
  if (!site || !email || !token || !projectKey) {
    throw new DisclosureError(DISCLOSURE_DESTINATION_JIRA_ERROR, 400);
  }
  const confirmError = typedConfirm(
    { confirm: typeof input.confirm === "string" ? input.confirm : "" },
    projectKey,
  );
  if (confirmError) throw new DisclosureError(confirmError.error, 400);
  const secret: JiraSecret = {
    email,
    token,
    issueType: parseJiraIssueType(typeof input.issueType === "string" ? input.issueType : "Task"),
  };
  const row = await store.upsertDisclosureDestination({
    kind: "jira",
    host: site.host,
    projectKey,
    secret: encodeJiraSecret(secret),
    createdBy: input.actor,
  });
  return publicDisclosureDestination(row);
}

export async function testDisclosureDestination(
  store: Store,
  id: number,
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{ ok: boolean; status: number; error: string | null; inventedIncident: false }> {
  const opened = await store.openDisclosureDestination(id);
  if (!opened) throw new DisclosureError(DISCLOSURE_DESTINATION_UNKNOWN_ERROR, 404);
  if (opened.kind === "webhook") {
    const result = await postSiemWebhook(opened.secret, disclosureWebhookTestPayload(), opts);
    return { ...result, inventedIncident: false };
  }
  const secret = decodeJiraSecret(opened.secret);
  if (!secret || !opened.projectKey) {
    throw new DisclosureError(DISCLOSURE_DESTINATION_JIRA_ERROR, 400);
  }
  const result = await testJiraDestination(opened.host, opened.projectKey, secret, opts);
  return { ...result, inventedIncident: false };
}

export async function notifyDisclosureDestination(
  store: Store,
  input: {
    prospectId: number;
    destinationId: number;
    actor: string;
    confirm: unknown;
  },
  opts: { fetch?: typeof fetch; lookup?: WebhookHostLookup } = {},
): Promise<{
  destination: DisclosureDestinationView;
  sent: false;
  inventedIncident: false;
  ok: boolean;
  status: number;
  error: string | null;
}> {
  const report = await buildDisclosureReport(store, input.prospectId);
  if (report.state !== "verified") {
    throw new DisclosureError(DISCLOSURE_NOTIFY_STATE_ERROR, 409);
  }
  const confirmError = typedConfirm(
    { confirm: typeof input.confirm === "string" ? input.confirm : "" },
    report.coordinate,
  );
  if (confirmError) throw new DisclosureError(confirmError.error, 400);
  const opened = await store.openDisclosureDestination(input.destinationId);
  if (!opened) throw new DisclosureError(DISCLOSURE_NOTIFY_MISSING_ERROR, 404);
  const payload = disclosureDestinationPayload(report);
  let result: { ok: boolean; status: number; error: string | null };
  if (opened.kind === "webhook") {
    result = await postSiemWebhook(opened.secret, payload, opts);
  } else {
    const secret = decodeJiraSecret(opened.secret);
    if (!secret || !opened.projectKey) {
      throw new DisclosureError(DISCLOSURE_DESTINATION_JIRA_ERROR, 400);
    }
    result = await postJiraIssue(
      opened.host,
      opened.projectKey,
      secret,
      {
        title: `Disclosure Desk ${report.coordinate}`,
        body: `${report.state}: ${(report.fingerprints ?? []).slice(0, 8).join(" · ") || "verified case"}`,
        kind: "disclosure",
        preface: "NoSpoilers Disclosure Desk redacted case. This is not an invented incident.",
      },
      opts,
    );
  }
  const caseRow = await store.getDisclosureCaseByProspect(input.prospectId);
  if (caseRow) {
    await store.insertDisclosureEvent({
      caseId: caseRow.id,
      actor: input.actor,
      action: "destination.notify",
      summary: result.ok
        ? `Filed a redacted case to ${opened.kind} ${opened.kind === "jira" ? opened.projectKey : opened.host}.`
        : `Filing a redacted case to ${opened.kind} failed.`,
    });
  }
  return {
    destination: publicDisclosureDestination({
      id: opened.id,
      kind: opened.kind,
      host: opened.host,
      project_key: opened.projectKey,
    }),
    sent: false,
    inventedIncident: false,
    ok: result.ok,
    status: result.status,
    error: result.error,
  };
}
