import { CoverageLock } from "@/components/CoverageLock.tsx";
import { FAIR_USE_EXHAUSTED, FAIR_USE_WARNING } from "@/fair-use-copy.ts";
import {
  ADMINISTRATION_DENIED,
  DELETE_PACK_ASSETS_COPY,
  DISABLE_WORKFLOW_COPY,
  MAKE_PRIVATE_COPY,
  deletePackAssetsConfirm,
  makePrivateConfirm,
  parseWorkflowPath,
  workflowIsNoSpoilersScan,
} from "@/github-response-copy.ts";
import { LoggedInLook } from "@/components/LoggedInLook.tsx";
import { Button } from "@/components/ui/button";
import { coverageFrom, coverageFromQuery, type Coverage } from "@/coverage.ts";
import { navigate } from "@/nav.ts";
import { PREVIEW_INSTALLATIONS, PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts";
import type { Finding } from "@/report-types";
import { useCallback, useEffect, useState } from "react";

type PermissionTest = {
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

type Me = {
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
  installUrl?: string;
  hostedOrigin?: string;
  githubRunnersReachable?: boolean;
};

type Repo = {
  id: number;
  installation_id?: number;
  full_name: string;
  private: boolean;
  html_url: string;
  last_checked_at: string | null;
};

type Alert = {
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

type AlertEvent = {
  id: number;
  actor_login: string;
  action: string;
  detail: string | null;
  created_at: string;
};

type WatchedPackage = {
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

type WatchedOrigin = {
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
};

type MapCustodyDestination = {
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

type NpmRegistry = {
  id: number;
  installation_id: number;
  origin: string;
  host: string;
  updated_at: string;
};

type NotificationDestination = {
  id: number;
  installationId: number;
  kind: "slack" | "siem" | "jira" | "pagerduty";
  host: string;
  projectKey?: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryError: string | null;
  updatedAt: string;
};

type NotificationDelivery = {
  id: number;
  kind: "slack" | "siem" | "jira" | "pagerduty";
  status: "sent" | "failed";
  inventedIncident: false;
  error: string | null;
  createdAt: string;
};

type NotificationRoute = {
  id: number;
  installationId: number;
  destinationId: number;
  minSeverity: "all" | "warn" | "critical";
  repoFullName: string | null;
  packageName: string | null;
  teamLogin: string | null;
  createdAt: string;
};

function destinationKindLabel(kind: string): string {
  if (kind === "jira") return "Jira";
  if (kind === "siem") return "SIEM";
  if (kind === "pagerduty") return "PagerDuty";
  return "Slack";
}

function routeMinSeverityLabel(value: string): string {
  if (value === "critical") return "critical only";
  if (value === "warn") return "warn and critical";
  return "all severities";
}

type TeamMember = {
  userId: string;
  login: string;
  avatarUrl: string | null;
  role: "admin" | "member";
};

type TeamInvite = {
  id: number;
  githubLogin: string;
  role: "admin" | "member";
  createdAt: string;
};

type TimelineEntry = {
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

type TimelineView =
  | { status: "loading" }
  | { status: "ready"; entries: TimelineEntry[]; days: number }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

type AuditRow = {
  id: number;
  at: string;
  actorLogin: string;
  action: string;
  summary: string;
  targetKind: string | null;
  targetId: string | null;
};

type AuditView =
  | { status: "loading" }
  | { status: "ready"; rows: AuditRow[] }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

type RetentionDays = 0 | 90 | 180 | 365;

type RetentionView =
  | { status: "loading" }
  | { status: "ready"; days: RetentionDays }
  | { status: "error"; message: string };

function parseRetentionDays(raw: unknown): RetentionDays | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (value === 0 || value === 90 || value === 180 || value === 365) return value;
  return null;
}

function retentionConfirmToken(days: RetentionDays): string {
  return days === 0 ? "keep" : String(days);
}

function retentionWindowLabel(days: number): string {
  if (days === 0) return "while this install exists";
  return `the last ${days} days`;
}

function timelineHeading(days: number): string {
  if (days === 0) return "Install timeline";
  return `${days}-day timeline`;
}

type IdentityCandidateView = {
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

type IdentitySignalsView =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "solo" }
  | { status: "ended" }
  | { status: "error"; message: string };

type Confirming =
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
  | { kind: "make-private"; id: number; expected: string }
  | { kind: "delete-pack-assets"; id: number; expected: string }
  | { kind: "disable-workflow"; id: number; expected: string; workflow: string }
  | { kind: "release-approve"; id: number; expected: string; reason: string }
  | { kind: "release-reject"; id: number; expected: string; reason: string }
  | { kind: "release-hold"; id: number; expected: string; reason: string }
  | { kind: "release-hold-release"; id: number; expected: string; reason: string }
  | { kind: "release-publish"; id: number; expected: string }
  | { kind: "release-unpublish"; id: number; expected: string };

function confirmActionLabel(row: Confirming): string {
  switch (row.kind) {
    case "destination":
      return "remove this destination";
    case "route":
      return "remove this route";
    case "registry":
      return "remove this registry";
    case "package":
      return "stop watching this package";
    case "origin":
      return "stop watching this website";
    case "map-destination":
      return "remove this map destination";
    case "token":
      return "revoke this scan token";
    case "exception":
      return "revoke this allowlist entry";
    case "identity-allowlist":
      return "allowlist this lookalike";
    case "identity-revoke":
      return "revoke this lookalike allowlist";
    case "member":
      return "remove this member";
    case "role":
      return row.role === "admin" ? "make this person an admin" : "make this person a member";
    case "invite":
      return "invite this GitHub login";
    case "invite-revoke":
      return "revoke this invite";
    case "retention":
      return "set this retention window";
    case "make-private":
      return "make this repository private";
    case "delete-pack-assets":
      return "delete packed Release assets";
    case "disable-workflow":
      return "disable this workflow";
    case "release-approve":
      return "approve this release to ship";
    case "release-reject":
      return "reject this release";
    case "release-hold":
      return "place a legal hold on this release";
    case "release-hold-release":
      return "release this legal hold";
    case "release-publish":
      return "publish a verification page for this release";
    case "release-unpublish":
      return "unpublish this verification page";
  }
}

type ScanApiToken = {
  id: number;
  installation_id: number;
  name: string;
  token_prefix: string;
  created_by_login: string;
  last_used_at: string | null;
  created_at: string;
};

type ReceiptScanStatus = "passed" | "failed-policy" | "inconclusive";

type DeliveryLocation = {
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

type ReleaseRevision = {
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
};

function formatSealedBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function receiptStatusMark(status: ReceiptScanStatus | null) {
  if (status === "failed-policy") {
    return (
      <span className="text-[11px] uppercase tracking-[0.16em] text-danger">failed policy</span>
    );
  }
  if (status === "inconclusive") {
    return (
      <span className="text-[11px] uppercase tracking-[0.16em] text-danger">inconclusive</span>
    );
  }
  if (status === "passed") {
    return <span className="text-[11px] uppercase tracking-[0.16em] text-dim">passed</span>;
  }
  return null;
}

type PackageProtection = {
  id: number;
  packageId: number;
  verifiedVia: "scope_match" | "github_repository";
  githubRepo: string | null;
  createdAt: string;
};

type ProtectionImportResult = {
  name: string;
  status: "protected" | "already_protected" | "not_owned" | "not_found" | "invalid" | "watch_cap";
  packageId: number | null;
  verifiedVia: "scope_match" | "github_repository" | null;
  githubRepo: string | null;
  watched: boolean;
};

function protectionImportStatusLabel(status: ProtectionImportResult["status"]): string {
  if (status === "already_protected") return "already protected";
  if (status === "not_owned") return "not owned";
  if (status === "not_found") return "not on the registry";
  if (status === "invalid") return "invalid name";
  if (status === "watch_cap") return "watch cap";
  return "protected";
}

type TenantJob = {
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

type JobSummary = {
  queued: number;
  running: number;
  done: number;
  failed: number;
};

type FairUseStatus = {
  warning: boolean;
  exhausted: boolean;
  resetsAt: string;
} | null

type ReleaseDiffView = {
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

type PolicyExceptionView = {
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

type BaselineView = {
  id: number;
  receiptId: number;
  reason: string;
  actorLogin: string;
  createdAt: string;
};

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

function scopedApi(path: string, installationId: number | null): string {
  if (!installationId) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}installationId=${installationId}`;
}

function TypeToConfirm(props: {
  expected: string;
  action: string;
  busy: boolean;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-3 w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <p className="text-xs leading-relaxed text-mute">
        Type <span className="font-mono text-snow">{props.expected}</span> to {props.action}.
      </p>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
      />
      {props.error ? <p className="mt-2 text-sm text-danger">{props.error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={props.busy || !props.value.trim()}>
          {props.busy ? "Working…" : "Confirm"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={props.busy} onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function installIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("install");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function formatExposure(ms: number | undefined, createdAt: string, resolvedAt: string | null | undefined): string {
  const start = Date.parse(createdAt);
  const value =
    typeof ms === "number" && Number.isFinite(ms)
      ? ms
      : Number.isFinite(start)
        ? Math.max(0, (resolvedAt ? Date.parse(resolvedAt) : Date.now()) - start)
        : 0;
  if (value < 60_000) return "under a minute";
  const minutes = Math.floor(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "repo_publicized":
      return "Went public";
    case "repo_created_public":
      return "Created public";
    case "repo_transferred":
      return "Transferred";
    case "member_added":
      return "Collaborator";
    case "fork":
      return "Fork";
    case "release_scan":
    case "scan_latest_release":
      return "Release pack";
    case "release_unpublished":
      return "Release unpublished";
    case "release_deleted":
      return "Release deleted";
    case "push_sensitive_path":
      return "Path watch";
    case "npm_scan":
      return "npm pack";
    case "npm_dist_tag":
      return "npm dist-tag";
    case "web_origin_scan":
      return "Website";
    case "app_suspended":
      return "App suspended";
    case "app_unsuspended":
      return "App unsuspended";
    case "app_permissions_updated":
      return "App permissions";
    case "repos_added":
      return "Repos added";
    case "repos_removed":
      return "Repos removed";
    case "fair_use_budget":
      return "Fair use";
    case "repo_made_private":
      return "Made private";
    case "release_assets_removed":
      return "Pack assets removed";
    case "workflow_disabled":
      return "Workflow disabled";
    default:
      return kind;
  }
}

function defaultExpiryDate(): string {
  const when = new Date();
  when.setUTCDate(when.getUTCDate() + 90);
  return when.toISOString().slice(0, 10);
}

type RemediationFileView = { path: string; content: string };

type SetupPrView =
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

type RemediationPrView =
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

type GithubResponseView =
  | { status: "ok"; detail: string }
  | { status: "copy"; reason: string }
  | { status: "error"; message: string };

type SetupStatusFacts = {
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

type SetupStatusView =
  | { status: "ready"; facts: SetupStatusFacts }
  | { status: "error"; message: string };

function SetupStatusResult({ view }: { view: SetupStatusView }) {
  if (view.status === "error") {
    return <p className="mt-3 text-sm text-danger">{view.message}</p>;
  }
  const facts = view.facts;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm leading-relaxed text-mute">{facts.detail}</p>
      <p className="font-mono text-[11px] leading-relaxed text-dim">
        Action {facts.actionOnDefault ? "on default" : facts.actionOnSetup ? `on ${facts.setupBranch}` : "missing"}
        {" · "}
        workflow{" "}
        {facts.workflowOnDefault
          ? "on default"
          : facts.workflowOnSetup
            ? `on ${facts.setupBranch}`
            : "missing"}
        {" · "}
        check {facts.check ? facts.check.conclusion ?? "queued" : "none"}
        {" · "}
        required unknown
      </p>
    </div>
  );
}

function SetupPrResult({ view }: { view: SetupPrView }) {
  if (view.status === "opened") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {view.existing ? "Existing setup PR: " : "Opened setup PR: "}
        <a
          href={view.htmlUrl}
          className="text-snow underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          #{view.number}
        </a>
        . Review it; NoSpoilers does not merge.
      </p>
    );
  }
  if (view.status === "copy") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-sm leading-relaxed text-mute">{view.reason}</p>
        {view.written && view.written.length > 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            Committed on{" "}
            {view.compareUrl ? (
              <a
                href={view.compareUrl}
                className="text-snow underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {view.branch ?? "the setup branch"}
              </a>
            ) : (
              (view.branch ?? "the setup branch")
            )}
            : {view.written.join(", ")}. Paste the workflow YAML. Grant Pull requests write to open
            the PR. NoSpoilers does not merge.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-dim">
            Paste these files yourself. They scan packed artifacts only, POST bytes to hosted scan,
            and are never merged automatically.
          </p>
        )}
        {view.files.map((file) => (
          <div key={file.path}>
            <p className="font-mono text-[11px] text-snow">{file.path}</p>
            <pre className="mt-2 max-h-48 overflow-auto border border-white/10 bg-inset p-4 font-mono text-[11px] leading-relaxed text-mute">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

function RemediationPrResult({ view }: { view: RemediationPrView }) {
  if (view.status === "opened") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {view.existing ? "Existing remediation PR: " : "Opened remediation PR: "}
        <a
          href={view.htmlUrl}
          className="text-snow underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          #{view.number}
        </a>
        . Review it; NoSpoilers does not merge.
      </p>
    );
  }
  if (view.status === "copy") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-sm leading-relaxed text-mute">{view.reason}</p>
        {view.written && view.written.length > 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            Committed on{" "}
            {view.compareUrl ? (
              <a
                href={view.compareUrl}
                className="text-snow underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {view.branch ?? "the remediation branch"}
              </a>
            ) : (
              (view.branch ?? "the remediation branch")
            )}
            : {view.written.join(", ")}. Paste any missing workflow YAML. Grant Pull requests write
            to open the PR. NoSpoilers does not merge.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-dim">
            Paste these files yourself. They are additive, reviewable, and never merged automatically.
          </p>
        )}
        {view.files.map((file) => (
          <div key={file.path}>
            <p className="font-mono text-[11px] text-snow">{file.path}</p>
            <pre className="mt-2 max-h-48 overflow-auto border border-white/10 bg-inset p-4 font-mono text-[11px] leading-relaxed text-mute">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

function GithubResponseResult({ view }: { view: GithubResponseView }) {
  if (view.status === "ok") {
    return <p className="mt-3 text-sm leading-relaxed text-mute">{view.detail}</p>;
  }
  if (view.status === "copy") {
    return <p className="mt-3 text-sm leading-relaxed text-mute">{view.reason}</p>;
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

function AlertDeskItem({
  alert,
  previewing,
  events,
  busy,
  note,
  assignee,
  error,
  onNote,
  onAssignee,
  onAction,
}: {
  alert: Alert;
  previewing: boolean;
  events: AlertEvent[];
  busy: boolean;
  note: string;
  assignee: string;
  error: string | null;
  onNote: (value: string) => void;
  onAssignee: (value: string) => void;
  onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void;
}) {
  const resolved = Boolean(alert.resolved_at);
  const checklist = alert.rotation_checklist ?? [];
  return (
    <li className="py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
        {kindLabel(alert.kind)} · {new Date(alert.created_at).toLocaleString()}
        {resolved ? " · resolved" : alert.acknowledged_at ? " · acknowledged" : " · open"}
      </p>
      <p className="mt-2 text-sm text-snow">{alert.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-dim">{alert.body}</p>
      <p className="mt-2 text-xs text-mute">
        Exposed {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
        {alert.assigned_to_login ? ` · assigned to ${alert.assigned_to_login}` : ""}
        {alert.acknowledged_by_login ? ` · ack ${alert.acknowledged_by_login}` : ""}
      </p>
      {Array.isArray(alert.findings) && alert.findings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {alert.findings.map((finding) => (
            <li
              key={`${alert.id}-${finding.rule}-${finding.path}`}
              className="font-mono text-[11px] text-mute"
            >
              {finding.rule} · {finding.path}
            </li>
          ))}
        </ul>
      )}
      {checklist.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Rotation checklist</p>
          <ul className="mt-2 flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item} className="text-xs leading-relaxed text-mute">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {alert.resolution_note ? (
        <p className="mt-3 text-xs leading-relaxed text-mute">Note: {alert.resolution_note}</p>
      ) : null}
      {events.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.id} className="text-[11px] text-dim">
              {event.action} · {event.actor_login}
              {event.detail ? ` · ${event.detail}` : ""} · {new Date(event.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {!alert.acknowledged_at && !resolved && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy}
              onClick={() => onAction("acknowledge")}
            >
              Acknowledge
            </Button>
          )}
          {resolved ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy}
              onClick={() => onAction("reopen")}
            >
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy || note.trim().length < 8}
              onClick={() => onAction("resolve")}
            >
              Resolve
            </Button>
          )}
        </div>
        {!resolved && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Assign GitHub login</span>
              <input
                value={assignee}
                onChange={(event) => onAssignee(event.target.value)}
                placeholder="install member login"
                autoComplete="off"
                spellCheck={false}
                disabled={previewing || busy}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy || !assignee.trim()}
              onClick={() => onAction("assign")}
            >
              Assign
            </Button>
          </div>
        )}
        {!resolved && (
          <label>
            <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Resolution note</span>
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              placeholder="What changed. Do not paste secret values."
              disabled={previewing || busy}
              rows={3}
              className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
            ></textarea>
          </label>
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {previewing ? (
          <p className="text-xs text-dim">Preview does not save acknowledgements.</p>
        ) : null}
      </div>
    </li>
  );
}

export function WatchPage({ search }: { search: string }) {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" });
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" });
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" });
  const [packages, setPackages] = useState<LoadState<{ packages: WatchedPackage[] }>>({
    status: "loading",
  });
  const [origins, setOrigins] = useState<LoadState<{ origins: WatchedOrigin[] }>>({
    status: "loading",
  });
  const [registries, setRegistries] = useState<NpmRegistry[]>([]);
  const [destinations, setDestinations] = useState<NotificationDestination[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [routes, setRoutes] = useState<NotificationRoute[]>([]);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [siemWebhook, setSiemWebhook] = useState("");
  const [jiraSite, setJiraSite] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [pagerDutyKey, setPagerDutyKey] = useState("");
  const [savingSlack, setSavingSlack] = useState(false);
  const [savingSiem, setSavingSiem] = useState(false);
  const [savingJira, setSavingJira] = useState(false);
  const [savingPagerDuty, setSavingPagerDuty] = useState(false);
  const [routeDestinationId, setRouteDestinationId] = useState("");
  const [routeMinSeverity, setRouteMinSeverity] = useState<"all" | "warn" | "critical">("all");
  const [routeRepo, setRouteRepo] = useState("");
  const [routePackage, setRoutePackage] = useState("");
  const [routeTeam, setRouteTeam] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeTestSeverity, setRouteTestSeverity] = useState<"info" | "warn" | "critical">("critical");
  const [routeTestRepo, setRouteTestRepo] = useState("");
  const [routeTestPackage, setRouteTestPackage] = useState("");
  const [testingRoute, setTestingRoute] = useState(false);
  const [testingSlackId, setTestingSlackId] = useState<number | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [scanTokens, setScanTokens] = useState<ScanApiToken[]>([]);
  const [releases, setReleases] = useState<ReleaseRevision[]>([]);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [deliveryUrlByRelease, setDeliveryUrlByRelease] = useState<Record<number, string>>({});
  const [attachingReleaseId, setAttachingReleaseId] = useState<number | null>(null);
  const [verifyingLocationId, setVerifyingLocationId] = useState<number | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [governanceReasonByRelease, setGovernanceReasonByRelease] = useState<Record<number, string>>(
    {},
  );
  const [ledgerExportError, setLedgerExportError] = useState<string | null>(null);
  const [protections, setProtections] = useState<PackageProtection[]>([]);
  const [jobs, setJobs] = useState<TenantJob[]>([]);
  const [jobSummary, setJobSummary] = useState<JobSummary>({
    queued: 0,
    running: 0,
    done: 0,
    failed: 0,
  });
  const [fairUse, setFairUse] = useState<FairUseStatus>(null);
  const [protectingId, setProtectingId] = useState<number | null>(null);
  const [scanTokenName, setScanTokenName] = useState("CI");
  const [revealedScanToken, setRevealedScanToken] = useState<string | null>(null);
  const [mintingScanToken, setMintingScanToken] = useState(false);
  const [scanTokenError, setScanTokenError] = useState<string | null>(null);
  const [registryOriginInput, setRegistryOriginInput] = useState("");
  const [registryToken, setRegistryToken] = useState("");
  const [savingRegistry, setSavingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [watchRegistryOrigin, setWatchRegistryOrigin] = useState("https://registry.npmjs.org");
  const [scanError, setScanError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [setuppingId, setSetuppingId] = useState<number | null>(null);
  const [setupByRepo, setSetupByRepo] = useState<Record<number, SetupPrView>>({});
  const [probingSetupId, setProbingSetupId] = useState<number | null>(null);
  const [setupStatusByRepo, setSetupStatusByRepo] = useState<Record<number, SetupStatusView>>({});
  const [remediatingId, setRemediatingId] = useState<number | null>(null);
  const [remediateByRepo, setRemediateByRepo] = useState<Record<number, RemediationPrView>>({});
  const [githubByRepo, setGithubByRepo] = useState<Record<number, GithubResponseView>>({});
  const [workflowDraft, setWorkflowDraft] = useState<Record<number, string>>({});
  const [packageName, setPackageName] = useState("");
  const [watchingPackage, setWatchingPackage] = useState(false);
  const [importNames, setImportNames] = useState("");
  const [importingPackages, setImportingPackages] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ProtectionImportResult[] | null>(null);
  const [originUrl, setOriginUrl] = useState("");
  const [watchingOrigin, setWatchingOrigin] = useState(false);
  const [originError, setOriginError] = useState<string | null>(null);
  const [checkingOriginId, setCheckingOriginId] = useState<number | null>(null);
  const [mapDestinations, setMapDestinations] = useState<MapCustodyDestination[]>([]);
  const [mapKind, setMapKind] = useState<"sentry" | "bugsnag">("sentry");
  const [mapHost, setMapHost] = useState("");
  const [mapOrg, setMapOrg] = useState("");
  const [mapProject, setMapProject] = useState("");
  const [mapToken, setMapToken] = useState("");
  const [savingMap, setSavingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [checkingMapId, setCheckingMapId] = useState<number | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [diffingId, setDiffingId] = useState<number | null>(null);
  const [diffByPackage, setDiffByPackage] = useState<Record<number, ReleaseDiffView | { error: string }>>(
    {},
  );
  const [exceptions, setExceptions] = useState<PolicyExceptionView[]>([]);
  const [baselineByPackage, setBaselineByPackage] = useState<Record<number, BaselineView | null>>({});
  const [allowRule, setAllowRule] = useState("");
  const [allowPath, setAllowPath] = useState("");
  const [allowReason, setAllowReason] = useState("");
  const [allowExpires, setAllowExpires] = useState(defaultExpiryDate);
  const [savingAllow, setSavingAllow] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [baselineReason, setBaselineReason] = useState("Approved current packed artifact as the shipping baseline.");
  const [alertNotes, setAlertNotes] = useState<Record<number, string>>({});
  const [alertAssignees, setAlertAssignees] = useState<Record<number, string>>({});
  const [alertEvents, setAlertEvents] = useState<Record<number, AlertEvent[]>>({});
  const [alertBusyId, setAlertBusyId] = useState<number | null>(null);
  const [alertErrorById, setAlertErrorById] = useState<Record<number, string>>({});
  const [testingInstallId, setTestingInstallId] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineView>({ status: "loading" });
  const [audit, setAudit] = useState<AuditView>({ status: "loading" });
  const [auditExportError, setAuditExportError] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionView>({ status: "loading" });
  const [retentionDraft, setRetentionDraft] = useState<RetentionDays>(90);
  const [identitySignals, setIdentitySignals] = useState<IdentitySignalsView>({ status: "loading" });
  const [candidatesByPackage, setCandidatesByPackage] = useState<Record<number, IdentityCandidateView[]>>(
    {},
  );
  const [allowReasonByCandidate, setAllowReasonByCandidate] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [inviteLogin, setInviteLogin] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [selectedInstallId, setSelectedInstallId] = useState<number | null>(null);

  const refreshSignedIn = useCallback(async (installationId: number | null) => {
    setRepos({ status: "loading" });
    setAlerts({ status: "loading" });
    setPackages({ status: "loading" });
    setOrigins({ status: "loading" });
    setTimeline({ status: "loading" });
    setAudit({ status: "loading" });
    setRetention({ status: "loading" });
    setIdentitySignals({ status: "loading" });
    try {
      const q = (path: string) => scopedApi(path, installationId);
      const [repoBody, alertBody, packageBody, originBody, exceptionBody, registryBody, destinationBody, deliveryBody, routeBody, tokenBody, releaseBody, protectionBody, jobBody, mapBody] =
        await Promise.all([
        loadJson<{ repos: Repo[] }>(q("/api/repos")),
        loadJson<{ alerts: Alert[] }>(q("/api/alerts")),
        loadJson<{ packages: WatchedPackage[] }>(q("/api/packages")),
        loadJson<{ origins: WatchedOrigin[] }>(q("/api/origins")),
        loadJson<{ exceptions: PolicyExceptionView[] }>(q("/api/exceptions")),
        loadJson<{ registries: NpmRegistry[] }>(q("/api/registries")),
        loadJson<{ destinations: NotificationDestination[] }>(q("/api/destinations")),
        loadJson<{ deliveries: NotificationDelivery[] }>(q("/api/destinations/deliveries")),
        loadJson<{ routes: NotificationRoute[] }>(q("/api/destinations/routes")),
        loadJson<{ tokens: ScanApiToken[] }>(q("/api/scan-tokens")),
        loadJson<{ releases: ReleaseRevision[] }>(q("/api/releases")),
        loadJson<{ protections: PackageProtection[] }>(q("/api/protections")),
        loadJson<{ jobs: TenantJob[]; summary: JobSummary; fairUse?: FairUseStatus }>(q("/api/jobs")),
        loadJson<{ destinations: MapCustodyDestination[] }>(q("/api/map-destinations")),
      ]);
      setRepos({ status: "ready", data: repoBody });
      setAlerts({ status: "ready", data: alertBody });
      setPackages({ status: "ready", data: packageBody });
      setOrigins({ status: "ready", data: originBody });
      setExceptions(exceptionBody.exceptions);
      setRegistries(registryBody.registries);
      setDestinations(destinationBody.destinations);
      setDeliveries(deliveryBody.deliveries);
      setRoutes(routeBody.routes);
      setScanTokens(tokenBody.tokens);
      setReleases(releaseBody.releases);
      setProtections(protectionBody.protections);
      setJobs(jobBody.jobs);
      setJobSummary(jobBody.summary);
      setFairUse(jobBody.fairUse ?? null);
      setMapDestinations(mapBody.destinations);
      if (installationId) {
        const membersResponse = await fetch(`/api/installations/${installationId}/members`, {
          credentials: "include",
        });
        const membersBody = (await membersResponse.json()) as {
          error?: string;
          members?: TeamMember[];
          invites?: TeamInvite[];
        };
        if (!membersResponse.ok) {
          setMembers([]);
          setInvites([]);
          setMembersError(membersBody.error ?? "Could not load members.");
        } else {
          setMembers(membersBody.members ?? []);
          setInvites(membersBody.invites ?? []);
          setMembersError(null);
        }
      } else {
        setMembers([]);
        setInvites([]);
        setMembersError(null);
      }
      const timelineResponse = await fetch(q("/api/timeline"), { credentials: "include" });
      const timelineBody = (await timelineResponse.json()) as {
        error?: string;
        days?: number;
        entries?: TimelineEntry[];
      };
      if (timelineResponse.status === 402) {
        setTimeline({ status: "ended" });
      } else if (timelineResponse.status === 403) {
        setTimeline({ status: "solo" });
      } else if (!timelineResponse.ok) {
        setTimeline({ status: "error", message: timelineBody.error ?? "Could not load the timeline." });
      } else {
        setTimeline({
          status: "ready",
          days: timelineBody.days ?? 90,
          entries: timelineBody.entries ?? [],
        });
      }
      const auditResponse = await fetch(q("/api/audit"), { credentials: "include" });
      const auditBody = (await auditResponse.json()) as {
        error?: string;
        rows?: AuditRow[];
      };
      if (auditResponse.status === 402) {
        setAudit({ status: "ended" });
      } else if (auditResponse.status === 403) {
        setAudit({ status: "solo" });
      } else if (!auditResponse.ok) {
        setAudit({ status: "error", message: auditBody.error ?? "Could not load the audit log." });
      } else {
        setAudit({ status: "ready", rows: auditBody.rows ?? [] });
      }
      const retentionResponse = await fetch(q("/api/retention"), { credentials: "include" });
      const retentionBody = (await retentionResponse.json()) as {
        error?: string;
        days?: number;
      };
      if (!retentionResponse.ok) {
        setRetention({
          status: "error",
          message: retentionBody.error ?? "Could not load retention.",
        });
      } else {
        const days = parseRetentionDays(retentionBody.days) ?? 90;
        setRetention({ status: "ready", days });
        setRetentionDraft(days);
      }
      const nextCandidates: Record<number, IdentityCandidateView[]> = {};
      let identityStatus: IdentitySignalsView = { status: "ready" };
      for (const row of protectionBody.protections) {
        const candidatesResponse = await fetch(q(`/api/packages/${row.packageId}/candidates`), {
          credentials: "include",
        });
        const candidatesBody = (await candidatesResponse.json()) as {
          error?: string;
          candidates?: IdentityCandidateView[];
        };
        if (candidatesResponse.status === 402) {
          identityStatus = { status: "ended" };
          break;
        }
        if (candidatesResponse.status === 403) {
          identityStatus = { status: "solo" };
          break;
        }
        if (!candidatesResponse.ok) {
          identityStatus = {
            status: "error",
            message: candidatesBody.error ?? "Could not load lookalike names.",
          };
          break;
        }
        nextCandidates[row.packageId] = candidatesBody.candidates ?? [];
      }
      setIdentitySignals(identityStatus);
      setCandidatesByPackage(nextCandidates);
      const baselines = await Promise.all(
        packageBody.packages.map(async (pkg) => {
          const body = await loadJson<{ baseline: BaselineView | null }>(
            `/api/packages/${pkg.id}/baseline`,
          );
          return [pkg.id, body.baseline] as const;
        }),
      );
      setBaselineByPackage(Object.fromEntries(baselines));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load.";
      setRepos({ status: "error", message });
      setAlerts({ status: "error", message });
      setPackages({ status: "error", message });
      setOrigins({ status: "error", message });
      setMapDestinations([]);
      setTimeline({ status: "error", message });
      setAudit({ status: "error", message });
      setRetention({ status: "error", message });
      setIdentitySignals({ status: "error", message });
      setMembers([]);
      setInvites([]);
      setMembersError(message);
    }
  }, []);

  const beginConfirm = useCallback((next: Confirming) => {
    setConfirming(next);
    setConfirmText("");
    setConfirmError(null);
  }, []);

  const submitConfirm = useCallback(() => {
    if (!confirming) return;
    const installId = selectedInstallId;
    const confirm = confirmText.trim();
    setConfirmBusy(true);
    setConfirmError(null);
    void (async () => {
      try {
        const headers = { "content-type": "application/json" };
        let response: Response;
        if (confirming.kind === "destination") {
          response = await fetch(`/api/destinations/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "route") {
          response = await fetch(`/api/destinations/routes/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "registry") {
          response = await fetch(`/api/registries/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "package") {
          response = await fetch(`/api/packages/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "origin") {
          response = await fetch(`/api/origins/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "map-destination") {
          response = await fetch(`/api/map-destinations/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "token") {
          response = await fetch(`/api/scan-tokens/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "exception") {
          response = await fetch(`/api/exceptions/${confirming.id}/revoke`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "identity-allowlist") {
          response = await fetch(
            `/api/packages/${confirming.packageId}/candidates/${confirming.id}/allowlist`,
            {
              method: "POST",
              credentials: "include",
              headers,
              body: JSON.stringify({ confirm, reason: confirming.reason }),
            },
          );
        } else if (confirming.kind === "identity-revoke") {
          response = await fetch(
            `/api/packages/${confirming.packageId}/candidates/${confirming.id}/revoke`,
            {
              method: "POST",
              credentials: "include",
              headers,
              body: JSON.stringify({ confirm }),
            },
          );
        } else if (confirming.kind === "member") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch(`/api/installations/${installId}/members/${confirming.userId}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "retention") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch("/api/retention", {
            method: "PUT",
            credentials: "include",
            headers,
            body: JSON.stringify({
              installationId: installId,
              days: confirming.days,
              confirm,
            }),
          });
        } else if (confirming.kind === "make-private") {
          response = await fetch(`/api/repos/${confirming.id}/make-private`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "delete-pack-assets") {
          response = await fetch(`/api/repos/${confirming.id}/delete-pack-assets`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "disable-workflow") {
          response = await fetch(`/api/repos/${confirming.id}/disable-workflow`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm, workflow: confirming.workflow }),
          });
        } else if (confirming.kind === "invite") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch(`/api/installations/${installId}/invites`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ login: confirming.login, role: confirming.role, confirm }),
          });
        } else if (confirming.kind === "invite-revoke") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch(`/api/installations/${installId}/invites/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (confirming.kind === "role") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch(`/api/installations/${installId}/members`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ userId: confirming.userId, role: confirming.role, confirm }),
          });
        } else if (confirming.kind === "release-approve" || confirming.kind === "release-reject") {
          response = await fetch(`/api/releases/${confirming.id}/approvals`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              decision: confirming.kind === "release-approve" ? "approved" : "rejected",
              reason: confirming.reason,
              confirm,
            }),
          });
        } else if (confirming.kind === "release-hold" || confirming.kind === "release-hold-release") {
          response = await fetch(`/api/releases/${confirming.id}/holds`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              action: confirming.kind === "release-hold" ? "place" : "release",
              reason: confirming.reason,
              confirm,
            }),
          });
        } else if (confirming.kind === "release-publish" || confirming.kind === "release-unpublish") {
          response = await fetch(`/api/releases/${confirming.id}/public`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              enabled: confirming.kind === "release-publish",
              confirm,
            }),
          });
        } else {
          throw new Error("Unknown confirmation.");
        }
        const body = (await response.json()) as {
          error?: string;
          reason?: string;
          skipped?: string;
          detail?: string;
        };
        const githubResponseKind =
          confirming.kind === "make-private" ||
          confirming.kind === "delete-pack-assets" ||
          confirming.kind === "disable-workflow";
        if (githubResponseKind && response.status === 409) {
          setGithubByRepo((current) => ({
            ...current,
            [confirming.id]: {
              status: "copy",
              reason: body.reason ?? body.error ?? ADMINISTRATION_DENIED,
            },
          }));
          setConfirming(null);
          setConfirmText("");
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "Could not confirm that action.");
        if (githubResponseKind) {
          setGithubByRepo((current) => ({
            ...current,
            [confirming.id]: {
              status: "ok",
              detail: body.detail ?? "GitHub updated. This is a confirmed response, not a discovered incident.",
            },
          }));
        }
        if (confirming.kind === "token") {
          setRevealedScanToken(null);
        }
        if (confirming.kind === "invite") {
          setInviteLogin("");
          setInviteRole("member");
        }
        setConfirming(null);
        setConfirmText("");
        await refreshSignedIn(installId);
      } catch (error) {
        setConfirmError(error instanceof Error ? error.message : "Could not confirm that action.");
      } finally {
        setConfirmBusy(false);
      }
    })();
  }, [confirmText, confirming, refreshSignedIn, selectedInstallId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await loadJson<Me>("/api/me");
        if (cancelled) return;
        setMe({ status: "ready", data: body });
        if (body.user) {
          const wanted = installIdFromSearch(search);
          const ids = (body.installations ?? []).map((row) => row.id);
          const pick = wanted && ids.includes(wanted) ? wanted : (ids[0] ?? null);
          setSelectedInstallId(pick);
          if (pick && wanted !== pick) {
            navigate(`/watch?install=${pick}`);
          }
          await refreshSignedIn(pick);
        } else {
          setRepos({ status: "ready", data: { repos: [] } });
          setAlerts({ status: "ready", data: { alerts: [] } });
          setPackages({ status: "ready", data: { packages: [] } });
          setExceptions([]);
          setBaselineByPackage({});
          setRegistries([]);
          setDestinations([]);
          setDeliveries([]);
          setRoutes([]);
          setScanTokens([]);
          setReleases([]);
          setProtections([]);
          setJobs([]);
          setJobSummary({ queued: 0, running: 0, done: 0, failed: 0 });
          setFairUse(null);
          setMembers([]);
          setInvites([]);
          setMembersError(null);
          setAudit({ status: "ready", rows: [] });
          setAuditExportError(null);
          setRetention({ status: "ready", days: 90 });
          setRetentionDraft(90);
          setConfirming(null);
          setRevealedScanToken(null);
          setAlertNotes({});
          setAlertAssignees({});
          setAlertEvents({});
          setAlertErrorById({});
          setTestError(null);
          setExportError(null);
        }
      } catch (error) {
        if (cancelled) return;
        setMe({
          status: "error",
          message: error instanceof Error ? error.message : "Could not reach NoSpoilers.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSignedIn, search]);

  if (me.status === "loading") {
    return (
      <main className="flex min-h-[70svh] items-center justify-center px-5">
        <p className="text-sm text-dim">Checking GitHub session…</p>
      </main>
    );
  }

  if (me.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24">
        <p className="font-display text-3xl text-snow">Could not load the watch desk</p>
        <p className="mt-3 text-mute">{me.message}</p>
      </main>
    );
  }

  const { user, githubApp, installUrl, coverage: sessionCoverage, hostedOrigin, githubRunnersReachable } =
    me.data;
  const installations = me.data.installations ?? [];
  const queryCoverage = coverageFromQuery(search);
  const previewing = !user;
  const coverage: Coverage | undefined = user
    ? sessionCoverage
    : (queryCoverage ?? coverageFromQuery("?as=trial") ?? undefined);

  if (!user && githubApp && !queryCoverage) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Watch desk</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
          Sign in to keep the bot thinking.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-mute md:text-lg">
          This is the hosted GitHub App. Install, then we watch publicize / transfer / collaborator /
          fork and we unpack release packs. Coverage is Solo $29 or Team $99 after a 14-day trial.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button as="a" href="/api/auth/github" size="lg">
            Sign in with GitHub
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => navigate("/watch?as=trial")}>
            Preview the desk
          </Button>
        </div>
        <p className="mt-10 text-sm text-dim">
          Two logged-in looks:{" "}
          <button type="button" className="text-snow underline-offset-4 hover:underline" onClick={() => navigate("/watch?as=trial")}>
            trial desk
          </button>
          {" · "}
          <button type="button" className="text-snow underline-offset-4 hover:underline" onClick={() => navigate("/scan?as=ended")}>
            unpaid locked scan
          </button>
        </p>
      </main>
    );
  }

  const selectedLiveInstall = previewing
    ? null
    : (selectedInstallId
        ? (installations.find((row) => row.id === selectedInstallId) ?? installations[0])
        : installations[0]) ?? null;
  const selectedInstall = previewing ? PREVIEW_INSTALLATIONS[0] : selectedLiveInstall;
  const deskCoverage = previewing
    ? coverage
    : selectedLiveInstall
      ? coverageFrom(selectedLiveInstall.trialEndsAt, selectedLiveInstall.plan)
      : coverage;
  const ended = deskCoverage?.status === "ended";
  const githubPaused = Boolean(selectedLiveInstall?.suspended);
  const locked = ended || githubPaused;
  const installAdmin = selectedLiveInstall?.role === "admin";
  const canManageRoles =
    Boolean(installAdmin) && (deskCoverage?.status === "trial" || deskCoverage?.plan === "team");
  const canGovernReleases =
    Boolean(installAdmin) &&
    !ended &&
    (deskCoverage?.status === "trial" || deskCoverage?.plan === "team");
  const canExportReleases =
    !previewing &&
    !ended &&
    (deskCoverage?.status === "trial" || deskCoverage?.plan === "team");
  const canPublishVerify = Boolean(installAdmin) && !ended && !previewing;
  const canChangeRetention = Boolean(installAdmin) && !ended && !previewing;
  const adminCount = members.filter((row) => row.role === "admin").length;
  const login = user?.login ?? PREVIEW_LOGIN;
  const watching = selectedInstall ? [selectedInstall.account_login] : [];
  const activeInstallId = selectedLiveInstall?.id ?? null;
  const deskRepos = previewing ? previewRepos() : repos.status === "ready" ? repos.data.repos : [];
  const deskAlerts = previewing ? previewAlerts() : alerts.status === "ready" ? alerts.data.alerts : [];
  const deskPackages = previewing
    ? []
    : packages.status === "ready"
      ? packages.data.packages
      : [];
  const confirmForm = (match: boolean) =>
    confirming && match ? (
      <TypeToConfirm
        expected={confirming.expected}
        action={confirmActionLabel(confirming)}
        busy={confirmBusy}
        value={confirmText}
        error={confirmError}
        onChange={setConfirmText}
        onCancel={() => {
          setConfirming(null);
          setConfirmText("");
          setConfirmError(null);
        }}
        onSubmit={submitConfirm}
      />
    ) : null;

  return (
    <main className="fade-up mx-auto max-w-5xl px-5 py-12 md:py-16">
      {previewing ? <LoggedInLook current={ended ? "ended" : "trial"} /> : null}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-dim">{login}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-snow md:text-4xl">Watch desk</h1>
          <p className="mt-2 max-w-xl text-sm text-mute">
            {ended
              ? "Coverage ended. The bot is quiet until you subscribe."
              : githubPaused
                ? "GitHub suspended the NoSpoilers App. Repositories stay listed. We do not scan until GitHub unsuspends it."
                : watching.length > 0
                ? `Watching ${watching.join(", ")}. Hosted pack scans are on${deskCoverage?.status === "trial" ? " for this trial" : ""}.`
                : "No installs linked yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {deskCoverage && (
            <span
              className={
                ended
                  ? "text-[11px] uppercase tracking-[0.16em] text-danger"
                  : "text-[11px] uppercase tracking-[0.16em] text-dim"
              }
            >
              {deskCoverage.label}
              {!previewing && selectedLiveInstall?.role
                ? ` · ${selectedLiveInstall.role === "admin" ? "admin" : "member"}`
                : ""}
            </span>
          )}
          {!previewing && installations.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">GitHub install</span>
              <select
                value={activeInstallId ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (!Number.isFinite(id) || id <= 0) return;
                  setSelectedInstallId(id);
                  navigate(`/watch?install=${id}`);
                  void refreshSignedIn(id);
                }}
                className="h-10 rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
              >
                {installations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.account_login}
                    {row.suspended ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {installUrl && githubApp && user && (
            <Button as="a" href={installUrl}>
              Install on GitHub
            </Button>
          )}
          {ended && (
            <Button type="button" onClick={() => navigate("/pricing")}>
              Subscribe
            </Button>
          )}
        </div>
      </div>

      <div className="mt-14 grid min-h-72 gap-16 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative min-h-72">
          {ended ? (
            <CoverageLock variant="watch" title="Subscribe to keep watching." />
          ) : null}
          <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
            Setup PR adds packed-artifact CI that scans each{" "}
            <code className="text-snow">package.tgz</code> or{" "}
            <code className="text-snow">dist/</code> pack that exists, not only a hardcoded
            package.tgz. The workflow vendors{" "}
            <code className="text-snow">.github/actions/nospoilers</code> and POSTs packed bytes
            to hosted scan. It needs a Watch token plus repository variable{" "}
            <code className="text-snow">NOSPOILERS_API_URL</code>
            {hostedOrigin ? (
              <>
                {" "}
                (currently <code className="text-snow">{hostedOrigin}</code>
                {githubRunnersReachable
                  ? ", which GitHub-hosted runners can reach"
                  : "; GitHub-hosted runners cannot reach loopback or HTTP"}
                )
              </>
            ) : null}
            . If none exist, that workflow
            fails closed. Remediation PR adds ignore
            rules, an empty .nospoilers.yml (no silent allowlist), bundler hints, and that CI
            workflow if it is missing. Both PRs need Contents write and Pull requests write. They
            commit the vendored Action; the workflow YAML stays copy-paste because the App does not
            request Workflows write. They
            are reviewable and never merged. They do not need Administration, and they do not make
            the repository private or delete a Release asset.             After you merge the setup PR, mark the
            NoSpoilers check required in branch protection if you want CI to block; the App does
            not change branch protection and cannot see whether a check is required. Setup status
            probes the vendored Action, the workflow YAML, and whether a NoSpoilers check ran.
            It never invents an alert. A GitHub Release is scanned when it
            is published, and again when pack assets are added or replaced. Scan latest release
            unpacks that repo’s current Release pack, not the git tree. The hourly poller does
            not download every latest release. Unpublishing or deleting
            a release is an alert only; gone assets are not downloaded.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
            {MAKE_PRIVATE_COPY} {DELETE_PACK_ASSETS_COPY} {DISABLE_WORKFLOW_COPY} Setup and
            remediation PRs do not need Administration. A confirmed GitHub response is not a
            discovered incident.
          </p>
          {previewing ? (
            <p className="mt-3 text-sm leading-relaxed text-mute">
              Preview cannot open GitHub PRs, probe setup files, or change GitHub visibility. No
              invented incident.
            </p>
          ) : null}
          {!previewing && repos.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {!previewing && repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
          {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Nothing on this install yet. Install NoSpoilers on a private throwaway repo.
            </p>
          )}
          {deskRepos.length > 0 && (
            <ul className="mt-4 divide-y divide-white/5">
              {deskRepos.map((repo) => (
                <li key={repo.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={repo.html_url}
                      className="font-mono text-sm text-snow underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {repo.full_name}
                    </a>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      {repo.private ? "private" : "public"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-dim">
                    Last check{" "}
                    {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || scanningId === repo.id || locked}
                      onClick={() => {
                        if (previewing) return;
                        setScanError(null);
                        setScanningId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/scan-latest-release`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as { error?: string };
                            if (!response.ok) throw new Error(body.error ?? "Could not queue scan.");
                            await refreshSignedIn(selectedInstallId);
                          } catch (error) {
                            setScanError(error instanceof Error ? error.message : "Could not queue scan.");
                          } finally {
                            setScanningId(null);
                          }
                        })();
                      }}
                    >
                      {scanningId === repo.id ? "Queuing…" : "Scan latest release"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || probingSetupId === repo.id || locked}
                      onClick={() => {
                        if (previewing) return;
                        setProbingSetupId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/setup-status`, {
                              credentials: "include",
                            });
                            const body = (await response.json()) as {
                              error?: string;
                              status?: SetupStatusFacts;
                            };
                            if (!response.ok || !body.status) {
                              throw new Error(body.error ?? "Could not probe setup files.");
                            }
                            setSetupStatusByRepo((current) => ({
                              ...current,
                              [repo.id]: { status: "ready", facts: body.status! },
                            }));
                          } catch (error) {
                            setSetupStatusByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Could not probe setup files.",
                              },
                            }));
                          } finally {
                            setProbingSetupId(null);
                          }
                        })();
                      }}
                    >
                      {probingSetupId === repo.id ? "Probing…" : "Setup status"}
                    </Button>
                    {previewing || installAdmin ? (
                    <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || setuppingId === repo.id || locked}
                      onClick={() => {
                        if (previewing) return;
                        setSetuppingId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/setup-pr`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as {
                              error?: string;
                              reason?: string;
                              workflow?: string;
                              files?: { path: string; content: string }[];
                              written?: string[];
                              branch?: string;
                              compareUrl?: string | null;
                              htmlUrl?: string;
                              number?: number;
                              existing?: boolean;
                              skipped?: string;
                            };
                            if (response.status === 409 && (body.files?.length || body.workflow)) {
                              const files =
                                body.files && body.files.length > 0
                                  ? body.files
                                  : [
                                      {
                                        path: ".github/workflows/nospoilers.yml",
                                        content: body.workflow ?? "",
                                      },
                                    ];
                              setSetupByRepo((current) => ({
                                ...current,
                                [repo.id]: {
                                  status: "copy",
                                  reason: body.reason ?? "GitHub App cannot open a pull request.",
                                  files,
                                  written: body.written,
                                  branch: body.branch,
                                  compareUrl: body.compareUrl,
                                },
                              }));
                              return;
                            }
                            if (!response.ok || !body.htmlUrl || typeof body.number !== "number") {
                              throw new Error(body.error ?? body.reason ?? "Could not open a setup PR.");
                            }
                            const htmlUrl = body.htmlUrl;
                            const number = body.number;
                            setSetupByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "opened",
                                htmlUrl,
                                number,
                                existing: Boolean(body.existing),
                              },
                            }));
                          } catch (error) {
                            setSetupByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  error instanceof Error ? error.message : "Could not open a setup PR.",
                              },
                            }));
                          } finally {
                            setSetuppingId(null);
                          }
                        })();
                      }}
                    >
                      {setuppingId === repo.id ? "Opening…" : "Setup PR"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || remediatingId === repo.id || locked}
                      onClick={() => {
                        if (previewing) return;
                        setRemediatingId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/remediation-pr`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as {
                              error?: string;
                              reason?: string;
                              files?: RemediationFileView[];
                              written?: string[];
                              branch?: string;
                              compareUrl?: string | null;
                              htmlUrl?: string;
                              number?: number;
                              existing?: boolean;
                              skipped?: string;
                            };
                            if (response.status === 409 && Array.isArray(body.files) && body.files.length > 0) {
                              setRemediateByRepo((current) => ({
                                ...current,
                                [repo.id]: {
                                  status: "copy",
                                  reason: body.reason ?? "GitHub App cannot open a pull request.",
                                  files: body.files ?? [],
                                  written: body.written,
                                  branch: body.branch,
                                  compareUrl: body.compareUrl,
                                },
                              }));
                              return;
                            }
                            if (!response.ok || !body.htmlUrl || typeof body.number !== "number") {
                              throw new Error(
                                body.error ?? body.reason ?? "Could not open a remediation PR.",
                              );
                            }
                            const htmlUrl = body.htmlUrl;
                            const number = body.number;
                            setRemediateByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "opened",
                                htmlUrl,
                                number,
                                existing: Boolean(body.existing),
                              },
                            }));
                          } catch (error) {
                            setRemediateByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  error instanceof Error
                                    ? error.message
                                    : "Could not open a remediation PR.",
                              },
                            }));
                          } finally {
                            setRemediatingId(null);
                          }
                        })();
                      }}
                    >
                      {remediatingId === repo.id ? "Opening…" : "Remediation PR"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || locked || confirmBusy}
                      onClick={() => {
                        if (previewing) return;
                        setGithubByRepo((current) => {
                          const next = { ...current };
                          delete next[repo.id];
                          return next;
                        });
                        beginConfirm({
                          kind: "make-private",
                          id: repo.id,
                          expected: makePrivateConfirm(repo.full_name),
                        });
                      }}
                    >
                      Make private
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || locked || confirmBusy}
                      onClick={() => {
                        if (previewing) return;
                        setGithubByRepo((current) => {
                          const next = { ...current };
                          delete next[repo.id];
                          return next;
                        });
                        beginConfirm({
                          kind: "delete-pack-assets",
                          id: repo.id,
                          expected: deletePackAssetsConfirm(repo.full_name),
                        });
                      }}
                    >
                      Remove pack assets
                    </Button>
                    </>
                    ) : null}
                  </div>
                  {previewing || installAdmin ? (
                    <div className="mt-3 max-w-xl">
                      <label className="block text-xs leading-relaxed text-dim">
                        Workflow path
                        <input
                          value={workflowDraft[repo.id] ?? ""}
                          onChange={(event) =>
                            setWorkflowDraft((current) => ({
                              ...current,
                              [repo.id]: event.target.value,
                            }))
                          }
                          placeholder=".github/workflows/release.yml"
                          autoComplete="off"
                          spellCheck={false}
                          disabled={previewing || locked || confirmBusy}
                          className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={previewing || locked || confirmBusy}
                        onClick={() => {
                          if (previewing) return;
                          const parsed = parseWorkflowPath(workflowDraft[repo.id] ?? "");
                          if (!parsed) {
                            setGithubByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  "Type a workflow path under .github/workflows/, like .github/workflows/release.yml.",
                              },
                            }));
                            return;
                          }
                          if (workflowIsNoSpoilersScan(parsed)) {
                            setGithubByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  "That workflow is the NoSpoilers packed scan. Disable a release publisher, not the scanner.",
                              },
                            }));
                            return;
                          }
                          setGithubByRepo((current) => {
                            const next = { ...current };
                            delete next[repo.id];
                            return next;
                          });
                          beginConfirm({
                            kind: "disable-workflow",
                            id: repo.id,
                            expected: parsed,
                            workflow: parsed,
                          });
                        }}
                      >
                        Disable workflow
                      </Button>
                    </div>
                  ) : null}
                  {confirmForm(confirming?.kind === "make-private" && confirming.id === repo.id)}
                  {confirmForm(
                    confirming?.kind === "delete-pack-assets" && confirming.id === repo.id,
                  )}
                  {confirmForm(
                    confirming?.kind === "disable-workflow" && confirming.id === repo.id,
                  )}
                  {githubByRepo[repo.id] ? (
                    <GithubResponseResult view={githubByRepo[repo.id]!} />
                  ) : null}
                  {setupStatusByRepo[repo.id] ? (
                    <SetupStatusResult view={setupStatusByRepo[repo.id]!} />
                  ) : null}
                  {setupByRepo[repo.id] ? <SetupPrResult view={setupByRepo[repo.id]!} /> : null}
                  {remediateByRepo[repo.id] ? (
                    <RemediationPrResult view={remediateByRepo[repo.id]!} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {scanError && <p className="mt-4 text-sm text-danger">{scanError}</p>}
          </div>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
            Acknowledge, assign, and resolve stay available when coverage has ended or GitHub has
            suspended the App. New scans still wait for coverage and an unsuspended install.
          </p>
          {!previewing && (
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setExportError(null);
                  void (async () => {
                    try {
                      const body = await loadJson<{ exportedAt: string; alerts: Alert[] }>(
                        scopedApi("/api/alerts/export", activeInstallId),
                      );
                      const blob = new Blob([JSON.stringify(body, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `nospoilers-alerts-${body.exportedAt.slice(0, 10)}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      setExportError(
                        error instanceof Error ? error.message : "Could not export alerts.",
                      );
                    }
                  })();
                }}
              >
                Export activity
              </Button>
              {exportError ? <p className="mt-2 text-sm text-danger">{exportError}</p> : null}
            </div>
          )}
          {!previewing && alerts.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {!previewing && alerts.status === "error" && <p className="mt-6 text-sm text-danger">{alerts.message}</p>}
          {deskAlerts.length === 0 && (previewing || alerts.status === "ready") && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Quiet so far. That is the good state — until a repo goes public or a release ships a map.
            </p>
          )}
          {deskAlerts.length > 0 && (
            <ul className="mt-4 max-h-[40rem] divide-y divide-white/5 overflow-auto">
              {deskAlerts.map((alert) => (
                <AlertDeskItem
                  key={alert.id}
                  alert={alert}
                  previewing={previewing}
                  events={alertEvents[alert.id] ?? []}
                  busy={alertBusyId === alert.id}
                  note={alertNotes[alert.id] ?? ""}
                  assignee={alertAssignees[alert.id] ?? ""}
                  error={alertErrorById[alert.id] ?? null}
                  onNote={(value) => setAlertNotes((current) => ({ ...current, [alert.id]: value }))}
                  onAssignee={(value) => setAlertAssignees((current) => ({ ...current, [alert.id]: value }))}
                  onAction={(action) => {
                    if (previewing) return;
                    setAlertErrorById((current) => {
                      const next = { ...current };
                      delete next[alert.id];
                      return next;
                    });
                    setAlertBusyId(alert.id);
                    void (async () => {
                      try {
                        const payload =
                          action === "assign"
                            ? { login: (alertAssignees[alert.id] ?? "").trim() }
                            : action === "resolve"
                              ? { note: (alertNotes[alert.id] ?? "").trim() }
                              : undefined;
                        const response = await fetch(`/api/alerts/${alert.id}/${action}`, {
                          method: "POST",
                          credentials: "include",
                          headers: payload ? { "content-type": "application/json" } : undefined,
                          body: payload ? JSON.stringify(payload) : undefined,
                        });
                        const body = (await response.json()) as { error?: string; alert?: Alert };
                        if (!response.ok || !body.alert) {
                          throw new Error(body.error ?? "Could not update that alert.");
                        }
                        setAlerts((current) => {
                          if (current.status !== "ready") return current;
                          return {
                            status: "ready",
                            data: {
                              alerts: current.data.alerts.map((row) =>
                                row.id === body.alert!.id ? { ...row, ...body.alert } : row,
                              ),
                            },
                          };
                        });
                        const eventBody = await loadJson<{ events: AlertEvent[] }>(
                          `/api/alerts/${alert.id}/events`,
                        );
                        setAlertEvents((current) => ({ ...current, [alert.id]: eventBody.events }));
                      } catch (error) {
                        setAlertErrorById((current) => ({
                          ...current,
                          [alert.id]:
                            error instanceof Error ? error.message : "Could not update that alert.",
                        }));
                      } finally {
                        setAlertBusyId(null);
                      }
                    })();
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">
          {timeline.status === "ready" ? timelineHeading(timeline.days) : "Timeline"}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Team and trial installs see this install’s alerts, acknowledgement activity, and
          notification deliveries{" "}
          {timeline.status === "ready"
            ? retentionWindowLabel(timeline.days)
            : "for the list window"}
          . Titles only — no secret values, webhook URLs, or other tenants. Append-only evidence
          stays until uninstall.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot show a live timeline. No invented incident.
          </p>
        ) : timeline.status === "solo" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            The install timeline is on Team. Email for Solo waits on Resend.
          </p>
        ) : timeline.status === "ended" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Subscribe to Team to keep the install timeline.
          </p>
        ) : timeline.status === "error" ? (
          <p className="mt-6 text-sm text-danger">{timeline.message}</p>
        ) : timeline.status === "loading" ? (
          <p className="mt-6 text-sm text-dim">Loading…</p>
        ) : timeline.entries.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            {timeline.days === 0
              ? "Nothing on this install yet."
              : `Nothing in the last ${timeline.days} days on this install.`}
          </p>
        ) : (
          <ul className="mt-6 max-w-xl divide-y divide-white/5">
            {timeline.entries.map((entry, index) => (
              <li key={`${entry.type}-${entry.alertId ?? "x"}-${entry.at}-${index}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-snow">
                    {entry.type === "delivery"
                      ? `${destinationKindLabel(entry.kind ?? "")} ${entry.deliveryStatus ?? "delivery"}`
                      : entry.type === "alert_event"
                        ? `${entry.action ?? "activity"}${entry.actorLogin ? ` · ${entry.actorLogin}` : ""}`
                        : entry.title ?? entry.kind ?? "Alert"}
                  </p>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    {new Date(entry.at).toLocaleString()}
                  </span>
                </div>
                {entry.fullName ? (
                  <p className="mt-1 font-mono text-xs text-dim">{entry.fullName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Retention</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Lists hide older alerts, jobs, receipts, revisions, and audit rows after this window.
          Append-only evidence is not deleted. Uninstall still drops the tenant.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot change live retention. No invented incident.
          </p>
        ) : ended ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Subscribe to keep configurable retention.
          </p>
        ) : retention.status === "error" ? (
          <p className="mt-6 text-sm text-danger">{retention.message}</p>
        ) : retention.status === "loading" ? (
          <p className="mt-6 text-sm text-dim">Loading…</p>
        ) : (
          <div className="mt-6 max-w-xl">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">List window</span>
              <select
                value={retentionDraft}
                disabled={!canChangeRetention || confirmBusy}
                onChange={(event) => {
                  const days = parseRetentionDays(Number(event.target.value));
                  if (days === null) return;
                  setRetentionDraft(days);
                }}
                className="h-10 rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40 disabled:opacity-50"
              >
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
                <option value={0}>Keep while this install exists</option>
              </select>
            </label>
            {canChangeRetention ? (
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={confirmBusy || retentionDraft === retention.days}
                  onClick={() =>
                    beginConfirm({
                      kind: "retention",
                      days: retentionDraft,
                      expected: retentionConfirmToken(retentionDraft),
                    })
                  }
                >
                  Save retention
                </Button>
                {confirmForm(confirming?.kind === "retention")}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-mute">
                An install admin has to change this window.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Audit log</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Team and trial installs can export this install’s admin writes, notification deliveries,
          and alert titles. Destructive actions require typing the public identifier. Webhook URLs,
          emails, tokens, and other secret values are never stored here.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot export a live audit log. No invented incident.
          </p>
        ) : audit.status === "solo" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">The audit log is on Team.</p>
        ) : audit.status === "ended" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Subscribe to Team to keep the audit log.
          </p>
        ) : audit.status === "error" ? (
          <p className="mt-6 text-sm text-danger">{audit.message}</p>
        ) : audit.status === "loading" ? (
          <p className="mt-6 text-sm text-dim">Loading…</p>
        ) : (
          <>
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAuditExportError(null);
                  void (async () => {
                    try {
                      const body = await loadJson<{ exportedAt: string }>(
                        scopedApi("/api/audit/export", activeInstallId),
                      );
                      const blob = new Blob([JSON.stringify(body, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `nospoilers-audit-${body.exportedAt.slice(0, 10)}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    } catch (error) {
                      setAuditExportError(
                        error instanceof Error ? error.message : "Could not export the audit log.",
                      );
                    }
                  })();
                }}
              >
                Export audit log
              </Button>
              {auditExportError ? <p className="mt-2 text-sm text-danger">{auditExportError}</p> : null}
            </div>
            {audit.rows.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                No admin writes recorded on this install yet.
              </p>
            ) : (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {audit.rows.map((row) => (
                  <li key={row.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-snow">{row.summary}</p>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                        {new Date(row.at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-dim">
                      {row.actorLogin} · {row.action}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Team</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          The first GitHub user to connect this install is admin. Later users become members. Admins
          change roles, remove people, and invite by GitHub login. They get that role the next time
          they sign in, if they can already see this App install. This does not send email. Email
          waits on Resend. This does not grant GitHub Administration. The last admin stays. GitHub
          suspend does not block this. An install admin also saves Slack, SIEM, Jira, PagerDuty, routes,
          registries, scan
          tokens, allowlists, and baselines, and opens setup or remediation PRs.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot manage Team roles. No invented incident.
          </p>
        ) : deskCoverage?.plan === "solo" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Team roles are on trial and Team.
          </p>
        ) : ended ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Subscribe to Team to keep managing roles.
          </p>
        ) : null}
        {previewing ? null : membersError ? (
          <p className="mt-6 text-sm text-danger">{membersError}</p>
        ) : (
          <>
            {canManageRoles ? (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  const login = inviteLogin.trim();
                  if (!login || confirmBusy) return;
                  beginConfirm({
                    kind: "invite",
                    login,
                    role: inviteRole,
                    expected: login,
                  });
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    GitHub login
                  </span>
                  <input
                    value={inviteLogin}
                    onChange={(event) => setInviteLogin(event.target.value)}
                    placeholder="octocat"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                  />
                </label>
                <label>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Role</span>
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value === "admin" ? "admin" : "member")
                    }
                    className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <Button type="submit" size="sm" disabled={confirmBusy || !inviteLogin.trim()}>
                  Invite
                </Button>
              </form>
            ) : null}
            {confirmForm(confirming?.kind === "invite")}
            {invites.length > 0 ? (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {invites.map((invite) => (
                  <li key={invite.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-snow">{invite.githubLogin}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-dim">
                          pending {invite.role}
                        </p>
                      </div>
                      {canManageRoles ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={confirmBusy}
                          onClick={() =>
                            beginConfirm({
                              kind: "invite-revoke",
                              id: invite.id,
                              expected: invite.githubLogin,
                            })
                          }
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                    {confirmForm(confirming?.kind === "invite-revoke" && confirming.id === invite.id)}
                  </li>
                ))}
              </ul>
            ) : null}
            {members.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                Nobody linked on this install yet.
              </p>
            ) : (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {members.map((member) => (
                  <li key={member.userId} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-snow">{member.login}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-dim">{member.role}</p>
                    </div>
                    {canManageRoles ? (
                      <div className="flex flex-wrap gap-2">
                        {member.role === "member" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={confirmBusy}
                            onClick={() =>
                              beginConfirm({
                                kind: "role",
                                userId: member.userId,
                                expected: member.login,
                                role: "admin",
                              })
                            }
                          >
                            Make admin
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={confirmBusy || adminCount <= 1}
                            onClick={() =>
                              beginConfirm({
                                kind: "role",
                                userId: member.userId,
                                expected: member.login,
                                role: "member",
                              })
                            }
                          >
                            Make member
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={confirmBusy || (member.role === "admin" && adminCount <= 1)}
                          onClick={() =>
                            beginConfirm({
                              kind: "member",
                              userId: member.userId,
                              expected: member.login,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                    </div>
                    {confirmForm(
                      (confirming?.kind === "member" && confirming.userId === member.userId) ||
                        (confirming?.kind === "role" && confirming.userId === member.userId),
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Install health</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Live permission tests talk to GitHub. They never create a Watch alert. Test install
          reports Contents and Metadata reads, Members read (collaborator alerts), optional
          Contents/Pull requests/Checks write, and whether Administration was granted — it should
          not be. If the App requested a permission this install has not accepted, Test install
          names it and links to GitHub’s Accept page. It does not ask for Administration. This
          install’s recent jobs stay listed until they succeed or hit the retry cap. Global
          queues stay owner-only.
        </p>
        {githubPaused ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-danger">
            GitHub suspended the NoSpoilers App
            {selectedInstall ? ` on ${selectedInstall.account_login}` : ""}
            . This is not a billing change.
          </p>
        ) : null}
        {!previewing && fairUse?.exhausted ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-danger">{FAIR_USE_EXHAUSTED}</p>
        ) : !previewing && fairUse?.warning ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">{FAIR_USE_WARNING}</p>
        ) : null}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot reach GitHub. No invented incident.
          </p>
        ) : (
          <ul className="mt-6 max-w-xl divide-y divide-white/5">
            {installations
              .filter((row) => !activeInstallId || row.id === activeInstallId)
              .map((install) => {
              const test = install.lastPermissionTest;
              return (
                <li key={install.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-sm text-snow">{install.account_login}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={testingInstallId === install.id}
                      onClick={() => {
                        setTestError(null);
                        setTestingInstallId(install.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/installations/${install.id}/test`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as {
                              error?: string;
                              inventedIncident?: boolean;
                              test?: PermissionTest;
                            };
                            if (!response.ok || !body.test || body.inventedIncident) {
                              throw new Error(body.error ?? "Could not test this install.");
                            }
                            const result = body.test;
                            setMe((current) => {
                              if (current.status !== "ready") return current;
                              return {
                                status: "ready",
                                data: {
                                  ...current.data,
                                  installations: current.data.installations.map((row) =>
                                    row.id === install.id
                                      ? {
                                          ...row,
                                          lastPermissionTest: result,
                                          lastPermissionTestAt: result.testedAt,
                                        }
                                      : row,
                                  ),
                                },
                              };
                            });
                          } catch (error) {
                            setTestError(
                              error instanceof Error ? error.message : "Could not test this install.",
                            );
                          } finally {
                            setTestingInstallId(null);
                          }
                        })();
                      }}
                    >
                      {testingInstallId === install.id ? "Testing…" : "Test install"}
                    </Button>
                  </div>
                  {test ? (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-mute">
                        {test.ok ? "Reads reachable. " : ""}
                        {test.detail} Last test {new Date(test.testedAt).toLocaleString()}.
                      </p>
                      {test.pendingAccepts && test.pendingAccepts.length > 0 && test.installUrl ? (
                        <p className="mt-2">
                          <a
                            href={test.installUrl}
                            className="text-sm text-snow underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Accept requested permissions
                          </a>
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-dim">No live permission test yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {testError ? <p className="mt-4 text-sm text-danger">{testError}</p> : null}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No recent jobs.</p>
        ) : jobs.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No recent jobs.</p>
        ) : (
          <>
            <p className="mt-6 text-xs text-dim">
              {jobSummary.queued} queued · {jobSummary.running} running · {jobSummary.done} done ·{" "}
              <span className={jobSummary.failed > 0 ? "text-danger" : undefined}>
                {jobSummary.failed} failed
              </span>
            </p>
            <ul className="mt-4 max-w-xl divide-y divide-white/5">
              {jobs.map((job) => (
                <li key={job.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-sm text-snow">{kindLabel(job.kind)}</p>
                    <span
                      className={
                        job.status === "failed"
                          ? "text-[11px] uppercase tracking-[0.16em] text-danger"
                          : "text-[11px] uppercase tracking-[0.16em] text-dim"
                      }
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-dim">
                    {job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}
                    {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                  </p>
                  {job.error ? (
                    <p className="mt-1 text-xs leading-relaxed text-mute">{job.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Notifications</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Team and trial installs can send Watch alerts to Slack, a SIEM HTTPS webhook, Jira
          Cloud, and PagerDuty. Secrets are encrypted and never shown again. A delivery test talks
          to the destination and never creates a Watch alert. Jira tests never open a ticket.
          PagerDuty tests send a change event and never open an incident. Routes send a real alert
          or a routed test to matching destinations by severity, repository, package, and teammate.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Preview cannot send Slack, SIEM, Jira, or PagerDuty. Preview cannot route a test. No
            invented incident.
          </p>
        ) : deskCoverage?.plan === "solo" ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Slack, SIEM, Jira, and PagerDuty are on Team. Email for Solo waits on Resend.
          </p>
        ) : (
          <>
            {destinations.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                No Slack, SIEM, Jira, or PagerDuty destination saved on this install.
              </p>
            ) : (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {destinations.map((destination) => (
                  <li key={destination.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-sm text-snow">
                        {destinationKindLabel(destination.kind)} · {destination.host}
                        {destination.kind === "jira" && destination.projectKey
                          ? ` · ${destination.projectKey}`
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={testingSlackId === destination.id}
                          onClick={() => {
                            setSlackError(null);
                            setTestingSlackId(destination.id);
                            void (async () => {
                              try {
                                const response = await fetch(`/api/destinations/${destination.id}/test`, {
                                  method: "POST",
                                  credentials: "include",
                                });
                                const body = (await response.json()) as {
                                  error?: string;
                                  inventedIncident?: boolean;
                                  detail?: string;
                                };
                                if (!response.ok || body.inventedIncident) {
                                  throw new Error(body.error ?? body.detail ?? "Could not test delivery.");
                                }
                                await refreshSignedIn(selectedInstallId);
                              } catch (error) {
                                setSlackError(
                                  error instanceof Error ? error.message : "Could not test Slack.",
                                );
                              } finally {
                                setTestingSlackId(null);
                              }
                            })();
                          }}
                        >
                          {testingSlackId === destination.id ? "Testing…" : "Test delivery"}
                        </Button>
                        {installAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={confirmBusy}
                          onClick={() =>
                            beginConfirm({
                              kind: "destination",
                              id: destination.id,
                              expected: destination.host,
                            })
                          }
                        >
                          Remove
                        </Button>
                        ) : null}
                      </div>
                    </div>
                    {confirmForm(confirming?.kind === "destination" && confirming.id === destination.id)}
                    <p className="mt-2 text-xs text-dim">
                      {destination.lastDeliveryStatus
                        ? `${destination.lastDeliveryStatus}${
                            destination.lastDeliveryAt
                              ? ` · ${new Date(destination.lastDeliveryAt).toLocaleString()}`
                              : ""
                          }`
                        : "No delivery yet"}
                      {destination.lastDeliveryError ? ` · ${destination.lastDeliveryError}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {!ended && installAdmin && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (savingSlack || !activeInstallId) return;
                  setSlackError(null);
                  setSavingSlack(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/slack", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          webhookUrl: slackWebhook,
                          installationId: activeInstallId,
                        }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not save Slack.");
                      setSlackWebhook("");
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(error instanceof Error ? error.message : "Could not save Slack.");
                    } finally {
                      setSavingSlack(false);
                    }
                  })();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    Slack incoming webhook
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={slackWebhook}
                    onChange={(event) => setSlackWebhook(event.target.value)}
                    placeholder="https://hooks.slack.com/services/…"
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                  />
                </label>
                <Button type="submit" size="sm" disabled={savingSlack || !slackWebhook.trim()}>
                  {savingSlack ? "Saving…" : "Save Slack"}
                </Button>
              </form>
            )}
            {!ended && installAdmin && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (savingSiem || !activeInstallId) return;
                  setSlackError(null);
                  setSavingSiem(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/siem", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          webhookUrl: siemWebhook,
                          installationId: activeInstallId,
                        }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not save SIEM.");
                      setSiemWebhook("");
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(error instanceof Error ? error.message : "Could not save SIEM.");
                    } finally {
                      setSavingSiem(false);
                    }
                  })();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    SIEM HTTPS webhook
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={siemWebhook}
                    onChange={(event) => setSiemWebhook(event.target.value)}
                    placeholder="https://siem.example.com/hooks/…"
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                  />
                </label>
                <Button type="submit" size="sm" disabled={savingSiem || !siemWebhook.trim()}>
                  {savingSiem ? "Saving…" : "Save SIEM"}
                </Button>
              </form>
            )}
            {!ended && installAdmin && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    savingJira ||
                    !activeInstallId ||
                    !jiraSite.trim() ||
                    !jiraEmail.trim() ||
                    !jiraToken.trim() ||
                    !jiraProjectKey.trim()
                  ) {
                    return;
                  }
                  setSlackError(null);
                  setSavingJira(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/jira", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          site: jiraSite,
                          email: jiraEmail,
                          token: jiraToken,
                          projectKey: jiraProjectKey,
                          installationId: activeInstallId,
                        }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not save Jira.");
                      setJiraSite("");
                      setJiraEmail("");
                      setJiraToken("");
                      setJiraProjectKey("");
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(error instanceof Error ? error.message : "Could not save Jira.");
                    } finally {
                      setSavingJira(false);
                    }
                  })();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      Jira Cloud site
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={jiraSite}
                      onChange={(event) => setJiraSite(event.target.value)}
                      placeholder="acme.atlassian.net"
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      Project key
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={jiraProjectKey}
                      onChange={(event) => setJiraProjectKey(event.target.value)}
                      placeholder="NOS"
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Email</span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={jiraEmail}
                      onChange={(event) => setJiraEmail(event.target.value)}
                      placeholder="bot@example.com"
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      API token
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={jiraToken}
                      onChange={(event) => setJiraToken(event.target.value)}
                      placeholder="encrypted after save"
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    />
                  </label>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    savingJira ||
                    !jiraSite.trim() ||
                    !jiraEmail.trim() ||
                    !jiraToken.trim() ||
                    !jiraProjectKey.trim()
                  }
                >
                  {savingJira ? "Saving…" : "Save Jira"}
                </Button>
              </form>
            )}
            {!ended && installAdmin && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (savingPagerDuty || !activeInstallId || !pagerDutyKey.trim()) return;
                  setSlackError(null);
                  setSavingPagerDuty(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/pagerduty", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          routingKey: pagerDutyKey,
                          installationId: activeInstallId,
                        }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not save PagerDuty.");
                      setPagerDutyKey("");
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(
                        error instanceof Error ? error.message : "Could not save PagerDuty.",
                      );
                    } finally {
                      setSavingPagerDuty(false);
                    }
                  })();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    PagerDuty Events API routing key
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={pagerDutyKey}
                    onChange={(event) => setPagerDutyKey(event.target.value)}
                    placeholder="32-character routing key"
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                  />
                </label>
                <Button type="submit" size="sm" disabled={savingPagerDuty || !pagerDutyKey.trim()}>
                  {savingPagerDuty ? "Saving…" : "Save PagerDuty"}
                </Button>
              </form>
            )}
            {routes.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                No routes yet. Destinations without a route still receive every Watch alert.
              </p>
            ) : (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {routes.map((route) => {
                  const destination = destinations.find((row) => row.id === route.destinationId);
                  return (
                    <li key={route.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-snow">
                          {destination
                            ? `${destinationKindLabel(destination.kind)} · ${destination.host}`
                            : "Destination"}
                          {` · ${routeMinSeverityLabel(route.minSeverity)}`}
                          {route.repoFullName ? ` · ${route.repoFullName}` : ""}
                          {route.packageName ? ` · ${route.packageName}` : ""}
                          {route.teamLogin ? ` · assign ${route.teamLogin}` : ""}
                        </p>
                        {installAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={confirmBusy}
                            onClick={() =>
                              beginConfirm({
                                kind: "route",
                                id: route.id,
                                expected: destination?.host ?? "",
                              })
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      {confirmForm(confirming?.kind === "route" && confirming.id === route.id)}
                    </li>
                  );
                })}
              </ul>
            )}
            {!ended && installAdmin && destinations.length > 0 && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (savingRoute || !activeInstallId) return;
                  const destinationId = Number(routeDestinationId || destinations[0]?.id);
                  if (!Number.isFinite(destinationId) || destinationId <= 0) return;
                  setSlackError(null);
                  setSavingRoute(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/routes", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          installationId: activeInstallId,
                          destinationId,
                          minSeverity: routeMinSeverity,
                          repoFullName: routeRepo,
                          packageName: routePackage,
                          teamLogin: routeTeam,
                        }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not save that route.");
                      setRouteRepo("");
                      setRoutePackage("");
                      setRouteTeam("");
                      setRouteMinSeverity("all");
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(error instanceof Error ? error.message : "Could not save that route.");
                    } finally {
                      setSavingRoute(false);
                    }
                  })();
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Route</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Destination</span>
                    <select
                      value={routeDestinationId || String(destinations[0]?.id ?? "")}
                      onChange={(event) => setRouteDestinationId(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      {destinations.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destinationKindLabel(destination.kind)} · {destination.host}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Minimum severity</span>
                    <select
                      value={routeMinSeverity}
                      onChange={(event) =>
                        setRouteMinSeverity(event.target.value as "all" | "warn" | "critical")
                      }
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="all">All severities</option>
                      <option value="warn">Warn and critical</option>
                      <option value="critical">Critical only</option>
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Repository</span>
                    <select
                      value={routeRepo}
                      onChange={(event) => setRouteRepo(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="">Any repository</option>
                      {deskRepos.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
                          {repo.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Package</span>
                    <select
                      value={routePackage}
                      onChange={(event) => setRoutePackage(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="">Any package</option>
                      {deskPackages.map((pkg) => (
                        <option key={pkg.id} value={pkg.package_name}>
                          {pkg.package_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 sm:col-span-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      Assign teammate
                    </span>
                    <select
                      value={routeTeam}
                      onChange={(event) => setRouteTeam(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="">No auto-assign</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.login}>
                          {member.login}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button type="submit" size="sm" disabled={savingRoute}>
                  {savingRoute ? "Saving…" : "Save route"}
                </Button>
              </form>
            )}
            {!ended && destinations.length > 0 && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (testingRoute || !activeInstallId) return;
                  setSlackError(null);
                  setTestingRoute(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/destinations/route-test", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          installationId: activeInstallId,
                          severity: routeTestSeverity,
                          repoFullName: routeTestRepo,
                          packageName: routeTestPackage,
                        }),
                      });
                      const body = (await response.json()) as {
                        error?: string;
                        inventedIncident?: boolean;
                        detail?: string;
                      };
                      if (!response.ok || body.inventedIncident) {
                        throw new Error(body.error ?? body.detail ?? "Could not test routing.");
                      }
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setSlackError(
                        error instanceof Error ? error.message : "Could not test routing.",
                      );
                    } finally {
                      setTestingRoute(false);
                    }
                  })();
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Routed test</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Severity</span>
                    <select
                      value={routeTestSeverity}
                      onChange={(event) =>
                        setRouteTestSeverity(event.target.value as "info" | "warn" | "critical")
                      }
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="critical">Critical</option>
                      <option value="warn">Warn</option>
                      <option value="info">Info</option>
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Repository</span>
                    <select
                      value={routeTestRepo}
                      onChange={(event) => setRouteTestRepo(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="">Any</option>
                      {deskRepos.map((repo) => (
                        <option key={`test-${repo.id}`} value={repo.full_name}>
                          {repo.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Package</span>
                    <select
                      value={routeTestPackage}
                      onChange={(event) => setRouteTestPackage(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    >
                      <option value="">Any</option>
                      {deskPackages.map((pkg) => (
                        <option key={`test-pkg-${pkg.id}`} value={pkg.package_name}>
                          {pkg.package_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={testingRoute}>
                  {testingRoute ? "Testing…" : "Test routed delivery"}
                </Button>
              </form>
            )}
            {deliveries.length > 0 ? (
              <ul className="mt-6 max-w-xl divide-y divide-white/5">
                {deliveries.slice(0, 8).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <p className="text-sm text-snow">
                      {destinationKindLabel(row.kind)} · {row.status}
                    </p>
                    <p className="text-xs text-dim">
                      {new Date(row.createdAt).toLocaleString()}
                      {row.error ? ` · ${row.error}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {slackError ? <p className="mt-4 text-sm text-danger">{slackError}</p> : null}
          </>
        )}
      </section>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Production websites</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          We fetch the HTTPS page you name, then same-origin JavaScript, CSS, maps, and a bounded
          probe of exposed files, credentials, and internal paths linked from the page. Local,
          private, and metadata hosts are blocked. JavaScript is not executed. Bytes are deleted
          after the scan. This is not advertised as a Pricing extra.
        </p>
        {previewing ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Preview cannot watch a website. No invented incident.
          </p>
        ) : ended ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Subscribe to unpack production websites on our servers.
          </p>
        ) : null}
        {!previewing && origins.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
        {!previewing && origins.status === "error" && (
          <p className="mt-6 text-sm text-danger">{origins.message}</p>
        )}
        {!previewing && user && installations.length > 0 && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || watchingOrigin) return;
              setOriginError(null);
              setWatchingOrigin(true);
              void (async () => {
                try {
                  const response = await fetch("/api/origins", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      url: originUrl,
                      installationId: activeInstallId,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not watch website.");
                  setOriginUrl("");
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setOriginError(error instanceof Error ? error.message : "Could not watch website.");
                } finally {
                  setWatchingOrigin(false);
                }
              })();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">HTTPS origin</span>
              <input
                value={originUrl}
                onChange={(event) => setOriginUrl(event.target.value)}
                placeholder="https://app.example.com/"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <Button type="submit" disabled={locked || watchingOrigin || !originUrl.trim()}>
              {watchingOrigin ? "Connecting…" : "Watch website"}
            </Button>
          </form>
        )}
        {originError && <p className="mt-4 text-sm text-danger">{originError}</p>}
        {!previewing && origins.status === "ready" && origins.data.origins.length > 0 && (
          <ul className="mt-6 max-w-xl divide-y divide-white/5">
            {origins.data.origins.map((row) => (
              <li key={row.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-snow">{row.origin_url}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-dim">
                      {row.last_scan_status ?? "queued"}
                      {row.last_checked_at
                        ? ` · ${new Date(row.last_checked_at).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={locked || checkingOriginId === row.id}
                      onClick={() => {
                        setCheckingOriginId(row.id);
                        setOriginError(null);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/origins/${row.id}/check`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as { error?: string };
                            if (!response.ok) throw new Error(body.error ?? "Could not check website.");
                            await refreshSignedIn(selectedInstallId);
                          } catch (error) {
                            setOriginError(
                              error instanceof Error ? error.message : "Could not check website.",
                            );
                          } finally {
                            setCheckingOriginId(null);
                          }
                        })();
                      }}
                    >
                      {checkingOriginId === row.id ? "Checking…" : "Check now"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={previewing || locked || confirmBusy}
                      onClick={() =>
                        beginConfirm({
                          kind: "origin",
                          id: row.id,
                          expected: row.origin_url,
                        })
                      }
                    >
                      Stop
                    </Button>
                  </div>
                </div>
                {confirmForm(confirming?.kind === "origin" && confirming.id === row.id)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Map custody</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Prove Sentry has the debug ID, or Bugsnag has the release version, and that the public
          site or pack does not serve the map. Tokens are encrypted and never returned. We do not
          download map source. This is not advertised as a Pricing extra. Bugsnag matches a release
          version; it cannot look up a debug ID.
        </p>
        {previewing ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Preview cannot connect map custody. No invented incident.
          </p>
        ) : ended ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Subscribe to keep checking private map uploads.
          </p>
        ) : null}
        {!previewing && user && installations.length > 0 && installAdmin && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || savingMap) return;
              setMapError(null);
              setSavingMap(true);
              void (async () => {
                try {
                  const response = await fetch("/api/map-destinations", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      installationId: activeInstallId,
                      kind: mapKind,
                      host: mapHost,
                      org: mapOrg,
                      project: mapProject,
                      token: mapToken,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not save map custody.");
                  setMapToken("");
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setMapError(error instanceof Error ? error.message : "Could not save map custody.");
                } finally {
                  setSavingMap(false);
                }
              })();
            }}
          >
            <div>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Destination</span>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mapKind === "sentry" ? "default" : "outline"}
                  disabled={locked}
                  onClick={() => setMapKind("sentry")}
                >
                  Sentry
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mapKind === "bugsnag" ? "default" : "outline"}
                  disabled={locked}
                  onClick={() => setMapKind("bugsnag")}
                >
                  Bugsnag
                </Button>
              </div>
            </div>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Host (optional)</span>
              <input
                value={mapHost}
                onChange={(event) => setMapHost(event.target.value)}
                placeholder={mapKind === "sentry" ? "sentry.io" : "api.bugsnag.com"}
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            {mapKind === "sentry" ? (
              <label>
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Organization slug</span>
                <input
                  value={mapOrg}
                  onChange={(event) => setMapOrg(event.target.value)}
                  placeholder="acme"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
            ) : null}
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                {mapKind === "sentry" ? "Project slug" : "Project id"}
              </span>
              <input
                value={mapProject}
                onChange={(event) => setMapProject(event.target.value)}
                placeholder={mapKind === "sentry" ? "web" : "project-id"}
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Auth token</span>
              <input
                type="password"
                value={mapToken}
                onChange={(event) => setMapToken(event.target.value)}
                placeholder="never shown again"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <Button type="submit" disabled={locked || savingMap || !mapProject.trim() || !mapToken.trim()}>
              {savingMap ? "Saving…" : "Save map custody"}
            </Button>
          </form>
        )}
        {mapError ? <p className="mt-4 text-sm text-danger">{mapError}</p> : null}
        {!previewing && mapDestinations.length > 0 && (
          <ul className="mt-6 max-w-xl divide-y divide-white/5">
            {mapDestinations.map((row) => (
              <li key={row.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-snow">
                      {row.kind} · {row.host}
                      {row.orgSlug ? ` · ${row.orgSlug}/${row.projectSlug}` : ` · ${row.projectSlug}`}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-dim">
                      {row.lastStatus ?? "queued"}
                      {row.lastCheckedAt ? ` · ${new Date(row.lastCheckedAt).toLocaleString()}` : ""}
                    </p>
                    {row.lastError ? <p className="mt-1 text-xs text-mute">{row.lastError}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={locked || checkingMapId === row.id}
                      onClick={() => {
                        setCheckingMapId(row.id);
                        setMapError(null);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/map-destinations/${row.id}/check`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as { error?: string };
                            if (!response.ok) throw new Error(body.error ?? "Could not check map custody.");
                            await refreshSignedIn(selectedInstallId);
                          } catch (error) {
                            setMapError(
                              error instanceof Error ? error.message : "Could not check map custody.",
                            );
                          } finally {
                            setCheckingMapId(null);
                          }
                        })();
                      }}
                    >
                      {checkingMapId === row.id ? "Checking…" : "Check now"}
                    </Button>
                    {installAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={previewing || locked || confirmBusy}
                        onClick={() =>
                          beginConfirm({
                            kind: "map-destination",
                            id: row.id,
                            expected: row.host,
                          })
                        }
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                </div>
                {confirmForm(confirming?.kind === "map-destination" && confirming.id === row.id)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">npm packages</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          We fetch the tarball a registry serves for <code className="text-snow">latest</code>, and
          also <code className="text-snow">next</code>, <code className="text-snow">beta</code>,{" "}
          <code className="text-snow">canary</code>, rc, alpha, and preview when those tags point at
          another packed version. Other dist-tag moves stay a tag-only alert and do not download.
          Public packs use registry.npmjs.org. Private registries need an encrypted token (never
          shown again). Tarball hosts must match the saved registry. Source is not kept. If the
          registry later has no package under that name after we recorded a version, Watch records
          that fact without downloading. A later pack that is twice as large, or at least 5 MiB
          larger unpacked, raises SIZE-003 against the
          approved baseline or the previous receipt. Protect identity only after the npm scope or
          GitHub repository field matches this install. Paste a list of names to protect owned
          packs in one pass — registry metadata only, no tarball download, no scan queue. Other
          people’s packs are not added to this watch list. A later change of who published latest,
          or whether it used an npm trusted publisher, is a Watch fact. Email and OIDC config ids
          are not stored. Trial and Team installs then generate bounded
          lookalike names and watch dormant resurrection, release bursts, new dependencies that
          point at newly created packages, packument unpacked-size jumps, and whether npm
          attestations or registry signature keyids disappear or change. Those last facts are
          packument presence only — we do not fetch or verify attestations. That is not a malware
          verdict.
        </p>
        {previewing ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Preview cannot watch lookalike names. No invented incident.
          </p>
        ) : deskCoverage?.plan === "solo" ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Lookalike, dormant, burst, new-dependency, packument-size, and provenance signals are on
            Team.
          </p>
        ) : ended ? (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
            Subscribe to Team to watch lookalike names.
          </p>
        ) : identitySignals.status === "error" ? (
          <p className="mt-4 max-w-xl text-sm text-danger">{identitySignals.message}</p>
        ) : null}
        {!previewing && packages.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
        {!previewing && packages.status === "error" && (
          <p className="mt-6 text-sm text-danger">{packages.message}</p>
        )}
        {!previewing && user && installations.length > 0 && installAdmin && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || savingRegistry) return;
              setRegistryError(null);
              setSavingRegistry(true);
              void (async () => {
                try {
                  const response = await fetch("/api/registries", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      origin: registryOriginInput,
                      token: registryToken,
                      installationId: activeInstallId,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not save registry.");
                  setRegistryToken("");
                  setRegistryOriginInput("");
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setRegistryError(error instanceof Error ? error.message : "Could not save registry.");
                } finally {
                  setSavingRegistry(false);
                }
              })();
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Private registry</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Origin</span>
                <input
                  value={registryOriginInput}
                  onChange={(event) => setRegistryOriginInput(event.target.value)}
                  placeholder="https://npm.pkg.github.com"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Token</span>
                <input
                  type="password"
                  value={registryToken}
                  onChange={(event) => setRegistryToken(event.target.value)}
                  placeholder="read-only token"
                  autoComplete="new-password"
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <Button type="submit" disabled={locked || savingRegistry || !registryOriginInput.trim() || !registryToken.trim()}>
                {savingRegistry ? "Saving…" : "Save token"}
              </Button>
            </div>
          </form>
        )}
        {registryError && <p className="mt-4 text-sm text-danger">{registryError}</p>}
        {!previewing && registries.length > 0 && (
          <ul className="mt-4 max-w-xl divide-y divide-white/5">
            {registries.map((registry) => (
              <li key={registry.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-mute">{registry.origin}</p>
                {installAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={locked || confirmBusy}
                  onClick={() =>
                    beginConfirm({
                      kind: "registry",
                      id: registry.id,
                      expected: registry.origin,
                    })
                  }
                >
                  Remove
                </Button>
                ) : null}
                </div>
                {confirmForm(confirming?.kind === "registry" && confirming.id === registry.id)}
              </li>
            ))}
          </ul>
        )}
        {!previewing && user && installations.length > 0 && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || watchingPackage) return;
              setPackageError(null);
              setWatchingPackage(true);
              void (async () => {
                try {
                  const response = await fetch("/api/packages", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      packageName,
                      installationId: activeInstallId,
                      registryOrigin: watchRegistryOrigin,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not watch package.");
                  setPackageName("");
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setPackageError(error instanceof Error ? error.message : "Could not watch package.");
                } finally {
                  setWatchingPackage(false);
                }
              })();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Package name</span>
              <input
                value={packageName}
                onChange={(event) => setPackageName(event.target.value)}
                placeholder="@scope/name"
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label className="min-w-0 sm:w-56">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Registry</span>
              <select
                value={watchRegistryOrigin}
                onChange={(event) => setWatchRegistryOrigin(event.target.value)}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
              >
                <option value="https://registry.npmjs.org">registry.npmjs.org</option>
                {registries.map((registry) => (
                  <option key={registry.id} value={registry.origin}>
                    {registry.host}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={locked || watchingPackage || !packageName.trim()}>
              {watchingPackage ? "Connecting…" : "Watch package"}
            </Button>
          </form>
        )}
        {!previewing && user && installations.length > 0 && (
          <form
            className="mt-8 flex max-w-xl flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || importingPackages) return;
              setImportError(null);
              setImportResults(null);
              setImportingPackages(true);
              void (async () => {
                try {
                  const response = await fetch("/api/protections/import", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      names: importNames,
                      installationId: activeInstallId,
                      registryOrigin: watchRegistryOrigin,
                    }),
                  });
                  const body = (await response.json()) as {
                    error?: string;
                    queued?: boolean;
                    results?: ProtectionImportResult[];
                  };
                  if (!response.ok) throw new Error(body.error ?? "Could not import protections.");
                  setImportNames("");
                  setImportResults(body.results ?? []);
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setImportError(
                    error instanceof Error ? error.message : "Could not import protections.",
                  );
                } finally {
                  setImportingPackages(false);
                }
              })();
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Protect identities</p>
            <p className="text-sm leading-relaxed text-mute">
              Up to 20 npm names, one per line or comma-separated. We read registry metadata only —
              no tarball download and no scan job. Protect only when the npm scope or GitHub
              repository field matches this install. Names you do not own stay off this watch list.
            </p>
            <label className="min-w-0">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Package names</span>
              <textarea
                value={importNames}
                onChange={(event) => setImportNames(event.target.value)}
                placeholder={"@you/app\nleft-pad"}
                autoComplete="off"
                spellCheck={false}
                disabled={locked}
                rows={4}
                className="mt-2 w-full resize-y rounded-md border border-white/15 bg-transparent px-3 py-2 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 sm:w-56">
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Registry</span>
                <select
                  value={watchRegistryOrigin}
                  onChange={(event) => setWatchRegistryOrigin(event.target.value)}
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                >
                  <option value="https://registry.npmjs.org">registry.npmjs.org</option>
                  {registries.map((registry) => (
                    <option key={registry.id} value={registry.origin}>
                      {registry.host}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={locked || importingPackages || !importNames.trim()}>
                {importingPackages ? "Importing…" : "Import protections"}
              </Button>
            </div>
          </form>
        )}
        {importError && <p className="mt-4 text-sm text-danger">{importError}</p>}
        {importResults && importResults.length > 0 && (
          <ul className="mt-4 max-w-xl divide-y divide-white/5">
            {importResults.map((row) => (
              <li key={`${row.name}:${row.status}`} className="py-3">
                <p className="font-mono text-sm text-snow">{row.name}</p>
                <p className="mt-1 text-xs text-dim">
                  {protectionImportStatusLabel(row.status)}
                  {row.verifiedVia ? ` · ${row.verifiedVia}` : ""}
                  {row.githubRepo ? ` ${row.githubRepo}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        {packageError && <p className="mt-4 text-sm text-danger">{packageError}</p>}
        {deskPackages.length === 0 && (previewing || packages.status === "ready") && (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            No packages yet. Connect a public pack, or save a private registry token and watch from
            that host.
          </p>
        )}
        {deskPackages.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5">
            {deskPackages.map((pkg) => {
              const diffState = diffByPackage[pkg.id];
              const protection = protections.find((row) => row.packageId === pkg.id);
              const candidates = candidatesByPackage[pkg.id] ?? [];
              return (
                <li key={pkg.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-snow">{pkg.package_name}</p>
                      <p className="mt-1 text-xs text-dim">
                        {pkg.registry_origin && pkg.registry_origin !== "https://registry.npmjs.org"
                          ? `${pkg.registry_origin} · `
                          : ""}
                        {pkg.last_version ? `@${pkg.last_version}` : "not scanned yet"}
                        {pkg.last_scan_status ? ` · ${pkg.last_scan_status}` : ""}
                        {pkg.last_sha256 ? ` · ${pkg.last_sha256.slice(0, 12)}` : ""}
                        {pkg.last_checked_at
                          ? ` · checked ${new Date(pkg.last_checked_at).toLocaleString()}`
                          : ""}
                        {baselineByPackage[pkg.id]
                          ? ` · baseline ${baselineByPackage[pkg.id]?.actorLogin} ${new Date(baselineByPackage[pkg.id]?.createdAt ?? "").toLocaleDateString()}`
                          : ""}
                        {protection
                          ? ` · protected via ${protection.verifiedVia}${protection.githubRepo ? ` ${protection.githubRepo}` : ""}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || locked || checkingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setCheckingId(pkg.id);
                          void (async () => {
                            try {
                              const response = await fetch(`/api/packages/${pkg.id}/check`, {
                                method: "POST",
                                credentials: "include",
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not check package.");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setPackageError(
                                error instanceof Error ? error.message : "Could not check package.",
                              );
                            } finally {
                              setCheckingId(null);
                            }
                          })();
                        }}
                      >
                        {checkingId === pkg.id ? "Checking…" : "Check now"}
                      </Button>
                      {!protection && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={previewing || locked || protectingId === pkg.id}
                          onClick={() => {
                            setPackageError(null);
                            setProtectingId(pkg.id);
                            void (async () => {
                              try {
                                const response = await fetch(`/api/packages/${pkg.id}/protect`, {
                                  method: "POST",
                                  credentials: "include",
                                });
                                const body = (await response.json()) as { error?: string };
                                if (!response.ok) {
                                  throw new Error(body.error ?? "Could not protect package.");
                                }
                                await refreshSignedIn(selectedInstallId);
                              } catch (error) {
                                setPackageError(
                                  error instanceof Error ? error.message : "Could not protect package.",
                                );
                              } finally {
                                setProtectingId(null);
                              }
                            })();
                          }}
                        >
                          {protectingId === pkg.id ? "Protecting…" : "Protect identity"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || locked || diffingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setDiffingId(pkg.id);
                          void (async () => {
                            try {
                              const body = await loadJson<ReleaseDiffView>(
                                `/api/packages/${pkg.id}/diff`,
                              );
                              setDiffByPackage((current) => ({ ...current, [pkg.id]: body }));
                            } catch (error) {
                              setDiffByPackage((current) => ({
                                ...current,
                                [pkg.id]: {
                                  error:
                                    error instanceof Error ? error.message : "Could not load diff.",
                                },
                              }));
                            } finally {
                              setDiffingId(null);
                            }
                          })();
                        }}
                      >
                        {diffingId === pkg.id ? "Diffing…" : "Diff"}
                      </Button>
                      {installAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || locked || approvingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setApprovingId(pkg.id);
                          void (async () => {
                            try {
                              const response = await fetch(`/api/packages/${pkg.id}/baseline`, {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ reason: baselineReason }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) {
                                throw new Error(body.error ?? "Could not approve baseline.");
                              }
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setPackageError(
                                error instanceof Error ? error.message : "Could not approve baseline.",
                              );
                            } finally {
                              setApprovingId(null);
                            }
                          })();
                        }}
                      >
                        {approvingId === pkg.id ? "Approving…" : "Approve baseline"}
                      </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={previewing || locked || confirmBusy}
                        onClick={() =>
                          beginConfirm({
                            kind: "package",
                            id: pkg.id,
                            expected: pkg.package_name,
                          })
                        }
                      >
                        Stop
                      </Button>
                    </div>
                  </div>
                  {confirmForm(confirming?.kind === "package" && confirming.id === pkg.id)}
                  {protection && identitySignals.status === "ready" && candidates.length > 0 ? (
                    <div className="mt-4 max-w-xl">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Lookalike names</p>
                      <ul className="mt-2 divide-y divide-white/5">
                        {candidates.map((candidate) => (
                          <li key={candidate.id} className="py-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="font-mono text-xs text-snow">{candidate.candidateName}</p>
                              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                                {candidate.transformation.replaceAll("_", " ")}
                                {candidate.allowlisted ? " · allowlisted" : ""}
                                {candidate.registeredAt && !candidate.allowlisted
                                  ? ` · registered${candidate.lastVersion ? ` ${candidate.lastVersion}` : ""}`
                                  : ""}
                              </p>
                            </div>
                            {candidate.allowlisted && candidate.allowlistReason ? (
                              <p className="mt-1 text-xs text-mute">{candidate.allowlistReason}</p>
                            ) : null}
                            {installAdmin && !candidate.allowlisted ? (
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                                <label className="min-w-0 flex-1">
                                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                                    Reason
                                  </span>
                                  <input
                                    value={allowReasonByCandidate[candidate.id] ?? ""}
                                    onChange={(event) =>
                                      setAllowReasonByCandidate((current) => ({
                                        ...current,
                                        [candidate.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Benign package we already trust"
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={previewing || locked}
                                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                                  />
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    previewing ||
                                    locked ||
                                    confirmBusy ||
                                    !(allowReasonByCandidate[candidate.id] ?? "").trim()
                                  }
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "identity-allowlist",
                                      packageId: pkg.id,
                                      id: candidate.id,
                                      expected: candidate.candidateName,
                                      reason: (allowReasonByCandidate[candidate.id] ?? "").trim(),
                                    })
                                  }
                                >
                                  Allowlist
                                </Button>
                              </div>
                            ) : null}
                            {installAdmin && candidate.allowlisted ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="mt-2"
                                disabled={previewing || locked || confirmBusy}
                                onClick={() =>
                                  beginConfirm({
                                    kind: "identity-revoke",
                                    packageId: pkg.id,
                                    id: candidate.id,
                                    expected: candidate.candidateName,
                                  })
                                }
                              >
                                Revoke allowlist
                              </Button>
                            ) : null}
                            {confirmForm(
                              (confirming?.kind === "identity-allowlist" ||
                                confirming?.kind === "identity-revoke") &&
                                confirming.id === candidate.id,
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {diffState && "error" in diffState ? (
                    <p className="mt-3 text-sm text-danger">{diffState.error}</p>
                  ) : null}
                  {diffState && "diff" in diffState ? (
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                      {!diffState.previous || !diffState.current || !diffState.diff ? (
                        <p className="text-sm text-mute">
                          {diffState.baseline
                            ? "Current receipt is the approved baseline."
                            : "Need two receipts, or an approved baseline, before a release diff exists."}
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                            {diffState.versus === "baseline" ? "vs baseline · " : ""}
                            {diffState.previous.coordinate} → {diffState.current.coordinate}
                          </p>
                          {diffState.diff.unexpectedSizeJump ? (
                            <p className="mt-2 text-sm text-snow">
                              SIZE-003 · unpacked {diffState.diff.nextBytes} bytes versus{" "}
                              {diffState.diff.previousBytes} on the{" "}
                              {diffState.versus === "baseline" ? "approved baseline" : "previous scan"}{" "}
                              (2× or 5 MiB jump).
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-dim">
                            +{diffState.diff.added.length} −{diffState.diff.removed.length} ~
                            {diffState.diff.changed.length} · {diffState.diff.sizeDelta >= 0 ? "+" : ""}
                            {diffState.diff.sizeDelta} bytes
                          </p>
                          <ul className="mt-3 flex flex-col gap-1 font-mono text-[11px] text-mute">
                            {diffState.diff.added.map((entry) => (
                              <li key={`a-${entry.path}`}>+ {entry.path}</li>
                            ))}
                            {diffState.diff.removed.map((entry) => (
                              <li key={`r-${entry.path}`}>− {entry.path}</li>
                            ))}
                            {diffState.diff.changed.map((entry) => (
                              <li key={`c-${entry.path}`}>~ {entry.path}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Scan API</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Mint a token to <code className="text-snow">POST</code> a packed artifact to{" "}
          <code className="text-snow">/api/v1/scan</code>. We hash the secret, show it once, and
          delete the bytes after the scan. Generated Setup CI vendors a composite Action in your
          repo and needs this token plus repository variable{" "}
          <code className="text-snow">NOSPOILERS_API_URL</code>. This product repository still
          scans locally with <code className="text-snow">uses: ./</code>.
        </p>
        {!previewing && hostedOrigin ? (
          <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
              Repository variable NOSPOILERS_API_URL
            </p>
            <pre className="mt-3 overflow-auto font-mono text-[11px] leading-relaxed text-snow">
              {hostedOrigin}
            </pre>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              {githubRunnersReachable
                ? "GitHub-hosted runners can POST packed bytes here. If this origin changes, update the repository variable. Do not use localhost."
                : "GitHub-hosted runners cannot reach this origin (loopback or not HTTPS). Set NOSPOILERS_API_URL to the HTTPS origin GitHub already uses for webhooks once that host is public. Do not grant Administration."}
            </p>
          </div>
        ) : null}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No scan tokens yet.</p>
        ) : (
          <>
            {user && installations.length > 0 && installAdmin && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (locked || mintingScanToken) return;
                  setScanTokenError(null);
                  setRevealedScanToken(null);
                  setMintingScanToken(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/scan-tokens", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          name: scanTokenName,
                          installationId: activeInstallId,
                        }),
                      });
                      const body = (await response.json()) as { error?: string; token?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not mint token.");
                      if (body.token) setRevealedScanToken(body.token);
                      await refreshSignedIn(selectedInstallId);
                    } catch (error) {
                      setScanTokenError(
                        error instanceof Error ? error.message : "Could not mint token.",
                      );
                    } finally {
                      setMintingScanToken(false);
                    }
                  })();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Name</span>
                  <input
                    value={scanTokenName}
                    onChange={(event) => setScanTokenName(event.target.value)}
                    placeholder="CI"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={locked}
                    className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                  />
                </label>
                <Button type="submit" disabled={locked || mintingScanToken}>
                  {mintingScanToken ? "Minting…" : "Mint token"}
                </Button>
              </form>
            )}
            {scanTokenError && <p className="mt-4 text-sm text-danger">{scanTokenError}</p>}
            {revealedScanToken ? (
              <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                  Copy now. We will not show this again.
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-dim">
                  Repository secret NOSPOILERS_API_TOKEN
                </p>
                <pre className="mt-3 overflow-auto font-mono text-[11px] leading-relaxed text-snow">
                  {revealedScanToken}
                </pre>
                {hostedOrigin ? (
                  <>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-dim">
                      Repository variable NOSPOILERS_API_URL
                    </p>
                    <pre className="mt-3 overflow-auto font-mono text-[11px] leading-relaxed text-snow">
                      {hostedOrigin}
                    </pre>
                  </>
                ) : null}
              </div>
            ) : null}
            {scanTokens.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">No scan tokens yet.</p>
            ) : (
              <ul className="mt-4 max-w-xl divide-y divide-white/5">
                {scanTokens.map((token) => (
                  <li key={token.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-snow">{token.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-dim">{token.token_prefix}…</p>
                    </div>
                    {installAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={locked || confirmBusy}
                      onClick={() =>
                        beginConfirm({
                          kind: "token",
                          id: token.id,
                          expected: token.name,
                        })
                      }
                    >
                      Revoke
                    </Button>
                    ) : null}
                    </div>
                    {confirmForm(confirming?.kind === "token" && confirming.id === token.id)}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Releases</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Append-only revisions for packed artifacts we scanned. Channels are stable, beta, or
          canary. A digest change appends a new row; history is not rewritten. CI URLs are stored
          and never fetched.           Each row shows the linked receipt status, sealed size, and media type.
          Failed-policy and
          inconclusive are not clean and are not allowed to ship. Download the signed receipt JSON
          and check it on Scan or with{" "}
          <code className="text-snow">npx nospoilers verify ./package.tgz --receipt receipt.json</code>
          {" "}
          or stream-hash a delivery URL with{" "}
          <code className="text-snow">npx nospoilers verify --receipt receipt.json --url https://example.com/app.tgz</code>
          . That check is not hosted unpack. Coverage ended still allows the download. An install
          admin can attach an HTTPS delivery URL and verify it now. Public GitHub Release
          download URLs and public npm tarball URLs are attached when we seal the revision.
          We stream-hash the bytes, compare them to the sealed digest, and drop the download.
          Cross-host redirects are not followed, except the GitHub Release download hop to
          GitHub’s asset CDN, a same-bucket S3 hop, or a same-account R2 hop. Verify records
          hop hosts, a cache token, and a region when we can read them from the host. Query
          strings never appear on Watch. This is not the hourly poller and not a hosted unpack.
          Trial and Team admins can approve a passing revision to ship or reject it — type the
          coordinate. The admin who attached a delivery URL cannot approve that revision.
          Failed-policy, inconclusive, and digest-changed rows cannot be approved. Legal hold
          keeps a revision on the list after the retention window; another admin must release
          the hold. Members can export the ledger JSON. Query strings and pack bytes stay off
          that export. Solo is 403. Unpaid is 402. An install admin can publish a verification
          page for a sealed revision — type the coordinate. Visitors see digests, receipt
          status, and last delivery host match. Query strings, pack bytes, CI URLs, and signed
          URLs stay off that page. Failed-policy is not clean. Solo may publish. Unpaid is 402.
          Unpublish hides the page. This is not scheduled CDN verification.
        </p>
        {previewing ? (
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Preview cannot approve or export releases. No invented incident.
          </p>
        ) : deskCoverage?.plan === "solo" ? (
          <p className="mt-4 text-sm leading-relaxed text-mute">
            Subscribe to Team to approve shipping releases, place legal hold, and export the ledger.
          </p>
        ) : null}
        {canExportReleases ? (
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setLedgerExportError(null);
                void (async () => {
                  try {
                    const body = await loadJson<{ exportedAt: string }>(
                      scopedApi("/api/releases/export", activeInstallId),
                    );
                    const blob = new Blob([JSON.stringify(body, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `nospoilers-releases-${body.exportedAt.slice(0, 10)}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    setLedgerExportError(
                      error instanceof Error ? error.message : "Could not export the release ledger.",
                    );
                  }
                })();
              }}
            >
              Export ledger
            </Button>
            {ledgerExportError ? <p className="mt-2 text-sm text-danger">{ledgerExportError}</p> : null}
          </div>
        ) : null}
        {receiptError ? <p className="mt-3 text-sm text-danger">{receiptError}</p> : null}
        {deliveryError ? <p className="mt-3 text-sm text-danger">{deliveryError}</p> : null}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
        ) : releases.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-white/5">
            {releases.map((release) => (
              <li key={release.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-snow">{release.coordinate}</p>
                    <p className="mt-1 text-xs text-dim">
                      {release.channel}
                      {release.sourceRevision ? ` · ${release.sourceRevision}` : ""}
                      {` · ${release.artifactSha256.slice(0, 12)}`}
                      {release.artifactBytes != null ? ` · ${formatSealedBytes(release.artifactBytes)}` : ""}
                      {release.mediaType ? ` · ${release.mediaType}` : ""}
                      {release.createdAt ? ` · ${release.createdAt.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {release.mismatch ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-danger">
                        digest changed
                      </span>
                    ) : null}
                    {receiptStatusMark(release.receiptStatus)}
                    {release.approval?.decision === "approved" ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                        approved to ship
                      </span>
                    ) : null}
                    {release.approval?.decision === "rejected" ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-danger">
                        rejected
                      </span>
                    ) : null}
                    {release.legalHold?.active ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-snow">
                        legal hold
                      </span>
                    ) : null}
                    {!release.mismatch && !release.receiptStatus ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">sealed</span>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={downloadingReceiptId === release.receiptId}
                      onClick={() => {
                        setReceiptError(null);
                        setDownloadingReceiptId(release.receiptId);
                        void (async () => {
                          try {
                            const body = await loadJson<{ receipt: unknown; id: number }>(
                              `/api/receipts/${release.receiptId}`,
                            );
                            const blob = new Blob([`${JSON.stringify(body.receipt, null, 2)}\n`], {
                              type: "application/json",
                            });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            const safe = release.coordinate.replace(/[^a-zA-Z0-9._@+-]+/g, "-").slice(0, 80);
                            link.download = `nospoilers-receipt-${safe || "artifact"}-${body.id}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                          } catch (error) {
                            setReceiptError(
                              error instanceof Error ? error.message : "Could not download that receipt.",
                            );
                          } finally {
                            setDownloadingReceiptId(null);
                          }
                        })();
                      }}
                    >
                      {downloadingReceiptId === release.receiptId ? "Saving…" : "Receipt JSON"}
                    </Button>
                  </div>
                </div>
                {(release.locations ?? []).length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {(release.locations ?? []).map((location) => (
                      <li key={location.id} className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 font-mono text-xs text-mute">
                          {location.url}
                          {location.lastStatus ? ` · ${location.lastStatus.replace("_", " ")}` : ""}
                          {location.lastSha256 ? ` · ${location.lastSha256.slice(0, 12)}` : ""}
                          {location.lastRedirectHosts
                            ? ` · ${location.lastRedirectHosts.split(",").join(" → ")}`
                            : ""}
                          {location.lastRegion ? ` · ${location.lastRegion}` : ""}
                          {location.lastCacheState ? ` · ${location.lastCacheState}` : ""}
                        </p>
                        {!previewing && installAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={locked || verifyingLocationId === location.id}
                            onClick={() => {
                              setDeliveryError(null);
                              setVerifyingLocationId(location.id);
                              void (async () => {
                                try {
                                  const response = await fetch(
                                    `/api/releases/${release.id}/locations/${location.id}/verify`,
                                    {
                                      method: "POST",
                                      credentials: "include",
                                      headers: { "content-type": "application/json" },
                                      body: JSON.stringify({ installationId: activeInstallId }),
                                    },
                                  );
                                  const body = (await response.json()) as { error?: string };
                                  if (!response.ok) {
                                    throw new Error(body.error ?? "Could not verify that URL.");
                                  }
                                  await refreshSignedIn(selectedInstallId);
                                } catch (error) {
                                  setDeliveryError(
                                    error instanceof Error ? error.message : "Could not verify that URL.",
                                  );
                                } finally {
                                  setVerifyingLocationId(null);
                                }
                              })();
                            }}
                          >
                            {verifyingLocationId === location.id ? "Verifying…" : "Verify now"}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!previewing && installAdmin ? (
                  <form
                    className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (locked || attachingReleaseId === release.id) return;
                      setDeliveryError(null);
                      setAttachingReleaseId(release.id);
                      void (async () => {
                        try {
                          const response = await fetch(`/api/releases/${release.id}/locations`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              url: deliveryUrlByRelease[release.id] ?? "",
                              installationId: activeInstallId,
                            }),
                          });
                          const body = (await response.json()) as { error?: string };
                          if (!response.ok) {
                            throw new Error(body.error ?? "Could not attach that URL.");
                          }
                          setDeliveryUrlByRelease((current) => ({ ...current, [release.id]: "" }));
                          await refreshSignedIn(selectedInstallId);
                        } catch (error) {
                          setDeliveryError(
                            error instanceof Error ? error.message : "Could not attach that URL.",
                          );
                        } finally {
                          setAttachingReleaseId(null);
                        }
                      })();
                    }}
                  >
                    <label className="min-w-0 flex-1">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                        Delivery URL
                      </span>
                      <input
                        value={deliveryUrlByRelease[release.id] ?? ""}
                        onChange={(event) =>
                          setDeliveryUrlByRelease((current) => ({
                            ...current,
                            [release.id]: event.target.value,
                          }))
                        }
                        placeholder="https://cdn.example.com/app.tgz"
                        autoComplete="off"
                        spellCheck={false}
                        disabled={locked}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={locked || attachingReleaseId === release.id}
                    >
                      {attachingReleaseId === release.id ? "Attaching…" : "Attach URL"}
                    </Button>
                  </form>
                ) : null}
                {release.approval ? (
                  <p className="mt-2 text-xs text-mute">
                    {release.approval.decision === "approved" ? "Approved" : "Rejected"} by{" "}
                    {release.approval.actorLogin}
                    {release.approval.reason ? ` · ${release.approval.reason}` : ""}
                  </p>
                ) : null}
                {release.legalHold?.active ? (
                  <p className="mt-1 text-xs text-mute">
                    Legal hold by {release.legalHold.actorLogin}
                    {release.legalHold.reason ? ` · ${release.legalHold.reason}` : ""}
                  </p>
                ) : null}
                {release.publicPage?.enabled ? (
                  <p className="mt-2 text-xs text-mute">
                    Public verification{" "}
                    <a href={release.publicPage.path} className="text-snow underline-offset-2 hover:underline">
                      {release.publicPage.path}
                    </a>
                  </p>
                ) : null}
                {canPublishVerify ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {release.publicPage?.enabled ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          beginConfirm({
                            kind: "release-unpublish",
                            id: release.id,
                            expected: release.coordinate,
                          })
                        }
                      >
                        Unpublish verification
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          beginConfirm({
                            kind: "release-publish",
                            id: release.id,
                            expected: release.coordinate,
                          })
                        }
                      >
                        Publish verification
                      </Button>
                    )}
                    {confirmForm(
                      (confirming?.kind === "release-publish" ||
                        confirming?.kind === "release-unpublish") &&
                        confirming.id === release.id,
                    )}
                  </div>
                ) : null}
                {canGovernReleases ? (
                  <div className="mt-3 max-w-xl">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                        Approval or hold reason
                      </span>
                      <input
                        value={governanceReasonByRelease[release.id] ?? ""}
                        onChange={(event) =>
                          setGovernanceReasonByRelease((current) => ({
                            ...current,
                            [release.id]: event.target.value,
                          }))
                        }
                        placeholder="Why this revision may ship, is rejected, or is held."
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                        onClick={() =>
                          beginConfirm({
                            kind: "release-approve",
                            id: release.id,
                            expected: release.coordinate,
                            reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                          })
                        }
                      >
                        Approve to ship
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                        onClick={() =>
                          beginConfirm({
                            kind: "release-reject",
                            id: release.id,
                            expected: release.coordinate,
                            reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                          })
                        }
                      >
                        Reject
                      </Button>
                      {release.legalHold?.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                          onClick={() =>
                            beginConfirm({
                              kind: "release-hold-release",
                              id: release.id,
                              expected: release.coordinate,
                              reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                            })
                          }
                        >
                          Release hold
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={(governanceReasonByRelease[release.id] ?? "").trim().length < 8}
                          onClick={() =>
                            beginConfirm({
                              kind: "release-hold",
                              id: release.id,
                              expected: release.coordinate,
                              reason: (governanceReasonByRelease[release.id] ?? "").trim(),
                            })
                          }
                        >
                          Legal hold
                        </Button>
                      )}
                    </div>
                    {confirmForm(
                      (confirming?.kind === "release-approve" ||
                        confirming?.kind === "release-reject" ||
                        confirming?.kind === "release-hold" ||
                        confirming?.kind === "release-hold-release") &&
                        confirming.id === release.id,
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Allowlist and baseline</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          Exceptions are exact-rule, attributable, and they expire. They never suppress a different
          rule. Approve a packed receipt as the shipping baseline; later diffs use that receipt
          instead of whichever scan happened last.
        </p>
        {!previewing && installAdmin && (
          <label className="mt-6 block max-w-xl">
            <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Baseline reason</span>
            <input
              value={baselineReason}
              onChange={(event) => setBaselineReason(event.target.value)}
              disabled={locked}
              className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
            />
          </label>
        )}
        {!previewing && installAdmin && (
          <form
            className="mt-6 grid gap-4 md:grid-cols-[7rem_1fr_1fr_8rem_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (locked || savingAllow) return;
              setPackageError(null);
              setSavingAllow(true);
              void (async () => {
                try {
                  const response = await fetch("/api/exceptions", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      installationId: activeInstallId,
                      rule: allowRule,
                      path: allowPath,
                      reason: allowReason,
                      expires: allowExpires,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not save allowlist entry.");
                  setAllowRule("");
                  setAllowPath("");
                  setAllowReason("");
                  await refreshSignedIn(selectedInstallId);
                } catch (error) {
                  setPackageError(
                    error instanceof Error ? error.message : "Could not save allowlist entry.",
                  );
                } finally {
                  setSavingAllow(false);
                }
              })();
            }}
          >
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Rule</span>
              <input
                value={allowRule}
                onChange={(event) => setAllowRule(event.target.value)}
                placeholder="SRC-001"
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Path glob</span>
              <input
                value={allowPath}
                onChange={(event) => setAllowPath(event.target.value)}
                placeholder="**/*.d.ts"
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Reason</span>
              <input
                value={allowReason}
                onChange={(event) => setAllowReason(event.target.value)}
                placeholder="Published TypeScript types"
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Expires</span>
              <input
                type="date"
                value={allowExpires}
                onChange={(event) => setAllowExpires(event.target.value)}
                disabled={locked}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none focus:border-white/40"
              />
            </label>
            <Button type="submit" disabled={locked || savingAllow || !allowRule.trim() || !allowReason.trim()}>
              {savingAllow ? "Saving…" : "Allow"}
            </Button>
          </form>
        )}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Sign in to manage allowlist entries on your installations. Preview does not invent
            packages or exceptions.
          </p>
        ) : exceptions.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No active allowlist entries.</p>
        ) : (
          <ul className="mt-6 divide-y divide-white/5">
            {exceptions.map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-snow">
                    {entry.rule}
                    {entry.pathPattern ? `  ${entry.pathPattern}` : "  *"}
                  </p>
                  <p className="mt-1 text-xs text-dim">
                    {entry.reason} · {entry.actorLogin} · expires{" "}
                    {entry.expiresAt.slice(0, 10)}
                    {entry.active ? "" : " · expired"}
                  </p>
                </div>
                {installAdmin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={locked || confirmBusy}
                  onClick={() =>
                    beginConfirm({
                      kind: "exception",
                      id: entry.id,
                      expected: entry.rule,
                    })
                  }
                >
                  Revoke
                </Button>
                ) : null}
                </div>
                {confirmForm(confirming?.kind === "exception" && confirming.id === entry.id)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
