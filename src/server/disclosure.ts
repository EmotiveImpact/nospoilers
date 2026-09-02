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
export const MAX_REPRO_STEPS_CHARS = 2000;
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
export const DISCLOSURE_HASH_ERROR =
  "A lead cannot be marked verified without a repeatable artifact hash.";
export const DISCLOSURE_REPRODUCED_ERROR =
  "Record reproducibility steps before marking the finding reproduced.";
export const DISCLOSURE_STEPS_ERROR =
  "A lead cannot be marked verified without reproducibility steps.";
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
export const DISCLOSURE_REVIEW_ERROR =
  "Approve the disclosure review before recording outreach.";
export const DISCLOSURE_REPLY_ERROR = "Vendor reply channel and summary are required.";
export const DISCLOSURE_ATTACHMENT_ERROR = "Attachment filename, type, and bytes are required.";
export const DISCLOSURE_ATTACHMENT_KIND_ERROR =
  "Attach a short text, PDF, or image. Archives and packages are not stored.";
export const DISCLOSURE_ATTACHMENT_EXPIRED_ERROR = "That attachment has expired.";
export const DISCLOSURE_ASSIGNEE_ERROR = "Use a GitHub login, or clear the assignee.";
export const DISCLOSURE_CATEGORY_ERROR =
  "Finding category must be sourcemap, environment, credential, source, git, archive, backup, database, crash, document, agent, debug, network, size, or other.";

export const FINDING_CATEGORIES = [
  "sourcemap",
  "environment",
  "credential",
  "source",
  "git",
  "archive",
  "backup",
  "database",
  "crash",
  "document",
  "agent",
  "debug",
  "network",
  "size",
  "other",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

const FINDING_CATEGORY_PRIORITY: readonly FindingCategory[] = [
  "credential",
  "environment",
  "sourcemap",
  "git",
  "database",
  "crash",
  "source",
  "archive",
  "document",
  "agent",
  "debug",
  "network",
  "backup",
  "size",
  "other",
];

export const VENDOR_CHANNELS = ["security_email", "form", "security_txt", "platform"] as const;
export type VendorChannel = (typeof VENDOR_CHANNELS)[number];

export const VENDOR_REPLY_CHANNELS = [...VENDOR_CHANNELS, "other"] as const;
export type VendorReplyChannel = (typeof VENDOR_REPLY_CHANNELS)[number];

export const DISCLOSURE_REVIEW_STATES = ["none", "pending", "approved", "rejected"] as const;
export type DisclosureReviewState = (typeof DISCLOSURE_REVIEW_STATES)[number];

export const MAX_VENDOR_REPLY = 2000;
export const MIN_VENDOR_REPLY = 8;
export const MAX_VENDOR_REPLIES = 40;
export const MAX_ATTACHMENT_BYTES = 64 * 1024;
export const MAX_ATTACHMENTS_PER_CASE = 8;
export const ALLOWED_ATTACHMENT_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];
export const MAX_ASSIGNEE = 39;

export const DNC_MATCH_REASONS = ["owner_repo", "package", "contact", "domain"] as const;
export type DncReason = (typeof DNC_MATCH_REASONS)[number];

export const MAX_TEMPLATE_NAME = 80;
export const MAX_TEMPLATE_SUBJECT = 200;
export const MAX_TEMPLATE_BODY = 8000;
export const MAX_OUTCOME_CREDIT = 200;
export const MAX_OUTCOME_CVE = 40;
export const MAX_OUTCOME_NOTES = 2000;
export const MAX_DNC_REASON = 200;

export type DuplicateReason = "owner_repo" | "organization" | "package" | "fingerprint" | "domain";

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
  reproducibility_steps: string | null;
  fingerprints: string[];
  finding_category: FindingCategory | null;
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
  assignee: string | null;
  review_state: DisclosureReviewState;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DisclosureVendorReplyRow = {
  id: number;
  case_id: number;
  channel: VendorReplyChannel;
  summary: string;
  received_at: string;
  created_by: string;
  created_at: string;
};

