import type { Finding } from "../report-types.ts";
import type { DeskAlert } from "./verdict.ts";

export type SourceKind = "github" | "npm" | "website" | "map";
export type SourceAttention = "critical" | "warning" | "ok" | "unknown";

export type WatchSourceViewModel = {
  key: string;
  id: number;
  kind: SourceKind;
  kindLabel: string;
  name: string;
  coordinate: string;
  status: string;
  attention: SourceAttention;
  digest: string | null;
  lastCheckedAt: string | null;
  detail: string;
  alertCount: number;
  primaryAction: string;
};

type RepoInput = {
  id: number;
  full_name: string;
  private: boolean;
  last_checked_at: string | null;
};

type PackageInput = {
  id: number;
  package_name: string;
  registry_origin?: string;
  last_version: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scan_status: string | null;
};

type OriginInput = {
  id: number;
  origin_url: string;
  host: string;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scan_status: string | null;
  last_public_map?: boolean;
  verification?: { verifiedAt: string | null } | null;
  deployTokenPrefix?: string | null;
};

type MapInput = {
  id: number;
  kind: "sentry" | "bugsnag";
  host: string;
  orgSlug: string | null;
  projectSlug: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};

function scanAttention(status: string | null): SourceAttention {
  if (!status) return "unknown";
  const value = status.toLowerCase();
  if (value.includes("fail") || value.includes("exposed") || value.includes("mismatch")) return "critical";
  if (value.includes("queue") || value.includes("pending") || value.includes("warn")) return "warning";
  return "ok";
}

export function buildSourceViewModels(input: {
  repos: RepoInput[];
  packages: PackageInput[];
  origins: OriginInput[];
  maps: MapInput[];
  alerts?: DeskAlert[];
}): WatchSourceViewModel[] {
  const openAlerts = (input.alerts ?? []).filter((alert) => !alert.resolved_at);
  const alertCountFor = (values: string[]): number =>
    openAlerts.filter((alert) => {
      const coordinates = [
        alert.full_name,
        ...(alert.findings ?? []).map((finding) => finding.path),
      ].filter((value): value is string => Boolean(value));
      return values.some((value) =>
        coordinates.some(
          (coordinate) =>
            coordinate === value ||
            coordinate.startsWith(`${value}@`) ||
            coordinate.includes(value),
        ),
      );
    }).length;
  const attentionFor = (values: string[], fallback: SourceAttention): SourceAttention =>
    alertCountFor(values) > 0 ? "critical" : fallback;

  return [
    ...input.repos.map((repo): WatchSourceViewModel => ({
      key: `repo-${repo.id}`,
      id: repo.id,
      kind: "github",
      kindLabel: "GitHub exposure",
      name: repo.full_name,
      coordinate: repo.full_name,
      status: repo.private ? "private" : "public",
      attention: attentionFor([repo.full_name], repo.private ? (repo.last_checked_at ? "ok" : "unknown") : "critical"),
      digest: null,
      lastCheckedAt: repo.last_checked_at,
      detail: repo.last_checked_at ? "repository visibility monitor" : "visibility monitor · check needed",
      alertCount: alertCountFor([repo.full_name]),
      primaryAction: repo.last_checked_at ? "Open repository" : "Check visibility",
    })),
    ...input.packages.map((pkg): WatchSourceViewModel => ({
      key: `npm-${pkg.id}`,
      id: pkg.id,
      kind: "npm",
      kindLabel: "Published artifact",
      name: pkg.package_name,
      coordinate: pkg.last_version ? `${pkg.package_name}@${pkg.last_version}` : pkg.package_name,
      status: pkg.last_scan_status ?? (pkg.last_checked_at ? "checked" : "check needed"),
      attention: attentionFor(
        [pkg.package_name, pkg.last_version ? `${pkg.package_name}@${pkg.last_version}` : ""],
        scanAttention(pkg.last_scan_status),
      ),
      digest: pkg.last_sha256,
      lastCheckedAt: pkg.last_checked_at,
      detail: pkg.registry_origin ?? "https://registry.npmjs.org",
      alertCount: alertCountFor([
        pkg.package_name,
        pkg.last_version ? `${pkg.package_name}@${pkg.last_version}` : "",
      ]),
      primaryAction: pkg.last_checked_at ? "Check package" : "Run first check",
    })),
    ...input.origins.map((origin): WatchSourceViewModel => ({
      key: `web-${origin.id}`,
      id: origin.id,
      kind: "website",
      kindLabel: "Production web",
      name: origin.origin_url,
      coordinate: origin.host,
      status: !origin.verification?.verifiedAt
        ? "verification required"
        : origin.last_public_map
          ? "public map found"
          : origin.last_scan_status ?? "check needed",
      attention: attentionFor(
        [origin.origin_url, origin.host],
        !origin.verification?.verifiedAt
          ? "warning"
          : origin.last_public_map
            ? "critical"
            : scanAttention(origin.last_scan_status),
      ),
      digest: origin.last_sha256,
      lastCheckedAt: origin.last_checked_at,
      detail: origin.verification?.verifiedAt
        ? `verified production web${origin.deployTokenPrefix ? " · deploy trigger ready" : ""}`
        : "prove domain control before automatic scans",
      alertCount: alertCountFor([origin.origin_url, origin.host]),
      primaryAction: origin.verification?.verifiedAt
        ? origin.last_checked_at
          ? "Scan website again"
          : "Scan website"
        : "Verify domain",
    })),
    ...input.maps.map((map): WatchSourceViewModel => ({
      key: `map-${map.id}`,
      id: map.id,
      kind: "map",
      kindLabel: "Private map custody",
      name: `${map.kind} · ${map.orgSlug ? `${map.orgSlug}/` : ""}${map.projectSlug}`,
      coordinate: map.host,
      status: map.lastStatus ?? "check needed",
      attention: map.lastError ? "critical" : scanAttention(map.lastStatus),
      digest: null,
      lastCheckedAt: map.lastCheckedAt,
      detail: map.lastError ?? "private map upload proof",
      alertCount: alertCountFor([map.host, map.projectSlug]),
      primaryAction: map.lastCheckedAt ? "Check custody" : "Verify custody",
    })),
  ];
}

