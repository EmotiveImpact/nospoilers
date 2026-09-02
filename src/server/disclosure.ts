import { findingFingerprint } from "../receipt.ts";
import type { Finding } from "../scanner/types.ts";
import { notifyDeadlineMissed, notifyVerifiedCritical } from "./internal-notify.ts";
import { isBlockedRegistryHost } from "./npm-registry.ts";
import type { ProspectRow, Store } from "./store.ts";

export const DISCLOSURE_STATES = [
  "signal",
  "verifying",
  "verified",
  "false_positive",
  "duplicate",
] as const;

export type DisclosureState = (typeof DISCLOSURE_STATES)[number];

export const DISCLOSURE_CONVERSIONS = ["none", "trial", "paid", "declined"] as const;
export type DisclosureConversion = (typeof DISCLOSURE_CONVERSIONS)[number];

export const CHECKLIST_KEYS = [
  "public_artifact",
  "reproduced",
  "fingerprints_recorded",
  "no_secret_values",
  "contact_or_policy",
] as const;

export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export type DisclosureChecklist = Record<ChecklistKey, boolean>;

export const DEFAULT_NOTES_TTL_DAYS = 90;
export const MAX_NOTES_TTL_DAYS = 365;
export const MAX_NOTES_CHARS = 8000;
export const ACK_NOTE_MIN = 8;
export const ACK_NOTE_MAX = 2000;

export const DISCLOSURE_CONTACTED_ERROR =
  "Verify the finding on Disclosure Desk before recording outreach.";
export const DISCLOSURE_FIXED_ERROR =
  "Record a fix version and run a rescan before closing as fixed.";
export const DISCLOSURE_DUPLICATE_ERROR = "Possible duplicate case.";
export const DISCLOSURE_EXISTS_ERROR = "A case already exists for this artifact.";
export const DISCLOSURE_VERIFIED_ERROR =
  "Complete every verification check before marking verified.";
export const DISCLOSURE_CHECK_CONTACT_ERROR =
  "Record a security contact or https policy URL before that check.";
export const DISCLOSURE_CHECK_FINGERPRINT_ERROR =
  "Record finding fingerprints before that check.";
export const DISCLOSURE_SENT_ERROR = "Disclosure Desk never sends disclosure messages.";
export const DISCLOSURE_DNC_ERROR =
  "Do-not-contact is in force for this vendor. Outreach is blocked.";
export const DISCLOSURE_DNC_CREATE_ERROR =
  "Do-not-contact is in force. Open a research-only case, or remove the entry.";
export const DISCLOSURE_DNC_EXISTS_ERROR = "A matching do-not-contact entry already exists.";
export const DISCLOSURE_TEMPLATE_ERROR = "Template name, subject, and body are required.";

export const VENDOR_CHANNELS = ["security_email", "form", "security_txt", "platform"] as const;
export type VendorChannel = (typeof VENDOR_CHANNELS)[number];

export const DNC_MATCH_REASONS = ["owner_repo", "package", "contact"] as const;
export type DncReason = (typeof DNC_MATCH_REASONS)[number];

export const MAX_TEMPLATE_NAME = 80;
export const MAX_TEMPLATE_SUBJECT = 200;
export const MAX_TEMPLATE_BODY = 8000;
export const MAX_OUTCOME_CREDIT = 200;
export const MAX_OUTCOME_CVE = 40;
export const MAX_OUTCOME_NOTES = 2000;
export const MAX_DNC_REASON = 200;

export type DuplicateReason = "owner_repo" | "package" | "fingerprint";

export type DuplicateMatch = {
  caseId: number;
  prospectId: number;
  owner: string;
  repo: string;
  packageName: string | null;
  state: DisclosureState;
  reasons: DuplicateReason[];
};

