import { randomBytes } from "node:crypto";
import type { DeliveryLocationRow, ReleaseApprovalRow, ReleaseRevisionRow } from "./store.ts";

export const MAX_PUBLIC_PAGES_PER_INSTALL = 40;
export const PUBLIC_VERIFY_PATH_PREFIX = "/verify/";
export const PUBLIC_PAGE_CAP_ERROR = `At most ${MAX_PUBLIC_PAGES_PER_INSTALL} published verification pages on this install.`;
export const PUBLIC_PAGE_ALREADY_ERROR = "That release already has a published verification page.";
export const PUBLIC_PAGE_MISSING_ERROR = "That release does not have a published verification page.";
export const PUBLIC_PAGE_UNPAID_ERROR = "Coverage ended. Subscribe to publish a verification page.";
export const PUBLIC_PAGE_UNKNOWN_ERROR = "Unknown verification page.";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export type PublicDeliveryMatch = {
  host: string;
  lastStatus: string | null;
  lastCheckedAt: string | null;
  lastSha256: string | null;
};

export type PublicVerificationView = {
  path: string;
  coordinate: string;
  channel: string;
  artifactSha256: string;
  artifactSha512: string | null;
  artifactBytes: number | null;
  mediaType: string | null;
  sourceRevision: string | null;
  receiptStatus: string | null;
  mismatch: boolean;
  passingReceipt: boolean;
  approval: "approved" | "rejected" | null;
  createdAt: string;
  deliveries: PublicDeliveryMatch[];
};

export function mintPublicToken(): string {
  return randomBytes(24).toString("base64url");
}

export function parsePublicToken(raw: string): string | null {
  const token = raw.trim();
  if (!TOKEN_PATTERN.test(token)) return null;
  return token;
}

export function publicVerifyPath(token: string): string {
  return `${PUBLIC_VERIFY_PATH_PREFIX}${token}`;
}

export function publicPageSummary(page: { enabled: boolean; public_token: string } | null): {
  enabled: boolean;
  path: string;
} | null {
  if (!page) return null;
  return { enabled: page.enabled, path: publicVerifyPath(page.public_token) };
}

export function buildPublicVerificationView(input: {
  token: string;
  revision: ReleaseRevisionRow;
  locations: DeliveryLocationRow[];
  approval: ReleaseApprovalRow | null;
}): PublicVerificationView {
  return {
    path: publicVerifyPath(input.token),
    coordinate: input.revision.coordinate,
    channel: input.revision.channel,
    artifactSha256: input.revision.artifact_sha256,
    artifactSha512: input.revision.artifact_sha512,
    artifactBytes: input.revision.artifact_bytes,
    mediaType: input.revision.media_type,
    sourceRevision: input.revision.source_revision,
    receiptStatus: input.revision.receipt_status,
    mismatch: input.revision.mismatch,
    passingReceipt: input.revision.receipt_status === "passed" && !input.revision.mismatch,
    approval:
      input.approval?.decision === "approved" || input.approval?.decision === "rejected"
        ? input.approval.decision
        : null,
    createdAt: input.revision.created_at,
    deliveries: input.locations.map((location) => ({
      host: location.host,
      lastStatus: location.last_status,
      lastCheckedAt: location.last_checked_at,
      lastSha256: location.last_sha256,
    })),
  };
}

export function publicViewLeaksSecrets(view: PublicVerificationView): boolean {
  const blob = JSON.stringify(view);
  return (
    blob.includes("?") ||
    blob.includes("://") ||
    blob.includes("ciRunUrl") ||
    blob.includes("receiptBody") ||
    /postgres(?:ql)?:\/\//i.test(blob)
  );
}
