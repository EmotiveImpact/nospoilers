import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SCAN_TOKEN_PREFIX = "nsp_";
export const MAX_SCAN_TOKENS = 5;
export const SCAN_TOKEN_NAME_MAX = 64;

export type MintedScanToken = {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
};

export function hashScanToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function mintScanToken(): MintedScanToken {
  const token = `${SCAN_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return {
    token,
    tokenPrefix: token.slice(0, 12),
    tokenHash: hashScanToken(token),
  };
}

export function isScanToken(token: string): boolean {
  return /^nsp_[a-f0-9]{64}$/.test(token);
}

export function parseScanBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.trim().match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1]?.trim() ?? "";
  return isScanToken(token) ? token : null;
}

export function validateScanTokenName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "CI";
  if (name.length > SCAN_TOKEN_NAME_MAX) return null;
  if (/[\r\n\0]/.test(name)) return null;
  return name;
}

export function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
