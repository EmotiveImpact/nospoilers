import type {
  PermissionTest,
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
  TimelineView,
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
  ReceiptScanStatus,
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
} from "@/watch/types";
import type { WatchSectionState } from "@/watch/data-state";
import type { Coverage } from "@/coverage";
import { createContext, useContext, type ReactNode } from "react";

export type WatchScreenContext = {
  AlertDeskItem: ({ alert, previewing, events, busy, note, assignee, error, onNote, onAssignee, onAction, }: { alert: Alert; previewing: boolean; events: AlertEvent[]; busy: boolean; note: string; assignee: string; error: string | null; onNote: (value: string) => void; onAssignee: (value: string) => void; onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void; }) => import("react").JSX.Element;
  AuditScreen: ({ previewing, audit, installationId, }: { previewing: boolean; audit: { status: "loading"; } | { status: "solo"; } | { status: "ended"; } | { status: "error"; message: string; } | { status: "ready"; rows: { id: number; at: string; actorLogin: string; action: string; summary: string; }[]; }; installationId: number | null; }) => import("react").JSX.Element;
  Avatar: ({ className, ...props }: import("react").ComponentProps<"span">) => import("react").JSX.Element;
  AvatarFallback: ({ className, ...props }: import("react").ComponentProps<"span">) => import("react").JSX.Element;
  AvatarImage: ({ className, alt, ...props }: import("react").ComponentProps<"img">) => import("react").JSX.Element;
  Button: <T extends import("react").ElementType = "button">({ as, className, variant, size, ...props }: { as?: T | undefined; className?: string; } & import("class-variance-authority").VariantProps<(props?: ({ variant?: "default" | "outline" | "ghost" | "danger" | null | undefined; size?: "default" | "sm" | "lg" | null | undefined; } & import("class-variance-authority/types").ClassProp) | undefined) => string> & Omit<import("react").PropsWithoutRef<import("react").ComponentProps<T>>, "className" | "as">) => import("react").JSX.Element;
  CoverageLock: ({ title, variant, children, }: { title: string; variant?: "scan" | "watch"; children?: import("react").ReactNode; }) => import("react").JSX.Element;
  DELETE_PACK_ASSETS_COPY: string;
  DISABLE_WORKFLOW_COPY: string;
  FAIR_USE_EXHAUSTED: string;
  FAIR_USE_WARNING: string;
  GithubResponseResult: ({ view }: { view: GithubResponseView; }) => import("react").JSX.Element;
  MAKE_PRIVATE_COPY: string;
  RemediationPrResult: ({ view }: { view: RemediationPrView; }) => import("react").JSX.Element;
  RetentionScreen: ({ previewing, ended, retention, draft, canChange, busy, confirmation, onDraft, onSave, }: { previewing: boolean; ended: boolean; retention: { status: "loading"; } | { status: "error"; message: string; } | { status: "ready"; days: 0 | 90 | 180 | 365; }; draft: 0 | 90 | 180 | 365; canChange: boolean; busy: boolean; confirmation: import("react").ReactNode; onDraft: (days: 0 | 90 | 180 | 365) => void; onSave: () => void; }) => import("react").JSX.Element;
  SIGNING_POLICY_CLEAR_CONFIRM: string;
  SIGNING_POLICY_CONFIRM: string;
  SetupPrResult: ({ view }: { view: SetupPrView; }) => import("react").JSX.Element;
  SetupStatusResult: ({ view }: { view: SetupStatusView; }) => import("react").JSX.Element;
  TimelineScreen: ({ previewing, timeline, alerts, alertState, onRetryTimeline, onRetryAlerts, }: { previewing: boolean; timeline: { status: "loading"; } | { status: "solo"; } | { status: "ended"; } | { status: "error"; message: string; } | { status: "ready"; entries: { type: "alert" | "alert_event" | "delivery"; at: string; alertId: number | null; title: string | null; kind: string | null; fullName: string | null; action: string | null; actorLogin: string | null; deliveryStatus: "sent" | "failed" | null; inventedIncident: false | null; }[]; days: number; }; alerts: import("@/watch/verdict").DeskAlert[]; alertState: WatchSectionState; onRetryTimeline: () => void; onRetryAlerts: () => void; }) => import("react").JSX.Element;
  WatchAlertsWorkspace: ({ alerts, rows, selected, events, previewing, ended, busy, note, assignee, error, exportError, state, activityState, detailOpen, tab, teamOnly, onSelect, onBack, onRetry, onRetryActivity, onTab, onNote, onAssignee, onAction, onExport, }: { alerts: import("@/components/WatchAlertsWorkspace.tsx").WatchAlertDetail[]; rows: import("@/watch/view-models").AlertListViewModel[]; selected: import("@/components/WatchAlertsWorkspace.tsx").WatchAlertDetail | null; events: import("@/watch/useWatchDeskController.ts").AlertActivityEvent[]; previewing: boolean; ended: boolean; busy: boolean; note: string; assignee: string; error: string | null; exportError: string | null; state: WatchSectionState; activityState: WatchSectionState; detailOpen: boolean; tab: import("@/watch/routes.ts").AlertTab; teamOnly: boolean; onSelect: (alertId: number) => void; onBack: () => void; onRetry: () => void; onRetryActivity: () => void; onTab: (tab: import("@/watch/routes.ts").AlertTab) => void; onNote: (value: string) => void; onAssignee: (value: string) => void; onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void; onExport: () => void; }) => import("react").JSX.Element;
  WatchNotificationSummary: ({ destinations, routes, }: { destinations: { id: number; kind: string; host: string; lastDeliveryStatus: string | null; }[]; routes: { id: number; minSeverity: string; repoFullName: string | null; packageName: string | null; teamLogin: string | null; }[]; }) => import("react").JSX.Element;
  WatchOverview: ({ search, ended, githubPaused, installUrl, alerts, sources, packsRead, failedPolicy, queueDepth, lastRunLabel, setup, state, onRetry, }: { search: string; ended: boolean; githubPaused: boolean; installUrl?: string; alerts: import("@/watch/verdict").DeskAlert[]; sources: import("@/watch/view-models").WatchSourceViewModel[]; packsRead: number; failedPolicy: number; queueDepth: number; lastRunLabel: string; setup: import("@/watch/view-models").WatchSetupViewModel; state: WatchSectionState; onRetry: () => void; }) => import("react").JSX.Element;
  WatchSectionError: ({ message, onRetry, className, }: { message: string; onRetry: () => void; className?: string; }) => import("react").JSX.Element;
  WatchSkeleton: ({ variant, className, }: { variant?: "cards" | "list" | "detail"; className?: string; }) => import("react").JSX.Element;
  WatchSourcesSummary: ({ mode, sources, setup, admin, search, filter, attention, selectedSourceKey, state, onRetry, }: { mode: "sources" | "setup"; sources: import("@/watch/view-models").WatchSourceViewModel[]; setup: import("@/watch/view-models").WatchSetupViewModel; admin?: boolean; search?: string; filter?: import("@/watch/routes.ts").SourceFilter; attention?: boolean; selectedSourceKey?: string | null; state: WatchSectionState; onRetry: () => void; }) => import("react").JSX.Element;
  activeInstallId: number | null;
  adminCount: number;
  adminOnly: boolean;
  alertAssignees: Record<number, string>;
  alertBusyId: number | null;
  alertErrorById: Record<number, string>;
  alertEvents: Record<number, AlertEvent[]>;
  alertNotes: Record<number, string>;
  alertSectionState: { status: "loading"; } | { status: "error"; message: string; } | { status: "ready"; };
  alerts: LoadState<{ alerts: Alert[]; }>;
  allowExpires: string;
  allowPath: string;
  allowReason: string;
  allowReasonByCandidate: Record<number, string>;
  allowRule: string;
  approvingId: number | null;
  attachingReleaseId: number | null;
  attestationError: string | null;
  audit: AuditView;
  baselineByPackage: Record<number, BaselineView | null>;
  baselineReason: string;
  beginConfirm: (next: Confirming) => void;
  canChangeRetention: boolean;
  canExportReleases: boolean;
  canGovernReleases: boolean;
  canManageEvidence: boolean;
  canManageRoles: boolean;
  canManageSigningPolicy: boolean;
  canPublishVerify: boolean;
  canReadEvidence: boolean;
  candidatesByPackage: Record<number, IdentityCandidateView[]>;
  checkingId: number | null;
  checkingMapId: number | null;
  checkingNamespaceId: number | null;
  checkingOriginId: number | null;
  cn: (...inputs: import("clsx").ClassValue[]) => string;
  confirmBusy: boolean;
  confirmForm: (match: boolean) => import("react").JSX.Element | null;
  confirming: Confirming | null;
  controller: import("@/watch/useWatchDeskController.ts").WatchDeskController;
  datasetState: Record<DeskDataset, WatchSectionState>;
  deletePackAssetsConfirm: (fullName: string) => string;
  deliveries: NotificationDelivery[];
  deliveryError: string | null;
  deliveryUrlByRelease: Record<number, string>;
  deskAlerts: Alert[];
  deskCoverage: Coverage | undefined;
  deskPackages: WatchedPackage[];
  deskRepos: Repo[];
  destinationKindLabel: (kind: string) => string;
  destinations: NotificationDestination[];
  diffByPackage: Record<number, ReleaseDiffView | { error: string; }>;
  diffingId: number | null;
  downloadingEvidenceId: number | null;
  downloadingReceiptId: number | null;
  emailAddress: string;
  ended: boolean;
  evidenceByPackage: Record<number, IdentityEvidenceView | null>;
  exceptions: PolicyExceptionView[];
  exportError: string | null;
  fairUse: FairUseStatus;
  formatExposure: (ms: number | undefined, createdAt: string, resolvedAt: string | null | undefined) => string;
  formatSealedBytes: (bytes: number) => string;
  githubApp: boolean;
  githubByRepo: Record<number, GithubResponseView>;
  githubPaused: boolean;
  githubRunnersReachable: boolean | undefined;
  governanceReasonByRelease: Record<number, string>;
  hostedOrigin: string | undefined;
  identitySignals: IdentitySignalsView;
  importError: string | null;
  importNames: string;
  importResults: ProtectionImportResult[] | null;
  importingPackages: boolean;
  installAdmin: boolean;
  installUrl: string | undefined;
  installations: { id: number; account_login: string; account_type: string; suspended?: boolean; trialEndsAt?: string | null; plan?: string | null; role?: "admin" | "member"; lastPermissionTestAt?: string | null; lastPermissionTest?: PermissionTest | null; }[];
  inviteLogin: string;
  inviteRole: "admin" | "member";
  invites: TeamInvite[];
  jiraEmail: string;
  jiraProjectKey: string;
  jiraSite: string;
  jiraToken: string;
  jobSummary: JobSummary;
  jobs: TenantJob[];
  kindLabel: (kind: string) => string;
  ledgerExportError: string | null;
  listedAlerts: Alert[];
  loadJson: <T>(url: string, init?: RequestInit, fetcher?: typeof fetch) => Promise<T>;
  locked: boolean;
  makePrivateConfirm: (fullName: string) => string;
  mapDestinations: MapCustodyDestination[];
  mapError: string | null;
  mapHost: string;
  mapKind: "sentry" | "bugsnag";
  mapOrg: string;
  mapProject: string;
  mapToken: string;
  members: TeamMember[];
  membersError: string | null;
  mintingScanToken: boolean;
  namespaceError: string | null;
  namespaceScope: string;
  namespaces: ProtectedNamespace[];
  navigate: (to: string) => void;
  originError: string | null;
  originUrl: string;
  origins: LoadState<{ origins: WatchedOrigin[]; }>;
  overviewSectionState: WatchSectionState;
  packageError: string | null;
  packageName: string;
  packages: LoadState<{ packages: WatchedPackage[]; }>;
  pagerDutyKey: string;
  parseWorkflowPath: (raw: string) => string | null;
  previewing: boolean;
  probingSetupId: number | null;
  protectingId: number | null;
  protectionImportStatusLabel: (status: ProtectionImportResult["status"]) => string;
  protections: PackageProtection[];
  receiptError: string | null;
  receiptStatusMark: (status: ReceiptScanStatus | null) => import("react").JSX.Element | null;
  refreshSignedIn: (installationId: number | null) => Promise<void>;
  registries: NpmRegistry[];
  registryError: string | null;
  registryOriginInput: string;
  registryToken: string;
  releases: ReleaseRevision[];
  remediateByRepo: Record<number, RemediationPrView>;
  remediatingId: number | null;
  repos: LoadState<{ repos: Repo[]; }>;
  retention: RetentionView;
  retentionConfirmToken: (days: RetentionDays) => string;
  retentionDraft: RetentionDays;
  retryDeskSection: (section: "alerts" | "sources" | "overview" | "releases" | "notifications" | "timeline") => Promise<void | [void, void]>;
  revealedScanToken: string | null;
  riskByPackage: Record<number, IdentityRiskView | null>;
  route: import("@/watch/routes.ts").WatchRoute;
  routeDestinationId: string;
  routeMinSeverity: "all" | "warn" | "critical";
  routeMinSeverityLabel: (value: string) => string;
  routePackage: string;
  routeRepo: string;
  routeTeam: string;
  routeTestPackage: string;
  routeTestRepo: string;
  routeTestSeverity: "warn" | "critical" | "info";
  routes: NotificationRoute[];
  savingAllow: boolean;
  savingEmail: boolean;
  savingJira: boolean;
  savingMap: boolean;
  savingNamespace: boolean;
  savingPagerDuty: boolean;
  savingRegistry: boolean;
  savingRoute: boolean;
  savingSiem: boolean;
  savingSlack: boolean;
  scanError: string | null;
  scanTokenError: string | null;
  scanTokenName: string;
  scanTokens: ScanApiToken[];
  scanningId: number | null;
  scopedApi: (path: string, installationId: number | null) => string;
  search: string;
  selectedAlert: Alert | null;
  selectedInstall: { id: number; account_login: string; account_type: string; suspended?: boolean; trialEndsAt?: string | null; plan?: string | null; role?: "admin" | "member"; lastPermissionTestAt?: string | null; lastPermissionTest?: PermissionTest | null; } | null;
  selectedInstallId: number | null;
  selectedRelease: ReleaseRevision;
  setAlertAssignees: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setAlertBusyId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setAlertErrorById: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setAlertEvents: import("react").Dispatch<import("react").SetStateAction<Record<number, AlertEvent[]>>>;
  setAlertNotes: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setAlerts: import("react").Dispatch<import("react").SetStateAction<LoadState<{ alerts: Alert[]; }>>>;
  setAllowExpires: import("react").Dispatch<import("react").SetStateAction<string>>;
  setAllowPath: import("react").Dispatch<import("react").SetStateAction<string>>;
  setAllowReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setAllowReasonByCandidate: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setAllowRule: import("react").Dispatch<import("react").SetStateAction<string>>;
  setApprovingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setAttachingReleaseId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setAttestationError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setBaselineReason: import("react").Dispatch<import("react").SetStateAction<string>>;
  setCheckingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setCheckingMapId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setCheckingNamespaceId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setCheckingOriginId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setDeliveryError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setDeliveryUrlByRelease: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setDiffByPackage: import("react").Dispatch<import("react").SetStateAction<Record<number, ReleaseDiffView | { error: string; }>>>;
  setDiffingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setDownloadingEvidenceId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setDownloadingReceiptId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setEmailAddress: import("react").Dispatch<import("react").SetStateAction<string>>;
  setExportError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setGithubByRepo: import("react").Dispatch<import("react").SetStateAction<Record<number, GithubResponseView>>>;
  setGovernanceReasonByRelease: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setImportError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setImportNames: import("react").Dispatch<import("react").SetStateAction<string>>;
  setImportResults: import("react").Dispatch<import("react").SetStateAction<ProtectionImportResult[] | null>>;
  setImportingPackages: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setInviteLogin: import("react").Dispatch<import("react").SetStateAction<string>>;
  setInviteRole: import("react").Dispatch<import("react").SetStateAction<"admin" | "member">>;
  setJiraEmail: import("react").Dispatch<import("react").SetStateAction<string>>;
  setJiraProjectKey: import("react").Dispatch<import("react").SetStateAction<string>>;
  setJiraSite: import("react").Dispatch<import("react").SetStateAction<string>>;
  setJiraToken: import("react").Dispatch<import("react").SetStateAction<string>>;
  setLedgerExportError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setMapError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setMapHost: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMapKind: import("react").Dispatch<import("react").SetStateAction<"sentry" | "bugsnag">>;
  setMapOrg: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMapProject: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMapToken: import("react").Dispatch<import("react").SetStateAction<string>>;
  setMe: import("react").Dispatch<import("react").SetStateAction<LoadState<Me>>>;
  setMintingScanToken: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setNamespaceError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setNamespaceScope: import("react").Dispatch<import("react").SetStateAction<string>>;
  setOriginError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setOriginUrl: import("react").Dispatch<import("react").SetStateAction<string>>;
  setPackageError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setPackageName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setPagerDutyKey: import("react").Dispatch<import("react").SetStateAction<string>>;
  setProbingSetupId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setProtectingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setReceiptError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setRegistryError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setRegistryOriginInput: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRegistryToken: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRemediateByRepo: import("react").Dispatch<import("react").SetStateAction<Record<number, RemediationPrView>>>;
  setRemediatingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setRetentionDraft: import("react").Dispatch<import("react").SetStateAction<RetentionDays>>;
  setRevealedScanToken: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setRouteDestinationId: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteMinSeverity: import("react").Dispatch<import("react").SetStateAction<"all" | "warn" | "critical">>;
  setRoutePackage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteRepo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteTeam: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteTestPackage: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteTestRepo: import("react").Dispatch<import("react").SetStateAction<string>>;
  setRouteTestSeverity: import("react").Dispatch<import("react").SetStateAction<"warn" | "critical" | "info">>;
  setSavingAllow: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingEmail: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingJira: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingMap: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingNamespace: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingPagerDuty: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingRegistry: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingRoute: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingSiem: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSavingSlack: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setScanError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setScanTokenError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setScanTokenName: import("react").Dispatch<import("react").SetStateAction<string>>;
  setScanningId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setSetupByRepo: import("react").Dispatch<import("react").SetStateAction<Record<number, SetupPrView>>>;
  setSetupStatusByRepo: import("react").Dispatch<import("react").SetStateAction<Record<number, SetupStatusView>>>;
  setSetuppingId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setSiemWebhook: import("react").Dispatch<import("react").SetStateAction<string>>;
  setSigningDraft: import("react").Dispatch<import("react").SetStateAction<SigningPolicyDraft>>;
  setSigningError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSlackError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setSlackWebhook: import("react").Dispatch<import("react").SetStateAction<string>>;
  setTestError: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setTestingInstallId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setTestingRoute: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTestingSlackId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setVerifyingLocationId: import("react").Dispatch<import("react").SetStateAction<number | null>>;
  setWatchRegistryOrigin: import("react").Dispatch<import("react").SetStateAction<string>>;
  setWatchingOrigin: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setWatchingPackage: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setWorkflowDraft: import("react").Dispatch<import("react").SetStateAction<Record<number, string>>>;
  setup: import("@/watch/view-models").WatchSetupViewModel;
  setupByRepo: Record<number, SetupPrView>;
  setupSectionState: WatchSectionState;
  setupStatusByRepo: Record<number, SetupStatusView>;
  setuppingId: number | null;
  siemWebhook: string;
  signingDraft: SigningPolicyDraft;
  signingError: string | null;
  signingPolicy: SigningPolicyView;
  slackError: string | null;
  slackWebhook: string;
  sourceRows: import("@/watch/view-models").WatchSourceViewModel[];
  sourceSectionState: WatchSectionState;
  teamOnly: boolean;
  testError: string | null;
  testingInstallId: number | null;
  testingRoute: boolean;
  testingSlackId: number | null;
  timeline: TimelineView;
  user: { id: string; login: string; avatarUrl: string | null; } | null;
  verifyingLocationId: number | null;
  watchHref: (path: string, search: string, extra?: { install?: number | null; alert?: number | null; release?: number | null; source?: string | null; sourceType?: import("@/watch/routes.ts").SourceFilter | null; attention?: boolean | null; configure?: import("@/watch/routes.ts").SourceConfigure | null; tab?: import("@/watch/routes.ts").AlertTab | null; }) => string;
  watchPath: (view: import("@/watch/routes.ts").WatchView) => string;
  watchRegistryOrigin: string;
  watchingOrigin: boolean;
  watchingPackage: boolean;
  workflowDraft: Record<number, string>;
  workflowIsNoSpoilersScan: (workflowPath: string) => boolean;
};

const Context = createContext<WatchScreenContext | null>(null);

export function WatchScreenProvider({ value, children }: { value: WatchScreenContext; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWatchScreenContext(): WatchScreenContext {
  const value = useContext(Context);
  if (!value) throw new Error("Watch screen context is unavailable.");
  return value;
}