export function filterSourceViewModels(
  sources: WatchSourceViewModel[],
  kind: SourceKind | "all",
  attentionOnly: boolean,
): WatchSourceViewModel[] {
  return sources.filter(
    (source) =>
      (kind === "all" || source.kind === kind) &&
      (!attentionOnly || source.attention === "critical" || source.attention === "warning"),
  );
}

export type SetupProof = "covered" | "open" | "check-needed" | "unknown";

export type SetupStepViewModel = {
  key: "visibility" | "release-assets" | "workflow-check" | "registry" | "production";
  label: string;
  summary: string;
  proof: SetupProof;
  action: string;
};

type SetupProbe = {
  status: "ready" | "error";
  facts?: {
    actionOnDefault: boolean;
    workflowOnDefault: boolean;
    check: { conclusion: string | null } | null;
    requiredCheck: "unknown";
  };
};

export type WatchSetupViewModel = {
  done: number;
  total: 5;
  steps: SetupStepViewModel[];
  next: SetupStepViewModel | null;
};

export function buildSetupViewModel(input: {
  repos: RepoInput[];
  releases: { id: number }[];
  setupProbes: Record<number, SetupProbe>;
  packages: PackageInput[];
  origins: OriginInput[];
  maps: MapInput[];
}): WatchSetupViewModel {
  const repoCount = input.repos.length;
  const visibilityChecked = input.repos.some((repo) => Boolean(repo.last_checked_at));
  const probes = Object.values(input.setupProbes);
  const readyProbes = probes.filter((probe) => probe.status === "ready" && probe.facts);
  const workflowCovered = readyProbes.some(
    (probe) =>
      probe.facts?.actionOnDefault &&
      probe.facts.workflowOnDefault &&
      Boolean(probe.facts.check),
  );
  const workflowKnownOpen =
    readyProbes.length > 0 &&
    !workflowCovered;
  const workflowProbeFailed = probes.some((probe) => probe.status === "error");
  const registryChecked = input.packages.some(
    (pkg) => Boolean(pkg.last_checked_at || pkg.last_version || pkg.last_sha256),
  );
  const originChecked = input.origins.some((origin) => Boolean(origin.last_checked_at));
  const publicMapFound = input.origins.some((origin) => origin.last_public_map === true);
  const mapVerified = input.maps.some((map) => {
    const status = (map.lastStatus ?? "").toLowerCase();
    return Boolean(map.lastCheckedAt) && !map.lastError && (status.includes("verified") || status.includes("match"));
  });
  const productionCovered = originChecked && (!publicMapFound || mapVerified);

  const steps: SetupStepViewModel[] = [
    {
      key: "visibility",
      label: "Watch GitHub visibility",
      summary: visibilityChecked
        ? `${repoCount} ${repoCount === 1 ? "repository has" : "repositories have"} visibility evidence`
        : repoCount
          ? "Repository connected; run a visibility check for proof"
        : "Install on at least one repository",
      proof: visibilityChecked ? "covered" : repoCount ? "check-needed" : "open",
      action: "Install on GitHub",
    },
    {
      key: "release-assets",
      label: "Read GitHub release assets",
      summary: input.releases.length
        ? `${input.releases.length} sealed ${input.releases.length === 1 ? "revision" : "revisions"}`
        : repoCount
          ? "No sealed release receipt yet"
          : "Connect a repository first",
      proof: input.releases.length ? "covered" : repoCount ? "check-needed" : "open",
      action: "Scan a release",
    },
    {
      key: "workflow-check",
      label: "Run the packed-artifact workflow and check",
      summary: workflowCovered
        ? "Action, workflow, and a check run found · required status is unknown"
        : workflowKnownOpen
          ? "Setup proof is incomplete"
          : workflowProbeFailed
            ? "The last setup proof check failed"
            : repoCount
              ? "Run setup status; repository connection is not proof"
              : "Connect a repository before checking setup",
      proof: workflowCovered
        ? "covered"
        : workflowKnownOpen
          ? "open"
          : workflowProbeFailed
            ? "unknown"
            : repoCount
              ? "check-needed"
              : "open",
      action: "Check setup",
    },
    {
      key: "registry",
      label: "Watch registry tarballs",
      summary: registryChecked
        ? "A registry-served package has been checked"
        : input.packages.length
          ? "First registry check is still needed"
          : "The registry tarball can differ from the release asset",
      proof: registryChecked ? "covered" : input.packages.length ? "check-needed" : "open",
      action: "Connect npm",
    },
    {
      key: "production",
      label: "Crawl production and prove map custody",
      summary: productionCovered
        ? publicMapFound
          ? "Production crawl and private map upload verified"
          : "Production origin checked; no public map found"
        : input.origins.length
          ? publicMapFound
            ? "Public map found — map custody proof needed"
            : "Production crawl has not completed"
          : "No production origin connected",
      proof: productionCovered ? "covered" : input.origins.length ? "check-needed" : "open",
      action: input.origins.length ? "Check production" : "Add origin",
    },
  ];
  const next =
    steps.find((step) => step.proof === "open") ??
    steps.find((step) => step.proof === "check-needed") ??
    steps.find((step) => step.proof === "unknown") ??
    null;
  return { done: steps.filter((step) => step.proof === "covered").length, total: 5, steps, next };
}