export type DisclosureCaseRow = {
  id: number;
  prospect_id: number;
  state: DisclosureState;
  checklist_public_artifact: boolean;
  checklist_reproduced: boolean;
  checklist_fingerprints_recorded: boolean;
  checklist_no_secret_values: boolean;
  checklist_contact_or_policy: boolean;
  fingerprints: string[];
  security_contact: string | null;
  policy_url: string | null;
  notes_ciphertext: string | null;
  notes_expires_at: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_sent: boolean;
  acknowledgement_note: string | null;
  acknowledged_at: string | null;
  deadline_at: string | null;
  conversion: DisclosureConversion;
  fix_version: string | null;
  last_rescan_at: string | null;
  vendor_channel: VendorChannel | null;
  outcome_credit: string | null;
  outcome_cve: string | null;
  outcome_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DisclosureTemplateRow = {
  id: number;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type DoNotContactRow = {
  id: number;
  owner: string | null;
  repo: string | null;
  package_name: string | null;
  contact: string | null;
  reason: string;
  created_by: string;
  created_at: string;
};

export type DncMatch = {
  id: number;
  reasons: DncReason[];
  owner: string | null;
  repo: string | null;
  packageName: string | null;
  contact: string | null;
  reason: string;
};

export type DisclosureEventRow = {
  id: number;
  case_id: number;
  action: string;
  actor: string;
  summary: string;
  created_at: string;
};

export type DisclosureCaseView = {
  id: number;
  prospectId: number;
  state: DisclosureState;
  checklist: DisclosureChecklist;
  fingerprints: string[];
  securityContact: string | null;
  policyUrl: string | null;
  notes: string | null;
  notesExpired: boolean;
  notesExpiresAt: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  sent: false;
  acknowledgementNote: string | null;
  acknowledgedAt: string | null;
  deadlineAt: string | null;
  deadlineMissed: boolean;
  conversion: DisclosureConversion;
  fixVersion: string | null;
  lastRescanAt: string | null;
  vendorChannel: VendorChannel | null;
  outcomeCredit: string | null;
  outcomeCve: string | null;
  outcomeNotes: string | null;
  createdAt: string;
  updatedAt: string;
  events: DisclosureEventView[];
};

export type DisclosureEventView = {
  id: number;
  action: string;
  actor: string;
  summary: string;
  createdAt: string;
};

export type DisclosureCaseSummary = {
  id: number;
  prospectId: number;
  state: DisclosureState;
  conversion: DisclosureConversion;
  deadlineMissed: boolean;
  acknowledgedAt: string | null;
  fixVersion: string | null;
  lastRescanAt: string | null;
  fingerprintCount: number;
  vendorChannel: VendorChannel | null;
};

export class DisclosureError extends Error {
  status: 400 | 404 | 409;
  duplicates?: DuplicateMatch[];
  dnc?: DncMatch[];

  constructor(
    message: string,
    status: 400 | 404 | 409,
    duplicates?: DuplicateMatch[],
    dnc?: DncMatch[],
  ) {
    super(message);
    this.name = "DisclosureError";
    this.status = status;
    this.duplicates = duplicates;
    this.dnc = dnc;
  }
}

export function emptyChecklist(): DisclosureChecklist {
  return {
    public_artifact: false,
    reproduced: false,
    fingerprints_recorded: false,
    no_secret_values: false,
    contact_or_policy: false,
  };
}

export function checklistFromRow(row: DisclosureCaseRow): DisclosureChecklist {
  return {
    public_artifact: Boolean(row.checklist_public_artifact),
    reproduced: Boolean(row.checklist_reproduced),
    fingerprints_recorded: Boolean(row.checklist_fingerprints_recorded),
    no_secret_values: Boolean(row.checklist_no_secret_values),
    contact_or_policy: Boolean(row.checklist_contact_or_policy),
  };
}

export function checklistComplete(checklist: DisclosureChecklist): boolean {
  return CHECKLIST_KEYS.every((key) => checklist[key]);
}

export function checklistStarted(checklist: DisclosureChecklist): boolean {
  return CHECKLIST_KEYS.some((key) => checklist[key]);
}

export function fingerprintsFromFindings(findings: unknown): string[] {
  if (!Array.isArray(findings)) return [];
  const out = new Set<string>();
  for (const raw of findings) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<Finding>;
    if (
      typeof row.rule !== "string" ||
      typeof row.severity !== "string" ||
      typeof row.path !== "string" ||
      typeof row.title !== "string"
    ) {
      continue;
    }
    out.add(
      findingFingerprint({
        rule: row.rule,
        severity: row.severity as Finding["severity"],
        path: row.path,
        title: row.title,
        detail: "",
      }),
    );
  }
  return [...out].sort();
}

export function parseDisclosureState(raw: unknown): DisclosureState {
  if (typeof raw === "string" && (DISCLOSURE_STATES as readonly string[]).includes(raw)) {
    return raw as DisclosureState;
  }
  throw new DisclosureError("State must be signal, verifying, verified, false_positive, or duplicate.", 400);
}

export function parseConversion(raw: unknown): DisclosureConversion {
  if (typeof raw === "string" && (DISCLOSURE_CONVERSIONS as readonly string[]).includes(raw)) {
    return raw as DisclosureConversion;
  }
  throw new DisclosureError("Conversion must be none, trial, paid, or declined.", 400);
}

export function parseVendorChannel(raw: unknown): VendorChannel | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string" && (VENDOR_CHANNELS as readonly string[]).includes(raw)) {
    return raw as VendorChannel;
  }
  throw new DisclosureError(
    "Vendor channel must be security_email, form, security_txt, or platform.",
    400,
  );
}

export function parseOutcomeCredit(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new DisclosureError("Credit must be text.", 400);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_OUTCOME_CREDIT) {
    throw new DisclosureError(`Credit must be at most ${MAX_OUTCOME_CREDIT} characters.`, 400);
  }
  return trimmed;
}

