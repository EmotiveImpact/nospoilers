import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { coverageFrom, coverageIsOn } from "../coverage.ts";
import type { SignedReceipt } from "../receipt.ts";
import type { ManifestEntry, ScanStatus } from "../scanner/types.ts";
import type { ReleaseChannel } from "./release-ledger.ts";
import type {
  DisclosureAttachmentRow,
  DisclosureCaseRow,
  DisclosureChecklist,
  DisclosureConversion,
  DisclosureEventRow,
  DisclosureReviewState,
  DisclosureState,
  DisclosureTemplateRow,
  DisclosureVendorReplyRow,
  DoNotContactRow,
  VendorChannel,
  VendorReplyChannel,
} from "./disclosure.ts";
import type {
  InternalNotificationKind,
  InternalNotificationRow,
} from "./internal-notify.ts";
import { decryptSecret, encryptSecret, looksEncrypted } from "./secret-box.ts";
import { PUBLIC_NPM_ORIGIN } from "./npm-registry.ts";
import { hashScanToken, hashesMatch, mintScanToken } from "./scan-api.ts";
import { num, type SqlClient } from "./sql.ts";
import { heavyFairUseCaseSql } from "./fair-use.ts";
import {
  FAIR_USE_ALERT_KIND,
  FAIR_USE_EXHAUSTED,
  fairUseDeliveryId,
  heavyUsageCapSql,
  hostedUsageStatus,
  SOLO_HEAVY_PER_UTC_DAY,
  type HostedUsageStatus,
} from "./usage.ts";
import type { PermissionTestResult } from "./install-test.ts";
import { TIMELINE_LIMIT } from "./timeline.ts";
import {
  ADMIN_REQUIRED_ERROR,
  ALREADY_MEMBER_ERROR,
  LAST_ADMIN_ERROR,
  UNKNOWN_INVITE_ERROR,
  UNKNOWN_MEMBER_ERROR,
  asInstallationRole,
  type InstallationInvite,
  type InstallationMember,
  type InstallationRole,
} from "./roles.ts";
import { decodeJiraSecret, type JiraSecret } from "./jira.ts";
import { githubLoginKey, type NotificationRouteRow, type RouteMinSeverity } from "./routing.ts";
import { IDENTITY_EVIDENCE_ALERT_KINDS } from "./identity-evidence.ts";
import {
  asDisclosureDestinationKind,
  type DisclosureDestinationKind,
  type DisclosureDestinationRow,
} from "./disclosure-destinations.ts";
import {
  OPERATOR_CAP_ERROR,
  OPERATOR_EXISTS_ERROR,
  type OperatorGrantRow,
} from "./operator-grants.ts";

export type JobPriority = "light" | "heavy";

export type JobRow = {
  id: number;
  delivery_id: string | null;
  priority: JobPriority;
  kind: string;
  payload: unknown;
  status: string;
  attempts: number;
};

export type TenantJobRow = {
  id: number;
  installationId: number;
  kind: string;
  status: string;
  priority: string;
  attempts: number;
  error: string | null;
  createdAt: string;
  runAfter: string;
};

export type JobSummary = {
  queued: number;
  running: number;
  done: number;
  failed: number;
};

export type OwnerQueueHealth = {
  customer: { queued: number; running: number; failed: number };
  prospect: { queued: number; running: number; failed: number };
  heavyQueued: number;
  lightQueued: number;
  staleRunning: number;
  oldestQueuedAgeMs: number | null;
  usage: {
    customerHeavyToday: number;
    installsWarning: number;
    installsExhausted: number;
  };
};

export type RepoRow = {
  id: number;
  installation_id: number;
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  last_checked_at: string | null;
  last_private: boolean | null;
};

export type AlertRow = {
  id: number;
  installation_id: number;
  repo_id: number | null;
  kind: string;
  title: string;
  body: string;
  findings: unknown;
  github_delivery_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by_login: string | null;
  assigned_to_login: string | null;
  resolved_at: string | null;
  resolved_by_login: string | null;
  resolution_note: string | null;
  created_at: string;
  full_name?: string | null;
};

export type AlertEventRow = {
  id: number;
  alert_id: number;
  installation_id: number;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export type AlertEventAction = "acknowledged" | "assigned" | "resolved" | "reopened" | "note";

export type WatchedPackageRow = {
  id: number;
  installation_id: number;
  package_name: string;
  registry_origin: string;
  last_version: string | null;
  last_dist_tags: Record<string, string> | null;
  last_tarball_url: string | null;
  last_shasum: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
  last_debug_ids: string[];
  last_release: string | null;
  last_public_map: boolean;
};

export type WatchedOriginRow = {
  id: number;
  installation_id: number;
  origin_url: string;
  host: string;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
  last_debug_ids: string[];
  last_release: string | null;
  last_public_map: boolean;
};

export type MapDestinationKind = "sentry" | "bugsnag";

export type MapDestinationRow = {
  id: number;
  installation_id: number;
  kind: MapDestinationKind;
  host: string;
  org_slug: string | null;
  project_slug: string;
  last_checked_at: string | null;
  last_status: string | null;
  last_error: string | null;
  last_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

export type MapIdentityRow = {
  source: "origin" | "package";
  id: number;
  label: string;
  debugIds: string[];
  release: string | null;
  publicMap: boolean;
};

export type NpmRegistryRow = {
  id: number;
  installation_id: number;
  origin: string;
  host: string;
  updated_at: string;
};

export type NotificationKind = "slack" | "siem" | "jira" | "pagerduty";

export type NotificationDestinationRow = {
  id: number;
  installationId: number;
  kind: NotificationKind;
  host: string;
  projectKey: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryError: string | null;
  updatedAt: string;
};

export type NotificationDeliveryRow = {
  id: number;
  installationId: number;
  destinationId: number | null;
  alertId: number | null;
  kind: NotificationKind;
  status: "sent" | "failed";
  inventedIncident: false;
  error: string | null;
  createdAt: string;
};

export type TimelineEntry = {
  at: string;
  type: "alert" | "alert_event" | "delivery";
  alertId: number | null;
  kind: string | null;
  title: string | null;
  fullName: string | null;
  action: string | null;
  actorLogin: string | null;
  deliveryStatus: "sent" | "failed" | null;
  inventedIncident: false | null;
};

export type AuditEventRow = {
  id: number;
  installationId: number;
  actorLogin: string;
  action: string;
  summary: string;
  targetKind: string | null;
  targetId: string | null;
  createdAt: string;
};

export type AuditExportAlert = {
  id: number;
  kind: string;
  title: string;
  createdAt: string;
};

export type AuditExportAlertEvent = {
  id: number;
  alertId: number;
  actorLogin: string;
  action: string;
  createdAt: string;
};

export type AuditExportBundle = {
  exportedAt: string;
  installationId: number;
  audit: AuditEventRow[];
  notificationDeliveries: NotificationDeliveryRow[];
  alerts: AuditExportAlert[];
  alertEvents: AuditExportAlertEvent[];
};

export type ScanApiTokenRow = {
  id: number;
  installation_id: number;
  name: string;
  token_prefix: string;
  created_by_login: string;
  last_used_at: string | null;
  created_at: string;
};

export type ScanReceiptRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes: number | null;
  status: ScanStatus;
  engine_version: string;
  manifest: ManifestEntry[];
  finding_fingerprints: string[];
  signature: string;
  receipt: SignedReceipt;
  created_at: string;
};

export type PolicyExceptionRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  rule: string;
  path_pattern: string | null;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
};

export type ScanBaselineRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  receipt_id: number;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  created_at: string;
  superseded_at: string | null;
};

export type ReleaseRevisionRow = {
  id: number;
  installation_id: number;
  package_id: number | null;
  repo_id: number | null;
  receipt_id: number;
  channel: ReleaseChannel;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes: number | null;
  media_type: string | null;
  source_revision: string | null;
  ci_run_url: string | null;
  previous_sha256: string | null;
  mismatch: boolean;
  receipt_status: ScanStatus | null;
  created_at: string;
};

export type DeliveryVerifyStatus =
  | "matched"
  | "mismatch"
  | "missing"
  | "redirect"
  | "content_type"
  | "blocked"
  | "error";

export type DeliveryLocationRow = {
  id: number;
  installation_id: number;
  revision_id: number;
  url: string;
  host: string;
  expected_media_type: string | null;
  created_by_login: string;
  created_at: string;
  last_status: DeliveryVerifyStatus | null;
  last_sha256: string | null;
  last_media_type: string | null;
  last_redirect_hosts: string | null;
  last_cache_state: string | null;
  last_region: string | null;
  last_checked_at: string | null;
};

export type DeliveryVerificationRow = {
  id: number;
  installation_id: number;
  location_id: number;
  revision_id: number;
  status: DeliveryVerifyStatus;
  observed_sha256: string | null;
  observed_sha512: string | null;
  observed_bytes: number | null;
  observed_media_type: string | null;
  final_host: string | null;
  redirect_count: number;
  redirect_hosts: string | null;
  cache_state: string | null;
  delivery_region: string | null;
  error: string | null;
  created_at: string;
};

export type ReleaseApprovalRow = {
  id: number;
  installation_id: number;
  revision_id: number;
  decision: "approved" | "rejected";
  reason: string;
  actor_login: string;
  created_at: string;
};

export type ReleaseLegalHoldRow = {
  id: number;
  installation_id: number;
  revision_id: number;
  action: "place" | "release";
  reason: string;
  actor_login: string;
  created_at: string;
};

export type ReleasePublicPageRow = {
  id: number;
  installation_id: number;
  revision_id: number;
  public_token: string;
  enabled: boolean;
  created_by_login: string;
  updated_by_login: string;
  created_at: string;
  updated_at: string;
};

export type IdentityEvidencePackRow = {
  id: number;
  installation_id: number;
  package_id: number;
  package_name: string;
  public_token: string;
  enabled: boolean;
  payload: unknown;
  created_by_login: string;
  updated_by_login: string;
  created_at: string;
  updated_at: string;
};

export type PackageProtectionRow = {
  id: number;
  installation_id: number;
  package_id: number;
  verified_via: "scope_match" | "github_repository";
  github_repo: string | null;
  created_at: string;
};

export type ProtectedNamespaceRow = {
  id: number;
  installation_id: number;
  scope: string;
  names: string[];
  created_by_login: string;
  last_checked_at: string | null;
  created_at: string;
};

export type NamespaceNameSnapshotRow = {
  id: number;
  namespace_id: number;
  installation_id: number;
  names: string[];
  created_at: string;
};

export type PackageIdentitySnapshotRow = {
  id: number;
  installation_id: number;
  package_id: number;
  version: string | null;
  maintainers: string[];
  repository_url: string | null;
  homepage: string | null;
  bin_names: string[];
  lifecycle_scripts: string[];
  published_at: string | null;
  dependency_names: string[];
  unpacked_bytes: number | null;
  has_attestations: boolean | null;
  attestation_predicate: string | null;
  signature_keyids: string[];
  publisher_name: string | null;
  trusted_publisher: string | null;
  created_at: string;
};

export type IdentityCandidateRow = {
  id: number;
  installation_id: number;
  package_id: number;
  candidate_name: string;
  transformation: string;
  first_seen_at: string;
  last_checked_at: string | null;
  registered_at: string | null;
  last_version: string | null;
  last_published_at: string | null;
  allowlisted_at: string | null;
  allowlist_reason: string | null;
  allowlisted_by_login: string | null;
};

export type ProspectStatus = "new" | "contacted" | "fixed" | "ignored";
export type ProspectScanStatus = "queued" | "scanning" | "complete" | "failed";

export type ProspectRow = {
  id: number;
  source: "github_release" | "npm";
  owner: string;
  repo: string;
  repository_url: string;
  package_name: string | null;
  release_tag: string | null;
  artifact_name: string;
  artifact_url: string;
  artifact_bytes: number | null;
  status: ProspectStatus;
  scan_status: ProspectScanStatus;
  file_count: number | null;
  critical_count: number | null;
  warning_count: number | null;
  findings: unknown;
  workspace_members: string[];
  error: string | null;
  discovered_at: string;
  scanned_at: string | null;
  contacted_at: string | null;
  feed_checked_at: string | null;
  updated_at: string;
};

export type DiscoveryCampaignRow = {
  id: number;
  name: string;
  query: string;
  enabled: boolean;
  created_by: string;
  last_ran_at: string | null;
  last_repositories: number | null;
  last_queued: number | null;
  created_at: string;
  updated_at: string;
};

function discoveryCampaignRow(row: {
  id: unknown;
  name: string;
  query: string;
  enabled: boolean;
  created_by: string;
  last_ran_at: string | Date | null;
  last_repositories: unknown;
  last_queued: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}): DiscoveryCampaignRow {
  return {
    id: num(row.id),
    name: row.name,
    query: row.query,
    enabled: row.enabled,
    created_by: row.created_by,
    last_ran_at: iso(row.last_ran_at),
    last_repositories: row.last_repositories == null ? null : num(row.last_repositories),
    last_queued: row.last_queued == null ? null : num(row.last_queued),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function packageProtectionRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  verified_via: string;
  github_repo: string | null;
  created_at: string | Date;
}): PackageProtectionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    verified_via: row.verified_via as PackageProtectionRow["verified_via"],
    github_repo: row.github_repo,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function protectedNamespaceRow(
  row: {
    id: unknown;
    installation_id: unknown;
    scope: string;
    created_by_login: string;
    last_checked_at: string | Date | null;
    created_at: string | Date;
  },
  names: string[] = [],
): ProtectedNamespaceRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    scope: row.scope,
    names,
    created_by_login: row.created_by_login,
    last_checked_at: iso(row.last_checked_at),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function namespaceSnapshotRow(row: {
  id: unknown;
  namespace_id: unknown;
  installation_id: unknown;
  names: unknown;
  created_at: string | Date;
}): NamespaceNameSnapshotRow {
  return {
    id: num(row.id),
    namespace_id: num(row.namespace_id),
    installation_id: num(row.installation_id),
    names: asStringArray(row.names).filter((name) => name.startsWith("@")).sort(),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function packageIdentitySnapshotRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  version: string | null;
  maintainers: unknown;
  repository_url: string | null;
  homepage: string | null;
  bin_names: unknown;
  lifecycle_scripts: unknown;
  published_at?: string | Date | null;
  dependency_names?: unknown;
  unpacked_bytes?: unknown;
  has_attestations?: boolean | null;
  attestation_predicate?: string | null;
  signature_keyids?: unknown;
  publisher_name?: string | null;
  trusted_publisher?: string | null;
  created_at: string | Date;
}): PackageIdentitySnapshotRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    version: row.version,
    maintainers: asStringArray(row.maintainers),
    repository_url: row.repository_url,
    homepage: row.homepage,
    bin_names: asStringArray(row.bin_names),
    lifecycle_scripts: asStringArray(row.lifecycle_scripts),
    published_at: iso(row.published_at ?? null),
    dependency_names: asStringArray(row.dependency_names),
    unpacked_bytes:
      row.unpacked_bytes === null || row.unpacked_bytes === undefined ? null : num(row.unpacked_bytes),
    has_attestations:
      row.has_attestations === true ? true : row.has_attestations === false ? false : null,
    attestation_predicate: row.attestation_predicate ?? null,
    signature_keyids: asStringArray(row.signature_keyids),
    publisher_name:
      typeof row.publisher_name === "string" && row.publisher_name.trim()
        ? row.publisher_name
        : null,
    trusted_publisher:
      typeof row.trusted_publisher === "string" && row.trusted_publisher.trim()
        ? row.trusted_publisher
        : null,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function identityEvidencePackRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  package_name: string;
  public_token: string;
  enabled: boolean;
  payload: unknown;
  created_by_login: string;
  updated_by_login: string;
  created_at: string | Date;
  updated_at: string | Date;
}): IdentityEvidencePackRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    package_name: row.package_name,
    public_token: row.public_token,
    enabled: row.enabled === true,
    payload: row.payload,
    created_by_login: row.created_by_login,
    updated_by_login: row.updated_by_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function identityCandidateRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  candidate_name: string;
  transformation: string;
  first_seen_at: string | Date;
  last_checked_at: string | Date | null;
  registered_at: string | Date | null;
  last_version: string | null;
  last_published_at: string | Date | null;
  allowlisted_at: string | Date | null;
  allowlist_reason: string | null;
  allowlisted_by_login: string | null;
}): IdentityCandidateRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: num(row.package_id),
    candidate_name: row.candidate_name,
    transformation: row.transformation,
    first_seen_at: iso(row.first_seen_at) ?? new Date().toISOString(),
    last_checked_at: iso(row.last_checked_at),
    registered_at: iso(row.registered_at),
    last_version: row.last_version,
    last_published_at: iso(row.last_published_at),
    allowlisted_at: iso(row.allowlisted_at),
    allowlist_reason: row.allowlist_reason,
    allowlisted_by_login: row.allowlisted_by_login,
  };
}