export type TimelineSpanViewModel = {
  alertId: number;
  label: string;
  rule: string;
  severity: "critical" | "warning";
  open: boolean;
  startedAt: string;
  endedAt: string | null;
  left: number;
  width: number;
};

export type TimelineLaneViewModel = {
  key: string;
  label: string;
  detail: string;
  spans: TimelineSpanViewModel[];
};

function findingOf(alert: DeskAlert): Finding | null {
  return (alert.findings?.[0] as Finding | undefined) ?? null;
}

function severityFor(rule: string): "critical" | "warning" {
  return /^(MAP|SEC|ENV|KEY|SRC)-/i.test(rule) ? "critical" : "warning";
}

export function buildTimelineLanes(
  alerts: DeskAlert[],
  options: { now?: number; days?: number } = {},
): TimelineLaneViewModel[] {
  const now = options.now ?? Date.now();
  const days = Math.max(1, options.days ?? 7);
  const start = now - days * 86_400_000;
  const range = now - start;
  const lanes = new Map<string, TimelineLaneViewModel>();
  for (const alert of alerts) {
    const opened = Date.parse(alert.created_at);
    const resolved = alert.resolved_at ? Date.parse(alert.resolved_at) : now;
    if (!Number.isFinite(opened) || !Number.isFinite(resolved) || resolved < start || opened > now) continue;
    const finding = findingOf(alert);
    const key = alert.full_name || finding?.path || `alert-${alert.id}`;
    const lane: TimelineLaneViewModel = lanes.get(key) ?? {
      key,
      label: alert.full_name || alert.title,
      detail: finding?.path ?? alert.kind,
      spans: [],
    };
    const clippedStart = Math.max(start, opened);
    const clippedEnd = Math.min(now, Math.max(opened, resolved));
    const rule = finding?.rule ?? alert.kind;
    lane.spans.push({
      alertId: alert.id,
      label: alert.title,
      rule,
      severity: severityFor(rule),
      open: !alert.resolved_at,
      startedAt: new Date(opened).toISOString(),
      endedAt: alert.resolved_at ? new Date(resolved).toISOString() : null,
      left: Math.max(0, Math.min(100, ((clippedStart - start) / range) * 100)),
      width: Math.max(0.8, Math.min(100, ((clippedEnd - clippedStart) / range) * 100)),
    });
    lanes.set(key, lane);
  }
  return [...lanes.values()].sort((left, right) => {
    const leftOpen = left.spans.some((span) => span.open);
    const rightOpen = right.spans.some((span) => span.open);
    return Number(rightOpen) - Number(leftOpen) || left.label.localeCompare(right.label);
  });
}

export type AlertListViewModel = {
  id: number;
  title: string;
  coordinate: string;
  rule: string;
  severity: "critical" | "warning";
  status: "open" | "waiting" | "resolved";
  exposure: string;
};

export function buildAlertListViewModels(
  alerts: DeskAlert[],
  formatExposure: (alert: DeskAlert) => string,
): AlertListViewModel[] {
  return alerts.map((alert) => {
    const finding = findingOf(alert);
    const rule = finding?.rule ?? alert.kind;
    return {
      id: alert.id,
      title: alert.title,
      coordinate: alert.full_name ?? finding?.path ?? alert.kind,
      rule,
      severity: severityFor(rule),
      status: alert.resolved_at ? "resolved" : alert.acknowledged_at ? "waiting" : "open",
      exposure: formatExposure(alert),
    };
  });
}
