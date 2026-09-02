export function formatExposure(
  ms: number | undefined,
  createdAt: string,
  resolvedAt: string | null | undefined,
): string {
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

export function alertStatusLabel(alert: {
  resolved_at?: string | null;
  acknowledged_at?: string | null;
}): "resolved" | "acknowledged" | "open" {
  if (alert.resolved_at) return "resolved";
  if (alert.acknowledged_at) return "acknowledged";
  return "open";
}

export function leadFinding(alert: {
  findings?: { rule: string; path: string }[] | null;
}): { rule: string; path: string } | null {
  const first = alert.findings?.[0];
  return first ? { rule: first.rule, path: first.path } : null;
}
