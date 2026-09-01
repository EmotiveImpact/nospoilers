import {
  databaseMode,
  githubAppConfigured,
  type AppConfig,
} from "./config.ts";

export const MIN_SECRET_LENGTH = 32;

const WEAK_SECRETS = new Set([
  "dev-session-not-for-production",
  "changeme",
  "secret",
  "password",
  "test-webhook-secret",
]);

export function secretIsStrong(value: string, minLength = MIN_SECRET_LENGTH): boolean {
  const secret = value.trim();
  if (secret.length < minLength) return false;
  if (WEAK_SECRETS.has(secret.toLowerCase())) return false;
  if (/^(.)\1+$/.test(secret)) return false;
  return true;
}

export function productionSecretsRequired(config: AppConfig): boolean {
  const mode = databaseMode(config.databaseUrl);
  if (mode === "neon" || mode === "postgres") return true;
  if (config.appBaseUrl.startsWith("https://")) return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

export function assertProductionSecrets(config: AppConfig): void {
  if (!productionSecretsRequired(config)) return;

  const problems: string[] = [];
  if (!secretIsStrong(config.sessionSecret)) {
    problems.push(
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters and not a known default.`,
    );
  }
  if (githubAppConfigured(config)) {
    if (!secretIsStrong(config.githubWebhookSecret)) {
      problems.push(
        `GITHUB_WEBHOOK_SECRET must be at least ${MIN_SECRET_LENGTH} characters and not a known default.`,
      );
    }
    if (!secretIsStrong(config.githubClientSecret)) {
      problems.push(
        `GITHUB_CLIENT_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
      );
    }
    if (
      config.sessionSecret &&
      config.githubWebhookSecret &&
      config.sessionSecret === config.githubWebhookSecret
    ) {
      problems.push("SESSION_SECRET must be distinct from GITHUB_WEBHOOK_SECRET.");
    }
  }
  if (config.adminToken && !secretIsStrong(config.adminToken)) {
    problems.push(
      `ADMIN_TOKEN must be at least ${MIN_SECRET_LENGTH} characters when set.`,
    );
  }
  if (problems.length === 0) return;
  throw new Error(`Refusing to start with weak secrets:\n- ${problems.join("\n- ")}`);
}