export function parseOutcomeCve(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new DisclosureError("CVE must be text.", 400);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_OUTCOME_CVE) {
    throw new DisclosureError(`CVE must be at most ${MAX_OUTCOME_CVE} characters.`, 400);
  }
  return trimmed;
}

export function parseOutcomeNotes(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new DisclosureError("Outcome notes must be text.", 400);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_OUTCOME_NOTES) {
    throw new DisclosureError(`Outcome notes must be at most ${MAX_OUTCOME_NOTES} characters.`, 400);
  }
  return trimmed;
}

function optionalText(raw: unknown, label: string, max: number): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") throw new DisclosureError(`${label} must be text.`, 400);
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new DisclosureError(`${label} must be at most ${max} characters.`, 400);
  }
  return trimmed;
}

export function parseDoNotContactInput(input: {
  owner?: unknown;
  repo?: unknown;
  packageName?: unknown;
  contact?: unknown;
  reason?: unknown;
}): {
  owner: string | null;
  repo: string | null;
  packageName: string | null;
  contact: string | null;
  reason: string;
} {
  const owner = optionalText(input.owner, "Owner", 100);
  const repo = optionalText(input.repo, "Repository", 100);
  const packageName = optionalText(input.packageName, "Package name", 214);
  const contact = optionalText(input.contact, "Contact", 200);
  const reason = optionalText(input.reason, "Reason", MAX_DNC_REASON);
  if (!reason || reason.length < 3) {
    throw new DisclosureError("Reason must be 3 to 200 characters.", 400);
  }
  if ((owner && !repo) || (repo && !owner)) {
    throw new DisclosureError("Do-not-contact owner and repository must be set together.", 400);
  }
  if (!owner && !packageName && !contact) {
    throw new DisclosureError("Provide owner/repository, a package name, or a contact.", 400);
  }
  return { owner, repo, packageName, contact, reason };
}

export function parseTemplateName(raw: unknown): string {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_TEMPLATE_ERROR, 400);
  const name = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(name) || name.length > MAX_TEMPLATE_NAME) {
    throw new DisclosureError("Template name must be 2–80 letters, numbers, _ or -.", 400);
  }
  return name;
}

export function parseTemplateSubject(raw: unknown): string {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_TEMPLATE_ERROR, 400);
  const subject = raw.trim();
  if (subject.length < 3 || subject.length > MAX_TEMPLATE_SUBJECT) {
    throw new DisclosureError(`Subject must be 3 to ${MAX_TEMPLATE_SUBJECT} characters.`, 400);
  }
  return subject;
}

export function parseTemplateBody(raw: unknown): string {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_TEMPLATE_ERROR, 400);
  const body = raw.trim();
  if (body.length < 20 || body.length > MAX_TEMPLATE_BODY) {
    throw new DisclosureError(`Body must be 20 to ${MAX_TEMPLATE_BODY} characters.`, 400);
  }
  return body;
}

export function applyDisclosureTemplate(
  template: Pick<DisclosureTemplateRow, "subject" | "body">,
  vars: { coordinate: string; package: string; fingerprints: string; channel: string },
): { subject: string; body: string; sent: false } {
  const replace = (text: string) =>
    text
      .replaceAll("{{coordinate}}", vars.coordinate)
      .replaceAll("{{package}}", vars.package)
      .replaceAll("{{fingerprints}}", vars.fingerprints)
      .replaceAll("{{channel}}", vars.channel);
  return {
    subject: replace(template.subject).slice(0, MAX_TEMPLATE_SUBJECT),
    body: replace(template.body).slice(0, MAX_TEMPLATE_BODY),
    sent: false,
  };
}

export function templateVars(
  prospect: Pick<ProspectRow, "owner" | "repo" | "package_name" | "artifact_name" | "release_tag">,
  fingerprints: string[],
  channel: VendorChannel | null,
): { coordinate: string; package: string; fingerprints: string; channel: string } {
  const pack = prospect.package_name ?? prospect.artifact_name;
  const version = prospect.release_tag ? ` ${prospect.release_tag}` : "";
  const lines = fingerprints.slice(0, 20).map((fp) => `- ${fp}`);
  return {
    coordinate: `${prospect.owner}/${prospect.repo}`,
    package: `${pack}${version}`,
    fingerprints: lines.length > 0 ? lines.join("\n") : "(none recorded)",
    channel: channel ?? "unspecified",
  };
}

export function previewRecipients(
  channel: VendorChannel | null,
  securityContact: string | null,
  policyUrl: string | null,
): string[] {
  if (channel === "security_email" && securityContact) return [securityContact];
  if ((channel === "form" || channel === "security_txt" || channel === "platform") && policyUrl) {
    return [policyUrl];
  }
  if (securityContact) return [securityContact];
  if (policyUrl) return [policyUrl];
  return [];
}