function parsePayload(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

function permissionTestFromDb(value: unknown): PermissionTestResult | null {
  const parsed = parsePayload(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const rec = parsed as Record<string, unknown>;
  if (rec.inventedIncident === true) return null;
  return parsed as PermissionTestResult;
}

function optionalInstallId(id?: number | null): number | null {
  return id && Number.isFinite(id) && id > 0 ? id : null;
}

function asNotificationKind(value: string): NotificationKind {
  if (value === "siem" || value === "jira" || value === "pagerduty") return value;
  return "slack";
}

function destinationRow(row: {
  id: unknown;
  installation_id: unknown;
  kind: string;
  host: string;
  project_key?: string | null;
  last_delivery_at: string | Date | null;
  last_delivery_status: string | null;
  last_delivery_error: string | null;
  updated_at: string | Date;
}): NotificationDestinationRow {
  return {
    id: num(row.id),
    installationId: num(row.installation_id),
    kind: asNotificationKind(row.kind),
    host: row.host,
    projectKey: row.project_key ?? null,
    lastDeliveryAt: iso(row.last_delivery_at),
    lastDeliveryStatus: row.last_delivery_status,
    lastDeliveryError: row.last_delivery_error,
    updatedAt: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function asRouteMinSeverity(value: string): RouteMinSeverity {
  if (value === "warn" || value === "critical") return value;
  return "all";
}

function routeRow(row: {
  id: unknown;
  installation_id: unknown;
  destination_id: unknown;
  min_severity: string;
  repo_full_name: string | null;
  package_name: string | null;
  team_login: string | null;
  created_at: string | Date;
}): NotificationRouteRow {
  return {
    id: num(row.id),
    installationId: num(row.installation_id),
    destinationId: num(row.destination_id),
    minSeverity: asRouteMinSeverity(row.min_severity),
    repoFullName: row.repo_full_name,
    packageName: row.package_name,
    teamLogin: row.team_login,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function alertRow(row: {
  id: unknown;
  installation_id: unknown;
  repo_id: unknown;
  kind: string;
  title: string;
  body: string;
  findings: unknown;
  github_delivery_id: string | null;
  acknowledged_at?: string | Date | null;
  acknowledged_by_login?: string | null;
  assigned_to_login?: string | null;
  resolved_at?: string | Date | null;
  resolved_by_login?: string | null;
  resolution_note?: string | null;
  created_at: string | Date;
  full_name?: string | null;
}): AlertRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    kind: row.kind,
    title: row.title,
    body: row.body,
    findings: parsePayload(row.findings),
    github_delivery_id: row.github_delivery_id,
    acknowledged_at: iso(row.acknowledged_at ?? null),
    acknowledged_by_login: row.acknowledged_by_login ?? null,
    assigned_to_login: row.assigned_to_login ?? null,
    resolved_at: iso(row.resolved_at ?? null),
    resolved_by_login: row.resolved_by_login ?? null,
    resolution_note: row.resolution_note ?? null,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    full_name: row.full_name ?? null,
  };
}

function installationIdFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = (payload as { installationId?: unknown }).installationId;
  const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function inviteRow(row: {
  id: unknown;
  github_login: string;
  role: string;
  created_at: string | Date;
}): InstallationInvite {
  return {
    id: num(row.id),
    githubLogin: row.github_login,
    role: asInstallationRole(row.role),
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
}

async function applyPendingInvite(
  db: SqlClient,
  installationId: number,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const { rows: userRows } = await tx.query<{ login: string }>(
      `SELECT login FROM users WHERE id = $1`,
      [userId],
    );
    const login = userRows[0]?.login ? githubLoginKey(userRows[0].login) : "";
    if (!login) return;
    const { rows: inviteRows } = await tx.query<{ id: unknown; role: string }>(
      `SELECT id, role FROM installation_invites
       WHERE installation_id = $1 AND github_login = $2
       FOR UPDATE`,
      [installationId, login],
    );
    const invite = inviteRows[0];
    if (!invite) return;
    const { rows: memberRows } = await tx.query<{ role: string }>(
      `SELECT role FROM installation_users
       WHERE installation_id = $1 AND user_id = $2
       FOR UPDATE`,
      [installationId, userId],
    );
    const member = memberRows[0];
    if (!member) return;
    const wanted = asInstallationRole(invite.role);
    if (wanted === "member" && asInstallationRole(member.role) === "admin") {
      const { rows: adminRows } = await tx.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM installation_users
         WHERE installation_id = $1 AND role = 'admin' AND user_id <> $2`,
        [installationId, userId],
      );
      if (num(adminRows[0]?.n ?? 0) === 0) {
        await tx.query(`DELETE FROM installation_invites WHERE id = $1`, [invite.id]);
        return;
      }
    }
    await tx.query(
      `UPDATE installation_users SET role = $3
       WHERE installation_id = $1 AND user_id = $2`,
      [installationId, userId, wanted],
    );
    await tx.query(`DELETE FROM installation_invites WHERE id = $1`, [invite.id]);
  });
}

function asDisclosureState(value: string): DisclosureState {
  if (
    value === "signal" ||
    value === "verifying" ||
    value === "verified" ||
    value === "false_positive" ||
    value === "duplicate"
  ) {
    return value;
  }
  return "signal";
}

function asDisclosureConversion(value: string): DisclosureConversion {
  if (value === "trial" || value === "paid" || value === "declined") return value;
  return "none";
}

function disclosureCaseRow(row: {
  id: unknown;
  prospect_id: unknown;
  state: string;
  checklist_public_artifact: boolean;
  checklist_reproduced: boolean;
  checklist_fingerprints_recorded: boolean;
  checklist_no_secret_values: boolean;
  checklist_contact_or_policy: boolean;
  fingerprints: unknown;
  security_contact: string | null;
  policy_url: string | null;
  notes_ciphertext: string | null;
  notes_expires_at: string | Date | null;
  draft_subject: string | null;
  draft_body: string | null;
  draft_sent: boolean;
  acknowledgement_note: string | null;
  acknowledged_at: string | Date | null;
  deadline_at: string | Date | null;
  conversion: string;
  fix_version: string | null;
  last_rescan_at: string | Date | null;
  vendor_channel: string | null;
  outcome_credit: string | null;
  outcome_cve: string | null;
  outcome_notes: string | null;
  assignee?: string | null;
  review_state?: string | null;
  review_note?: string | null;
  reviewed_at?: string | Date | null;
  reviewed_by?: string | null;
  verified_at?: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}): DisclosureCaseRow {
  return {
    id: num(row.id),
    prospect_id: num(row.prospect_id),
    state: asDisclosureState(row.state),
    checklist_public_artifact: Boolean(row.checklist_public_artifact),
    checklist_reproduced: Boolean(row.checklist_reproduced),
    checklist_fingerprints_recorded: Boolean(row.checklist_fingerprints_recorded),
    checklist_no_secret_values: Boolean(row.checklist_no_secret_values),
    checklist_contact_or_policy: Boolean(row.checklist_contact_or_policy),
    fingerprints: asStringArray(row.fingerprints),
    security_contact: row.security_contact,
    policy_url: row.policy_url,
    notes_ciphertext: row.notes_ciphertext,
    notes_expires_at: iso(row.notes_expires_at),
    draft_subject: row.draft_subject,
    draft_body: row.draft_body,
    draft_sent: false,
    acknowledgement_note: row.acknowledgement_note,
    acknowledged_at: iso(row.acknowledged_at),
    deadline_at: iso(row.deadline_at),
    conversion: asDisclosureConversion(row.conversion),
    fix_version: row.fix_version,
    last_rescan_at: iso(row.last_rescan_at),
    vendor_channel: asVendorChannel(row.vendor_channel),
    outcome_credit: row.outcome_credit,
    outcome_cve: row.outcome_cve,
    outcome_notes: row.outcome_notes,
    assignee: row.assignee ?? null,
    review_state: asReviewState(row.review_state),
    review_note: row.review_note ?? null,
    reviewed_at: iso(row.reviewed_at),
    reviewed_by: row.reviewed_by ?? null,
    verified_at: iso(row.verified_at),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function asReviewState(value: string | null | undefined): DisclosureReviewState {
  if (value === "pending" || value === "approved" || value === "rejected") return value;
  return "none";
}

function asReplyChannel(value: string): VendorReplyChannel {
  if (
    value === "security_email" ||
    value === "form" ||
    value === "security_txt" ||
    value === "platform" ||
    value === "other"
  ) {
    return value;
  }
  return "other";
}

function asVendorChannel(value: string | null | undefined): VendorChannel | null {
  if (
    value === "security_email" ||
    value === "form" ||
    value === "security_txt" ||
    value === "platform"
  ) {
    return value;
  }
  return null;
}

function internalNotificationRow(row: {
  id: unknown;
  kind: string;
  prospect_id: unknown;
  case_id: unknown;
  title: string;
  fingerprints: unknown;
  rules: unknown;
  read_at: string | Date | null;
  created_at: string | Date;
}): InternalNotificationRow {
  return {
    id: num(row.id),
    kind: row.kind === "deadline_missed" ? "deadline_missed" : "verified_critical",
    prospect_id: num(row.prospect_id),
    case_id: num(row.case_id),
    title: row.title,
    fingerprints: asStringArray(row.fingerprints),
    rules: asStringArray(row.rules),
    read_at: iso(row.read_at),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function disclosureTemplateRow(row: {
  id: unknown;
  name: string;
  subject: string;
  body: string;
  created_at: string | Date;
  updated_at: string | Date;
}): DisclosureTemplateRow {
  return {
    id: num(row.id),
    name: row.name,
    subject: row.subject,
    body: row.body,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function doNotContactRow(row: {
  id: unknown;
  owner: string | null;
  repo: string | null;
  package_name: string | null;
  contact: string | null;
  reason: string;
  created_by: string;
  created_at: string | Date;
}): DoNotContactRow {
  return {
    id: num(row.id),
    owner: row.owner,
    repo: row.repo,
    package_name: row.package_name,
    contact: row.contact,
    reason: row.reason,
    created_by: row.created_by,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function disclosureDestinationRow(row: {
  id: unknown;
  kind: string;
  host: string;
  project_key: string | null;
  secret_ciphertext: string;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}): DisclosureDestinationRow {
  return {
    id: num(row.id),
    kind: asDisclosureDestinationKind(row.kind),
    host: row.host,
    project_key: row.project_key,
    secret_ciphertext: row.secret_ciphertext,
    created_by: row.created_by,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function operatorGrantRow(row: {
  id: unknown;
  github_login: string;
  created_by: string;
  created_at: string | Date;
}): OperatorGrantRow {
  return {
    id: num(row.id),
    github_login: row.github_login,
    created_by: row.created_by,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function disclosureEventRow(row: {
  id: unknown;
  case_id: unknown;
  action: string;
  actor: string;
  summary: string;
  created_at: string | Date;
}): DisclosureEventRow {
  return {
    id: num(row.id),
    case_id: num(row.case_id),
    action: row.action,
    actor: row.actor,
    summary: row.summary,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function prospectRow(row: ProspectRow & { workspace_members?: unknown; feed_checked_at?: string | Date | null }): ProspectRow {
  return {
    ...row,
    id: num(row.id),
    artifact_bytes: row.artifact_bytes === null ? null : num(row.artifact_bytes),
    file_count: row.file_count === null ? null : num(row.file_count),
    critical_count: row.critical_count === null ? null : num(row.critical_count),
    warning_count: row.warning_count === null ? null : num(row.warning_count),
    findings: parsePayload(row.findings),
    workspace_members: asStringArray(row.workspace_members),
    feed_checked_at: iso(row.feed_checked_at ?? null),
  };
}

function asStringArray(value: unknown): string[] {
  const raw = parsePayload(value);
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function asManifest(value: unknown): ManifestEntry[] {
  const raw = parsePayload(value);
  if (!Array.isArray(raw)) return [];
  const out: ManifestEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.path !== "string" || typeof row.sha256 !== "string") continue;
    const size = typeof row.size === "number" ? row.size : Number(row.size);
    if (!Number.isFinite(size)) continue;
    out.push({ path: row.path, size, sha256: row.sha256 });
  }
  return out;
}

type ReleaseRevisionSqlRow = {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  receipt_id: unknown;
  channel: string;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes?: unknown;
  media_type?: string | null;
  source_revision: string | null;
  ci_run_url: string | null;
  previous_sha256: string | null;
  mismatch: boolean | unknown;
  created_at: string | Date;
  receipt_status?: string | null;
};

function parseReceiptStatus(value: unknown): ScanStatus | null {
  if (value === "passed" || value === "failed-policy" || value === "inconclusive") return value;
  return null;
}

function releaseRevisionRow(row: ReleaseRevisionSqlRow): ReleaseRevisionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id === null || row.package_id === undefined ? null : num(row.package_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    receipt_id: num(row.receipt_id),
    channel: row.channel as ReleaseChannel,
    coordinate: row.coordinate,
    artifact_sha256: row.artifact_sha256,
    artifact_sha512: row.artifact_sha512,
    artifact_bytes:
      row.artifact_bytes === null || row.artifact_bytes === undefined ? null : num(row.artifact_bytes),
    media_type: row.media_type ?? null,
    source_revision: row.source_revision,
    ci_run_url: row.ci_run_url,
    previous_sha256: row.previous_sha256,
    mismatch: Boolean(row.mismatch),
    receipt_status: parseReceiptStatus(row.receipt_status),
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function parseDeliveryVerifyStatus(value: unknown): DeliveryVerifyStatus | null {
  if (
    value === "matched" ||
    value === "mismatch" ||
    value === "missing" ||
    value === "redirect" ||
    value === "content_type" ||
    value === "blocked" ||
    value === "error"
  ) {
    return value;
  }
  return null;
}

function deliveryLocationRow(row: {
  id: unknown;
  installation_id: unknown;
  revision_id: unknown;
  url: string;
  host: string;
  expected_media_type: string | null;
  created_by_login: string;
  created_at: string | Date;
  last_status?: string | null;
  last_sha256?: string | null;
  last_media_type?: string | null;
  last_redirect_hosts?: string | null;
  last_cache_state?: string | null;
  last_region?: string | null;
  last_checked_at?: string | Date | null;
}): DeliveryLocationRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    revision_id: num(row.revision_id),
    url: row.url,
    host: row.host,
    expected_media_type: row.expected_media_type,
    created_by_login: row.created_by_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    last_status: parseDeliveryVerifyStatus(row.last_status ?? null),
    last_sha256: row.last_sha256 ?? null,
    last_media_type: row.last_media_type ?? null,
    last_redirect_hosts: row.last_redirect_hosts ?? null,
    last_cache_state: row.last_cache_state ?? null,
    last_region: row.last_region ?? null,
    last_checked_at: iso(row.last_checked_at ?? null),
  };
}

function deliveryVerificationRow(row: {
  id: unknown;
  installation_id: unknown;
  location_id: unknown;
  revision_id: unknown;
  status: string;
  observed_sha256: string | null;
  observed_sha512: string | null;
  observed_bytes: unknown;
  observed_media_type: string | null;
  final_host: string | null;
  redirect_count: unknown;
  redirect_hosts?: string | null;
  cache_state?: string | null;
  delivery_region?: string | null;
  error: string | null;
  created_at: string | Date;
}): DeliveryVerificationRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    location_id: num(row.location_id),
    revision_id: num(row.revision_id),
    status: parseDeliveryVerifyStatus(row.status) ?? "error",
    observed_sha256: row.observed_sha256,
    observed_sha512: row.observed_sha512,
    observed_bytes: row.observed_bytes == null ? null : num(row.observed_bytes),
    observed_media_type: row.observed_media_type,
    final_host: row.final_host,
    redirect_count: num(row.redirect_count),
    redirect_hosts: row.redirect_hosts ?? null,
    cache_state: row.cache_state ?? null,
    delivery_region: row.delivery_region ?? null,
    error: row.error,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

type ReleaseApprovalSqlRow = {
  id: unknown;
  installation_id: unknown;
  revision_id: unknown;
  decision: string;
  reason: string;
  actor_login: string;
  created_at: string | Date;
};

type ReleaseLegalHoldSqlRow = {
  id: unknown;
  installation_id: unknown;
  revision_id: unknown;
  action: string;
  reason: string;
  actor_login: string;
  created_at: string | Date;
};

function releaseApprovalRow(row: ReleaseApprovalSqlRow): ReleaseApprovalRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    revision_id: num(row.revision_id),
    decision: row.decision === "rejected" ? "rejected" : "approved",
    reason: row.reason,
    actor_login: row.actor_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function releaseLegalHoldRow(row: ReleaseLegalHoldSqlRow): ReleaseLegalHoldRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    revision_id: num(row.revision_id),
    action: row.action === "release" ? "release" : "place",
    reason: row.reason,
    actor_login: row.actor_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

type ReleasePublicPageSqlRow = {
  id: unknown;
  installation_id: unknown;
  revision_id: unknown;
  public_token: string;
  enabled: boolean | unknown;
  created_by_login: string;
  updated_by_login: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function releasePublicPageRow(row: ReleasePublicPageSqlRow): ReleasePublicPageRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    revision_id: num(row.revision_id),
    public_token: row.public_token,
    enabled: Boolean(row.enabled),
    created_by_login: row.created_by_login,
    updated_by_login: row.updated_by_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function scanReceiptRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  coordinate: string;
  artifact_sha256: string;
  artifact_sha512: string | null;
  artifact_bytes: unknown;
  status: string;
  engine_version: string;
  manifest: unknown;
  finding_fingerprints: unknown;
  signature: string;
  receipt: unknown;
  created_at: string | Date;
}): ScanReceiptRow {
  const parsedReceipt = parsePayload(row.receipt);
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id === null || row.package_id === undefined ? null : num(row.package_id),
    repo_id: row.repo_id === null || row.repo_id === undefined ? null : num(row.repo_id),
    coordinate: row.coordinate,
    artifact_sha256: row.artifact_sha256,
    artifact_sha512: row.artifact_sha512,
    artifact_bytes: row.artifact_bytes === null || row.artifact_bytes === undefined ? null : num(row.artifact_bytes),
    status: row.status as ScanStatus,
    engine_version: row.engine_version,
    manifest: asManifest(row.manifest),
    finding_fingerprints: asStringArray(row.finding_fingerprints),
    signature: row.signature,
    receipt: parsedReceipt as SignedReceipt,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return parseStringArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function asMapKind(value: string): MapDestinationKind {
  return value === "bugsnag" ? "bugsnag" : "sentry";
}

function parseDistTags(value: unknown): Record<string, string> | null {
  const raw = parsePayload(value);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function watchedPackageRow(row: {
  id: unknown;
  installation_id: unknown;
  package_name: string;
  registry_origin?: string | null;
  last_version: string | null;
  last_dist_tags: unknown;
  last_tarball_url: string | null;
  last_shasum: string | null;
  last_sha256: string | null;
  last_checked_at: string | Date | null;
  last_scanned_at: string | Date | null;
  last_scan_status: string | null;
  last_debug_ids?: unknown;
  last_release?: string | null;
  last_public_map?: boolean | null;
}): WatchedPackageRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_name: row.package_name,
    registry_origin: row.registry_origin?.trim() || PUBLIC_NPM_ORIGIN,
    last_version: row.last_version,
    last_dist_tags: parseDistTags(row.last_dist_tags),
    last_tarball_url: row.last_tarball_url,
    last_shasum: row.last_shasum,
    last_sha256: row.last_sha256,
    last_checked_at: iso(row.last_checked_at),
    last_scanned_at: iso(row.last_scanned_at),
    last_scan_status: row.last_scan_status,
    last_debug_ids: parseStringArray(row.last_debug_ids),
    last_release: row.last_release ?? null,
    last_public_map: Boolean(row.last_public_map),
  };
}

function watchedOriginRow(row: {
  id: unknown;
  installation_id: unknown;
  origin_url: string;
  host: string;
  last_sha256: string | null;
  last_checked_at: string | Date | null;
  last_scanned_at: string | Date | null;
  last_scan_status: string | null;
  last_debug_ids?: unknown;
  last_release?: string | null;
  last_public_map?: boolean | null;
}): WatchedOriginRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    origin_url: row.origin_url,
    host: row.host,
    last_sha256: row.last_sha256,
    last_checked_at: iso(row.last_checked_at),
    last_scanned_at: iso(row.last_scanned_at),
    last_scan_status: row.last_scan_status,
    last_debug_ids: parseStringArray(row.last_debug_ids),
    last_release: row.last_release ?? null,
    last_public_map: Boolean(row.last_public_map),
  };
}

function mapDestinationRow(row: {
  id: unknown;
  installation_id: unknown;
  kind: string;
  host: string;
  org_slug: string | null;
  project_slug: string;
  last_checked_at: string | Date | null;
  last_status: string | null;
  last_error: string | null;
  last_fingerprint: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): MapDestinationRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    kind: asMapKind(row.kind),
    host: row.host,
    org_slug: row.org_slug,
    project_slug: row.project_slug,
    last_checked_at: iso(row.last_checked_at),
    last_status: row.last_status,
    last_error: row.last_error,
    last_fingerprint: row.last_fingerprint,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    updated_at: iso(row.updated_at) ?? new Date().toISOString(),
  };
}

function policyExceptionRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  rule: string;
  path_pattern: string | null;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  revoked_by: string | null;
  created_at: string | Date;
}): PolicyExceptionRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id == null ? null : num(row.package_id),
    rule: row.rule,
    path_pattern: row.path_pattern,
    reason: row.reason,
    actor_user_id: row.actor_user_id,
    actor_login: row.actor_login,
    expires_at: iso(row.expires_at) ?? new Date().toISOString(),
    revoked_at: iso(row.revoked_at),
    revoked_by: row.revoked_by,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
  };
}

function scanBaselineRow(row: {
  id: unknown;
  installation_id: unknown;
  package_id: unknown;
  repo_id: unknown;
  receipt_id: unknown;
  reason: string;
  actor_user_id: string;
  actor_login: string;
  created_at: string | Date;
  superseded_at: string | Date | null;
}): ScanBaselineRow {
  return {
    id: num(row.id),
    installation_id: num(row.installation_id),
    package_id: row.package_id == null ? null : num(row.package_id),
    repo_id: row.repo_id == null ? null : num(row.repo_id),
    receipt_id: num(row.receipt_id),
    reason: row.reason,
    actor_user_id: row.actor_user_id,
    actor_login: row.actor_login,
    created_at: iso(row.created_at) ?? new Date().toISOString(),
    superseded_at: iso(row.superseded_at),
  };
}

export function createStore(
  sql: SqlClient,
  opts: { jobMaxAttempts?: number; jobRetryBaseMs?: number; tokenSecret?: string } = {},
) {
  const jobMaxAttempts = opts.jobMaxAttempts ?? 5;
  const jobRetryBaseMs = opts.jobRetryBaseMs ?? 15_000;
  const tokenSecret = opts.tokenSecret?.trim() ?? "";
  return {
    sql,

    async ping(): Promise<boolean> {
      const { rows } = await sql.query<{ ok: string | number }>("SELECT 1 AS ok");
      return Number(rows[0]?.ok) === 1;
    },

    async upsertUser(input: {
      id: string;
      login: string;
      avatarUrl?: string;
      accessToken?: string;
    }): Promise<void> {
      const accessToken =
        input.accessToken && tokenSecret
          ? encryptSecret(input.accessToken, tokenSecret)
          : (input.accessToken ?? null);
      await sql.query(
        `INSERT INTO users (id, login, avatar_url, access_token, trial_ends_at, plan)
         VALUES ($1, $2, $3, $4, now() + interval '14 days', 'trial')
         ON CONFLICT (id) DO UPDATE SET
           login = excluded.login,
           avatar_url = excluded.avatar_url,
           access_token = COALESCE(excluded.access_token, users.access_token),
           trial_ends_at = COALESCE(users.trial_ends_at, now() + interval '14 days'),
           plan = COALESCE(users.plan, 'trial')`,
        [input.id, input.login, input.avatarUrl ?? null, accessToken],
      );
    },

    async createSession(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): Promise<string> {
      const id = randomBytes(24).toString("hex");
      const expires = new Date(Date.now() + ttlMs).toISOString();
      await sql.query(
        `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
        [id, userId, expires],
      );
      return id;
    },

    async getSession(id: string): Promise<{
      userId: string
      login: string
      avatarUrl: string | null
      trialEndsAt: string | null
      plan: string | null
    } | null> {
      const { rows } = await sql.query<{
        user_id: string
        login: string
        avatar_url: string | null
        trial_ends_at: string | Date | null
        plan: string | null
      }>(
        `SELECT s.user_id, u.login, u.avatar_url, u.trial_ends_at, u.plan
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > now()`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      const trialEndsAt =
        row.trial_ends_at instanceof Date ? row.trial_ends_at.toISOString() : row.trial_ends_at
      return {
        userId: row.user_id,
        login: row.login,
        avatarUrl: row.avatar_url,
        trialEndsAt,
        plan: row.plan,
      }
    },

    async userExists(userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [
        userId,
      ]);
      return Boolean(rows[0]);
    },

    async deleteSession(id: string): Promise<void> {
      await sql.query(`DELETE FROM sessions WHERE id = $1`, [id]);
    },

    async deleteUserSessions(userId: string): Promise<void> {
      await sql.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    },

    async clearUserAccessToken(userId: string): Promise<void> {
      await sql.query(`UPDATE users SET access_token = NULL WHERE id = $1`, [userId]);
    },

    async getUserAccessToken(userId: string): Promise<string | null> {
      const { rows } = await sql.query<{ access_token: string | null }>(
        `SELECT access_token FROM users WHERE id = $1`,
        [userId],
      );
      const stored = rows[0]?.access_token?.trim();
      if (!stored) return null;
      if (!tokenSecret) return stored;
      const plain = decryptSecret(stored, tokenSecret);
      if (!looksEncrypted(stored)) {
        await sql.query(`UPDATE users SET access_token = $2 WHERE id = $1`, [
          userId,
          encryptSecret(plain, tokenSecret),
        ]);
      }
      return plain;
    },

    async upsertInstallation(input: {
      id: number;
      accountLogin: string;
      accountType: string;
      accountId: number;
      suspended?: boolean;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO installations (id, account_login, account_type, account_id, suspended)
         VALUES ($1, $2, $3, $4, COALESCE($5, false))
         ON CONFLICT (id) DO UPDATE SET
           account_login = excluded.account_login,
           account_type = excluded.account_type,
           account_id = excluded.account_id,
           suspended = COALESCE($5, installations.suspended)`,
        [
          input.id,
          input.accountLogin,
          input.accountType,
          input.accountId,
          input.suspended ?? null,
        ],
      );
      await sql.query(
        `INSERT INTO billing_accounts (installation_id, trial_ends_at, plan)
         VALUES ($1, now() + interval '14 days', 'trial')
         ON CONFLICT (installation_id) DO NOTHING`,
        [input.id],
      );
    },

    async installationWorkBlock(
      installationId: number,
    ): Promise<{ reason: "suspended" | "unpaid" } | null> {
      const { rows } = await sql.query<{
        suspended: boolean;
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT i.suspended, b.trial_ends_at, b.plan
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return { reason: "unpaid" };
      if (row.suspended) return { reason: "suspended" };
      if (!coverageIsOn(coverageFrom(iso(row.trial_ends_at), row.plan))) return { reason: "unpaid" };
      return null;
    },

    async installationWorkAllowed(installationId: number): Promise<boolean> {
      return (await this.installationWorkBlock(installationId)) === null;
    },

    async installationHasCoverage(installationId: number): Promise<boolean> {
      const { rows } = await sql.query<{
        trial_ends_at: string | Date | null;
        plan: string | null;
      }>(
        `SELECT b.trial_ends_at, b.plan
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return false;
      return coverageIsOn(coverageFrom(iso(row.trial_ends_at), row.plan));
    },

    async installationBilling(
      installationId: number,
    ): Promise<{ trialEndsAt: string | null; plan: string | null; retentionDays: number } | null> {
      const { rows } = await sql.query<{
        trial_ends_at: string | Date | null;
        plan: string | null;
        retention_days: unknown;
      }>(
        `SELECT b.trial_ends_at, b.plan, COALESCE(b.retention_days, 90) AS retention_days
         FROM installations i
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE i.id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return null;
      const retentionDays = num(row.retention_days);
      return {
        trialEndsAt: iso(row.trial_ends_at),
        plan: row.plan,
        retentionDays: retentionDays === 0 || retentionDays === 90 || retentionDays === 180 || retentionDays === 365
          ? retentionDays
          : 90,
      };
    },

    async setRetentionDays(installationId: number, days: 0 | 90 | 180 | 365): Promise<void> {
      await sql.query(
        `INSERT INTO billing_accounts (installation_id, trial_ends_at, plan, retention_days)
         VALUES ($1, now() + interval '14 days', 'trial', $2)
         ON CONFLICT (installation_id) DO UPDATE SET retention_days = excluded.retention_days`,
        [installationId, days],
      );
    },

    async deleteInstallation(id: number): Promise<void> {
      await sql.query(`DELETE FROM jobs WHERE installation_id = $1`, [id]);
      await sql.query(`DELETE FROM installations WHERE id = $1`, [id]);
    },

    async getInstallation(id: number): Promise<{
      id: number;
      account_login: string;
      account_type: string;
      account_id: number;
      suspended: boolean;
    } | null> {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
        account_id: unknown;
        suspended: boolean;
      }>(
        `SELECT id, account_login, account_type, account_id, suspended FROM installations WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: num(row.id),
        account_login: row.account_login,
        account_type: row.account_type,
        account_id: num(row.account_id),
        suspended: Boolean(row.suspended),
      };
    },

    async linkUserInstallation(installationId: number, userId: string): Promise<void> {
      await sql.query(
        `INSERT INTO installation_users (installation_id, user_id, role)
         VALUES (
           $1,
           $2,
           CASE
             WHEN EXISTS (
               SELECT 1 FROM installation_users WHERE installation_id = $1
             ) THEN 'member'
             ELSE 'admin'
           END
         )
         ON CONFLICT DO NOTHING`,
        [installationId, userId],
      );
      await applyPendingInvite(sql, installationId, userId);
    },

    async linkUserToAccountInstallations(userId: string, githubUserId: number): Promise<void> {
      await sql.query(
        `INSERT INTO installation_users (installation_id, user_id, role)
         SELECT i.id,
                $1,
                CASE
                  WHEN EXISTS (
                    SELECT 1 FROM installation_users iu WHERE iu.installation_id = i.id
                  ) THEN 'member'
                  ELSE 'admin'
                END
         FROM installations i
         WHERE account_type = 'User' AND account_id = $2
         ON CONFLICT DO NOTHING`,
        [userId, githubUserId],
      );
      const { rows } = await sql.query<{ installation_id: unknown }>(
        `SELECT iu.installation_id
         FROM installation_users iu
         JOIN installation_invites inv ON inv.installation_id = iu.installation_id
         JOIN users u ON u.id = iu.user_id
         WHERE iu.user_id = $1
           AND inv.github_login = lower(u.login)`,
        [userId],
      );
      for (const row of rows) {
        await applyPendingInvite(sql, num(row.installation_id), userId);
      }
    },

    async upsertRepo(input: {
      id: number;
      installationId: number;
      owner: string;
      name: string;
      fullName: string;
      private: boolean;
      htmlUrl: string;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO repos (id, installation_id, owner, name, full_name, private, html_url, last_private, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $6, now())
         ON CONFLICT (id) DO UPDATE SET
           installation_id = excluded.installation_id,
           owner = excluded.owner,
           name = excluded.name,
           full_name = excluded.full_name,
           private = excluded.private,
           html_url = excluded.html_url`,
        [
          input.id,
          input.installationId,
          input.owner,
          input.name,
          input.fullName,
          input.private,
          input.htmlUrl,
        ],
      );
    },

    async removeRepo(id: number): Promise<void> {
      await sql.query(`DELETE FROM repos WHERE id = $1`, [id]);
    },

    async getRepo(id: number): Promise<RepoRow | null> {
      const { rows } = await sql.query<RepoRow>(`SELECT * FROM repos WHERE id = $1`, [id]);
      const row = rows[0];
      if (!row) return null;
      return { ...row, id: num(row.id), installation_id: num(row.installation_id) };
    },

    async listReposForInstallation(installationId: number): Promise<RepoRow[]> {
      const { rows } = await sql.query<RepoRow>(
        `SELECT * FROM repos WHERE installation_id = $1 ORDER BY full_name`,
        [installationId],
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async listReposForUser(userId: string, installationId?: number | null): Promise<RepoRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<RepoRow>(
        `SELECT r.*
         FROM repos r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR r.installation_id = $2)
         ORDER BY r.full_name`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async listAllRepos(): Promise<RepoRow[]> {
      const { rows } = await sql.query<RepoRow>(
        `SELECT r.* FROM repos r
         JOIN installations i ON i.id = r.installation_id
         WHERE i.suspended = false
         ORDER BY r.id`,
      );
      return rows.map((row) => ({
        ...row,
        id: num(row.id),
        installation_id: num(row.installation_id),
      }));
    },

    async updateRepoCheck(id: number, isPrivate: boolean): Promise<void> {
      await sql.query(
        `UPDATE repos SET private = $2, last_private = $2, last_checked_at = now() WHERE id = $1`,
        [id, isPrivate],
      );
    },

    async enqueueJob(input: {
      deliveryId?: string | null;
      priority: JobPriority;
      kind: string;
      payload: unknown;
      installationId?: number | null;
    }): Promise<{ id: number | null; inserted: boolean; skipped?: "fair_use" }> {
      const installationId = input.installationId ?? installationIdFromPayload(input.payload);
      return await sql.transaction(async (tx) => {
        const countsTowardUsage =
          input.priority === "heavy" &&
          input.kind !== "prospect_scan" &&
          installationId != null;
        let consumed = false;
        if (countsTowardUsage) {
          const { rows: billed } = await tx.query<{ ok: number }>(
            `SELECT 1 AS ok
             FROM installations i
             JOIN billing_accounts b ON b.installation_id = i.id
             WHERE i.id = $1`,
            [installationId],
          );
          if (billed[0]) {
            const { rows: used } = await tx.query<{ heavy_jobs: unknown }>(
              `INSERT INTO hosted_usage_days (installation_id, day, heavy_jobs)
               SELECT $1, (timezone('utc', now()))::date, 1
               WHERE EXISTS (
                 SELECT 1 FROM installations i
                 JOIN billing_accounts b ON b.installation_id = i.id
                 WHERE i.id = $1
               )
               ON CONFLICT (installation_id, day)
               DO UPDATE SET heavy_jobs = hosted_usage_days.heavy_jobs + 1
               WHERE hosted_usage_days.heavy_jobs < (
                 SELECT ${heavyUsageCapSql()}
                 FROM billing_accounts b
                 WHERE b.installation_id = hosted_usage_days.installation_id
               )
               RETURNING heavy_jobs`,
              [installationId],
            );
            if (!used[0]) return { id: null, inserted: false, skipped: "fair_use" as const };
            consumed = true;
          }
        }

        const { rows } = await tx.query<{ id: unknown }>(
          `INSERT INTO jobs (delivery_id, installation_id, priority, kind, payload)
           VALUES (
             $1,
             CASE
               WHEN $5::bigint IS NULL THEN NULL
               WHEN EXISTS (SELECT 1 FROM installations WHERE id = $5::bigint) THEN $5::bigint
               ELSE NULL
             END,
             $2, $3, $4::jsonb
           )
           ON CONFLICT (delivery_id) WHERE delivery_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [
            input.deliveryId ?? null,
            input.priority,
            input.kind,
            JSON.stringify(input.payload),
            installationId,
          ],
        );
        const id = rows[0] ? num(rows[0].id) : null;
        if (!id && consumed && installationId != null) {
          await tx.query(
            `UPDATE hosted_usage_days
             SET heavy_jobs = GREATEST(0, heavy_jobs - 1)
             WHERE installation_id = $1 AND day = (timezone('utc', now()))::date`,
            [installationId],
          );
        }
        return { id, inserted: id !== null };
      });
    },

    async consumeHostedUnpack(installationId: number): Promise<boolean> {
      return await sql.transaction(async (tx) => {
        const { rows: billed } = await tx.query<{ ok: number }>(
          `SELECT 1 AS ok
           FROM installations i
           JOIN billing_accounts b ON b.installation_id = i.id
           WHERE i.id = $1`,
          [installationId],
        );
        if (!billed[0]) return false;
        const { rows: used } = await tx.query<{ heavy_jobs: unknown }>(
          `INSERT INTO hosted_usage_days (installation_id, day, heavy_jobs)
           SELECT $1, (timezone('utc', now()))::date, 1
           ON CONFLICT (installation_id, day)
           DO UPDATE SET heavy_jobs = hosted_usage_days.heavy_jobs + 1
           WHERE hosted_usage_days.heavy_jobs < (
             SELECT ${heavyUsageCapSql()}
             FROM billing_accounts b
             WHERE b.installation_id = hosted_usage_days.installation_id
           )
           RETURNING heavy_jobs`,
          [installationId],
        );
        return Boolean(used[0]);
      });
    },

    async refundHostedUnpack(installationId: number): Promise<void> {
      await sql.query(
        `UPDATE hosted_usage_days
         SET heavy_jobs = GREATEST(0, heavy_jobs - 1)
         WHERE installation_id = $1 AND day = (timezone('utc', now()))::date`,
        [installationId],
      );
    },

    async hostedUsageStatus(installationId: number): Promise<HostedUsageStatus> {
      const { rows } = await sql.query<{ used: unknown; cap: unknown }>(
        `SELECT COALESCE(u.heavy_jobs, 0)::int AS used, (${heavyUsageCapSql()})::int AS cap
         FROM billing_accounts b
         LEFT JOIN hosted_usage_days u
           ON u.installation_id = b.installation_id AND u.day = (timezone('utc', now()))::date
         WHERE b.installation_id = $1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return hostedUsageStatus(0, SOLO_HEAVY_PER_UTC_DAY);
      return hostedUsageStatus(num(row.used), num(row.cap));
    },

    async noteFairUseExhausted(installationId: number): Promise<number> {
      return await this.insertAlert({
        installationId,
        kind: FAIR_USE_ALERT_KIND,
        title: "Hosted unpacks paused until UTC midnight",
        body: `${FAIR_USE_EXHAUSTED} This is not a remaining-scan credit balance.`,
        githubDeliveryId: fairUseDeliveryId(installationId),
      });
    },

    async countRunning(priority: JobPriority): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM jobs WHERE status = 'running' AND priority = $1`,
        [priority],
      );
      return num(rows[0]?.n ?? 0);
    },

    async claimJob(
      priority: JobPriority,
      cap: number,
      workerId: string,
      includeProspectScans = true,
    ): Promise<JobRow | null> {
      return await sql.transaction(async (tx) => {
        const { rows: countRows } = await tx.query<{ n: unknown }>(
          `SELECT count(*)::int AS n FROM jobs WHERE status = 'running' AND priority = $1`,
          [priority],
        );
        if (num(countRows[0]?.n ?? 0) >= cap) return null;

        const fairUse =
          priority === "heavy"
            ? `AND (
                 j.installation_id IS NULL
                 OR (
                   SELECT count(*)::int FROM jobs r
                   WHERE r.status = 'running' AND r.priority = j.priority
                     AND r.installation_id = j.installation_id
                 ) < ${heavyFairUseCaseSql()}
               )`
            : "";

        const { rows: picked } = await tx.query<{ id: unknown }>(
          `SELECT j.id FROM jobs j
           LEFT JOIN billing_accounts b ON b.installation_id = j.installation_id
           WHERE j.status = 'queued' AND j.priority = $1 AND j.run_after <= now()
             AND ($2::boolean OR j.kind <> 'prospect_scan')
             ${fairUse}
           ORDER BY CASE WHEN j.kind = 'prospect_scan' THEN 1 ELSE 0 END, j.id
           FOR UPDATE OF j SKIP LOCKED
           LIMIT 1`,
          [priority, includeProspectScans],
        );
        const pickedId = picked[0]?.id;
        if (pickedId === undefined) return null;

        const { rows } = await tx.query<JobRow>(
          `UPDATE jobs
           SET status = 'running', locked_at = now(), locked_by = $2, attempts = attempts + 1
           WHERE id = $1
           RETURNING id, delivery_id, priority, kind, payload, status, attempts`,
          [pickedId, workerId],
        );
        const row = rows[0];
        if (!row) return null;
        return {
          ...row,
          id: num(row.id),
          payload: parsePayload(row.payload),
        };
      });
    },

    async finishJob(id: number, error?: string): Promise<void> {
      if (!error) {
        await sql.query(
          `UPDATE jobs SET status = 'done', error = NULL, locked_at = NULL, locked_by = NULL WHERE id = $1`,
          [id],
        );
        return;
      }
      const { rows } = await sql.query<{ attempts: unknown }>(
        `SELECT attempts FROM jobs WHERE id = $1`,
        [id],
      );
      const attempts = num(rows[0]?.attempts ?? 0);
      if (attempts >= jobMaxAttempts) {
        await sql.query(
          `UPDATE jobs SET status = 'failed', error = $2, locked_at = NULL, locked_by = NULL WHERE id = $1`,
          [id, error],
        );
        return;
      }
      const delayMs = Math.min(900_000, jobRetryBaseMs * 2 ** Math.max(attempts - 1, 0));
      const runAfter = new Date(Date.now() + delayMs).toISOString();
      await sql.query(
        `UPDATE jobs SET status = 'queued', error = $2, run_after = $3::timestamptz, locked_at = NULL, locked_by = NULL WHERE id = $1`,
        [id, error, runAfter],
      );
    },

    async recoverStaleJobs(staleAfterMs: number): Promise<number> {
      const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
      const { rows } = await sql.query<{ n: unknown }>(
        `WITH recovered AS (
           UPDATE jobs
           SET status = 'queued', locked_at = NULL, locked_by = NULL,
               error = COALESCE(error, 'stale lock recovered')
           WHERE status = 'running' AND locked_at < $1::timestamptz
           RETURNING id
         )
         SELECT count(*)::int AS n FROM recovered`,
        [cutoff],
      );
      return num(rows[0]?.n ?? 0);
    },

    async ownerQueueHealth(staleAfterMs: number): Promise<OwnerQueueHealth> {
      const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
      const { rows } = await sql.query<{
        customer_queued: unknown;
        customer_running: unknown;
        customer_failed: unknown;
        prospect_queued: unknown;
        prospect_running: unknown;
        prospect_failed: unknown;
        heavy_queued: unknown;
        light_queued: unknown;
        stale_running: unknown;
        oldest_queued_age_ms: unknown;
      }>(
        `SELECT
           count(*) FILTER (WHERE kind <> 'prospect_scan' AND status = 'queued')::int AS customer_queued,
           count(*) FILTER (WHERE kind <> 'prospect_scan' AND status = 'running')::int AS customer_running,
           count(*) FILTER (WHERE kind <> 'prospect_scan' AND status = 'failed')::int AS customer_failed,
           count(*) FILTER (WHERE kind = 'prospect_scan' AND status = 'queued')::int AS prospect_queued,
           count(*) FILTER (WHERE kind = 'prospect_scan' AND status = 'running')::int AS prospect_running,
           count(*) FILTER (WHERE kind = 'prospect_scan' AND status = 'failed')::int AS prospect_failed,
           count(*) FILTER (WHERE status = 'queued' AND priority = 'heavy')::int AS heavy_queued,
           count(*) FILTER (WHERE status = 'queued' AND priority = 'light')::int AS light_queued,
           count(*) FILTER (
             WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at < $1::timestamptz
           )::int AS stale_running,
           (EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status = 'queued'))) * 1000)::bigint
             AS oldest_queued_age_ms
         FROM jobs`,
        [cutoff],
      );
      const row = rows[0];
      const age = row?.oldest_queued_age_ms == null ? null : num(row.oldest_queued_age_ms);
      const { rows: usageRows } = await sql.query<{
        customer_heavy_today: unknown;
        installs_warning: unknown;
        installs_exhausted: unknown;
      }>(
        `SELECT
           COALESCE(SUM(u.heavy_jobs), 0)::int AS customer_heavy_today,
           count(*) FILTER (
             WHERE u.heavy_jobs >= CEIL(0.8 * (${heavyUsageCapSql()}))
               AND u.heavy_jobs < (${heavyUsageCapSql()})
           )::int AS installs_warning,
           count(*) FILTER (
             WHERE u.heavy_jobs >= (${heavyUsageCapSql()})
           )::int AS installs_exhausted
         FROM hosted_usage_days u
         JOIN billing_accounts b ON b.installation_id = u.installation_id
         WHERE u.day = (timezone('utc', now()))::date`,
      );
      const usage = usageRows[0];
      return {
        customer: {
          queued: num(row?.customer_queued ?? 0),
          running: num(row?.customer_running ?? 0),
          failed: num(row?.customer_failed ?? 0),
        },
        prospect: {
          queued: num(row?.prospect_queued ?? 0),
          running: num(row?.prospect_running ?? 0),
          failed: num(row?.prospect_failed ?? 0),
        },
        heavyQueued: num(row?.heavy_queued ?? 0),
        lightQueued: num(row?.light_queued ?? 0),
        staleRunning: num(row?.stale_running ?? 0),
        oldestQueuedAgeMs: Number.isFinite(age) ? age : null,
        usage: {
          customerHeavyToday: num(usage?.customer_heavy_today ?? 0),
          installsWarning: num(usage?.installs_warning ?? 0),
          installsExhausted: num(usage?.installs_exhausted ?? 0),
        },
      };
    },

    async insertAlert(input: {
      installationId: number;
      repoId?: number | null;
      kind: string;
      title: string;
      body: string;
      findings?: unknown;
      githubDeliveryId?: string | null;
    }): Promise<number> {
      if (input.githubDeliveryId) {
        const { rows: existing } = await sql.query<{ id: unknown }>(
          `SELECT id FROM alerts WHERE github_delivery_id = $1 LIMIT 1`,
          [input.githubDeliveryId],
        );
        if (existing[0]) return num(existing[0].id);
      }
      try {
        const inserted = await sql.query<{ id: unknown }>(
          `INSERT INTO alerts (installation_id, repo_id, kind, title, body, findings, github_delivery_id)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING id`,
          [
            input.installationId,
            input.repoId ?? null,
            input.kind,
            input.title,
            input.body,
            input.findings ? JSON.stringify(input.findings) : null,
            input.githubDeliveryId ?? null,
          ],
        );
        return num(inserted.rows[0]?.id);
      } catch (error) {
        if (input.githubDeliveryId) {
          const { rows: again } = await sql.query<{ id: unknown }>(
            `SELECT id FROM alerts WHERE github_delivery_id = $1 LIMIT 1`,
            [input.githubDeliveryId],
          );
          if (again[0]) return num(again[0].id);
        }
        throw error;
      }
    },

    async listAlertsForUser(userId: string, installationId?: number | null): Promise<AlertRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<AlertRow>(
        `SELECT a.*, r.full_name
         FROM alerts a
         LEFT JOIN repos r ON r.id = a.repo_id
         WHERE a.installation_id IN (
           SELECT installation_id FROM installation_users WHERE user_id = $1
         )
           AND ($2::bigint IS NULL OR a.installation_id = $2)
           AND row_within_retention(a.installation_id, a.created_at)
         ORDER BY a.created_at DESC
         LIMIT 100`,
        [userId, scoped],
      );
      return rows.map((row) => alertRow(row));
    },

    async listJobsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<{ jobs: TenantJobRow[]; summary: JobSummary; fairUse: HostedUsageStatus | null }> {
      const scoped = optionalInstallId(installationId);
      const tenant = `SELECT installation_id FROM installation_users WHERE user_id = $1`;
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        status: string;
        priority: string;
        attempts: unknown;
        error: string | null;
        created_at: string | Date;
        run_after: string | Date;
      }>(
        `SELECT id, installation_id, kind, status, priority, attempts, error, created_at, run_after
         FROM jobs
         WHERE installation_id IN (${tenant})
           AND kind <> 'prospect_scan'
           AND ($2::bigint IS NULL OR installation_id = $2)
           AND (status IN ('queued', 'running') OR row_within_retention(installation_id, created_at))
         ORDER BY created_at DESC, id DESC
         LIMIT 50`,
        [userId, scoped],
      );
      const { rows: counts } = await sql.query<{ status: string; n: unknown }>(
        `SELECT status, count(*)::int AS n
         FROM jobs
         WHERE installation_id IN (${tenant})
           AND kind <> 'prospect_scan'
           AND ($2::bigint IS NULL OR installation_id = $2)
           AND (status IN ('queued', 'running') OR row_within_retention(installation_id, created_at))
         GROUP BY status`,
        [userId, scoped],
      );
      const summary: JobSummary = { queued: 0, running: 0, done: 0, failed: 0 };
      for (const row of counts) {
        if (row.status === "queued" || row.status === "running" || row.status === "done" || row.status === "failed") {
          summary[row.status] = num(row.n);
        }
      }
      let fairUse: HostedUsageStatus | null = null;
      if (scoped != null) {
        fairUse = await this.hostedUsageStatus(scoped);
      } else {
        const { rows: installs } = await sql.query<{ installation_id: unknown }>(
          `SELECT installation_id FROM installation_users WHERE user_id = $1`,
          [userId],
        );
        if (installs.length === 1) {
          fairUse = await this.hostedUsageStatus(num(installs[0]?.installation_id));
        }
      }
      return {
        jobs: rows.map((row) => ({
          id: num(row.id),
          installationId: num(row.installation_id),
          kind: row.kind,
          status: row.status,
          priority: row.priority,
          attempts: num(row.attempts),
          error: row.error,
          createdAt: iso(row.created_at) ?? new Date().toISOString(),
          runAfter: iso(row.run_after) ?? new Date().toISOString(),
        })),
        summary,
        fairUse,
      };
    },

    async latestCustomerJob(
      installationId: number,
    ): Promise<{ kind: string; status: string; createdAt: string } | null> {
      const { rows } = await sql.query<{
        kind: string;
        status: string;
        created_at: string | Date;
      }>(
        `SELECT kind, status, created_at
         FROM jobs
         WHERE installation_id = $1 AND kind <> 'prospect_scan'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [installationId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        kind: row.kind,
        status: row.status,
        createdAt: iso(row.created_at) ?? new Date().toISOString(),
      };
    },

    async hasRecentAlert(repoId: number, kind: string, sinceIso: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM alerts
         WHERE repo_id = $1 AND kind = $2 AND created_at > $3::timestamptz`,
        [repoId, kind, sinceIso],
      );
      return num(rows[0]?.n ?? 0) > 0;
    },

    async getAlertForUser(id: number, userId: string): Promise<AlertRow | null> {
      const { rows } = await sql.query<Parameters<typeof alertRow>[0]>(
        `SELECT a.*, r.full_name
         FROM alerts a
         LEFT JOIN repos r ON r.id = a.repo_id
         WHERE a.id = $1 AND a.installation_id IN (
           SELECT installation_id FROM installation_users WHERE user_id = $2
         )`,
        [id, userId],
      );
      return rows[0] ? alertRow(rows[0]) : null;
    },

    async listInstallationMemberLogins(installationId: number): Promise<string[]> {
      const { rows } = await sql.query<{ login: string }>(
        `SELECT u.login
         FROM installation_users iu
         JOIN users u ON u.id = iu.user_id
         WHERE iu.installation_id = $1
         ORDER BY u.login`,
        [installationId],
      );
      return rows.map((row) => row.login);
    },

    async listAlertEventsForUser(alertId: number, userId: string): Promise<AlertEventRow[]> {
      const alert = await this.getAlertForUser(alertId, userId);
      if (!alert) return [];
      const { rows } = await sql.query<{
        id: unknown;
        alert_id: unknown;
        installation_id: unknown;
        actor_login: string;
        action: string;
        detail: string | null;
        created_at: string | Date;
      }>(
        `SELECT id, alert_id, installation_id, actor_login, action, detail, created_at
         FROM alert_events
         WHERE alert_id = $1
         ORDER BY id`,
        [alertId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        alert_id: num(row.alert_id),
        installation_id: num(row.installation_id),
        actor_login: row.actor_login,
        action: row.action,
        detail: row.detail,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async acknowledgeAlertForUser(
      id: number,
      userId: string,
      login: string,
    ): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (current.acknowledged_at) return current;
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET acknowledged_at = now(), acknowledged_by_login = $2
           WHERE id = $1 AND acknowledged_at IS NULL`,
          [id, login],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'acknowledged', NULL)`,
          [id, current.installation_id, login],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async assignAlertForUser(
      id: number,
      userId: string,
      actorLogin: string,
      assigneeLogin: string,
    ): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      const members = await this.listInstallationMemberLogins(current.installation_id);
      const match = members.find((row) => row.toLowerCase() === assigneeLogin.toLowerCase());
      if (!match) {
        throw Object.assign(new Error("Assign only to someone on this GitHub install."), {
          status: 400,
        });
      }
      if (current.assigned_to_login === match) return current;
      await sql.transaction(async (tx) => {
        await tx.query(`UPDATE alerts SET assigned_to_login = $2 WHERE id = $1`, [id, match]);
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'assigned', $4)`,
          [id, current.installation_id, actorLogin, match],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async resolveAlertForUser(
      id: number,
      userId: string,
      login: string,
      note: string,
    ): Promise<AlertRow | null> {
      const trimmed = note.trim();
      if (trimmed.length < 8) {
        throw Object.assign(new Error("Resolution note must be at least 8 characters."), {
          status: 400,
        });
      }
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (current.resolved_at) {
        throw Object.assign(new Error("That alert is already resolved."), { status: 409 });
      }
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET resolved_at = now(),
               resolved_by_login = $2,
               resolution_note = $3,
               acknowledged_at = COALESCE(acknowledged_at, now()),
               acknowledged_by_login = COALESCE(acknowledged_by_login, $2)
           WHERE id = $1 AND resolved_at IS NULL`,
          [id, login, trimmed],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'resolved', $4)`,
          [id, current.installation_id, login, trimmed],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async reopenAlertForUser(id: number, userId: string, login: string): Promise<AlertRow | null> {
      const current = await this.getAlertForUser(id, userId);
      if (!current) return null;
      if (!current.resolved_at) {
        throw Object.assign(new Error("That alert is not resolved."), { status: 400 });
      }
      await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE alerts
           SET resolved_at = NULL, resolved_by_login = NULL, resolution_note = NULL
           WHERE id = $1`,
          [id],
        );
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, $3, 'reopened', NULL)`,
          [id, current.installation_id, login],
        );
      });
      return await this.getAlertForUser(id, userId);
    },

    async savePermissionTest(
      installationId: number,
      result: PermissionTestResult,
    ): Promise<void> {
      await sql.query(
        `UPDATE installations
         SET last_permission_test_at = $2::timestamptz,
             last_permission_test = $3::jsonb
         WHERE id = $1`,
        [installationId, result.testedAt, JSON.stringify(result)],
      );
    },

    async upsertProspect(input: {
      source: "github_release" | "npm";
      owner: string;
      repo: string;
      repositoryUrl: string;
      packageName?: string | null;
      releaseTag?: string | null;
      artifactName: string;
      artifactUrl: string;
      artifactBytes?: number | null;
    }): Promise<{ id: number; inserted: boolean }> {
      const inserted = await sql.query<{ id: unknown }>(
        `INSERT INTO prospects (
           source, owner, repo, repository_url, package_name, release_tag,
           artifact_name, artifact_url, artifact_bytes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (artifact_url) DO NOTHING
         RETURNING id`,
        [
          input.source,
          input.owner,
          input.repo,
          input.repositoryUrl,
          input.packageName ?? null,
          input.releaseTag ?? null,
          input.artifactName,
          input.artifactUrl,
          input.artifactBytes ?? null,
        ],
      );
      if (inserted.rows[0]) return { id: num(inserted.rows[0].id), inserted: true };
      const existing = await sql.query<{ id: unknown }>(
        `SELECT id FROM prospects WHERE artifact_url = $1`,
        [input.artifactUrl],
      );
      if (!existing.rows[0]) throw new Error("Prospect artifact disappeared during insert.");
      return { id: num(existing.rows[0].id), inserted: false };
    },

    async getProspect(id: number): Promise<ProspectRow | null> {
      const { rows } = await sql.query<ProspectRow>(`SELECT * FROM prospects WHERE id = $1`, [id]);
      return rows[0] ? prospectRow(rows[0]) : null;
    },

    async listNpmProspectsForFeed(limit = 32): Promise<ProspectRow[]> {
      const { rows } = await sql.query<ProspectRow>(
        `SELECT * FROM prospects
         WHERE source = 'npm'
           AND package_name IS NOT NULL
           AND package_name <> ''
           AND scan_status IN ('complete', 'failed')
           AND status IN ('new', 'contacted')
         ORDER BY COALESCE(feed_checked_at, '1970-01-01') ASC, id ASC
         LIMIT $1`,
        [Math.min(100, Math.max(1, limit))],
      );
      return rows.map((row) => prospectRow(row));
    },

    async touchProspectFeedCheck(id: number): Promise<void> {
      await sql.query(
        `UPDATE prospects SET feed_checked_at = now(), updated_at = now() WHERE id = $1`,
        [id],
      );
    },

    async listProspects(limit = 100): Promise<ProspectRow[]> {
      const { rows } = await sql.query<ProspectRow>(
        `SELECT * FROM prospects
         ORDER BY
           CASE scan_status
             WHEN 'complete' THEN 0
             WHEN 'scanning' THEN 1
             WHEN 'queued' THEN 2
             ELSE 3
           END,
           COALESCE(critical_count, -1) DESC,
           discovered_at DESC
         LIMIT $1`,
        [Math.min(500, Math.max(1, limit))],
      );
      return rows.map(prospectRow);
    },

    async listDiscoveryCampaigns(): Promise<DiscoveryCampaignRow[]> {
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `SELECT * FROM discovery_campaigns ORDER BY enabled DESC, name ASC, id ASC`,
      );
      return rows.map((row) => discoveryCampaignRow(row));
    },

    async getDiscoveryCampaign(id: number): Promise<DiscoveryCampaignRow | null> {
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `SELECT * FROM discovery_campaigns WHERE id = $1`,
        [id],
      );
      return rows[0] ? discoveryCampaignRow(rows[0]) : null;
    },

    async countDiscoveryCampaigns(): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(`SELECT count(*)::int AS n FROM discovery_campaigns`);
      return num(rows[0]?.n);
    },

    async insertDiscoveryCampaign(input: {
      name: string;
      query: string;
      createdBy: string;
    }): Promise<DiscoveryCampaignRow | null> {
      const { rows: existing } = await sql.query<{ id: unknown }>(
        `SELECT id FROM discovery_campaigns WHERE lower(query) = lower($1)`,
        [input.query],
      );
      if (existing[0]) return null;
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `INSERT INTO discovery_campaigns (name, query, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.name, input.query, input.createdBy],
      );
      return rows[0] ? discoveryCampaignRow(rows[0]) : null;
    },

    async updateDiscoveryCampaign(input: {
      id: number;
      name?: string;
      query?: string;
      enabled?: boolean;
    }): Promise<DiscoveryCampaignRow | null> {
      const current = await this.getDiscoveryCampaign(input.id);
      if (!current) return null;
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `UPDATE discovery_campaigns
         SET name = $2,
             query = $3,
             enabled = $4,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.name ?? current.name,
          input.query ?? current.query,
          input.enabled ?? current.enabled,
        ],
      );
      return rows[0] ? discoveryCampaignRow(rows[0]) : null;
    },

    async deleteDiscoveryCampaign(id: number): Promise<DiscoveryCampaignRow | null> {
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `DELETE FROM discovery_campaigns WHERE id = $1 RETURNING *`,
        [id],
      );
      return rows[0] ? discoveryCampaignRow(rows[0]) : null;
    },

    async nextEnabledDiscoveryCampaign(): Promise<DiscoveryCampaignRow | null> {
      const { rows } = await sql.query<Parameters<typeof discoveryCampaignRow>[0]>(
        `SELECT * FROM discovery_campaigns
         WHERE enabled = TRUE
         ORDER BY last_ran_at ASC NULLS FIRST, id ASC
         LIMIT 1`,
      );
      return rows[0] ? discoveryCampaignRow(rows[0]) : null;
    },

    async touchDiscoveryCampaign(
      id: number,
      input: { repositories: number; queued: number },
    ): Promise<void> {
      await sql.query(
        `UPDATE discovery_campaigns
         SET last_ran_at = now(),
             last_repositories = $2,
             last_queued = $3,
             updated_at = now()
         WHERE id = $1`,
        [id, input.repositories, input.queued],
      );
    },

    async prospectStats(): Promise<{
      total: number;
      actionable: number;
      queued: number;
      contacted: number;
    }> {
      const { rows } = await sql.query<{
        total: unknown;
        actionable: unknown;
        queued: unknown;
        contacted: unknown;
      }>(
        `SELECT
           count(*)::int AS total,
           count(*) FILTER (WHERE scan_status = 'complete' AND critical_count > 0)::int AS actionable,
           count(*) FILTER (WHERE scan_status IN ('queued', 'scanning'))::int AS queued,
           count(*) FILTER (WHERE status = 'contacted')::int AS contacted
         FROM prospects`,
      );
      return {
        total: num(rows[0]?.total ?? 0),
        actionable: num(rows[0]?.actionable ?? 0),
        queued: num(rows[0]?.queued ?? 0),
        contacted: num(rows[0]?.contacted ?? 0),
      };
    },

    async startProspectScan(id: number): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'scanning', error = NULL, updated_at = now()
         WHERE id = $1`,
        [id],
      );
    },

    async queueProspectScan(id: number): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'queued', error = NULL, updated_at = now()
         WHERE id = $1`,
        [id],
      );
    },

    async completeProspectScan(
      id: number,
      report: { fileCount: number; findings: unknown[]; workspaceMembers?: string[] },
    ): Promise<void> {
      const critical = report.findings.filter(
        (finding) =>
          finding &&
          typeof finding === "object" &&
          "severity" in finding &&
          finding.severity === "critical",
      ).length;
      const warnings = report.findings.length - critical;
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'complete',
             file_count = $2,
             critical_count = $3,
             warning_count = $4,
             findings = $5::jsonb,
             workspace_members = $6::jsonb,
             error = NULL,
             scanned_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [
          id,
          report.fileCount,
          critical,
          warnings,
          JSON.stringify(report.findings),
          JSON.stringify(report.workspaceMembers ?? []),
        ],
      );
    },

    async failProspectScan(id: number, error: string): Promise<void> {
      await sql.query(
        `UPDATE prospects
         SET scan_status = 'failed', error = $2, updated_at = now()
         WHERE id = $1`,
        [id, error.slice(0, 2000)],
      );
    },

    async updateProspectStatus(id: number, status: ProspectStatus): Promise<ProspectRow | null> {
      const { rows } = await sql.query<ProspectRow>(
        `UPDATE prospects
         SET status = $2,
             contacted_at = CASE WHEN $2 = 'contacted' THEN COALESCE(contacted_at, now()) ELSE contacted_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [id, status],
      );
      return rows[0] ? prospectRow(rows[0]) : null;
    },

    readDisclosureNotes(row: DisclosureCaseRow): { notes: string | null; notesExpired: boolean } {
      if (row.notes_expires_at && Date.parse(row.notes_expires_at) <= Date.now()) {
        return { notes: null, notesExpired: true };
      }
      if (!row.notes_ciphertext) return { notes: null, notesExpired: false };
      if (!tokenSecret) return { notes: null, notesExpired: false };
      try {
        return { notes: decryptSecret(row.notes_ciphertext, tokenSecret), notesExpired: false };
      } catch {
        return { notes: null, notesExpired: false };
      }
    },

    async getDisclosureCaseByProspect(prospectId: number): Promise<DisclosureCaseRow | null> {
      const { rows } = await sql.query<Parameters<typeof disclosureCaseRow>[0]>(
        `SELECT * FROM disclosure_cases WHERE prospect_id = $1`,
        [prospectId],
      );
      return rows[0] ? disclosureCaseRow(rows[0]) : null;
    },

    async listDisclosureCases(): Promise<DisclosureCaseRow[]> {
      const { rows } = await sql.query<Parameters<typeof disclosureCaseRow>[0]>(
        `SELECT * FROM disclosure_cases ORDER BY id ASC`,
      );
      return rows.map((row) => disclosureCaseRow(row));
    },

    async listDisclosureEvents(caseId: number): Promise<DisclosureEventRow[]> {
      const { rows } = await sql.query<Parameters<typeof disclosureEventRow>[0]>(
        `SELECT * FROM disclosure_events WHERE case_id = $1 ORDER BY id ASC`,
        [caseId],
      );
      return rows.map((row) => disclosureEventRow(row));
    },

    async listOtherDisclosureCases(prospectId: number): Promise<
      (DisclosureCaseRow & { owner: string; repo: string; package_name: string | null })[]
    > {
      const { rows } = await sql.query<
        Parameters<typeof disclosureCaseRow>[0] & {
          owner: string;
          repo: string;
          package_name: string | null;
        }
      >(
        `SELECT c.*, p.owner, p.repo, p.package_name
         FROM disclosure_cases c
         JOIN prospects p ON p.id = c.prospect_id
         WHERE c.prospect_id <> $1
         ORDER BY c.id ASC`,
        [prospectId],
      );
      return rows.map((row) => ({
        ...disclosureCaseRow(row),
        owner: row.owner,
        repo: row.repo,
        package_name: row.package_name,
      }));
    },

    async insertDisclosureCase(input: {
      prospectId: number;
      fingerprints: string[];
      actor: string;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const inserted = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `INSERT INTO disclosure_cases (prospect_id, state, fingerprints)
           VALUES ($1, 'signal', $2::jsonb)
           RETURNING *`,
          [input.prospectId, JSON.stringify(input.fingerprints)],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error("Disclosure case was not created.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, 'created', $2, $3)`,
          [row.id, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async updateDisclosureCase(input: {
      prospectId: number;
      actor: string;
      state: DisclosureState;
      checklist: DisclosureChecklist;
      securityContact: string | null;
      policyUrl: string | null;
      notes?: string | null;
      notesExpiresInDays?: number;
      draftSubject?: string | null;
      draftBody?: string | null;
      deadlineAt: string | null;
      conversion: DisclosureConversion;
      fixVersion: string | null;
      vendorChannel?: VendorChannel | null;
      outcomeCredit?: string | null;
      outcomeCve?: string | null;
      outcomeNotes?: string | null;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const current = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `SELECT * FROM disclosure_cases WHERE prospect_id = $1`,
          [input.prospectId],
        );
        const existing = current.rows[0];
        if (!existing) throw new Error("Disclosure case disappeared.");
        let notesCiphertext = existing.notes_ciphertext;
        let notesExpires = existing.notes_expires_at;
        if (input.notes !== undefined) {
          if (input.notes == null || input.notes === "") {
            notesCiphertext = null;
            notesExpires = null;
          } else {
            if (!tokenSecret) {
              throw Object.assign(new Error("Session secret is required to store operator notes."), {
                status: 400,
              });
            }
            notesCiphertext = encryptSecret(input.notes, tokenSecret);
            const days = input.notesExpiresInDays ?? 90;
            notesExpires = new Date(Date.now() + days * 86_400_000).toISOString();
          }
        }
        const updated = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `UPDATE disclosure_cases
           SET state = $2,
               checklist_public_artifact = $3,
               checklist_reproduced = $4,
               checklist_fingerprints_recorded = $5,
               checklist_no_secret_values = $6,
               checklist_contact_or_policy = $7,
               security_contact = $8,
               policy_url = $9,
               notes_ciphertext = $10,
               notes_expires_at = $11,
               draft_subject = $12,
               draft_body = $13,
               deadline_at = $14,
               conversion = $15,
               fix_version = $16,
               vendor_channel = $17,
               outcome_credit = $18,
               outcome_cve = $19,
               outcome_notes = $20,
               verified_at = CASE
                 WHEN $2 = 'verified' THEN COALESCE(verified_at, now())
                 ELSE verified_at
               END,
               updated_at = now()
           WHERE prospect_id = $1
           RETURNING *`,
          [
            input.prospectId,
            input.state,
            input.checklist.public_artifact,
            input.checklist.reproduced,
            input.checklist.fingerprints_recorded,
            input.checklist.no_secret_values,
            input.checklist.contact_or_policy,
            input.securityContact,
            input.policyUrl,
            notesCiphertext,
            notesExpires,
            input.draftSubject ?? existing.draft_subject,
            input.draftBody ?? existing.draft_body,
            input.deadlineAt,
            input.conversion,
            input.fixVersion,
            input.vendorChannel !== undefined ? input.vendorChannel : existing.vendor_channel,
            input.outcomeCredit !== undefined ? input.outcomeCredit : existing.outcome_credit,
            input.outcomeCve !== undefined ? input.outcomeCve : existing.outcome_cve,
            input.outcomeNotes !== undefined ? input.outcomeNotes : existing.outcome_notes,
          ],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("Disclosure case was not updated.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, 'updated', $2, $3)`,
          [row.id, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async acknowledgeDisclosureCase(input: {
      prospectId: number;
      actor: string;
      note: string;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const updated = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `UPDATE disclosure_cases
           SET acknowledgement_note = $2,
               acknowledged_at = now(),
               updated_at = now()
           WHERE prospect_id = $1
           RETURNING *`,
          [input.prospectId, input.note],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("Disclosure case was not updated.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, 'acknowledged', $2, $3)`,
          [row.id, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async insertInternalNotification(input: {
      kind: InternalNotificationKind;
      prospectId: number;
      caseId: number;
      title: string;
      fingerprints: string[];
      rules: string[];
    }): Promise<InternalNotificationRow | null> {
      const { rows } = await sql.query<Parameters<typeof internalNotificationRow>[0]>(
        `INSERT INTO internal_notifications (
           kind, prospect_id, case_id, title, fingerprints, rules
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
         ON CONFLICT (case_id, kind) DO NOTHING
         RETURNING *`,
        [
          input.kind,
          input.prospectId,
          input.caseId,
          input.title,
          JSON.stringify(input.fingerprints),
          JSON.stringify(input.rules),
        ],
      );
      return rows[0] ? internalNotificationRow(rows[0]) : null;
    },

    async listInternalNotifications(limit = 50): Promise<InternalNotificationRow[]> {
      const { rows } = await sql.query<Parameters<typeof internalNotificationRow>[0]>(
        `SELECT * FROM internal_notifications
         ORDER BY read_at NULLS FIRST, created_at DESC, id DESC
         LIMIT $1`,
        [Math.min(200, Math.max(1, limit))],
      );
      return rows.map((row) => internalNotificationRow(row));
    },

    async unreadInternalNotificationCount(): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM internal_notifications WHERE read_at IS NULL`,
      );
      return num(rows[0]?.n ?? 0);
    },

    async listMissedDeadlineCases(): Promise<
      (DisclosureCaseRow & { owner: string; repo: string })[]
    > {
      const { rows } = await sql.query<
        Parameters<typeof disclosureCaseRow>[0] & { owner: string; repo: string }
      >(
        `SELECT c.*, p.owner, p.repo
         FROM disclosure_cases c
         JOIN prospects p ON p.id = c.prospect_id
         WHERE c.deadline_at IS NOT NULL
           AND c.deadline_at < now()
           AND c.acknowledged_at IS NULL
         ORDER BY c.id ASC`,
      );
      return rows.map((row) => ({
        ...disclosureCaseRow(row),
        owner: row.owner,
        repo: row.repo,
      }));
    },

    async listDisclosureTemplates(): Promise<DisclosureTemplateRow[]> {
      const { rows } = await sql.query<Parameters<typeof disclosureTemplateRow>[0]>(
        `SELECT * FROM disclosure_templates ORDER BY name ASC`,
      );
      return rows.map((row) => disclosureTemplateRow(row));
    },

    async getDisclosureTemplate(id: number): Promise<DisclosureTemplateRow | null> {
      const { rows } = await sql.query<Parameters<typeof disclosureTemplateRow>[0]>(
        `SELECT * FROM disclosure_templates WHERE id = $1`,
        [id],
      );
      return rows[0] ? disclosureTemplateRow(rows[0]) : null;
    },

    async insertDisclosureTemplate(input: {
      name: string;
      subject: string;
      body: string;
    }): Promise<DisclosureTemplateRow> {
      const { rows } = await sql.query<Parameters<typeof disclosureTemplateRow>[0]>(
        `INSERT INTO disclosure_templates (name, subject, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [input.name, input.subject, input.body],
      );
      const row = rows[0];
      if (!row) throw new Error("Disclosure template was not created.");
      return disclosureTemplateRow(row);
    },

    async updateDisclosureTemplate(input: {
      id: number;
      subject: string;
      body: string;
    }): Promise<DisclosureTemplateRow | null> {
      const { rows } = await sql.query<Parameters<typeof disclosureTemplateRow>[0]>(
        `UPDATE disclosure_templates
         SET subject = $2, body = $3, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [input.id, input.subject, input.body],
      );
      return rows[0] ? disclosureTemplateRow(rows[0]) : null;
    },

    async listDoNotContact(): Promise<DoNotContactRow[]> {
      const { rows } = await sql.query<Parameters<typeof doNotContactRow>[0]>(
        `SELECT * FROM disclosure_do_not_contact ORDER BY id ASC`,
      );
      return rows.map((row) => doNotContactRow(row));
    },

    async insertDoNotContact(input: {
      owner: string | null;
      repo: string | null;
      packageName: string | null;
      contact: string | null;
      reason: string;
      actor: string;
    }): Promise<DoNotContactRow> {
      const { rows } = await sql.query<Parameters<typeof doNotContactRow>[0]>(
        `INSERT INTO disclosure_do_not_contact (
           owner, repo, package_name, contact, reason, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [input.owner, input.repo, input.packageName, input.contact, input.reason, input.actor],
      );
      const row = rows[0];
      if (!row) throw new Error("Do-not-contact entry was not created.");
      return doNotContactRow(row);
    },

    async deleteDoNotContact(id: number): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM disclosure_do_not_contact WHERE id = $1 RETURNING id`,
        [id],
      );
      return rows.length > 0;
    },

    async markInternalNotificationRead(id: number): Promise<InternalNotificationRow | null> {
      const { rows } = await sql.query<Parameters<typeof internalNotificationRow>[0]>(
        `UPDATE internal_notifications
         SET read_at = COALESCE(read_at, now())
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      return rows[0] ? internalNotificationRow(rows[0]) : null;
    },

    async recordDisclosureRescan(input: {
      prospectId: number;
      actor: string;
      fixVersion: string;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const updated = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `UPDATE disclosure_cases
           SET fix_version = $2,
               last_rescan_at = now(),
               updated_at = now()
           WHERE prospect_id = $1
           RETURNING *`,
          [input.prospectId, input.fixVersion],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("Disclosure case was not updated.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, 'rescan', $2, $3)`,
          [row.id, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async insertDisclosureEvent(input: {
      caseId: number;
      actor: string;
      action: string;
      summary: string;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO disclosure_events (case_id, action, actor, summary)
         VALUES ($1, $2, $3, $4)`,
        [input.caseId, input.action, input.actor, input.summary],
      );
    },

    async listDisclosureDestinations(): Promise<DisclosureDestinationRow[]> {
      const { rows } = await sql.query<Parameters<typeof disclosureDestinationRow>[0]>(
        `SELECT * FROM disclosure_destinations ORDER BY kind ASC, id ASC`,
      );
      return rows.map((row) => disclosureDestinationRow(row));
    },

    async getDisclosureDestination(id: number): Promise<DisclosureDestinationRow | null> {
      const { rows } = await sql.query<Parameters<typeof disclosureDestinationRow>[0]>(
        `SELECT * FROM disclosure_destinations WHERE id = $1`,
        [id],
      );
      return rows[0] ? disclosureDestinationRow(rows[0]) : null;
    },

    async upsertDisclosureDestination(input: {
      kind: DisclosureDestinationKind;
      host: string;
      projectKey: string | null;
      secret: string;
      createdBy: string;
    }): Promise<DisclosureDestinationRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt disclosure destinations."), {
          status: 400,
        });
      }
      const ciphertext = encryptSecret(input.secret, tokenSecret);
      const { rows } = await sql.query<Parameters<typeof disclosureDestinationRow>[0]>(
        `INSERT INTO disclosure_destinations (
           kind, host, project_key, secret_ciphertext, created_by
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (kind) DO UPDATE SET
           host = excluded.host,
           project_key = excluded.project_key,
           secret_ciphertext = excluded.secret_ciphertext,
           created_by = excluded.created_by,
           updated_at = now()
         RETURNING *`,
        [input.kind, input.host, input.projectKey, ciphertext, input.createdBy],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save that destination.");
      return disclosureDestinationRow(row);
    },

    async deleteDisclosureDestination(id: number): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM disclosure_destinations WHERE id = $1 RETURNING id`,
        [id],
      );
      return Boolean(rows[0]);
    },

    async openDisclosureDestination(id: number): Promise<{
      id: number;
      kind: DisclosureDestinationKind;
      host: string;
      projectKey: string | null;
      secret: string;
    } | null> {
      const row = await this.getDisclosureDestination(id);
      if (!row || !tokenSecret) return null;
      return {
        id: row.id,
        kind: row.kind,
        host: row.host,
        projectKey: row.project_key,
        secret: decryptSecret(row.secret_ciphertext, tokenSecret),
      };
    },

    async listOperatorGrants(): Promise<OperatorGrantRow[]> {
      const { rows } = await sql.query<Parameters<typeof operatorGrantRow>[0]>(
        `SELECT * FROM operator_grants ORDER BY lower(github_login) ASC, id ASC`,
      );
      return rows.map((row) => operatorGrantRow(row));
    },

    async hasOperatorGrant(login: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM operator_grants WHERE lower(github_login) = $1`,
        [githubLoginKey(login)],
      );
      return num(rows[0]?.n ?? 0) > 0;
    },

    async getOperatorGrant(id: number): Promise<OperatorGrantRow | null> {
      const { rows } = await sql.query<Parameters<typeof operatorGrantRow>[0]>(
        `SELECT * FROM operator_grants WHERE id = $1`,
        [id],
      );
      return rows[0] ? operatorGrantRow(rows[0]) : null;
    },

    async insertOperatorGrant(input: {
      githubLogin: string;
      createdBy: string;
    }): Promise<OperatorGrantRow> {
      const existing = await sql.query<{ id: unknown }>(
        `SELECT id FROM operator_grants WHERE lower(github_login) = $1`,
        [githubLoginKey(input.githubLogin)],
      );
      if (existing.rows[0]) {
        throw Object.assign(new Error(OPERATOR_EXISTS_ERROR), {
          status: 409,
        });
      }
      const { rows: counted } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM operator_grants`,
      );
      if (num(counted[0]?.n ?? 0) >= 8) {
        throw Object.assign(new Error(OPERATOR_CAP_ERROR), {
          status: 400,
        });
      }
      const { rows } = await sql.query<Parameters<typeof operatorGrantRow>[0]>(
        `INSERT INTO operator_grants (github_login, created_by)
         VALUES ($1, $2)
         RETURNING *`,
        [input.githubLogin, input.createdBy],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save that operator grant.");
      return operatorGrantRow(row);
    },

    async deleteOperatorGrant(id: number): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM operator_grants WHERE id = $1 RETURNING id`,
        [id],
      );
      return Boolean(rows[0]);
    },

    async listDisclosureVendorReplies(caseId: number): Promise<DisclosureVendorReplyRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        case_id: unknown;
        channel: string;
        summary: string;
        received_at: string | Date;
        created_by: string;
        created_at: string | Date;
      }>(
        `SELECT * FROM disclosure_vendor_replies WHERE case_id = $1 ORDER BY id ASC`,
        [caseId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        case_id: num(row.case_id),
        channel: asReplyChannel(row.channel),
        summary: row.summary,
        received_at: iso(row.received_at) ?? new Date().toISOString(),
        created_by: row.created_by,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async insertDisclosureVendorReply(input: {
      caseId: number;
      channel: VendorReplyChannel;
      summary: string;
      receivedAt: string;
      createdBy: string;
    }): Promise<DisclosureVendorReplyRow> {
      const { rows } = await sql.query<{
        id: unknown;
        case_id: unknown;
        channel: string;
        summary: string;
        received_at: string | Date;
        created_by: string;
        created_at: string | Date;
      }>(
        `INSERT INTO disclosure_vendor_replies (case_id, channel, summary, received_at, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.caseId, input.channel, input.summary, input.receivedAt, input.createdBy],
      );
      const row = rows[0];
      if (!row) throw new Error("Vendor reply was not recorded.");
      return {
        id: num(row.id),
        case_id: num(row.case_id),
        channel: asReplyChannel(row.channel),
        summary: row.summary,
        received_at: iso(row.received_at) ?? input.receivedAt,
        created_by: row.created_by,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      };
    },

    async listDisclosureAttachments(caseId: number): Promise<DisclosureAttachmentRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        case_id: unknown;
        filename: string;
        media_type: string;
        byte_length: unknown;
        ciphertext: string;
        expires_at: string | Date;
        created_by: string;
        created_at: string | Date;
      }>(`SELECT * FROM disclosure_attachments WHERE case_id = $1 ORDER BY id ASC`, [caseId]);
      return rows.map((row) => ({
        id: num(row.id),
        case_id: num(row.case_id),
        filename: row.filename,
        media_type: row.media_type,
        byte_length: num(row.byte_length),
        ciphertext: row.ciphertext,
        expires_at: iso(row.expires_at) ?? new Date().toISOString(),
        created_by: row.created_by,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async getDisclosureAttachment(id: number): Promise<DisclosureAttachmentRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        case_id: unknown;
        filename: string;
        media_type: string;
        byte_length: unknown;
        ciphertext: string;
        expires_at: string | Date;
        created_by: string;
        created_at: string | Date;
      }>(`SELECT * FROM disclosure_attachments WHERE id = $1`, [id]);
      const row = rows[0];
      if (!row) return null;
      return {
        id: num(row.id),
        case_id: num(row.case_id),
        filename: row.filename,
        media_type: row.media_type,
        byte_length: num(row.byte_length),
        ciphertext: row.ciphertext,
        expires_at: iso(row.expires_at) ?? new Date().toISOString(),
        created_by: row.created_by,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      };
    },

    async insertDisclosureAttachment(input: {
      caseId: number;
      filename: string;
      mediaType: string;
      bytes: Buffer;
      expiresAt: string;
      createdBy: string;
    }): Promise<DisclosureAttachmentRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("Session secret is required to store attachments."), {
          status: 400,
        });
      }
      const ciphertext = encryptSecret(input.bytes.toString("base64"), tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        case_id: unknown;
        filename: string;
        media_type: string;
        byte_length: unknown;
        ciphertext: string;
        expires_at: string | Date;
        created_by: string;
        created_at: string | Date;
      }>(
        `INSERT INTO disclosure_attachments (
           case_id, filename, media_type, byte_length, ciphertext, expires_at, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.caseId,
          input.filename,
          input.mediaType,
          input.bytes.length,
          ciphertext,
          input.expiresAt,
          input.createdBy,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("Attachment was not stored.");
      return {
        id: num(row.id),
        case_id: num(row.case_id),
        filename: row.filename,
        media_type: row.media_type,
        byte_length: num(row.byte_length),
        ciphertext: row.ciphertext,
        expires_at: iso(row.expires_at) ?? input.expiresAt,
        created_by: row.created_by,
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      };
    },

    decryptDisclosureAttachment(row: DisclosureAttachmentRow): Buffer {
      if (!tokenSecret) {
        throw Object.assign(new Error("Session secret is required to read attachments."), {
          status: 400,
        });
      }
      if (!row.ciphertext) {
        throw Object.assign(new Error("Expired attachment ciphertext was deleted."), {
          status: 410,
        });
      }
      return Buffer.from(decryptSecret(row.ciphertext, tokenSecret), "base64");
    },

    async sweepExpiredDisclosureEvidence(): Promise<{ attachments: number; notes: number }> {
      return sql.transaction(async (tx) => {
        const attachments = await tx.query<{
          id: unknown;
          case_id: unknown;
          filename: string;
        }>(
          `UPDATE disclosure_attachments
           SET ciphertext = ''
           WHERE expires_at <= now() AND ciphertext <> ''
           RETURNING id, case_id, filename`,
        );
        const notes = await tx.query<{ id: unknown }>(
          `UPDATE disclosure_cases
           SET notes_ciphertext = NULL
           WHERE notes_expires_at IS NOT NULL
             AND notes_expires_at <= now()
             AND notes_ciphertext IS NOT NULL
           RETURNING id`,
        );
        for (const row of attachments.rows) {
          await tx.query(
            `INSERT INTO disclosure_events (case_id, action, actor, summary)
             VALUES ($1, 'attachment.expire', 'system', $2)`,
            [num(row.case_id), `Deleted expired attachment ciphertext for ${row.filename}.`],
          );
        }
        for (const row of notes.rows) {
          await tx.query(
            `INSERT INTO disclosure_events (case_id, action, actor, summary)
             VALUES ($1, 'notes.expire', 'system', $2)`,
            [num(row.id), "Deleted expired operator notes ciphertext."],
          );
        }
        return { attachments: attachments.rows.length, notes: notes.rows.length };
      });
    },

    async assignDisclosureCase(input: {
      prospectId: number;
      assignee: string | null;
      reviewState: DisclosureReviewState;
      actor: string;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const updated = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `UPDATE disclosure_cases
           SET assignee = $2,
               review_state = $3,
               updated_at = now()
           WHERE prospect_id = $1
           RETURNING *`,
          [input.prospectId, input.assignee, input.reviewState],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("Disclosure case was not updated.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, 'assigned', $2, $3)`,
          [row.id, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async reviewDisclosureCase(input: {
      prospectId: number;
      reviewState: "approved" | "rejected";
      reviewNote: string;
      reviewedBy: string;
      actor: string;
      summary: string;
    }): Promise<DisclosureCaseRow> {
      return await sql.transaction(async (tx) => {
        const updated = await tx.query<Parameters<typeof disclosureCaseRow>[0]>(
          `UPDATE disclosure_cases
           SET review_state = $2,
               review_note = $3,
               reviewed_by = $4,
               reviewed_at = now(),
               updated_at = now()
           WHERE prospect_id = $1
           RETURNING *`,
          [input.prospectId, input.reviewState, input.reviewNote, input.reviewedBy],
        );
        const row = updated.rows[0];
        if (!row) throw new Error("Disclosure case was not updated.");
        await tx.query(
          `INSERT INTO disclosure_events (case_id, action, actor, summary)
           VALUES ($1, $2, $3, $4)`,
          [row.id, `review.${input.reviewState === "approved" ? "approve" : "reject"}`, input.actor, input.summary],
        );
        return disclosureCaseRow(row);
      });
    },

    async listInstallationsForUser(userId: string): Promise<
      {
        id: number;
        account_login: string;
        account_type: string;
        suspended: boolean;
        trialEndsAt: string | null;
        plan: string | null;
        role: InstallationRole;
        lastPermissionTestAt: string | null;
        lastPermissionTest: PermissionTestResult | null;
      }[]
    > {
      const { rows } = await sql.query<{
        id: unknown;
        account_login: string;
        account_type: string;
        suspended: boolean;
        trial_ends_at: string | Date | null;
        plan: string | null;
        role: string;
        last_permission_test_at: string | Date | null;
        last_permission_test: unknown;
      }>(
        `SELECT i.id, i.account_login, i.account_type, i.suspended,
                i.last_permission_test_at, i.last_permission_test,
                b.trial_ends_at, b.plan, iu.role
         FROM installations i
         JOIN installation_users iu ON iu.installation_id = i.id
         LEFT JOIN billing_accounts b ON b.installation_id = i.id
         WHERE iu.user_id = $1
         ORDER BY i.account_login`,
        [userId],
      );
      return rows.map((row) => ({
        id: num(row.id),
        account_login: row.account_login,
        account_type: row.account_type,
        suspended: Boolean(row.suspended),
        trialEndsAt: iso(row.trial_ends_at),
        plan: row.plan,
        role: asInstallationRole(row.role),
        lastPermissionTestAt: iso(row.last_permission_test_at),
        lastPermissionTest: permissionTestFromDb(row.last_permission_test),
      }));
    },

    async userOwnsInstallation(userId: string, installationId: number): Promise<boolean> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM installation_users
         WHERE user_id = $1 AND installation_id = $2`,
        [userId, installationId],
      );
      return num(rows[0]?.n ?? 0) > 0;
    },

    async getInstallationRole(
      userId: string,
      installationId: number,
    ): Promise<InstallationRole | null> {
      const { rows } = await sql.query<{ role: string }>(
        `SELECT role FROM installation_users
         WHERE user_id = $1 AND installation_id = $2`,
        [userId, installationId],
      );
      const row = rows[0];
      return row ? asInstallationRole(row.role) : null;
    },

    async listInstallationMembersForUser(
      userId: string,
      installationId: number,
    ): Promise<InstallationMember[]> {
      const { rows } = await sql.query<{
        user_id: string;
        login: string;
        avatar_url: string | null;
        role: string;
      }>(
        `SELECT u.id AS user_id, u.login, u.avatar_url, iu.role
         FROM installation_users iu
         JOIN users u ON u.id = iu.user_id
         WHERE iu.installation_id = $1
           AND EXISTS (
             SELECT 1 FROM installation_users mine
             WHERE mine.installation_id = $1 AND mine.user_id = $2
           )
         ORDER BY u.login`,
        [installationId, userId],
      );
      return rows.map((row) => ({
        userId: row.user_id,
        login: row.login,
        avatarUrl: row.avatar_url,
        role: asInstallationRole(row.role),
      }));
    },

    async setInstallationRoleForUser(input: {
      actorUserId: string;
      installationId: number;
      targetUserId: string;
      role: InstallationRole;
    }): Promise<InstallationMember> {
      return await sql.transaction(async (tx) => {
        const { rows: actorRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.actorUserId],
        );
        const actor = actorRows[0];
        if (!actor) {
          throw Object.assign(new Error("That GitHub installation is not on your account."), {
            status: 403,
          });
        }
        if (asInstallationRole(actor.role) !== "admin") {
          throw Object.assign(new Error(ADMIN_REQUIRED_ERROR), { status: 403 });
        }
        const { rows: targetRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.targetUserId],
        );
        const target = targetRows[0];
        if (!target) {
          throw Object.assign(new Error(UNKNOWN_MEMBER_ERROR), { status: 404 });
        }
        if (asInstallationRole(target.role) === "admin" && input.role === "member") {
          const { rows: adminRows } = await tx.query<{ n: unknown }>(
            `SELECT count(*)::int AS n FROM installation_users
             WHERE installation_id = $1 AND role = 'admin'`,
            [input.installationId],
          );
          if (num(adminRows[0]?.n ?? 0) <= 1) {
            throw Object.assign(new Error(LAST_ADMIN_ERROR), { status: 409 });
          }
        }
        await tx.query(
          `UPDATE installation_users SET role = $3
           WHERE installation_id = $1 AND user_id = $2`,
          [input.installationId, input.targetUserId, input.role],
        );
        const { rows: memberRows } = await tx.query<{
          user_id: string;
          login: string;
          avatar_url: string | null;
          role: string;
        }>(
          `SELECT u.id AS user_id, u.login, u.avatar_url, iu.role
           FROM installation_users iu
           JOIN users u ON u.id = iu.user_id
           WHERE iu.installation_id = $1 AND iu.user_id = $2`,
          [input.installationId, input.targetUserId],
        );
        const member = memberRows[0];
        if (!member) {
          throw Object.assign(new Error(UNKNOWN_MEMBER_ERROR), { status: 404 });
        }
        return {
          userId: member.user_id,
          login: member.login,
          avatarUrl: member.avatar_url,
          role: asInstallationRole(member.role),
        };
      });
    },

    async removeInstallationMemberForUser(input: {
      actorUserId: string;
      installationId: number;
      targetUserId: string;
    }): Promise<boolean> {
      return await sql.transaction(async (tx) => {
        const { rows: actorRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.actorUserId],
        );
        const actor = actorRows[0];
        if (!actor) {
          throw Object.assign(new Error("That GitHub installation is not on your account."), {
            status: 403,
          });
        }
        if (asInstallationRole(actor.role) !== "admin") {
          throw Object.assign(new Error(ADMIN_REQUIRED_ERROR), { status: 403 });
        }
        const { rows: targetRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.targetUserId],
        );
        const target = targetRows[0];
        if (!target) {
          throw Object.assign(new Error(UNKNOWN_MEMBER_ERROR), { status: 404 });
        }
        if (asInstallationRole(target.role) === "admin") {
          const { rows: adminRows } = await tx.query<{ n: unknown }>(
            `SELECT count(*)::int AS n FROM installation_users
             WHERE installation_id = $1 AND role = 'admin'`,
            [input.installationId],
          );
          if (num(adminRows[0]?.n ?? 0) <= 1) {
            throw Object.assign(new Error(LAST_ADMIN_ERROR), { status: 409 });
          }
        }
        const { rows: deleted } = await tx.query<{ user_id: string }>(
          `DELETE FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           RETURNING user_id`,
          [input.installationId, input.targetUserId],
        );
        return Boolean(deleted[0]);
      });
    },

    async listInstallationInvitesForUser(
      userId: string,
      installationId: number,
    ): Promise<InstallationInvite[]> {
      const { rows } = await sql.query<{
        id: unknown;
        github_login: string;
        role: string;
        created_at: string | Date;
      }>(
        `SELECT i.id, i.github_login, i.role, i.created_at
         FROM installation_invites i
         WHERE i.installation_id = $1
           AND EXISTS (
             SELECT 1 FROM installation_users mine
             WHERE mine.installation_id = $1 AND mine.user_id = $2
           )
         ORDER BY i.github_login`,
        [installationId, userId],
      );
      return rows.map(inviteRow);
    },

    async upsertInstallationInviteForUser(input: {
      actorUserId: string;
      installationId: number;
      githubLogin: string;
      role: InstallationRole;
    }): Promise<InstallationInvite> {
      return await sql.transaction(async (tx) => {
        const { rows: actorRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.actorUserId],
        );
        const actor = actorRows[0];
        if (!actor) {
          throw Object.assign(new Error("That GitHub installation is not on your account."), {
            status: 403,
          });
        }
        if (asInstallationRole(actor.role) !== "admin") {
          throw Object.assign(new Error(ADMIN_REQUIRED_ERROR), { status: 403 });
        }
        const login = githubLoginKey(input.githubLogin);
        const { rows: memberRows } = await tx.query<{ login: string }>(
          `SELECT u.login
           FROM installation_users iu
           JOIN users u ON u.id = iu.user_id
           WHERE iu.installation_id = $1 AND lower(u.login) = $2`,
          [input.installationId, login],
        );
        if (memberRows[0]) {
          throw Object.assign(new Error(ALREADY_MEMBER_ERROR), { status: 409 });
        }
        const { rows } = await tx.query<{
          id: unknown;
          github_login: string;
          role: string;
          created_at: string | Date;
        }>(
          `INSERT INTO installation_invites (installation_id, github_login, role, created_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (installation_id, github_login)
           DO UPDATE SET
             role = excluded.role,
             created_by_user_id = excluded.created_by_user_id
           RETURNING id, github_login, role, created_at`,
          [input.installationId, login, input.role, input.actorUserId],
        );
        const invite = rows[0];
        if (!invite) throw new Error("Could not save that invite.");
        return inviteRow(invite);
      });
    },

    async revokeInstallationInviteForUser(input: {
      actorUserId: string;
      installationId: number;
      inviteId: number;
    }): Promise<InstallationInvite> {
      return await sql.transaction(async (tx) => {
        const { rows: actorRows } = await tx.query<{ role: string }>(
          `SELECT role FROM installation_users
           WHERE installation_id = $1 AND user_id = $2
           FOR UPDATE`,
          [input.installationId, input.actorUserId],
        );
        const actor = actorRows[0];
        if (!actor) {
          throw Object.assign(new Error("That GitHub installation is not on your account."), {
            status: 403,
          });
        }
        if (asInstallationRole(actor.role) !== "admin") {
          throw Object.assign(new Error(ADMIN_REQUIRED_ERROR), { status: 403 });
        }
        const { rows } = await tx.query<{
          id: unknown;
          github_login: string;
          role: string;
          created_at: string | Date;
        }>(
          `DELETE FROM installation_invites
           WHERE id = $1 AND installation_id = $2
           RETURNING id, github_login, role, created_at`,
          [input.inviteId, input.installationId],
        );
        const invite = rows[0];
        if (!invite) {
          throw Object.assign(new Error(UNKNOWN_INVITE_ERROR), { status: 404 });
        }
        return inviteRow(invite);
      });
    },

    async listWatchedPackagesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<WatchedPackageRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `SELECT wp.*
         FROM watched_packages wp
         JOIN installation_users iu ON iu.installation_id = wp.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR wp.installation_id = $2)
         ORDER BY wp.package_name`,
        [userId, scoped],
      );
      return rows.map(watchedPackageRow);
    },

    async listAllWatchedPackages(): Promise<WatchedPackageRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_packages ORDER BY id`);
      return rows.map(watchedPackageRow);
    },

    async getWatchedPackage(id: number): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_packages WHERE id = $1`, [id]);
      return rows[0] ? watchedPackageRow(rows[0]) : null;
    },

    async getWatchedPackageByName(
      installationId: number,
      packageName: string,
      registryOrigin: string = PUBLIC_NPM_ORIGIN,
    ): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `SELECT * FROM watched_packages
         WHERE installation_id = $1 AND package_name = $2 AND registry_origin = $3`,
        [installationId, packageName, registryOrigin],
      );
      return rows[0] ? watchedPackageRow(rows[0]) : null;
    },

    async insertPackageProtection(input: {
      installationId: number;
      packageId: number;
      verifiedVia: PackageProtectionRow["verified_via"];
      githubRepo?: string | null;
    }): Promise<PackageProtectionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO package_protections (installation_id, package_id, verified_via, github_repo)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (package_id) DO NOTHING
         RETURNING *`,
        [input.installationId, input.packageId, input.verifiedVia, input.githubRepo ?? null],
      );
      return rows[0] ? packageProtectionRow(rows[0]) : null;
    },

    async getPackageProtection(packageId: number): Promise<PackageProtectionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(`SELECT * FROM package_protections WHERE package_id = $1`, [packageId]);
      return rows[0] ? packageProtectionRow(rows[0]) : null;
    },

    async listPackageProtectionsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<PackageProtectionRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        verified_via: string;
        github_repo: string | null;
        created_at: string | Date;
      }>(
        `SELECT p.*
         FROM package_protections p
         JOIN installation_users iu ON iu.installation_id = p.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR p.installation_id = $2)
         ORDER BY p.created_at DESC`,
        [userId, scoped],
      );
      return rows.map(packageProtectionRow);
    },

    async latestPackageIdentitySnapshot(
      packageId: number,
    ): Promise<PackageIdentitySnapshotRow | null> {
      const rows = await this.listRecentPackageIdentitySnapshots(packageId, 1);
      return rows[0] ?? null;
    },

    async listRecentPackageIdentitySnapshots(
      packageId: number,
      limit: number,
    ): Promise<PackageIdentitySnapshotRow[]> {
      const take = Number.isFinite(limit) ? Math.max(1, Math.min(8, Math.floor(limit))) : 1;
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        version: string | null;
        maintainers: unknown;
        repository_url: string | null;
        homepage: string | null;
        bin_names: unknown;
        lifecycle_scripts: unknown;
        published_at: string | Date | null;
        dependency_names?: unknown;
        unpacked_bytes?: unknown;
        has_attestations?: boolean | null;
        attestation_predicate?: string | null;
        signature_keyids?: unknown;
        publisher_name?: string | null;
        trusted_publisher?: string | null;
        created_at: string | Date;
      }>(
        `SELECT * FROM package_identity_snapshots WHERE package_id = $1 ORDER BY id DESC LIMIT $2`,
        [packageId, take],
      );
      return rows.map(packageIdentitySnapshotRow);
    },

    async listOpenIdentityAlertsForPackage(
      installationId: number,
      packageName: string,
      kinds: readonly string[],
    ): Promise<string[]> {
      if (kinds.length === 0) return [];
      const placeholders = kinds.map((_, index) => `$${index + 3}`).join(", ");
      const { rows } = await sql.query<{ kind: string }>(
        `SELECT DISTINCT kind
         FROM alerts
         WHERE installation_id = $1
           AND resolved_at IS NULL
           AND (position($2 in title) > 0 OR position($2 in body) > 0)
           AND kind IN (${placeholders})
           AND row_within_retention(installation_id, created_at)
         ORDER BY kind ASC`,
        [installationId, packageName, ...kinds],
      );
      return rows.map((row) => row.kind);
    },

    async insertPackageIdentitySnapshot(input: {
      installationId: number;
      packageId: number;
      version?: string | null;
      maintainers: string[];
      repositoryUrl?: string | null;
      homepage?: string | null;
      binNames: string[];
      lifecycleScripts: string[];
      publishedAt?: string | Date | null;
      dependencyNames?: string[];
      unpackedBytes?: number | null;
      hasAttestations?: boolean | null;
      attestationPredicate?: string | null;
      signatureKeyids?: string[];
      publisherName?: string | null;
      trustedPublisher?: string | null;
    }): Promise<PackageIdentitySnapshotRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        version: string | null;
        maintainers: unknown;
        repository_url: string | null;
        homepage: string | null;
        bin_names: unknown;
        lifecycle_scripts: unknown;
        published_at: string | Date | null;
        dependency_names?: unknown;
        unpacked_bytes?: unknown;
        has_attestations?: boolean | null;
        attestation_predicate?: string | null;
        signature_keyids?: unknown;
        publisher_name?: string | null;
        trusted_publisher?: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO package_identity_snapshots (
           installation_id, package_id, version, maintainers, repository_url, homepage,
           bin_names, lifecycle_scripts, published_at, dependency_names, unpacked_bytes,
           has_attestations, attestation_predicate, signature_keyids,
           publisher_name, trusted_publisher
         )
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz, $10::jsonb, $11, $12, $13, $14::jsonb, $15, $16)
         RETURNING *`,
        [
          input.installationId,
          input.packageId,
          input.version ?? null,
          JSON.stringify(input.maintainers),
          input.repositoryUrl ?? null,
          input.homepage ?? null,
          JSON.stringify(input.binNames),
          JSON.stringify(input.lifecycleScripts),
          input.publishedAt ? iso(input.publishedAt) : null,
          JSON.stringify(input.dependencyNames ?? []),
          input.unpackedBytes ?? null,
          input.hasAttestations ?? null,
          input.attestationPredicate ?? null,
          JSON.stringify(input.signatureKeyids ?? []),
          input.publisherName ?? null,
          input.trustedPublisher ?? null,
        ],
      );
      if (!rows[0]) throw new Error("package identity snapshot insert returned no row");
      return packageIdentitySnapshotRow(rows[0]);
    },

    async insertIdentityCandidates(input: {
      installationId: number;
      packageId: number;
      candidates: Array<{ name: string; transformation: string }>;
    }): Promise<number> {
      let inserted = 0;
      for (const candidate of input.candidates) {
        const { rows } = await sql.query<{ id: unknown }>(
          `INSERT INTO identity_candidates (
             installation_id, package_id, candidate_name, transformation
           )
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (package_id, candidate_name) DO NOTHING
           RETURNING id`,
          [input.installationId, input.packageId, candidate.name, candidate.transformation],
        );
        if (rows[0]) inserted += 1;
      }
      return inserted;
    },

    async listIdentityCandidates(packageId: number): Promise<IdentityCandidateRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        candidate_name: string;
        transformation: string;
        first_seen_at: string | Date;
        last_checked_at: string | Date | null;
        registered_at: string | Date | null;
        last_version: string | null;
        last_published_at: string | Date | null;
        allowlisted_at: string | Date | null;
        allowlist_reason: string | null;
        allowlisted_by_login: string | null;
      }>(
        `SELECT * FROM identity_candidates WHERE package_id = $1 ORDER BY candidate_name ASC, id ASC`,
        [packageId],
      );
      return rows.map(identityCandidateRow);
    },

    async getIdentityCandidate(id: number): Promise<IdentityCandidateRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        candidate_name: string;
        transformation: string;
        first_seen_at: string | Date;
        last_checked_at: string | Date | null;
        registered_at: string | Date | null;
        last_version: string | null;
        last_published_at: string | Date | null;
        allowlisted_at: string | Date | null;
        allowlist_reason: string | null;
        allowlisted_by_login: string | null;
      }>(`SELECT * FROM identity_candidates WHERE id = $1`, [id]);
      return rows[0] ? identityCandidateRow(rows[0]) : null;
    },

    async listDueIdentityCandidates(
      packageId: number,
      limit: number,
      staleBefore?: Date | string | null,
    ): Promise<IdentityCandidateRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        candidate_name: string;
        transformation: string;
        first_seen_at: string | Date;
        last_checked_at: string | Date | null;
        registered_at: string | Date | null;
        last_version: string | null;
        last_published_at: string | Date | null;
        allowlisted_at: string | Date | null;
        allowlist_reason: string | null;
        allowlisted_by_login: string | null;
      }>(
        `SELECT * FROM identity_candidates
         WHERE package_id = $1 AND allowlisted_at IS NULL
           AND (
             $3::timestamptz IS NULL
             OR last_checked_at IS NULL
             OR last_checked_at < $3::timestamptz
           )
         ORDER BY last_checked_at ASC NULLS FIRST, id ASC
         LIMIT $2`,
        [packageId, limit, staleBefore ?? null],
      );
      return rows.map(identityCandidateRow);
    },

    async touchIdentityCandidateCheck(id: number): Promise<void> {
      await sql.query(`UPDATE identity_candidates SET last_checked_at = now() WHERE id = $1`, [id]);
    },

    async recordIdentityCandidatePack(input: {
      id: number;
      registeredAt: string | Date;
      lastVersion: string;
      lastPublishedAt?: string | Date | null;
    }): Promise<void> {
      await sql.query(
        `UPDATE identity_candidates
         SET last_checked_at = now(),
             registered_at = COALESCE(registered_at, $2::timestamptz),
             last_version = $3,
             last_published_at = $4::timestamptz
         WHERE id = $1`,
        [
          input.id,
          iso(input.registeredAt),
          input.lastVersion,
          input.lastPublishedAt ? iso(input.lastPublishedAt) : null,
        ],
      );
    },

    async allowlistIdentityCandidate(input: {
      id: number;
      packageId: number;
      reason: string;
      actorLogin: string;
    }): Promise<IdentityCandidateRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        candidate_name: string;
        transformation: string;
        first_seen_at: string | Date;
        last_checked_at: string | Date | null;
        registered_at: string | Date | null;
        last_version: string | null;
        last_published_at: string | Date | null;
        allowlisted_at: string | Date | null;
        allowlist_reason: string | null;
        allowlisted_by_login: string | null;
      }>(
        `UPDATE identity_candidates
         SET allowlisted_at = now(),
             allowlist_reason = $3,
             allowlisted_by_login = $4
         WHERE id = $1 AND package_id = $2 AND allowlisted_at IS NULL
         RETURNING *`,
        [input.id, input.packageId, input.reason, input.actorLogin],
      );
      return rows[0] ? identityCandidateRow(rows[0]) : null;
    },

    async revokeIdentityAllowlist(input: {
      id: number;
      packageId: number;
    }): Promise<IdentityCandidateRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        candidate_name: string;
        transformation: string;
        first_seen_at: string | Date;
        last_checked_at: string | Date | null;
        registered_at: string | Date | null;
        last_version: string | null;
        last_published_at: string | Date | null;
        allowlisted_at: string | Date | null;
        allowlist_reason: string | null;
        allowlisted_by_login: string | null;
      }>(
        `UPDATE identity_candidates
         SET allowlisted_at = NULL,
             allowlist_reason = NULL,
             allowlisted_by_login = NULL
         WHERE id = $1 AND package_id = $2 AND allowlisted_at IS NOT NULL
         RETURNING *`,
        [input.id, input.packageId],
      );
      return rows[0] ? identityCandidateRow(rows[0]) : null;
    },

    async listIdentityEvidenceAlerts(
      installationId: number,
      packageName: string,
    ): Promise<Array<{ kind: string; title: string }>> {
      const placeholders = IDENTITY_EVIDENCE_ALERT_KINDS.map((_, index) => `$${index + 3}`).join(
        ", ",
      );
      const { rows } = await sql.query<{ kind: string; title: string }>(
        `SELECT kind, title
         FROM alerts
         WHERE installation_id = $1
           AND (position($2 in title) > 0 OR position($2 in body) > 0)
           AND kind IN (${placeholders})
           AND row_within_retention(installation_id, created_at)
         ORDER BY created_at DESC, id DESC
         LIMIT 40`,
        [installationId, packageName, ...IDENTITY_EVIDENCE_ALERT_KINDS],
      );
      return rows.map((row) => ({ kind: row.kind, title: row.title }));
    },

    async getIdentityEvidencePackByPackage(packageId: number): Promise<IdentityEvidencePackRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        package_name: string;
        public_token: string;
        enabled: boolean;
        payload: unknown;
        created_by_login: string;
        updated_by_login: string;
        created_at: string | Date;
        updated_at: string | Date;
      }>(`SELECT * FROM identity_evidence_packs WHERE package_id = $1`, [packageId]);
      return rows[0] ? identityEvidencePackRow(rows[0]) : null;
    },

    async getIdentityEvidencePackByToken(token: string): Promise<IdentityEvidencePackRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        package_name: string;
        public_token: string;
        enabled: boolean;
        payload: unknown;
        created_by_login: string;
        updated_by_login: string;
        created_at: string | Date;
        updated_at: string | Date;
      }>(`SELECT * FROM identity_evidence_packs WHERE public_token = $1`, [token]);
      return rows[0] ? identityEvidencePackRow(rows[0]) : null;
    },

    async countEnabledAdvisoryPages(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM identity_evidence_packs WHERE installation_id = $1 AND enabled = TRUE`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async upsertIdentityEvidencePack(input: {
      installationId: number;
      packageId: number;
      packageName: string;
      publicToken: string;
      payload: unknown;
      actorLogin: string;
    }): Promise<IdentityEvidencePackRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        package_name: string;
        public_token: string;
        enabled: boolean;
        payload: unknown;
        created_by_login: string;
        updated_by_login: string;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `INSERT INTO identity_evidence_packs (
           installation_id, package_id, package_name, public_token, enabled, payload,
           created_by_login, updated_by_login
         )
         VALUES ($1, $2, $3, $4, FALSE, $5::jsonb, $6, $6)
         ON CONFLICT (package_id) DO UPDATE SET
           package_name = EXCLUDED.package_name,
           payload = EXCLUDED.payload,
           updated_by_login = EXCLUDED.updated_by_login,
           updated_at = now()
         RETURNING *`,
        [
          input.installationId,
          input.packageId,
          input.packageName,
          input.publicToken,
          JSON.stringify(input.payload),
          input.actorLogin,
        ],
      );
      if (!rows[0]) throw new Error("identity evidence upsert returned no row");
      return identityEvidencePackRow(rows[0]);
    },

    async setIdentityEvidenceEnabled(input: {
      packageId: number;
      enabled: boolean;
      actorLogin: string;
    }): Promise<IdentityEvidencePackRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        package_name: string;
        public_token: string;
        enabled: boolean;
        payload: unknown;
        created_by_login: string;
        updated_by_login: string;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `UPDATE identity_evidence_packs
         SET enabled = $2,
             updated_by_login = $3,
             updated_at = now()
         WHERE package_id = $1
         RETURNING *`,
        [input.packageId, input.enabled, input.actorLogin],
      );
      return rows[0] ? identityEvidencePackRow(rows[0]) : null;
    },

    async insertProtectedNamespace(input: {
      installationId: number;
      scope: string;
      createdByLogin: string;
    }): Promise<ProtectedNamespaceRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        scope: string;
        created_by_login: string;
        last_checked_at: string | Date | null;
        created_at: string | Date;
      }>(
        `INSERT INTO protected_namespaces (installation_id, scope, created_by_login)
         VALUES ($1, $2, $3)
         ON CONFLICT (installation_id) DO NOTHING
         RETURNING *`,
        [input.installationId, input.scope, input.createdByLogin],
      );
      return rows[0] ? protectedNamespaceRow(rows[0]) : null;
    },

    async getProtectedNamespace(id: number): Promise<ProtectedNamespaceRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        scope: string;
        created_by_login: string;
        last_checked_at: string | Date | null;
        created_at: string | Date;
      }>(`SELECT * FROM protected_namespaces WHERE id = $1`, [id]);
      if (!rows[0]) return null;
      const snapshot = await this.latestNamespaceSnapshot(id);
      return protectedNamespaceRow(rows[0], snapshot?.names ?? []);
    },

    async getProtectedNamespaceForInstallation(
      installationId: number,
    ): Promise<ProtectedNamespaceRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        scope: string;
        created_by_login: string;
        last_checked_at: string | Date | null;
        created_at: string | Date;
      }>(`SELECT * FROM protected_namespaces WHERE installation_id = $1`, [installationId]);
      if (!rows[0]) return null;
      const snapshot = await this.latestNamespaceSnapshot(num(rows[0].id));
      return protectedNamespaceRow(rows[0], snapshot?.names ?? []);
    },

    async listProtectedNamespacesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<ProtectedNamespaceRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        scope: string;
        created_by_login: string;
        last_checked_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT n.*
         FROM protected_namespaces n
         JOIN installation_users iu ON iu.installation_id = n.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR n.installation_id = $2)
         ORDER BY n.scope`,
        [userId, scoped],
      );
      const out: ProtectedNamespaceRow[] = [];
      for (const row of rows) {
        const snapshot = await this.latestNamespaceSnapshot(num(row.id));
        out.push(protectedNamespaceRow(row, snapshot?.names ?? []));
      }
      return out;
    },

    async deleteProtectedNamespaceForUser(id: number, userId: string): Promise<ProtectedNamespaceRow | null> {
      const existing = await this.getProtectedNamespace(id);
      if (!existing) return null;
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM protected_namespaces n
         USING installation_users iu
         WHERE n.id = $1
           AND n.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING n.id`,
        [id, userId],
      );
      return rows[0] ? existing : null;
    },

    async latestNamespaceSnapshot(namespaceId: number): Promise<NamespaceNameSnapshotRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        namespace_id: unknown;
        installation_id: unknown;
        names: unknown;
        created_at: string | Date;
      }>(
        `SELECT * FROM namespace_name_snapshots WHERE namespace_id = $1 ORDER BY id DESC LIMIT 1`,
        [namespaceId],
      );
      return rows[0] ? namespaceSnapshotRow(rows[0]) : null;
    },

    async insertNamespaceSnapshot(input: {
      namespaceId: number;
      installationId: number;
      names: string[];
    }): Promise<NamespaceNameSnapshotRow> {
      const { rows } = await sql.query<{
        id: unknown;
        namespace_id: unknown;
        installation_id: unknown;
        names: unknown;
        created_at: string | Date;
      }>(
        `INSERT INTO namespace_name_snapshots (namespace_id, installation_id, names)
         VALUES ($1, $2, $3::jsonb)
         RETURNING *`,
        [input.namespaceId, input.installationId, JSON.stringify(input.names)],
      );
      if (!rows[0]) throw new Error("namespace snapshot insert returned no row");
      return namespaceSnapshotRow(rows[0]);
    },

    async touchProtectedNamespaceChecked(id: number): Promise<void> {
      await sql.query(`UPDATE protected_namespaces SET last_checked_at = now() WHERE id = $1`, [id]);
    },

    async listDueProtectedNamespaces(): Promise<ProtectedNamespaceRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        scope: string;
        created_by_login: string;
        last_checked_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT * FROM protected_namespaces
         WHERE last_checked_at IS NULL OR last_checked_at < now() - interval '1 hour'
         ORDER BY last_checked_at ASC NULLS FIRST, id ASC`,
      );
      return rows.map((row) => protectedNamespaceRow(row));
    },

    async hasOpenNamespaceCheck(namespaceId: number): Promise<boolean> {
      const { rows } = await sql.query<{ ok: number }>(
        `SELECT 1 AS ok
         FROM jobs
         WHERE kind = 'namespace_check'
           AND status IN ('queued', 'running')
           AND (payload->>'namespaceId')::bigint = $1
         LIMIT 1`,
        [namespaceId],
      );
      return Boolean(rows[0]);
    },

    async countWatchedPackages(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM watched_packages WHERE installation_id = $1`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async insertWatchedPackage(
      installationId: number,
      packageName: string,
      registryOrigin: string = PUBLIC_NPM_ORIGIN,
    ): Promise<WatchedPackageRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_name: string;
        registry_origin?: string | null;
        last_version: string | null;
        last_dist_tags: unknown;
        last_tarball_url: string | null;
        last_shasum: string | null;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `INSERT INTO watched_packages (installation_id, package_name, registry_origin)
         VALUES ($1, $2, $3)
         ON CONFLICT (installation_id, package_name, registry_origin) DO NOTHING
         RETURNING *`,
        [installationId, packageName, registryOrigin],
      );
      return rows[0] ? watchedPackageRow(rows[0]) : null;
    },

    async deleteWatchedPackageForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM watched_packages wp
         USING installation_users iu
         WHERE wp.id = $1
           AND wp.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING wp.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async countWatchedOrigins(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM watched_origins WHERE installation_id = $1`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async listWatchedOriginsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<WatchedOriginRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin_url: string;
        host: string;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `SELECT wo.*
         FROM watched_origins wo
         JOIN installation_users iu ON iu.installation_id = wo.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR wo.installation_id = $2)
         ORDER BY wo.origin_url`,
        [userId, scoped],
      );
      return rows.map(watchedOriginRow);
    },

    async listAllWatchedOrigins(): Promise<WatchedOriginRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin_url: string;
        host: string;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_origins ORDER BY id`);
      return rows.map(watchedOriginRow);
    },

    async getWatchedOrigin(id: number): Promise<WatchedOriginRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin_url: string;
        host: string;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(`SELECT * FROM watched_origins WHERE id = $1`, [id]);
      return rows[0] ? watchedOriginRow(rows[0]) : null;
    },

    async insertWatchedOrigin(
      installationId: number,
      originUrl: string,
      host: string,
    ): Promise<WatchedOriginRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin_url: string;
        host: string;
        last_sha256: string | null;
        last_checked_at: string | Date | null;
        last_scanned_at: string | Date | null;
        last_scan_status: string | null;
      }>(
        `INSERT INTO watched_origins (installation_id, origin_url, host)
         VALUES ($1, $2, $3)
         ON CONFLICT (installation_id, origin_url) DO NOTHING
         RETURNING *`,
        [installationId, originUrl, host],
      );
      return rows[0] ? watchedOriginRow(rows[0]) : null;
    },

    async deleteWatchedOriginForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM watched_origins wo
         USING installation_users iu
         WHERE wo.id = $1
           AND wo.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING wo.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async touchWatchedOrigin(id: number): Promise<void> {
      await sql.query(`UPDATE watched_origins SET last_checked_at = now() WHERE id = $1`, [id]);
    },

    async recordWatchedOriginScan(
      id: number,
      input: { sha256: string | null; status: string },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_origins SET
           last_checked_at = now(),
           last_scanned_at = now(),
           last_scan_status = $2,
           last_sha256 = COALESCE($3, last_sha256)
         WHERE id = $1`,
        [id, input.status, input.sha256],
      );
    },

    async recordOriginMapIdentity(
      id: number,
      input: { debugIds: string[]; release: string | null; publicMap: boolean },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_origins SET
           last_debug_ids = $2::jsonb,
           last_release = $3,
           last_public_map = $4
         WHERE id = $1`,
        [id, JSON.stringify(input.debugIds), input.release, input.publicMap],
      );
    },

    async recordPackageMapIdentity(
      id: number,
      input: { debugIds: string[]; release: string | null; publicMap: boolean },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_packages SET
           last_debug_ids = $2::jsonb,
           last_release = $3,
           last_public_map = $4
         WHERE id = $1`,
        [id, JSON.stringify(input.debugIds), input.release, input.publicMap],
      );
    },

    async listMapIdentities(installationId: number): Promise<MapIdentityRow[]> {
      const { rows: origins } = await sql.query<{
        id: unknown;
        host: string;
        last_debug_ids: unknown;
        last_release: string | null;
        last_public_map: boolean | null;
      }>(
        `SELECT id, host, last_debug_ids, last_release, last_public_map
         FROM watched_origins
         WHERE installation_id = $1
         ORDER BY id`,
        [installationId],
      );
      const { rows: packages } = await sql.query<{
        id: unknown;
        package_name: string;
        last_debug_ids: unknown;
        last_release: string | null;
        last_public_map: boolean | null;
      }>(
        `SELECT id, package_name, last_debug_ids, last_release, last_public_map
         FROM watched_packages
         WHERE installation_id = $1
         ORDER BY id`,
        [installationId],
      );
      return [
        ...origins.map((row) => ({
          source: "origin" as const,
          id: num(row.id),
          label: row.host,
          debugIds: parseStringArray(row.last_debug_ids),
          release: row.last_release,
          publicMap: Boolean(row.last_public_map),
        })),
        ...packages.map((row) => ({
          source: "package" as const,
          id: num(row.id),
          label: row.package_name,
          debugIds: parseStringArray(row.last_debug_ids),
          release: row.last_release,
          publicMap: Boolean(row.last_public_map),
        })),
      ];
    },

    async countNpmRegistries(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM npm_registries WHERE installation_id = $1`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async listNpmRegistriesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NpmRegistryRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin: string;
        host: string;
        updated_at: string | Date;
      }>(
        `SELECT r.id, r.installation_id, r.origin, r.host, r.updated_at
         FROM npm_registries r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR r.installation_id = $2)
         ORDER BY r.host`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installation_id: num(row.installation_id),
        origin: row.origin,
        host: row.host,
        updated_at: iso(row.updated_at) ?? new Date().toISOString(),
      }));
    },

    async upsertNpmRegistry(input: {
      installationId: number;
      origin: string;
      host: string;
      token: string;
    }): Promise<NpmRegistryRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt registry tokens."), { status: 400 });
      }
      const ciphertext = encryptSecret(input.token, tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        origin: string;
        host: string;
        updated_at: string | Date;
      }>(
        `INSERT INTO npm_registries (installation_id, origin, host, token_ciphertext)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (installation_id, origin) DO UPDATE SET
           host = excluded.host,
           token_ciphertext = excluded.token_ciphertext,
           updated_at = now()
         RETURNING id, installation_id, origin, host, updated_at`,
        [input.installationId, input.origin, input.host, ciphertext],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save the registry token.");
      return {
        id: num(row.id),
        installation_id: num(row.installation_id),
        origin: row.origin,
        host: row.host,
        updated_at: iso(row.updated_at) ?? new Date().toISOString(),
      };
    },

    async deleteNpmRegistryForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM npm_registries r
         USING installation_users iu
         WHERE r.id = $1
           AND r.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING r.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getNpmRegistryAuth(
      installationId: number,
      origin: string,
    ): Promise<{ origin: string; host: string; token: string } | null> {
      const { rows } = await sql.query<{ origin: string; host: string; token_ciphertext: string }>(
        `SELECT origin, host, token_ciphertext
         FROM npm_registries
         WHERE installation_id = $1 AND origin = $2`,
        [installationId, origin],
      );
      const row = rows[0];
      if (!row || !tokenSecret) return null;
      return {
        origin: row.origin,
        host: row.host,
        token: decryptSecret(row.token_ciphertext, tokenSecret),
      };
    },

    async listMapDestinationsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<MapDestinationRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        org_slug: string | null;
        project_slug: string;
        last_checked_at: string | Date | null;
        last_status: string | null;
        last_error: string | null;
        last_fingerprint: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.kind, d.host, d.org_slug, d.project_slug,
                d.last_checked_at, d.last_status, d.last_error, d.last_fingerprint,
                d.created_at, d.updated_at
         FROM map_destinations d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR d.installation_id = $2)
         ORDER BY d.kind`,
        [userId, scoped],
      );
      return rows.map(mapDestinationRow);
    },

    async listMapDestinationsForInstall(installationId: number): Promise<MapDestinationRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        org_slug: string | null;
        project_slug: string;
        last_checked_at: string | Date | null;
        last_status: string | null;
        last_error: string | null;
        last_fingerprint: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, installation_id, kind, host, org_slug, project_slug,
                last_checked_at, last_status, last_error, last_fingerprint,
                created_at, updated_at
         FROM map_destinations
         WHERE installation_id = $1
         ORDER BY kind`,
        [installationId],
      );
      return rows.map(mapDestinationRow);
    },

    async listAllMapDestinations(): Promise<MapDestinationRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        org_slug: string | null;
        project_slug: string;
        last_checked_at: string | Date | null;
        last_status: string | null;
        last_error: string | null;
        last_fingerprint: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, installation_id, kind, host, org_slug, project_slug,
                last_checked_at, last_status, last_error, last_fingerprint,
                created_at, updated_at
         FROM map_destinations
         ORDER BY id`,
      );
      return rows.map(mapDestinationRow);
    },

    async getMapDestination(id: number): Promise<MapDestinationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        org_slug: string | null;
        project_slug: string;
        last_checked_at: string | Date | null;
        last_status: string | null;
        last_error: string | null;
        last_fingerprint: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, installation_id, kind, host, org_slug, project_slug,
                last_checked_at, last_status, last_error, last_fingerprint,
                created_at, updated_at
         FROM map_destinations
         WHERE id = $1`,
        [id],
      );
      return rows[0] ? mapDestinationRow(rows[0]) : null;
    },

    async upsertMapDestination(input: {
      installationId: number;
      kind: MapDestinationKind;
      host: string;
      orgSlug: string | null;
      projectSlug: string;
      token: string;
    }): Promise<MapDestinationRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt map destination tokens."), {
          status: 400,
        });
      }
      const ciphertext = encryptSecret(input.token, tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        org_slug: string | null;
        project_slug: string;
        last_checked_at: string | Date | null;
        last_status: string | null;
        last_error: string | null;
        last_fingerprint: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `INSERT INTO map_destinations (
           installation_id, kind, host, org_slug, project_slug, token_ciphertext
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (installation_id, kind) DO UPDATE SET
           host = excluded.host,
           org_slug = excluded.org_slug,
           project_slug = excluded.project_slug,
           token_ciphertext = excluded.token_ciphertext,
           updated_at = now()
         RETURNING id, installation_id, kind, host, org_slug, project_slug,
                   last_checked_at, last_status, last_error, last_fingerprint,
                   created_at, updated_at`,
        [
          input.installationId,
          input.kind,
          input.host,
          input.orgSlug,
          input.projectSlug,
          ciphertext,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save the map destination.");
      return mapDestinationRow(row);
    },

    async deleteMapDestinationForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM map_destinations d
         USING installation_users iu
         WHERE d.id = $1
           AND d.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING d.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getMapDestinationAuth(
      id: number,
    ): Promise<{ id: number; kind: MapDestinationKind; token: string } | null> {
      const { rows } = await sql.query<{
        id: unknown;
        kind: string;
        token_ciphertext: string;
      }>(
        `SELECT id, kind, token_ciphertext FROM map_destinations WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      if (!row || !tokenSecret) return null;
      return {
        id: num(row.id),
        kind: asMapKind(row.kind),
        token: decryptSecret(row.token_ciphertext, tokenSecret),
      };
    },

    async recordMapDestinationCheck(
      id: number,
      input: { status: string; error: string | null; fingerprint: string },
    ): Promise<void> {
      await sql.query(
        `UPDATE map_destinations SET
           last_checked_at = now(),
           last_status = $2,
           last_error = $3,
           last_fingerprint = $4,
           updated_at = now()
         WHERE id = $1`,
        [id, input.status, input.error, input.fingerprint],
      );
    },

    async listNotificationDestinationsForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NotificationDestinationRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        project_key: string | null;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.kind, d.host, d.project_key, d.last_delivery_at,
                d.last_delivery_status, d.last_delivery_error, d.updated_at
         FROM notification_destinations d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR d.installation_id = $2)
         ORDER BY d.kind`,
        [userId, scoped],
      );
      return rows.map((row) => destinationRow(row));
    },

    async getNotificationDestinationForUser(
      id: number,
      userId: string,
    ): Promise<NotificationDestinationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        project_key: string | null;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.kind, d.host, d.project_key, d.last_delivery_at,
                d.last_delivery_status, d.last_delivery_error, d.updated_at
         FROM notification_destinations d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE d.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      const row = rows[0];
      if (!row) return null;
      return destinationRow(row);
    },

    async upsertSlackDestination(input: {
      installationId: number;
      webhookUrl: string;
      host: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({ ...input, kind: "slack" });
    },

    async upsertSiemDestination(input: {
      installationId: number;
      webhookUrl: string;
      host: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({ ...input, kind: "siem" });
    },

    async upsertPagerDutyDestination(input: {
      installationId: number;
      routingKey: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({
        installationId: input.installationId,
        kind: "pagerduty",
        webhookUrl: input.routingKey,
        host: "events.pagerduty.com",
      });
    },

    async upsertJiraDestination(input: {
      installationId: number;
      host: string;
      projectKey: string;
      secret: string;
    }): Promise<NotificationDestinationRow> {
      return await this.upsertNotificationDestination({
        installationId: input.installationId,
        kind: "jira",
        webhookUrl: input.secret,
        host: input.host,
        projectKey: input.projectKey,
      });
    },

    async upsertNotificationDestination(input: {
      installationId: number;
      kind: NotificationKind;
      webhookUrl: string;
      host: string;
      projectKey?: string | null;
    }): Promise<NotificationDestinationRow> {
      if (!tokenSecret) {
        throw Object.assign(new Error("This instance cannot encrypt notification webhooks."), {
          status: 400,
        });
      }
      const ciphertext = encryptSecret(input.webhookUrl, tokenSecret);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        kind: string;
        host: string;
        project_key: string | null;
        last_delivery_at: string | Date | null;
        last_delivery_status: string | null;
        last_delivery_error: string | null;
        updated_at: string | Date;
      }>(
        `INSERT INTO notification_destinations (
           installation_id, kind, host, project_key, webhook_ciphertext
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (installation_id, kind) DO UPDATE SET
           host = excluded.host,
           project_key = excluded.project_key,
           webhook_ciphertext = excluded.webhook_ciphertext,
           updated_at = now()
         RETURNING id, installation_id, kind, host, project_key, last_delivery_at,
                   last_delivery_status, last_delivery_error, updated_at`,
        [input.installationId, input.kind, input.host, input.projectKey ?? null, ciphertext],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not save that webhook.");
      return destinationRow(row);
    },

    async deleteNotificationDestinationForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM notification_destinations d
         USING installation_users iu
         WHERE d.id = $1
           AND d.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING d.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getSlackWebhookForInstallation(installationId: number): Promise<{
      id: number;
      url: string;
    } | null> {
      return await this.getDestinationWebhookForInstallation(installationId, "slack");
    },

    async getSiemWebhookForInstallation(installationId: number): Promise<{
      id: number;
      url: string;
    } | null> {
      return await this.getDestinationWebhookForInstallation(installationId, "siem");
    },

    async getPagerDutyKeyForInstallation(installationId: number): Promise<{
      id: number;
      routingKey: string;
    } | null> {
      const dest = await this.getDestinationWebhookForInstallation(installationId, "pagerduty");
      if (!dest) return null;
      return { id: dest.id, routingKey: dest.url };
    },

    async getJiraAuthForInstallation(installationId: number): Promise<{
      id: number;
      host: string;
      projectKey: string;
      secret: JiraSecret;
    } | null> {
      const { rows } = await sql.query<{
        id: unknown;
        host: string;
        project_key: string | null;
        webhook_ciphertext: string;
      }>(
        `SELECT id, host, project_key, webhook_ciphertext
         FROM notification_destinations
         WHERE installation_id = $1 AND kind = 'jira'`,
        [installationId],
      );
      const row = rows[0];
      if (!row || !tokenSecret || !row.project_key) return null;
      const secret = decodeJiraSecret(decryptSecret(row.webhook_ciphertext, tokenSecret));
      if (!secret) return null;
      return {
        id: num(row.id),
        host: row.host,
        projectKey: row.project_key,
        secret,
      };
    },

    async getDestinationWebhookForInstallation(
      installationId: number,
      kind: NotificationKind,
    ): Promise<{
      id: number;
      url: string;
    } | null> {
      if (kind === "jira") return null;
      const { rows } = await sql.query<{ id: unknown; webhook_ciphertext: string }>(
        `SELECT id, webhook_ciphertext
         FROM notification_destinations
         WHERE installation_id = $1 AND kind = $2`,
        [installationId, kind],
      );
      const row = rows[0];
      if (!row || !tokenSecret) return null;
      return { id: num(row.id), url: decryptSecret(row.webhook_ciphertext, tokenSecret) };
    },

    async recordNotificationDelivery(input: {
      installationId: number;
      destinationId: number;
      alertId?: number | null;
      kind: NotificationKind;
      status: "sent" | "failed";
      error?: string | null;
    }): Promise<void> {
      await sql.query(
        `INSERT INTO notification_deliveries (
           installation_id, destination_id, alert_id, kind, status, invented_incident, error
         )
         VALUES ($1, $2, $3, $4, $5, false, $6)`,
        [
          input.installationId,
          input.destinationId,
          input.alertId ?? null,
          input.kind,
          input.status,
          input.error ?? null,
        ],
      );
      await sql.query(
        `UPDATE notification_destinations
         SET last_delivery_at = now(),
             last_delivery_status = $2,
             last_delivery_error = $3,
             updated_at = now()
         WHERE id = $1`,
        [input.destinationId, input.status, input.error ?? null],
      );
    },

    async listNotificationDeliveriesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NotificationDeliveryRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        alert_id: unknown;
        kind: string;
        status: "sent" | "failed";
        error: string | null;
        created_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.destination_id, d.alert_id, d.kind, d.status,
                d.error, d.created_at
         FROM notification_deliveries d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR d.installation_id = $2)
           AND row_within_retention(d.installation_id, d.created_at)
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT 50`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installationId: num(row.installation_id),
        destinationId:
          row.destination_id === null || row.destination_id === undefined
            ? null
            : num(row.destination_id),
        alertId: row.alert_id === null || row.alert_id === undefined ? null : num(row.alert_id),
        kind: asNotificationKind(row.kind),
        status: row.status,
        inventedIncident: false,
        error: row.error,
        createdAt: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async installationHasRepoFullName(installationId: number, fullName: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM repos
         WHERE installation_id = $1 AND lower(full_name) = lower($2)`,
        [installationId, fullName],
      );
      return Number(rows[0]?.n ?? 0) > 0;
    },

    async installationHasWatchedPackage(installationId: number, packageName: string): Promise<boolean> {
      const { rows } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM watched_packages
         WHERE installation_id = $1 AND package_name = $2`,
        [installationId, packageName],
      );
      return Number(rows[0]?.n ?? 0) > 0;
    },

    async listNotificationRoutesForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<NotificationRouteRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        min_severity: string;
        repo_full_name: string | null;
        package_name: string | null;
        team_login: string | null;
        created_at: string | Date;
      }>(
        `SELECT r.id, r.installation_id, r.destination_id, r.min_severity, r.repo_full_name,
                r.package_name, r.team_login, r.created_at
         FROM notification_routes r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR r.installation_id = $2)
         ORDER BY r.id`,
        [userId, scoped],
      );
      return rows.map(routeRow);
    },

    async listNotificationRoutesForInstallation(
      installationId: number,
    ): Promise<NotificationRouteRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        min_severity: string;
        repo_full_name: string | null;
        package_name: string | null;
        team_login: string | null;
        created_at: string | Date;
      }>(
        `SELECT id, installation_id, destination_id, min_severity, repo_full_name,
                package_name, team_login, created_at
         FROM notification_routes
         WHERE installation_id = $1
         ORDER BY id`,
        [installationId],
      );
      return rows.map(routeRow);
    },

    async countNotificationRoutes(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM notification_routes WHERE installation_id = $1`,
        [installationId],
      );
      return Number(rows[0]?.n ?? 0);
    },

    async insertNotificationRoute(input: {
      installationId: number;
      destinationId: number;
      minSeverity: RouteMinSeverity;
      repoFullName: string | null;
      packageName: string | null;
      teamLogin: string | null;
    }): Promise<NotificationRouteRow> {
      try {
        const { rows } = await sql.query<{
          id: unknown;
          installation_id: unknown;
          destination_id: unknown;
          min_severity: string;
          repo_full_name: string | null;
          package_name: string | null;
          team_login: string | null;
          created_at: string | Date;
        }>(
          `INSERT INTO notification_routes (
             installation_id, destination_id, min_severity, repo_full_name, package_name, team_login
           )
           SELECT $1, d.id, $3, $4, $5, $6
           FROM notification_destinations d
           WHERE d.id = $2 AND d.installation_id = $1
           RETURNING id, installation_id, destination_id, min_severity, repo_full_name,
                     package_name, team_login, created_at`,
          [
            input.installationId,
            input.destinationId,
            input.minSeverity,
            input.repoFullName,
            input.packageName,
            input.teamLogin,
          ],
        );
        const row = rows[0];
        if (!row) {
          throw Object.assign(new Error("Unknown destination."), { status: 404 });
        }
        return routeRow(row);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw Object.assign(new Error("That route already exists."), { status: 409 });
        }
        throw error;
      }
    },

    async deleteNotificationRouteForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `DELETE FROM notification_routes r
         USING installation_users iu
         WHERE r.id = $1
           AND r.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING r.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async getNotificationRouteForUser(
      id: number,
      userId: string,
    ): Promise<NotificationRouteRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        min_severity: string;
        repo_full_name: string | null;
        package_name: string | null;
        team_login: string | null;
        created_at: string | Date;
      }>(
        `SELECT r.id, r.installation_id, r.destination_id, r.min_severity, r.repo_full_name,
                r.package_name, r.team_login, r.created_at
         FROM notification_routes r
         JOIN installation_users iu ON iu.installation_id = r.installation_id
         WHERE r.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      const row = rows[0];
      return row ? routeRow(row) : null;
    },

    async assignAlertFromRouting(
      alertId: number,
      installationId: number,
      assigneeLogin: string,
    ): Promise<void> {
      const members = await this.listInstallationMemberLogins(installationId);
      const match = members.find((row) => row.toLowerCase() === assigneeLogin.toLowerCase());
      if (!match) return;
      await sql.transaction(async (tx) => {
        const { rows } = await tx.query<{ assigned_to_login: string | null }>(
          `SELECT assigned_to_login FROM alerts WHERE id = $1 AND installation_id = $2`,
          [alertId, installationId],
        );
        if (!rows[0] || rows[0].assigned_to_login) return;
        await tx.query(`UPDATE alerts SET assigned_to_login = $2 WHERE id = $1`, [alertId, match]);
        await tx.query(
          `INSERT INTO alert_events (alert_id, installation_id, actor_login, action, detail)
           VALUES ($1, $2, 'nospoilers', 'assigned', $3)`,
          [alertId, installationId, match],
        );
      });
    },

    async listTimelineForUser(
      userId: string,
      installationId: number,
    ): Promise<TimelineEntry[]> {
      if (!optionalInstallId(installationId)) return [];
      const { rows } = await sql.query<{
        at: string | Date;
        type: "alert" | "alert_event" | "delivery";
        alert_id: unknown;
        kind: string | null;
        title: string | null;
        full_name: string | null;
        action: string | null;
        actor_login: string | null;
        delivery_status: "sent" | "failed" | null;
        invented_incident: boolean | null;
      }>(
        `SELECT * FROM (
           SELECT a.created_at AS at,
                  'alert'::text AS type,
                  a.id AS alert_id,
                  a.kind,
                  a.title,
                  r.full_name,
                  NULL::text AS action,
                  NULL::text AS actor_login,
                  NULL::text AS delivery_status,
                  NULL::boolean AS invented_incident
           FROM alerts a
           LEFT JOIN repos r ON r.id = a.repo_id
           JOIN installation_users iu ON iu.installation_id = a.installation_id
           WHERE iu.user_id = $1
             AND a.installation_id = $2
             AND row_within_retention(a.installation_id, a.created_at)
           UNION ALL
           SELECT e.created_at AS at,
                  'alert_event'::text AS type,
                  e.alert_id,
                  a.kind,
                  a.title,
                  r.full_name,
                  e.action,
                  e.actor_login,
                  NULL::text AS delivery_status,
                  NULL::boolean AS invented_incident
           FROM alert_events e
           JOIN alerts a ON a.id = e.alert_id
           LEFT JOIN repos r ON r.id = a.repo_id
           JOIN installation_users iu ON iu.installation_id = e.installation_id
           WHERE iu.user_id = $1
             AND e.installation_id = $2
             AND row_within_retention(e.installation_id, e.created_at)
           UNION ALL
           SELECT d.created_at AS at,
                  'delivery'::text AS type,
                  d.alert_id,
                  d.kind,
                  NULL::text AS title,
                  NULL::text AS full_name,
                  NULL::text AS action,
                  NULL::text AS actor_login,
                  d.status AS delivery_status,
                  false AS invented_incident
           FROM notification_deliveries d
           JOIN installation_users iu ON iu.installation_id = d.installation_id
           WHERE iu.user_id = $1
             AND d.installation_id = $2
             AND row_within_retention(d.installation_id, d.created_at)
         ) timeline
         ORDER BY at DESC
         LIMIT $3`,
        [userId, installationId, TIMELINE_LIMIT],
      );
      return rows.map((row) => ({
        at: iso(row.at) ?? new Date().toISOString(),
        type: row.type,
        alertId: row.alert_id === null || row.alert_id === undefined ? null : num(row.alert_id),
        kind: row.kind,
        title: row.title,
        fullName: row.full_name,
        action: row.action,
        actorLogin: row.actor_login,
        deliveryStatus: row.delivery_status,
        inventedIncident: row.invented_incident === false ? false : null,
      }));
    },

    async countScanApiTokens(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM scan_api_tokens
         WHERE installation_id = $1 AND revoked_at IS NULL`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async listScanApiTokensForUser(
      userId: string,
      installationId?: number | null,
    ): Promise<ScanApiTokenRow[]> {
      const scoped = optionalInstallId(installationId);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        name: string;
        token_prefix: string;
        created_by_login: string;
        last_used_at: string | Date | null;
        created_at: string | Date;
      }>(
        `SELECT t.id, t.installation_id, t.name, t.token_prefix, t.created_by_login,
                t.last_used_at, t.created_at
         FROM scan_api_tokens t
         JOIN installation_users iu ON iu.installation_id = t.installation_id
         WHERE iu.user_id = $1 AND t.revoked_at IS NULL
           AND ($2::bigint IS NULL OR t.installation_id = $2)
         ORDER BY t.created_at DESC`,
        [userId, scoped],
      );
      return rows.map((row) => ({
        id: num(row.id),
        installation_id: num(row.installation_id),
        name: row.name,
        token_prefix: row.token_prefix,
        created_by_login: row.created_by_login,
        last_used_at: iso(row.last_used_at),
        created_at: iso(row.created_at) ?? new Date().toISOString(),
      }));
    },

    async insertScanApiToken(input: {
      installationId: number;
      name: string;
      createdByLogin: string;
    }): Promise<ScanApiTokenRow & { token: string }> {
      const minted = mintScanToken();
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        name: string;
        token_prefix: string;
        created_by_login: string;
        last_used_at: string | Date | null;
        created_at: string | Date;
      }>(
        `INSERT INTO scan_api_tokens (
           installation_id, name, token_prefix, token_hash, created_by_login
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, installation_id, name, token_prefix, created_by_login, last_used_at, created_at`,
        [input.installationId, input.name, minted.tokenPrefix, minted.tokenHash, input.createdByLogin],
      );
      const row = rows[0];
      if (!row) throw new Error("Could not mint a scan API token.");
      return {
        id: num(row.id),
        installation_id: num(row.installation_id),
        name: row.name,
        token_prefix: row.token_prefix,
        created_by_login: row.created_by_login,
        last_used_at: iso(row.last_used_at),
        created_at: iso(row.created_at) ?? new Date().toISOString(),
        token: minted.token,
      };
    },

    async revokeScanApiTokenForUser(id: number, userId: string): Promise<boolean> {
      const { rows } = await sql.query<{ id: unknown }>(
        `UPDATE scan_api_tokens t
         SET revoked_at = now()
         FROM installation_users iu
         WHERE t.id = $1
           AND t.revoked_at IS NULL
           AND t.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING t.id`,
        [id, userId],
      );
      return Boolean(rows[0]);
    },

    async authenticateScanToken(
      token: string,
    ): Promise<{ id: number; installationId: number } | null> {
      const hash = hashScanToken(token);
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        token_hash: string;
      }>(
        `SELECT id, installation_id, token_hash
         FROM scan_api_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hash],
      );
      const row = rows[0];
      if (!row || !hashesMatch(row.token_hash, hash)) return null;
      return { id: num(row.id), installationId: num(row.installation_id) };
    },

    async touchScanApiToken(id: number): Promise<void> {
      await sql.query(`UPDATE scan_api_tokens SET last_used_at = now() WHERE id = $1`, [id]);
    },

    async touchWatchedPackage(
      id: number,
      input: {
        version?: string | null;
        distTags?: Record<string, string> | null;
        tarballUrl?: string | null;
        shasum?: string | null;
      },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_packages SET
           last_checked_at = now(),
           last_version = COALESCE($2, last_version),
           last_dist_tags = COALESCE($3::jsonb, last_dist_tags),
           last_tarball_url = COALESCE($4, last_tarball_url),
           last_shasum = COALESCE($5, last_shasum)
         WHERE id = $1`,
        [
          id,
          input.version ?? null,
          input.distTags ? JSON.stringify(input.distTags) : null,
          input.tarballUrl ?? null,
          input.shasum ?? null,
        ],
      );
    },

    async recordWatchedPackageScan(
      id: number,
      input: { sha256: string | null; status: string },
    ): Promise<void> {
      await sql.query(
        `UPDATE watched_packages SET
           last_scanned_at = now(),
           last_scan_status = $2,
           last_sha256 = COALESCE($3, last_sha256)
         WHERE id = $1`,
        [id, input.status, input.sha256],
      );
    },

    async insertScanReceipt(input: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      receipt: SignedReceipt;
    }): Promise<ScanReceiptRow> {
      const signed = input.receipt;
      if (signed.status === "passed" && signed.ok !== true) {
        throw new Error("cannot mint a passing receipt for a failed scan");
      }
      if (signed.status === "inconclusive" && signed.ok) {
        throw new Error("inconclusive receipts cannot be marked ok");
      }
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `INSERT INTO scan_receipts (
           installation_id, package_id, repo_id, coordinate,
           artifact_sha256, artifact_sha512, artifact_bytes,
           status, engine_version, manifest, finding_fingerprints,
           signature, receipt
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb
         )
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.repoId ?? null,
          signed.coordinate,
          signed.artifactSha256,
          signed.artifactSha512,
          signed.artifactBytes,
          signed.status,
          signed.engineVersion,
          JSON.stringify(signed.manifest),
          JSON.stringify(signed.findingFingerprints),
          signed.signature,
          JSON.stringify(signed),
        ],
      );
      if (!rows[0]) throw new Error("scan receipt insert returned no row");
      return scanReceiptRow(rows[0]);
    },

    async getScanReceiptForUser(id: number, userId: string): Promise<ScanReceiptRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT sr.*
         FROM scan_receipts sr
         JOIN installation_users iu ON iu.installation_id = sr.installation_id
         WHERE sr.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      return rows[0] ? scanReceiptRow(rows[0]) : null;
    },

    async listScanReceiptsForUser(
      userId: string,
      opts: { packageId?: number; repoId?: number; limit?: number } = {},
    ): Promise<ScanReceiptRow[]> {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT sr.*
         FROM scan_receipts sr
         JOIN installation_users iu ON iu.installation_id = sr.installation_id
         WHERE iu.user_id = $1
           AND ($2::bigint IS NULL OR sr.package_id = $2)
           AND ($3::bigint IS NULL OR sr.repo_id = $3)
           AND row_within_retention(sr.installation_id, sr.created_at)
         ORDER BY sr.created_at DESC, sr.id DESC
         LIMIT $4`,
        [userId, opts.packageId ?? null, opts.repoId ?? null, limit],
      );
      return rows.map(scanReceiptRow);
    },

    async latestScanReceipts(opts: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      coordinate?: string | null;
      limit?: number;
    }): Promise<ScanReceiptRow[]> {
      const limit = Math.min(10, Math.max(1, opts.limit ?? 2));
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM scan_receipts
         WHERE installation_id = $1
           AND (
             ($2::bigint IS NOT NULL AND package_id = $2)
             OR ($2::bigint IS NULL AND $3::bigint IS NOT NULL AND repo_id = $3 AND ($4::text IS NULL OR coordinate = $4))
             OR ($2::bigint IS NULL AND $3::bigint IS NULL AND $4::text IS NOT NULL AND coordinate = $4)
           )
         ORDER BY id DESC
         LIMIT $5`,
        [
          opts.installationId,
          opts.packageId ?? null,
          opts.repoId ?? null,
          opts.coordinate ?? null,
          limit,
        ],
      );
      return rows.map(scanReceiptRow);
    },

    async getScanReceipt(id: number): Promise<ScanReceiptRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        artifact_bytes: unknown;
        status: string;
        engine_version: string;
        manifest: unknown;
        finding_fingerprints: unknown;
        signature: string;
        receipt: unknown;
        created_at: string | Date;
      }>(`SELECT * FROM scan_receipts WHERE id = $1`, [id]);
      return rows[0] ? scanReceiptRow(rows[0]) : null;
    },

    async latestReleaseRevision(
      installationId: number,
      coordinate: string,
      channel: ReleaseChannel,
    ): Promise<ReleaseRevisionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        channel: string;
        coordinate: string;
        artifact_sha256: string;
        artifact_sha512: string | null;
        source_revision: string | null;
        ci_run_url: string | null;
        previous_sha256: string | null;
        mismatch: boolean | unknown;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM release_revisions
         WHERE installation_id = $1 AND coordinate = $2 AND channel = $3
         ORDER BY id DESC
         LIMIT 1`,
        [installationId, coordinate, channel],
      );
      return rows[0] ? releaseRevisionRow(rows[0]) : null;
    },

    async insertReleaseRevision(input: {
      installationId: number;
      packageId?: number | null;
      repoId?: number | null;
      receiptId: number;
      channel: ReleaseChannel;
      coordinate: string;
      artifactSha256: string;
      artifactSha512?: string | null;
      artifactBytes?: number | null;
      mediaType?: string | null;
      sourceRevision?: string | null;
      ciRunUrl?: string | null;
      previousSha256?: string | null;
      mismatch: boolean;
    }): Promise<ReleaseRevisionRow> {
      const { rows } = await sql.query<ReleaseRevisionSqlRow>(
        `INSERT INTO release_revisions (
           installation_id, package_id, repo_id, receipt_id, channel, coordinate,
           artifact_sha256, artifact_sha512, artifact_bytes, media_type,
           source_revision, ci_run_url, previous_sha256, mismatch
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.repoId ?? null,
          input.receiptId,
          input.channel,
          input.coordinate,
          input.artifactSha256,
          input.artifactSha512 ?? null,
          input.artifactBytes ?? null,
          input.mediaType ?? null,
          input.sourceRevision ?? null,
          input.ciRunUrl ?? null,
          input.previousSha256 ?? null,
          input.mismatch,
        ],
      );
      if (!rows[0]) throw new Error("release revision insert returned no row");
      const { rows: statusRows } = await sql.query<{ status: string }>(
        `SELECT status FROM scan_receipts WHERE id = $1`,
        [rows[0].receipt_id],
      );
      return releaseRevisionRow({
        ...rows[0],
        receipt_status: statusRows[0]?.status ?? null,
      });
    },

    async listReleaseRevisionsForUser(
      userId: string,
      opts: { limit?: number; installationId?: number | null } = {},
    ): Promise<ReleaseRevisionRow[]> {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const scoped = optionalInstallId(opts.installationId);
      const { rows } = await sql.query<ReleaseRevisionSqlRow>(
        `SELECT rr.*, sr.status AS receipt_status
         FROM release_revisions rr
         JOIN installation_users iu ON iu.installation_id = rr.installation_id
         LEFT JOIN scan_receipts sr ON sr.id = rr.receipt_id
         WHERE iu.user_id = $1
           AND ($3::bigint IS NULL OR rr.installation_id = $3)
           AND (
             row_within_retention(rr.installation_id, rr.created_at)
             OR EXISTS (
               SELECT 1 FROM release_legal_holds h
               WHERE h.revision_id = rr.id
                 AND NOT EXISTS (
                   SELECT 1 FROM release_legal_holds later
                   WHERE later.revision_id = h.revision_id AND later.id > h.id
                 )
                 AND h.action = 'place'
             )
           )
         ORDER BY rr.created_at DESC, rr.id DESC
         LIMIT $2`,
        [userId, limit, scoped],
      );
      return rows.map(releaseRevisionRow);
    },

    async getReleaseRevisionForUser(
      id: number,
      userId: string,
    ): Promise<ReleaseRevisionRow | null> {
      const { rows } = await sql.query<ReleaseRevisionSqlRow>(
        `SELECT rr.*, sr.status AS receipt_status
         FROM release_revisions rr
         JOIN installation_users iu ON iu.installation_id = rr.installation_id
         LEFT JOIN scan_receipts sr ON sr.id = rr.receipt_id
         WHERE rr.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      return rows[0] ? releaseRevisionRow(rows[0]) : null;
    },

    async getReleaseRevision(id: number): Promise<ReleaseRevisionRow | null> {
      const { rows } = await sql.query<ReleaseRevisionSqlRow>(
        `SELECT rr.*, sr.status AS receipt_status
         FROM release_revisions rr
         LEFT JOIN scan_receipts sr ON sr.id = rr.receipt_id
         WHERE rr.id = $1`,
        [id],
      );
      return rows[0] ? releaseRevisionRow(rows[0]) : null;
    },

    async listDeliveryAttacherLogins(revisionId: number): Promise<string[]> {
      const { rows } = await sql.query<{ created_by_login: string }>(
        `SELECT DISTINCT created_by_login
         FROM release_delivery_locations
         WHERE revision_id = $1`,
        [revisionId],
      );
      return rows.map((row) => row.created_by_login);
    },

    async insertReleaseApproval(input: {
      installationId: number;
      revisionId: number;
      decision: "approved" | "rejected";
      reason: string;
      actorLogin: string;
    }): Promise<ReleaseApprovalRow> {
      const { rows } = await sql.query<ReleaseApprovalSqlRow>(
        `INSERT INTO release_approvals (
           installation_id, revision_id, decision, reason, actor_login
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.installationId, input.revisionId, input.decision, input.reason, input.actorLogin],
      );
      if (!rows[0]) throw new Error("release approval insert returned no row");
      return releaseApprovalRow(rows[0]);
    },

    async listReleaseApprovalsForRevisions(revisionIds: number[]): Promise<ReleaseApprovalRow[]> {
      if (revisionIds.length === 0) return [];
      const placeholders = revisionIds.map((_, index) => `$${index + 1}`).join(", ");
      const { rows } = await sql.query<ReleaseApprovalSqlRow>(
        `SELECT * FROM release_approvals
         WHERE revision_id IN (${placeholders})
         ORDER BY id ASC`,
        revisionIds,
      );
      return rows.map(releaseApprovalRow);
    },

    async insertReleaseLegalHold(input: {
      installationId: number;
      revisionId: number;
      action: "place" | "release";
      reason: string;
      actorLogin: string;
    }): Promise<ReleaseLegalHoldRow> {
      const { rows } = await sql.query<ReleaseLegalHoldSqlRow>(
        `INSERT INTO release_legal_holds (
           installation_id, revision_id, action, reason, actor_login
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [input.installationId, input.revisionId, input.action, input.reason, input.actorLogin],
      );
      if (!rows[0]) throw new Error("release legal hold insert returned no row");
      return releaseLegalHoldRow(rows[0]);
    },

    async listReleaseLegalHoldsForRevisions(revisionIds: number[]): Promise<ReleaseLegalHoldRow[]> {
      if (revisionIds.length === 0) return [];
      const placeholders = revisionIds.map((_, index) => `$${index + 1}`).join(", ");
      const { rows } = await sql.query<ReleaseLegalHoldSqlRow>(
        `SELECT * FROM release_legal_holds
         WHERE revision_id IN (${placeholders})
         ORDER BY id ASC`,
        revisionIds,
      );
      return rows.map(releaseLegalHoldRow);
    },

    async countDeliveryLocations(input: {
      installationId: number;
      revisionId?: number;
    }): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        input.revisionId
          ? `SELECT count(*)::int AS n FROM release_delivery_locations
             WHERE installation_id = $1 AND revision_id = $2`
          : `SELECT count(*)::int AS n FROM release_delivery_locations
             WHERE installation_id = $1`,
        input.revisionId ? [input.installationId, input.revisionId] : [input.installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async insertDeliveryLocation(input: {
      installationId: number;
      revisionId: number;
      url: string;
      host: string;
      expectedMediaType?: string | null;
      createdByLogin: string;
    }): Promise<DeliveryLocationRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        revision_id: unknown;
        url: string;
        host: string;
        expected_media_type: string | null;
        created_by_login: string;
        created_at: string | Date;
      }>(
        `INSERT INTO release_delivery_locations (
           installation_id, revision_id, url, host, expected_media_type, created_by_login
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.installationId,
          input.revisionId,
          input.url,
          input.host,
          input.expectedMediaType ?? null,
          input.createdByLogin,
        ],
      );
      if (!rows[0]) throw new Error("delivery location insert returned no row");
      return deliveryLocationRow(rows[0]);
    },

    async insertDeliveryLocationIfAbsent(input: {
      installationId: number;
      revisionId: number;
      url: string;
      host: string;
      expectedMediaType?: string | null;
      createdByLogin: string;
    }): Promise<DeliveryLocationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        revision_id: unknown;
        url: string;
        host: string;
        expected_media_type: string | null;
        created_by_login: string;
        created_at: string | Date;
      }>(
        `INSERT INTO release_delivery_locations (
           installation_id, revision_id, url, host, expected_media_type, created_by_login
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (revision_id, url) DO NOTHING
         RETURNING *`,
        [
          input.installationId,
          input.revisionId,
          input.url,
          input.host,
          input.expectedMediaType ?? null,
          input.createdByLogin,
        ],
      );
      return rows[0] ? deliveryLocationRow(rows[0]) : null;
    },

    async getDeliveryLocation(id: number): Promise<DeliveryLocationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        revision_id: unknown;
        url: string;
        host: string;
        expected_media_type: string | null;
        created_by_login: string;
        created_at: string | Date;
      }>(`SELECT * FROM release_delivery_locations WHERE id = $1`, [id]);
      return rows[0] ? deliveryLocationRow(rows[0]) : null;
    },

    async getDeliveryLocationForUser(
      id: number,
      userId: string,
    ): Promise<DeliveryLocationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        revision_id: unknown;
        url: string;
        host: string;
        expected_media_type: string | null;
        created_by_login: string;
        created_at: string | Date;
      }>(
        `SELECT l.*
         FROM release_delivery_locations l
         JOIN installation_users iu ON iu.installation_id = l.installation_id
         WHERE l.id = $1 AND iu.user_id = $2`,
        [id, userId],
      );
      return rows[0] ? deliveryLocationRow(rows[0]) : null;
    },

    async listDeliveryLocationsForRevisions(revisionIds: number[]): Promise<DeliveryLocationRow[]> {
      if (revisionIds.length === 0) return [];
      const placeholders = revisionIds.map((_, index) => `$${index + 1}`).join(", ");
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        revision_id: unknown;
        url: string;
        host: string;
        expected_media_type: string | null;
        created_by_login: string;
        created_at: string | Date;
        last_status: string | null;
        last_sha256: string | null;
        last_media_type: string | null;
        last_redirect_hosts: string | null;
        last_cache_state: string | null;
        last_region: string | null;
        last_checked_at: string | Date | null;
      }>(
        `SELECT l.*,
                v.status AS last_status,
                v.observed_sha256 AS last_sha256,
                v.observed_media_type AS last_media_type,
                v.redirect_hosts AS last_redirect_hosts,
                v.cache_state AS last_cache_state,
                v.delivery_region AS last_region,
                v.created_at AS last_checked_at
         FROM release_delivery_locations l
         LEFT JOIN LATERAL (
           SELECT status, observed_sha256, observed_media_type, redirect_hosts,
                  cache_state, delivery_region, created_at
           FROM release_delivery_verifications
           WHERE location_id = l.id
           ORDER BY id DESC
           LIMIT 1
         ) v ON true
         WHERE l.revision_id IN (${placeholders})
         ORDER BY l.id ASC`,
        revisionIds,
      );
      return rows.map(deliveryLocationRow);
    },

    async listReleasePublicPagesForRevisions(revisionIds: number[]): Promise<ReleasePublicPageRow[]> {
      if (revisionIds.length === 0) return [];
      const placeholders = revisionIds.map((_, index) => `$${index + 1}`).join(", ");
      const { rows } = await sql.query<ReleasePublicPageSqlRow>(
        `SELECT * FROM release_public_pages WHERE revision_id IN (${placeholders})`,
        revisionIds,
      );
      return rows.map(releasePublicPageRow);
    },

    async getReleasePublicPageByToken(token: string): Promise<ReleasePublicPageRow | null> {
      const { rows } = await sql.query<ReleasePublicPageSqlRow>(
        `SELECT * FROM release_public_pages WHERE public_token = $1`,
        [token],
      );
      return rows[0] ? releasePublicPageRow(rows[0]) : null;
    },

    async getReleasePublicPageByRevision(revisionId: number): Promise<ReleasePublicPageRow | null> {
      const { rows } = await sql.query<ReleasePublicPageSqlRow>(
        `SELECT * FROM release_public_pages WHERE revision_id = $1`,
        [revisionId],
      );
      return rows[0] ? releasePublicPageRow(rows[0]) : null;
    },

    async countEnabledPublicPages(installationId: number): Promise<number> {
      const { rows } = await sql.query<{ n: unknown }>(
        `SELECT count(*)::int AS n FROM release_public_pages WHERE installation_id = $1 AND enabled = TRUE`,
        [installationId],
      );
      return num(rows[0]?.n ?? 0);
    },

    async upsertReleasePublicPage(input: {
      installationId: number;
      revisionId: number;
      publicToken: string;
      enabled: boolean;
      actorLogin: string;
    }): Promise<ReleasePublicPageRow> {
      const { rows } = await sql.query<ReleasePublicPageSqlRow>(
        `INSERT INTO release_public_pages (
           installation_id, revision_id, public_token, enabled, created_by_login, updated_by_login
         )
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (revision_id) DO UPDATE SET
           enabled = EXCLUDED.enabled,
           updated_by_login = EXCLUDED.updated_by_login,
           updated_at = now()
         RETURNING *`,
        [
          input.installationId,
          input.revisionId,
          input.publicToken,
          input.enabled,
          input.actorLogin,
        ],
      );
      if (!rows[0]) throw new Error("release public page upsert returned no row");
      return releasePublicPageRow(rows[0]);
    },

    async insertDeliveryVerification(input: {
      installationId: number;
      locationId: number;
      revisionId: number;
      status: DeliveryVerifyStatus;
      observedSha256?: string | null;
      observedSha512?: string | null;
      observedBytes?: number | null;
      observedMediaType?: string | null;
      finalHost?: string | null;
      redirectCount?: number;
      redirectHosts?: string | null;
      cacheState?: string | null;
      deliveryRegion?: string | null;
      error?: string | null;
    }): Promise<DeliveryVerificationRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        location_id: unknown;
        revision_id: unknown;
        status: string;
        observed_sha256: string | null;
        observed_sha512: string | null;
        observed_bytes: unknown;
        observed_media_type: string | null;
        final_host: string | null;
        redirect_count: unknown;
        redirect_hosts: string | null;
        cache_state: string | null;
        delivery_region: string | null;
        error: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO release_delivery_verifications (
           installation_id, location_id, revision_id, status,
           observed_sha256, observed_sha512, observed_bytes, observed_media_type,
           final_host, redirect_count, redirect_hosts, cache_state, delivery_region, error
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.installationId,
          input.locationId,
          input.revisionId,
          input.status,
          input.observedSha256 ?? null,
          input.observedSha512 ?? null,
          input.observedBytes ?? null,
          input.observedMediaType ?? null,
          input.finalHost ?? null,
          input.redirectCount ?? 0,
          input.redirectHosts ?? null,
          input.cacheState ?? null,
          input.deliveryRegion ?? null,
          input.error ?? null,
        ],
      );
      if (!rows[0]) throw new Error("delivery verification insert returned no row");
      return deliveryVerificationRow(rows[0]);
    },

    async latestDeliveryVerification(locationId: number): Promise<DeliveryVerificationRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        location_id: unknown;
        revision_id: unknown;
        status: string;
        observed_sha256: string | null;
        observed_sha512: string | null;
        observed_bytes: unknown;
        observed_media_type: string | null;
        final_host: string | null;
        redirect_count: unknown;
        error: string | null;
        created_at: string | Date;
      }>(
        `SELECT * FROM release_delivery_verifications
         WHERE location_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [locationId],
      );
      return rows[0] ? deliveryVerificationRow(rows[0]) : null;
    },

    async listActiveExceptions(
      installationId: number,
      packageId?: number | null,
    ): Promise<PolicyExceptionRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `SELECT *
         FROM policy_exceptions
         WHERE installation_id = $1
           AND revoked_at IS NULL
           AND expires_at > now()
           AND (package_id IS NULL OR ($2::bigint IS NOT NULL AND package_id = $2))
         ORDER BY id ASC`,
        [installationId, packageId ?? null],
      );
      return rows.map(policyExceptionRow);
    },

    async listExceptionsForUser(
      userId: string,
      opts: { installationId?: number; packageId?: number | null } = {},
    ): Promise<PolicyExceptionRow[]> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `SELECT pe.*
         FROM policy_exceptions pe
         JOIN installation_users iu ON iu.installation_id = pe.installation_id
         WHERE iu.user_id = $1
           AND pe.revoked_at IS NULL
           AND ($2::bigint IS NULL OR pe.installation_id = $2)
           AND (
             $3::bigint IS NULL
             OR pe.package_id IS NULL
             OR pe.package_id = $3
           )
         ORDER BY pe.created_at DESC, pe.id DESC`,
        [userId, opts.installationId ?? null, opts.packageId ?? null],
      );
      return rows.map(policyExceptionRow);
    },

    async insertPolicyException(input: {
      installationId: number;
      packageId?: number | null;
      rule: string;
      pathPattern: string | null;
      reason: string;
      actorUserId: string;
      actorLogin: string;
      expiresAt: Date | string;
    }): Promise<PolicyExceptionRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO policy_exceptions (
           installation_id, package_id, rule, path_pattern, reason,
           actor_user_id, actor_login, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          input.installationId,
          input.packageId ?? null,
          input.rule,
          input.pathPattern,
          input.reason,
          input.actorUserId,
          input.actorLogin,
          input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt,
        ],
      );
      if (!rows[0]) throw new Error("policy exception insert returned no row");
      return policyExceptionRow(rows[0]);
    },

    async revokePolicyExceptionForUser(
      id: number,
      userId: string,
      revokedBy: string,
    ): Promise<PolicyExceptionRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        rule: string;
        path_pattern: string | null;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        expires_at: string | Date;
        revoked_at: string | Date | null;
        revoked_by: string | null;
        created_at: string | Date;
      }>(
        `UPDATE policy_exceptions pe
         SET revoked_at = now(), revoked_by = $3
         FROM installation_users iu
         WHERE pe.id = $1
           AND pe.revoked_at IS NULL
           AND pe.installation_id = iu.installation_id
           AND iu.user_id = $2
         RETURNING pe.*`,
        [id, userId, revokedBy],
      );
      return rows[0] ? policyExceptionRow(rows[0]) : null;
    },

    async getActiveBaseline(
      installationId: number,
      packageId: number,
    ): Promise<ScanBaselineRow | null> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        package_id: unknown;
        repo_id: unknown;
        receipt_id: unknown;
        reason: string;
        actor_user_id: string;
        actor_login: string;
        created_at: string | Date;
        superseded_at: string | Date | null;
      }>(
        `SELECT *
         FROM scan_baselines
         WHERE installation_id = $1
           AND package_id = $2
           AND superseded_at IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [installationId, packageId],
      );
      return rows[0] ? scanBaselineRow(rows[0]) : null;
    },

    async insertScanBaseline(input: {
      installationId: number;
      packageId: number;
      repoId?: number | null;
      receiptId: number;
      reason: string;
      actorUserId: string;
      actorLogin: string;
    }): Promise<ScanBaselineRow> {
      return await sql.transaction(async (tx) => {
        await tx.query(
          `UPDATE scan_baselines
           SET superseded_at = now()
           WHERE installation_id = $1
             AND package_id = $2
             AND superseded_at IS NULL`,
          [input.installationId, input.packageId],
        );
        const { rows } = await tx.query<{
          id: unknown;
          installation_id: unknown;
          package_id: unknown;
          repo_id: unknown;
          receipt_id: unknown;
          reason: string;
          actor_user_id: string;
          actor_login: string;
          created_at: string | Date;
          superseded_at: string | Date | null;
        }>(
          `INSERT INTO scan_baselines (
             installation_id, package_id, repo_id, receipt_id, reason,
             actor_user_id, actor_login
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            input.installationId,
            input.packageId,
            input.repoId ?? null,
            input.receiptId,
            input.reason,
            input.actorUserId,
            input.actorLogin,
          ],
        );
        if (!rows[0]) throw new Error("scan baseline insert returned no row");
        return scanBaselineRow(rows[0]);
      });
    },

    async insertAuditEvent(input: {
      installationId: number;
      actorLogin: string;
      action: string;
      summary: string;
      targetKind?: string | null;
      targetId?: string | null;
    }): Promise<AuditEventRow> {
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        actor_login: string;
        action: string;
        summary: string;
        target_kind: string | null;
        target_id: string | null;
        created_at: string | Date;
      }>(
        `INSERT INTO audit_events (
           installation_id, actor_login, action, summary, target_kind, target_id
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.installationId,
          input.actorLogin,
          input.action,
          input.summary,
          input.targetKind ?? null,
          input.targetId ?? null,
        ],
      );
      if (!rows[0]) throw new Error("audit event insert returned no row");
      return auditEventRow(rows[0]);
    },

    async listAuditEventsForUser(
      userId: string,
      installationId: number,
    ): Promise<AuditEventRow[]> {
      if (!optionalInstallId(installationId)) return [];
      const { rows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        actor_login: string;
        action: string;
        summary: string;
        target_kind: string | null;
        target_id: string | null;
        created_at: string | Date;
      }>(
        `SELECT e.*
         FROM audit_events e
         JOIN installation_users iu ON iu.installation_id = e.installation_id
         WHERE iu.user_id = $1
           AND e.installation_id = $2
           AND row_within_retention(e.installation_id, e.created_at)
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT 500`,
        [userId, installationId],
      );
      return rows.map(auditEventRow);
    },

    async exportAuditLogForUser(
      userId: string,
      installationId: number,
    ): Promise<AuditExportBundle> {
      const empty: AuditExportBundle = {
        exportedAt: new Date().toISOString(),
        installationId,
        audit: [],
        notificationDeliveries: [],
        alerts: [],
        alertEvents: [],
      };
      if (!optionalInstallId(installationId)) return empty;
      if (!(await this.userOwnsInstallation(userId, installationId))) return empty;
      const audit = await this.listAuditEventsForUser(userId, installationId);
      const { rows: deliveryRows } = await sql.query<{
        id: unknown;
        installation_id: unknown;
        destination_id: unknown;
        alert_id: unknown;
        kind: string;
        status: "sent" | "failed";
        error: string | null;
        created_at: string | Date;
      }>(
        `SELECT d.id, d.installation_id, d.destination_id, d.alert_id, d.kind, d.status,
                d.error, d.created_at
         FROM notification_deliveries d
         JOIN installation_users iu ON iu.installation_id = d.installation_id
         WHERE iu.user_id = $1
           AND d.installation_id = $2
           AND row_within_retention(d.installation_id, d.created_at)
         ORDER BY d.created_at DESC, d.id DESC
         LIMIT 500`,
        [userId, installationId],
      );
      const { rows: alertRows } = await sql.query<{
        id: unknown;
        kind: string;
        title: string;
        created_at: string | Date;
      }>(
        `SELECT a.id, a.kind, a.title, a.created_at
         FROM alerts a
         JOIN installation_users iu ON iu.installation_id = a.installation_id
         WHERE iu.user_id = $1
           AND a.installation_id = $2
           AND row_within_retention(a.installation_id, a.created_at)
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 500`,
        [userId, installationId],
      );
      const { rows: eventRows } = await sql.query<{
        id: unknown;
        alert_id: unknown;
        actor_login: string;
        action: string;
        created_at: string | Date;
      }>(
        `SELECT e.id, e.alert_id, e.actor_login, e.action, e.created_at
         FROM alert_events e
         JOIN alerts a ON a.id = e.alert_id
         JOIN installation_users iu ON iu.installation_id = a.installation_id
         WHERE iu.user_id = $1
           AND a.installation_id = $2
           AND row_within_retention(e.installation_id, e.created_at)
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT 1000`,
        [userId, installationId],
      );
      return {
        exportedAt: new Date().toISOString(),
        installationId,
        audit,
        notificationDeliveries: deliveryRows.map((row) => ({
          id: num(row.id),
          installationId: num(row.installation_id),
          destinationId:
            row.destination_id === null || row.destination_id === undefined
              ? null
              : num(row.destination_id),
          alertId: row.alert_id === null || row.alert_id === undefined ? null : num(row.alert_id),
          kind: asNotificationKind(row.kind),
          status: row.status,
          inventedIncident: false as const,
          error: row.error,
          createdAt: iso(row.created_at) ?? new Date().toISOString(),
        })),
        alerts: alertRows.map((row) => ({
          id: num(row.id),
          kind: row.kind,
          title: row.title,
          createdAt: iso(row.created_at) ?? new Date().toISOString(),
        })),
        alertEvents: eventRows.map((row) => ({
          id: num(row.id),
          alertId: num(row.alert_id),
          actorLogin: row.actor_login,
          action: row.action,
          createdAt: iso(row.created_at) ?? new Date().toISOString(),
        })),
      };
    },
  };
}

function auditEventRow(row: {
  id: unknown;
  installation_id: unknown;
  actor_login: string;
  action: string;
  summary: string;
  target_kind: string | null;
  target_id: string | null;
  created_at: string | Date;
}): AuditEventRow {
  return {
    id: num(row.id),
    installationId: num(row.installation_id),
    actorLogin: row.actor_login,
    action: row.action,
    summary: row.summary,
    targetKind: row.target_kind,
    targetId: row.target_id,
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
  };
}

export type Store = ReturnType<typeof createStore>;

export function signSession(secret: string, sessionId: string): string {
  const mac = createHmac("sha256", secret).update(sessionId).digest("hex");
  return `${sessionId}.${mac}`;
}

export function readSignedSession(secret: string, cookie: string | undefined): string | null {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookie.slice(0, dot);
  const mac = cookie.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return id;
}