export type DisclosureAttachmentRow = {
  id: number;
  case_id: number;
  filename: string;
  media_type: string;
  byte_length: number;
  ciphertext: string;
  expires_at: string;
  created_by: string;
  created_at: string;
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

export type ArtifactEvidence = {
  url: string;
  name: string;
  version: string | null;
  bytes: number | null;
  sha256: string | null;
  sha512: string | null;
};

export type DisclosureCaseView = {
  id: number;
  prospectId: number;
  state: DisclosureState;
  checklist: DisclosureChecklist;
  fingerprints: string[];
  findingCategory: FindingCategory;
  artifact: ArtifactEvidence;
  reproducibilitySteps: string | null;
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
  assignee: string | null;
  reviewState: DisclosureReviewState;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  verifiedAt: string | null;
  sla: DisclosureSla;
  replies: DisclosureVendorReplyView[];
  attachments: DisclosureAttachmentView[];
  createdAt: string;
  updatedAt: string;
  events: DisclosureEventView[];
};

export type DisclosureVendorReplyView = {
  id: number;
  channel: VendorReplyChannel;
  summary: string;
  receivedAt: string;
  createdBy: string;
  createdAt: string;
};

export type DisclosureAttachmentView = {
  id: number;
  filename: string;
  mediaType: string;
  byteLength: number;
  expired: boolean;
  ciphertextDeleted: boolean;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
};

export type DisclosureSla = {
  openedAt: string;
  verifiedAt: string | null;
  acknowledgedAt: string | null;
  deadlineAt: string | null;
  deadlineMissed: boolean;
  timeToVerifyMs: number | null;
  timeToAckMs: number | null;
};

export type DisclosureReport = {
  sent: false;
  notesIncluded: false;
  attachmentBytesIncluded: false;
  coordinate: string;
  packageName: string | null;
  artifact: ArtifactEvidence;
  reproducibilitySteps: string | null;
  state: DisclosureState;
  fingerprints: string[];
  findingCategory: FindingCategory;
  vendorChannel: VendorChannel | null;
  securityContact: string | null;
  policyUrl: string | null;
  assignee: string | null;
  reviewState: DisclosureReviewState;
  sla: DisclosureSla;
  outcomes: { credit: string | null; cve: string | null; notes: string | null };
  replies: DisclosureVendorReplyView[];
  attachments: DisclosureAttachmentView[];
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
  findingCategory: FindingCategory;
  artifactSha256: string | null;
  hasReproducibilitySteps: boolean;
  vendorChannel: VendorChannel | null;
  assignee: string | null;
  reviewState: DisclosureReviewState;
};

export class DisclosureError extends Error {
  status: 400 | 404 | 409 | 410;
  duplicates?: DuplicateMatch[];
  dnc?: DncMatch[];

  constructor(
    message: string,
    status: 400 | 404 | 409 | 410,
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

export function isRepeatableArtifactHash(value: string | null | undefined): boolean {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

export function artifactEvidence(
  prospect: Pick<
    ProspectRow,
    "artifact_url" | "artifact_name" | "release_tag" | "artifact_bytes" | "artifact_sha256" | "artifact_sha512"
  >,
): ArtifactEvidence {
  return {
    url: prospect.artifact_url,
    name: prospect.artifact_name,
    version: prospect.release_tag,
    bytes: prospect.artifact_bytes,
    sha256: prospect.artifact_sha256,
    sha512: prospect.artifact_sha512,
  };
}

export function assertVerifiedArtifactHash(
  next: DisclosureState,
  current: DisclosureState,
  sha256: string | null | undefined,
): void {
  if (next !== "verified") return;
  if (current === "verified") return;
  if (!isRepeatableArtifactHash(sha256)) {
    throw new DisclosureError(DISCLOSURE_HASH_ERROR, 400);
  }
}

export function hasReproducibilitySteps(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function parseReproducibilitySteps(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null) return null;
  if (typeof raw !== "string") {
    throw new DisclosureError("Reproducibility steps must be text.", 400);
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REPRO_STEPS_CHARS) {
    throw new DisclosureError(
      `Reproducibility steps must be at most ${MAX_REPRO_STEPS_CHARS} characters.`,
      400,
    );
  }
  return trimmed;
}

export function assertVerifiedReproducibilitySteps(
  next: DisclosureState,
  current: DisclosureState,
  steps: string | null | undefined,
): void {
  if (next !== "verified") return;
  if (current === "verified") return;
  if (!hasReproducibilitySteps(steps)) {
    throw new DisclosureError(DISCLOSURE_STEPS_ERROR, 400);
  }
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

export function categoryFromRule(rule: string): FindingCategory {
  const id = rule.trim().toUpperCase();
  if (id === "SEC-001") return "environment";
  if (id.startsWith("SEC-")) return "credential";
  if (id.startsWith("MAP-")) return "sourcemap";
  if (id.startsWith("SRC-")) return "source";
  if (id.startsWith("GIT-")) return "git";
  if (id.startsWith("ARC-") || id.startsWith("LNK-")) return "archive";
  if (id.startsWith("BAK-")) return "backup";
  if (id.startsWith("DB-")) return "database";
  if (id.startsWith("CRASH-")) return "crash";
  if (id.startsWith("DOC-")) return "document";
  if (id.startsWith("AI-")) return "agent";
  if (id.startsWith("DBG-") || id.startsWith("CACHE-")) return "debug";
  if (id.startsWith("NET-")) return "network";
  if (id.startsWith("SIZE-")) return "size";
  return "other";
}

export function categoryFromFingerprints(fingerprints: string[]): FindingCategory {
  let best: FindingCategory = "other";
  let bestRank = FINDING_CATEGORY_PRIORITY.indexOf("other");
  for (const fingerprint of fingerprints) {
    const category = categoryFromRule(fingerprint.split("|")[0] ?? "");
    const rank = FINDING_CATEGORY_PRIORITY.indexOf(category);
    if (rank >= 0 && rank < bestRank) {
      best = category;
      bestRank = rank;
    }
  }
  return best;
}

export function asFindingCategory(raw: string | null | undefined): FindingCategory | null {
  if (typeof raw === "string" && (FINDING_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as FindingCategory;
  }
  return null;
}

export function effectiveFindingCategory(
  stored: FindingCategory | null | undefined,
  fingerprints: string[],
): FindingCategory {
  return stored ?? categoryFromFingerprints(fingerprints);
}

export function parseFindingCategory(raw: unknown): FindingCategory {
  if (typeof raw === "string" && (FINDING_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as FindingCategory;
  }
  throw new DisclosureError(DISCLOSURE_CATEGORY_ERROR, 400);
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
    policyUrl?: string | null;
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
    const entryHost = vendorHostFromContact(entry.contact);
    if (entryHost) {
      const incomingHosts = collectVendorHosts(incoming.policyUrl, incoming.securityContact);
      if (
        incomingHosts.includes(entryHost) ||
        ownerMatchesVendorHost(incoming.owner, entryHost)
      ) {
        reasons.push("domain");
      }
    }
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

const GENERIC_VENDOR_HOSTS = new Set([
  "github.com",
  "githubusercontent.com",
  "gitlab.com",
  "bitbucket.org",
  "npmjs.com",
  "npmjs.org",
  "registry.npmjs.org",
]);

const MIN_OWNER_LABEL = 3;

export function normalizeVendorHost(host: string | null | undefined): string | null {
  if (!host) return null;
  let name = host.trim().toLowerCase();
  if (name.startsWith("www.")) name = name.slice(4);
  if (!name || isBlockedRegistryHost(name)) return null;
  if (GENERIC_VENDOR_HOSTS.has(name)) return null;
  if (name.endsWith(".github.com") || name.endsWith(".githubusercontent.com")) return null;
  if (name.endsWith(".npmjs.com") || name.endsWith(".npmjs.org")) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(name)) {
    return null;
  }
  return name;
}

export function vendorHostFromPolicyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return normalizeVendorHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

export function vendorHostFromContact(contact: string | null | undefined): string | null {
  if (!contact) return null;
  const trimmed = contact.trim();
  const at = trimmed.lastIndexOf("@");
  if (at > 0) return normalizeVendorHost(trimmed.slice(at + 1));
  if (!trimmed.includes("/") && trimmed.includes(".")) return normalizeVendorHost(trimmed);
  return null;
}

export function collectVendorHosts(
  policyUrl: string | null | undefined,
  contact: string | null | undefined,
): string[] {
  const hosts = new Set<string>();
  const fromPolicy = vendorHostFromPolicyUrl(policyUrl);
  const fromContact = vendorHostFromContact(contact);
  if (fromPolicy) hosts.add(fromPolicy);
  if (fromContact) hosts.add(fromContact);
  return [...hosts];
}

export function ownerMatchesVendorHost(owner: string, host: string): boolean {
  const login = owner.trim().toLowerCase();
  if (login.length < MIN_OWNER_LABEL) return false;
  const normalized = normalizeVendorHost(host) ?? host.trim().toLowerCase();
  if (!normalized) return false;
  return normalized === login || normalized.startsWith(`${login}.`);
}

export function vendorHostsOverlap(
  left: { owner: string; policyUrl?: string | null; securityContact?: string | null },
  right: { owner: string; policyUrl?: string | null; securityContact?: string | null },
): boolean {
  const leftHosts = collectVendorHosts(left.policyUrl, left.securityContact);
  const rightHosts = collectVendorHosts(right.policyUrl, right.securityContact);
  if (leftHosts.some((host) => rightHosts.includes(host))) return true;
  if (leftHosts.some((host) => ownerMatchesVendorHost(right.owner, host))) return true;
  if (rightHosts.some((host) => ownerMatchesVendorHost(left.owner, host))) return true;
  return false;
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

export type ResearcherWorkloadCounts = {
  cases: number;
  signal: number;
  verifying: number;
  verified: number;
  falsePositive: number;
  duplicate: number;
  pendingReview: number;
  deadlineMissed: number;
};

export type ResearcherWorkloadRow = ResearcherWorkloadCounts & {
  assignee: string | null;
};

export type ResearcherWorkload = {
  researchers: ResearcherWorkloadRow[];
  totals: ResearcherWorkloadCounts;
  policy: {
    timeTracking: false;
    productivitySurveillance: false;
    sent: false;
  };
};

function emptyWorkloadCounts(): ResearcherWorkloadCounts {
  return {
    cases: 0,
    signal: 0,
    verifying: 0,
    verified: 0,
    falsePositive: 0,
    duplicate: 0,
    pendingReview: 0,
    deadlineMissed: 0,
  };
}

function countDisclosureCase(
  counts: ResearcherWorkloadCounts,
  row: Pick<
    DisclosureCaseRow,
    "state" | "review_state" | "deadline_at" | "acknowledged_at"
  >,
  now: number,
): void {
  counts.cases += 1;
  if (row.state === "signal") counts.signal += 1;
  else if (row.state === "verifying") counts.verifying += 1;
  else if (row.state === "verified") counts.verified += 1;
  else if (row.state === "false_positive") counts.falsePositive += 1;
  else if (row.state === "duplicate") counts.duplicate += 1;
  if (row.review_state === "pending") counts.pendingReview += 1;
  if (deadlineMissed(row.deadline_at, row.acknowledged_at, now)) counts.deadlineMissed += 1;
}

export function researcherWorkloadFromCases(
  cases: Array<
    Pick<
      DisclosureCaseRow,
      "assignee" | "state" | "review_state" | "deadline_at" | "acknowledged_at"
    >
  >,
  now = Date.now(),
): ResearcherWorkload {
  const totals = emptyWorkloadCounts();
  const byKey = new Map<string, ResearcherWorkloadRow>();
  for (const row of cases) {
    const login = row.assignee?.trim() || null;
    const key = login ? login.toLowerCase() : "";
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = { assignee: login, ...emptyWorkloadCounts() };
      byKey.set(key, bucket);
    }
    countDisclosureCase(bucket, row, now);
    countDisclosureCase(totals, row, now);
  }
  const researchers = [...byKey.values()].sort((left, right) => {
    if (left.assignee == null) return 1;
    if (right.assignee == null) return -1;
    return left.assignee.localeCompare(right.assignee);
  });
  return {
    researchers,
    totals,
    policy: {
      timeTracking: false,
      productivitySurveillance: false,
      sent: false,
    },
  };
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
  steps: string | null = null,
  previousReproduced = false,
): void {
  if (checklist.fingerprints_recorded && fingerprints.length === 0) {
    throw new DisclosureError(DISCLOSURE_CHECK_FINGERPRINT_ERROR, 400);
  }
  if (checklist.contact_or_policy && !securityContact && !policyUrl) {
    throw new DisclosureError(DISCLOSURE_CHECK_CONTACT_ERROR, 400);
  }
  if (checklist.reproduced && !hasReproducibilitySteps(steps) && !previousReproduced) {
    throw new DisclosureError(DISCLOSURE_REPRODUCED_ERROR, 400);
  }
}

export function matchDuplicateReasons(
  candidate: {
    owner: string;
    repo: string;
    packageName: string | null;
    fingerprints: string[];
    policyUrl?: string | null;
    securityContact?: string | null;
  },
  incoming: {
    owner: string;
    repo: string;
    packageName: string | null;
    fingerprints: string[];
    policyUrl?: string | null;
    securityContact?: string | null;
  },
): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  const sameOwner = candidate.owner.toLowerCase() === incoming.owner.toLowerCase();
  const sameRepo = candidate.repo.toLowerCase() === incoming.repo.toLowerCase();
  if (sameOwner && sameRepo) reasons.push("owner_repo");
  else if (sameOwner) reasons.push("organization");
  const left = candidate.packageName?.trim().toLowerCase() ?? "";
  const right = incoming.packageName?.trim().toLowerCase() ?? "";
  if (left && right && left === right) reasons.push("package");
  const theirs = new Set(candidate.fingerprints);
  if (incoming.fingerprints.some((fp) => theirs.has(fp))) reasons.push("fingerprint");
  if (vendorHostsOverlap(candidate, incoming)) reasons.push("domain");
  return reasons;
}

export function previewDisclosureDraft(
  prospect: Pick<
    ProspectRow,
    "owner" | "repo" | "package_name" | "artifact_name" | "release_tag" | "source"
  > & { artifact_url?: string | null; artifact_sha256?: string | null },
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
    ...(prospect.artifact_url ? [`URL: ${prospect.artifact_url}`] : []),
    ...(prospect.artifact_sha256 ? [`SHA-256: ${prospect.artifact_sha256}`] : []),
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

export function toVendorReplyView(row: DisclosureVendorReplyRow): DisclosureVendorReplyView {
  return {
    id: row.id,
    channel: row.channel,
    summary: row.summary,
    receivedAt: row.received_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toAttachmentView(row: DisclosureAttachmentRow): DisclosureAttachmentView {
  const expiresAt = row.expires_at;
  const expired = Date.parse(expiresAt) <= Date.now();
  return {
    id: row.id,
    filename: row.filename,
    mediaType: row.media_type,
    byteLength: row.byte_length,
    expired,
    ciphertextDeleted: row.ciphertext.length === 0,
    expiresAt,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function sweepExpiredDisclosureEvidence(
  store: Store,
): Promise<{ attachments: number; notes: number }> {
  return store.sweepExpiredDisclosureEvidence();
}

export function disclosureSla(row: DisclosureCaseRow): DisclosureSla {
  const opened = Date.parse(row.created_at);
  const verified = row.verified_at ? Date.parse(row.verified_at) : Number.NaN;
  const acknowledged = row.acknowledged_at ? Date.parse(row.acknowledged_at) : Number.NaN;
  return {
    openedAt: row.created_at,
    verifiedAt: row.verified_at,
    acknowledgedAt: row.acknowledged_at,
    deadlineAt: row.deadline_at,
    deadlineMissed: deadlineMissed(row.deadline_at, row.acknowledged_at),
    timeToVerifyMs:
      Number.isFinite(opened) && Number.isFinite(verified) && verified >= opened
        ? verified - opened
        : null,
    timeToAckMs:
      Number.isFinite(opened) && Number.isFinite(acknowledged) && acknowledged >= opened
        ? acknowledged - opened
        : null,
  };
}

export function toDisclosureView(
  row: DisclosureCaseRow,
  notes: { notes: string | null; notesExpired: boolean },
  events: DisclosureEventRow[] = [],
  replies: DisclosureVendorReplyRow[] = [],
  attachments: DisclosureAttachmentRow[] = [],
  artifact: ArtifactEvidence,
): DisclosureCaseView {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    state: row.state,
    checklist: checklistFromRow(row),
    fingerprints: row.fingerprints,
    findingCategory: effectiveFindingCategory(row.finding_category, row.fingerprints),
    artifact,
    reproducibilitySteps: row.reproducibility_steps,
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
    assignee: row.assignee,
    reviewState: row.review_state,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    verifiedAt: row.verified_at,
    sla: disclosureSla(row),
    replies: replies.map(toVendorReplyView),
    attachments: attachments.map(toAttachmentView),
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

export function toDisclosureSummary(
  row: DisclosureCaseRow,
  artifactSha256: string | null = null,
): DisclosureCaseSummary {
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
    findingCategory: effectiveFindingCategory(row.finding_category, row.fingerprints),
    artifactSha256,
    hasReproducibilitySteps: hasReproducibilitySteps(row.reproducibility_steps),
    vendorChannel: row.vendor_channel,
    assignee: row.assignee,
    reviewState: row.review_state,
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
    policyUrl?: string | null;
    securityContact?: string | null;
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
        policyUrl: row.policy_url,
        securityContact: row.security_contact,
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
    policyUrl?: string | null;
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
    findingCategory: categoryFromFingerprints(fingerprints),
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
  const [events, replies, attachments, prospect] = await Promise.all([
    store.listDisclosureEvents(row.id),
    store.listDisclosureVendorReplies(row.id),
    store.listDisclosureAttachments(row.id),
    store.getProspect(row.prospect_id),
  ]);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  return toDisclosureView(
    row,
    store.readDisclosureNotes(row),
    events,
    replies,
    attachments,
    artifactEvidence(prospect),
  );
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
    findingCategory?: unknown;
    reproducibilitySteps?: unknown;
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
  const parsedSteps = parseReproducibilitySteps(input.reproducibilitySteps);
  const reproducibilitySteps =
    parsedSteps === undefined ? current.reproducibility_steps : parsedSteps;
  assertChecklistAllowed(
    checklist,
    current.fingerprints,
    securityContact,
    policyUrl,
    reproducibilitySteps,
    current.checklist_reproduced,
  );
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
  const findingCategory =
    input.findingCategory !== undefined
      ? input.findingCategory == null || input.findingCategory === ""
        ? categoryFromFingerprints(current.fingerprints)
        : parseFindingCategory(input.findingCategory)
      : (current.finding_category ?? categoryFromFingerprints(current.fingerprints));
  const prospect = await requireProspect(store, input.prospectId);
  assertVerifiedArtifactHash(state, current.state, prospect?.artifact_sha256);
  assertVerifiedReproducibilitySteps(state, current.state, reproducibilitySteps);
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
    findingCategory,
    reproducibilitySteps,
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
      findingCategory,
      reproducibilitySteps,
    }),
  });
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
    findingCategory: FindingCategory;
    reproducibilitySteps: string | null;
  },
): string {
  if (next.state !== current.state) return `Set case state to ${next.state}.`;
  if (next.notes !== undefined) return "Stored encrypted operator notes.";
  if (next.reproducibilitySteps !== (current.reproducibility_steps ?? null)) {
    return "Recorded reproducibility steps.";
  }
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
  if (next.findingCategory !== (current.finding_category ?? categoryFromFingerprints(current.fingerprints))) {
    return `Recorded finding category (${next.findingCategory}).`;
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

export function parseVendorReplyChannel(raw: unknown): VendorReplyChannel {
  if (raw === "other") return "other";
  const channel = typeof raw === "string" ? parseVendorChannel(raw) : null;
  if (!channel) throw new DisclosureError(DISCLOSURE_REPLY_ERROR, 400);
  return channel;
}

export function parseVendorReplySummary(raw: unknown): string {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_REPLY_ERROR, 400);
  const summary = raw.trim();
  if (summary.length < MIN_VENDOR_REPLY || summary.length > MAX_VENDOR_REPLY) {
    throw new DisclosureError(
      `Vendor reply summary must be ${MIN_VENDOR_REPLY} to ${MAX_VENDOR_REPLY} characters.`,
      400,
    );
  }
  return summary;
}

export function parseAssignee(raw: unknown): string | null {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_ASSIGNEE_ERROR, 400);
  const login = raw.trim();
  if (!login) return null;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) || login.length > MAX_ASSIGNEE) {
    throw new DisclosureError(DISCLOSURE_ASSIGNEE_ERROR, 400);
  }
  return login;
}

export function parseReviewDecision(raw: unknown): "approved" | "rejected" {
  if (raw === "approve" || raw === "approved") return "approved";
  if (raw === "reject" || raw === "rejected") return "rejected";
  throw new DisclosureError("Review decision must be approve or reject.", 400);
}

export function attachmentExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

export function sanitizeAttachmentFilename(raw: unknown): string {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_ATTACHMENT_ERROR, 400);
  const name = raw.trim().split(/[/\\]/).pop() ?? "";
  if (!name || name === "." || name.includes("..") || name.length > 80) {
    throw new DisclosureError(DISCLOSURE_ATTACHMENT_ERROR, 400);
  }
  return name;
}

export function parseAttachmentMediaType(raw: unknown): AllowedAttachmentType {
  if (typeof raw !== "string") throw new DisclosureError(DISCLOSURE_ATTACHMENT_ERROR, 400);
  const type = raw.trim().toLowerCase();
  if ((ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type)) {
    return type as AllowedAttachmentType;
  }
  throw new DisclosureError(DISCLOSURE_ATTACHMENT_KIND_ERROR, 400);
}

export function decodeAttachmentBytes(raw: unknown): Buffer {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new DisclosureError(DISCLOSURE_ATTACHMENT_ERROR, 400);
  }
  const bytes = Buffer.from(raw.trim(), "base64");
  if (bytes.length === 0 || bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new DisclosureError(
      `Attachment must be 1 to ${MAX_ATTACHMENT_BYTES} bytes after decoding.`,
      400,
    );
  }
  return bytes;
}

const PACKED_ATTACHMENT_NAME =
  /\.(?:tgz|tar|gz|zip|vsix|crx|nupkg|snupkg|gem|jar|war|whl|apk|aab|ipa|asar)$/i;

export function attachmentNameLooksPacked(filename: string): boolean {
  return PACKED_ATTACHMENT_NAME.test(filename);
}

export function attachmentLooksPacked(bytes: Buffer): boolean {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
    return true;
  }
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return true;
  if (bytes.length >= 262 && bytes.subarray(257, 262).toString("ascii") === "ustar") return true;
  if (bytes.length >= 4 && bytes[0] === 0x7f && bytes.subarray(1, 4).toString("ascii") === "ELF") {
    return true;
  }
  return false;
}

export async function recordVendorReply(
  store: Store,
  input: { prospectId: number; actor: string; channel: unknown; summary: unknown; receivedAt?: unknown },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const existing = await store.listDisclosureVendorReplies(current.id);
  if (existing.length >= MAX_VENDOR_REPLIES) {
    throw new DisclosureError(`This case already has ${MAX_VENDOR_REPLIES} vendor replies.`, 400);
  }
  const receivedAt =
    typeof input.receivedAt === "string" && input.receivedAt.trim()
      ? parseDeadlineAt(input.receivedAt)
      : new Date().toISOString();
  if (!receivedAt) throw new DisclosureError("Vendor reply time is invalid.", 400);
  await store.insertDisclosureVendorReply({
    caseId: current.id,
    channel: parseVendorReplyChannel(input.channel),
    summary: parseVendorReplySummary(input.summary),
    receivedAt,
    createdBy: input.actor,
  });
  await store.insertDisclosureEvent({
    caseId: current.id,
    actor: input.actor,
    action: "vendor_reply",
    summary: "Recorded a vendor reply. No message was sent.",
  });
  const row = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!row) throw new DisclosureError("No disclosure case yet.", 404);
  return await loadedView(store, row);
}

export async function addDisclosureAttachment(
  store: Store,
  input: {
    prospectId: number;
    actor: string;
    filename: unknown;
    mediaType: unknown;
    bytes: unknown;
    expiresInDays?: unknown;
  },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const existing = await store.listDisclosureAttachments(current.id);
  if (existing.length >= MAX_ATTACHMENTS_PER_CASE) {
    throw new DisclosureError(`This case already has ${MAX_ATTACHMENTS_PER_CASE} attachments.`, 400);
  }
  const filename = sanitizeAttachmentFilename(input.filename);
  if (attachmentNameLooksPacked(filename)) {
    throw new DisclosureError(DISCLOSURE_ATTACHMENT_KIND_ERROR, 400);
  }
  const mediaType = parseAttachmentMediaType(input.mediaType);
  const bytes = decodeAttachmentBytes(input.bytes);
  if (attachmentLooksPacked(bytes)) {
    throw new DisclosureError(DISCLOSURE_ATTACHMENT_KIND_ERROR, 400);
  }
  const days = parseNotesTtlDays(input.expiresInDays ?? DEFAULT_NOTES_TTL_DAYS);
  await store.insertDisclosureAttachment({
    caseId: current.id,
    filename,
    mediaType,
    bytes,
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
    createdBy: input.actor,
  });
  await store.insertDisclosureEvent({
    caseId: current.id,
    actor: input.actor,
    action: "attachment.add",
    summary: `Stored encrypted attachment ${filename} (${bytes.length} bytes).`,
  });
  const row = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!row) throw new DisclosureError("No disclosure case yet.", 404);
  return await loadedView(store, row);
}

