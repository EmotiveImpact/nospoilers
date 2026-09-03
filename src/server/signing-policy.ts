import { coverageFrom, type Coverage } from "../coverage.ts";
import type { AttestationFacts, AttestationSource } from "./attestations.ts";

export const SIGNING_POLICY_CONFIRM = "signing-policy";
export const SIGNING_POLICY_CLEAR_CONFIRM = "clear-signing-policy";

export const SIGNING_POLICY_UNPAID_ERROR =
  "Coverage ended. Subscribe to Team to set a signing policy.";
export const SIGNING_POLICY_SOLO_ERROR = "Signing policies are on Team.";
export const SIGNING_POLICY_EMPTY_ERROR = "Require GitHub, npm, or a builder prefix.";
export const SIGNING_POLICY_EXPIRES_ERROR = "Expiration must be a future timestamp.";
export const SIGNING_POLICY_PREFIX_ERROR = "Builder prefix is too long or contains a newline.";
export const SIGNING_POLICY_GITHUB_ERROR =
  "This install requires a present GitHub attestation before a revision can ship.";
export const SIGNING_POLICY_NPM_ERROR =
  "This install requires a present npm attestation before a revision can ship.";
export const SIGNING_POLICY_BUILDER_ERROR =
  "This install requires a matching attestation builder before a revision can ship.";

export const MAX_SIGNING_POLICY_PREFIX = 200;

export type SigningPolicyInput = {
  requireGithub: boolean;
  requireNpm: boolean;
  builderPrefix: string | null;
  expiresAt: string | null;
};

export type SigningPolicyRow = SigningPolicyInput & {
  installationId: number;
  updatedByLogin: string;
  updatedAt: string;
};

export function signingPolicyPlanDenied(
  coverage: Coverage,
): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: SIGNING_POLICY_UNPAID_ERROR, status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: SIGNING_POLICY_SOLO_ERROR, status: 403 };
  }
  return null;
}

export function signingPolicyPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return signingPolicyPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function parseBuilderPrefix(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw Object.assign(new Error(SIGNING_POLICY_PREFIX_ERROR), { status: 400 });
  }
  const value = raw.trim();
  if (!value) return null;
  if (value.length > MAX_SIGNING_POLICY_PREFIX || value.includes("\n") || value.includes("\0")) {
    throw Object.assign(new Error(SIGNING_POLICY_PREFIX_ERROR), { status: 400 });
  }
  return value;
}

export function parsePolicyExpiration(raw: unknown, now = Date.now()): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw Object.assign(new Error(SIGNING_POLICY_EXPIRES_ERROR), { status: 400 });
  }
  const value = raw.trim();
  if (!value) return null;
  const at = Date.parse(value);
  if (!Number.isFinite(at) || at <= now) {
    throw Object.assign(new Error(SIGNING_POLICY_EXPIRES_ERROR), { status: 400 });
  }
  return new Date(at).toISOString();
}

export function parseSigningPolicyInput(body: {
  requireGithub?: unknown;
  requireNpm?: unknown;
  builderPrefix?: unknown;
  expiresAt?: unknown;
}): SigningPolicyInput {
  const requireGithub = body.requireGithub === true;
  const requireNpm = body.requireNpm === true;
  const builderPrefix = parseBuilderPrefix(body.builderPrefix);
  const expiresAt = parsePolicyExpiration(body.expiresAt);
  if (!requireGithub && !requireNpm && !builderPrefix) {
    throw Object.assign(new Error(SIGNING_POLICY_EMPTY_ERROR), { status: 400 });
  }
  return { requireGithub, requireNpm, builderPrefix, expiresAt };
}

export function signingPolicyIsActive(
  policy: SigningPolicyInput | null | undefined,
  now = Date.now(),
): boolean {
  if (!policy) return false;
  if (policy.expiresAt) {
    const at = Date.parse(policy.expiresAt);
    if (!Number.isFinite(at) || at <= now) return false;
  }
  return policy.requireGithub || policy.requireNpm || Boolean(policy.builderPrefix);
}

export function publicSigningPolicy(row: SigningPolicyRow) {
  return {
    requireGithub: row.requireGithub,
    requireNpm: row.requireNpm,
    builderPrefix: row.builderPrefix,
    expiresAt: row.expiresAt,
    updatedByLogin: row.updatedByLogin,
    updatedAt: row.updatedAt,
  };
}

export function signingPolicyBlocksApprove(
  policy: SigningPolicyInput | null | undefined,
  latest: Map<AttestationSource, Pick<AttestationFacts, "status" | "builderId">>,
  now = Date.now(),
): string | null {
  if (!signingPolicyIsActive(policy, now) || !policy) return null;
  const github = latest.get("github");
  const npm = latest.get("npm");
  if (policy.requireGithub && github?.status !== "present") {
    return SIGNING_POLICY_GITHUB_ERROR;
  }
  if (policy.requireNpm && npm?.status !== "present") {
    return SIGNING_POLICY_NPM_ERROR;
  }
  if (policy.builderPrefix) {
    const required: Array<Pick<AttestationFacts, "status" | "builderId"> | undefined> = [];
    if (policy.requireGithub) required.push(github);
    if (policy.requireNpm) required.push(npm);
    const present = [...latest.values()].filter((row) => row.status === "present");
    const check = required.length > 0 ? required : present;
    const prefix = policy.builderPrefix;
    if (
      check.length === 0 ||
      check.some((row) => row?.status !== "present" || !(row.builderId ?? "").startsWith(prefix))
    ) {
      return SIGNING_POLICY_BUILDER_ERROR;
    }
  }
  return null;
}
