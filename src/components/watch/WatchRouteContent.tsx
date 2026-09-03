import type {
  Alert,
  AlertEvent,
  PermissionTest,
  ProtectionImportResult,
  ReleaseDiffView,
  RemediationFileView,
  SetupStatusFacts,
} from "@/watch/types";

export type WatchScreenContext = {
  AlertDeskItem: any;
  AuditScreen: any;
  Avatar: any;
  AvatarFallback: any;
  AvatarImage: any;
  Button: any;
  CoverageLock: any;
  DELETE_PACK_ASSETS_COPY: any;
  DISABLE_WORKFLOW_COPY: any;
  FAIR_USE_EXHAUSTED: any;
  FAIR_USE_WARNING: any;
  GithubResponseResult: any;
  MAKE_PRIVATE_COPY: any;
  RemediationPrResult: any;
  RetentionScreen: any;
  SIGNING_POLICY_CLEAR_CONFIRM: any;
  SIGNING_POLICY_CONFIRM: any;
  SetupPrResult: any;
  SetupStatusResult: any;
  TimelineScreen: any;
  WatchAlertsWorkspace: any;
  WatchNotificationSummary: any;
  WatchOverview: any;
  WatchSectionError: any;
  WatchSkeleton: any;
  WatchSourcesSummary: any;
  activeInstallId: any;
  adminCount: any;
  adminOnly: any;
  alertAssignees: any;
  alertBusyId: any;
  alertErrorById: any;
  alertEvents: any;
  alertNotes: any;
  alertSectionState: any;
  alerts: any;
  allowExpires: any;
  allowPath: any;
  allowReason: any;
  allowReasonByCandidate: any;
  allowRule: any;
  approvingId: any;
  attachingReleaseId: any;
  attestationError: any;
  audit: any;
  baselineByPackage: any;
  baselineReason: any;
  beginConfirm: any;
  canChangeRetention: any;
  canExportReleases: any;
  canGovernReleases: any;
  canManageEvidence: any;
  canManageRoles: any;
  canManageSigningPolicy: any;
  canPublishVerify: any;
  canReadEvidence: any;
  candidatesByPackage: any;
  checkingId: any;
  checkingMapId: any;
  checkingNamespaceId: any;
  checkingOriginId: any;
  cn: any;
  confirmBusy: any;
  confirmForm: any;
  confirming: any;
  controller: any;
  datasetState: any;
  deletePackAssetsConfirm: any;
  deliveries: any;
  deliveryError: any;
  deliveryUrlByRelease: any;
  deskAlerts: any;
  deskCoverage: any;
  deskPackages: any;
  deskRepos: any;
  destinationKindLabel: any;
  destinations: any;
  diffByPackage: any;
  diffingId: any;
  downloadingEvidenceId: any;
  downloadingReceiptId: any;
  emailAddress: any;
  ended: any;
  evidenceByPackage: any;
  exceptions: any;
  exportError: any;
  fairUse: any;
  formatExposure: any;
  formatSealedBytes: any;
  githubApp: any;
  githubByRepo: any;
  githubPaused: any;
  githubRunnersReachable: any;
  governanceReasonByRelease: any;
  hostedOrigin: any;
  identitySignals: any;
  importError: any;
  importNames: any;
  importResults: any;
  importingPackages: any;
  installAdmin: any;
  installUrl: any;
  installations: any;
  inviteLogin: any;
  inviteRole: any;
  invites: any;
  jiraEmail: any;
  jiraProjectKey: any;
  jiraSite: any;
  jiraToken: any;
  jobSummary: any;
  jobs: any;
  kindLabel: any;
  ledgerExportError: any;
  listedAlerts: any;
  loadJson: any;
  locked: any;
  makePrivateConfirm: any;
  mapDestinations: any;
  mapError: any;
  mapHost: any;
  mapKind: any;
  mapOrg: any;
  mapProject: any;
  mapToken: any;
  members: any;
  membersError: any;
  mintingScanToken: any;
  namespaceError: any;
  namespaceScope: any;
  namespaces: any;
  navigate: any;
  originError: any;
  originUrl: any;
  origins: any;
  overviewSectionState: any;
  packageError: any;
  packageName: any;
  packages: any;
  pagerDutyKey: any;
  parseWorkflowPath: any;
  previewing: any;
  probingSetupId: any;
  protectingId: any;
  protectionImportStatusLabel: any;
  protections: any;
  receiptError: any;
  receiptStatusMark: any;
  refreshSignedIn: any;
  registries: any;
  registryError: any;
  registryOriginInput: any;
  registryToken: any;
  releases: any;
  remediateByRepo: any;
  remediatingId: any;
  repos: any;
  retention: any;
  retentionConfirmToken: any;
  retentionDraft: any;
  retryDeskSection: any;
  revealedScanToken: any;
  riskByPackage: any;
  route: any;
  routeDestinationId: any;
  routeMinSeverity: any;
  routeMinSeverityLabel: any;
  routePackage: any;
  routeRepo: any;
  routeTeam: any;
  routeTestPackage: any;
  routeTestRepo: any;
  routeTestSeverity: any;
  routes: any;
  savingAllow: any;
  savingEmail: any;
  savingJira: any;
  savingMap: any;
  savingNamespace: any;
  savingPagerDuty: any;
  savingRegistry: any;
  savingRoute: any;
  savingSiem: any;
  savingSlack: any;
  scanError: any;
  scanTokenError: any;
  scanTokenName: any;
  scanTokens: any;
  scanningId: any;
  scopedApi: any;
  search: any;
  selectedAlert: any;
  selectedInstall: any;
  selectedInstallId: any;
  selectedRelease: any;
  setAlertAssignees: any;
  setAlertBusyId: any;
  setAlertErrorById: any;
  setAlertEvents: any;
  setAlertNotes: any;
  setAlerts: any;
  setAllowExpires: any;
  setAllowPath: any;
  setAllowReason: any;
  setAllowReasonByCandidate: any;
  setAllowRule: any;
  setApprovingId: any;
  setAttachingReleaseId: any;
  setAttestationError: any;
  setBaselineReason: any;
  setCheckingId: any;
  setCheckingMapId: any;
  setCheckingNamespaceId: any;
  setCheckingOriginId: any;
  setDeliveryError: any;
  setDeliveryUrlByRelease: any;
  setDiffByPackage: any;
  setDiffingId: any;
  setDownloadingEvidenceId: any;
  setDownloadingReceiptId: any;
  setEmailAddress: any;
  setExportError: any;
  setGithubByRepo: any;
  setGovernanceReasonByRelease: any;
  setImportError: any;
  setImportNames: any;
  setImportResults: any;
  setImportingPackages: any;
  setInviteLogin: any;
  setInviteRole: any;
  setJiraEmail: any;
  setJiraProjectKey: any;
  setJiraSite: any;
  setJiraToken: any;
  setLedgerExportError: any;
  setMapError: any;
  setMapHost: any;
  setMapKind: any;
  setMapOrg: any;
  setMapProject: any;
  setMapToken: any;
  setMe: any;
  setMintingScanToken: any;
  setNamespaceError: any;
  setNamespaceScope: any;
  setOriginError: any;
  setOriginUrl: any;
  setPackageError: any;
  setPackageName: any;
  setPagerDutyKey: any;
  setProbingSetupId: any;
  setProtectingId: any;
  setReceiptError: any;
  setRegistryError: any;
  setRegistryOriginInput: any;
  setRegistryToken: any;
  setRemediateByRepo: any;
  setRemediatingId: any;
  setRetentionDraft: any;
  setRevealedScanToken: any;
  setRouteDestinationId: any;
  setRouteMinSeverity: any;
  setRoutePackage: any;
  setRouteRepo: any;
  setRouteTeam: any;
  setRouteTestPackage: any;
  setRouteTestRepo: any;
  setRouteTestSeverity: any;
  setSavingAllow: any;
  setSavingEmail: any;
  setSavingJira: any;
  setSavingMap: any;
  setSavingNamespace: any;
  setSavingPagerDuty: any;
  setSavingRegistry: any;
  setSavingRoute: any;
  setSavingSiem: any;
  setSavingSlack: any;
  setScanError: any;
  setScanTokenError: any;
  setScanTokenName: any;
  setScanningId: any;
  setSetupByRepo: any;
  setSetupStatusByRepo: any;
  setSetuppingId: any;
  setSiemWebhook: any;
  setSigningDraft: any;
  setSigningError: any;
  setSlackError: any;
  setSlackWebhook: any;
  setTestError: any;
  setTestingInstallId: any;
  setTestingRoute: any;
  setTestingSlackId: any;
  setVerifyingLocationId: any;
  setWatchRegistryOrigin: any;
  setWatchingOrigin: any;
  setWatchingPackage: any;
  setWorkflowDraft: any;
  setup: any;
  setupByRepo: any;
  setupSectionState: any;
  setupStatusByRepo: any;
  setuppingId: any;
  siemWebhook: any;
  signingDraft: any;
  signingError: any;
  signingPolicy: any;
  slackError: any;
  slackWebhook: any;
  sourceRows: any;
  sourceSectionState: any;
  teamOnly: any;
  testError: any;
  testingInstallId: any;
  testingRoute: any;
  testingSlackId: any;
  timeline: any;
  user: any;
  verifyingLocationId: any;
  watchHref: any;
  watchPath: any;
  watchRegistryOrigin: any;
  watchingOrigin: any;
  watchingPackage: any;
  workflowDraft: any;
  workflowIsNoSpoilersScan: any;
};