export async function readDisclosureAttachment(
  store: Store,
  input: { prospectId: number; attachmentId: number },
): Promise<{ filename: string; mediaType: string; bytes: Buffer }> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const row = await store.getDisclosureAttachment(input.attachmentId);
  if (!row || row.case_id !== current.id) throw new DisclosureError("Unknown attachment.", 404);
  if (attachmentExpired(row.expires_at) || !row.ciphertext) {
    throw new DisclosureError(DISCLOSURE_ATTACHMENT_EXPIRED_ERROR, 410);
  }
  const bytes = store.decryptDisclosureAttachment(row);
  return { filename: row.filename, mediaType: row.media_type, bytes };
}

export async function assignDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; assignee: unknown },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const assignee = parseAssignee(input.assignee);
  const reviewState =
    assignee && current.review_state === "none" ? "pending" : current.review_state;
  const row = await store.assignDisclosureCase({
    prospectId: input.prospectId,
    assignee,
    reviewState,
    actor: input.actor,
    summary: assignee
      ? `Assigned the case to ${assignee}.`
      : "Cleared the case assignee.",
  });
  return await loadedView(store, row);
}

export async function reviewDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; decision: unknown; note: unknown },
): Promise<DisclosureCaseView> {
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const decision = parseReviewDecision(input.decision);
  const note = parseAckNote(input.note);
  const row = await store.reviewDisclosureCase({
    prospectId: input.prospectId,
    reviewState: decision,
    reviewNote: note,
    reviewedBy: input.actor,
    actor: input.actor,
    summary:
      decision === "approved"
        ? "Approved the case for outreach. No message was sent."
        : "Rejected the case for outreach.",
  });
  return await loadedView(store, row);
}

export async function buildDisclosureReport(
  store: Store,
  prospectId: number,
): Promise<DisclosureReport> {
  const prospect = await requireProspect(store, prospectId);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  const row = await store.getDisclosureCaseByProspect(prospectId);
  if (!row) throw new DisclosureError("No disclosure case yet.", 404);
  const view = await loadedView(store, row);
  return {
    sent: false,
    notesIncluded: false,
    attachmentBytesIncluded: false,
    coordinate: `${prospect.owner}/${prospect.repo}`,
    packageName: prospect.package_name,
    artifact: view.artifact,
    reproducibilitySteps: view.reproducibilitySteps,
    state: view.state,
    fingerprints: view.fingerprints,
    findingCategory: view.findingCategory,
    vendorChannel: view.vendorChannel,
    securityContact: view.securityContact,
    policyUrl: view.policyUrl,
    assignee: view.assignee,
    reviewState: view.reviewState,
    sla: view.sla,
    outcomes: {
      credit: view.outcomeCredit,
      cve: view.outcomeCve,
      notes: view.outcomeNotes,
    },
    replies: view.replies,
    attachments: view.attachments,
    events: view.events,
  };
}
