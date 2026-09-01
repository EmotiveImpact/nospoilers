import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { bestCoverage, coverageFrom } from "../coverage.ts";
import { ENGINE_VERSION, scan } from "../scanner/index.ts";
import { verifyReceipt } from "../receipt.ts";
import { diffFingerprints, diffManifests, mergeReleaseDiff } from "../release-diff.ts";
import type { AppConfig } from "./config.ts";
import { databaseMode, githubAppConfigured } from "./config.ts";
import { cookieSettings } from "./cookies.ts";
import type { GithubPort } from "./github.ts";
import { verifyGitHubSignature } from "./hmac.ts";
import { createNpmPort, type NpmPort } from "./npm.ts";
import { checkWatchedPackage, connectWatchedPackage } from "./npm-watch.ts";
import { clientKey, createRateLimiter } from "./rate-limit.ts";
import {
  discoverAndQueueProspects,
  inspectAndQueueRepository,
} from "./prospects.ts";
import type { Store } from "./store.ts";
import type { ProspectStatus } from "./store.ts";
import { readSignedSession, signSession } from "./store.ts";
import { enqueueFromWebhook } from "./webhooks.ts";

const MAX_UPLOAD = 80 * 1024 * 1024;

export type AppDeps = {
  config: AppConfig;
  store: Store;
  github: GithubPort;
  npm?: NpmPort;
  scan?: typeof scan;
  wakeWorker?: () => void;
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

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const scanFn = deps.scan ?? scan;
  const npm = deps.npm ?? createNpmPort();
  const cookieName = "ns_session";
  const scanLimiter = createRateLimiter({
    limit: deps.config.scanRateLimit,
    windowMs: deps.config.scanRateWindowMs,
  });

  async function currentUser(c: Context) {
    const raw = getCookie(c, cookieName);
    const sessionId = readSignedSession(deps.config.sessionSecret, raw);
    if (!sessionId) return null;
    return await deps.store.getSession(sessionId);
  }

  async function hostedCoverageForUser(user: {
    userId: string;
    trialEndsAt: string | null;
    plan: string | null;
  }) {
    const installations = await deps.store.listInstallationsForUser(user.userId);
    if (installations.length === 0) return coverageFrom(user.trialEndsAt, user.plan);
    return bestCoverage(
      installations.map((row) =>
        row.suspended ? coverageFrom(null, null) : coverageFrom(row.trialEndsAt, row.plan),
      ),
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

  app.post("/api/internal/prospects/discover", async (c) => {
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

  app.post("/api/internal/prospects/:id/rescan", async (c) => {
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
    const ip = clientKey(c.req.header("x-forwarded-for"), c.req.header("x-real-ip"));
    if (!scanLimiter.allow(ip)) {
      return c.json({ error: "Too many hosted scans from this address. Wait and try again." }, 429);
    }
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
    const state = crypto.randomUUID();
    setCookie(c, "ns_oauth_state", state, cookieSettings(deps.config.appBaseUrl, 600));
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", deps.config.githubClientId);
    url.searchParams.set("redirect_uri", `${deps.config.appBaseUrl}/api/auth/github/callback`);
    url.searchParams.set("state", state);
    return c.redirect(url.toString());
  });

  app.get("/api/auth/github/callback", async (c) => {
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

  app.post("/api/auth/logout", (c) => {
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
    });
  });

  app.get("/api/repos", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const repos = await deps.store.listReposForUser(user.userId);
    return c.json({ repos });
  });

  app.get("/api/alerts", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const alerts = await deps.store.listAlertsForUser(user.userId);
    return c.json({ alerts });
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
    if (!(await deps.store.installationWorkAllowed(repo.installation_id))) {
      return c.json({ error: "Coverage ended. Subscribe to keep scanning releases." }, 402);
    }
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
    if (result.inserted) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.inserted, jobId: result.id });
  });

  app.get("/api/packages", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const packages = await deps.store.listWatchedPackagesForUser(user.userId);
    return c.json({ packages });
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
    const removed = await deps.store.deleteWatchedPackageForUser(id, user.userId);
    if (!removed) return c.json({ error: "Unknown package." }, 404);
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
    if (!(await deps.store.installationWorkAllowed(pkg.installation_id))) {
      return c.json({ error: "Coverage ended. Subscribe to keep watching npm packages." }, 402);
    }
    const result = await checkWatchedPackage(deps.store, npm, pkg);
    if (result.queued) deps.wakeWorker?.();
    return c.json({ ok: true, queued: result.queued, deltas: result.deltas });
  });

  app.get("/api/packages/:id/diff", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ error: "Sign in with GitHub first." }, 401);
    const id = Number(c.req.param("id"));
    const pkg = await deps.store.getWatchedPackage(id);
    if (!pkg || !(await deps.store.userOwnsInstallation(user.userId, pkg.installation_id))) {
      return c.json({ error: "Unknown package." }, 404);
    }
    const rows = await deps.store.latestScanReceipts({
      installationId: pkg.installation_id,
      packageId: pkg.id,
      limit: 2,
    });
    const current = rows[0] ?? null;
    const previous = rows[1] ?? null;
    const diff =
      current && previous
        ? mergeReleaseDiff(
            diffManifests(previous.manifest, current.manifest),
            diffFingerprints(previous.finding_fingerprints, current.finding_fingerprints),
          )
        : null;
    return c.json({
      package: { id: pkg.id, package_name: pkg.package_name },
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
    return c.json({
      ok: true,
      status: result.receipt?.status,
      coordinate: result.receipt?.coordinate,
      artifactSha256: result.receipt?.artifactSha256,
    });
  });

  return app;
}
