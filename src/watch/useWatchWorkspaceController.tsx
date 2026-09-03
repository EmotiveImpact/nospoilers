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
import { WatchCommandPalette } from "@/components/WatchCommandPalette.tsx";
import { WatchAlertsWorkspace } from "@/components/WatchAlertsWorkspace.tsx";
import { WatchMonolithShell } from "@/components/WatchMonolithShell.tsx";
import { WatchNotificationSummary } from "@/components/WatchNotificationSummary.tsx";
import { WatchOverview } from "@/components/WatchOverview.tsx";
import { WatchSourcesSummary } from "@/components/WatchSourcesSummary.tsx";
import { WatchRouteContent } from "@/components/watch/WatchRouteContent.tsx";
import { AuditScreen } from "@/components/watch/screens/AuditScreen.tsx";
import { RetentionScreen } from "@/components/watch/screens/RetentionScreen.tsx";
import { TimelineScreen } from "@/components/watch/screens/TimelineScreen.tsx";
import {
  WatchSectionError,
  WatchSkeleton,
} from "@/components/WatchDataState.tsx";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { coverageFrom, coverageFromQuery, type Coverage } from "@/coverage.ts";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import { PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts";
import {
  loadWatchJson as loadJson,
  loadWatchResources,
  scopedWatchApi as scopedApi,
} from "@/watch/api.ts";
import { watchHref, watchPath } from "@/watch/routes.ts";
import { useWatchDeskController } from "@/watch/useWatchDeskController.ts";
import type {
  Me,
  Repo,
  Alert,
  AlertEvent,
  WatchedPackage,
  WatchedOrigin,
  MapCustodyDestination,
  NpmRegistry,
  NotificationDestination,
  NotificationDelivery,
  NotificationRoute,
  TeamMember,
  TeamInvite,
  TimelineEntry,
  TimelineView,
  AuditRow,
  AuditView,
  RetentionDays,
  RetentionView,
  SigningPolicyDraft,
  SigningPolicyView,
  IdentityCandidateView,
  IdentitySignalsView,
  IdentityEvidenceView,
  IdentityRiskView,
  ProtectedNamespace,
  Confirming,
  ScanApiToken,
  ReleaseRevision,
  PackageProtection,
  ProtectionImportResult,
  TenantJob,
  JobSummary,
  FairUseStatus,
  ReleaseDiffView,
  PolicyExceptionView,
  BaselineView,
  LoadState,
  DeskDataset,
  SetupPrView,
  RemediationPrView,
  GithubResponseView,
  SetupStatusView,
} from "@/watch/types.ts";
import {
  combineWatchSectionStates,
  type WatchSectionState,
} from "@/watch/data-state.ts";
import { useCallback, useEffect, useState } from "react";
import {
  destinationKindLabel,
  routeMinSeverityLabel,
  SIGNING_POLICY_CONFIRM,
  SIGNING_POLICY_CLEAR_CONFIRM,
  emptySigningDraft,
  parseSigningPolicy,
  parseRetentionDays,
  retentionConfirmToken,
  confirmActionLabel,
  formatSealedBytes,
  receiptStatusMark,
  protectionImportStatusLabel,
  LOADING_DATASETS,
  sectionStateOf,
  TypeToConfirm,
  installIdFromSearch,
  formatExposure,
  kindLabel,
  defaultExpiryDate,
  SetupStatusResult,
  SetupPrResult,
  RemediationPrResult,
  GithubResponseResult,
  AlertDeskItem,
} from "@/watch/WatchControllerSupport";

export function useWatchWorkspaceController({ path = "/watch", search }: { path?: string; search: string }) {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" });
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" });
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" });
  const [packages, setPackages] = useState<LoadState<{ packages: WatchedPackage[] }>>({
    status: "loading",
  });
  const [origins, setOrigins] = useState<LoadState<{ origins: WatchedOrigin[] }>>({
    status: "loading",
  });
  const [datasetState, setDatasetState] =
    useState<Record<DeskDataset, WatchSectionState>>(LOADING_DATASETS);
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
  const [emailAddress, setEmailAddress] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
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
  const [attestationError, setAttestationError] = useState<string | null>(null);
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
  const [retention, setRetention] = useState<RetentionView>({ status: "loading" });
  const [retentionDraft, setRetentionDraft] = useState<RetentionDays>(90);
  const [signingPolicy, setSigningPolicy] = useState<SigningPolicyView>({ status: "loading" });
  const [signingDraft, setSigningDraft] = useState<SigningPolicyDraft>({
    requireGithub: false,
    requireNpm: false,
    builderPrefix: "",
    expiresAt: "",
  });
  const [signingError, setSigningError] = useState<string | null>(null);
  const [identitySignals, setIdentitySignals] = useState<IdentitySignalsView>({ status: "loading" });
  const [candidatesByPackage, setCandidatesByPackage] = useState<Record<number, IdentityCandidateView[]>>(
    {},
  );
  const [evidenceByPackage, setEvidenceByPackage] = useState<Record<number, IdentityEvidenceView | null>>(
    {},
  );
  const [riskByPackage, setRiskByPackage] = useState<Record<number, IdentityRiskView | null>>({});
  const [downloadingEvidenceId, setDownloadingEvidenceId] = useState<number | null>(null);
  const [namespaces, setNamespaces] = useState<ProtectedNamespace[]>([]);
  const [namespaceScope, setNamespaceScope] = useState("");
  const [namespaceError, setNamespaceError] = useState<string | null>(null);
  const [savingNamespace, setSavingNamespace] = useState(false);
  const [checkingNamespaceId, setCheckingNamespaceId] = useState<number | null>(null);
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [billing, setBilling] = useState<{
    stripe: boolean;
    hasCustomer: boolean;
    subscribed: boolean;
  } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const refreshSignedIn = useCallback(async (installationId: number | null) => {
    setRepos({ status: "loading" });
    setAlerts({ status: "loading" });
    setPackages({ status: "loading" });
    setOrigins({ status: "loading" });
    setDatasetState({ ...LOADING_DATASETS });
    setTimeline({ status: "loading" });
    setAudit({ status: "loading" });
    setRetention({ status: "loading" });
    setSigningPolicy({ status: "loading" });
    setIdentitySignals({ status: "loading" });
    try {
      const q = (path: string) => scopedApi(path, installationId);
      const loaded = await loadWatchResources({
        repos: () => loadJson<{ repos: Repo[] }>(q("/api/repos")),
        alerts: () => loadJson<{ alerts: Alert[] }>(q("/api/alerts")),
        packages: () => loadJson<{ packages: WatchedPackage[] }>(q("/api/packages")),
        origins: () => loadJson<{ origins: WatchedOrigin[] }>(q("/api/origins")),
        exceptions: () => loadJson<{ exceptions: PolicyExceptionView[] }>(q("/api/exceptions")),
        registries: () => loadJson<{ registries: NpmRegistry[] }>(q("/api/registries")),
        destinations: () => loadJson<{ destinations: NotificationDestination[] }>(q("/api/destinations")),
        deliveries: () => loadJson<{ deliveries: NotificationDelivery[] }>(q("/api/destinations/deliveries")),
        routes: () => loadJson<{ routes: NotificationRoute[] }>(q("/api/destinations/routes")),
        tokens: () => loadJson<{ tokens: ScanApiToken[] }>(q("/api/scan-tokens")),
        releases: () => loadJson<{ releases: ReleaseRevision[] }>(q("/api/releases")),
        protections: () => loadJson<{ protections: PackageProtection[] }>(q("/api/protections")),
        jobs: () => loadJson<{ jobs: TenantJob[]; summary: JobSummary; fairUse?: FairUseStatus }>(q("/api/jobs")),
        maps: () => loadJson<{ destinations: MapCustodyDestination[] }>(q("/api/map-destinations")),
      });
      const failureMessage = (result: PromiseRejectedResult) =>
        result.reason instanceof Error ? result.reason.message : "Could not load.";
      const repoBody = loaded.repos.status === "fulfilled" ? loaded.repos.value : { repos: [] };
      const alertBody = loaded.alerts.status === "fulfilled" ? loaded.alerts.value : { alerts: [] };
      const packageBody = loaded.packages.status === "fulfilled" ? loaded.packages.value : { packages: [] };
      const originBody = loaded.origins.status === "fulfilled" ? loaded.origins.value : { origins: [] };
      const exceptionBody = loaded.exceptions.status === "fulfilled" ? loaded.exceptions.value : { exceptions: [] };
      const registryBody = loaded.registries.status === "fulfilled" ? loaded.registries.value : { registries: [] };
      const destinationBody = loaded.destinations.status === "fulfilled" ? loaded.destinations.value : { destinations: [] };
      const deliveryBody = loaded.deliveries.status === "fulfilled" ? loaded.deliveries.value : { deliveries: [] };
      const routeBody = loaded.routes.status === "fulfilled" ? loaded.routes.value : { routes: [] };
      const tokenBody = loaded.tokens.status === "fulfilled" ? loaded.tokens.value : { tokens: [] };
      const releaseBody = loaded.releases.status === "fulfilled" ? loaded.releases.value : { releases: [] };
      const protectionBody = loaded.protections.status === "fulfilled" ? loaded.protections.value : { protections: [] };
      const jobBody =
        loaded.jobs.status === "fulfilled"
          ? loaded.jobs.value
          : { jobs: [], summary: { queued: 0, running: 0, done: 0, failed: 0 }, fairUse: null };
      const mapBody = loaded.maps.status === "fulfilled" ? loaded.maps.value : { destinations: [] };
      setRepos(
        loaded.repos.status === "fulfilled"
          ? { status: "ready", data: repoBody }
          : { status: "error", message: failureMessage(loaded.repos) },
      );
      setAlerts(
        loaded.alerts.status === "fulfilled"
          ? { status: "ready", data: alertBody }
          : { status: "error", message: failureMessage(loaded.alerts) },
      );
      setPackages(
        loaded.packages.status === "fulfilled"
          ? { status: "ready", data: packageBody }
          : { status: "error", message: failureMessage(loaded.packages) },
      );
      setOrigins(
        loaded.origins.status === "fulfilled"
          ? { status: "ready", data: originBody }
          : { status: "error", message: failureMessage(loaded.origins) },
      );
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
      const resultState = (result: PromiseSettledResult<unknown>): WatchSectionState =>
        result.status === "fulfilled"
          ? { status: "ready" }
          : { status: "error", message: failureMessage(result) };
      const notificationFailures = [
        loaded.destinations,
        loaded.deliveries,
        loaded.routes,
      ].filter((result): result is PromiseRejectedResult => result.status === "rejected");
      setDatasetState({
        maps: resultState(loaded.maps),
        releases: resultState(loaded.releases),
        jobs: resultState(loaded.jobs),
        notifications: notificationFailures.length
          ? {
              status: "error",
              message: notificationFailures.map(failureMessage).join(" "),
            }
          : { status: "ready" },
      });
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
      const signingResponse = await fetch(q("/api/signing-policy"), { credentials: "include" });
      const signingBody = (await signingResponse.json()) as {
        error?: string;
        policy?: unknown;
      };
      if (signingResponse.status === 402) {
        setSigningPolicy({ status: "ended" });
        setSigningDraft(emptySigningDraft());
      } else if (signingResponse.status === 403) {
        setSigningPolicy({ status: "solo" });
        setSigningDraft(emptySigningDraft());
      } else if (!signingResponse.ok) {
        setSigningPolicy({
          status: "error",
          message: signingBody.error ?? "Could not load the signing policy.",
        });
      } else {
        const parsed = parseSigningPolicy(signingBody.policy);
        setSigningPolicy({ status: "ready", policy: parsed });
        setSigningDraft(parsed ?? emptySigningDraft());
      }
      const nextCandidates: Record<number, IdentityCandidateView[]> = {};
      const nextEvidence: Record<number, IdentityEvidenceView | null> = {};
      const nextRisk: Record<number, IdentityRiskView | null> = {};
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
        const evidenceResponse = await fetch(q(`/api/packages/${row.packageId}/evidence`), {
          credentials: "include",
        });
        const evidenceBody = (await evidenceResponse.json()) as {
          error?: string;
          evidence?: IdentityEvidenceView | null;
        };
        if (evidenceResponse.status === 402) {
          identityStatus = { status: "ended" };
          break;
        }
        if (evidenceResponse.status === 403) {
          identityStatus = { status: "solo" };
          break;
        }
        if (!evidenceResponse.ok) {
          identityStatus = {
            status: "error",
            message: evidenceBody.error ?? "Could not load identity evidence.",
          };
          break;
        }
        nextEvidence[row.packageId] = evidenceBody.evidence ?? null;
        const identityResponse = await fetch(q(`/api/packages/${row.packageId}/identity`), {
          credentials: "include",
        });
        if (identityResponse.ok) {
          const identityBody = (await identityResponse.json()) as {
            risk?: IdentityRiskView | null;
          };
          nextRisk[row.packageId] = identityBody.risk ?? null;
        }
      }
      setIdentitySignals(identityStatus);
      setCandidatesByPackage(nextCandidates);
      setEvidenceByPackage(nextEvidence);
      setRiskByPackage(nextRisk);
      const namespaceResponse = await fetch(q("/api/namespaces"), { credentials: "include" });
      const namespaceBody = (await namespaceResponse.json()) as {
        error?: string;
        namespaces?: ProtectedNamespace[];
      };
      if (namespaceResponse.status === 402 || namespaceResponse.status === 403) {
        setNamespaces([]);
      } else if (!namespaceResponse.ok) {
        setNamespaces([]);
        if (identityStatus.status === "ready") {
          setIdentitySignals({
            status: "error",
            message: namespaceBody.error ?? "Could not load npm scope watchlists.",
          });
        }
      } else {
        setNamespaces(namespaceBody.namespaces ?? []);
      }
      const baselines = await Promise.allSettled(
        packageBody.packages.map(async (pkg) => {
          const body = await loadJson<{ baseline: BaselineView | null }>(
            `/api/packages/${pkg.id}/baseline`,
          );
          return [pkg.id, body.baseline] as const;
        }),
      );
      setBaselineByPackage(
        Object.fromEntries(
          baselines.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load.";
      setRepos({ status: "error", message });
      setAlerts({ status: "error", message });
      setPackages({ status: "error", message });
      setOrigins({ status: "error", message });
      setDatasetState({
        maps: { status: "error", message },
        releases: { status: "error", message },
        jobs: { status: "error", message },
        notifications: { status: "error", message },
      });
      setMapDestinations([]);
      setTimeline({ status: "error", message });
      setAudit({ status: "error", message });
      setRetention({ status: "error", message });
      setIdentitySignals({ status: "error", message });
      setCandidatesByPackage({});
      setEvidenceByPackage({});
      setRiskByPackage({});
      setNamespaces([]);
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
        } else if (confirming.kind === "signing-policy-save") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch("/api/signing-policy", {
            method: "PUT",
            credentials: "include",
            headers,
            body: JSON.stringify({
              installationId: installId,
              requireGithub: signingDraft.requireGithub,
              requireNpm: signingDraft.requireNpm,
              builderPrefix: signingDraft.builderPrefix,
              expiresAt: signingDraft.expiresAt,
              confirm,
            }),
          });
        } else if (confirming.kind === "signing-policy-clear") {
          if (!installId) throw new Error("Choose a GitHub installation.");
          response = await fetch("/api/signing-policy", {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({
              installationId: installId,
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
        } else if (confirming.kind === "release-attest") {
          response = await fetch(`/api/releases/${confirming.id}/attestations`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
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
        } else if (confirming.kind === "identity-evidence") {
          response = await fetch(`/api/packages/${confirming.id}/evidence`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
          });
        } else if (
          confirming.kind === "identity-publish-advisory" ||
          confirming.kind === "identity-unpublish-advisory"
        ) {
          response = await fetch(`/api/packages/${confirming.id}/advisory`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              enabled: confirming.kind === "identity-publish-advisory",
              confirm,
            }),
          });
        } else if (confirming.kind === "namespace-unprotect") {
          response = await fetch(`/api/namespaces/${confirming.id}`, {
            method: "DELETE",
            credentials: "include",
            headers,
            body: JSON.stringify({ confirm }),
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
  }, [confirmText, confirming, refreshSignedIn, selectedInstallId, signingDraft]);

  const requestedInstallId = installIdFromSearch(search);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await loadJson<Me>("/api/me");
        if (cancelled) return;
        setMe({ status: "ready", data: body });
        if (body.user) {
          const wanted = requestedInstallId;
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
          setEvidenceByPackage({});
          setJobs([]);
          setJobSummary({ queued: 0, running: 0, done: 0, failed: 0 });
          setFairUse(null);
          setDatasetState({
            maps: { status: "ready" },
            releases: { status: "ready" },
            jobs: { status: "ready" },
            notifications: { status: "ready" },
          });
          setMembers([]);
          setInvites([]);
          setMembersError(null);
          setTimeline({ status: "ready", entries: [], days: 0 });
          setAudit({ status: "ready", rows: [] });
          setRetention({ status: "ready", days: 90 });
          setRetentionDraft(90);
          setSigningPolicy({ status: "ready", policy: null });
          setSigningDraft(emptySigningDraft());
          setSigningError(null);
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
  }, [refreshSignedIn, requestedInstallId]);

  useEffect(() => {
    if (!selectedInstallId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const body = await loadJson<{
          stripe: boolean;
          billing: { hasCustomer: boolean; subscribed: boolean };
        }>(`/api/billing?installationId=${selectedInstallId}`);
        if (cancelled) return;
        setBilling({
          stripe: body.stripe,
          hasCustomer: body.billing.hasCustomer,
          subscribed: body.billing.subscribed,
        });
      } catch {
        if (!cancelled) setBilling(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedInstallId]);

  const controller = useWatchDeskController({
    path,
    search,
    login: me.status === "ready" ? me.data.user?.login ?? PREVIEW_LOGIN : PREVIEW_LOGIN,
    previewing: me.status !== "ready" || !me.data.user,
    repos:
      me.status === "ready" && !me.data.user
        ? previewRepos()
        : repos.status === "ready"
          ? repos.data.repos
          : [],
    alerts:
      me.status === "ready" && !me.data.user
        ? (previewAlerts() as Alert[])
        : alerts.status === "ready"
          ? alerts.data.alerts
          : [],
    packages: packages.status === "ready" ? packages.data.packages : [],
    origins: origins.status === "ready" ? origins.data.origins : [],
    maps: mapDestinations,
    releases,
    setupProbes: setupStatusByRepo,
    alertEvents,
    setAlertEvents,
  });

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
  const stripeLive = Boolean(me.data.stripe);
  const installations = me.data.installations ?? [];
  const queryCoverage = coverageFromQuery(search);
  const previewing = !user;
  const coverage: Coverage | undefined = user
    ? sessionCoverage
    : (queryCoverage ?? coverageFromQuery("?as=trial") ?? undefined);

  if (!user && githubApp && !queryCoverage) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.28em] text-dim">Watch desk</p>
        <p className="mt-3 text-sm text-dim">
          <a href="/" className="text-snow underline-offset-4 hover:underline" onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}>
            Product
          </a>
        </p>
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
      </main>
    );
  }

  const selectedLiveInstall = previewing
    ? null
    : (selectedInstallId
        ? (installations.find((row) => row.id === selectedInstallId) ?? installations[0])
        : installations[0]) ?? null;
  const selectedInstall = previewing ? null : selectedLiveInstall;
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
  const canManageEvidence =
    Boolean(installAdmin) &&
    !ended &&
    !previewing &&
    (deskCoverage?.status === "trial" || deskCoverage?.plan === "team");
  const canReadEvidence =
    !ended &&
    !previewing &&
    identitySignals.status === "ready" &&
    (deskCoverage?.status === "trial" || deskCoverage?.plan === "team");
  const canChangeRetention = Boolean(installAdmin) && !ended && !previewing;
  const canManageSigningPolicy = canGovernReleases && !previewing;
  const adminCount = members.filter((row) => row.role === "admin").length;
  const login = user?.login ?? PREVIEW_LOGIN;
  const activeInstallId = selectedLiveInstall?.id ?? null;
  const deskRepos = previewing ? previewRepos() : repos.status === "ready" ? repos.data.repos : [];
  const deskAlerts: Alert[] = previewing
    ? (previewAlerts() as Alert[])
    : alerts.status === "ready"
      ? alerts.data.alerts
      : [];
  const deskPackages = previewing
    ? []
    : packages.status === "ready"
      ? packages.data.packages
      : [];
  const alertSectionState = previewing ? { status: "ready" as const } : sectionStateOf(alerts);
  const sourceSectionState = previewing
    ? { status: "ready" as const }
    : combineWatchSectionStates([
        sectionStateOf(repos),
        sectionStateOf(alerts),
        sectionStateOf(packages),
        sectionStateOf(origins),
        datasetState.maps,
      ]);
  const overviewSectionState = combineWatchSectionStates([
    alertSectionState,
    sourceSectionState,
    datasetState.releases,
    datasetState.jobs,
  ]);
  const setupSectionState = combineWatchSectionStates([
    sourceSectionState,
    datasetState.releases,
  ]);

  const retryDeskSection = async (
    section: "alerts" | "sources" | "overview" | "releases" | "notifications" | "timeline",
  ) => {
    const q = (url: string) => scopedApi(url, activeInstallId);
    const messageOf = (error: unknown) =>
      error instanceof Error ? error.message : "Could not load this section.";
    const retryAlerts = async () => {
      setAlerts({ status: "loading" });
      try {
        setAlerts({ status: "ready", data: await loadJson<{ alerts: Alert[] }>(q("/api/alerts")) });
      } catch (error) {
        setAlerts({ status: "error", message: messageOf(error) });
      }
    };
    const retrySources = async () => {
      setRepos({ status: "loading" });
      setPackages({ status: "loading" });
      setOrigins({ status: "loading" });
      setDatasetState((current) => ({ ...current, maps: { status: "loading" } }));
      const loaded = await loadWatchResources({
        repos: () => loadJson<{ repos: Repo[] }>(q("/api/repos")),
        packages: () => loadJson<{ packages: WatchedPackage[] }>(q("/api/packages")),
        origins: () => loadJson<{ origins: WatchedOrigin[] }>(q("/api/origins")),
        maps: () => loadJson<{ destinations: MapCustodyDestination[] }>(q("/api/map-destinations")),
      });
      const loadState = <T,>(result: PromiseSettledResult<T>): LoadState<T> =>
        result.status === "fulfilled"
          ? { status: "ready", data: result.value }
          : { status: "error", message: messageOf(result.reason) };
      setRepos(loadState(loaded.repos));
      setPackages(loadState(loaded.packages));
      setOrigins(loadState(loaded.origins));
      if (loaded.maps.status === "fulfilled") setMapDestinations(loaded.maps.value.destinations);
      setDatasetState((current) => ({
        ...current,
        maps: loaded.maps.status === "fulfilled"
          ? { status: "ready" }
          : { status: "error", message: messageOf(loaded.maps.reason) },
      }));
    };
    const retryDataset = async (
      key: "releases" | "jobs",
      load: () => Promise<void>,
    ) => {
      setDatasetState((current) => ({ ...current, [key]: { status: "loading" } }));
      try {
        await load();
        setDatasetState((current) => ({ ...current, [key]: { status: "ready" } }));
      } catch (error) {
        setDatasetState((current) => ({
          ...current,
          [key]: { status: "error", message: messageOf(error) },
        }));
      }
    };
    if (section === "alerts") return retryAlerts();
    if (section === "sources") return Promise.all([retrySources(), retryAlerts()]);
    if (section === "releases") {
      return retryDataset("releases", async () => {
        const body = await loadJson<{ releases: ReleaseRevision[] }>(q("/api/releases"));
        setReleases(body.releases);
      });
    }
    if (section === "notifications") {
      setDatasetState((current) => ({ ...current, notifications: { status: "loading" } }));
      try {
        const loaded = await loadWatchResources({
          destinations: () => loadJson<{ destinations: NotificationDestination[] }>(q("/api/destinations")),
          deliveries: () => loadJson<{ deliveries: NotificationDelivery[] }>(q("/api/destinations/deliveries")),
          routes: () => loadJson<{ routes: NotificationRoute[] }>(q("/api/destinations/routes")),
        });
        const failure = Object.values(loaded).find(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );
        if (failure) throw failure.reason;
        if (loaded.destinations.status === "fulfilled") setDestinations(loaded.destinations.value.destinations);
        if (loaded.deliveries.status === "fulfilled") setDeliveries(loaded.deliveries.value.deliveries);
        if (loaded.routes.status === "fulfilled") setRoutes(loaded.routes.value.routes);
        setDatasetState((current) => ({ ...current, notifications: { status: "ready" } }));
      } catch (error) {
        setDatasetState((current) => ({
          ...current,
          notifications: { status: "error", message: messageOf(error) },
        }));
      }
      return;
    }
    if (section === "timeline") {
      setTimeline({ status: "loading" });
      try {
        const response = await fetch(q("/api/timeline"), { credentials: "include" });
        const body = (await response.json()) as { error?: string; days?: number; entries?: TimelineEntry[] };
        if (!response.ok) throw new Error(body.error ?? "Could not load the timeline.");
        setTimeline({ status: "ready", days: body.days ?? 90, entries: body.entries ?? [] });
      } catch (error) {
        setTimeline({ status: "error", message: messageOf(error) });
      }
      return;
    }
    await Promise.all([
      retrySources(),
      retryDataset("releases", async () => {
        const body = await loadJson<{ releases: ReleaseRevision[] }>(q("/api/releases"));
        setReleases(body.releases);
      }),
      retryDataset("jobs", async () => {
        const body = await loadJson<{ jobs: TenantJob[]; summary: JobSummary; fairUse?: FairUseStatus }>(q("/api/jobs"));
        setJobs(body.jobs);
        setJobSummary(body.summary);
        setFairUse(body.fairUse ?? null);
      }),
    ]);
  };
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

  const route = controller.route;
  const teamOnly = deskCoverage?.status === "trial" || deskCoverage?.plan === "team";
  const adminOnly = Boolean(installAdmin) || previewing;
  const setup = controller.setup;
  const sourceRows = controller.sources;
  const listedAlerts = controller.listedAlerts as Alert[];
  const selectedAlert = controller.selectedAlert as Alert | null;
  const selectedRelease =
    releases.find((release) => release.id === route.releaseId) ?? releases[0] ?? null;
  const openAlertCount = controller.counts.open;
  const waitingCount = controller.counts.waiting;
  const mineCount = controller.counts.mine;
  const resolvedCount = controller.counts.resolved;
  const billingControl =
    !previewing && stripeLive && installAdmin && billing?.hasCustomer ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden md:inline-flex"
        disabled={billingBusy}
        onClick={() => {
          if (!activeInstallId) return;
          setBillingBusy(true);
          setBillingError(null);
          void (async () => {
            try {
              const response = await fetch("/api/billing/portal", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ installationId: activeInstallId }),
              });
              const body = (await response.json()) as { url?: string; error?: string };
              if (!response.ok || !body.url) {
                throw new Error(body.error ?? "Could not open billing.");
              }
              window.location.assign(body.url);
            } catch (error) {
              setBillingError(error instanceof Error ? error.message : "Could not open billing.");
              setBillingBusy(false);
            }
          })();
        }}
      >
        Manage billing
      </Button>
    ) : null;

  return (
    <WatchMonolithShell
      route={route}
      search={search}
      coverage={deskCoverage}
      ended={ended}
      role={previewing ? "admin" : selectedLiveInstall?.role}
      teamOnly={Boolean(teamOnly)}
      adminOnly={adminOnly}
      login={login}
      sourceCount={sourceRows.length}
      openAlertCount={openAlertCount}
      waitingCount={waitingCount}
      mineCount={mineCount}
      resolvedCount={resolvedCount}
      setupDone={setup.done}
      setupTotal={setup.total}
      installations={previewing ? [] : installations}
      activeInstallId={activeInstallId}
      onInstall={(id) => {
        setSelectedInstallId(id);
        navigate(watchHref(path || "/watch", search, { install: id }));
        void refreshSignedIn(id);
      }}
      installUrl={installUrl && githubApp && user ? installUrl : undefined}
      onOpenPalette={() => setPaletteOpen(true)}
      billing={billingControl}
    >
      <WatchCommandPalette
        open={paletteOpen}
        search={search}
        teamOnly={Boolean(teamOnly)}
        adminOnly={adminOnly}
        alerts={deskAlerts.map((row) => ({ id: row.id, title: row.title }))}
        sources={sourceRows}
        releases={releases.map((row) => ({ id: row.id, coordinate: row.coordinate }))}
        onClose={() => setPaletteOpen(false)}
      />
      {billingError ? <p className="mb-4 text-sm text-danger">{billingError}</p> : null}

      <WatchRouteContent
        context={{
          AlertDeskItem,
          AuditScreen,
          Avatar,
          AvatarFallback,
          AvatarImage,
          Button,
          CoverageLock,
          DELETE_PACK_ASSETS_COPY,
          DISABLE_WORKFLOW_COPY,
          FAIR_USE_EXHAUSTED,
          FAIR_USE_WARNING,
          GithubResponseResult,
          MAKE_PRIVATE_COPY,
          RemediationPrResult,
          RetentionScreen,
          SIGNING_POLICY_CLEAR_CONFIRM,
          SIGNING_POLICY_CONFIRM,
          SetupPrResult,
          SetupStatusResult,
          TimelineScreen,
          WatchAlertsWorkspace,
          WatchNotificationSummary,
          WatchOverview,
          WatchSectionError,
          WatchSkeleton,
          WatchSourcesSummary,
          activeInstallId,
          adminCount,
          adminOnly,
          alertAssignees,
          alertBusyId,
          alertErrorById,
          alertEvents,
          alertNotes,
          alertSectionState,
          alerts,
          allowExpires,
          allowPath,
          allowReason,
          allowReasonByCandidate,
          allowRule,
          approvingId,
          attachingReleaseId,
          attestationError,
          audit,
          baselineByPackage,
          baselineReason,
          beginConfirm,
          canChangeRetention,
          canExportReleases,
          canGovernReleases,
          canManageEvidence,
          canManageRoles,
          canManageSigningPolicy,
          canPublishVerify,
          canReadEvidence,
          candidatesByPackage,
          checkingId,
          checkingMapId,
          checkingNamespaceId,
          checkingOriginId,
          cn,
          confirmBusy,
          confirmForm,
          confirming,
          controller,
          datasetState,
          deletePackAssetsConfirm,
          deliveries,
          deliveryError,
          deliveryUrlByRelease,
          deskAlerts,
          deskCoverage,
          deskPackages,
          deskRepos,
          destinationKindLabel,
          destinations,
          diffByPackage,
          diffingId,
          downloadingEvidenceId,
          downloadingReceiptId,
          emailAddress,
          ended,
          evidenceByPackage,
          exceptions,
          exportError,
          fairUse,
          formatExposure,
          formatSealedBytes,
          githubApp,
          githubByRepo,
          githubPaused,
          githubRunnersReachable,
          governanceReasonByRelease,
          hostedOrigin,
          identitySignals,
          importError,
          importNames,
          importResults,
          importingPackages,
          installAdmin,
          installUrl,
          installations,
          inviteLogin,
          inviteRole,
          invites,
          jiraEmail,
          jiraProjectKey,
          jiraSite,
          jiraToken,
          jobSummary,
          jobs,
          kindLabel,
          ledgerExportError,
          listedAlerts,
          loadJson,
          locked,
          makePrivateConfirm,
          mapDestinations,
          mapError,
          mapHost,
          mapKind,
          mapOrg,
          mapProject,
          mapToken,
          members,
          membersError,
          mintingScanToken,
          namespaceError,
          namespaceScope,
          namespaces,
          navigate,
          originError,
          originUrl,
          origins,
          overviewSectionState,
          packageError,
          packageName,
          packages,
          pagerDutyKey,
          parseWorkflowPath,
          previewing,
          probingSetupId,
          protectingId,
          protectionImportStatusLabel,
          protections,
          receiptError,
          receiptStatusMark,
          refreshSignedIn,
          registries,
          registryError,
          registryOriginInput,
          registryToken,
          releases,
          remediateByRepo,
          remediatingId,
          repos,
          retention,
          retentionConfirmToken,
          retentionDraft,
          retryDeskSection,
          revealedScanToken,
          riskByPackage,
          route,
          routeDestinationId,
          routeMinSeverity,
          routeMinSeverityLabel,
          routePackage,
          routeRepo,
          routeTeam,
          routeTestPackage,
          routeTestRepo,
          routeTestSeverity,
          routes,
          savingAllow,
          savingEmail,
          savingJira,
          savingMap,
          savingNamespace,
          savingPagerDuty,
          savingRegistry,
          savingRoute,
          savingSiem,
          savingSlack,
          scanError,
          scanTokenError,
          scanTokenName,
          scanTokens,
          scanningId,
          scopedApi,
          search,
          selectedAlert,
          selectedInstall,
          selectedInstallId,
          selectedRelease,
          setAlertAssignees,
          setAlertBusyId,
          setAlertErrorById,
          setAlertEvents,
          setAlertNotes,
          setAlerts,
          setAllowExpires,
          setAllowPath,
          setAllowReason,
          setAllowReasonByCandidate,
          setAllowRule,
          setApprovingId,
          setAttachingReleaseId,
          setAttestationError,
          setBaselineReason,
          setCheckingId,
          setCheckingMapId,
          setCheckingNamespaceId,
          setCheckingOriginId,
          setDeliveryError,
          setDeliveryUrlByRelease,
          setDiffByPackage,
          setDiffingId,
          setDownloadingEvidenceId,
          setDownloadingReceiptId,
          setEmailAddress,
          setExportError,
          setGithubByRepo,
          setGovernanceReasonByRelease,
          setImportError,
          setImportNames,
          setImportResults,
          setImportingPackages,
          setInviteLogin,
          setInviteRole,
          setJiraEmail,
          setJiraProjectKey,
          setJiraSite,
          setJiraToken,
          setLedgerExportError,
          setMapError,
          setMapHost,
          setMapKind,
          setMapOrg,
          setMapProject,
          setMapToken,
          setMe,
          setMintingScanToken,
          setNamespaceError,
          setNamespaceScope,
          setOriginError,
          setOriginUrl,
          setPackageError,
          setPackageName,
          setPagerDutyKey,
          setProbingSetupId,
          setProtectingId,
          setReceiptError,
          setRegistryError,
          setRegistryOriginInput,
          setRegistryToken,
          setRemediateByRepo,
          setRemediatingId,
          setRetentionDraft,
          setRevealedScanToken,
          setRouteDestinationId,
          setRouteMinSeverity,
          setRoutePackage,
          setRouteRepo,
          setRouteTeam,
          setRouteTestPackage,
          setRouteTestRepo,
          setRouteTestSeverity,
          setSavingAllow,
          setSavingEmail,
          setSavingJira,
          setSavingMap,
          setSavingNamespace,
          setSavingPagerDuty,
          setSavingRegistry,
          setSavingRoute,
          setSavingSiem,
          setSavingSlack,
          setScanError,
          setScanTokenError,
          setScanTokenName,
          setScanningId,
          setSetupByRepo,
          setSetupStatusByRepo,
          setSetuppingId,
          setSiemWebhook,
          setSigningDraft,
          setSigningError,
          setSlackError,
          setSlackWebhook,
          setTestError,
          setTestingInstallId,
          setTestingRoute,
          setTestingSlackId,
          setVerifyingLocationId,
          setWatchRegistryOrigin,
          setWatchingOrigin,
          setWatchingPackage,
          setWorkflowDraft,
          setup,
          setupByRepo,
          setupSectionState,
          setupStatusByRepo,
          setuppingId,
          siemWebhook,
          signingDraft,
          signingError,
          signingPolicy,
          slackError,
          slackWebhook,
          sourceRows,
          sourceSectionState,
          teamOnly,
          testError,
          testingInstallId,
          testingRoute,
          testingSlackId,
          timeline,
          user,
          verifyingLocationId,
          watchHref,
          watchPath,
          watchRegistryOrigin,
          watchingOrigin,
          watchingPackage,
          workflowDraft,
          workflowIsNoSpoilersScan,
        }}
      />
    </WatchMonolithShell>
  );
}
