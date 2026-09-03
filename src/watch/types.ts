import type { Finding } from "@/report-types";
import type { Coverage } from "@/coverage";

export type PermissionTest = {
  ok: boolean;
  inventedIncident: false;
  accountLogin: string;
  suspended: boolean;
  missingReads: string[];
  optionalReads: { name: string; granted: boolean }[];
  optionalWrites: { name: string; granted: boolean }[];
  administrationGranted: boolean;
  pendingAccepts?: string[];
  installUrl?: string | null;
  repoProbe: { fullName: string; ok: boolean } | null;
  lastDelivery: { kind: string; status: string; at: string } | null;
  testedAt: string;
  detail: string;
};

export type Me = {
  user: { id: string; login: string; avatarUrl: string | null } | null;
  coverage?: Coverage;
  installations: {
    id: number;
    account_login: string;
    account_type: string;
    suspended?: boolean;
    trialEndsAt?: string | null;
    plan?: string | null;
    role?: "admin" | "member";
    lastPermissionTestAt?: string | null;
    lastPermissionTest?: PermissionTest | null;
  }[];
  githubApp: boolean;
  stripe?: boolean;
  resend?: boolean;
  installUrl?: string;
  hostedOrigin?: string;
  githubRunnersReachable?: boolean;
};

export type Repo = {
  id: number;
  installation_id?: number;
  full_name: string;
  private: boolean;
  html_url: string;
  last_checked_at: string | null;
};

export type Alert = {
  id: number;
  kind: string;
  title: string;
  body: string;
  findings: Finding[] | null;
  created_at: string;
  full_name?: string | null;
  acknowledged_at?: string | null;
  acknowledged_by_login?: string | null;
  assigned_to_login?: string | null;
  resolved_at?: string | null;
  resolved_by_login?: string | null;
  resolution_note?: string | null;
  exposure_ms?: number;
  rotation_checklist?: string[];
};