export function matchDoNotContact(
  entries: DoNotContactRow[],
  incoming: {
    owner: string;
    repo: string;
    packageName: string | null;
    securityContact: string | null;
  },
): DncMatch[] {
  const matches: DncMatch[] = [];
  for (const entry of entries) {
    const reasons: DncReason[] = [];
    if (
      entry.owner &&
      entry.repo &&
      entry.owner.toLowerCase() === incoming.owner.toLowerCase() &&
      entry.repo.toLowerCase() === incoming.repo.toLowerCase()
    ) {
      reasons.push("owner_repo");
    }
    const left = entry.package_name?.trim().toLowerCase() ?? "";
    const right = incoming.packageName?.trim().toLowerCase() ?? "";
    if (left && right && left === right) reasons.push("package");
    const contact = entry.contact?.trim().toLowerCase() ?? "";
    const recorded = incoming.securityContact?.trim().toLowerCase() ?? "";
    if (contact && recorded && contact === recorded) reasons.push("contact");
    if (reasons.length === 0) continue;
    matches.push({
      id: entry.id,
      reasons,
      owner: entry.owner,
      repo: entry.repo,
      packageName: entry.package_name,
      contact: entry.contact,
      reason: entry.reason,
    });
  }
  return matches;
}

export function toTemplateView(row: DisclosureTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDncView(row: DoNotContactRow) {
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    packageName: row.package_name,
    contact: row.contact,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function parseSecurityContact(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new DisclosureError("Security contact must be text.", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length < 3 || trimmed.length > 200) {
    throw new DisclosureError("Security contact must be 3 to 200 characters.", 400);
  }
  return trimmed;
}

export function parsePolicyUrl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new DisclosureError("Policy URL must be an https URL.", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DisclosureError("Policy URL must be an https URL.", 400);
  }
  if (url.protocol !== "https:") {
    throw new DisclosureError("Policy URL must be https. It is stored, never fetched.", 400);
  }
  if (url.username || url.password) {
    throw new DisclosureError("Policy URL must not include credentials.", 400);
  }
  const host = url.hostname.toLowerCase();
  if (!host || isBlockedRegistryHost(host)) {
    throw new DisclosureError("Policy URL host is not allowed.", 400);
  }
  const port = url.port && url.port !== "443" ? `:${url.port}` : "";
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  if (path.includes("..") || path.includes("//") || path.includes("\\")) {
    throw new DisclosureError("Policy URL path is not allowed.", 400);
  }
  return `https://${host}${port}${path}`;
}

export function parseFixVersion(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || value.length > 80) {
    throw new DisclosureError("Provide the fixed version (at most 80 characters).", 400);
  }
  return value;
}

export function parseDeadlineAt(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new DisclosureError("Deadline must be an ISO timestamp.", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new DisclosureError("Deadline must be an ISO timestamp.", 400);
  }
  return new Date(ms).toISOString();
}

export function parseOperatorNotes(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DisclosureError("Notes must be text.", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_NOTES_CHARS) {
    throw new DisclosureError(`Notes must be at most ${MAX_NOTES_CHARS} characters.`, 400);
  }
  return trimmed;
}

export function parseNotesTtlDays(raw: unknown): number {
  if (raw == null || raw === "") return DEFAULT_NOTES_TTL_DAYS;
  const days = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > MAX_NOTES_TTL_DAYS) {
    throw new DisclosureError(`Notes expiry must be 1 to ${MAX_NOTES_TTL_DAYS} days.`, 400);
  }
  return days;
}

export function parseAckNote(raw: unknown): string {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note.length < ACK_NOTE_MIN || note.length > ACK_NOTE_MAX) {
    throw new DisclosureError(
      `Acknowledgement note must be ${ACK_NOTE_MIN} to ${ACK_NOTE_MAX} characters.`,
      400,
    );
  }
  return note;
}

export function deadlineMissed(
  deadlineAt: string | null,
  acknowledgedAt: string | null,
  now = Date.now(),
): boolean {
  if (!deadlineAt || acknowledgedAt) return false;
  const ms = Date.parse(deadlineAt);
  return Number.isFinite(ms) && ms < now;
}

export function resolveDisclosureState(input: {
  current: DisclosureState;
  checklist: DisclosureChecklist;
  explicit?: DisclosureState;
}): DisclosureState {
  if (input.explicit === "false_positive" || input.explicit === "duplicate") {
    return input.explicit;
  }
  if (input.explicit === "verified" || (!input.explicit && checklistComplete(input.checklist))) {
    if (!checklistComplete(input.checklist)) {
      throw new DisclosureError(DISCLOSURE_VERIFIED_ERROR, 400);
    }
    return "verified";
  }
  if (input.explicit === "signal") return "signal";
  if (input.explicit === "verifying" || checklistStarted(input.checklist)) return "verifying";
  return input.current;
}

