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
import { databaseMode, githubAppConfigured } from "./config.ts";
import { cookieSettings } from "./cookies.ts";
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
import { checkWatchedPackage, connectWatchedPackage, protectWatchedPackage } from "./npm-watch.ts";
import { checkWatchedOrigin, connectWatchedOrigin } from "./web-watch.ts";
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
  discoverAndQueueProspects,
  inspectAndQueueRepository,
} from "./prospects.ts";
import { runProspectNpmFeed } from "./prospect-feed.ts";
import type { Store } from "./store.ts";
import type { AlertEventRow, AlertRow, IdentityCandidateRow, PolicyExceptionRow, ProspectStatus, ReleaseRevisionRow } from "./store.ts";
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
  parseAllowlistReason,
} from "./identity-signals.ts";
import { createLogNotifier, type AlertNotifier } from "./notifier.ts";

const MAX_UPLOAD = 80 * 1024 * 1024;

export type AppDeps = {
  config: AppConfig;
  store: Store;
  github: GithubPort;
  npm?: NpmPort;
  scan?: typeof scan;
  wakeWorker?: () => void;
  slackFetch?: typeof fetch;
  webhookLookup?: WebhookHostLookup;
  notifier?: AlertNotifier;
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
  return {
    id: row.id,
    installation_id: row.installation_id,
    repo_id: row.repo_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    findings: row.findings,
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
    rotation_checklist: rotationChecklist(findingRules(row.findings)),
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

function publicRelease(
  row: ReleaseRevisionRow,
  locations: ReturnType<typeof publicDeliveryLocation>[] = [],
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
    sourceRevision: row.source_revision,
    ciRunUrl: row.ci_run_url,
    previousSha256: row.previous_sha256,
    mismatch: row.mismatch,
    receiptStatus: row.receipt_status,
    createdAt: row.created_at,
    locations,
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

function destinationKindLabel(kind: "slack" | "siem" | "jira"): string {
  if (kind === "jira") return "Jira";
  if (kind === "siem") return "SIEM";
  return "Slack";
}

function publicDestination(row: {
  id: number;
  installationId: number;
  kind: "slack" | "siem" | "jira";
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
    projectKey: row.kind === "jira" ? (row.projectKey ?? null) : null,
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
  const notifier = deps.notifier ?? createLogNotifier(deps.store);
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
    kind: "slack" | "siem" | "jira";
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

  async function isInternalAdmin(c: Context): Promise<boolean> {
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

  app.use("/api/internal/*", async (c, next) => {
    if (!(await isInternalAdmin(c))) {
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

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      name: "nospoilers",
      githubApp: githubAppConfigured(deps.config),
      database: {
        mode: databaseMode(deps.config.databaseUrl),
      },
      worker: {
        recoveryIntervalMs: deps.config.workerIntervalMs,
        visibilityPollIntervalMs: deps.config.pollIntervalMs,
      },
    }),
  );

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
      database: {
        mode: databaseMode(deps.config.databaseUrl),
        ok: databaseOk,
      },
    };
    return c.json(body, databaseOk ? 200 : 503);
  });

  app.get("/api/internal/prospects", async (c) => {
    const limit = Number(c.req.query("limit") ?? 100);
    const [prospects, stats] = await Promise.all([
      deps.store.listProspects(Number.isFinite(limit) ? limit : 100),
      deps.store.prospectStats(),
    ]);
    return c.json({
      prospects,
      stats,
      policy: {
        publicArtifactsOnly: true,
        sourceRetained: false,
        outreachAutomatic: false,
      },
    });
  });

  app.get("/api/internal/queue", async (c) => {
    const health = await deps.store.ownerQueueHealth(deps.config.jobStaleMs);
    return c.json(health);
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
    const state = crypto.randomUUID();
    setCookie(c, "ns_oauth_state", state, cookieSettings(deps.config.appBaseUrl, 600));
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", deps.config.githubClientId);
    url.searchParams.set("redirect_uri", `${deps.config.appBaseUrl}/api/auth/github/callback`);
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
      cookieSettings(deps.config.appBaseUrl, 30 * 24 * 60 * 60),
    );
    deleteCookie(c, "ns_oauth_state", { path: "/" });
    return c.redirect("/");
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
    if (!user) return c.json({ user: null, githubApp: githubAppConfigured(deps.config) });
    const installations = await deps.store.listInstallationsForUser(user.userId);
    return c.json({
      user: { id: user.userId, login: user.login, avatarUrl: user.avatarUrl },
      coverage: await hostedCoverageForUser(user),
      installations,
      githubApp: githubAppConfigured(deps.config),
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
      });
      if (result.queued) deps.wakeWorker?.();
      return c.json({ ok: true, queued: result.queued, origin: result.origin }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Could not watch that website." },
        errorStatus(error),
      );
    }
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
    const checkDenied = await hostedWorkDenied(
      deps.store,
      origin.installation_id,
      "Coverage ended. Subscribe to keep watching production websites.",
    );
    if (checkDenied) return c.json({ error: checkDenied.error }, checkDenied.status);
    const originUsage = await deps.store.hostedUsageStatus(origin.installation_id);
    if (originUsage.exhausted) {
      await deps.store.noteFairUseExhausted(origin.installation_id);
      return fairUseResponse(c);
    }
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

  app.get("/api/releases", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const releases = await deps.store.listReleaseRevisionsForUser(user.userId, {
      installationId: queryInstallationId(c),
    });
    const locations = await deps.store.listDeliveryLocationsForRevisions(releases.map((row) => row.id));
    const byRevision = new Map<number, ReturnType<typeof publicDeliveryLocation>[]>();
    for (const location of locations) {
      const list = byRevision.get(location.revision_id) ?? [];
      list.push(publicDeliveryLocation(location));
      byRevision.set(location.revision_id, list);
    }
    return c.json({
      releases: releases.map((row) => publicRelease(row, byRevision.get(row.id) ?? [])),
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
    return c.json({ release: publicRelease(row, locations.map(publicDeliveryLocation)) });
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
      expectedMediaType: mediaType,
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
      return c.json({ error: "Choose a Slack, SIEM, or Jira destination to route." }, 400);
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
      kind: "slack" | "siem" | "jira";
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
        : `${label} received a delivery test. This is not a security incident.`;
    return c.json({
      ok: posted.ok,
      inventedIncident: false,
      status: posted.status,
      error: posted.ok ? null : posted.error,
      detail: posted.ok ? detail : posted.error,
    }, posted.ok ? 200 : 502);
  });

  return app;
}
