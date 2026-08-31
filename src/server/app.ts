import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { coverageFrom } from "../coverage.ts";
import { scan } from "../scanner/index.ts";
import type { AppConfig } from "./config.ts";
import { githubAppConfigured } from "./config.ts";
import type { GithubPort } from "./github.ts";
import { verifyGitHubSignature } from "./hmac.ts";
import type { Store } from "./store.ts";
import { readSignedSession, signSession } from "./store.ts";
import { enqueueFromWebhook } from "./webhooks.ts";

const MAX_UPLOAD = 80 * 1024 * 1024;

export type AppDeps = {
  config: AppConfig;
  store: Store;
  github: GithubPort;
  scan?: typeof scan;
};

function jsonObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const scanFn = deps.scan ?? scan;
  const cookieName = "ns_session";

  async function currentUser(c: Context) {
    const raw = getCookie(c, cookieName);
    const sessionId = readSignedSession(deps.config.sessionSecret, raw);
    if (!sessionId) return null;
    return await deps.store.getSession(sessionId);
  }

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      name: "nospoilers",
      githubApp: githubAppConfigured(deps.config),
    }),
  );

  app.post("/api/scan", async (c) => {
    const user = await currentUser(c);
    if (user) {
      const coverage = coverageFrom(user.trialEndsAt, user.plan);
      if (coverage.status === "ended") {
        return c.json({ error: "Coverage ended. Subscribe to unpack on our servers." }, 402);
      }
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
        return c.json({ error: "Upload is larger than 80 MB." }, 400);
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
    setCookie(c, "ns_oauth_state", state, {
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      maxAge: 600,
    });
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
    setCookie(c, cookieName, signSession(deps.config.sessionSecret, sessionId), {
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      maxAge: 30 * 24 * 60 * 60,
    });
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
    await deps.store.linkUserInstallation(installationId, user.userId);
    return c.redirect("/");
  });

  app.get("/api/me", async (c) => {
    const user = await currentUser(c);
    if (!user) return c.json({ user: null, githubApp: githubAppConfigured(deps.config) });
    const installations = await deps.store.listInstallationsForUser(user.userId);
    return c.json({
      user: { id: user.userId, login: user.login, avatarUrl: user.avatarUrl },
      coverage: coverageFrom(user.trialEndsAt, user.plan),
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
    if (coverageFrom(user.trialEndsAt, user.plan).status === "ended") {
      return c.json({ error: "Coverage ended. Subscribe to keep scanning releases." }, 402);
    }
    const repoId = Number(c.req.param("id"));
    const repo = await deps.store.getRepo(repoId);
    if (!repo) return c.json({ error: "Unknown repository." }, 404);
    const allowed = await deps.store.listReposForUser(user.userId);
    if (!allowed.some((row) => row.id === repo.id)) {
      return c.json({ error: "That repository is not on your install." }, 403);
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
    return c.json({ ok: true, queued: result.inserted, jobId: result.id });
  });

  return app;
}