export function assertChecklistAllowed(
  checklist: DisclosureChecklist,
  fingerprints: string[],
  securityContact: string | null,
  policyUrl: string | null,
): void {
  if (checklist.fingerprints_recorded && fingerprints.length === 0) {
    throw new DisclosureError(DISCLOSURE_CHECK_FINGERPRINT_ERROR, 400);
  }
  if (checklist.contact_or_policy && !securityContact && !policyUrl) {
    throw new DisclosureError(DISCLOSURE_CHECK_CONTACT_ERROR, 400);
  }
}

export function matchDuplicateReasons(
  candidate: {
    owner: string;
    repo: string;
    packageName: string | null;
    fingerprints: string[];
  },
  incoming: {
    owner: string;
    repo: string;
    packageName: string | null;
    fingerprints: string[];
  },
): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  if (
    candidate.owner.toLowerCase() === incoming.owner.toLowerCase() &&
    candidate.repo.toLowerCase() === incoming.repo.toLowerCase()
  ) {
    reasons.push("owner_repo");
  }
  const left = candidate.packageName?.trim().toLowerCase() ?? "";
  const right = incoming.packageName?.trim().toLowerCase() ?? "";
  if (left && right && left === right) reasons.push("package");
  const theirs = new Set(candidate.fingerprints);
  if (incoming.fingerprints.some((fp) => theirs.has(fp))) reasons.push("fingerprint");
  return reasons;
}

export function previewDisclosureDraft(
  prospect: Pick<
    ProspectRow,
    "owner" | "repo" | "package_name" | "artifact_name" | "release_tag" | "source"
  >,
  fingerprints: string[],
): { subject: string; body: string; sent: false } {
  const coordinate = `${prospect.owner}/${prospect.repo}`;
  const pack = prospect.package_name ?? prospect.artifact_name;
  const version = prospect.release_tag ? ` ${prospect.release_tag}` : "";
  const lines = fingerprints.slice(0, 20).map((fp) => `- ${fp}`);
  const body = [
    "This is a private coordinated disclosure. Nothing has been sent or published.",
    "",
    `Target: ${coordinate}`,
    `Artifact: ${pack}${version}`,
    `Source: ${prospect.source}`,
    "",
    "Finding fingerprints (rule|severity|path|title):",
    ...(lines.length > 0 ? lines : ["(none recorded)"]),
    "",
    "Please acknowledge and tell us the fixed version. We will not name this publicly.",
  ].join("\n");
  return {
    subject: `Coordinated disclosure: public artifact findings in ${coordinate}`,
    body,
    sent: false,
  };
}

export function toDisclosureView(
  row: DisclosureCaseRow,
  notes: { notes: string | null; notesExpired: boolean },
  events: DisclosureEventRow[] = [],
): DisclosureCaseView {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    state: row.state,
    checklist: checklistFromRow(row),
    fingerprints: row.fingerprints,
    securityContact: row.security_contact,
    policyUrl: row.policy_url,
    notes: notes.notes,
    notesExpired: notes.notesExpired,
    notesExpiresAt: row.notes_expires_at,
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
    sent: false,
    acknowledgementNote: row.acknowledgement_note,
    acknowledgedAt: row.acknowledged_at,
    deadlineAt: row.deadline_at,
    deadlineMissed: deadlineMissed(row.deadline_at, row.acknowledged_at),
    conversion: row.conversion,
    fixVersion: row.fix_version,
    lastRescanAt: row.last_rescan_at,
    vendorChannel: row.vendor_channel,
    outcomeCredit: row.outcome_credit,
    outcomeCve: row.outcome_cve,
    outcomeNotes: row.outcome_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      actor: event.actor,
      summary: event.summary,
      createdAt: event.created_at,
    })),
  };
}

export function toDisclosureSummary(row: DisclosureCaseRow): DisclosureCaseSummary {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    state: row.state,
    conversion: row.conversion,
    deadlineMissed: deadlineMissed(row.deadline_at, row.acknowledged_at),
    acknowledgedAt: row.acknowledged_at,
    fixVersion: row.fix_version,
    lastRescanAt: row.last_rescan_at,
    fingerprintCount: row.fingerprints.length,
    vendorChannel: row.vendor_channel,
  };
}

export function outreachBlocked(
  status: "new" | "contacted" | "fixed" | "ignored",
  desk: DisclosureCaseRow | null,
): string | null {
  if (status === "contacted" && desk?.state !== "verified") {
    return DISCLOSURE_CONTACTED_ERROR;
  }
  if (status === "fixed" && (!desk?.fix_version || !desk.last_rescan_at)) {
    return DISCLOSURE_FIXED_ERROR;
  }
  return null;
}

