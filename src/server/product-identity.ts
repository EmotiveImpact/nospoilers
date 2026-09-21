import type { Store } from "./store.ts";

export const PRODUCT_IDENTITY_ISSUER_GITHUB = "https://github.com";

export const productIdentitySchema = `
  CREATE TABLE IF NOT EXISTS product_auth_identities (
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (issuer, subject)
  );
  CREATE INDEX IF NOT EXISTS product_auth_identities_user_idx
    ON product_auth_identities (user_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS github_connector_accounts (
    github_account_id BIGINT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    login TEXT NOT NULL,
    avatar_url TEXT,
    access_token TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS github_connector_accounts_user_idx
    ON github_connector_accounts (user_id, refreshed_at DESC);
`;

export type TrustedProductIdentity = {
  issuer: string;
  subject: string;
  login: string;
  avatarUrl?: string;
  legacyUserId?: string;
};

export function normalizeProductIdentity(input: TrustedProductIdentity): TrustedProductIdentity {
  const issuer = input.issuer.trim();
  const subject = input.subject.trim();
  const login = input.login.trim();
  if (!issuer || issuer.length > 512) throw new Error("Trusted identity issuer is invalid.");
  if (!subject || subject.length > 512) throw new Error("Trusted identity subject is invalid.");
  if (!login || login.length > 255) throw new Error("Trusted identity display name is invalid.");
  return {
    issuer,
    subject,
    login,
    avatarUrl: input.avatarUrl?.trim() || undefined,
    legacyUserId: input.legacyUserId?.trim() || undefined,
  };
}

/**
 * Resolves only an identity already verified by a trusted server-side provider.
 * Email is deliberately absent: matching email strings must never merge accounts.
 */
export async function resolveTrustedProductIdentity(
  store: Store,
  input: TrustedProductIdentity,
): Promise<{ userId: string; created: boolean }> {
  return await store.resolveProductIdentity(normalizeProductIdentity(input));
}
