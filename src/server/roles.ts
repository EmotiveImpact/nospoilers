import { coverageFrom, type Coverage } from "../coverage.ts";

export type InstallationRole = "admin" | "member";

export type InstallationMember = {
  userId: string;
  login: string;
  avatarUrl: string | null;
  role: InstallationRole;
};

export const ADMIN_REQUIRED_ERROR = "An install admin has to do this.";
export const LAST_ADMIN_ERROR = "This install needs at least one admin.";
export const UNKNOWN_MEMBER_ERROR = "Unknown member.";

export function parseInstallationRole(value: unknown): InstallationRole | null {
  return value === "admin" || value === "member" ? value : null;
}

export function asInstallationRole(value: unknown): InstallationRole {
  return value === "member" ? "member" : "admin";
}

export function rolesPlanDenied(coverage: Coverage): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: "Coverage ended. Subscribe to Team to manage roles.", status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: "Team roles are on trial and Team.", status: 403 };
  }
  return null;
}

export function rolesPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return rolesPlanDenied(coverageFrom(trialEndsAt, plan));
}