export type AlertEvent = {
  id: number;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export type WatchedPackage = {
  id: number;
  installation_id: number;
  package_name: string;
  registry_origin?: string;
  last_version: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
};

export type WatchedOrigin = {
  id: number;
  installation_id: number;
  origin_url: string;
  host: string;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
  last_debug_ids?: string[];
  last_release?: string | null;
  last_public_map?: boolean;
  verification?: {
    token: string;
    dnsName: string;
    dnsValue: string;
    httpUrl: string;
    httpBody: string;
    method: "dns" | "http" | null;
    verifiedAt: string | null;
  } | null;
  deployTokenPrefix?: string | null;
};

export type MapCustodyDestination = {
  id: number;
  installationId: number;
  kind: "sentry" | "bugsnag";
  host: string;
  orgSlug: string | null;
  projectSlug: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NpmRegistry = {
  id: number;
  installation_id: number;
  origin: string;
  host: string;
  updated_at: string;
};

export type NotificationDestination = {
  id: number;
  installationId: number;
  kind: "slack" | "siem" | "jira" | "pagerduty" | "email";
  host: string;
  projectKey?: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryError: string | null;
  updatedAt: string;
};

export type NotificationDelivery = {
  id: number;
  kind: "slack" | "siem" | "jira" | "pagerduty" | "email";
  status: "sent" | "failed";
  inventedIncident: false;
  error: string | null;
  createdAt: string;
};

export type NotificationRoute = {
  id: number;
  installationId: number;
  destinationId: number;
  minSeverity: "all" | "warn" | "critical";
  repoFullName: string | null;
  packageName: string | null;
  teamLogin: string | null;
  createdAt: string;
};

export type TeamMember = {
  userId: string;
  login: string;
  avatarUrl: string | null;
  role: "admin" | "member";
};

export type TeamInvite = {
  id: number;
  githubLogin: string;
  role: "admin" | "member";
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

export type TimelineView =
  | { status: "loading" }
  | { status: "ready"; entries: TimelineEntry[]; days: number }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

export type AuditRow = {
  id: number;
  at: string;
  actorLogin: string;
  action: string;
  summary: string;
  targetKind: string | null;
  targetId: string | null;
};

export type AuditView =
  | { status: "loading" }
  | { status: "ready"; rows: AuditRow[] }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

export type RetentionDays = 0 | 90 | 180 | 365;

export type RetentionView =
  | { status: "loading" }
  | { status: "ready"; days: RetentionDays }
  | { status: "error"; message: string };

export type SigningPolicyDraft = {
  requireGithub: boolean;
  requireNpm: boolean;
  builderPrefix: string;
  expiresAt: string;
};

export type SigningPolicyView =
  | { status: "loading" }
  | { status: "ready"; policy: SigningPolicyDraft | null }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

export type IdentityCandidateView = {
  id: number;
  candidateName: string;
  transformation: string;
  firstSeenAt: string;
  lastCheckedAt: string | null;
  registeredAt: string | null;
  lastVersion: string | null;
  lastPublishedAt: string | null;
  allowlisted: boolean;
  allowlistReason: string | null;
  allowlistedByLogin: string | null;
};

export type IdentitySignalsView =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

export type IdentityEvidenceView = {
  packageName: string;
  assembledAt: string;
  advisory: { enabled: boolean; path: string | null };
  sent: false;
  malwareVerdict: false;
  takedown: Record<string, unknown>;
};

export type IdentityRiskView = {
  total: number;
  max: number;
  malwareVerdict: false;
  note: string;
  signals: Array<{ kind: string; count: number; points: number; title: string }>;
};

export type ProtectedNamespace = {
  id: number;
  installationId: number;
  scope: string;
  names: string[];
  createdByLogin: string;
  lastCheckedAt: string | null;
  createdAt: string;
};

export type Confirming =
  | { kind: "destination"; id: number; expected: string }
  | { kind: "route"; id: number; expected: string }
  | { kind: "registry"; id: number; expected: string }
  | { kind: "package"; id: number; expected: string }
  | { kind: "origin"; id: number; expected: string }
  | { kind: "map-destination"; id: number; expected: string }
  | { kind: "token"; id: number; expected: string }
  | { kind: "exception"; id: number; expected: string }
  | { kind: "identity-allowlist"; packageId: number; id: number; expected: string; reason: string }
  | { kind: "identity-revoke"; packageId: number; id: number; expected: string }
  | { kind: "member"; userId: string; expected: string }
  | { kind: "role"; userId: string; expected: string; role: "admin" | "member" }
  | { kind: "invite"; login: string; expected: string; role: "admin" | "member" }
  | { kind: "invite-revoke"; id: number; expected: string }
  | { kind: "retention"; days: RetentionDays; expected: string }
  | { kind: "signing-policy-save"; expected: string }
  | { kind: "signing-policy-clear"; expected: string }
  | { kind: "make-private"; id: number; expected: string }
  | { kind: "delete-pack-assets"; id: number; expected: string }
  | { kind: "disable-workflow"; id: number; expected: string; workflow: string }
  | { kind: "release-approve"; id: number; expected: string; reason: string }
  | { kind: "release-reject"; id: number; expected: string; reason: string }
  | { kind: "release-hold"; id: number; expected: string; reason: string }
  | { kind: "release-hold-release"; id: number; expected: string; reason: string }
  | { kind: "release-publish"; id: number; expected: string }
  | { kind: "release-unpublish"; id: number; expected: string }
  | { kind: "release-attest"; id: number; expected: string }
  | { kind: "identity-evidence"; id: number; expected: string }
  | { kind: "identity-publish-advisory"; id: number; expected: string }
  | { kind: "identity-unpublish-advisory"; id: number; expected: string }
  | { kind: "namespace-unprotect"; id: number; expected: string };

export type ScanApiToken = {
  id: number;
  installation_id: number;
  name: string;
  token_prefix: string;
  created_by_login: string;
  last_used_at: string | null;
  created_at: string;
};

export type ReceiptScanStatus = "passed" | "failed-policy" | "inconclusive";

export type DeliveryLocation = {
  id: number;
  revisionId: number;
  url: string;
  host: string;
  expectedMediaType: string | null;
  lastStatus: "matched" | "mismatch" | "missing" | "redirect" | "content_type" | "blocked" | "error" | null;
  lastSha256: string | null;
  lastMediaType: string | null;
  lastRedirectHosts: string | null;
  lastCacheState: string | null;
  lastRegion: string | null;
  lastCheckedAt: string | null;
};

export type ReleaseRevision = {
  id: number;
  receiptId: number;
  channel: "stable" | "beta" | "canary";
  coordinate: string;
  artifactSha256: string;
  artifactBytes: number | null;
  mediaType: string | null;
  sourceRevision: string | null;
  ciRunUrl: string | null;
  mismatch: boolean;
  receiptStatus: ReceiptScanStatus | null;
  createdAt: string;
  locations?: DeliveryLocation[];
  approval?: {
    decision: "approved" | "rejected";
    actorLogin: string;
    reason: string;
    createdAt: string;
  } | null;
  legalHold?: {
    active: true;
    actorLogin: string;
    reason: string;
    createdAt: string;
  } | null;
  publicPage?: { enabled: boolean; path: string } | null;
  attestations?: {
    source: "github" | "npm";
    status: "missing" | "present" | "subject_mismatch" | "unreadable";
    predicateType: string | null;
    subjectDigest: string | null;
    builderId: string | null;
    issuer: string | null;
    createdAt: string;
  }[];
};

export type PackageProtection = {
  id: number;
  packageId: number;
  verifiedVia: "scope_match" | "github_repository";
  githubRepo: string | null;
  createdAt: string;
};

export type ProtectionImportResult = {
  name: string;
  status: "protected" | "already_protected" | "not_owned" | "not_found" | "invalid" | "watch_cap";
  packageId: number | null;
  verifiedVia: "scope_match" | "github_repository" | null;
  githubRepo: string | null;
  watched: boolean;
};

export type TenantJob = {
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

export type FairUseStatus = {
  warning: boolean;
  exhausted: boolean;
  resetsAt: string;
} | null

export type ReleaseDiffView = {
  versus?: "baseline" | "previous" | null;
  baseline?: {
    id: number;
    receiptId: number;
    reason: string;
    actorLogin: string;
    createdAt: string;
  } | null;
  current: { id: number; coordinate: string; status: string; artifactSha256: string } | null;
  previous: { id: number; coordinate: string; status: string; artifactSha256: string } | null;
  diff: {
    added: { path: string }[];
    removed: { path: string }[];
    changed: { path: string }[];
    previousBytes: number;
    nextBytes: number;
    sizeDelta: number;
    unexpectedSizeJump: boolean;
    newFindings: string[];
    resolvedFindings: string[];
  } | null;
};

export type PolicyExceptionView = {
  id: number;
  installationId: number;
  packageId: number | null;
  rule: string;
  pathPattern: string | null;
  reason: string;
  actorLogin: string;
  expiresAt: string;
  createdAt: string;
  active: boolean;
};

export type BaselineView = {
  id: number;
  receiptId: number;
  reason: string;
  actorLogin: string;
  createdAt: string;
};

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export type DeskDataset = "maps" | "releases" | "jobs" | "notifications";

export type RemediationFileView = { path: string; content: string };

export type SetupPrView =
  | { status: "opened"; htmlUrl: string; number: number; existing: boolean }
  | {
      status: "copy";
      reason: string;
      files: RemediationFileView[];
      written?: string[];
      branch?: string;
      compareUrl?: string | null;
    }
  | { status: "error"; message: string };

export type RemediationPrView =
  | { status: "opened"; htmlUrl: string; number: number; existing: boolean }
  | {
      status: "copy";
      reason: string;
      files: RemediationFileView[];
      written?: string[];
      branch?: string;
      compareUrl?: string | null;
    }
  | { status: "error"; message: string };

export type GithubResponseView =
  | { status: "ok"; detail: string }
  | { status: "copy"; reason: string }
  | { status: "error"; message: string };

export type SetupStatusFacts = {
  inventedIncident: false;
  defaultBranch: string;
  setupBranch: string;
  actionOnDefault: boolean;
  actionOnSetup: boolean;
  workflowOnDefault: boolean;
  workflowOnSetup: boolean;
  check: {
    name: string;
    conclusion: string | null;
    htmlUrl: string | null;
    ref: string;
  } | null;
  requiredCheck: "unknown";
  detail: string;
};

export type SetupStatusView =
  | { status: "ready"; facts: SetupStatusFacts }
  | { status: "error"; message: string };
