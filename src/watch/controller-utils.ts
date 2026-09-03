import type { Confirming, DeskDataset, LoadState, ProtectionImportResult, RetentionDays, SigningPolicyDraft } from "@/watch/types";
import type { WatchSectionState } from "@/watch/data-state";

export function destinationKindLabel(kind: string): string {
  if (kind === "jira") return "Jira";
  if (kind === "siem") return "SIEM";
  if (kind === "pagerduty") return "PagerDuty";
  if (kind === "email") return "Email";
  return "Slack";
}

export function routeMinSeverityLabel(value: string): string {
  if (value === "critical") return "critical only";
  if (value === "warn") return "warn and critical";
  return "all severities";
}

export const SIGNING_POLICY_CONFIRM = "signing-policy";

export const SIGNING_POLICY_CLEAR_CONFIRM = "clear-signing-policy";

export function emptySigningDraft(): SigningPolicyDraft {
  return { requireGithub: false, requireNpm: false, builderPrefix: "", expiresAt: "" };
}

export function parseSigningPolicy(raw: unknown): SigningPolicyDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as {
    requireGithub?: unknown;
    requireNpm?: unknown;
    builderPrefix?: unknown;
    expiresAt?: unknown;
  };
  return {
    requireGithub: row.requireGithub === true,
    requireNpm: row.requireNpm === true,
    builderPrefix: typeof row.builderPrefix === "string" ? row.builderPrefix : "",
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : "",
  };
}

export function parseRetentionDays(raw: unknown): RetentionDays | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (value === 0 || value === 90 || value === 180 || value === 365) return value;
  return null;
}

export function retentionConfirmToken(days: RetentionDays): string {
  return days === 0 ? "keep" : String(days);
}

export function confirmActionLabel(row: Confirming): string {
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
    case "signing-policy-save":
      return "save this signing policy";
    case "signing-policy-clear":
      return "clear this signing policy";
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
    case "release-attest":
      return "refresh GitHub and npm attestations for this release";
    case "identity-evidence":
      return "assemble identity evidence for this package";
    case "identity-publish-advisory":
      return "publish a consumer advisory for this package";
    case "identity-unpublish-advisory":
      return "unpublish this consumer advisory";
    case "namespace-unprotect":
      return "stop watching this npm scope";
  }
}

export function formatSealedBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function protectionImportStatusLabel(status: ProtectionImportResult["status"]): string {
  if (status === "already_protected") return "already protected";
  if (status === "not_owned") return "not owned";
  if (status === "not_found") return "not on the registry";
  if (status === "invalid") return "invalid name";
  if (status === "watch_cap") return "watch cap";
  return "protected";
}

export const LOADING_DATASETS: Record<DeskDataset, WatchSectionState> = {
  maps: { status: "loading" },
  releases: { status: "loading" },
  jobs: { status: "loading" },
  notifications: { status: "loading" },
};

export function sectionStateOf<T>(state: LoadState<T>): WatchSectionState {
  return state.status === "error"
    ? { status: "error", message: state.message }
    : { status: state.status };
}

export function installIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("install");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function formatExposure(ms: number | undefined, createdAt: string, resolvedAt: string | null | undefined): string {
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

export function kindLabel(kind: string): string {
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

export function defaultExpiryDate(): string {
  const when = new Date();
  when.setUTCDate(when.getUTCDate() + 90);
  return when.toISOString().slice(0, 10);
}