function requireProspect(store: Store, prospectId: number): Promise<ProspectRow | null> {
  return store.getProspect(prospectId);
}

export async function findDuplicateMatches(
  store: Store,
  incoming: {
    prospectId: number;
    owner: string;
    repo: string;
    packageName: string | null;
    fingerprints: string[];
  },
): Promise<DuplicateMatch[]> {
  const others = await store.listOtherDisclosureCases(incoming.prospectId);
  const matches: DuplicateMatch[] = [];
  for (const row of others) {
    const reasons = matchDuplicateReasons(
      {
        owner: row.owner,
        repo: row.repo,
        packageName: row.package_name,
        fingerprints: row.fingerprints,
      },
      incoming,
    );
    if (reasons.length === 0) continue;
    matches.push({
      caseId: row.id,
      prospectId: row.prospect_id,
      owner: row.owner,
      repo: row.repo,
      packageName: row.package_name,
      state: row.state,
      reasons,
    });
  }
  return matches;
}

export async function findDncMatches(
  store: Store,
  incoming: {
    owner: string;
    repo: string;
    packageName: string | null;
    securityContact: string | null;
  },
): Promise<DncMatch[]> {
  return matchDoNotContact(await store.listDoNotContact(), incoming);
}

export async function loadDisclosureCase(
  store: Store,
  prospectId: number,
): Promise<DisclosureCaseView> {
  const row = await store.getDisclosureCaseByProspect(prospectId);
  if (!row) throw new DisclosureError("No disclosure case yet.", 404);
  const prospect = await requireProspect(store, prospectId);
  if (prospect) {
    await notifyDeadlineMissed(store, { row, prospect });
  }
  return await loadedView(store, row);
}

export async function createDisclosureCase(
  store: Store,
  input: {
    prospectId: number;
    actor: string;
    confirmDuplicate?: boolean;
    researchOnly?: boolean;
  },
): Promise<DisclosureCaseView> {
  const prospect = await requireProspect(store, input.prospectId);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  const existing = await store.getDisclosureCaseByProspect(input.prospectId);
  if (existing) throw new DisclosureError(DISCLOSURE_EXISTS_ERROR, 409);
  const fingerprints = fingerprintsFromFindings(prospect.findings);
  const dnc = await findDncMatches(store, {
    owner: prospect.owner,
    repo: prospect.repo,
    packageName: prospect.package_name,
    securityContact: null,
  });
  if (dnc.length > 0 && !input.researchOnly) {
    throw new DisclosureError(DISCLOSURE_DNC_CREATE_ERROR, 409, undefined, dnc);
  }
  const duplicates = await findDuplicateMatches(store, {
    prospectId: prospect.id,
    owner: prospect.owner,
    repo: prospect.repo,
    packageName: prospect.package_name,
    fingerprints,
  });
  if (duplicates.length > 0 && !input.confirmDuplicate) {
    throw new DisclosureError(DISCLOSURE_DUPLICATE_ERROR, 409, duplicates);
  }
  const row = await store.insertDisclosureCase({
    prospectId: prospect.id,
    fingerprints,
    actor: input.actor,
    summary:
      dnc.length > 0
        ? "Opened a private research-only signal despite do-not-contact."
        : duplicates.length > 0
          ? "Opened a private signal after confirming a possible duplicate."
          : "Opened a private signal.",
  });
  return await loadedView(store, row);
}

async function loadedView(store: Store, row: DisclosureCaseRow): Promise<DisclosureCaseView> {
  const events = await store.listDisclosureEvents(row.id);
  return toDisclosureView(row, store.readDisclosureNotes(row), events);
}

