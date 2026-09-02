import { logJson } from "./log.ts";
import type { DisclosureCaseRow, DisclosureState } from "./disclosure.ts";
import type { ProspectRow, Store } from "./store.ts";

export const VERIFIED_CRITICAL_KIND = "verified_critical";
export const DEADLINE_MISSED_KIND = "deadline_missed";
export const MAX_NOTIFICATION_RULES = 12;

export type InternalNotificationKind =
  | typeof VERIFIED_CRITICAL_KIND
  | typeof DEADLINE_MISSED_KIND;

export type InternalNotificationRow = {
  id: number;
  kind: InternalNotificationKind;
  prospect_id: number;
  case_id: number;
  title: string;
  fingerprints: string[];
  rules: string[];
  read_at: string | null;
  created_at: string;
};

export type InternalNotificationView = {
  id: number;
  kind: InternalNotificationKind;
  prospectId: number;
  caseId: number;
  title: string;
  fingerprints: string[];
  rules: string[];
  readAt: string | null;
  createdAt: string;
};

export function isCriticalFingerprint(fingerprint: string): boolean {
  return fingerprint.split("|")[1] === "critical";
}

export function criticalFingerprints(fingerprints: string[]): string[] {
  return fingerprints.filter(isCriticalFingerprint);
}

export function notificationRules(fingerprints: string[]): string[] {
  const rules = new Set<string>();
  for (const fingerprint of criticalFingerprints(fingerprints)) {
    const rule = fingerprint.split("|")[0]?.trim();
    if (!rule) continue;
    rules.add(rule);
    if (rules.size >= MAX_NOTIFICATION_RULES) break;
  }
  return [...rules].sort();
}

export function notificationTitle(owner: string, repo: string): string {
  return `Verified critical findings in ${owner}/${repo}`.slice(0, 200);
}

export function deadlineMissedTitle(owner: string, repo: string): string {
  return `Disclosure deadline missed for ${owner}/${repo}`.slice(0, 200);
}

function caseDeadlineMissed(
  deadlineAt: string | null,
  acknowledgedAt: string | null,
  now = Date.now(),
): boolean {
  if (!deadlineAt || acknowledgedAt) return false;
  const ms = Date.parse(deadlineAt);
  return Number.isFinite(ms) && ms < now;
}

export function toNotificationView(row: InternalNotificationRow): InternalNotificationView {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    caseId: row.case_id,
    kind: row.kind,
    title: row.title,
    fingerprints: row.fingerprints,
    rules: row.rules,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function notifyVerifiedCritical(
  store: Store,
  input: {
    previousState: DisclosureState;
    row: DisclosureCaseRow;
    prospect: ProspectRow;
  },
): Promise<InternalNotificationRow | null> {
  if (input.previousState === "verified" || input.row.state !== "verified") return null;
  const fingerprints = criticalFingerprints(input.row.fingerprints);
  if (fingerprints.length === 0) return null;
  const inserted = await store.insertInternalNotification({
    kind: VERIFIED_CRITICAL_KIND,
    prospectId: input.prospect.id,
    caseId: input.row.id,
    title: notificationTitle(input.prospect.owner, input.prospect.repo),
    fingerprints,
    rules: notificationRules(fingerprints),
  });
  if (inserted) {
    logJson("info", "internal.verified_critical", {
      prospectId: input.prospect.id,
      caseId: input.row.id,
      rules: inserted.rules,
    });
  }
  return inserted;
}

export async function notifyDeadlineMissed(
  store: Store,
  input: {
    row: DisclosureCaseRow;
    prospect: Pick<ProspectRow, "id" | "owner" | "repo">;
    now?: number;
  },
): Promise<InternalNotificationRow | null> {
  if (!caseDeadlineMissed(input.row.deadline_at, input.row.acknowledged_at, input.now)) {
    return null;
  }
  const inserted = await store.insertInternalNotification({
    kind: DEADLINE_MISSED_KIND,
    prospectId: input.prospect.id,
    caseId: input.row.id,
    title: deadlineMissedTitle(input.prospect.owner, input.prospect.repo),
    fingerprints: [],
    rules: [],
  });
  if (inserted) {
    logJson("info", "internal.deadline_missed", {
      prospectId: input.prospect.id,
      caseId: input.row.id,
    });
  }
  return inserted;
}

export async function remindMissedDisclosureDeadlines(store: Store): Promise<number> {
  const missed = await store.listMissedDeadlineCases();
  let created = 0;
  for (const row of missed) {
    const inserted = await notifyDeadlineMissed(store, {
      row,
      prospect: { id: row.prospect_id, owner: row.owner, repo: row.repo },
    });
    if (inserted) created += 1;
  }
  return created;
}
