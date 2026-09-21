import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseFromEmail } from "./email.ts";

export type AppConfig = {
  port: number;
  appBaseUrl: string;
  databaseUrl: string;
  githubAppId: string;
  githubPrivateKey: string;
  githubWebhookSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  githubAppSlug: string;
  githubDiscoveryToken: string;
  adminToken: string;
  adminGithubLogin: string;
  sessionSecret: string;
  receiptSecret: string;
  heavyConcurrency: number;
  lightConcurrency: number;
  maxAssetBytes: number;
  pollIntervalMs: number;
  workerIntervalMs: number;
  jobMaxAttempts: number;
  jobStaleMs: number;
  scanRateLimit: number;
  scanRateWindowMs: number;
  authRateLimit: number;
  authRateWindowMs: number;
  discoveryRateLimit: number;
  discoveryRateWindowMs: number;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceSoloMonthly: string;
  stripePriceSoloYearly: string;
  stripePriceTeamMonthly: string;
  stripePriceTeamYearly: string;
  resendApiKey: string;
  resendFromEmail: string;
  processRole: ProcessRole;
  uiRoot: string;
  cronSecret: string;
};

export type ProcessRole = "all" | "web" | "worker";

export function parseProcessRole(raw: string): ProcessRole {
  const value = raw.trim().toLowerCase();
  if (value === "web" || value === "worker") return value;
  return "all";
}

export function processRunsHttp(role: ProcessRole): boolean {
  return role === "all" || role === "web";
}

export function processRunsJobs(role: ProcessRole): boolean {
  return role === "all" || role === "worker";
}

export function jobProcessingMode(role: ProcessRole): "background" | "on-request" {
  return processRunsJobs(role) ? "background" : "on-request";
}

function loadDotEnv(): void {
  const file = path.resolve(process.cwd(), ".env");
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export type DatabaseMode = "pglite" | "neon" | "postgres";

export function databaseMode(databaseUrl: string): DatabaseMode {
  const url = databaseUrl.trim();
  if (!url || url.startsWith("pglite:")) return "pglite";
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "neon.tech" || host.endsWith(".neon.tech")) return "neon";
  } catch {
    return "postgres";
  }
  return "postgres";
}

export function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const heavy = Math.min(8, Math.max(2, envInt("HEAVY_CONCURRENCY", 4)));
  const light = Math.min(50, Math.max(1, envInt("LIGHT_CONCURRENCY", 20)));
  const base: AppConfig = {
    port: envInt("PORT", 4347),
    appBaseUrl: env("APP_BASE_URL", "http://127.0.0.1:4347").replace(/\/$/, ""),
    // Vercel Marketplace integrations can be namespaced to avoid overwriting an
    // existing DATABASE_URL. Prefer the scoped Neon pool when it is available;
    // long-lived workers continue to use their explicit DATABASE_URL.
    databaseUrl:
      env("NEON_DATABASE_URL") || env("DATABASE_URL", "pglite://./data/nospoilers"),
    githubAppId: env("GITHUB_APP_ID"),
    githubPrivateKey: normalizePem(env("GITHUB_APP_PRIVATE_KEY")),
    githubWebhookSecret: env("GITHUB_WEBHOOK_SECRET"),
    githubClientId: env("GITHUB_CLIENT_ID"),
    githubClientSecret: env("GITHUB_CLIENT_SECRET"),
    githubAppSlug: env("GITHUB_APP_SLUG", "nospoilers"),
    githubDiscoveryToken: env("GITHUB_DISCOVERY_TOKEN"),
    adminToken: env("ADMIN_TOKEN"),
    adminGithubLogin: env("ADMIN_GITHUB_LOGIN", "EmotiveImpact"),
    sessionSecret: env("SESSION_SECRET") || env("GITHUB_WEBHOOK_SECRET") || "dev-session-not-for-production",
    receiptSecret: env("RECEIPT_SECRET"),
    heavyConcurrency: heavy,
    lightConcurrency: light,
    maxAssetBytes: envInt("MAX_ASSET_BYTES", 80 * 1024 * 1024),
    pollIntervalMs: envInt("POLL_INTERVAL_MS", 60 * 60 * 1000),
    workerIntervalMs: envInt("WORKER_INTERVAL_MS", 15 * 60 * 1000),
    jobMaxAttempts: Math.min(20, Math.max(1, envInt("JOB_MAX_ATTEMPTS", 5))),
    jobStaleMs: Math.max(30_000, envInt("JOB_STALE_MS", 5 * 60 * 1000)),
    scanRateLimit: Math.max(0, envInt("SCAN_RATE_LIMIT", 60)),
    scanRateWindowMs: Math.max(1000, envInt("SCAN_RATE_WINDOW_MS", 60 * 60 * 1000)),
    authRateLimit: Math.max(0, envInt("AUTH_RATE_LIMIT", 30)),
    authRateWindowMs: Math.max(1000, envInt("AUTH_RATE_WINDOW_MS", 60 * 60 * 1000)),
    discoveryRateLimit: Math.max(0, envInt("DISCOVERY_RATE_LIMIT", 20)),
    discoveryRateWindowMs: Math.max(1000, envInt("DISCOVERY_RATE_WINDOW_MS", 60 * 60 * 1000)),
    stripeSecretKey: env("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET"),
    stripePriceSoloMonthly: env("STRIPE_PRICE_SOLO_MONTHLY"),
    stripePriceSoloYearly: env("STRIPE_PRICE_SOLO_YEARLY"),
    stripePriceTeamMonthly: env("STRIPE_PRICE_TEAM_MONTHLY"),
    stripePriceTeamYearly: env("STRIPE_PRICE_TEAM_YEARLY"),
    resendApiKey: env("RESEND_API_KEY"),
    resendFromEmail: env("RESEND_FROM_EMAIL"),
    processRole: parseProcessRole(env("NOSPOILERS_ROLE", "all")),
    uiRoot: env("NOSPOILERS_UI_ROOT", path.resolve("dist")),
    cronSecret: env("CRON_SECRET"),
  };
  const merged = { ...base, ...overrides };
  if (!merged.receiptSecret) merged.receiptSecret = merged.sessionSecret;
  return merged;
}

export function githubAppConfigured(config: AppConfig): boolean {
  return Boolean(
    config.githubAppId &&
      config.githubPrivateKey &&
      config.githubWebhookSecret &&
      config.githubClientId &&
      config.githubClientSecret,
  );
}

export function stripeConfigured(config: AppConfig): boolean {
  return Boolean(
    config.stripeSecretKey &&
      config.stripeWebhookSecret &&
      config.stripePriceSoloMonthly &&
      config.stripePriceSoloYearly &&
      config.stripePriceTeamMonthly &&
      config.stripePriceTeamYearly,
  );
}

export function resendConfigured(config: AppConfig): boolean {
  return Boolean(config.resendApiKey && parseFromEmail(config.resendFromEmail));
}

export function stripePriceMap(config: AppConfig) {
  return {
    soloMonthly: config.stripePriceSoloMonthly,
    soloYearly: config.stripePriceSoloYearly,
    teamMonthly: config.stripePriceTeamMonthly,
    teamYearly: config.stripePriceTeamYearly,
  };
}
