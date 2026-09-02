import { parseGithubLogin } from "./routing.ts";

export const MAX_OPERATOR_GRANTS = 8;
export const OPERATOR_GRANT_ERROR =
  "Grant a GitHub login. Type that login to confirm. The owner login is already an operator.";
export const OPERATOR_OWNER_ERROR = "Owner access required.";
export const OPERATOR_EXISTS_ERROR = "That GitHub login already has operator access.";
export const OPERATOR_CAP_ERROR = "Artifact Leads already has 8 operator grants.";
export const OPERATOR_UNKNOWN_ERROR = "Unknown operator grant.";
export const OPERATOR_CONFIRM_ERROR = "Type the GitHub login to confirm.";

export type OperatorGrantRow = {
  id: number;
  github_login: string;
  created_by: string;
  created_at: string;
};

export type PublicOperatorGrant = {
  id: number;
  githubLogin: string;
  createdBy: string;
  createdAt: string;
};

export function parseOperatorGithubLogin(raw: unknown): string {
  if (typeof raw !== "string") {
    throw Object.assign(new Error(OPERATOR_GRANT_ERROR), { status: 400 });
  }
  const login = parseGithubLogin(raw);
  if (!login) {
    throw Object.assign(new Error(OPERATOR_GRANT_ERROR), { status: 400 });
  }
  return login;
}

export function assertOperatorConfirm(login: string, confirm: unknown): void {
  if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== login.toLowerCase()) {
    throw Object.assign(new Error(OPERATOR_CONFIRM_ERROR), { status: 400 });
  }
}

export function isOwnerGithubLogin(login: string, adminGithubLogin: string): boolean {
  return login.trim().toLowerCase() === adminGithubLogin.trim().toLowerCase();
}

export function publicOperatorGrant(row: OperatorGrantRow): PublicOperatorGrant {
  return {
    id: row.id,
    githubLogin: row.github_login,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