export async function updateDisclosureCase(
  store: Store,
  input: {
    prospectId: number;
    actor: string;
    checklist?: Partial<DisclosureChecklist>;
    state?: unknown;
    securityContact?: unknown;
    policyUrl?: unknown;
    notes?: unknown;
    notesExpiresInDays?: unknown;
    draftSubject?: unknown;
    draftBody?: unknown;
    sent?: unknown;
    deadlineAt?: unknown;
    conversion?: unknown;
    fixVersion?: unknown;
    vendorChannel?: unknown;
    outcomeCredit?: unknown;
    outcomeCve?: unknown;
    outcomeNotes?: unknown;
  },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  if (input.sent === true) {
    throw new DisclosureError(DISCLOSURE_SENT_ERROR, 400);
  }
  const checklist = { ...checklistFromRow(current), ...input.checklist };
  const securityContact =
    input.securityContact !== undefined
      ? parseSecurityContact(input.securityContact)
      : current.security_contact;
  const policyUrl =
    input.policyUrl !== undefined ? parsePolicyUrl(input.policyUrl) : current.policy_url;
  assertChecklistAllowed(checklist, current.fingerprints, securityContact, policyUrl);
  const explicit = input.state !== undefined ? parseDisclosureState(input.state) : undefined;
  const state = resolveDisclosureState({ current: current.state, checklist, explicit });
  const notes = parseOperatorNotes(input.notes);
  const conversion =
    input.conversion !== undefined ? parseConversion(input.conversion) : current.conversion;
  const deadlineAt =
    input.deadlineAt !== undefined ? parseDeadlineAt(input.deadlineAt) : current.deadline_at;
  const fixVersion =
    input.fixVersion !== undefined
      ? input.fixVersion === null || input.fixVersion === ""
        ? null
        : parseFixVersion(input.fixVersion)
      : current.fix_version;
  const vendorChannel =
    input.vendorChannel !== undefined
      ? parseVendorChannel(input.vendorChannel)
      : current.vendor_channel;
  const outcomeCredit =
    input.outcomeCredit !== undefined
      ? parseOutcomeCredit(input.outcomeCredit)
      : current.outcome_credit;
  const outcomeCve =
    input.outcomeCve !== undefined ? parseOutcomeCve(input.outcomeCve) : current.outcome_cve;
  const outcomeNotes =
    input.outcomeNotes !== undefined
      ? parseOutcomeNotes(input.outcomeNotes)
      : current.outcome_notes;
  const draftSubject =
    typeof input.draftSubject === "string" ? input.draftSubject.trim().slice(0, 200) : current.draft_subject;
  const draftBody =
    typeof input.draftBody === "string" ? input.draftBody.trim().slice(0, 8000) : current.draft_body;
  const row = await store.updateDisclosureCase({
    prospectId: input.prospectId,
    actor: input.actor,
    state,
    checklist,
    securityContact,
    policyUrl,
    notes,
    notesExpiresInDays: notes === undefined ? undefined : parseNotesTtlDays(input.notesExpiresInDays),
    draftSubject,
    draftBody,
    deadlineAt,
    conversion,
    fixVersion,
    vendorChannel,
    outcomeCredit,
    outcomeCve,
    outcomeNotes,
    summary: summarizeUpdate(current, {
      state,
      checklist,
      securityContact,
      policyUrl,
      notes,
      deadlineAt,
      conversion,
      vendorChannel,
      outcomeCredit,
      outcomeCve,
      outcomeNotes,
    }),
  });
  const prospect = await requireProspect(store, input.prospectId);
  if (prospect) {
    await notifyVerifiedCritical(store, {
      previousState: current.state,
      row,
      prospect,
    });
    await notifyDeadlineMissed(store, { row, prospect });
  }
  return await loadedView(store, row);
}

function summarizeUpdate(
  current: DisclosureCaseRow,
  next: {
    state: DisclosureState;
    checklist: DisclosureChecklist;
    securityContact: string | null;
    policyUrl: string | null;
    notes: string | null | undefined;
    deadlineAt: string | null;
    conversion: DisclosureConversion;
    vendorChannel: VendorChannel | null;
    outcomeCredit: string | null;
    outcomeCve: string | null;
    outcomeNotes: string | null;
  },
): string {
  if (next.state !== current.state) return `Set case state to ${next.state}.`;
  if (next.notes !== undefined) return "Stored encrypted operator notes.";
  if (
    next.securityContact !== current.security_contact ||
    next.policyUrl !== current.policy_url
  ) {
    return "Recorded security contact or policy URL.";
  }
  if (next.deadlineAt !== current.deadline_at) return "Set an internal disclosure deadline.";
  if (next.conversion !== current.conversion) {
    return `Recorded conversion attribution (${next.conversion}).`;
  }
  if (next.vendorChannel !== current.vendor_channel) {
    return `Recorded preferred vendor channel (${next.vendorChannel ?? "unset"}).`;
  }
  if (
    next.outcomeCredit !== current.outcome_credit ||
    next.outcomeCve !== current.outcome_cve ||
    next.outcomeNotes !== current.outcome_notes
  ) {
    return "Recorded disclosure outcome fields.";
  }
  const before = checklistFromRow(current);
  if (CHECKLIST_KEYS.some((key) => before[key] !== next.checklist[key])) {
    return "Updated verification checklist.";
  }
  return "Updated the disclosure case.";
}

export type DisclosurePreview = {
  subject: string;
  body: string;
  sent: false;
  channel: VendorChannel | null;
  recipients: string[];
  fingerprints: string[];
  templateId: number | null;
  case: DisclosureCaseView;
};

