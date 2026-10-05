import { createHash } from "node:crypto";

/**
 * Email/password product sign-in through Neon Managed Better Auth.
 *
 * The NoSpoilers server calls the Better Auth endpoints itself, so the browser
 * never holds a Better Auth session and the returned user is trusted only
 * because this server made the TLS request to the configured Auth origin.
 * Email is never used to find or merge accounts: the stable key is
 * (issuer, Better Auth user ID), resolved through product_auth_identities.
 *
 * Off unless NOSPOILERS_EMAIL_AUTH=neon-better-auth and NEON_AUTH_BASE_URL are set.
 */

export type EmailAuthConfig = { baseUrl: string; issuer: string };

export function emailAuthConfigurationProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const mode = env.NOSPOILERS_EMAIL_AUTH?.trim();
  if (!mode) return [];
  if (mode !== "neon-better-auth") return ["NOSPOILERS_EMAIL_AUTH must be neon-better-auth or unset."];
  const raw = env.NEON_AUTH_BASE_URL?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return ["NEON_AUTH_BASE_URL must be the HTTPS Auth base URL from the Neon console."];
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    return ["NEON_AUTH_BASE_URL must be the HTTPS Auth base URL from the Neon console."];
  return [];
}

export function emailAuthConfig(env: NodeJS.ProcessEnv = process.env): EmailAuthConfig | null {
  if (env.NOSPOILERS_EMAIL_AUTH?.trim() !== "neon-better-auth") return null;
  if (emailAuthConfigurationProblems(env).length) return null;
  const url = new URL(env.NEON_AUTH_BASE_URL!.trim());
  const baseUrl = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  // The issuer namespaces subjects: a different Auth project can never claim an existing user.
  return { baseUrl, issuer: baseUrl };
}

export type EmailAuthUser = { id: string; name: string; emailVerified: boolean };

export type EmailAuthFailure =
  | "invalid_credentials"
  | "email_unverified"
  | "account_exists"
  | "weak_password"
  | "invalid_input"
  | "invalid_token"
  | "unavailable";

export type EmailAuthResult<T> = { ok: true; value: T } | { ok: false; reason: EmailAuthFailure };

export type EmailAuthProvider = {
  signUp(input: { name: string; email: string; password: string; callbackURL: string }): Promise<EmailAuthResult<EmailAuthUser>>;
  signIn(input: { email: string; password: string }): Promise<EmailAuthResult<EmailAuthUser>>;
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<EmailAuthResult<null>>;
  resetPassword(input: { token: string; newPassword: string }): Promise<EmailAuthResult<null>>;
};

const failureByCode: Record<string, EmailAuthFailure> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid_credentials",
  INVALID_PASSWORD: "invalid_credentials",
  INVALID_EMAIL: "invalid_input",
  USER_NOT_FOUND: "invalid_credentials",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "invalid_credentials",
  EMAIL_NOT_VERIFIED: "email_unverified",
  USER_ALREADY_EXISTS: "account_exists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "account_exists",
  PASSWORD_TOO_SHORT: "weak_password",
  PASSWORD_TOO_LONG: "weak_password",
  INVALID_TOKEN: "invalid_token",
};

function parseUser(body: unknown): EmailAuthUser | null {
  const user = (body as { user?: unknown } | null)?.user as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string" || !user.id.trim() || user.id.length > 512) return null;
  return {
    id: user.id,
    name: typeof user.name === "string" ? user.name : "",
    emailVerified: user.emailVerified === true,
  };
}

/** Better Auth's documented email endpoints, called server to server. */
export function createBetterAuthHttpProvider(options: {
  baseUrl: string;
  /** Sent as Origin; must be one of the Auth project's trusted domains. */
  appOrigin: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): EmailAuthProvider {
  const send = options.fetch ?? fetch;
  async function post(path: string, payload: Record<string, unknown>): Promise<{ status: number; body: unknown } | null> {
    try {
      const response = await send(`${options.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", origin: options.appOrigin },
        body: JSON.stringify(payload),
        redirect: "manual",
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
      const text = await response.text();
      if (text.length > 64 * 1024) return { status: response.status, body: null };
      let body: unknown = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      return { status: response.status, body };
    } catch {
      return null;
    }
  }
  function failure(result: { status: number; body: unknown } | null): { ok: false; reason: EmailAuthFailure } {
    if (!result) return { ok: false, reason: "unavailable" };
    const code = (result.body as { code?: unknown } | null)?.code;
    const mapped = typeof code === "string" ? failureByCode[code] : undefined;
    if (mapped) return { ok: false, reason: mapped };
    if (result.status === 401) return { ok: false, reason: "invalid_credentials" };
    if (result.status === 403) return { ok: false, reason: "email_unverified" };
    if (result.status === 400 || result.status === 422) return { ok: false, reason: "invalid_input" };
    return { ok: false, reason: "unavailable" };
  }
  async function userCall(path: string, payload: Record<string, unknown>): Promise<EmailAuthResult<EmailAuthUser>> {
    const result = await post(path, payload);
    if (result?.status !== 200) return failure(result);
    const user = parseUser(result.body);
    return user ? { ok: true, value: user } : { ok: false, reason: "unavailable" };
  }
  async function plainCall(path: string, payload: Record<string, unknown>): Promise<EmailAuthResult<null>> {
    const result = await post(path, payload);
    return result?.status === 200 ? { ok: true, value: null } : failure(result);
  }
  return {
    signUp: input => userCall("/sign-up/email", input),
    signIn: input => userCall("/sign-in/email", { ...input, rememberMe: false }),
    requestPasswordReset: input => plainCall("/request-password-reset", input),
    resetPassword: input => plainCall("/reset-password", input),
  };
}

/**
 * Product account names for email users. `~` cannot appear in a GitHub login, so
 * an email user can never collide with a GitHub-named owner, operator grant or
 * invitation target. The suffix is stable for the identity.
 */
export function emailAccountName(issuer: string, subject: string, name: string): string {
  const slug = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "member";
  const suffix = createHash("sha256").update(`${issuer}\n${subject}`).digest("hex").slice(0, 6);
  return `${slug}~${suffix}`;
}

export const EMAIL_AUTH_LIMITS = { name: 80, email: 254, passwordMin: 8, passwordMax: 128, token: 512 } as const;
