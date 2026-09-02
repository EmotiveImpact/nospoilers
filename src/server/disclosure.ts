import { findingFingerprint } from "../receipt.ts";
import type { Finding } from "../scanner/types.ts";
import { notifyVerifiedCritical } from "./internal-notify.ts";
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
export const DISCLOSURE_SENT_ERROR = "Phase 1 never sends disclosure messages.";

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
  created_at: string;
  updated_at: string;
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
};

export class DisclosureError extends Error {
  status: 400 | 404 | 409;
  duplicates?: DuplicateMatch[];

  constructor(message: string, status: 400 | 404 | 409, duplicates?: DuplicateMatch[]) {
    super(message);
    this.name = "DisclosureError";
    this.status = status;
    this.duplicates = duplicates;
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

export async function loadDisclosureCase(
  store: Store,
  prospectId: number,
): Promise<DisclosureCaseView> {
  const row = await store.getDisclosureCaseByProspect(prospectId);
  if (!row) throw new DisclosureError("No disclosure case yet.", 404);
  return await loadedView(store, row);
}

export async function createDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string; confirmDuplicate?: boolean },
): Promise<DisclosureCaseView> {
  const prospect = await requireProspect(store, input.prospectId);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  const existing = await store.getDisclosureCaseByProspect(input.prospectId);
  if (existing) throw new DisclosureError(DISCLOSURE_EXISTS_ERROR, 409);
  const fingerprints = fingerprintsFromFindings(prospect.findings);
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
      duplicates.length > 0
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
    summary: summarizeUpdate(current, {
      state,
      checklist,
      securityContact,
      policyUrl,
      notes,
      deadlineAt,
      conversion,
    }),
  });
  const prospect = await requireProspect(store, input.prospectId);
  if (prospect) {
    await notifyVerifiedCritical(store, {
      previousState: current.state,
      row,
      prospect,
    });
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
  const before = checklistFromRow(current);
  if (CHECKLIST_KEYS.some((key) => before[key] !== next.checklist[key])) {
    return "Updated verification checklist.";
  }
  return "Updated the disclosure case.";
}

export async function previewDisclosureCase(
  store: Store,
  input: { prospectId: number; actor: string },
): Promise<{ subject: string; body: string; sent: false; case: DisclosureCaseView }> {
  const prospect = await requireProspect(store, input.prospectId);
  if (!prospect) throw new DisclosureError("Prospect not found.", 404);
  const current = await store.getDisclosureCaseByProspect(input.prospectId);
  if (!current) throw new DisclosureError("No disclosure case yet.", 404);
  const draft = previewDisclosureDraft(prospect, current.fingerprints);
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
    summary: "Previewed disclosure draft (not sent).",
  });
  return { ...draft, sent: false, case: await loadedView(store, row) };
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
