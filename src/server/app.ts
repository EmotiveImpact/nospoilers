import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { bestCoverage, coverageFrom } from "../coverage.ts";
import { ENGINE_VERSION, scan } from "../scanner/index.ts";
import { validateExceptionInput } from "../policy.ts";
import { verifyReceipt } from "../receipt.ts";
import { diffFingerprints, diffManifests, mergeReleaseDiff } from "../release-diff.ts";
import type { AppConfig } from "./config.ts";
import {
  databaseMode,
  githubAppConfigured,
  jobProcessingMode,
  processRunsHttp,
  resendConfigured,
  stripeConfigured,
  stripePriceMap,
} from "./config.ts";
import { serveUi, uiIndexExists } from "./static.ts";
import {
  EMAIL_ADDRESS_ERROR,
  emailPlanDeniedFromBilling,
  emailTestText,
  parseEmailAddress,
  postResendEmail,
} from "./email.ts";
import {
  STRIPE_ADMIN_ERROR,
  STRIPE_NOT_LIVE_ERROR,
  STRIPE_PLAN_ERROR,
  STRIPE_SUBSCRIBE_FIRST_ERROR,
  STRIPE_UNAVAILABLE_ERROR,
  StripeApiError,
  createStripePort,
  parseStripeEvent,
  parseStripeInterval,
  parseStripePlan,
  remainingTrialDays,
  stripeEventPatch,
  stripePriceId,
  stripeSubscriptionCovers,
  verifyStripeSignature,
  type StripePort,
} from "./stripe.ts";
import { cookieSettings } from "./cookies.ts";
import { authOrigin } from "./auth-origin.ts";
import { GithubApiError, type GithubPort } from "./github.ts";
import {
  ADMINISTRATION_DENIED,
  DELETE_PACK_ASSETS_COPY,
  DISABLE_WORKFLOW_COPY,
  MAKE_PRIVATE_COPY,
  RESPONSE_PERMISSIONS,
  deletePackAssetsConfirm,
  disableWorkflowConfirm,
  makePrivateConfirm,
  parseWorkflowPath,
  workflowIsNoSpoilersScan,
} from "./github-response.ts";
import { hasWrite } from "./install-test.ts";
import {
  REMEDIATION_BRANCH,
  REMEDIATION_PERMISSIONS,
  remediationBundle,
  remediationPullRequestBody,
} from "./remediation.ts";
import {
  SETUP_PERMISSIONS,
  SETUP_BRANCH,
  SETUP_WORKFLOW_PATH,
  setupFiles,
  setupWorkflowYaml,
} from "./setup-workflow.ts";
import { probeRepoSetupStatus } from "./setup-status.ts";
import { hostedScanOrigin } from "./hosted-origin.ts";
import { verifyGitHubSignature } from "./hmac.ts";
import { createNpmPort, type NpmPort } from "./npm.ts";
import {
  checkWatchedPackage,
  connectWatchedPackage,
  importProtectedPackages,
  protectWatchedPackage,
} from "./npm-watch.ts";
import {
  NAMESPACE_INVALID_ERROR,
  NAMESPACE_SOLO_ERROR,
  NAMESPACE_UNKNOWN_ERROR,
  NAMESPACE_UNPAID_ERROR,
  enqueueNamespaceCheck,
  normalizeNpmScope,
  protectNamespace,
  publicNamespace,
  unprotectNamespace,
} from "./namespace-watch.ts";
import {
  checkWatchedOrigin,
  connectWatchedOrigin,
  webOriginScanDeliveryId,
} from "./web-watch.ts";
import {
  domainVerificationChallenge,
  hashDeployToken,
  mintDeployToken,
  mintDomainVerificationChallenge,
  parseDeployBearer,
  verifyDomainOwnership,
  type DomainVerificationMethod,
} from "./domain-verification.ts";
import {
  parseMapDestination,
  validateMapToken,
} from "./map-custody.ts";
import {
  checkMapDestination,
  enqueueMapCustodyAfterConnect,
} from "./map-watch.ts";
import {
  isPublicNpmOrigin,
  MAX_NPM_REGISTRIES,
  parseRegistryOrigin,
  validateRegistryToken,
} from "./npm-registry.ts";
import { clientKey, createRateLimiter, retryAfterSeconds } from "./rate-limit.ts";
import {
  acknowledgeDisclosureCase,
  addDisclosureAttachment,
  assignDisclosureCase,
  buildDisclosureReport,
  createDisclosureCase,
  createDisclosureTemplate,
  createDoNotContactEntry,
  DisclosureError,
  DISCLOSURE_DNC_ERROR,
  DISCLOSURE_DUPLICATE_ERROR,
  DISCLOSURE_REVIEW_ERROR,
  findDncMatches,
  findDuplicateMatches,
  listDisclosureOrganizations,
  loadDisclosureCase,
  outreachBlocked,
  persistConfirmedDuplicates,
  previewDisclosureCase,
  readDisclosureAttachment,
  recordVendorReply,
  researcherWorkloadFromCases,
  rescanDisclosureCase,
  reviewDisclosureCase,
  sweepExpiredDisclosureEvidence,
  toDisclosureSummary,
  toDncView,
  toTemplateView,
  updateDisclosureCase,
  updateDisclosureTemplate,
} from "./disclosure.ts";
import { renderDisclosureReportHtml, renderDisclosureReportPdf } from "./disclosure-report.ts";
import {
  DISCLOSURE_DESTINATION_UNKNOWN_ERROR,
  disclosureDestinationConfirmValue,
  notifyDisclosureDestination,
  publicDisclosureDestination,
  saveDisclosureJira,
  saveDisclosureWebhook,
  testDisclosureDestination,
} from "./disclosure-destinations.ts";
import {
  OPERATOR_CONFIRM_ERROR,
  OPERATOR_GRANT_ERROR,
  OPERATOR_OWNER_ERROR,
  OPERATOR_UNKNOWN_ERROR,
  assertOperatorConfirm,
  isOwnerGithubLogin,
  parseOperatorGithubLogin,
  publicOperatorGrant,
} from "./operator-grants.ts";
import { remindMissedDisclosureDeadlines, toNotificationView } from "./internal-notify.ts";
import {
  discoverAndQueueProspects,
  inspectAndQueueRepository,
} from "./prospects.ts";
import {
  CAMPAIGN_CAP_ERROR,
  CAMPAIGN_EXISTS_ERROR,
  CAMPAIGN_UNKNOWN_ERROR,
  MAX_DISCOVERY_CAMPAIGNS,
  parseCampaignName,
  parseCampaignQuery,
  publicDiscoveryCampaign,
} from "./discovery-campaigns.ts";
import { runProspectNpmFeed } from "./prospect-feed.ts";
import type { Store } from "./store.ts";
import type {
  AlertEventRow,
  AlertRow,
  IdentityCandidateRow,
  PolicyExceptionRow,
  ProspectStatus,
  ReleaseApprovalRow,
  ReleaseLegalHoldRow,
  ReleaseRevisionRow,
  NotificationKind,
} from "./store.ts";
import {
  exposureMs,
  findingRules,
  rotationChecklist,
  summarizePermissionTest,
} from "./install-test.ts";
import { readSignedSession, signSession } from "./store.ts";
import { enqueueFromWebhook } from "./webhooks.ts";
import { applyHostedPolicy } from "./hosted-policy.ts";
import { persistHostedReceipt } from "./receipts.ts";
import {
  parseReleaseScanMeta,
  ReleaseLedgerError,
} from "./release-ledger.ts";
import {
  GOVERNANCE_DUPLICATE_ERROR,
  GOVERNANCE_HELD_ERROR,
  GOVERNANCE_NOT_HELD_ERROR,
  GOVERNANCE_SOD_ATTACH_ERROR,
  GOVERNANCE_SOD_HOLD_ERROR,
  RELEASE_EXPORT_LIMIT,
  governancePlanDeniedFromBilling,
  groupedByRevision,
  latestByRevision,
  parseApprovalDecision,
  parseGovernanceReason,
  parseHoldAction,
  shippingBlockedReason,
} from "./release-governance.ts";
import {
  DeliveryVerifyError,
  MAX_DELIVERY_LOCATIONS_PER_INSTALL,
  MAX_DELIVERY_LOCATIONS_PER_REVISION,
  enqueueDeliveryVerify,
  parseDeliveryMediaType,
  parseDeliveryUrl,
  redactDeliveryUrl,
} from "./delivery-verify.ts";
import {
  parseSlackWebhook,
  postSlackWebhook,
  slackPlanDeniedFromBilling,
  slackTestText,
} from "./slack.ts";
import {
  assertPublicWebhookHost,
  lookupWebhookHost,
  parseSiemWebhook,
  postSiemWebhook,
  siemPlanDeniedFromBilling,
  siemTestPayload,
  type WebhookHostLookup,
} from "./siem.ts";
import {
  encodeJiraSecret,
  jiraPlanDeniedFromBilling,
  parseJiraEmail,
  parseJiraIssueType,
  parseJiraProjectKey,
  parseJiraSite,
  parseJiraToken,
  testJiraDestination,
} from "./jira.ts";
import {
  pagerDutyPlanDeniedFromBilling,
  parsePagerDutyRoutingKey,
  testPagerDutyDestination,
} from "./pagerduty.ts";
import {
  MAX_SCAN_TOKENS,
  parseScanBearer,
  validateScanTokenName,
} from "./scan-api.ts";
import { httpErrorForWorkBlock } from "./install-health.ts";
import { FAIR_USE_EXHAUSTED, secondsUntilUtcMidnight } from "./usage.ts";
import {
  TIMELINE_DAYS,
  timelinePlanDeniedFromBilling,
  timelineWindow,
} from "./timeline.ts";
import {
  RETENTION_DAYS_ERROR,
  RETENTION_DEFAULT_DAYS,
  normalizeRetentionDays,
  parseRetentionDays,
  retentionAuditSummary,
  retentionConfirmToken,
  retentionPlanDeniedFromBilling,
  retentionWindow,
} from "./retention.ts";
import {
  ADMIN_REQUIRED_ERROR,
  GITHUB_LOGIN_ERROR,
  parseInstallationRole,
  rolesPlanDeniedFromBilling,
} from "./roles.ts";
import {
  MAX_NOTIFICATION_ROUTES,
  destinationReceives,
  githubLoginKey,
  parseGithubLogin,
  parseRouteMinSeverity,
  parseRoutePackageName,
  parseRouteRepoFullName,
  parseRouteSampleSeverity,
  parseRouteTeamLogin,
  routingPlanDeniedFromBilling,
} from "./routing.ts";
import {
  auditPlanDeniedFromBilling,
  typedConfirm,
  type AuditAction,
} from "./audit.ts";
import {
  identityPlanDeniedFromBilling,
  loadIdentityRiskScore,
  parseAllowlistReason,
} from "./identity-signals.ts";
import {
  ADVISORY_ALREADY_ERROR,
  ADVISORY_CAP_ERROR,
  ADVISORY_MISSING_ERROR,
  ADVISORY_UNKNOWN_ERROR,
  EVIDENCE_MISSING_ERROR,
  EVIDENCE_UNPROTECTED_ERROR,
  MAX_ADVISORY_PAGES_PER_INSTALL,
  assembleIdentityEvidence,
  buildEvidenceSummary,
  buildPublicAdvisoryView,
  identityEvidencePlanDeniedFromBilling,
  mintAdvisoryToken,
  parseAdvisoryToken,
  parseStoredEvidencePayload,
} from "./identity-evidence.ts";
import { createLogNotifier, type AlertNotifier } from "./notifier.ts";
import {
  MAX_PUBLIC_PAGES_PER_INSTALL,
  PUBLIC_PAGE_ALREADY_ERROR,
  PUBLIC_PAGE_CAP_ERROR,
  PUBLIC_PAGE_MISSING_ERROR,
  PUBLIC_PAGE_UNKNOWN_ERROR,
  PUBLIC_PAGE_UNPAID_ERROR,
  buildPublicVerificationView,
  mintPublicToken,
  parsePublicToken,
  publicPageSummary,
} from "./release-public.ts";
import {
  ATTESTATION_NO_SOURCE_ERROR,
  ATTESTATION_UNPAID_ERROR,
  attestationPlanDeniedFromBilling,
  latestAttestationBySource,
  publicAttestation,
  refreshReleaseAttestations,
  rowToFacts,
  type ReleaseAttestationRow,
} from "./attestations.ts";
import {
  SIGNING_POLICY_CLEAR_CONFIRM,
  SIGNING_POLICY_CONFIRM,
  SIGNING_POLICY_EMPTY_ERROR,
  parseSigningPolicyInput,
  publicSigningPolicy,
  signingPolicyBlocksApprove,
  signingPolicyPlanDeniedFromBilling,
} from "./signing-policy.ts";

const MAX_UPLOAD = 80 * 1024 * 1024;

export type AppDeps = {
  config: AppConfig;
  store: Store;
  github: GithubPort;
  npm?: NpmPort;
  scan?: typeof scan;
  wakeWorker?: () => void;
  runScheduledJobs?: () => Promise<Record<string, number>>;
  verifyDomain?: typeof verifyDomainOwnership;
  slackFetch?: typeof fetch;
  webhookLookup?: WebhookHostLookup;
  notifier?: AlertNotifier;
  stripe?: StripePort;
};

function jsonObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function errorStatus(error: unknown): 400 | 402 | 403 | 404 | 409 {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    if (status === 400 || status === 402 || status === 403 || status === 404 || status === 409) {
      return status;
    }
  }
  return 400;
}

function publicException(row: PolicyExceptionRow) {
  const expires = Date.parse(row.expires_at);
  return {
    id: row.id,
    installationId: row.installation_id,
    packageId: row.package_id,
    rule: row.rule,
    pathPattern: row.path_pattern,
    reason: row.reason,
    actorLogin: row.actor_login,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    active: !row.revoked_at && Number.isFinite(expires) && expires > Date.now(),
  };
}

function publicIdentityCandidate(row: IdentityCandidateRow) {
  return {
    id: row.id,
    candidateName: row.candidate_name,
    transformation: row.transformation,
    firstSeenAt: row.first_seen_at,
    lastCheckedAt: row.last_checked_at,
    registeredAt: row.registered_at,
    lastVersion: row.last_version,
    lastPublishedAt: row.last_published_at,
    allowlisted: Boolean(row.allowlisted_at),
    allowlistReason: row.allowlist_reason,
    allowlistedByLogin: row.allowlisted_by_login,
  };
}

function publicAlert(row: AlertRow) {
  const findings = Array.isArray(row.findings) ? row.findings : null;
  return {
    id: row.id,
    installation_id: row.installation_id,
    repo_id: row.repo_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    findings,
    github_delivery_id: row.github_delivery_id,
    acknowledged_at: row.acknowledged_at,
    acknowledged_by_login: row.acknowledged_by_login,
    assigned_to_login: row.assigned_to_login,
    resolved_at: row.resolved_at,
    resolved_by_login: row.resolved_by_login,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
    full_name: row.full_name ?? null,
    exposure_ms: exposureMs(row.created_at, row.resolved_at),
    rotation_checklist: rotationChecklist(findingRules(findings)),
  };
}

function publicAlertEvent(row: AlertEventRow) {
  return {
    id: row.id,
    alert_id: row.alert_id,
    installation_id: row.installation_id,
    actor_login: row.actor_login,
    action: row.action,
    detail: row.detail,
    created_at: row.created_at,
  };
}

function publicDeliveryLocation(row: {
  id: number;
  revision_id: number;
  url: string;
  host: string;
  expected_media_type: string | null;
  last_status: string | null;
  last_sha256: string | null;
  last_media_type: string | null;
  last_redirect_hosts: string | null;
  last_cache_state: string | null;
  last_region: string | null;
  last_checked_at: string | null;
}) {
  return {
    id: row.id,
    revisionId: row.revision_id,
    url: redactDeliveryUrl(row.url),
    host: row.host,
    expectedMediaType: row.expected_media_type,
    lastStatus: row.last_status,
    lastSha256: row.last_sha256,
    lastMediaType: row.last_media_type,
    lastRedirectHosts: row.last_redirect_hosts,
    lastCacheState: row.last_cache_state,
    lastRegion: row.last_region,
    lastCheckedAt: row.last_checked_at,
  };
}