export async function previewDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; templateId?: unknown },
): Promise<DisclosurePreview> {
  const prospect = await requireProspect(store, input.prospectId);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  let templateId: number | null = null;
  let draft: { subject: string; body: string; sent: false };
  if (input.templateId != null && input.templateId !== "") {
    const id = typeof input.templateId === "number" ? input.templateId : Number(input.templateId);
    if (!Number.isFinite(id) || id <= 0) {
      throw new DisclosureError("Provide a template id.", 400);
    }
    const template = await store.getDisclosureTemplate(id);
    if (!template) throw new DisclosureError("Template not found.", 404);
    templateId = template.id;
    draft = applyDisclosureTemplate(
      template,
      templateVars(prospect, current.fingerprints, current.vendor_channel),
    );
  } else {
    draft = previewDisclosureDraft(prospect, current.fingerprints);
  }
  const row = await store.updateDisclosureCase({
    prospectId: input.prospectId,
    actor: input.actor,
    state: current.state,
    checklist: checklistFromRow(current),
    securityContact: current.security_contact,
    policyUrl: current.policy_url,
    draftSubject: draft.subject,
    draftBody: draft.body,
    deadlineAt: current.deadline_at,
    conversion: current.conversion,
    fixVersion: current.fix_version,
    vendorChannel: current.vendor_channel,
    outcomeCredit: current.outcome_credit,
    outcomeCve: current.outcome_cve,
    outcomeNotes: current.outcome_notes,
    summary: templateId
      ? `Previewed disclosure template ${templateId} (not sent).`
      : "Previewed disclosure draft (not sent).",
  });
  return {
    ...draft,
    sent: false,
    channel: current.vendor_channel,
    recipients: previewRecipients(
      current.vendor_channel,
      current.security_contact,
      current.policy_url,
    ),
    fingerprints: current.fingerprints,
    templateId,
    case: await loadedView(store, row),
  };
}

export async function createDisclosureTemplate(
  store: Store,
  input: { actor: string; name: unknown; subject: unknown; body: unknown },
) {
  const name = parseTemplateName(input.name);
  const subject = parseTemplateSubject(input.subject);
  const body = parseTemplateBody(input.body);
  try {
    return toTemplateView(await store.insertDisclosureTemplate({ name, subject, body }));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DisclosureError("A template with that name already exists.", 409);
    }
    throw error;
  }
}

export async function updateDisclosureTemplate(
  store: Store,
  input: { id: number; subject: unknown; body: unknown },
) {
  const existing = await store.getDisclosureTemplate(input.id);
  if (!existing) throw new DisclosureError("Template not found.", 404);
  const subject = parseTemplateSubject(input.subject);
  const body = parseTemplateBody(input.body);
  const row = await store.updateDisclosureTemplate({ id: input.id, subject, body });
  if (!row) throw new DisclosureError("Template not found.", 404);
  return toTemplateView(row);
}

export async function createDoNotContactEntry(
  store: Store,
  input: {
    actor: string;
    owner?: unknown;
    repo?: unknown;
    packageName?: unknown;
    contact?: unknown;
    reason?: unknown;
  },
) {
  const parsed = parseDoNotContactInput(input);
  const matches = matchDoNotContact(await store.listDoNotContact(), {
    owner: parsed.owner ?? "",
    repo: parsed.repo ?? "",
    packageName: parsed.packageName,
    securityContact: parsed.contact,
  });
  if (matches.length > 0) {
    throw new DisclosureError(DISCLOSURE_DNC_EXISTS_ERROR, 409, undefined, matches);
  }
  try {
    return toDncView(
      await store.insertDoNotContact({
        owner: parsed.owner,
        repo: parsed.repo,
        packageName: parsed.packageName,
        contact: parsed.contact,
        reason: parsed.reason,
        actor: input.actor,
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DisclosureError(DISCLOSURE_DNC_EXISTS_ERROR, 409);
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function acknowledgeDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; note: unknown },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const note = parseAckNote(input.note);
  const row = await store.acknowledgeDisclosureCase({
    prospectId: input.prospectId,
    actor: input.actor,
    note,
    summary: "Recorded a simulated acknowledgement. No message was sent.",
  });
  return await loadedView(store, row);
}

export async function rescanDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; fixVersion: unknown; wakeWorker?: () => void },
): Promise<{ case: DisclosureCaseView; jobId: number }> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const fixVersion = parseFixVersion(input.fixVersion);
  const row = await store.recordDisclosureRescan({
    prospectId: input.prospectId,
    actor: input.actor,
    fixVersion,
    summary: `Queued a fix-version rescan (${fixVersion}).`,
  });
  await store.queueProspectScan(input.prospectId);
  const job = await store.enqueueJob({
    priority: "heavy",
    kind: "prospect_scan",
    payload: { prospectId: input.prospectId, fixVersion },
  });
  if (job.inserted) input.wakeWorker?.();
  return { case: await loadedView(store, row), jobId: job.id ?? 0 };
}