export function WatchRouteContent({ context }: { context: WatchScreenContext }) {
  const {
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
  } = context;

  return (
    <>
        {route.view === "overview" ? (
          <WatchOverview
            search={search}
            ended={ended}
            githubPaused={githubPaused}
            installUrl={installUrl && githubApp && user ? installUrl : undefined}
            alerts={deskAlerts}
            sources={sourceRows}
            packsRead={releases.length}
            failedPolicy={releases.filter((row) => row.receiptStatus === "failed-policy").length}
            queueDepth={jobSummary.queued + jobSummary.running}
            lastRunLabel={
              jobSummary.running > 0 ? "running" : jobSummary.queued > 0 ? "queued" : "idle"
            }
            setup={setup}
            state={overviewSectionState}
            onRetry={() => void retryDeskSection("overview")}
          />
        ) : null}
  
        {(route.view === "sources" || route.view === "setup") && (
          <section className="relative min-h-72">
            {ended ? (
              <CoverageLock variant="watch" title="Subscribe to keep watching." />
            ) : null}
            <div className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
            <WatchSourcesSummary
              mode={route.view}
              sources={sourceRows}
              setup={setup}
              admin={adminOnly}
              search={search}
              filter={route.sourceFilter}
              attention={route.sourceAttention}
              selectedSourceKey={route.sourceKey}
              state={route.view === "setup" ? setupSectionState : sourceSectionState}
              onRetry={() => void retryDeskSection("sources")}
            />
            {route.view === "sources" &&
            route.sourceConfigure === "github" &&
            (previewing || sourceSectionState.status === "ready") ? (
            <section id="watch-source-github" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <h2 className="text-sm font-semibold text-snow">GitHub repositories</h2>
            <p className="mt-2 text-sm text-mute">Repositories connected to this install and their current state.</p>
            <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
            <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
              <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
            </section>
            ) : null}
            </div>
          </section>
        )}
  
        {route.view === "alerts" ? (
          <WatchAlertsWorkspace
            alerts={listedAlerts}
            rows={controller.alertRows}
            selected={selectedAlert}
            events={selectedAlert ? alertEvents[selectedAlert.id] ?? [] : []}
            previewing={previewing}
            ended={ended}
            busy={Boolean(selectedAlert && alertBusyId === selectedAlert.id)}
            note={selectedAlert ? alertNotes[selectedAlert.id] ?? "" : ""}
            assignee={selectedAlert ? alertAssignees[selectedAlert.id] ?? "" : ""}
            error={selectedAlert ? alertErrorById[selectedAlert.id] ?? null : null}
            exportError={exportError}
            state={alertSectionState}
            activityState={controller.selectedActivityState}
            detailOpen={route.alertId !== null}
            tab={route.tab}
            teamOnly={Boolean(teamOnly)}
            onSelect={(alertId) =>
              navigate(
                watchHref(watchPath("alerts"), search, {
                  alert: alertId,
                  tab: route.tab,
                }),
              )
            }
            onBack={() =>
              navigate(
                watchHref(watchPath("alerts"), search, {
                  alert: null,
                  tab: route.tab,
                }),
              )
            }
            onRetry={() => void retryDeskSection("alerts")}
            onRetryActivity={controller.retrySelectedActivity}
            onTab={(tab) =>
              navigate(
                watchHref(watchPath("alerts"), search, {
                  alert: null,
                  tab,
                }),
              )
            }
            onNote={(value) => {
              if (!selectedAlert) return;
              setAlertNotes((current) => ({ ...current, [selectedAlert.id]: value }));
            }}
            onAssignee={(value) => {
              if (!selectedAlert) return;
              setAlertAssignees((current) => ({ ...current, [selectedAlert.id]: value }));
            }}
            onAction={(action) => {
              if (previewing || !selectedAlert) return;
              const alert = selectedAlert;
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
                    [alert.id]: error instanceof Error ? error.message : "Could not update that alert.",
                  }));
                } finally {
                  setAlertBusyId(null);
                }
              })();
            }}
            onExport={() => {
              setExportError(null);
              void (async () => {
                try {
                  const body = await loadJson<{ exportedAt: string; alerts: Alert[] }>(
                    scopedApi("/api/alerts/export", activeInstallId),
                  );
                  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `nospoilers-alerts-${body.exportedAt.slice(0, 10)}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  setExportError(error instanceof Error ? error.message : "Could not export alerts.");
                }
              })();
            }}
          />
        ) : null}
  
        {route.view === "alerts" && (
          <section className="hidden" aria-hidden="true">
            <h1 className="font-display text-3xl tracking-tight text-snow">Alerts</h1>
            <p className="mt-2 text-sm text-mute">Facts that need triage, ownership, or resolution.</p>
            <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
            {listedAlerts.length === 0 && (previewing || alerts.status === "ready") && (
              <p className="mt-6 text-sm leading-relaxed text-mute">
                {route.tab === "done"
                  ? "Nothing resolved on this install yet."
                  : route.tab === "waiting"
                    ? "Nothing waiting on rotation."
                    : route.tab === "mine"
                      ? "Nothing assigned to you."
                      : "Quiet so far. That is the good state — until a repo goes public or a release ships a map."}
              </p>
            )}
            {listedAlerts.length > 0 && (
              <div className="mt-5 grid overflow-hidden rounded-lg border border-white/8 bg-panel lg:grid-cols-[18rem_minmax(0,1fr)]">
                <ol className="max-h-[46rem] divide-y divide-white/5 overflow-auto border-b border-white/8 lg:border-b-0 lg:border-r">
                  {listedAlerts.map((alert) => (
                    <li key={`summary-${alert.id}`}>
                      <button
                        type="button"
                        className={cn(
                          "w-full px-4 py-4 text-left hover:bg-white/5",
                          selectedAlert?.id === alert.id && "bg-white/5",
                        )}
                        onClick={() =>
                          navigate(
                            watchHref(watchPath("alerts"), search, {
                              alert: alert.id,
                              tab: route.tab,
                            }),
                          )
                        }
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              alert.resolved_at ? "bg-white/30" : "bg-danger",
                            )}
                            aria-hidden
                          />
                          <strong className="truncate text-sm text-snow">{alert.title}</strong>
                        </span>
                        <span className="mt-2 block truncate font-mono text-xs text-dim">
                          {alert.full_name ?? kindLabel(alert.kind)}
                        </span>
                        <span className="mt-1 block text-xs text-dim">
                          {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <ul className="min-w-0 px-5">
                {selectedAlert ? [selectedAlert].map((alert) => (
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
                )) : null}
                </ul>
              </div>
            )}
          </section>
        )}
  
        {route.view === "timeline" ? (
          <TimelineScreen
            previewing={previewing}
            timeline={timeline}
            alerts={deskAlerts}
            alertState={alertSectionState}
            onRetryTimeline={() => void retryDeskSection("timeline")}
            onRetryAlerts={() => void retryDeskSection("alerts")}
          />
        ) : null}
  
        {route.view === "retention" ? (
          <RetentionScreen
            previewing={previewing}
            ended={ended}
            retention={retention}
            draft={retentionDraft}
            canChange={canChangeRetention}
            busy={confirmBusy}
            confirmation={confirmForm(confirming?.kind === "retention")}
            onDraft={setRetentionDraft}
            onSave={() =>
              beginConfirm({
                kind: "retention",
                days: retentionDraft,
                expected: retentionConfirmToken(retentionDraft),
              })
            }
          />
        ) : null}
  
        {route.view === "policy" && (
        <section className="mt-4">
          <h1 className="font-display text-3xl tracking-tight text-snow">Policy &amp; allowlist</h1>
          <p className="mt-2 text-sm text-mute">Shipping evidence, time-bound exceptions, and approved baselines.</p>
          <h2 className="mt-8 text-xs uppercase tracking-[0.22em] text-dim">Signing policy</h2>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
            Trial and Team can require a present GitHub or npm attestation document, or a builder
            prefix, before a passing revision is approved to ship. Type signing-policy to save.
            Type clear-signing-policy to remove it. Expired policies do not block. This is not
            Sigstore verification and not a malware verdict.
          </p>
          {previewing ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Preview cannot change a live signing policy. No invented incident.
            </p>
          ) : signingPolicy.status === "ended" ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Subscribe to Team to set a signing policy.
            </p>
          ) : signingPolicy.status === "solo" ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Subscribe to Team to set a signing policy.
            </p>
          ) : signingPolicy.status === "error" ? (
            <p className="mt-6 text-sm text-danger">{signingPolicy.message}</p>
          ) : signingPolicy.status === "loading" ? (
            <p className="mt-6 text-sm text-dim">Loading…</p>
          ) : (
            <div className="mt-6 max-w-xl space-y-3">
              <label className="flex items-center gap-2 text-sm text-snow">
                <input
                  type="checkbox"
                  checked={signingDraft.requireGithub}
                  disabled={!canManageSigningPolicy || confirmBusy}
                  onChange={(event) =>
                    setSigningDraft((current) => ({
                      ...current,
                      requireGithub: event.target.checked,
                    }))
                  }
                />
                Require a present GitHub attestation
              </label>
              <label className="flex items-center gap-2 text-sm text-snow">
                <input
                  type="checkbox"
                  checked={signingDraft.requireNpm}
                  disabled={!canManageSigningPolicy || confirmBusy}
                  onChange={(event) =>
                    setSigningDraft((current) => ({
                      ...current,
                      requireNpm: event.target.checked,
                    }))
                  }
                />
                Require a present npm attestation
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.16em] text-dim">
                  Builder prefix
                </span>
                <input
                  value={signingDraft.builderPrefix}
                  disabled={!canManageSigningPolicy || confirmBusy}
                  onChange={(event) =>
                    setSigningDraft((current) => ({
                      ...current,
                      builderPrefix: event.target.value,
                    }))
                  }
                  placeholder="https://github.com/actions"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Expires</span>
                <input
                  value={signingDraft.expiresAt}
                  disabled={!canManageSigningPolicy || confirmBusy}
                  onChange={(event) =>
                    setSigningDraft((current) => ({
                      ...current,
                      expiresAt: event.target.value,
                    }))
                  }
                  placeholder="2026-12-01T00:00:00.000Z"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40 disabled:opacity-50"
                />
              </label>
              {signingError ? <p className="text-sm text-danger">{signingError}</p> : null}
              {canManageSigningPolicy ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={confirmBusy}
                    onClick={() => {
                      setSigningError(null);
                      beginConfirm({
                        kind: "signing-policy-save",
                        expected: SIGNING_POLICY_CONFIRM,
                      });
                    }}
                  >
                    Save signing policy
                  </Button>
                  {signingPolicy.policy ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={confirmBusy}
                      onClick={() => {
                        setSigningError(null);
                        beginConfirm({
                          kind: "signing-policy-clear",
                          expected: SIGNING_POLICY_CLEAR_CONFIRM,
                        });
                      }}
                    >
                      Clear signing policy
                    </Button>
                  ) : null}
                  {confirmForm(
                    confirming?.kind === "signing-policy-save" ||
                      confirming?.kind === "signing-policy-clear",
                  )}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-mute">
                  An install admin has to change this policy.
                </p>
              )}
            </div>
          )}
        </section>
        )}
  
        {route.view === "audit" ? (
          <AuditScreen
            key={activeInstallId ?? "preview"}
            previewing={previewing}
            audit={audit}
            installationId={activeInstallId}
          />
        ) : null}
  
        {route.view === "team" && (
        <section className="mt-4">
          <h1 className="font-display text-3xl tracking-tight text-snow">Team &amp; roles</h1>
          <p className="mt-2 text-sm text-mute">People who can view or administer this install.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
            The first GitHub user to connect this install is admin. Later users become members. Admins
            change roles, remove people, and invite by GitHub login. They get that role the next time
            they sign in, if they can already see this App install. This does not send email. Invites
            stay GitHub-login only. This does not grant GitHub Administration. The last admin stays. GitHub
            suspend does not block this. An install admin also saves email on a covered install and
            Slack, SIEM, Jira, PagerDuty, routes, registries, scan
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
                  className="mt-6 flex max-w-xl flex-col gap-3 rounded-lg border border-white/8 bg-panel p-5 sm:flex-row sm:items-end"
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">Role</span>
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
                <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                  {invites.map((invite) => (
                    <li key={invite.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-snow">{invite.githubLogin}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
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
                <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                  {members.map((member) => (
                    <li key={member.userId} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="border border-white/10">
                          <AvatarFallback>{member.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                          {member.avatarUrl ? <AvatarImage src={member.avatarUrl} /> : null}
                        </Avatar>
                        <div>
                          <p className="text-sm text-snow">@{member.login}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">{member.role}</p>
                        </div>
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
        )}
  
        {route.view === "health" && (
        <section className="mt-4">
          <h1 className="font-display text-3xl tracking-tight text-snow">Install health</h1>
          <p className="mt-2 text-sm text-mute">Permissions, deliveries, and recent work for this GitHub install.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/8 bg-panel p-4">
              <p className="watch-kicker">Webhook</p>
              <p className={githubPaused ? "mt-2 text-lg text-danger" : "mt-2 text-lg text-snow"}>
                {githubPaused ? "paused" : "check needed"}
              </p>
              <p className="mt-1 text-xs text-dim">
                {githubPaused ? "GitHub suspended the App" : "No invented delivery proof"}
              </p>
            </div>
            <div className="rounded-lg border border-white/8 bg-panel p-4">
              <p className="watch-kicker">Permissions</p>
              <p className={selectedInstall?.lastPermissionTest?.ok ? "mt-2 text-lg text-snow" : "mt-2 text-lg text-mute"}>
                {selectedInstall?.lastPermissionTest?.ok ? "pass" : "unknown"}
              </p>
              <p className="mt-1 text-xs text-dim">
                {selectedInstall?.lastPermissionTest
                  ? selectedInstall.lastPermissionTest.administrationGranted
                    ? "Administration granted — remove it"
                    : "Administration off"
                  : "Run the live install test"}
              </p>
            </div>
            <div className="rounded-lg border border-white/8 bg-panel p-4">
              <p className="watch-kicker">Queue</p>
              <p className="mt-2 text-lg text-snow">{jobSummary.queued + jobSummary.running}</p>
              <p className="mt-1 text-xs text-dim">
                {jobSummary.done} done · {jobSummary.failed} failed
              </p>
            </div>
            <div className="rounded-lg border border-white/8 bg-panel p-4">
              <p className="watch-kicker">Fair use</p>
              <p className={fairUse?.exhausted ? "mt-2 text-lg text-danger" : "mt-2 text-lg text-snow"}>
                {fairUse?.exhausted ? "paused" : fairUse?.warning ? "near cap" : fairUse ? "ok" : "unknown"}
              </p>
              <p className="mt-1 text-xs text-dim">Hosted unpacks · not scan credits</p>
            </div>
          </div>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
            <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
              <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                {jobs.map((job) => (
                  <li key={job.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-mono text-sm text-snow">{kindLabel(job.kind)}</p>
                      <span
                        className={
                          job.status === "failed"
                            ? "text-xs uppercase tracking-[0.16em] text-danger"
                            : "text-xs uppercase tracking-[0.16em] text-dim"
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
        )}
  
        {route.view === "notifications" && (
        <section className="mt-4">
          <h1 className="font-display text-3xl tracking-tight text-snow">Notifications</h1>
          <p className="mt-2 text-sm text-mute">Destinations and routing rules for real Watch alerts.</p>
          {datasetState.notifications.status === "loading" ? (
            <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
          ) : datasetState.notifications.status === "error" ? (
            <WatchSectionError
              className="mt-6 max-w-2xl"
              message={datasetState.notifications.message}
              onRetry={() => void retryDeskSection("notifications")}
            />
          ) : (
          <>
          <WatchNotificationSummary destinations={destinations} routes={routes} />
          <section id="watch-notification-config" className="mt-5 rounded-lg border border-white/8 bg-panel p-5">
          <h2 className="text-sm font-semibold text-snow">Add, edit, or test a destination</h2>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
            Covered installs can send Watch alerts to email. Team and trial can also send Slack, a
            SIEM HTTPS webhook, Jira Cloud, and PagerDuty. Secrets and the full email address are
            encrypted and never shown again. A delivery test talks to the destination and never
            creates a Watch alert. Jira tests never open a ticket. PagerDuty tests send a change
            event and never open an incident. Email tests never invent an incident. Routes send a
            real alert or a routed test to matching destinations by severity, repository, package,
            and teammate. This host sends mail only when Resend keys are set.
          </p>
          {previewing ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Preview cannot send email, Slack, SIEM, Jira, or PagerDuty. Preview cannot route a
              test. No invented incident.
            </p>
          ) : (
            <>
              {destinations.length === 0 ? (
                <p className="mt-6 text-sm leading-relaxed text-mute">
                  No email, Slack, SIEM, Jira, or PagerDuty destination saved on this install.
                </p>
              ) : (
                <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                  {destinations.map((destination) => (
                    <li key={destination.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-sm text-snow">
                          {destinationKindLabel(destination.kind)} ·{" "}
                          {destination.kind === "email" && destination.projectKey
                            ? destination.projectKey
                            : destination.host}
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
                    if (savingEmail || !activeInstallId) return;
                    setSlackError(null);
                    setSavingEmail(true);
                    void (async () => {
                      try {
                        const response = await fetch("/api/destinations/email", {
                          method: "POST",
                          credentials: "include",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            email: emailAddress,
                            installationId: activeInstallId,
                          }),
                        });
                        const body = (await response.json()) as { error?: string };
                        if (!response.ok) throw new Error(body.error ?? "Could not save email.");
                        setEmailAddress("");
                        await refreshSignedIn(selectedInstallId);
                      } catch (error) {
                        setSlackError(error instanceof Error ? error.message : "Could not save email.");
                      } finally {
                        setSavingEmail(false);
                      }
                    })();
                  }}
                >
                  <label className="min-w-0 flex-1">
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
                      Alert email
                    </span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={emailAddress}
                      onChange={(event) => setEmailAddress(event.target.value)}
                      placeholder="alerts@your-company.com"
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                    />
                  </label>
                  <Button type="submit" size="sm" disabled={savingEmail || !emailAddress.trim()}>
                    {savingEmail ? "Saving…" : "Save email"}
                  </Button>
                </form>
              )}
              {deskCoverage?.plan === "solo" ? (
                <p className="mt-6 text-sm leading-relaxed text-mute">
                  Slack, SIEM, Jira, and PagerDuty are on Team.
                </p>
              ) : null}
              {deskCoverage?.plan !== "solo" && !ended && installAdmin && (
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
              {deskCoverage?.plan !== "solo" && !ended && installAdmin && (
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
              {deskCoverage?.plan !== "solo" && !ended && installAdmin && (
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Email</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
              {deskCoverage?.plan !== "solo" && !ended && installAdmin && (
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
                  <p className="text-xs uppercase tracking-[0.16em] text-dim">Route</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="min-w-0">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Destination</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Minimum severity</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Repository</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Package</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                  <p className="text-xs uppercase tracking-[0.16em] text-dim">Routed test</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="min-w-0">
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Severity</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Repository</span>
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
                      <span className="text-xs uppercase tracking-[0.16em] text-dim">Package</span>
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
                <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
          </>
          )}
        </section>
        )}
  
        {route.view === "sources" &&
          route.sourceConfigure === "website" &&
          (previewing || sourceSectionState.status === "ready") && (
        <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
          <section id="watch-source-web" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <h2 className="text-sm font-semibold text-snow">Production websites</h2>
          <p className="mt-2 text-sm text-mute">Origins watched for public source maps and exposed files.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">HTTPS origin</span>
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
            <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
              {origins.data.origins.map((row) => (
                <li key={row.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-snow">{row.origin_url}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
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
        </section>
        )}
  
        {route.view === "sources" &&
          route.sourceConfigure === "map" &&
          (previewing || sourceSectionState.status === "ready") && (
        <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
          <section id="watch-source-map" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <h2 className="text-sm font-semibold text-snow">Map custody</h2>
          <p className="mt-2 text-sm text-mute">Confirm maps are held by your error tracker, not served publicly.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Destination</span>
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Host (optional)</span>
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
                  <span className="text-xs uppercase tracking-[0.16em] text-dim">Organization slug</span>
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Auth token</span>
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
            <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
              {mapDestinations.map((row) => (
                <li key={row.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-snow">
                        {row.kind} · {row.host}
                        {row.orgSlug ? ` · ${row.orgSlug}/${row.projectSlug}` : ` · ${row.projectSlug}`}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-dim">
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
        </section>
        )}
  
        {(route.view === "registries" ||
          (route.view === "sources" &&
            route.sourceConfigure === "npm" &&
            (previewing || sourceSectionState.status === "ready"))) && (
        <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
          {route.view === "registries" ? (
            <h1 className="mb-5 font-display text-3xl tracking-tight text-snow">Private registries</h1>
          ) : null}
          <section id="watch-source-npm" tabIndex={-1} className="scroll-mt-20 rounded-lg border border-white/8 bg-panel p-5 outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          <h2 className="text-sm font-semibold text-snow">
            {route.view === "registries" ? "Registry credentials and packages" : "npm packages"}
          </h2>
          <p className="mt-2 text-sm text-mute">Packages watched as customers receive them from the registry.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
            packs in one pass — registry metadata only, no tarball download, no scan queue. Trial and
            Team installs can watch the npm scope that matches this GitHub login. New names on that
            public search are a Watch fact. The tarball is not downloaded. Other
            people’s packs are not added to this watch list. A later change of who published latest,
            or whether it used an npm trusted publisher, is a Watch fact. Email and OIDC config ids
            are not stored. Trial and Team installs then generate bounded
            lookalike names and watch dormant resurrection, release bursts, new dependencies that
            point at newly created packages, packument unpacked-size jumps, and whether npm
            attestations or registry signature keyids disappear or change. Those last facts are
            packument presence only — we do not fetch or verify attestations. Watch shows a
            deterministic signal total for a protected pack, decomposed into those facts. That is
            not a malware verdict. Trial and Team admins can assemble a human-reviewed evidence pack
            and publish a consumer advisory page. We never send that pack to npm or GitHub and never
            call it malware.
          </p>
          {previewing ? (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
              Preview cannot watch lookalike names. No invented incident.
            </p>
          ) : deskCoverage?.plan === "solo" ? (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
              Lookalike, dormant, burst, new-dependency, packument-size, provenance, namespace
              watchlists, identity evidence, and consumer advisories are on Team.
            </p>
          ) : ended ? (
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
              Subscribe to Team to watch lookalike names, an owned npm scope, and assemble identity
              evidence.
            </p>
          ) : identitySignals.status === "error" ? (
            <p className="mt-4 max-w-xl text-sm text-danger">{identitySignals.message}</p>
          ) : null}
          {!previewing && user && installations.length > 0 && identitySignals.status === "ready" && (
            <div className="mt-6 max-w-xl">
              <p className="text-xs uppercase tracking-[0.16em] text-dim">npm scope watchlist</p>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                Public npm search only. Cap {20} names. First check is a baseline. Later new names
                alert. Nothing is downloaded or auto-watched.
              </p>
              {installAdmin && namespaces.length === 0 ? (
                <form
                  className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (locked || savingNamespace) return;
                    const scope = namespaceScope.trim();
                    if (!scope) return;
                    setNamespaceError(null);
                    setSavingNamespace(true);
                    void (async () => {
                      try {
                        const response = await fetch("/api/namespaces", {
                          method: "POST",
                          credentials: "include",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            scope,
                            confirm: scope,
                            installationId: activeInstallId,
                          }),
                        });
                        const body = (await response.json()) as { error?: string };
                        if (!response.ok) throw new Error(body.error ?? "Could not watch that scope.");
                        setNamespaceScope("");
                        await refreshSignedIn(selectedInstallId);
                      } catch (error) {
                        setNamespaceError(
                          error instanceof Error ? error.message : "Could not watch that scope.",
                        );
                      } finally {
                        setSavingNamespace(false);
                      }
                    })();
                  }}
                >
                  <label className="min-w-0 flex-1">
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">Scope</span>
                    <input
                      value={namespaceScope}
                      onChange={(event) => setNamespaceScope(event.target.value)}
                      placeholder="@scope"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={locked}
                      className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                    />
                  </label>
                  <Button type="submit" disabled={locked || savingNamespace || !namespaceScope.trim()}>
                    {savingNamespace ? "Watching…" : "Watch scope"}
                  </Button>
                </form>
              ) : null}
              {namespaceError ? <p className="mt-3 text-sm text-danger">{namespaceError}</p> : null}
              {namespaces.length > 0 ? (
                <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                  {namespaces.map((row) => (
                    <li key={row.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-xs text-snow">{row.scope}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={locked || checkingNamespaceId === row.id}
                            onClick={() => {
                              setCheckingNamespaceId(row.id);
                              setNamespaceError(null);
                              void (async () => {
                                try {
                                  const response = await fetch(`/api/namespaces/${row.id}/check`, {
                                    method: "POST",
                                    credentials: "include",
                                  });
                                  const body = (await response.json()) as { error?: string };
                                  if (!response.ok) {
                                    throw new Error(body.error ?? "Could not check that scope.");
                                  }
                                  await refreshSignedIn(selectedInstallId);
                                } catch (error) {
                                  setNamespaceError(
                                    error instanceof Error ? error.message : "Could not check that scope.",
                                  );
                                } finally {
                                  setCheckingNamespaceId(null);
                                }
                              })();
                            }}
                          >
                            {checkingNamespaceId === row.id ? "Checking…" : "Check now"}
                          </Button>
                          {installAdmin ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={locked || confirmBusy}
                              onClick={() =>
                                beginConfirm({
                                  kind: "namespace-unprotect",
                                  id: row.id,
                                  expected: row.scope,
                                })
                              }
                            >
                              Stop
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-mute">
                        {row.names.length === 0
                          ? "No names on the last public search."
                          : row.names.join(", ")}
                      </p>
                      {confirmForm(confirming?.kind === "namespace-unprotect" && confirming.id === row.id)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
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
              <p className="text-xs uppercase tracking-[0.16em] text-dim">Private registry</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="text-xs uppercase tracking-[0.16em] text-dim">Origin</span>
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
                  <span className="text-xs uppercase tracking-[0.16em] text-dim">Token</span>
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
            <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Package name</span>
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Registry</span>
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
              <p className="text-xs uppercase tracking-[0.16em] text-dim">Protect identities</p>
              <p className="text-sm leading-relaxed text-mute">
                Up to 20 npm names, one per line or comma-separated. We read registry metadata only —
                no tarball download and no scan job. Protect only when the npm scope or GitHub
                repository field matches this install. Names you do not own stay off this watch list.
              </p>
              <label className="min-w-0">
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Package names</span>
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
                  <span className="text-xs uppercase tracking-[0.16em] text-dim">Registry</span>
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
            <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
            <ul className="mt-4 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
              {deskPackages.map((pkg) => {
                const diffState = diffByPackage[pkg.id];
                const protection = protections.find((row) => row.packageId === pkg.id);
                const candidates = candidatesByPackage[pkg.id] ?? [];
                const evidence = evidenceByPackage[pkg.id] ?? null;
                const risk = riskByPackage[pkg.id] ?? null;
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
                    {protection && identitySignals.status === "ready" && risk ? (
                      <div className="mt-4 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">
                          Identity signals {risk.total} / {risk.max}
                        </p>
                        <p className="mt-1 text-xs text-mute">{risk.note}</p>
                        {risk.signals.length > 0 ? (
                          <ul className="mt-2 divide-y divide-white/5">
                            {risk.signals.map((signal) => (
                              <li
                                key={signal.kind}
                                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                              >
                                <p className="text-xs text-snow">{signal.title}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-dim">
                                  {signal.count > 1 ? `${signal.count} · ` : ""}
                                  {signal.points}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-mute">No open identity signals.</p>
                        )}
                      </div>
                    ) : null}
                    {protection && identitySignals.status === "ready" && candidates.length > 0 ? (
                      <div className="mt-4 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">Lookalike names</p>
                        <ul className="mt-2 divide-y divide-white/5">
                          {candidates.map((candidate) => (
                            <li key={candidate.id} className="py-3">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-mono text-xs text-snow">{candidate.candidateName}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-dim">
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
                                    <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                    {protection && canReadEvidence ? (
                      <div className="mt-4 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">
                          Identity evidence
                        </p>
                        {evidence ? (
                          <>
                            <p className="mt-2 text-xs text-mute">
                              Assembled {new Date(evidence.assembledAt).toLocaleString()}. Not a malware
                              verdict. Not sent to npm or GitHub.
                            </p>
                            {evidence.advisory.enabled && evidence.advisory.path ? (
                              <p className="mt-2 text-xs text-mute">
                                Public advisory{" "}
                                <a
                                  href={evidence.advisory.path}
                                  className="text-snow underline-offset-2 hover:underline"
                                >
                                  {evidence.advisory.path}
                                </a>
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={downloadingEvidenceId === pkg.id}
                                onClick={() => {
                                  setDownloadingEvidenceId(pkg.id);
                                  try {
                                    const blob = new Blob(
                                      [JSON.stringify(evidence.takedown, null, 2)],
                                      { type: "application/json" },
                                    );
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `nospoilers-identity-${pkg.package_name.replaceAll("/", "-")}.json`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                  } finally {
                                    setDownloadingEvidenceId(null);
                                  }
                                }}
                              >
                                {downloadingEvidenceId === pkg.id ? "Saving…" : "Download evidence"}
                              </Button>
                              {canManageEvidence ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={previewing || locked || confirmBusy}
                                    onClick={() =>
                                      beginConfirm({
                                        kind: "identity-evidence",
                                        id: pkg.id,
                                        expected: pkg.package_name,
                                      })
                                    }
                                  >
                                    Reassemble
                                  </Button>
                                  {evidence.advisory.enabled ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={previewing || locked || confirmBusy}
                                      onClick={() =>
                                        beginConfirm({
                                          kind: "identity-unpublish-advisory",
                                          id: pkg.id,
                                          expected: pkg.package_name,
                                        })
                                      }
                                    >
                                      Unpublish advisory
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={previewing || locked || confirmBusy}
                                      onClick={() =>
                                        beginConfirm({
                                          kind: "identity-publish-advisory",
                                          id: pkg.id,
                                          expected: pkg.package_name,
                                        })
                                      }
                                    >
                                      Publish advisory
                                    </Button>
                                  )}
                                </>
                              ) : null}
                            </div>
                          </>
                        ) : canManageEvidence ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            disabled={previewing || locked || confirmBusy}
                            onClick={() =>
                              beginConfirm({
                                kind: "identity-evidence",
                                id: pkg.id,
                                expected: pkg.package_name,
                              })
                            }
                          >
                            Assemble evidence
                          </Button>
                        ) : (
                          <p className="mt-2 text-xs text-mute">No evidence pack yet.</p>
                        )}
                        {confirmForm(
                          (confirming?.kind === "identity-evidence" ||
                            confirming?.kind === "identity-publish-advisory" ||
                            confirming?.kind === "identity-unpublish-advisory") &&
                            confirming.id === pkg.id,
                        )}
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
                            <p className="text-xs uppercase tracking-[0.16em] text-dim">
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
                            <ul className="mt-3 flex flex-col gap-1 font-mono text-xs text-mute">
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
        </section>
        )}
  
        {route.view === "tokens" && (
        <section className={`mt-4 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
          <h1 className="font-display text-3xl tracking-tight text-snow">Scan API tokens</h1>
          <p className="mt-2 text-sm text-mute">Credentials for scanning packed artifacts from CI.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
            Mint a token to <code className="text-snow">POST</code> a packed artifact to{" "}
            <code className="text-snow">/api/v1/scan</code>. We hash the secret, show it once, and
            delete the bytes after the scan. Generated Setup CI vendors a composite Action in your
            repo and needs this token plus repository variable{" "}
            <code className="text-snow">NOSPOILERS_API_URL</code>. This product repository still
            scans locally with <code className="text-snow">uses: ./</code>.
          </p>
          {!previewing && hostedOrigin ? (
            <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-dim">
                Repository variable NOSPOILERS_API_URL
              </p>
              <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
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
                    <span className="text-xs uppercase tracking-[0.16em] text-dim">Name</span>
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
                  <p className="text-xs uppercase tracking-[0.16em] text-dim">
                    Copy now. We will not show this again.
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-dim">
                    Repository secret NOSPOILERS_API_TOKEN
                  </p>
                  <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
                    {revealedScanToken}
                  </pre>
                  {hostedOrigin ? (
                    <>
                      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-dim">
                        Repository variable NOSPOILERS_API_URL
                      </p>
                      <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-snow">
                        {hostedOrigin}
                      </pre>
                    </>
                  ) : null}
                </div>
              ) : null}
              {scanTokens.length === 0 ? (
                <p className="mt-6 text-sm leading-relaxed text-mute">No scan tokens yet.</p>
              ) : (
                <ul className="mt-4 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                  {scanTokens.map((token) => (
                    <li key={token.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-snow">{token.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-dim">{token.token_prefix}…</p>
                        <p className="mt-1 text-xs text-dim">
                          created {new Date(token.created_at).toLocaleDateString()}
                          {token.last_used_at
                            ? ` · last used ${new Date(token.last_used_at).toLocaleString()}`
                            : " · never used"}
                          {token.created_by_login ? ` · @${token.created_by_login}` : ""}
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
        )}
  
        {route.view === "releases" && (
        <section className="mt-4">
          <h1 className="font-display text-3xl tracking-tight text-snow">Releases and receipts</h1>
          <p className="mt-2 text-sm text-mute">Sealed artifact revisions, policy results, and delivery evidence.</p>
          <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
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
            Trial and Team can refresh GitHub and npm attestation documents for a sealed digest.
            The adapter records presence, subject digest, and builder id. It does not verify
            Sigstore signatures and is not a malware verdict. Solo is 403. Unpaid is 402.
            A Team signing policy can require a present GitHub or npm document, or a builder
            prefix, before approve-to-ship. Expired policies do not block. Clearing removes
            the row. This is not Sigstore verification.
          </p>
          {previewing ? (
            <p className="mt-4 text-sm leading-relaxed text-mute">
              Preview cannot approve or export releases. No invented incident.
            </p>
          ) : deskCoverage?.plan === "solo" ? (
            <p className="mt-4 text-sm leading-relaxed text-mute">
              Subscribe to Team to approve shipping releases, place legal hold, export the ledger,
              refresh GitHub or npm attestations, and set a signing policy.
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
          {attestationError ? <p className="mt-3 text-sm text-danger">{attestationError}</p> : null}
          {datasetState.releases.status === "loading" ? (
            <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
          ) : datasetState.releases.status === "error" ? (
            <WatchSectionError
              className="mt-6 max-w-2xl"
              message={datasetState.releases.message}
              onRetry={() => void retryDeskSection("releases")}
            />
          ) : previewing ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
          ) : releases.length === 0 ? (
            <p className="mt-6 text-sm leading-relaxed text-mute">No sealed releases yet.</p>
          ) : (
            <div className="mt-6 grid overflow-hidden rounded-lg border border-white/8 bg-panel lg:grid-cols-[18rem_minmax(0,1fr)]">
              <ol className="max-h-[52rem] divide-y divide-white/5 overflow-auto border-b border-white/8 lg:border-b-0 lg:border-r">
                {releases.map((release) => (
                  <li key={`release-summary-${release.id}`}>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-4 py-4 text-left hover:bg-white/5",
                        selectedRelease?.id === release.id && "bg-white/5",
                      )}
                      onClick={() =>
                        navigate(
                          watchHref(watchPath("releases"), search, { release: release.id }),
                        )
                      }
                    >
                      <strong className="block truncate font-mono text-sm text-snow">
                        {release.coordinate}
                      </strong>
                      <span className="mt-2 block text-xs text-dim">
                        {release.channel} · {release.artifactSha256.slice(0, 12)}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs uppercase tracking-[0.16em]",
                          release.mismatch ||
                            release.receiptStatus === "failed-policy" ||
                            release.receiptStatus === "inconclusive"
                            ? "text-danger"
                            : "text-dim",
                        )}
                      >
                        {release.mismatch
                          ? "digest changed"
                          : release.receiptStatus?.replace("-", " ") ?? "sealed"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <ul className="min-w-0 px-5">
              {selectedRelease ? [selectedRelease].map((release) => (
                <li key={release.id} className="py-5">
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
                        <span className="text-xs uppercase tracking-[0.16em] text-danger">
                          digest changed
                        </span>
                      ) : null}
                      {receiptStatusMark(release.receiptStatus)}
                      {release.approval?.decision === "approved" ? (
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">
                          approved to ship
                        </span>
                      ) : null}
                      {release.approval?.decision === "rejected" ? (
                        <span className="text-xs uppercase tracking-[0.16em] text-danger">
                          rejected
                        </span>
                      ) : null}
                      {release.legalHold?.active ? (
                        <span className="text-xs uppercase tracking-[0.16em] text-snow">
                          legal hold
                        </span>
                      ) : null}
                      {!release.mismatch && !release.receiptStatus ? (
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">sealed</span>
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
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
                  {(release.attestations ?? []).length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {(release.attestations ?? []).map((row) => (
                        <li key={`${row.source}-${row.createdAt}`} className="font-mono text-xs text-mute">
                          {row.source} attestation · {row.status.replace("_", " ")}
                          {row.predicateType ? ` · ${row.predicateType}` : ""}
                          {row.builderId ? ` · ${row.builderId}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canGovernReleases ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAttestationError(null);
                          beginConfirm({
                            kind: "release-attest",
                            id: release.id,
                            expected: release.coordinate,
                          });
                        }}
                      >
                        Refresh attestations
                      </Button>
                    </div>
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
                        <span className="text-xs uppercase tracking-[0.16em] text-dim">
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
              )) : null}
              </ul>
            </div>
          )}
        </section>
        )}
  
        {route.view === "policy" && (
        <section className="mt-4">
          <h2 className="text-xs uppercase tracking-[0.22em] text-dim">Allowlist and baseline</h2>
          <p className="mt-2 text-sm text-mute">Time-bound exceptions and the approved comparison receipt.</p>
          <p className="watch-guidance mt-3 max-w-2xl text-sm leading-relaxed text-mute">
            Exceptions are exact-rule, attributable, and they expire. They never suppress a different
            rule. Approve a packed receipt as the shipping baseline; later diffs use that receipt
            instead of whichever scan happened last.
          </p>
          {!previewing && installAdmin && (
            <label className="mt-6 block max-w-xl">
              <span className="text-xs uppercase tracking-[0.16em] text-dim">Baseline reason</span>
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
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Rule</span>
                <input
                  value={allowRule}
                  onChange={(event) => setAllowRule(event.target.value)}
                  placeholder="SRC-001"
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <label>
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Path glob</span>
                <input
                  value={allowPath}
                  onChange={(event) => setAllowPath(event.target.value)}
                  placeholder="**/*.d.ts"
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <label>
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Reason</span>
                <input
                  value={allowReason}
                  onChange={(event) => setAllowReason(event.target.value)}
                  placeholder="Published TypeScript types"
                  disabled={locked}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <label>
                <span className="text-xs uppercase tracking-[0.16em] text-dim">Expires</span>
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
            <ul className="mt-6 divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
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
        )}
    </>
  );
}