function publicApproval(row: ReleaseApprovalRow) {
  return {
    decision: row.decision,
    actorLogin: row.actor_login,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function publicLegalHold(row: ReleaseLegalHoldRow | null) {
  if (!row || row.action !== "place") return null;
  return {
    active: true as const,
    actorLogin: row.actor_login,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function latestPublicAttestations(rows: ReleaseAttestationRow[]) {
  return [...latestAttestationBySource(rows).values()].map(publicAttestation);
}

function exportReleaseLocations(
  locations: Awaited<ReturnType<Store["listDeliveryLocationsForRevisions"]>> | undefined,
) {
  return (locations ?? []).map((location) => ({
    url: redactDeliveryUrl(location.url),
    host: location.host,
    lastStatus: location.last_status,
    lastSha256: location.last_sha256,
    lastMediaType: location.last_media_type,
    lastRedirectHosts: location.last_redirect_hosts,
    lastCacheState: location.last_cache_state,
    lastRegion: location.last_region,
    lastCheckedAt: location.last_checked_at,
  }));
}

function publicRelease(
  row: ReleaseRevisionRow,
  locations: ReturnType<typeof publicDeliveryLocation>[] = [],
  approval: ReleaseApprovalRow | null = null,
  hold: ReleaseLegalHoldRow | null = null,
  page: { enabled: boolean; public_token: string } | null = null,
  attestations: ReturnType<typeof publicAttestation>[] = [],
) {
  return {
    id: row.id,
    installationId: row.installation_id,
    packageId: row.package_id,
    repoId: row.repo_id,
    receiptId: row.receipt_id,
    channel: row.channel,
    coordinate: row.coordinate,
    artifactSha256: row.artifact_sha256,
    artifactSha512: row.artifact_sha512,
    artifactBytes: row.artifact_bytes,
    mediaType: row.media_type,
    sourceRevision: row.source_revision,
    ciRunUrl: row.ci_run_url,
    previousSha256: row.previous_sha256,
    mismatch: row.mismatch,
    receiptStatus: row.receipt_status,
    createdAt: row.created_at,
    locations,
    approval: approval ? publicApproval(approval) : null,
    legalHold: publicLegalHold(hold),
    publicPage: publicPageSummary(page),
    attestations,
  };
}

async function hostedWorkDenied(
  store: Store,
  installationId: number,
  unpaidMessage: string,
): Promise<{ error: string; status: 402 | 409 } | null> {
  const block = await store.installationWorkBlock(installationId);
  if (!block) return null;
  const denied = httpErrorForWorkBlock(block, unpaidMessage);
  return { error: denied.message, status: denied.status };
}

function fairUseResponse(c: Context) {
  c.header("Retry-After", String(secondsUntilUtcMidnight()));
  return c.json({ error: FAIR_USE_EXHAUSTED }, 429);
}

function destinationKindLabel(kind: NotificationKind): string {
  if (kind === "jira") return "Jira";
  if (kind === "siem") return "SIEM";
  if (kind === "pagerduty") return "PagerDuty";
  if (kind === "email") return "Email";
  return "Slack";
}

function publicDestination(row: {
  id: number;
  installationId: number;
  kind: NotificationKind;
  host: string;
  projectKey?: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryError: string | null;
  updatedAt: string;
}) {
  return {
    id: row.id,
    installationId: row.installationId,
    kind: row.kind,
    host: row.host,
    projectKey: row.kind === "jira" || row.kind === "email" ? (row.projectKey ?? null) : null,
    lastDeliveryAt: row.lastDeliveryAt,
    lastDeliveryStatus: row.lastDeliveryStatus,
    lastDeliveryError: row.lastDeliveryError,
    updatedAt: row.updatedAt,
  };
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const scanFn = deps.scan ?? scan;
  const hostedOrigin = hostedScanOrigin(deps.config.appBaseUrl);
  const npm = deps.npm ?? createNpmPort();
  const notifier =
    deps.notifier ??
    createLogNotifier(deps.store, {
      fetch: deps.slackFetch,
      lookup: deps.webhookLookup,
      resend: resendConfigured(deps.config)
        ? { apiKey: deps.config.resendApiKey, fromEmail: deps.config.resendFromEmail }
        : undefined,
    });
  const stripe =
    deps.stripe ??
    (deps.config.stripeSecretKey ? createStripePort(deps.config.stripeSecretKey) : null);
  const prices = stripePriceMap(deps.config);
  const cookieName = "ns_session";
  const scanLimiter = createRateLimiter({
    limit: deps.config.scanRateLimit,
    windowMs: deps.config.scanRateWindowMs,
  });
  const authLimiter = createRateLimiter({
    limit: deps.config.authRateLimit,
    windowMs: deps.config.authRateWindowMs,
  });
  const discoveryLimiter = createRateLimiter({
    limit: deps.config.discoveryRateLimit,
    windowMs: deps.config.discoveryRateWindowMs,
  });

  function requestIp(c: Context): string {
    return clientKey(c.req.header("x-forwarded-for"), c.req.header("x-real-ip"));
  }

  function rateLimited(
    c: Context,
    limiter: { allow: (key: string) => boolean },
    key: string,
    windowMs: number,
    message: string,
  ) {
    if (limiter.allow(key)) return null;
    c.header("Retry-After", retryAfterSeconds(windowMs));
    return c.json({ error: message }, 429);
  }

  async function currentUser(c: Context) {
    const raw = getCookie(c, cookieName);
    const sessionId = readSignedSession(deps.config.sessionSecret, raw);
    if (!sessionId) return null;
    return await deps.store.getSession(sessionId);
  }

  function queryInstallationId(c: Context): number | null {
    const raw = c.req.query("installationId");
    if (raw == null || raw === "") return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  async function requireInstallAdmin(userId: string, installationId: number) {
    const role = await deps.store.getInstallationRole(userId, installationId);
    if (!role) {
      return { error: "That GitHub installation is not on your account.", status: 403 as const };
    }
    if (role !== "admin") {
      return { error: ADMIN_REQUIRED_ERROR, status: 403 as const };
    }
    return null;
  }

  async function testSavedDestination(destination: {
    id: number;
    installationId: number;
    kind: NotificationKind;
  }): Promise<{ ok: boolean; status: number; error: string | null }> {
    const install = await deps.store.getInstallation(destination.installationId);
    const outbound = { fetch: deps.slackFetch ?? fetch, lookup: deps.webhookLookup };
    let posted: { ok: boolean; status: number; error: string | null };
    if (destination.kind === "jira") {
      const auth = await deps.store.getJiraAuthForInstallation(destination.installationId);
      if (!auth || auth.id !== destination.id) {
        posted = { ok: false, status: 0, error: "Unknown destination." };
      } else {
        posted = await testJiraDestination(auth.host, auth.projectKey, auth.secret, outbound);
      }
    } else if (destination.kind === "pagerduty") {
      const auth = await deps.store.getPagerDutyKeyForInstallation(destination.installationId);
      if (!auth || auth.id !== destination.id) {
        posted = { ok: false, status: 0, error: "Unknown destination." };
      } else {
        posted = await testPagerDutyDestination(
          auth.routingKey,
          install?.account_login ?? "",
          outbound,
        );
      }
    } else if (destination.kind === "email") {
      const dest = await deps.store.getDestinationWebhookForInstallation(
        destination.installationId,
        "email",
      );
      if (!dest || dest.id !== destination.id) {
        posted = { ok: false, status: 0, error: "Unknown destination." };
      } else {
        posted = await postResendEmail(
          {
            apiKey: deps.config.resendApiKey,
            from: deps.config.resendFromEmail,
            to: dest.url,
            subject: "NoSpoilers delivery test",
            text: emailTestText(install?.account_login ?? ""),
          },
          outbound.fetch,
        );
      }
    } else {
      const webhook = await deps.store.getDestinationWebhookForInstallation(
        destination.installationId,
        destination.kind,
      );
      if (!webhook || webhook.id !== destination.id) {
        posted = { ok: false, status: 0, error: "Unknown destination." };
      } else if (destination.kind === "siem") {
        posted = await postSiemWebhook(
          webhook.url,
          siemTestPayload(install?.account_login ?? ""),
          outbound,
        );
      } else {
        posted = await postSlackWebhook(
          webhook.url,
          { text: slackTestText(install?.account_login ?? "") },
          outbound.fetch,
        );
      }
    }
    await deps.store.recordNotificationDelivery({
      installationId: destination.installationId,
      destinationId: destination.id,
      alertId: null,
      kind: destination.kind,
      status: posted.ok ? "sent" : "failed",
      error: posted.error,
    });
    return posted;
  }

  async function recordAudit(input: {
    installationId: number;
    actorLogin: string;
    action: AuditAction;
    summary: string;
    targetKind?: string | null;
    targetId?: string | null;
  }): Promise<void> {
    await deps.store.insertAuditEvent(input);
  }

  async function hostedCoverageForUser(user: {
    userId: string;
    trialEndsAt: string | null;
    plan: string | null;
  }) {
    const installations = await deps.store.listInstallationsForUser(user.userId);
    if (installations.length === 0) return coverageFrom(user.trialEndsAt, user.plan);
    return bestCoverage(
      installations.map((row) => coverageFrom(row.trialEndsAt, row.plan)),
    );
  }

  async function isOwner(c: Context): Promise<boolean> {
    const authorization = c.req.header("authorization") ?? "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const headerToken = c.req.header("x-admin-token") ?? bearer;
    if (
      deps.config.adminToken &&
      headerToken &&
      sameSecret(deps.config.adminToken, headerToken)
    ) {
      return true;
    }
    const user = await currentUser(c);
    return Boolean(
      user &&
        deps.config.adminGithubLogin &&
        user.login.toLowerCase() === deps.config.adminGithubLogin.toLowerCase(),
    );
  }

  async function isOperator(c: Context): Promise<boolean> {
    if (await isOwner(c)) return true;
    const user = await currentUser(c);
    return Boolean(user?.login && (await deps.store.hasOperatorGrant(user.login)));
  }

  async function internalActor(c: Context): Promise<string> {
    const user = await currentUser(c);
    if (user?.login) return user.login;
    return deps.config.adminGithubLogin || "owner";
  }

  function disclosureFailed(c: Context, error: unknown) {
    if (error instanceof DisclosureError) {
      return c.json(
        {
          error: error.message,
          ...(error.duplicates ? { duplicates: error.duplicates } : {}),
          ...(error.dnc ? { dnc: error.dnc } : {}),
        },
        error.status,
      );
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Disclosure request failed." },
      errorStatus(error),
    );
  }

  app.use("/api/internal/*", async (c, next) => {
    if (!(await isOperator(c))) {
      return c.json(
        {
          error: "Admin access required.",
          githubLogin: deps.config.adminGithubLogin,
          tokenConfigured: Boolean(deps.config.adminToken),
        },
        401,
      );
    }
    await next();
  });

  app.get("/api/health", async (c) =>
    c.json({
      ok: true,
      name: "nospoilers",
      githubApp: githubAppConfigured(deps.config),
      stripe: stripeConfigured(deps.config),
      resend: resendConfigured(deps.config),
      role: deps.config.processRole,
      ui: processRunsHttp(deps.config.processRole) && (await uiIndexExists(deps.config.uiRoot)),
      database: {
        mode: databaseMode(deps.config.databaseUrl),
      },
      worker: {
        recoveryIntervalMs: deps.config.workerIntervalMs,
        visibilityPollIntervalMs: deps.config.pollIntervalMs,
        jobs: jobProcessingMode(deps.config.processRole),
      },
    }),
  );

  app.get("/api/cron/jobs", async (c) => {
    const secret = deps.config.cronSecret.trim();
    const auth = c.req.header("authorization") ?? "";
    if (!secret || secret.length < 16 || !sameSecret(auth, `Bearer ${secret}`)) {
      return c.json({ error: "Cron authorization required." }, 401);
    }
    if (!deps.runScheduledJobs) {
      return c.json({ error: "Job scheduler is not attached to this process." }, 503);
    }
    const result = await deps.runScheduledJobs();
    return c.json({ ok: true, ...result });
  });

  app.get("/api/ready", async (c) => {
    let databaseOk = false;
    try {
      databaseOk = await deps.store.ping();
    } catch {
      databaseOk = false;
    }
    const body = {
      ready: databaseOk,
      githubApp: githubAppConfigured(deps.config),
      stripe: stripeConfigured(deps.config),
      resend: resendConfigured(deps.config),
      database: {
        mode: databaseMode(deps.config.databaseUrl),
        ok: databaseOk,
      },
    };
    return c.json(body, databaseOk ? 200 : 503);
  });

  app.get("/api/internal/prospects", async (c) => {
    await remindMissedDisclosureDeadlines(deps.store);
    await sweepExpiredDisclosureEvidence(deps.store);
    const limit = Number(c.req.query("limit") ?? 100);
    const [prospects, stats, cases, notices, unread, campaigns] = await Promise.all([
      deps.store.listProspects(Number.isFinite(limit) ? limit : 100),
      deps.store.prospectStats(),
      deps.store.listDisclosureCases(),
      deps.store.listInternalNotifications(10),
      deps.store.unreadInternalNotificationCount(),
      deps.store.listDiscoveryCampaigns(),
    ]);
    const byProspect = new Map(cases.map((row) => [row.prospect_id, row] as const));
    return c.json({
      actor: {
        login: await internalActor(c),
        role: (await isOwner(c)) ? "owner" : "operator",
      },
      prospects: prospects.map((prospect) => {
        const row = byProspect.get(prospect.id);
        return {
          ...prospect,
          disclosure: row ? toDisclosureSummary(row, prospect.artifact_sha256) : null,
        };
      }),
      stats,
      campaigns: campaigns.map(publicDiscoveryCampaign),
      notifications: {
        unread,
        items: notices.map(toNotificationView),
      },
      policy: {
        publicArtifactsOnly: true,
        sourceRetained: false,
        outreachAutomatic: false,
        disclosureSend: false,
        criticalNotifyUnverified: false,
        doNotContactEnforced: true,
        deadlineRemindInternal: true,
        campaignsConfigurable: true,
      },
    });
  });

  app.get("/api/internal/notifications", async (c) => {
    await remindMissedDisclosureDeadlines(deps.store);
    await sweepExpiredDisclosureEvidence(deps.store);
    const [items, unread] = await Promise.all([
      deps.store.listInternalNotifications(50),
      deps.store.unreadInternalNotificationCount(),
    ]);
    return c.json({
      unread,
      notifications: items.map(toNotificationView),
      policy: { sent: false, unverified: false },
    });
  });

  app.patch("/api/internal/notifications/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid notification." }, 400);
    const body = jsonObj(await c.req.json());
    if (body.read !== true) return c.json({ error: "Mark the notification read." }, 400);
    const row = await deps.store.markInternalNotificationRead(id);
    return row
      ? c.json({ notification: toNotificationView(row) })
      : c.json({ error: "Notification not found." }, 404);
  });

  app.get("/api/internal/disclosure/templates", async (c) => {
    const templates = await deps.store.listDisclosureTemplates();
    return c.json({ templates: templates.map(toTemplateView), policy: { sent: false } });
  });

  app.post("/api/internal/disclosure/templates", async (c) => {
    try {
      const body = jsonObj(await c.req.json());
      const template = await createDisclosureTemplate(deps.store, {
        actor: await internalActor(c),
        name: body.name,
        subject: body.subject,
        body: body.body,
      });
      return c.json({ template, sent: false }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.patch("/api/internal/disclosure/templates/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid template." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const template = await updateDisclosureTemplate(deps.store, {
        id,
        subject: body.subject,
        body: body.body,
      });
      return c.json({ template, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.get("/api/internal/disclosure/workload", async (c) => {
    const cases = await deps.store.listDisclosureCases();
    return c.json(researcherWorkloadFromCases(cases));
  });

  app.get("/api/internal/disclosure/organizations", async (c) => {
    const organizations = await listDisclosureOrganizations(deps.store);
    return c.json({ organizations });
  });

  app.get("/api/internal/disclosure/destinations", async (c) => {
    const rows = await deps.store.listDisclosureDestinations();
    return c.json({
      destinations: rows.map(publicDisclosureDestination),
      policy: { sent: false, inventedIncident: false },
    });
  });

  app.post("/api/internal/disclosure/destinations/webhook", async (c) => {
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const destination = await saveDisclosureWebhook(deps.store, {
        actor: await internalActor(c),
        url: body.url,
        confirm: body.confirm,
        lookup: deps.webhookLookup,
      });
      return c.json({ destination, sent: false }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/disclosure/destinations/jira", async (c) => {
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const destination = await saveDisclosureJira(deps.store, {
        actor: await internalActor(c),
        site: body.site,
        email: body.email,
        token: body.token,
        projectKey: body.projectKey ?? body.project_key,
        issueType: body.issueType ?? body.issue_type,
        confirm: body.confirm,
      });
      return c.json({ destination, sent: false }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/disclosure/destinations/:id/test", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: DISCLOSURE_DESTINATION_UNKNOWN_ERROR }, 404);
    }
    try {
      const result = await testDisclosureDestination(deps.store, id, {
        fetch: deps.slackFetch,
        lookup: deps.webhookLookup,
      });
      return c.json({ ...result, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.delete("/api/internal/disclosure/destinations/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: DISCLOSURE_DESTINATION_UNKNOWN_ERROR }, 404);
    }
    const existing = await deps.store.getDisclosureDestination(id);
    if (!existing) return c.json({ error: DISCLOSURE_DESTINATION_UNKNOWN_ERROR }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, disclosureDestinationConfirmValue(existing));
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteDisclosureDestination(id);
    return removed
      ? c.json({ ok: true, sent: false })
      : c.json({ error: DISCLOSURE_DESTINATION_UNKNOWN_ERROR }, 404);
  });

  app.get("/api/internal/disclosure/do-not-contact", async (c) => {
    const entries = await deps.store.listDoNotContact();
    return c.json({ entries: entries.map(toDncView) });
  });

  app.post("/api/internal/disclosure/do-not-contact", async (c) => {
    try {
      const body = jsonObj(await c.req.json());
      const entry = await createDoNotContactEntry(deps.store, {
        actor: await internalActor(c),
        owner: body.owner,
        repo: body.repo,
        packageName: body.packageName,
        contact: body.contact,
        reason: body.reason,
      });
      return c.json({ entry }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.delete("/api/internal/disclosure/do-not-contact/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid entry." }, 400);
    const removed = await deps.store.deleteDoNotContact(id);
    return removed ? c.json({ ok: true }) : c.json({ error: "Entry not found." }, 404);
  });

  app.get("/api/internal/queue", async (c) => {
    if (!(await isOwner(c))) return c.json({ error: OPERATOR_OWNER_ERROR }, 403);
    const health = await deps.store.ownerQueueHealth(deps.config.jobStaleMs);
    return c.json(health);
  });

  app.get("/api/internal/operators", async (c) => {
    if (!(await isOwner(c))) return c.json({ error: OPERATOR_OWNER_ERROR }, 403);
    const grants = await deps.store.listOperatorGrants();
    return c.json({
      operators: grants.map(publicOperatorGrant),
      policy: { timeTracking: false, productivitySurveillance: false },
    });
  });

  app.post("/api/internal/operators", async (c) => {
    if (!(await isOwner(c))) return c.json({ error: OPERATOR_OWNER_ERROR }, 403);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const githubLogin = parseOperatorGithubLogin(body.githubLogin);
      assertOperatorConfirm(githubLogin, body.confirm);
      if (isOwnerGithubLogin(githubLogin, deps.config.adminGithubLogin)) {
        return c.json({ error: OPERATOR_GRANT_ERROR }, 400);
      }
      const grant = await deps.store.insertOperatorGrant({
        githubLogin,
        createdBy: await internalActor(c),
      });
      return c.json({ operator: publicOperatorGrant(grant) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : OPERATOR_GRANT_ERROR },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/internal/operators/:id", async (c) => {
    if (!(await isOwner(c))) return c.json({ error: OPERATOR_OWNER_ERROR }, 403);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: OPERATOR_UNKNOWN_ERROR }, 400);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const existing = await deps.store.getOperatorGrant(id);
    if (!existing) return c.json({ error: OPERATOR_UNKNOWN_ERROR }, 404);
    try {
      assertOperatorConfirm(existing.github_login, body.confirm);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : OPERATOR_CONFIRM_ERROR },
        400,
      );
    }
    const removed = await deps.store.deleteOperatorGrant(id);
    return removed ? c.json({ ok: true }) : c.json({ error: OPERATOR_UNKNOWN_ERROR }, 404);
  });

  app.get("/api/internal/prospects/campaigns", async (c) => {
    const rows = await deps.store.listDiscoveryCampaigns();
    return c.json({ campaigns: rows.map(publicDiscoveryCampaign) });
  });

  app.post("/api/internal/prospects/campaigns", async (c) => {
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const name = parseCampaignName(body.name);
      const query = parseCampaignQuery(body.query ?? body.confirm);
      const confirmError = typedConfirm(body, query);
      if (confirmError) return c.json(confirmError, 400);
      if ((await deps.store.countDiscoveryCampaigns()) >= MAX_DISCOVERY_CAMPAIGNS) {
        return c.json({ error: CAMPAIGN_CAP_ERROR }, 400);
      }
      const row = await deps.store.insertDiscoveryCampaign({
        name,
        query,
        createdBy: await internalActor(c),
      });
      if (!row) return c.json({ error: CAMPAIGN_EXISTS_ERROR }, 409);
      return c.json({ ok: true, campaign: publicDiscoveryCampaign(row) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : CAMPAIGN_UNKNOWN_ERROR },
        errorStatus(error),
      );
    }
  });

  app.patch("/api/internal/prospects/campaigns/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
    const existing = await deps.store.getDiscoveryCampaign(id);
    if (!existing) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const name = body.name !== undefined ? parseCampaignName(body.name) : existing.name;
      const query = body.query !== undefined ? parseCampaignQuery(body.query) : existing.query;
      const enabled = body.enabled !== undefined ? body.enabled === true : existing.enabled;
      if (body.query !== undefined) {
        const confirmError = typedConfirm(body, query);
        if (confirmError) return c.json(confirmError, 400);
      }
      const row = await deps.store.updateDiscoveryCampaign({ id, name, query, enabled });
      if (!row) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
      return c.json({ ok: true, campaign: publicDiscoveryCampaign(row) });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : CAMPAIGN_UNKNOWN_ERROR },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/internal/prospects/campaigns/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
    const existing = await deps.store.getDiscoveryCampaign(id);
    if (!existing) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, existing.query);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteDiscoveryCampaign(id);
    if (!removed) return c.json({ error: CAMPAIGN_UNKNOWN_ERROR }, 404);
    return c.json({ ok: true });
  });

  app.post("/api/internal/prospects/discover", async (c) => {
    const limited = rateLimited(
      c,
      discoveryLimiter,
      `discover:${requestIp(c)}`,
      deps.config.discoveryRateWindowMs,
      "Too many discovery requests. Wait and try again.",
    );
    if (limited) return limited;
    try {
      const body = jsonObj(await c.req.json());
      const result = await discoverAndQueueProspects(
        deps.store,
        {
          query: typeof body.query === "string" ? body.query : undefined,
          limit: typeof body.limit === "number" ? body.limit : undefined,
        },
        deps.config.githubDiscoveryToken,
        deps.config.maxAssetBytes,
      );
      if (result.queued > 0) deps.wakeWorker?.();
      return c.json(result);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Discovery failed." },
        400,
      );
    }
  });

  app.post("/api/internal/prospects/repository", async (c) => {
    const limited = rateLimited(
      c,
      discoveryLimiter,
      `inspect:${requestIp(c)}`,
      deps.config.discoveryRateWindowMs,
      "Too many discovery requests. Wait and try again.",
    );
    if (limited) return limited;
    try {
      const body = jsonObj(await c.req.json());
      const repository = typeof body.repository === "string" ? body.repository : "";
      if (!repository) return c.json({ error: "Provide owner/repo or a GitHub URL." }, 400);
      const result = await inspectAndQueueRepository(
        deps.store,
        repository,
        deps.config.githubDiscoveryToken,
        deps.config.maxAssetBytes,
      );
      if (result.queued > 0) deps.wakeWorker?.();
      return c.json(result);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Repository inspection failed." },
        400,
      );
    }
  });

  app.post("/api/internal/prospects/feed", async (c) => {
    const limited = rateLimited(
      c,
      discoveryLimiter,
      `feed:${requestIp(c)}`,
      deps.config.discoveryRateWindowMs,
      "Too many discovery requests. Wait and try again.",
    );
    if (limited) return limited;
    const result = await runProspectNpmFeed({
      store: deps.store,
      npm,
      staleAfterMs: deps.config.jobStaleMs,
    });
    if (result.queued > 0) deps.wakeWorker?.();
    return c.json(result);
  });

  app.get("/api/internal/prospects/:id/disclosure", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      await sweepExpiredDisclosureEvidence(deps.store);
      return c.json({ case: await loadDisclosureCase(deps.store, id) });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json().catch(() => ({})));
      const view = await createDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        confirmDuplicate: body.confirmDuplicate === true,
        researchOnly: body.researchOnly === true,
      });
      return c.json({ case: view }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.patch("/api/internal/prospects/:id/disclosure", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const checklistRaw = jsonObj(body.checklist);
      const checklist = Object.fromEntries(
        (
          [
            "public_artifact",
            "reproduced",
            "fingerprints_recorded",
            "no_secret_values",
            "contact_or_policy",
          ] as const
        )
          .filter((key) => typeof checklistRaw[key] === "boolean")
          .map((key) => [key, checklistRaw[key] === true]),
      );
      const view = await updateDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        checklist: Object.keys(checklist).length > 0 ? checklist : undefined,
        state: body.state,
        securityContact: body.securityContact,
        policyUrl: body.policyUrl,
        notes: body.notes,
        notesExpiresInDays: body.notesExpiresInDays,
        draftSubject: body.draftSubject,
        draftBody: body.draftBody,
        sent: body.sent,
        deadlineAt: body.deadlineAt,
        conversion: body.conversion,
        fixVersion: body.fixVersion,
        vendorChannel: body.vendorChannel,
        outcomeCredit: body.outcomeCredit,
        outcomeCve: body.outcomeCve,
        outcomeNotes: body.outcomeNotes,
        findingCategory: body.findingCategory,
        reproducibilitySteps: body.reproducibilitySteps,
      });
      return c.json({ case: view });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/preview", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json().catch(() => ({})));
      const draft = await previewDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        templateId: body.templateId,
      });
      return c.json(draft);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/acknowledge", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const view = await acknowledgeDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        note: body.note,
      });
      return c.json({ case: view, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/replies", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const view = await recordVendorReply(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        channel: body.channel,
        summary: body.summary,
        receivedAt: body.receivedAt,
      });
      return c.json({ case: view, sent: false }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/attachments", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const view = await addDisclosureAttachment(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        filename: body.filename,
        mediaType: body.mediaType,
        bytes: body.bytes,
        expiresInDays: body.expiresInDays,
      });
      return c.json({ case: view, sent: false }, 201);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.get("/api/internal/prospects/:id/disclosure/attachments/:attachmentId", async (c) => {
    const id = Number(c.req.param("id"));
    const attachmentId = Number(c.req.param("attachmentId"));
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(attachmentId) || attachmentId <= 0) {
      return c.json({ error: "Invalid attachment." }, 400);
    }
    try {
      await sweepExpiredDisclosureEvidence(deps.store);
      const file = await readDisclosureAttachment(deps.store, { prospectId: id, attachmentId });
      return new Response(Uint8Array.from(file.bytes), {
        status: 200,
        headers: {
          "content-type": file.mediaType,
          "content-disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/assign", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const view = await assignDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        assignee: body.assignee,
      });
      return c.json({ case: view, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/review", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const view = await reviewDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        decision: body.decision,
        note: body.note,
      });
      return c.json({ case: view, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/notify", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    try {
      const result = await notifyDisclosureDestination(
        deps.store,
        {
          prospectId: id,
          destinationId: Number(body.destinationId ?? body.destination_id),
          actor: await internalActor(c),
          confirm: body.confirm,
        },
        { fetch: deps.slackFetch, lookup: deps.webhookLookup },
      );
      return c.json(result);
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.get("/api/internal/prospects/:id/disclosure/report", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const report = await buildDisclosureReport(deps.store, id);
      const format = String(c.req.query("format") ?? "json").toLowerCase();
      if (format === "html") {
        return c.html(renderDisclosureReportHtml(report));
      }
      if (format === "pdf") {
        const pdf = renderDisclosureReportPdf(report);
        return new Response(Uint8Array.from(pdf), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="disclosure-${id}.pdf"`,
            "cache-control": "no-store",
          },
        });
      }
      return c.json({ report, sent: false });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/disclosure/rescan", async (c) => {
    const limited = rateLimited(
      c,
      discoveryLimiter,
      `disclosure-rescan:${requestIp(c)}`,
      deps.config.discoveryRateWindowMs,
      "Too many discovery requests. Wait and try again.",
    );
    if (limited) return limited;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    try {
      const body = jsonObj(await c.req.json());
      const result = await rescanDisclosureCase(deps.store, {
        prospectId: id,
        actor: await internalActor(c),
        fixVersion: body.fixVersion,
        wakeWorker: deps.wakeWorker,
      });
      return c.json({ ok: true, sent: false, ...result });
    } catch (error) {
      return disclosureFailed(c, error);
    }
  });

  app.post("/api/internal/prospects/:id/rescan", async (c) => {
    const limited = rateLimited(
      c,
      discoveryLimiter,
      `rescan:${requestIp(c)}`,
      deps.config.discoveryRateWindowMs,
      "Too many discovery requests. Wait and try again.",
    );
    if (limited) return limited;
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Invalid prospect." }, 400);
    const prospect = await deps.store.getProspect(id);
    if (!prospect) return c.json({ error: "Prospect not found." }, 404);
    await deps.store.queueProspectScan(id);
    const job = await deps.store.enqueueJob({
      priority: "heavy",
      kind: "prospect_scan",
      payload: { prospectId: id },
    });
    if (job.inserted) deps.wakeWorker?.();
    return c.json({ ok: true, jobId: job.id });
  });

  app.patch("/api/internal/prospects/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = jsonObj(await c.req.json());
    const status = body.status;
    const allowed: ProspectStatus[] = ["new", "contacted", "fixed", "ignored"];
    if (
      !Number.isFinite(id) ||
      id <= 0 ||
      typeof status !== "string" ||
      !allowed.includes(status as ProspectStatus)
    ) {
      return c.json({ error: "Invalid prospect status." }, 400);
    }
    const existing = await deps.store.getProspect(id);
    if (!existing) return c.json({ error: "Prospect not found." }, 404);
    const desk = await deps.store.getDisclosureCaseByProspect(id);
    const blocked = outreachBlocked(status as ProspectStatus, desk);
    if (blocked) return c.json({ error: blocked }, 409);
    if (status === "contacted") {
      const dnc = await findDncMatches(deps.store, {
        owner: existing.owner,
        repo: existing.repo,
        packageName: existing.package_name,
        securityContact: desk?.security_contact ?? null,
        policyUrl: desk?.policy_url ?? null,
      });
      if (dnc.length > 0) {
        return c.json({ error: DISCLOSURE_DNC_ERROR, dnc }, 409);
      }
      if (desk?.review_state !== "approved") {
        return c.json({ error: DISCLOSURE_REVIEW_ERROR }, 409);
      }
      const duplicates = await findDuplicateMatches(deps.store, {
        prospectId: existing.id,
        owner: existing.owner,
        repo: existing.repo,
        packageName: existing.package_name,
        fingerprints: desk.fingerprints,
        policyUrl: desk.policy_url,
        securityContact: desk.security_contact,
      });
      if (duplicates.length > 0 && body.confirmDuplicate !== true) {
        return c.json({ error: DISCLOSURE_DUPLICATE_ERROR, duplicates }, 409);
      }
      if (duplicates.length > 0 && desk) {
        await persistConfirmedDuplicates(deps.store, {
          caseId: desk.id,
          matches: duplicates,
          actor: await internalActor(c),
        });
      }
    }
    const prospect = await deps.store.updateProspectStatus(id, status as ProspectStatus);
    return prospect ? c.json({ prospect }) : c.json({ error: "Prospect not found." }, 404);
  });

  app.post("/api/scan", async (c) => {
    const user = await currentUser(c);
    if (user) {
      const coverage = await hostedCoverageForUser(user);
      if (coverage.status === "ended") {
        return c.json({ error: "Coverage ended. Subscribe to unpack on our servers." }, 402);
      }
    }
    const scanLimited = rateLimited(
      c,
      scanLimiter,
      `scan:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this address. Wait and try again.",
    );
    if (scanLimited) return scanLimited;
    try {
      const contentType = c.req.header("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = jsonObj(await c.req.json());
        const target = typeof body.path === "string" ? body.path : "";
        if (!target) return c.json({ error: "Provide a path to a packed artifact." }, 400);
        const resolved = path.resolve(target);
        const cwd = path.resolve(process.cwd());
        if (resolved !== cwd && !resolved.startsWith(`${cwd}${path.sep}`)) {
          return c.json({ error: "Path must be inside this project directory." }, 400);
        }
        return c.json(await scanFn(resolved));
      }
      const filenameHeader = c.req.header("x-filename");
      const filename =
        filenameHeader && filenameHeader.length > 0 ? path.basename(filenameHeader) : "upload.bin";
      const buf = Buffer.from(await c.req.arrayBuffer());
      if (buf.length > MAX_UPLOAD) {
        return c.json({
          target: filename,
          kind: "file",
          fileCount: 0,
          findings: [],
          ok: false,
          status: "inconclusive",
          inconclusiveReason: "Upload is larger than 80 MB.",
          manifest: [],
          engineVersion: ENGINE_VERSION,
          artifactSha256: createHash("sha256").update(buf).digest("hex"),
          artifactSha512: createHash("sha512").update(buf).digest("hex"),
          artifactBytes: buf.length,
          scannedAt: new Date().toISOString(),
          suppressed: [],
          policyHash: null,
          workspaces: [],
        });
      }
      const dir = path.join(os.tmpdir(), "nospoilers-upload");
      await mkdir(dir, { recursive: true });
      const dest = path.join(dir, `${Date.now()}-${filename}`);
      await writeFile(dest, buf);
      const report = await scanFn(dest);
      await writeFile(dest, Buffer.alloc(0)).catch(() => undefined);
      return c.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed.";
      return c.json({ error: message }, 400);
    }
  });

  app.post("/api/webhooks/github", async (c) => {
    const raw = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");
    if (!verifyGitHubSignature(deps.config.githubWebhookSecret, raw, signature)) {
      return c.json({ error: "Invalid signature." }, 401);
    }
    const event = c.req.header("x-github-event") ?? "";
    const deliveryId = c.req.header("x-github-delivery") ?? "";
    let payload: Record<string, unknown> = {};
    try {
      payload = jsonObj(JSON.parse(raw) as unknown);
    } catch {
      return c.json({ error: "Invalid JSON." }, 400);
    }
    try {
      const result = await enqueueFromWebhook(deps.store, event, deliveryId, payload);
      if (result.queued) deps.wakeWorker?.();
      return c.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook enqueue failed.";
      return c.json({ error: message }, 500);
    }
  });

  app.post("/api/webhooks/stripe", async (c) => {
    if (!stripeConfigured(deps.config)) {
      return c.json({ error: STRIPE_NOT_LIVE_ERROR }, 503);
    }
    const raw = await c.req.text();
    if (!verifyStripeSignature(deps.config.stripeWebhookSecret, raw, c.req.header("stripe-signature"))) {
      return c.json({ error: "Invalid signature." }, 400);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return c.json({ error: "Invalid JSON." }, 400);
    }
    const event = parseStripeEvent(parsed);
    if (!event) return c.json({ error: "Invalid event." }, 400);
    const claimed = await deps.store.claimStripeEvent(event.id, event.type);
    if (!claimed) return c.json({ ok: true, duplicate: true });
    const patch = stripeEventPatch(event, prices);
    if (!patch) return c.json({ ok: true, skipped: true });
    const applied = await deps.store.applyStripeBillingPatch(patch);
    return c.json({ ok: true, applied: applied.applied });
  });

  function publicStripeBilling(state: {
    trialEndsAt: string | null;
    plan: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeStatus: string | null;
    periodEnd: string | null;
  }) {
    return {
      plan: state.plan,
      trialEndsAt: state.trialEndsAt,
      status: state.stripeStatus,
      periodEnd: state.periodEnd,
      hasCustomer: Boolean(state.stripeCustomerId),
      subscribed: stripeSubscriptionCovers(state.stripeStatus),
    };
  }

  app.get("/api/billing", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = queryInstallationId(c);
    if (!installationId) return c.json({ error: "Choose a GitHub installation." }, 400);
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const state = await deps.store.installationStripeState(installationId);
    if (!state) return c.json({ error: "Unknown installation." }, 404);
    return c.json({
      stripe: stripeConfigured(deps.config),
      billing: publicStripeBilling(state),
    });
  });

  app.post("/api/billing/checkout", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    if (!stripeConfigured(deps.config) || !stripe) {
      return c.json({ error: STRIPE_NOT_LIVE_ERROR }, 503);
    }
    const limited = rateLimited(
      c,
      authLimiter,
      `billing:${requestIp(c)}`,
      deps.config.authRateWindowMs,
      "Too many billing attempts from this address. Wait and try again.",
    );
    if (limited) return limited;
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installationId = Number(body.installationId);
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation." }, 400);
    }
    const denied = await requireInstallAdmin(user.userId, installationId);
    if (denied) return c.json({ error: denied.error }, denied.status);
    const plan = parseStripePlan(body.plan);
    const interval = parseStripeInterval(body.interval);
    if (!plan || !interval) return c.json({ error: STRIPE_PLAN_ERROR }, 400);
    const state = await deps.store.installationStripeState(installationId);
    if (!state) return c.json({ error: "Unknown installation." }, 404);
    if (state.stripeCustomerId && stripeSubscriptionCovers(state.stripeStatus)) {
      try {
        const portal = await stripe.createPortalSession({
          customerId: state.stripeCustomerId,
          returnUrl: `${deps.config.appBaseUrl}/watch?install=${installationId}`,
        });
        return c.json({ url: portal.url, kind: "portal" });
      } catch (error) {
        const message = error instanceof StripeApiError ? error.message : STRIPE_UNAVAILABLE_ERROR;
        return c.json({ error: message }, 502);
      }
    }
    const priceId = stripePriceId(prices, plan, interval);
    const trialPeriodDays = remainingTrialDays(state.trialEndsAt);
    try {
      const session = await stripe.createCheckoutSession({
        customerId: state.stripeCustomerId,
        priceId,
        successUrl: `${deps.config.appBaseUrl}/watch?install=${installationId}&billing=ok`,
        cancelUrl: `${deps.config.appBaseUrl}/pricing?canceled=1`,
        clientReferenceId: String(installationId),
        trialPeriodDays,
        metadata: {
          installationId: String(installationId),
          plan,
          interval,
          priceId,
        },
      });
      await deps.store.insertAuditEvent({
        installationId,
        actorLogin: user.login,
        action: "billing.checkout",
        summary: `${plan} ${interval}`,
        targetKind: "billing",
        targetId: `${plan}:${interval}`,
      });
      return c.json({ url: session.url, kind: "checkout" });
    } catch (error) {
      const message = error instanceof StripeApiError ? error.message : STRIPE_UNAVAILABLE_ERROR;
      return c.json({ error: message }, 502);
    }
  });

  app.post("/api/billing/portal", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    if (!stripeConfigured(deps.config) || !stripe) {
      return c.json({ error: STRIPE_NOT_LIVE_ERROR }, 503);
    }
    const limited = rateLimited(
      c,
      authLimiter,
      `billing:${requestIp(c)}`,
      deps.config.authRateWindowMs,
      "Too many billing attempts from this address. Wait and try again.",
    );
    if (limited) return limited;
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installationId = Number(body.installationId);
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation." }, 400);
    }
    const denied = await requireInstallAdmin(user.userId, installationId);
    if (denied) return c.json({ error: denied.error === ADMIN_REQUIRED_ERROR ? STRIPE_ADMIN_ERROR : denied.error }, denied.status);
    const state = await deps.store.installationStripeState(installationId);
    if (!state) return c.json({ error: "Unknown installation." }, 404);
    if (!state.stripeCustomerId) return c.json({ error: STRIPE_SUBSCRIBE_FIRST_ERROR }, 409);
    try {
      const portal = await stripe.createPortalSession({
        customerId: state.stripeCustomerId,
        returnUrl: `${deps.config.appBaseUrl}/watch?install=${installationId}`,
      });
      await deps.store.insertAuditEvent({
        installationId,
        actorLogin: user.login,
        action: "billing.portal",
        summary: "Billing portal",
        targetKind: "billing",
        targetId: "portal",
      });
      return c.json({ url: portal.url, kind: "portal" });
    } catch (error) {
      const message = error instanceof StripeApiError ? error.message : STRIPE_UNAVAILABLE_ERROR;
      return c.json({ error: message }, 502);
    }
  });

  app.get("/api/auth/github", (c) => {
    if (!githubAppConfigured(deps.config)) {
      return c.json(
        { error: "GitHub App env vars are missing. See README to create the app." },
        503,
      );
    }
    const limited = rateLimited(
      c,
      authLimiter,
      `auth:${requestIp(c)}`,
      deps.config.authRateWindowMs,
      "Too many sign-in attempts from this address. Wait and try again.",
    );
    if (limited) return limited;
    const origin = authOrigin(c.req.url, deps.config.appBaseUrl);
    const state = crypto.randomUUID();
    setCookie(c, "ns_oauth_state", state, cookieSettings(origin, 600));
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", deps.config.githubClientId);
    url.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`);
    url.searchParams.set("state", state);
    return c.redirect(url.toString());
  });

  app.get("/api/auth/github/callback", async (c) => {
    const limited = rateLimited(
      c,
      authLimiter,
      `callback:${requestIp(c)}`,
      deps.config.authRateWindowMs,
      "Too many sign-in attempts from this address. Wait and try again.",
    );
    if (limited) return limited;
    const state = c.req.query("state");
    const expected = getCookie(c, "ns_oauth_state");
    if (!state || !expected || state !== expected) {
      return c.json({ error: "OAuth state mismatch. Try signing in again." }, 400);
    }
    const code = c.req.query("code");
    if (!code) return c.json({ error: "Missing code." }, 400);
    const token = await deps.github.exchangeCode(code);
    const user = await deps.github.getUser(token);
    const userId = String(user.id);
    await deps.store.upsertUser({
      id: userId,
      login: user.login,
      avatarUrl: user.avatar_url,
      accessToken: token,
    });
    await deps.store.linkUserToAccountInstallations(userId, user.id);
    try {
      const installationIds = await deps.github.listUserInstallations(token);
      for (const id of installationIds) {
        await deps.store.linkUserInstallation(id, userId);
      }
    } catch {
      // Install list can fail if the user has not installed yet.
    }
    const sessionId = await deps.store.createSession(userId);
    setCookie(
      c,
      cookieName,
      signSession(deps.config.sessionSecret, sessionId),
      cookieSettings(authOrigin(c.req.url, deps.config.appBaseUrl), 30 * 24 * 60 * 60),
    );
    deleteCookie(c, "ns_oauth_state", { path: "/" });
    return c.redirect("/watch");
  });

  app.post("/api/auth/logout", async (c) => {
    const raw = getCookie(c, cookieName);
    const sessionId = readSignedSession(deps.config.sessionSecret, raw);
    if (sessionId) await deps.store.deleteSession(sessionId);
    deleteCookie(c, cookieName, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/github/setup", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.redirect("/api/auth/github");
    const installationId = Number(c.req.query("installation_id"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.redirect("/");
    }
    const accessToken = await deps.store.getUserAccessToken(user.userId);
    if (!accessToken) {
      return c.json({ error: "Sign in with GitHub again to link this install." }, 401);
    }
    let ownedIds: number[] = [];
    try {
      ownedIds = await deps.github.listUserInstallations(accessToken);
    } catch {
      return c.json({ error: "GitHub would not list your App installs." }, 403);
    }
    if (!ownedIds.includes(installationId)) {
      return c.json({ error: "That GitHub App install is not yours." }, 403);
    }
    try {
      const installation = await deps.github.getInstallation(installationId);
      await deps.store.upsertInstallation({
        id: installation.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type || "User",
        accountId: installation.account.id,
        suspended: Boolean(installation.suspended_at),
      });
    } catch {
      return c.json({ error: "That install is not this NoSpoilers GitHub App." }, 403);
    }
    await deps.store.linkUserInstallation(installationId, user.userId);
    return c.redirect("/watch");
  });

  app.get("/api/me", async (c) => {
    const user = await currentUser(c);
    if (!user) {
      return c.json({
        user: null,
        githubApp: githubAppConfigured(deps.config),
        stripe: stripeConfigured(deps.config),
        resend: resendConfigured(deps.config),
      });
    }
    const installations = await deps.store.listInstallationsForUser(user.userId);
    return c.json({
      user: { id: user.userId, login: user.login, avatarUrl: user.avatarUrl },
      coverage: await hostedCoverageForUser(user),
      installations,
      githubApp: githubAppConfigured(deps.config),
      stripe: stripeConfigured(deps.config),
      resend: resendConfigured(deps.config),
      installUrl: `https://github.com/apps/${deps.config.githubAppSlug}/installations/new`,
      hostedOrigin: hostedOrigin.origin,
      githubRunnersReachable: hostedOrigin.githubRunnersReachable,
    });
  });

  app.get("/api/repos", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repos = await deps.store.listReposForUser(user.userId, queryInstallationId(c));
    return c.json({ repos });
  });

  app.get("/api/alerts", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const alerts = await deps.store.listAlertsForUser(user.userId, queryInstallationId(c));
    return c.json({ alerts: alerts.map(publicAlert) });
  });

  app.get("/api/alerts/export", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const scoped = queryInstallationId(c);
    const alerts = await deps.store.listAlertsForUser(user.userId, scoped);
    const activity = await Promise.all(
      alerts.map(async (alert) => ({
        ...publicAlert(alert),
        events: (await deps.store.listAlertEventsForUser(alert.id, user.userId)).map(publicAlertEvent),
      })),
    );
    return c.json({
      exportedAt: new Date().toISOString(),
      alerts: activity,
    });
  });

  app.get("/api/timeline", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    const fallbackWindow = timelineWindow();
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the 90-day timeline." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({
        days: TIMELINE_DAYS,
        since: fallbackWindow.since,
        until: fallbackWindow.until,
        entries: [],
      });
    }
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = timelinePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const window = retentionWindow(normalizeRetentionDays(billing?.retentionDays));
    const entries = await deps.store.listTimelineForUser(user.userId, installationId);
    return c.json({
      days: window.days,
      since: window.since,
      until: window.until,
      entries: entries.map((row) => ({
        at: row.at,
        type: row.type,
        alertId: row.alertId,
        kind: row.kind,
        title: row.title,
        fullName: row.fullName,
        action: row.action,
        actorLogin: row.actorLogin,
        deliveryStatus: row.deliveryStatus,
        inventedIncident: row.inventedIncident,
      })),
    });
  });

  app.get("/api/retention", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for retention." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ days: RETENTION_DEFAULT_DAYS });
    }
    const billing = await deps.store.installationBilling(installationId);
    return c.json({ days: normalizeRetentionDays(billing?.retentionDays) });
  });

  app.put("/api/retention", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for retention." }, 400);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = retentionPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const days = parseRetentionDays(body.days);
    if (days === null) return c.json({ error: RETENTION_DAYS_ERROR }, 400);
    const confirmError = typedConfirm(body, retentionConfirmToken(days));
    if (confirmError) return c.json(confirmError, 400);
    await deps.store.setRetentionDays(installationId, days);
    await recordAudit({
      installationId,
      actorLogin: user.login,
      action: "retention.save",
      summary: retentionAuditSummary(days),
      targetKind: "retention",
      targetId: retentionConfirmToken(days),
    });
    return c.json({ ok: true, days });
  });

  app.get("/api/signing-policy", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the signing policy." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ policy: null });
    }
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = signingPolicyPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const row = await deps.store.getSigningPolicy(installationId);
    return c.json({ policy: row ? publicSigningPolicy(row) : null });
  });

  app.put("/api/signing-policy", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the signing policy." }, 400);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = signingPolicyPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const confirmError = typedConfirm(body, SIGNING_POLICY_CONFIRM);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const policy = parseSigningPolicyInput(body);
      const saved = await deps.store.upsertSigningPolicy({
        installationId,
        policy,
        actorLogin: user.login,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "signing_policy.save",
        summary: "Saved a customer signing policy",
        targetKind: "signing_policy",
        targetId: SIGNING_POLICY_CONFIRM,
      });
      return c.json({ ok: true, policy: publicSigningPolicy(saved) });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : SIGNING_POLICY_EMPTY_ERROR,
        },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/signing-policy", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the signing policy." }, 400);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = signingPolicyPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const confirmError = typedConfirm(body, SIGNING_POLICY_CLEAR_CONFIRM);
    if (confirmError) return c.json(confirmError, 400);
    await deps.store.deleteSigningPolicy(installationId);
    await recordAudit({
      installationId,
      actorLogin: user.login,
      action: "signing_policy.clear",
      summary: "Cleared the customer signing policy",
      targetKind: "signing_policy",
      targetId: SIGNING_POLICY_CLEAR_CONFIRM,
    });
    return c.json({ ok: true, policy: null });
  });

  app.get("/api/audit", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the audit log." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ rows: [] });
    }
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = auditPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const rows = await deps.store.listAuditEventsForUser(user.userId, installationId);
    return c.json({
      rows: rows.map((row) => ({
        id: row.id,
        at: row.createdAt,
        actorLogin: row.actorLogin,
        action: row.action,
        summary: row.summary,
        targetKind: row.targetKind,
        targetId: row.targetId,
      })),
    });
  });

  app.get("/api/audit/export", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the audit log." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({
        exportedAt: new Date().toISOString(),
        installationId,
        audit: [],
        notificationDeliveries: [],
        alerts: [],
        alertEvents: [],
      });
    }
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = auditPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const payload = await deps.store.exportAuditLogForUser(user.userId, installationId);
    return c.json(payload);
  });

  app.get("/api/alerts/:id/events", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown alert." }, 404);
    const alert = await deps.store.getAlertForUser(id, user.userId);
    if (!alert) return c.json({ error: "Unknown alert." }, 404);
    const events = await deps.store.listAlertEventsForUser(id, user.userId);
    return c.json({ events: events.map(publicAlertEvent) });
  });

  app.post("/api/alerts/:id/acknowledge", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown alert." }, 404);
    const row = await deps.store.acknowledgeAlertForUser(id, user.userId, user.login);
    if (!row) return c.json({ error: "Unknown alert." }, 404);
    return c.json({ ok: true, alert: publicAlert(row) });
  });

  app.post("/api/alerts/:id/assign", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown alert." }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const login = typeof body.login === "string" ? body.login.trim() : "";
    if (!login) return c.json({ error: "Assign only to someone on this GitHub install." }, 400);
    try {
      const row = await deps.store.assignAlertForUser(id, user.userId, user.login, login);
      if (!row) return c.json({ error: "Unknown alert." }, 404);
      return c.json({ ok: true, alert: publicAlert(row) });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not assign that alert." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/alerts/:id/resolve", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown alert." }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const note = typeof body.note === "string" ? body.note : "";
    try {
      const row = await deps.store.resolveAlertForUser(id, user.userId, user.login, note);
      if (!row) return c.json({ error: "Unknown alert." }, 404);
      return c.json({ ok: true, alert: publicAlert(row) });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not resolve that alert." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/alerts/:id/reopen", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown alert." }, 404);
    try {
      const row = await deps.store.reopenAlertForUser(id, user.userId, user.login);
      if (!row) return c.json({ error: "Unknown alert." }, 404);
      return c.json({ ok: true, alert: publicAlert(row) });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not reopen that alert." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/installations/:id/test", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    const local = await deps.store.getInstallation(installationId);
    if (!local) return c.json({ error: "Unknown GitHub installation." }, 404);
    let githubInstall: Awaited<ReturnType<GithubPort["getInstallation"]>>;
    try {
      githubInstall = await deps.github.getInstallation(installationId);
    } catch (error) {
      const status = error instanceof GithubApiError && error.status === 404 ? 404 : 502;
      return c.json(
        {
          error:
            error instanceof Error ? error.message : "GitHub could not describe this install.",
          inventedIncident: false,
        },
        status,
      );
    }
    const repos = await deps.store.listReposForInstallation(installationId);
    const first = repos[0];
    let repoProbe: { fullName: string; ok: boolean } | null = null;
    if (first) {
      try {
        await deps.github.getRepo(installationId, first.owner, first.name);
        repoProbe = { fullName: first.full_name, ok: true };
      } catch {
        repoProbe = { fullName: first.full_name, ok: false };
      }
    }
    const lastJob = await deps.store.latestCustomerJob(installationId);
    const lastDelivery = lastJob
      ? { kind: lastJob.kind, status: lastJob.status, at: lastJob.createdAt }
      : null;
    let appPermissions: Record<string, string> | undefined;
    if (deps.github.getApp) {
      try {
        appPermissions = (await deps.github.getApp()).permissions;
      } catch {
        appPermissions = undefined;
      }
    }
    const test = summarizePermissionTest({
      accountLogin: githubInstall.account.login,
      suspended: Boolean(githubInstall.suspended_at) || local.suspended,
      repositorySelection: githubInstall.repository_selection,
      permissions: githubInstall.permissions,
      appPermissions,
      installUrl: githubInstall.html_url ?? null,
      repoProbe,
      lastDelivery,
    });
    await deps.store.savePermissionTest(installationId, test);
    return c.json({ ok: true, inventedIncident: false, test });
  });

  app.get("/api/installations/:id/members", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    const members = await deps.store.listInstallationMembersForUser(user.userId, installationId);
    const invites = await deps.store.listInstallationInvitesForUser(user.userId, installationId);
    return c.json({ members, invites });
  });

  app.post("/api/installations/:id/invites", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const loginRaw = typeof body.login === "string" ? body.login : "";
    const login = parseGithubLogin(loginRaw);
    if (!login) return c.json({ error: GITHUB_LOGIN_ERROR }, 400);
    const role = parseInstallationRole(body.role);
    if (!role) return c.json({ error: "Role must be admin or member." }, 400);
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = rolesPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const confirmError = typedConfirm(body, login);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const invite = await deps.store.upsertInstallationInviteForUser({
        actorUserId: user.userId,
        installationId,
        githubLogin: githubLoginKey(login),
        role,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "invite.create",
        summary: `Invited ${invite.githubLogin} as ${invite.role}`,
        targetKind: "invite",
        targetId: invite.githubLogin,
      });
      return c.json({ ok: true, invite });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that invite." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/installations/:id/invites/:inviteId", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    const inviteId = Number(c.req.param("inviteId"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    if (!Number.isFinite(inviteId) || inviteId <= 0) {
      return c.json({ error: "Unknown invite." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = rolesPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const invites = await deps.store.listInstallationInvitesForUser(user.userId, installationId);
    const target = invites.find((row) => row.id === inviteId);
    if (!target) return c.json({ error: "Unknown invite." }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, target.githubLogin);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const invite = await deps.store.revokeInstallationInviteForUser({
        actorUserId: user.userId,
        installationId,
        inviteId,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "invite.revoke",
        summary: `Revoked invite for ${invite.githubLogin}`,
        targetKind: "invite",
        targetId: invite.githubLogin,
      });
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not revoke that invite." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/installations/:id/members", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const role = parseInstallationRole(body.role);
    if (!role) return c.json({ error: "Role must be admin or member." }, 400);
    const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!targetUserId) return c.json({ error: "Choose a member on this install." }, 400);
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = rolesPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const members = await deps.store.listInstallationMembersForUser(user.userId, installationId);
    const target = members.find((row) => row.userId === targetUserId);
    if (!target) return c.json({ error: "Unknown member." }, 404);
    const confirmError = typedConfirm(body, target.login);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const member = await deps.store.setInstallationRoleForUser({
        actorUserId: user.userId,
        installationId,
        targetUserId,
        role,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "member.role_change",
        summary: `Changed ${member.login} to ${member.role}`,
        targetKind: "member",
        targetId: member.login,
      });
      return c.json({ ok: true, member });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not change that role." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/installations/:id/members/:userId", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.param("id"));
    const targetUserId = c.req.param("userId")?.trim() ?? "";
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Unknown GitHub installation." }, 404);
    }
    if (!targetUserId) return c.json({ error: "Choose a member on this install." }, 400);
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = rolesPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const members = await deps.store.listInstallationMembersForUser(user.userId, installationId);
    const target = members.find((row) => row.userId === targetUserId);
    if (!target) return c.json({ error: "Unknown member." }, 404);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, target.login);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const removed = await deps.store.removeInstallationMemberForUser({
        actorUserId: user.userId,
        installationId,
        targetUserId,
      });
      if (!removed) return c.json({ error: "Unknown member." }, 404);
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "member.remove",
        summary: `Removed ${target.login}`,
        targetKind: "member",
        targetId: target.login,
      });
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not remove that member." },
        errorStatus(error),
      );
    }
  });

  app.get("/api/jobs", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const { jobs, summary, fairUse } = await deps.store.listJobsForUser(user.userId, queryInstallationId(c));
    return c.json({ jobs, summary, fairUse });
  });

  app.post("/api/repos/:id/scan-latest-release", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to keep scanning releases.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const latestLimited = rateLimited(
      c,
      scanLimiter,
      `scan:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this address. Wait and try again.",
    );
    if (latestLimited) return latestLimited;
    const result = await deps.store.enqueueJob({
      priority: "heavy",
      kind: "scan_latest_release",
      payload: {
        installationId: repo.installation_id,
        repo: {
          id: repo.id,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          htmlUrl: repo.html_url,
        },
      },
    });
    if (result.skipped === "fair_use") {
      await deps.store.noteFairUseExhausted(repo.installation_id);
      return fairUseResponse(c);
    }
    if (result.inserted) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.inserted, jobId: result.id });
  });

  app.get("/api/repos/:id/setup-status", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const limited = rateLimited(
      c,
      authLimiter,
      `setup-status:${requestIp(c)}`,
      deps.config.authRateWindowMs,
      "Too many setup-status probes from this address. Wait and try again.",
    );
    if (limited) return limited;
    if (!deps.github.pathExists || !deps.github.listCheckRuns) {
      return c.json({ error: "This instance cannot probe GitHub setup files." }, 503);
    }
    try {
      const status = await probeRepoSetupStatus(deps.github, {
        installationId: repo.installation_id,
        owner: repo.owner,
        repo: repo.name,
      });
      return c.json({ status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not probe that repository.";
      return c.json({ error: message }, 409);
    }
  });

  app.get("/api/repos/:id/setup-workflow", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    return c.json({
      path: SETUP_WORKFLOW_PATH,
      workflow: setupWorkflowYaml(),
      files: setupFiles(),
      permissions: SETUP_PERMISSIONS,
      hostedOrigin: hostedOrigin.origin,
      githubRunnersReachable: hostedOrigin.githubRunnersReachable,
    });
  });

  app.post("/api/repos/:id/setup-pr", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, repo.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to open a setup PR.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const result = await deps.github.createSetupPullRequest(
      repo.installation_id,
      repo.owner,
      repo.name,
    );
    if ("skipped" in result) {
      return c.json(
        {
          ok: false,
          skipped: result.skipped,
          reason: result.reason,
          written: result.written ?? [],
          branch: result.branch ?? SETUP_BRANCH,
          compareUrl: result.compareUrl ?? null,
          workflow: setupWorkflowYaml(),
          files: setupFiles(),
          permissions: SETUP_PERMISSIONS,
          hostedOrigin: hostedOrigin.origin,
          githubRunnersReachable: hostedOrigin.githubRunnersReachable,
        },
        409,
      );
    }
    await recordAudit({
      installationId: repo.installation_id,
      actorLogin: user.login,
      action: "setup_pr.create",
      summary: `Opened setup PR for ${repo.full_name}`,
      targetKind: "repo",
      targetId: repo.full_name,
    });
    return c.json(
      {
        ok: true,
        htmlUrl: result.htmlUrl,
        number: result.number,
        existing: result.existing,
        merged: false,
      },
      result.existing ? 200 : 201,
    );
  });

  app.get("/api/repos/:id/remediation", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    return c.json({
      branch: REMEDIATION_BRANCH,
      files: remediationBundle(),
      permissions: REMEDIATION_PERMISSIONS,
      body: remediationPullRequestBody(),
      merged: false,
    });
  });

  app.post("/api/repos/:id/remediation-pr", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, repo.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to open a remediation PR.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const result = await deps.github.createRemediationPullRequest(
      repo.installation_id,
      repo.owner,
      repo.name,
    );
    if ("skipped" in result) {
      return c.json(
        {
          ok: false,
          skipped: result.skipped,
          reason: result.reason,
          written: result.written ?? [],
          branch: result.branch ?? REMEDIATION_BRANCH,
          compareUrl: result.compareUrl ?? null,
          files: remediationBundle(),
          permissions: REMEDIATION_PERMISSIONS,
          merged: false,
        },
        409,
      );
    }
    await recordAudit({
      installationId: repo.installation_id,
      actorLogin: user.login,
      action: "remediation_pr.create",
      summary: `Opened remediation PR for ${repo.full_name}`,
      targetKind: "repo",
      targetId: repo.full_name,
    });
    return c.json(
      {
        ok: true,
        htmlUrl: result.htmlUrl,
        number: result.number,
        existing: result.existing,
        merged: false,
      },
      result.existing ? 200 : 201,
    );
  });

  app.get("/api/repos/:id/github-response", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    let administrationGranted = false;
    try {
      const install = await deps.github.getInstallation(repo.installation_id);
      administrationGranted = hasWrite(install.permissions ?? {}, "administration");
    } catch {
      administrationGranted = false;
    }
    return c.json({
      permissions: RESPONSE_PERMISSIONS,
      administrationGranted,
      private: repo.private,
      reason: ADMINISTRATION_DENIED,
      copy: {
        makePrivate: MAKE_PRIVATE_COPY,
        deletePackAssets: DELETE_PACK_ASSETS_COPY,
        disableWorkflow: DISABLE_WORKFLOW_COPY,
      },
      confirm: {
        makePrivate: makePrivateConfirm(repo.full_name),
        deletePackAssets: deletePackAssetsConfirm(repo.full_name),
      },
    });
  });

  app.post("/api/repos/:id/make-private", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, repo.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to change GitHub visibility from Watch.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, makePrivateConfirm(repo.full_name));
    if (confirmError) return c.json(confirmError, 400);
    const result = await deps.github.makeRepoPrivate(repo.installation_id, repo.owner, repo.name);
    if ("skipped" in result) {
      return c.json({ ok: false, skipped: result.skipped, reason: result.reason, error: result.reason }, 409);
    }
    await deps.store.updateRepoCheck(repo.id, true);
    await recordAudit({
      installationId: repo.installation_id,
      actorLogin: user.login,
      action: "repo.make_private",
      summary: `Made ${repo.full_name} private`,
      targetKind: "repo",
      targetId: repo.full_name,
    });
    await deps.store.insertAlert({
      installationId: repo.installation_id,
      repoId: repo.id,
      kind: "repo_made_private",
      title: `Made ${repo.full_name} private`,
      body: `${result.detail} This is a Watch response you confirmed, not a discovered incident.`,
    });
    return c.json({ ok: true, detail: result.detail, private: true });
  });

  app.post("/api/repos/:id/delete-pack-assets", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, repo.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to remove Release pack assets from Watch.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, deletePackAssetsConfirm(repo.full_name));
    if (confirmError) return c.json(confirmError, 400);
    const result = await deps.github.deleteLatestPackAssets(
      repo.installation_id,
      repo.owner,
      repo.name,
    );
    if ("skipped" in result) {
      return c.json({ ok: false, skipped: result.skipped, reason: result.reason, error: result.reason }, 409);
    }
    await recordAudit({
      installationId: repo.installation_id,
      actorLogin: user.login,
      action: "repo.delete_pack_assets",
      summary: `Removed pack assets from ${repo.full_name}`,
      targetKind: "repo",
      targetId: repo.full_name,
    });
    await deps.store.insertAlert({
      installationId: repo.installation_id,
      repoId: repo.id,
      kind: "release_assets_removed",
      title: `Removed pack assets on ${repo.full_name}`,
      body: `${result.detail} This is a Watch response you confirmed, not a discovered incident.`,
    });
    return c.json({ ok: true, detail: result.detail, names: result.names ?? [] });
  });

  app.post("/api/repos/:id/disable-workflow", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, repo.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      repo.installation_id,
      "Coverage ended. Subscribe to disable a GitHub workflow from Watch.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const workflowPath = parseWorkflowPath(String(body.workflow ?? body.confirm ?? ""));
    if (!workflowPath) {
      return c.json(
        { error: "Type a workflow path under .github/workflows/, like .github/workflows/release.yml." },
        400,
      );
    }
    if (workflowIsNoSpoilersScan(workflowPath)) {
      return c.json(
        { error: "That workflow is the NoSpoilers packed scan. Disable a release publisher, not the scanner." },
        400,
      );
    }
    const confirmError = typedConfirm(body, disableWorkflowConfirm(workflowPath));
    if (confirmError) return c.json(confirmError, 400);
    const result = await deps.github.disableWorkflow(
      repo.installation_id,
      repo.owner,
      repo.name,
      workflowPath,
    );
    if ("skipped" in result) {
      return c.json({ ok: false, skipped: result.skipped, reason: result.reason, error: result.reason }, 409);
    }
    await recordAudit({
      installationId: repo.installation_id,
      actorLogin: user.login,
      action: "repo.disable_workflow",
      summary: `Disabled ${workflowPath} on ${repo.full_name}`,
      targetKind: "repo",
      targetId: workflowPath,
    });
    await deps.store.insertAlert({
      installationId: repo.installation_id,
      repoId: repo.id,
      kind: "workflow_disabled",
      title: `Disabled ${workflowPath} on ${repo.full_name}`,
      body: `${result.detail} This is a Watch response you confirmed, not a discovered incident.`,
    });
    return c.json({ ok: true, detail: result.detail, workflow: workflowPath });
  });

  app.get("/api/registries", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const registries = await deps.store.listNpmRegistriesForUser(user.userId, queryInstallationId(c));
    return c.json({ registries });
  });

  app.post("/api/registries", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach this registry to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const registryDenied = await hostedWorkDenied(
      deps.store,
      installationId,
      "Coverage ended. Subscribe to save a private registry.",
    );
    if (registryDenied) return c.json({ error: registryDenied.error }, registryDenied.status);
    const parsed = parseRegistryOrigin(String(body.origin ?? ""));
    if (!parsed) {
      return c.json(
        { error: "Use an https registry host. Loopback, private, and IP addresses are not allowed." },
        400,
      );
    }
    if (isPublicNpmOrigin(parsed.origin)) {
      return c.json(
        { error: "registry.npmjs.org does not need a token. Watch the public pack directly." },
        400,
      );
    }
    const token = validateRegistryToken(String(body.token ?? ""));
    if (!token) {
      return c.json({ error: "Registry token must be 8–8192 characters with no whitespace." }, 400);
    }
    const count = await deps.store.countNpmRegistries(installationId);
    const existing = (await deps.store.listNpmRegistriesForUser(user.userId)).some(
      (row) => row.installation_id === installationId && row.origin === parsed.origin,
    );
    if (!existing && count >= MAX_NPM_REGISTRIES) {
      return c.json({ error: `This install already has ${MAX_NPM_REGISTRIES} private registries.` }, 400);
    }
    try {
      const registry = await deps.store.upsertNpmRegistry({
        installationId,
        origin: parsed.origin,
        host: parsed.host,
        token,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "registry.save",
        summary: `Saved registry ${registry.host}`,
        targetKind: "registry",
        targetId: registry.origin,
      });
      return c.json({ ok: true, registry }, existing ? 200 : 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that registry." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/registries/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown registry." }, 404);
    const registry = (await deps.store.listNpmRegistriesForUser(user.userId)).find((row) => row.id === id);
    if (!registry) return c.json({ error: "Unknown registry." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, registry.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, registry.origin);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteNpmRegistryForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown registry." }, 404);
    await recordAudit({
      installationId: registry.installation_id,
      actorLogin: user.login,
      action: "registry.delete",
      summary: `Removed registry ${registry.host}`,
      targetKind: "registry",
      targetId: registry.origin,
    });
    return c.json({ ok: true });
  });

  app.get("/api/scan-tokens", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const tokens = await deps.store.listScanApiTokensForUser(user.userId, queryInstallationId(c));
    return c.json({ tokens });
  });

  app.post("/api/scan-tokens", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to mint this token for." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const tokenDenied = await hostedWorkDenied(
      deps.store,
      installationId,
      "Coverage ended. Subscribe to mint a scan API token.",
    );
    if (tokenDenied) return c.json({ error: tokenDenied.error }, tokenDenied.status);
    const name = validateScanTokenName(String(body.name ?? "CI"));
    if (!name) {
      return c.json({ error: "Token name must be 1–64 characters with no line breaks." }, 400);
    }
    const count = await deps.store.countScanApiTokens(installationId);
    if (count >= MAX_SCAN_TOKENS) {
      return c.json({ error: `This install already has ${MAX_SCAN_TOKENS} scan API tokens.` }, 400);
    }
    const created = await deps.store.insertScanApiToken({
      installationId,
      name,
      createdByLogin: user.login,
    });
    const { token, ...publicToken } = created;
    await recordAudit({
      installationId,
      actorLogin: user.login,
      action: "scan_token.mint",
      summary: `Minted scan token ${name}`,
      targetKind: "scan_token",
      targetId: name,
    });
    return c.json({ ok: true, token, scanToken: publicToken }, 201);
  });

  app.delete("/api/scan-tokens/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown scan token." }, 404);
    const token = (await deps.store.listScanApiTokensForUser(user.userId)).find((row) => row.id === id);
    if (!token) return c.json({ error: "Unknown scan token." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, token.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, token.name);
    if (confirmError) return c.json(confirmError, 400);
    const revoked = await deps.store.revokeScanApiTokenForUser(id, user.userId);
    if (!revoked) return c.json({ error: "Unknown scan token." }, 404);
    await recordAudit({
      installationId: token.installation_id,
      actorLogin: user.login,
      action: "scan_token.revoke",
      summary: `Revoked scan token ${token.name}`,
      targetKind: "scan_token",
      targetId: token.name,
    });
    return c.json({ ok: true });
  });

  app.post("/api/v1/scan", async (c) => {
    const presented = parseScanBearer(c.req.header("authorization"));
    if (!presented) return c.json({ error: "Provide a scan API token as a Bearer credential." }, 401);
    const auth = await deps.store.authenticateScanToken(presented);
    if (!auth) return c.json({ error: "Invalid or revoked scan API token." }, 401);
    const scanDenied = await hostedWorkDenied(
      deps.store,
      auth.installationId,
      "Coverage ended. Subscribe to unpack on our servers.",
    );
    if (scanDenied) return c.json({ error: scanDenied.error }, scanDenied.status);
    const ip = requestIp(c);
    const v1Limited = rateLimited(
      c,
      scanLimiter,
      `v1:${auth.id}:${ip}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this token. Wait and try again.",
    );
    if (v1Limited) return v1Limited;
    const filenameHeader = c.req.header("x-filename");
    const filename =
      filenameHeader && filenameHeader.length > 0 ? path.basename(filenameHeader) : "upload.bin";
    const coordinate = `api:${auth.installationId}#${filename}`;
    let releaseMeta: ReturnType<typeof parseReleaseScanMeta>;
    try {
      releaseMeta = parseReleaseScanMeta({
        channel: c.req.header("x-nospoilers-channel"),
        sourceRevision: c.req.header("x-nospoilers-source-revision"),
        ciRunUrl: c.req.header("x-nospoilers-ci-run"),
        coordinate,
      });
    } catch (error) {
      const message =
        error instanceof ReleaseLedgerError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Invalid release metadata.";
      return c.json({ error: message }, 400);
    }
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length === 0) return c.json({ error: "Upload a packed artifact." }, 400);
    if (!(await deps.store.consumeHostedUnpack(auth.installationId))) {
      await deps.store.noteFairUseExhausted(auth.installationId);
      return fairUseResponse(c);
    }
    try {
      await deps.store.touchScanApiToken(auth.id);
      if (buf.length > MAX_UPLOAD) {
        const report = {
          target: filename,
          kind: "file" as const,
          fileCount: 0,
          findings: [],
          ok: false,
          status: "inconclusive" as const,
          inconclusiveReason: "Upload is larger than 80 MB.",
          manifest: [],
          engineVersion: ENGINE_VERSION,
          artifactSha256: createHash("sha256").update(buf).digest("hex"),
          artifactSha512: createHash("sha512").update(buf).digest("hex"),
          artifactBytes: buf.length,
          scannedAt: new Date().toISOString(),
          suppressed: [],
          policyHash: null,
          workspaces: [],
        };
        const persisted = await persistHostedReceipt({
          store: deps.store,
          secret: deps.config.receiptSecret,
          installationId: auth.installationId,
          coordinate,
          report,
          ...releaseMeta,
        });
        return c.json({
          report: persisted.report,
          receipt: persisted.receipt,
          receiptId: persisted.row.id,
          release: publicRelease(persisted.revision),
        });
      }
      const dir = path.join(os.tmpdir(), "nospoilers-api-scan");
      await mkdir(dir, { recursive: true });
      const dest = path.join(dir, `${Date.now()}-${filename.replace(/[^\w.-]+/g, "_")}`);
      try {
        await writeFile(dest, buf);
        const report = await applyHostedPolicy(
          deps.store,
          await scanFn(dest),
          auth.installationId,
        );
        const persisted = await persistHostedReceipt({
          store: deps.store,
          secret: deps.config.receiptSecret,
          installationId: auth.installationId,
          coordinate,
          report,
          ...releaseMeta,
        });
        return c.json({
          report: persisted.report,
          receipt: persisted.receipt,
          receiptId: persisted.row.id,
          release: publicRelease(persisted.revision),
        });
      } finally {
        await writeFile(dest, Buffer.alloc(0)).catch(() => undefined);
        await unlink(dest).catch(() => undefined);
      }
    } catch (error) {
      await deps.store.refundHostedUnpack(auth.installationId);
      throw error;
    }
  });

  app.get("/api/packages", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const packages = await deps.store.listWatchedPackagesForUser(user.userId, queryInstallationId(c));
    return c.json({ packages });
  });

  app.get("/api/protections", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const protections = await deps.store.listPackageProtectionsForUser(
      user.userId,
      queryInstallationId(c),
    );
    return c.json({
      protections: protections.map((row) => ({
        id: row.id,
        packageId: row.package_id,
        verifiedVia: row.verified_via,
        githubRepo: row.github_repo,
        createdAt: row.created_at,
      })),
    });
  });

  app.post("/api/protections/import", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach these packages to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    try {
      const result = await importProtectedPackages(deps.store, npm, {
        installationId,
        names: body.names,
        registryOrigin: String(body.registryOrigin ?? ""),
      });
      return c.json({ ok: true, queued: result.queued, results: result.results });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not import those packages." },
        errorStatus(error),
      );
    }
  });

  app.get("/api/namespaces", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const requested = queryInstallationId(c);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const installationId =
      requested != null
        ? requested
        : installations.length === 1
          ? installations[0].id
          : null;
    if (installationId != null) {
      if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
        return c.json({ namespaces: [] });
      }
      const billing = await deps.store.installationBilling(installationId);
      const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
      if (planDenied) {
        return c.json(
          { error: planDenied.status === 402 ? NAMESPACE_UNPAID_ERROR : NAMESPACE_SOLO_ERROR },
          planDenied.status,
        );
      }
    }
    const rows = await deps.store.listProtectedNamespacesForUser(user.userId, requested);
    return c.json({ namespaces: rows.map((row) => publicNamespace(row, row.names)) });
  });

  app.post("/api/namespaces", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach this scope to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const scope = normalizeNpmScope(String(body.scope ?? body.confirm ?? ""));
    if (!scope) return c.json({ error: NAMESPACE_INVALID_ERROR }, 400);
    const confirmError = typedConfirm(body, scope);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const result = await protectNamespace(deps.store, {
        installationId,
        scope,
        actorLogin: user.login,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "namespace.protect",
        summary: `Watched npm scope ${result.namespace.scope}`,
        targetKind: "namespace",
        targetId: result.namespace.scope,
      });
      if (result.queued) deps.wakeWorker?.();
      return c.json({ ok: true, queued: result.queued, namespace: result.namespace }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not watch that npm scope." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/namespaces/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: NAMESPACE_UNKNOWN_ERROR }, 404);
    const row = await deps.store.getProtectedNamespace(id);
    if (!row || !(await deps.store.userOwnsInstallation(user.userId, row.installation_id))) {
      return c.json({ error: NAMESPACE_UNKNOWN_ERROR }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) {
      return c.json(
        { error: planDenied.status === 402 ? NAMESPACE_UNPAID_ERROR : NAMESPACE_SOLO_ERROR },
        planDenied.status,
      );
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, row.scope);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await unprotectNamespace(deps.store, { id, userId: user.userId });
    if (!removed) return c.json({ error: NAMESPACE_UNKNOWN_ERROR }, 404);
    await recordAudit({
      installationId: row.installation_id,
      actorLogin: user.login,
      action: "namespace.unprotect",
      summary: `Stopped watching npm scope ${row.scope}`,
      targetKind: "namespace",
      targetId: row.scope,
    });
    return c.json({ ok: true });
  });

  app.post("/api/namespaces/:id/check", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: NAMESPACE_UNKNOWN_ERROR }, 404);
    const row = await deps.store.getProtectedNamespace(id);
    if (!row || !(await deps.store.userOwnsInstallation(user.userId, row.installation_id))) {
      return c.json({ error: NAMESPACE_UNKNOWN_ERROR }, 404);
    }
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) {
      return c.json(
        { error: planDenied.status === 402 ? NAMESPACE_UNPAID_ERROR : NAMESPACE_SOLO_ERROR },
        planDenied.status,
      );
    }
    const checkDenied = await hostedWorkDenied(deps.store, row.installation_id, NAMESPACE_UNPAID_ERROR);
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const queued = await enqueueNamespaceCheck(deps.store, row, { now: true });
    if (queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued });
  });

  app.post("/api/packages", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId = Number.isFinite(requested) && requested > 0
      ? requested
      : installations.length === 1
        ? installations[0].id
        : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach this package to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    try {
      const result = await connectWatchedPackage(deps.store, npm, {
        installationId,
        packageName: String(body.packageName ?? ""),
        registryOrigin: String(body.registryOrigin ?? ""),
      });
      if (result.queued) deps.wakeWorker?.();
      return c.json({ ok: true, queued: result.queued, package: result.package }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not watch that package." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/packages/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown package." }, 404);
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, pkg.package_name);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteWatchedPackageForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown package." }, 404);
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: "package.unwatch",
      summary: `Stopped watching ${pkg.package_name}`,
      targetKind: "package",
      targetId: pkg.package_name,
    });
    return c.json({ ok: true });
  });

  app.post("/api/packages/:id/check", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const checkDenied = await hostedWorkDenied(
      deps.store,
      pkg.installation_id,
      "Coverage ended. Subscribe to keep watching npm packages.",
    );
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const npmUsage = await deps.store.hostedUsageStatus(pkg.installation_id);
    if (npmUsage.exhausted) {
      await deps.store.noteFairUseExhausted(pkg.installation_id);
      return fairUseResponse(c);
    }
    const checkLimited = rateLimited(
      c,
      scanLimiter,
      `scan:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this address. Wait and try again.",
    );
    if (checkLimited) return checkLimited;
    const result = await checkWatchedPackage(deps.store, npm, pkg, notifier);
    if (result.queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.queued, deltas: result.deltas });
  });

  app.get("/api/origins", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const origins = await deps.store.listWatchedOriginsForUser(user.userId, queryInstallationId(c));
    return c.json({
      origins: origins.map((row) => ({
        id: row.id,
        installation_id: row.installation_id,
        origin_url: row.origin_url,
        host: row.host,
        last_sha256: row.last_sha256,
        last_checked_at: row.last_checked_at,
        last_scanned_at: row.last_scanned_at,
        last_scan_status: row.last_scan_status,
        last_debug_ids: row.last_debug_ids,
        last_release: row.last_release,
        last_public_map: row.last_public_map,
        verification: row.verification_token
          ? {
              ...domainVerificationChallenge(row.host, row.verification_token),
              method: row.verification_method,
              verifiedAt: row.verified_at,
            }
          : null,
        deployTokenPrefix: row.deploy_token_prefix,
      })),
    });
  });

  app.post("/api/origins", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId = Number.isFinite(requested) && requested > 0
      ? requested
      : installations.length === 1
        ? installations[0].id
        : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach this website to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    try {
      const result = await connectWatchedOrigin(deps.store, {
        installationId,
        url: String(body.url ?? ""),
      }, { enqueue: false });
      const challenge = mintDomainVerificationChallenge(result.origin.host);
      const origin = await deps.store.setOriginVerificationChallenge(
        result.origin.id,
        user.userId,
        challenge.token,
      );
      if (!origin) throw new Error("Could not create website verification.");
      return c.json({ ok: true, queued: false, origin, verification: challenge }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not watch that website." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/origins/:id/verification", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const origin = await deps.store.getWatchedOrigin(id);
    if (!origin || !(await deps.store.userOwnsInstallation(user.userId, origin.installation_id))) {
      return c.json({ error: "Unknown website." }, 404);
    }
    const adminError = await requireInstallAdmin(user.userId, origin.installation_id);
    if (adminError) return c.json({ error: adminError.error }, adminError.status);
    const challenge = mintDomainVerificationChallenge(origin.host);
    const updated = await deps.store.setOriginVerificationChallenge(id, user.userId, challenge.token);
    if (!updated) return c.json({ error: "Unknown website." }, 404);
    return c.json({ verification: challenge });
  });

  app.post("/api/origins/:id/verify", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const origin = await deps.store.getWatchedOrigin(id);
    if (!origin || !(await deps.store.userOwnsInstallation(user.userId, origin.installation_id))) {
      return c.json({ error: "Unknown website." }, 404);
    }
    const adminError = await requireInstallAdmin(user.userId, origin.installation_id);
    if (adminError) return c.json({ error: adminError.error }, adminError.status);
    if (!origin.verification_token) {
      return c.json({ error: "Generate a domain verification challenge first." }, 409);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const method = body.method === "dns" || body.method === "http"
      ? body.method as DomainVerificationMethod
      : null;
    if (!method) return c.json({ error: "Choose DNS TXT or HTTPS file verification." }, 400);
    try {
      const result = await (deps.verifyDomain ?? verifyDomainOwnership)(
        origin.host,
        origin.verification_token,
        method,
        { lookup: deps.webhookLookup },
      );
      const verified = await deps.store.markOriginVerified(id, user.userId, method);
      if (!verified) return c.json({ error: "Unknown website." }, 404);
      const queued = await checkWatchedOrigin(deps.store, verified, notifier);
      if (queued.queued) deps.wakeWorker?.();
      await recordAudit({
        installationId: origin.installation_id,
        actorLogin: user.login,
        action: "origin.verify",
        summary: `Verified ${origin.host} by ${method}`,
        targetKind: "origin",
        targetId: origin.host,
      });
      return c.json({ ok: true, detail: result.detail, origin: verified, queued: queued.queued });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not verify this website." },
        409,
      );
    }
  });

  app.post("/api/origins/:id/deploy-token", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const origin = await deps.store.getWatchedOrigin(id);
    if (!origin || !(await deps.store.userOwnsInstallation(user.userId, origin.installation_id))) {
      return c.json({ error: "Unknown website." }, 404);
    }
    const adminError = await requireInstallAdmin(user.userId, origin.installation_id);
    if (adminError) return c.json({ error: adminError.error }, adminError.status);
    if (!origin.verified_at) {
      return c.json({ error: "Verify this domain before creating a deployment trigger." }, 409);
    }
    const minted = mintDeployToken();
    const updated = await deps.store.setOriginDeployToken(
      id,
      user.userId,
      minted.tokenHash,
      minted.tokenPrefix,
    );
    if (!updated) return c.json({ error: "Could not create deployment trigger." }, 409);
    await recordAudit({
      installationId: origin.installation_id,
      actorLogin: user.login,
      action: "origin.deploy_token",
      summary: `Rotated deployment trigger for ${origin.host}`,
      targetKind: "origin",
      targetId: origin.host,
    });
    return c.json({
      token: minted.token,
      tokenPrefix: minted.tokenPrefix,
      endpoint: `${deps.config.appBaseUrl}/api/v1/deploy`,
    }, 201);
  });

  app.post("/api/v1/deploy", async (c) => {
    const token = parseDeployBearer(c.req.header("authorization"));
    if (!token) return c.json({ error: "Valid deployment token required." }, 401);
    const origin = await deps.store.getOriginByDeployTokenHash(hashDeployToken(token));
    if (!origin) return c.json({ error: "Valid deployment token required." }, 401);
    const checkDenied = await hostedWorkDenied(
      deps.store,
      origin.installation_id,
      "Coverage ended. Subscribe to keep deployment-triggered website scans running.",
    );
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const deploymentId = String(body.deploymentId ?? "").trim();
    const provider = String(body.provider ?? "generic").trim().toLowerCase();
    if (!/^[A-Za-z0-9._:-]{1,200}$/.test(deploymentId)) {
      return c.json({ error: "deploymentId is required (commit SHA or provider deployment ID)." }, 400);
    }
    if (!/^[a-z0-9-]{1,32}$/.test(provider)) {
      return c.json({ error: "provider must be a short lowercase name." }, 400);
    }
    const result = await deps.store.enqueueJob({
      deliveryId: webOriginScanDeliveryId(
        origin.installation_id,
        origin.id,
        `deploy:${provider}:${deploymentId}`,
      ),
      priority: "heavy",
      kind: "web_origin_scan",
      payload: {
        installationId: origin.installation_id,
        originId: origin.id,
        url: origin.origin_url,
        reason: "deployment",
        provider,
        deploymentId,
      },
    });
    if (result.skipped === "fair_use") {
      return c.json({ error: FAIR_USE_EXHAUSTED }, 429);
    }
    if (result.inserted) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.inserted, duplicate: !result.inserted }, 202);
  });

  app.delete("/api/origins/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown website." }, 404);
    const origin = await deps.store.getWatchedOrigin(id);
    if (!origin || !(await deps.store.userOwnsInstallation(user.userId, origin.installation_id))) {
      return c.json({ error: "Unknown website." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, origin.origin_url);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteWatchedOriginForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown website." }, 404);
    await recordAudit({
      installationId: origin.installation_id,
      actorLogin: user.login,
      action: "origin.unwatch",
      summary: `Stopped watching ${origin.host}`,
      targetKind: "origin",
      targetId: origin.host,
    });
    return c.json({ ok: true });
  });

  app.post("/api/origins/:id/check", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const origin = await deps.store.getWatchedOrigin(id);
    if (!origin || !(await deps.store.userOwnsInstallation(user.userId, origin.installation_id))) {
      return c.json({ error: "Unknown website." }, 404);
    }
    if (origin.verification_token && !origin.verified_at) {
      return c.json({ error: "Verify domain control before scanning this website." }, 409);
    }
    const checkDenied = await hostedWorkDenied(
      deps.store,
      origin.installation_id,
      "Coverage ended. Subscribe to keep watching production websites.",
    );
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const originLimited = rateLimited(
      c,
      scanLimiter,
      `scan:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this address. Wait and try again.",
    );
    if (originLimited) return originLimited;
    const result = await checkWatchedOrigin(deps.store, origin, notifier);
    if (result.queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.queued });
  });

  function publicMapDestination(row: {
    id: number;
    installation_id: number;
    kind: "sentry" | "bugsnag";
    host: string;
    org_slug: string | null;
    project_slug: string;
    last_checked_at: string | null;
    last_status: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }) {
    return {
      id: row.id,
      installationId: row.installation_id,
      kind: row.kind,
      host: row.host,
      orgSlug: row.org_slug,
      projectSlug: row.project_slug,
      lastCheckedAt: row.last_checked_at,
      lastStatus: row.last_status,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  app.get("/api/map-destinations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const destinations = await deps.store.listMapDestinationsForUser(
      user.userId,
      queryInstallationId(c),
    );
    return c.json({ destinations: destinations.map(publicMapDestination) });
  });

  app.post("/api/map-destinations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId = Number.isFinite(requested) && requested > 0
      ? requested
      : installations.length === 1
        ? installations[0].id
        : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach map custody to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const denied = await hostedWorkDenied(
      deps.store,
      installationId,
      "Coverage ended. Subscribe to keep map custody.",
    );
    if (denied) return c.json({ error: denied.error }, denied.status);
    const parsed = parseMapDestination({
      kind: String(body.kind ?? ""),
      host: typeof body.host === "string" ? body.host : "",
      org: typeof body.org === "string" ? body.org : typeof body.orgSlug === "string" ? body.orgSlug : "",
      project: String(body.project ?? body.projectSlug ?? ""),
    });
    if (!parsed) {
      return c.json(
        {
          error:
            "Use Sentry (org + project) or Bugsnag (project id) on a public HTTPS host. Local, private, and metadata hosts are blocked.",
        },
        400,
      );
    }
    const token = validateMapToken(String(body.token ?? ""));
    if (!token) {
      return c.json({ error: "A map destination token is required and is never returned." }, 400);
    }
    try {
      const destination = await deps.store.upsertMapDestination({
        installationId,
        kind: parsed.kind,
        host: parsed.host,
        orgSlug: parsed.orgSlug,
        projectSlug: parsed.projectSlug,
        token,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "map_destination.save",
        summary: `Saved ${parsed.kind} map custody on ${parsed.host}`,
        targetKind: "map_destination",
        targetId: parsed.host,
      });
      const queued = await enqueueMapCustodyAfterConnect(deps.store, destination);
      if (queued.queued) deps.wakeWorker?.();
      return c.json(
        { ok: true, queued: queued.queued, destination: publicMapDestination(destination) },
        201,
      );
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that map destination." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/map-destinations/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown map destination." }, 404);
    const destination = await deps.store.getMapDestination(id);
    if (
      !destination ||
      !(await deps.store.userOwnsInstallation(user.userId, destination.installation_id))
    ) {
      return c.json({ error: "Unknown map destination." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, destination.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, destination.host);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteMapDestinationForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown map destination." }, 404);
    await recordAudit({
      installationId: destination.installation_id,
      actorLogin: user.login,
      action: "map_destination.delete",
      summary: `Removed ${destination.kind} map custody on ${destination.host}`,
      targetKind: "map_destination",
      targetId: destination.host,
    });
    return c.json({ ok: true });
  });

  app.post("/api/map-destinations/:id/check", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const destination = await deps.store.getMapDestination(id);
    if (
      !destination ||
      !(await deps.store.userOwnsInstallation(user.userId, destination.installation_id))
    ) {
      return c.json({ error: "Unknown map destination." }, 404);
    }
    const checkDenied = await hostedWorkDenied(
      deps.store,
      destination.installation_id,
      "Coverage ended. Subscribe to keep checking map custody.",
    );
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const mapUsage = await deps.store.hostedUsageStatus(destination.installation_id);
    if (mapUsage.exhausted) {
      await deps.store.noteFairUseExhausted(destination.installation_id);
      return fairUseResponse(c);
    }
    const result = await checkMapDestination(deps.store, destination);
    if (result.queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.queued });
  });

  app.get("/api/packages/:id/identity", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const protection = await deps.store.getPackageProtection(pkg.id);
    const snapshot = await deps.store.latestPackageIdentitySnapshot(pkg.id);
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    const risk =
      protection && !planDenied ? await loadIdentityRiskScore(deps.store, pkg) : null;
    return c.json({
      protection: protection
        ? {
            id: protection.id,
            verifiedVia: protection.verified_via,
            githubRepo: protection.github_repo,
            createdAt: protection.created_at,
          }
        : null,
      snapshot: snapshot
        ? {
            version: snapshot.version,
            maintainers: snapshot.maintainers,
            repositoryUrl: snapshot.repository_url,
            homepage: snapshot.homepage,
            binNames: snapshot.bin_names,
            lifecycleScripts: snapshot.lifecycle_scripts,
            publishedAt: snapshot.published_at,
            dependencyNames: snapshot.dependency_names,
            unpackedBytes: snapshot.unpacked_bytes,
            hasAttestations: snapshot.has_attestations,
            attestationPredicate: snapshot.attestation_predicate,
            signatureKeyids: snapshot.signature_keyids,
            publisherName: snapshot.publisher_name,
            trustedPublisher: snapshot.trusted_publisher,
            createdAt: snapshot.created_at,
          }
        : null,
      risk,
    });
  });

  app.post("/api/packages/:id/protect", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    try {
      const result = await protectWatchedPackage(deps.store, npm, pkg);
      return c.json(
        {
          ok: true,
          protection: {
            id: result.protection.id,
            verifiedVia: result.protection.verified_via,
            githubRepo: result.protection.github_repo,
            createdAt: result.protection.created_at,
          },
        },
        201,
      );
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not protect that package." },
        errorStatus(error),
      );
    }
  });

  app.get("/api/packages/:id/candidates", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const candidates = await deps.store.listIdentityCandidates(pkg.id);
    return c.json({ candidates: candidates.map(publicIdentityCandidate) });
  });

  app.post("/api/packages/:id/candidates/:candidateId/allowlist", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const candidateId = Number(c.req.param("candidateId"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, pkg.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const candidate = await deps.store.getIdentityCandidate(candidateId);
    if (!candidate || candidate.package_id !== pkg.id || candidate.installation_id !== pkg.installation_id) {
      return c.json({ error: "Unknown lookalike." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, candidate.candidate_name);
    if (confirmError) return c.json(confirmError, 400);
    const reason = parseAllowlistReason(body.reason);
    if (!reason) return c.json({ error: "Give a short reason to allowlist this lookalike." }, 400);
    const updated = await deps.store.allowlistIdentityCandidate({
      id: candidate.id,
      packageId: pkg.id,
      reason,
      actorLogin: user.login,
    });
    if (!updated) return c.json({ error: "That lookalike is already allowlisted." }, 409);
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: "identity.allowlist",
      summary: `Allowlisted lookalike ${candidate.candidate_name} on ${pkg.package_name}`,
      targetKind: "identity_candidate",
      targetId: candidate.candidate_name,
    });
    return c.json({ ok: true, candidate: publicIdentityCandidate(updated) });
  });

  app.post("/api/packages/:id/candidates/:candidateId/revoke", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const candidateId = Number(c.req.param("candidateId"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, pkg.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const candidate = await deps.store.getIdentityCandidate(candidateId);
    if (!candidate || candidate.package_id !== pkg.id || candidate.installation_id !== pkg.installation_id) {
      return c.json({ error: "Unknown lookalike." }, 404);
    }
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, candidate.candidate_name);
    if (confirmError) return c.json(confirmError, 400);
    const updated = await deps.store.revokeIdentityAllowlist({
      id: candidate.id,
      packageId: pkg.id,
    });
    if (!updated) return c.json({ error: "That lookalike is not allowlisted." }, 400);
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: "identity.revoke_allowlist",
      summary: `Revoked lookalike allowlist ${candidate.candidate_name} on ${pkg.package_name}`,
      targetKind: "identity_candidate",
      targetId: candidate.candidate_name,
    });
    return c.json({ ok: true, candidate: publicIdentityCandidate(updated) });
  });

  app.get("/api/packages/:id/evidence", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityEvidencePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const pack = await deps.store.getIdentityEvidencePackByPackage(pkg.id);
    if (!pack) return c.json({ evidence: null });
    const payload = parseStoredEvidencePayload(pack.payload);
    if (!payload) return c.json({ evidence: null });
    return c.json({
      evidence: buildEvidenceSummary({
        enabled: pack.enabled,
        token: pack.public_token,
        payload,
      }),
    });
  });

  app.post("/api/packages/:id/evidence", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, pkg.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityEvidencePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, pkg.package_name);
    if (confirmError) return c.json(confirmError, 400);
    const protection = await deps.store.getPackageProtection(pkg.id);
    if (!protection) return c.json({ error: EVIDENCE_UNPROTECTED_ERROR }, 409);
    const existing = await deps.store.getIdentityEvidencePackByPackage(pkg.id);
    const payload = assembleIdentityEvidence({
      packageName: pkg.package_name,
      actorLogin: user.login,
      protection,
      snapshot: await deps.store.latestPackageIdentitySnapshot(pkg.id),
      candidates: await deps.store.listIdentityCandidates(pkg.id),
      alerts: await deps.store.listIdentityEvidenceAlerts(pkg.installation_id, pkg.package_name),
    });
    const pack = await deps.store.upsertIdentityEvidencePack({
      installationId: pkg.installation_id,
      packageId: pkg.id,
      packageName: pkg.package_name,
      publicToken: existing?.public_token ?? mintAdvisoryToken(),
      payload,
      actorLogin: user.login,
    });
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: "identity.evidence",
      summary: `Assembled identity evidence for ${pkg.package_name}`,
      targetKind: "package",
      targetId: pkg.package_name,
    });
    return c.json(
      {
        evidence: buildEvidenceSummary({
          enabled: pack.enabled,
          token: pack.public_token,
          payload,
        }),
      },
      existing ? 200 : 201,
    );
  });

  app.post("/api/packages/:id/advisory", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, pkg.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(pkg.installation_id);
    const planDenied = identityEvidencePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, pkg.package_name);
    if (confirmError) return c.json(confirmError, 400);
    if (body.enabled !== true && body.enabled !== false) {
      return c.json({ error: "Set enabled to true or false." }, 400);
    }
    const enabled = body.enabled === true;
    const existing = await deps.store.getIdentityEvidencePackByPackage(pkg.id);
    if (!existing) return c.json({ error: EVIDENCE_MISSING_ERROR }, 400);
    const payload = parseStoredEvidencePayload(existing.payload);
    if (!payload) return c.json({ error: EVIDENCE_MISSING_ERROR }, 400);
    if (enabled) {
      if (existing.enabled) return c.json({ error: ADVISORY_ALREADY_ERROR }, 409);
      const enabledCount = await deps.store.countEnabledAdvisoryPages(pkg.installation_id);
      if (enabledCount >= MAX_ADVISORY_PAGES_PER_INSTALL) {
        return c.json({ error: ADVISORY_CAP_ERROR }, 400);
      }
    } else if (!existing.enabled) {
      return c.json({ error: ADVISORY_MISSING_ERROR }, 400);
    }
    const pack = await deps.store.setIdentityEvidenceEnabled({
      packageId: pkg.id,
      enabled,
      actorLogin: user.login,
    });
    if (!pack) return c.json({ error: EVIDENCE_MISSING_ERROR }, 400);
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: enabled ? "identity.publish_advisory" : "identity.unpublish_advisory",
      summary: enabled
        ? `Published consumer advisory for ${pkg.package_name}`
        : `Unpublished consumer advisory for ${pkg.package_name}`,
      targetKind: "package",
      targetId: pkg.package_name,
    });
    return c.json(
      {
        evidence: buildEvidenceSummary({
          enabled: pack.enabled,
          token: pack.public_token,
          payload,
        }),
      },
      enabled && !existing.enabled ? 201 : 200,
    );
  });

  app.get("/api/packages/:id/diff", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const baseline = await deps.store.getActiveBaseline(pkg.installation_id, pkg.id);
    const latest = await deps.store.latestScanReceipts({
      installationId: pkg.installation_id,
      packageId: pkg.id,
      limit: 2,
    });
    const current = latest[0] ?? null;
    const baselineReceipt = baseline ? await deps.store.getScanReceipt(baseline.receipt_id) : null;
    const previous = baselineReceipt ?? latest[1] ?? null;
    const comparedTo = baselineReceipt ? "baseline" : previous ? "previous" : null;
    const diff =
      current && previous && current.id !== previous.id
        ? mergeReleaseDiff(
            diffManifests(previous.manifest, current.manifest),
            diffFingerprints(previous.finding_fingerprints, current.finding_fingerprints),
          )
        : null;
    return c.json({
      package: { id: pkg.id, package_name: pkg.package_name },
      versus: comparedTo,
      baseline: baseline
        ? {
            id: baseline.id,
            receiptId: baseline.receipt_id,
            reason: baseline.reason,
            actorLogin: baseline.actor_login,
            createdAt: baseline.created_at,
          }
        : null,
      current: current
        ? {
            id: current.id,
            coordinate: current.coordinate,
            status: current.status,
            artifactSha256: current.artifact_sha256,
            createdAt: current.created_at,
          }
        : null,
      previous: previous
        ? {
            id: previous.id,
            coordinate: previous.coordinate,
            status: previous.status,
            artifactSha256: previous.artifact_sha256,
            createdAt: previous.created_at,
          }
        : null,
      diff,
    });
  });

  app.get("/api/packages/:id/baseline", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const baseline = await deps.store.getActiveBaseline(pkg.installation_id, pkg.id);
    return c.json({
      baseline: baseline
        ? {
            id: baseline.id,
            receiptId: baseline.receipt_id,
            reason: baseline.reason,
            actorLogin: baseline.actor_login,
            createdAt: baseline.created_at,
          }
        : null,
    });
  });

  app.post("/api/packages/:id/baseline", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, pkg.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const baselineDenied = await hostedWorkDenied(
      deps.store,
      pkg.installation_id,
      "Coverage ended. Subscribe to approve baselines.",
    );
    if (baselineDenied) return c.json({ error: baselineDenied.error }, baselineDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 8) {
      return c.json({ error: "Baseline reason must be at least 8 characters." }, 400);
    }
    const requested = Number(body.receiptId);
    const latest = await deps.store.latestScanReceipts({
      installationId: pkg.installation_id,
      packageId: pkg.id,
      limit: 1,
    });
    const receiptId = Number.isFinite(requested) && requested > 0 ? requested : (latest[0]?.id ?? NaN);
    if (!Number.isFinite(receiptId) || receiptId <= 0) {
      return c.json({ error: "Scan this package once before approving a baseline." }, 400);
    }
    const receipt = await deps.store.getScanReceipt(receiptId);
    if (
      !receipt ||
      receipt.installation_id !== pkg.installation_id ||
      receipt.package_id !== pkg.id
    ) {
      return c.json({ error: "Unknown receipt for this package." }, 404);
    }
    const baseline = await deps.store.insertScanBaseline({
      installationId: pkg.installation_id,
      packageId: pkg.id,
      repoId: receipt.repo_id,
      receiptId: receipt.id,
      reason,
      actorUserId: user.userId,
      actorLogin: user.login,
    });
    await recordAudit({
      installationId: pkg.installation_id,
      actorLogin: user.login,
      action: "baseline.save",
      summary: `Approved baseline for ${pkg.package_name}`,
      targetKind: "package",
      targetId: pkg.package_name,
    });
    return c.json(
      {
        ok: true,
        baseline: {
          id: baseline.id,
          receiptId: baseline.receipt_id,
          reason: baseline.reason,
          actorLogin: baseline.actor_login,
          createdAt: baseline.created_at,
        },
      },
      201,
    );
  });

  app.get("/api/exceptions", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installationId = Number(c.req.query("installationId"));
    const packageId = Number(c.req.query("packageId"));
    const exceptions = await deps.store.listExceptionsForUser(user.userId, {
      installationId: Number.isFinite(installationId) && installationId > 0 ? installationId : undefined,
      packageId: Number.isFinite(packageId) && packageId > 0 ? packageId : undefined,
    });
    return c.json({ exceptions: exceptions.map(publicException) });
  });

  app.post("/api/exceptions", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for this allowlist entry." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const allowDenied = await hostedWorkDenied(
      deps.store,
      installationId,
      "Coverage ended. Subscribe to manage allowlists.",
    );
    if (allowDenied) return c.json({ error: allowDenied.error }, allowDenied.status);
    const packageIdRaw = Number(body.packageId);
    const packageId = Number.isFinite(packageIdRaw) && packageIdRaw > 0 ? packageIdRaw : null;
    if (packageId) {
      const pkg = await deps.store.getWatchedPackage(packageId);
      if (!pkg || pkg.installation_id !== installationId) {
        return c.json({ error: "Unknown package for this installation." }, 404);
      }
    }
    try {
      const parsed = validateExceptionInput({
        rule: String(body.rule ?? ""),
        pathPattern: typeof body.path === "string" ? body.path : typeof body.pathPattern === "string" ? body.pathPattern : null,
        reason: String(body.reason ?? ""),
        expiresAt: String(body.expires ?? body.expiresAt ?? ""),
        actor: user.login,
      });
      const row = await deps.store.insertPolicyException({
        installationId,
        packageId,
        rule: parsed.rule,
        pathPattern: parsed.pathPattern,
        reason: parsed.reason,
        actorUserId: user.userId,
        actorLogin: user.login,
        expiresAt: parsed.expiresAt,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "exception.save",
        summary: `Saved allowlist ${parsed.rule}`,
        targetKind: "exception",
        targetId: parsed.rule,
      });
      return c.json({ ok: true, exception: publicException(row) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that allowlist entry." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/exceptions/:id/revoke", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown allowlist entry." }, 404);
    const existing = (
      await deps.store.listExceptionsForUser(user.userId)
    ).find((row) => row.id === id);
    if (!existing) return c.json({ error: "Unknown allowlist entry." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, existing.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const revokeDenied = await hostedWorkDenied(
      deps.store,
      existing.installation_id,
      "Coverage ended. Subscribe to manage allowlists.",
    );
    if (revokeDenied) return c.json({ error: revokeDenied.error }, revokeDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, existing.rule);
    if (confirmError) return c.json(confirmError, 400);
    const row = await deps.store.revokePolicyExceptionForUser(id, user.userId, user.login);
    if (!row) return c.json({ error: "Unknown allowlist entry." }, 404);
    await recordAudit({
      installationId: existing.installation_id,
      actorLogin: user.login,
      action: "exception.revoke",
      summary: `Revoked allowlist ${existing.rule}`,
      targetKind: "exception",
      targetId: existing.rule,
    });
    return c.json({ ok: true, exception: publicException(row) });
  });

  app.get("/api/verify/:token", async (c) => {
    const verifyLimited = rateLimited(
      c,
      scanLimiter,
      `verify:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many verification page reads from this address. Wait and try again.",
    );
    if (verifyLimited) return verifyLimited;
    const token = parsePublicToken(c.req.param("token") ?? "");
    if (!token) return c.json({ error: PUBLIC_PAGE_UNKNOWN_ERROR }, 404);
    const page = await deps.store.getReleasePublicPageByToken(token);
    if (!page || !page.enabled) return c.json({ error: PUBLIC_PAGE_UNKNOWN_ERROR }, 404);
    const revision = await deps.store.getReleaseRevision(page.revision_id);
    if (!revision || revision.installation_id !== page.installation_id) {
      return c.json({ error: PUBLIC_PAGE_UNKNOWN_ERROR }, 404);
    }
    const locations = await deps.store.listDeliveryLocationsForRevisions([revision.id]);
    const approval =
      latestByRevision(await deps.store.listReleaseApprovalsForRevisions([revision.id])).get(
        revision.id,
      ) ?? null;
    return c.json({
      verification: buildPublicVerificationView({
        token: page.public_token,
        revision,
        locations,
        approval,
      }),
    });
  });

  app.get("/api/advisory/:token", async (c) => {
    const advisoryLimited = rateLimited(
      c,
      scanLimiter,
      `verify:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many verification page reads from this address. Wait and try again.",
    );
    if (advisoryLimited) return advisoryLimited;
    const token = parseAdvisoryToken(c.req.param("token") ?? "");
    if (!token) return c.json({ error: ADVISORY_UNKNOWN_ERROR }, 404);
    const pack = await deps.store.getIdentityEvidencePackByToken(token);
    if (!pack || !pack.enabled) return c.json({ error: ADVISORY_UNKNOWN_ERROR }, 404);
    const payload = parseStoredEvidencePayload(pack.payload);
    if (!payload) return c.json({ error: ADVISORY_UNKNOWN_ERROR }, 404);
    return c.json({
      advisory: buildPublicAdvisoryView({
        token: pack.public_token,
        payload,
      }),
    });
  });

  app.get("/api/releases", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const releases = await deps.store.listReleaseRevisionsForUser(user.userId, {
      installationId: queryInstallationId(c),
    });
    const revisionIds = releases.map((row) => row.id);
    const locations = await deps.store.listDeliveryLocationsForRevisions(revisionIds);
    const approvals = latestByRevision(await deps.store.listReleaseApprovalsForRevisions(revisionIds));
    const holds = latestByRevision(await deps.store.listReleaseLegalHoldsForRevisions(revisionIds));
    const pages = new Map(
      (await deps.store.listReleasePublicPagesForRevisions(revisionIds)).map((page) => [
        page.revision_id,
        page,
      ]),
    );
    const attestationRows = await deps.store.listReleaseAttestationsForRevisions(revisionIds);
    const attestationsByRevision = groupedByRevision(attestationRows);
    const installIds = [...new Set(releases.map((row) => row.installation_id))];
    const hideAttestations = new Set<number>();
    for (const installationId of installIds) {
      const billing = await deps.store.installationBilling(installationId);
      if (attestationPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan)) {
        hideAttestations.add(installationId);
      }
    }
    const byRevision = new Map<number, ReturnType<typeof publicDeliveryLocation>[]>();
    for (const location of locations) {
      const list = byRevision.get(location.revision_id) ?? [];
      list.push(publicDeliveryLocation(location));
      byRevision.set(location.revision_id, list);
    }
    return c.json({
      releases: releases.map((row) =>
        publicRelease(
          row,
          byRevision.get(row.id) ?? [],
          approvals.get(row.id) ?? null,
          holds.get(row.id) ?? null,
          pages.get(row.id) ?? null,
          hideAttestations.has(row.installation_id)
            ? []
            : latestPublicAttestations(attestationsByRevision.get(row.id) ?? []),
        ),
      ),
    });
  });

  app.get("/api/releases/export", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = queryInstallationId(c);
    const installationId =
      requested && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation for the release ledger." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({
        exportedAt: new Date().toISOString(),
        installationId,
        retentionDays: 90,
        releases: [],
      });
    }
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = governancePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const releases = await deps.store.listReleaseRevisionsForUser(user.userId, {
      installationId,
      limit: RELEASE_EXPORT_LIMIT,
    });
    const revisionIds = releases.map((row) => row.id);
    const locations = await deps.store.listDeliveryLocationsForRevisions(revisionIds);
    const approvals = await deps.store.listReleaseApprovalsForRevisions(revisionIds);
    const holds = await deps.store.listReleaseLegalHoldsForRevisions(revisionIds);
    const locationsByRevision = groupedByRevision(locations);
    const approvalsByRevision = groupedByRevision(approvals);
    const holdsByRevision = groupedByRevision(holds);
    const attestationsByRevision = groupedByRevision(
      await deps.store.listReleaseAttestationsForRevisions(revisionIds),
    );
    const latestApproval = latestByRevision(approvals);
    const latestHold = latestByRevision(holds);
    const pages = new Map(
      (await deps.store.listReleasePublicPagesForRevisions(revisionIds)).map((page) => [
        page.revision_id,
        page,
      ]),
    );
    return c.json({
      exportedAt: new Date().toISOString(),
      installationId,
      retentionDays: billing?.retentionDays ?? 90,
      releases: releases.map((row) => ({
        id: row.id,
        channel: row.channel,
        coordinate: row.coordinate,
        artifactSha256: row.artifact_sha256,
        artifactSha512: row.artifact_sha512,
        artifactBytes: row.artifact_bytes,
        mediaType: row.media_type,
        sourceRevision: row.source_revision,
        ciRunUrl: row.ci_run_url,
        previousSha256: row.previous_sha256,
        mismatch: row.mismatch,
        receiptStatus: row.receipt_status,
        createdAt: row.created_at,
        approval: latestApproval.get(row.id) ? publicApproval(latestApproval.get(row.id)!) : null,
        approvals: (approvalsByRevision.get(row.id) ?? []).map(publicApproval),
        legalHold: publicLegalHold(latestHold.get(row.id) ?? null),
        holds: (holdsByRevision.get(row.id) ?? []).map((hold) => ({
          action: hold.action,
          actorLogin: hold.actor_login,
          reason: hold.reason,
          createdAt: hold.created_at,
        })),
        publicPage: publicPageSummary(pages.get(row.id) ?? null),
        attestations: latestPublicAttestations(attestationsByRevision.get(row.id) ?? []),
        locations: exportReleaseLocations(locationsByRevision.get(row.id)),
      })),
    });
  });

  app.get("/api/releases/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const locations = await deps.store.listDeliveryLocationsForRevisions([row.id]);
    const approvals = await deps.store.listReleaseApprovalsForRevisions([row.id]);
    const holds = await deps.store.listReleaseLegalHoldsForRevisions([row.id]);
    const page = await deps.store.getReleasePublicPageByRevision(row.id);
    const billing = await deps.store.installationBilling(row.installation_id);
    const hideAttestations = Boolean(
      attestationPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan),
    );
    const attestations = hideAttestations
      ? []
      : latestPublicAttestations(await deps.store.listReleaseAttestationsForRevisions([row.id]));
    return c.json({
      release: publicRelease(
        row,
        locations.map(publicDeliveryLocation),
        latestByRevision(approvals).get(row.id) ?? null,
        latestByRevision(holds).get(row.id) ?? null,
        page,
        attestations,
      ),
    });
  });

  app.get("/api/releases/:id/attestations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = attestationPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const rows = await deps.store.listReleaseAttestationsForRevisions([row.id]);
    return c.json({
      attestations: latestPublicAttestations(rows),
      history: rows.map(publicAttestation),
    });
  });

  app.post("/api/releases/:id/attestations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = attestationPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const workDenied = await hostedWorkDenied(
      deps.store,
      row.installation_id,
      ATTESTATION_UNPAID_ERROR,
    );
    if (workDenied) return c.json({ error: workDenied.error }, workDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, row.coordinate);
    if (confirmError) return c.json(confirmError, 400);
    try {
      const refreshed = await refreshReleaseAttestations({
        store: deps.store,
        github: deps.github,
        revision: row,
        actorLogin: user.login,
      });
      await recordAudit({
        installationId: row.installation_id,
        actorLogin: user.login,
        action: "release.attest",
        summary: `Refreshed attestations for ${row.coordinate}`,
        targetKind: "release",
        targetId: row.coordinate,
      });
      return c.json(
        {
          ok: true,
          attestations: latestPublicAttestations(refreshed.rows),
          changes: refreshed.changes,
        },
        201,
      );
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : ATTESTATION_NO_SOURCE_ERROR,
        },
        errorStatus(error),
      );
    }
  });

  app.post("/api/releases/:id/public", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const publishDenied = await hostedWorkDenied(deps.store, row.installation_id, PUBLIC_PAGE_UNPAID_ERROR);
    if (publishDenied) return c.json({ error: publishDenied.error }, publishDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, row.coordinate);
    if (confirmError) return c.json(confirmError, 400);
    const enabled = body.enabled === true;
    if (body.enabled !== true && body.enabled !== false) {
      return c.json({ error: "Set enabled to true or false." }, 400);
    }
    const existing = await deps.store.getReleasePublicPageByRevision(row.id);
    if (enabled) {
      if (existing?.enabled) return c.json({ error: PUBLIC_PAGE_ALREADY_ERROR }, 409);
      if (!existing) {
        const enabledCount = await deps.store.countEnabledPublicPages(row.installation_id);
        if (enabledCount >= MAX_PUBLIC_PAGES_PER_INSTALL) {
          return c.json({ error: PUBLIC_PAGE_CAP_ERROR }, 400);
        }
      }
    } else if (!existing?.enabled) {
      return c.json({ error: PUBLIC_PAGE_MISSING_ERROR }, 400);
    }
    const page = await deps.store.upsertReleasePublicPage({
      installationId: row.installation_id,
      revisionId: row.id,
      publicToken: existing?.public_token ?? mintPublicToken(),
      enabled,
      actorLogin: user.login,
    });
    await recordAudit({
      installationId: row.installation_id,
      actorLogin: user.login,
      action: enabled ? "release.publish_verify" : "release.unpublish_verify",
      summary: enabled
        ? `Published verification page for ${row.coordinate}`
        : `Unpublished verification page for ${row.coordinate}`,
      targetKind: "release",
      targetId: row.coordinate,
    });
    return c.json({ ok: true, publicPage: publicPageSummary(page) }, enabled && !existing ? 201 : 200);
  });

  app.post("/api/releases/:id/approvals", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = governancePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, row.coordinate);
    if (confirmError) return c.json(confirmError, 400);
    let decision: ReturnType<typeof parseApprovalDecision>;
    let reason: string;
    try {
      decision = parseApprovalDecision(body.decision);
      reason = parseGovernanceReason(body.reason);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not record that decision." },
        errorStatus(error),
      );
    }
    if (decision === "approved") {
      const blocked = shippingBlockedReason(row);
      if (blocked) return c.json({ error: blocked }, 409);
      const attachers = await deps.store.listDeliveryAttacherLogins(row.id);
      if (attachers.includes(user.login)) {
        return c.json({ error: GOVERNANCE_SOD_ATTACH_ERROR }, 409);
      }
      const policy = await deps.store.getSigningPolicy(row.installation_id);
      const latestAttestations = new Map(
        [...latestAttestationBySource(
          await deps.store.listReleaseAttestationsForRevisions([row.id]),
        ).entries()].map(([source, attestation]) => [source, rowToFacts(attestation)]),
      );
      const policyBlocked = signingPolicyBlocksApprove(policy, latestAttestations);
      if (policyBlocked) return c.json({ error: policyBlocked }, 409);
    }
    const latest = latestByRevision(await deps.store.listReleaseApprovalsForRevisions([row.id])).get(
      row.id,
    );
    if (latest && latest.decision === decision && latest.actor_login === user.login) {
      return c.json({ error: GOVERNANCE_DUPLICATE_ERROR }, 409);
    }
    const recorded = await deps.store.insertReleaseApproval({
      installationId: row.installation_id,
      revisionId: row.id,
      decision,
      reason,
      actorLogin: user.login,
    });
    await recordAudit({
      installationId: row.installation_id,
      actorLogin: user.login,
      action: decision === "approved" ? "release.approve" : "release.reject",
      summary:
        decision === "approved"
          ? `Approved shipping ${row.coordinate}`
          : `Rejected shipping ${row.coordinate}`,
      targetKind: "release",
      targetId: row.coordinate,
    });
    return c.json({ ok: true, approval: publicApproval(recorded) }, 201);
  });

  app.post("/api/releases/:id/holds", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(row.installation_id);
    const planDenied = governancePlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, row.coordinate);
    if (confirmError) return c.json(confirmError, 400);
    let action: ReturnType<typeof parseHoldAction>;
    let reason: string;
    try {
      action = parseHoldAction(body.action);
      reason = parseGovernanceReason(body.reason);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not record that legal hold." },
        errorStatus(error),
      );
    }
    const latest = latestByRevision(await deps.store.listReleaseLegalHoldsForRevisions([row.id])).get(
      row.id,
    );
    if (action === "place") {
      if (latest?.action === "place") return c.json({ error: GOVERNANCE_HELD_ERROR }, 409);
    } else {
      if (latest?.action !== "place") return c.json({ error: GOVERNANCE_NOT_HELD_ERROR }, 400);
      if (latest.actor_login === user.login) {
        return c.json({ error: GOVERNANCE_SOD_HOLD_ERROR }, 409);
      }
    }
    const recorded = await deps.store.insertReleaseLegalHold({
      installationId: row.installation_id,
      revisionId: row.id,
      action,
      reason,
      actorLogin: user.login,
    });
    await recordAudit({
      installationId: row.installation_id,
      actorLogin: user.login,
      action: action === "place" ? "release.hold" : "release.release_hold",
      summary:
        action === "place"
          ? `Placed legal hold on ${row.coordinate}`
          : `Released legal hold on ${row.coordinate}`,
      targetKind: "release",
      targetId: row.coordinate,
    });
    return c.json(
      {
        ok: true,
        hold: {
          action: recorded.action,
          actorLogin: recorded.actor_login,
          reason: recorded.reason,
          createdAt: recorded.created_at,
        },
      },
      201,
    );
  });

  app.post("/api/releases/:id/locations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const attachDenied = await hostedWorkDenied(
      deps.store,
      row.installation_id,
      "Coverage ended. Subscribe to verify delivery URLs.",
    );
    if (attachDenied) return c.json({ error: attachDenied.error }, attachDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const parsed = parseDeliveryUrl(String(body.url ?? ""));
    if (!parsed) {
      return c.json({ error: "Delivery URL must be https and a public hostname." }, 400);
    }
    let mediaType: string | null;
    try {
      mediaType = parseDeliveryMediaType(typeof body.mediaType === "string" ? body.mediaType : null);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Media type is not allowed." },
        error instanceof DeliveryVerifyError ? error.status : 400,
      );
    }
    const publicHost = await assertPublicWebhookHost(
      parsed.host,
      deps.webhookLookup ?? lookupWebhookHost,
    );
    if (!publicHost) {
      return c.json({ error: "Delivery URL resolved to a private address." }, 400);
    }
    const existing = await deps.store.listDeliveryLocationsForRevisions([row.id]);
    if (existing.some((location) => location.url === parsed.url)) {
      return c.json({ error: "That URL is already attached to this release." }, 409);
    }
    if (existing.length >= MAX_DELIVERY_LOCATIONS_PER_REVISION) {
      return c.json({ error: `At most ${MAX_DELIVERY_LOCATIONS_PER_REVISION} delivery URLs per release.` }, 400);
    }
    const installCount = await deps.store.countDeliveryLocations({
      installationId: row.installation_id,
    });
    if (installCount >= MAX_DELIVERY_LOCATIONS_PER_INSTALL) {
      return c.json({ error: `At most ${MAX_DELIVERY_LOCATIONS_PER_INSTALL} delivery URLs on this install.` }, 400);
    }
    const location = await deps.store.insertDeliveryLocation({
      installationId: row.installation_id,
      revisionId: row.id,
      url: parsed.url,
      host: parsed.host,
      expectedMediaType: mediaType ?? row.media_type,
      createdByLogin: user.login,
    });
    await recordAudit({
      installationId: row.installation_id,
      actorLogin: user.login,
      action: "delivery_location.save",
      summary: `Attached delivery URL ${parsed.redacted} on ${row.coordinate}`,
      targetKind: "delivery_location",
      targetId: parsed.redacted,
    });
    const queued = await enqueueDeliveryVerify(deps.store, {
      installationId: row.installation_id,
      locationId: location.id,
      revisionId: row.id,
    });
    if (queued.queued) deps.wakeWorker?.();
    return c.json(
      { ok: true, queued: queued.queued, location: publicDeliveryLocation(location) },
      201,
    );
  });

  app.post("/api/releases/:id/locations/:locationId/verify", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const locationId = Number(c.req.param("locationId"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown release." }, 404);
    if (!Number.isFinite(locationId) || locationId <= 0) return c.json({ error: "Unknown delivery URL." }, 404);
    const row = await deps.store.getReleaseRevisionForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown release." }, 404);
    const location = await deps.store.getDeliveryLocationForUser(locationId, user.userId);
    if (!location || location.revision_id !== row.id) {
      return c.json({ error: "Unknown delivery URL." }, 404);
    }
    const adminDenied = await requireInstallAdmin(user.userId, row.installation_id);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const verifyDenied = await hostedWorkDenied(
      deps.store,
      row.installation_id,
      "Coverage ended. Subscribe to verify delivery URLs.",
    );
    if (verifyDenied) return c.json({ error: verifyDenied.error }, verifyDenied.status);
    const verifyLimited = rateLimited(
      c,
      scanLimiter,
      `scan:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many hosted scans from this address. Wait and try again.",
    );
    if (verifyLimited) return verifyLimited;
    const queued = await enqueueDeliveryVerify(deps.store, {
      installationId: row.installation_id,
      locationId: location.id,
      revisionId: row.id,
    });
    if (queued.queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued: queued.queued, location: publicDeliveryLocation(location) });
  });

  app.get("/api/receipts", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const packageId = Number(c.req.query("packageId"));
    const repoId = Number(c.req.query("repoId"));
    const receipts = await deps.store.listScanReceiptsForUser(user.userId, {
      packageId: Number.isFinite(packageId) && packageId > 0 ? packageId : undefined,
      repoId: Number.isFinite(repoId) && repoId > 0 ? repoId : undefined,
    });
    return c.json({
      receipts: receipts.map((row) => ({
        id: row.id,
        installationId: row.installation_id,
        packageId: row.package_id,
        repoId: row.repo_id,
        coordinate: row.coordinate,
        status: row.status,
        artifactSha256: row.artifact_sha256,
        artifactBytes: row.artifact_bytes,
        engineVersion: row.engine_version,
        createdAt: row.created_at,
      })),
    });
  });

  app.get("/api/receipts/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown receipt." }, 404);
    const row = await deps.store.getScanReceiptForUser(id, user.userId);
    if (!row) return c.json({ error: "Unknown receipt." }, 404);
    return c.json({ receipt: row.receipt, id: row.id, createdAt: row.created_at });
  });

  app.post("/api/receipts/verify", async (c) => {
    const verifyLimited = rateLimited(
      c,
      scanLimiter,
      `verify:${requestIp(c)}`,
      deps.config.scanRateWindowMs,
      "Too many receipt checks from this address. Wait and try again.",
    );
    if (verifyLimited) return verifyLimited;
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const raw =
      typeof body.receipt === "string"
        ? body.receipt
        : body.receipt && typeof body.receipt === "object"
          ? JSON.stringify(body.receipt)
          : "";
    if (!raw) return c.json({ error: "Provide a receipt object or JSON string." }, 400);
    const expected = typeof body.sha256 === "string" ? body.sha256 : undefined;
    const result = verifyReceipt(raw, deps.config.receiptSecret, expected);
    if (!result.ok) return c.json({ ok: false, reason: result.reason }, 400);
    const receipt = result.receipt;
    return c.json({
      ok: true,
      status: receipt?.status,
      receiptOk: receipt?.ok ?? false,
      coordinate: receipt?.coordinate,
      artifactSha256: receipt?.artifactSha256,
      findingCount: receipt?.findingCount ?? 0,
      inconclusiveReason: receipt?.inconclusiveReason ?? null,
    });
  });

  app.get("/api/destinations", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const destinations = await deps.store.listNotificationDestinationsForUser(
      user.userId,
      queryInstallationId(c),
    );
    return c.json({ destinations: destinations.map(publicDestination) });
  });

  app.get("/api/destinations/deliveries", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const deliveries = await deps.store.listNotificationDeliveriesForUser(
      user.userId,
      queryInstallationId(c),
    );
    return c.json({
      deliveries: deliveries.map((row) => ({
        id: row.id,
        installationId: row.installationId,
        destinationId: row.destinationId,
        alertId: row.alertId,
        kind: row.kind,
        status: row.status,
        inventedIncident: row.inventedIncident,
        error: row.error,
        createdAt: row.createdAt,
      })),
    });
  });

  app.get("/api/destinations/routes", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const routes = await deps.store.listNotificationRoutesForUser(
      user.userId,
      queryInstallationId(c),
    );
    return c.json({
      routes: routes.map((row) => ({
        id: row.id,
        installationId: row.installationId,
        destinationId: row.destinationId,
        minSeverity: row.minSeverity,
        repoFullName: row.repoFullName,
        packageName: row.packageName,
        teamLogin: row.teamLogin,
        createdAt: row.createdAt,
      })),
    });
  });

  app.post("/api/destinations/routes", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach a route to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = routingPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const destinationId = Number(body.destinationId);
    if (!Number.isFinite(destinationId) || destinationId <= 0) {
      return c.json({ error: "Choose a Slack, SIEM, Jira, or PagerDuty destination to route." }, 400);
    }
    const destination = await deps.store.getNotificationDestinationForUser(
      destinationId,
      user.userId,
    );
    if (!destination || destination.installationId !== installationId) {
      return c.json({ error: "Unknown destination." }, 404);
    }
    const minSeverity = parseRouteMinSeverity(body.minSeverity ?? "all");
    if (!minSeverity) {
      return c.json({ error: "Use minSeverity all, warn, or critical." }, 400);
    }
    const repoRaw = String(body.repoFullName ?? "").trim();
    const packageRaw = String(body.packageName ?? "").trim();
    const teamRaw = String(body.teamLogin ?? "").trim();
    const repoFullName = repoRaw ? parseRouteRepoFullName(repoRaw) : null;
    if (repoRaw && !repoFullName) {
      return c.json({ error: "Use a repository as owner/name on this install." }, 400);
    }
    const packageName = packageRaw ? parseRoutePackageName(packageRaw) : null;
    if (packageRaw && !packageName) {
      return c.json({ error: "Use a watched npm package name on this install." }, 400);
    }
    const parsedTeam = teamRaw ? parseRouteTeamLogin(teamRaw) : null;
    if (teamRaw && !parsedTeam) {
      return c.json({ error: "Assign only to a GitHub login on this install." }, 400);
    }
    if (repoFullName && !(await deps.store.installationHasRepoFullName(installationId, repoFullName))) {
      return c.json({ error: "That repository is not on this GitHub install." }, 400);
    }
    if (packageName && !(await deps.store.installationHasWatchedPackage(installationId, packageName))) {
      return c.json({ error: "That package is not watched on this install." }, 400);
    }
    let teamLogin = parsedTeam;
    if (teamLogin) {
      const members = await deps.store.listInstallationMemberLogins(installationId);
      const wanted = teamLogin;
      const match = members.find((row) => row.toLowerCase() === wanted.toLowerCase());
      if (!match) {
        return c.json({ error: "Assign only to someone on this GitHub install." }, 400);
      }
      teamLogin = match;
    }
    if ((await deps.store.countNotificationRoutes(installationId)) >= MAX_NOTIFICATION_ROUTES) {
      return c.json({ error: `This install already has ${MAX_NOTIFICATION_ROUTES} routes.` }, 400);
    }
    try {
      const route = await deps.store.insertNotificationRoute({
        installationId,
        destinationId,
        minSeverity,
        repoFullName,
        packageName,
        teamLogin,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "route.save",
        summary: `Saved ${minSeverity} route for ${destination.host}`,
        targetKind: "route",
        targetId: destination.host,
      });
      return c.json(
        {
          ok: true,
          route: {
            id: route.id,
            installationId: route.installationId,
            destinationId: route.destinationId,
            minSeverity: route.minSeverity,
            repoFullName: route.repoFullName,
            packageName: route.packageName,
            teamLogin: route.teamLogin,
            createdAt: route.createdAt,
          },
        },
        201,
      );
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that route." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/destinations/route-test", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first.", inventedIncident: false }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json(
        { error: "Choose a GitHub installation to test routing.", inventedIncident: false },
        400,
      );
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json(
        { error: "That GitHub installation is not on your account.", inventedIncident: false },
        403,
      );
    }
    const severity = parseRouteSampleSeverity(body.severity ?? "critical");
    if (!severity) {
      return c.json({ error: "Use severity info, warn, or critical.", inventedIncident: false }, 400);
    }
    const repoRaw = String(body.repoFullName ?? "").trim();
    const packageRaw = String(body.packageName ?? "").trim();
    const repoFullName = repoRaw ? parseRouteRepoFullName(repoRaw) : null;
    if (repoRaw && !repoFullName) {
      return c.json(
        { error: "Use a repository as owner/name on this install.", inventedIncident: false },
        400,
      );
    }
    const packageName = packageRaw ? parseRoutePackageName(packageRaw) : null;
    if (packageRaw && !packageName) {
      return c.json(
        { error: "Use a watched npm package name on this install.", inventedIncident: false },
        400,
      );
    }
    const sample = { severity, repoFullName, packageName };
    const destinations = await deps.store.listNotificationDestinationsForUser(
      user.userId,
      installationId,
    );
    const routes = await deps.store.listNotificationRoutesForInstallation(installationId);
    const matched = destinations.filter((destination) =>
      destinationReceives(
        routes.filter((row) => row.destinationId === destination.id),
        sample,
      ),
    );
    const results: {
      id: number;
      kind: NotificationKind;
      host: string;
      ok: boolean;
      error: string | null;
    }[] = [];
    for (const destination of matched) {
      const posted = await testSavedDestination(destination);
      results.push({
        id: destination.id,
        kind: destination.kind,
        host: destination.host,
        ok: posted.ok,
        error: posted.error,
      });
    }
    const ok = results.every((row) => row.ok);
    return c.json({
      ok,
      inventedIncident: false,
      matched: results,
      detail: matched.length === 0
        ? "No destination matched that route. This is not a security incident."
        : ok
          ? "Matching destinations received a routed delivery test. This is not a security incident."
          : results.find((row) => !row.ok)?.error,
    }, matched.length === 0 || ok ? 200 : 502);
  });

  app.delete("/api/destinations/routes/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown route." }, 404);
    const route = await deps.store.getNotificationRouteForUser(id, user.userId);
    if (!route) return c.json({ error: "Unknown route." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, route.installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const destination = await deps.store.getNotificationDestinationForUser(
      route.destinationId,
      user.userId,
    );
    const confirmValue = destination?.host ?? "";
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, confirmValue);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteNotificationRouteForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown route." }, 404);
    await recordAudit({
      installationId: route.installationId,
      actorLogin: user.login,
      action: "route.delete",
      summary: `Removed route for ${confirmValue}`,
      targetKind: "route",
      targetId: confirmValue,
    });
    return c.json({ ok: true });
  });

  app.post("/api/destinations/slack", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach Slack to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = slackPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const parsed = parseSlackWebhook(String(body.webhookUrl ?? ""));
    if (!parsed) {
      return c.json(
        {
          error: "Use an https Slack incoming webhook on hooks.slack.com. Other hosts are not allowed.",
        },
        400,
      );
    }
    try {
      const destination = await deps.store.upsertSlackDestination({
        installationId,
        webhookUrl: parsed.url,
        host: parsed.host,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "destination.save",
        summary: `Saved Slack destination ${parsed.host}`,
        targetKind: "destination",
        targetId: parsed.host,
      });
      return c.json({ ok: true, destination: publicDestination(destination) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that Slack webhook." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/destinations/siem", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach a SIEM webhook to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = siemPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const parsed = parseSiemWebhook(String(body.webhookUrl ?? ""));
    if (!parsed) {
      return c.json(
        {
          error:
            "Use an https SIEM webhook on a public hostname. Private, local, metadata, and Slack hosts are not allowed.",
        },
        400,
      );
    }
    try {
      const destination = await deps.store.upsertSiemDestination({
        installationId,
        webhookUrl: parsed.url,
        host: parsed.host,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "destination.save",
        summary: `Saved SIEM destination ${parsed.host}`,
        targetKind: "destination",
        targetId: parsed.host,
      });
      return c.json({ ok: true, destination: publicDestination(destination) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that SIEM webhook." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/destinations/jira", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach Jira to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = jiraPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const site = parseJiraSite(String(body.site ?? body.host ?? ""));
    const email = parseJiraEmail(String(body.email ?? ""));
    const token = parseJiraToken(String(body.token ?? ""));
    const projectKey = parseJiraProjectKey(String(body.projectKey ?? ""));
    if (!site) {
      return c.json(
        {
          error: "Use a Jira Cloud site on *.atlassian.net. Other hosts are not allowed.",
        },
        400,
      );
    }
    if (!email) {
      return c.json({ error: "Use a Jira Cloud email for Basic auth." }, 400);
    }
    if (!token) {
      return c.json(
        { error: "Use a Jira Cloud API token. It is encrypted and never shown again." },
        400,
      );
    }
    if (!projectKey) {
      return c.json(
        { error: "Use a Jira project key (letters and numbers, starting with a letter)." },
        400,
      );
    }
    try {
      const destination = await deps.store.upsertJiraDestination({
        installationId,
        host: site.host,
        projectKey,
        secret: encodeJiraSecret({
          email,
          token,
          issueType: parseJiraIssueType(String(body.issueType ?? "Task")),
        }),
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "destination.save",
        summary: `Saved Jira destination ${site.host}`,
        targetKind: "destination",
        targetId: site.host,
      });
      return c.json({ ok: true, destination: publicDestination(destination) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that Jira destination." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/destinations/email", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach email to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = emailPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const parsed = parseEmailAddress(String(body.email ?? body.address ?? ""));
    if (!parsed) return c.json({ error: EMAIL_ADDRESS_ERROR }, 400);
    try {
      const destination = await deps.store.upsertEmailDestination({
        installationId,
        address: parsed.address,
        domain: parsed.domain,
        redacted: parsed.redacted,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "destination.save",
        summary: `Saved email destination ${parsed.domain}`,
        targetKind: "destination",
        targetId: parsed.domain,
      });
      return c.json({ ok: true, destination: publicDestination(destination) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that email address." },
        errorStatus(error),
      );
    }
  });

  app.post("/api/destinations/pagerduty", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const installations = await deps.store.listInstallationsForUser(user.userId);
    const requested = Number(body.installationId);
    const installationId =
      Number.isFinite(requested) && requested > 0
        ? requested
        : installations.length === 1
          ? installations[0].id
          : NaN;
    if (!Number.isFinite(installationId) || installationId <= 0) {
      return c.json({ error: "Choose a GitHub installation to attach PagerDuty to." }, 400);
    }
    if (!(await deps.store.userOwnsInstallation(user.userId, installationId))) {
      return c.json({ error: "That GitHub installation is not on your account." }, 403);
    }
    const adminDenied = await requireInstallAdmin(user.userId, installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const billing = await deps.store.installationBilling(installationId);
    const planDenied = pagerDutyPlanDeniedFromBilling(billing?.trialEndsAt, billing?.plan);
    if (planDenied) return c.json({ error: planDenied.error }, planDenied.status);
    const routingKey = parsePagerDutyRoutingKey(String(body.routingKey ?? body.routing_key ?? ""));
    if (!routingKey) {
      return c.json(
        {
          error:
            "Use a 32-character PagerDuty Events API routing key. It is encrypted and never shown again.",
        },
        400,
      );
    }
    try {
      const destination = await deps.store.upsertPagerDutyDestination({
        installationId,
        routingKey,
      });
      await recordAudit({
        installationId,
        actorLogin: user.login,
        action: "destination.save",
        summary: "Saved PagerDuty destination events.pagerduty.com",
        targetKind: "destination",
        targetId: "events.pagerduty.com",
      });
      return c.json({ ok: true, destination: publicDestination(destination) }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not save that PagerDuty destination." },
        errorStatus(error),
      );
    }
  });

  app.delete("/api/destinations/:id", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Unknown destination." }, 404);
    const destination = await deps.store.getNotificationDestinationForUser(id, user.userId);
    if (!destination) return c.json({ error: "Unknown destination." }, 404);
    const adminDenied = await requireInstallAdmin(user.userId, destination.installationId);
    if (adminDenied) return c.json({ error: adminDenied.error }, adminDenied.status);
    const body = jsonObj(await c.req.json().catch(() => ({})));
    const confirmError = typedConfirm(body, destination.host);
    if (confirmError) return c.json(confirmError, 400);
    const removed = await deps.store.deleteNotificationDestinationForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown destination." }, 404);
    await recordAudit({
      installationId: destination.installationId,
      actorLogin: user.login,
      action: "destination.delete",
      summary: `Removed ${destinationKindLabel(destination.kind)} destination ${destination.host}`,
      targetKind: "destination",
      targetId: destination.host,
    });
    return c.json({ ok: true });
  });

  app.post("/api/destinations/:id/test", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Unknown destination.", inventedIncident: false }, 404);
    }
    const destination = await deps.store.getNotificationDestinationForUser(id, user.userId);
    if (!destination) return c.json({ error: "Unknown destination.", inventedIncident: false }, 404);
    const posted = await testSavedDestination(destination);
    const label = destinationKindLabel(destination.kind);
    const detail =
      destination.kind === "jira"
        ? "Jira received a delivery test. This talked to Jira (myself and the project) and never created a ticket or Watch alert. This is not a security incident."
        : destination.kind === "pagerduty"
          ? "PagerDuty received a change-event delivery test. This never created an incident or Watch alert. This is not a security incident."
          : destination.kind === "email"
            ? "Email received a delivery test. This never created a Watch alert. This is not a security incident."
          : `${label} received a delivery test. This is not a security incident.`;
    const status = posted.ok ? 200 : posted.status === 503 ? 503 : 502;
    return c.json({
      ok: posted.ok,
      inventedIncident: false,
      status: posted.status,
      error: posted.ok ? null : posted.error,
      detail: posted.ok ? detail : posted.error,
    }, status);
  });

  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api")) return c.notFound();
    if (!processRunsHttp(deps.config.processRole)) return c.notFound();
    const served = await serveUi(c.req.path, deps.config.uiRoot);
    if (!served) return c.notFound();
    return served;
  });

  return app;
}
