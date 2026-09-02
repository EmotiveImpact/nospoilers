import { coverageFrom, type Coverage } from "../coverage.ts";
import type { Finding } from "../scanner/types.ts";

export const MAX_NOTIFICATION_ROUTES = 20;

export type RouteMinSeverity = "all" | "warn" | "critical";
export type AlertSeverity = "info" | "warn" | "critical";

export type NotificationRouteRow = {
  id: number;
  installationId: number;
  destinationId: number;
  minSeverity: RouteMinSeverity;
  repoFullName: string | null;
  packageName: string | null;
  teamLogin: string | null;
  createdAt: string;
};

export type RouteSample = {
  severity: AlertSeverity;
  repoFullName: string | null;
  packageName: string | null;
};

const CRITICAL_KINDS = new Set([
  "repo_publicized",
  "repo_created_public",
  "repo_transferred",
  "member_added",
  "push_sensitive_path",
  "app_suspended",
  "package_maintainer_changed",
  "package_repository_mismatch",
  "package_unpublished",
  "release_digest_mismatch",
  "identity_lookalike_registered",
  "identity_dormant",
]);

const REPO_FULL_NAME_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const PACKAGE_NAME_RE = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;
const TEAM_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function parseRouteMinSeverity(raw: unknown): RouteMinSeverity | null {
  return raw === "all" || raw === "warn" || raw === "critical" ? raw : null;
}

export function parseRouteSampleSeverity(raw: unknown): AlertSeverity | null {
  return raw === "info" || raw === "warn" || raw === "critical" ? raw : null;
}

export function parseRouteRepoFullName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 200 || value.includes("..") || value.includes("\\")) return null;
  if (!REPO_FULL_NAME_RE.test(value)) return null;
  return value;
}

export function parseRoutePackageName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 214 || value.includes("..") || /\s/.test(value)) return null;
  if (!PACKAGE_NAME_RE.test(value)) return null;
  return value;
}

export function parseGithubLogin(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!TEAM_LOGIN_RE.test(value)) return null;
  return value;
}

export function githubLoginKey(login: string): string {
  return login.trim().toLowerCase();
}

export function parseRouteTeamLogin(raw: string): string | null {
  return parseGithubLogin(raw);
}

export function alertSeverity(input: { kind: string; findings?: Finding[] }): AlertSeverity {
  if (input.findings?.some((row) => row.severity === "critical")) return "critical";
  if (CRITICAL_KINDS.has(input.kind)) return "critical";
  if (input.findings?.some((row) => row.severity === "warn")) return "warn";
  if (input.kind.startsWith("package_") || input.kind.startsWith("identity_") || input.kind === "app_unsuspended") return "warn";
  if (
    input.kind === "fork" ||
    input.kind === "npm_dist_tag" ||
    input.kind === "release_unpublished" ||
    input.kind === "release_deleted"
  ) {
    return "warn";
  }
  return "info";
}

export function severityMatches(min: RouteMinSeverity, actual: AlertSeverity): boolean {
  if (min === "all") return true;
  if (min === "warn") return actual === "warn" || actual === "critical";
  return actual === "critical";
}

export function routeMatches(rule: NotificationRouteRow, sample: RouteSample): boolean {
  if (!severityMatches(rule.minSeverity, sample.severity)) return false;
  if (
    rule.repoFullName &&
    rule.repoFullName.toLowerCase() !== (sample.repoFullName ?? "").toLowerCase()
  ) {
    return false;
  }
  if (rule.packageName && rule.packageName !== sample.packageName) return false;
  return true;
}

export function destinationReceives(
  routesForDestination: NotificationRouteRow[],
  sample: RouteSample,
): boolean {
  if (routesForDestination.length === 0) return true;
  return routesForDestination.some((rule) => routeMatches(rule, sample));
}

export function matchingRoutes(
  routes: NotificationRouteRow[],
  destinationId: number,
  sample: RouteSample,
): NotificationRouteRow[] {
  return routes.filter((rule) => rule.destinationId === destinationId && routeMatches(rule, sample));
}

export function routingPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to route alerts.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "Alert routing is on Team.", status: 403 };
  }
  return null;
}

export function routingPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return routingPlanDenied(coverageFrom(trialEndsAt, plan));
}
