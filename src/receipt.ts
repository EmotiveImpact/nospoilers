import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Finding, ManifestEntry, ScanReport, ScanStatus, WorkspaceDiscovery } from "./scanner/types.ts";
import type { ReleaseChannel } from "./server/release-ledger.ts";

export const RECEIPT_VERSION = 1;
export const RECEIPT_ALG = "HMAC-SHA256";
export const RECEIPT_DOMAIN = "nospoilers-receipt-v1";

export type ReceiptWorkspaceMember = {
  name: string;
  path: string;
  private: boolean;
};

export type ReceiptWorkspace = {
  kind: WorkspaceDiscovery["kind"];
  root: string;
  configPath: string;
  members: ReceiptWorkspaceMember[];
};

export type UnsignedReceipt = {
  v: typeof RECEIPT_VERSION;
  alg: typeof RECEIPT_ALG;
  signer: "dev-hmac";
  engineVersion: string;
  scannedAt: string;
  coordinate: string;
  artifactSha256: string;
  artifactSha512: string | null;
  artifactBytes: number | null;
  status: ScanStatus;
  inconclusiveReason: string | null;
  ok: boolean;
  findingCount: number;
  findingFingerprints: string[];
  findingRuleIds: string[];
  manifest: ManifestEntry[];
  sizeBytes: number;
  maxSeverity: Finding["severity"] | null;
  policyHash: string | null;
  suppressedCount: number;
  suppressedFingerprints: string[];
  /** Present on receipts minted after workspace discovery; omitted on older receipts. */
  workspaces?: ReceiptWorkspace[];
  /** Present on receipts minted with a release channel; omitted on older receipts. */
  channel?: ReleaseChannel;
  /** Git SHA, tag, or package version recorded at scan time. */
  sourceRevision?: string | null;
  /** HTTPS CI run URL stored as metadata; never fetched. */
  ciRunUrl?: string | null;
};

export type SignedReceipt = UnsignedReceipt & {
  signature: string;
};

export type ReceiptVerifyResult = {
  ok: boolean;
  reason?: string;
  receipt?: SignedReceipt;
};

export function findingFingerprint(finding: Finding): string {
  return `${finding.rule}|${finding.severity}|${finding.path}|${finding.title}`;
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const nested = source[key];
      if (nested === undefined) continue;
      out[key] = canonicalize(nested);
    }
    return out;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function manifestHash(manifest: ManifestEntry[]): string {
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export function sizeBytesOf(report: ScanReport): number {
  if (report.artifactBytes != null) return report.artifactBytes;
  return report.manifest.reduce((sum, entry) => sum + entry.size, 0);
}

export function maxSeverityOf(findings: Finding[]): Finding["severity"] | null {
  if (findings.some((finding) => finding.severity === "critical")) return "critical";
  if (findings.some((finding) => finding.severity === "warn")) return "warn";
  return null;
}

function compactWorkspaces(workspaces: WorkspaceDiscovery[] | undefined): ReceiptWorkspace[] {
  return (workspaces ?? []).map((workspace) => ({
    kind: workspace.kind,
    root: workspace.root,
    configPath: workspace.configPath,
    members: workspace.members.map((member) => ({
      name: member.name,
      path: member.path,
      private: member.private,
    })),
  }));
}

function sortedManifest(manifest: ManifestEntry[]): ManifestEntry[] {
  return [...manifest].sort((left, right) => left.path.localeCompare(right.path));
}

function hmacPayload(unsigned: UnsignedReceipt): string {
  return `${RECEIPT_DOMAIN}\n${canonicalJson(unsigned)}`;
}

export function buildUnsignedReceipt(
  report: ScanReport,
  coordinate: string,
  meta?: {
    channel?: ReleaseChannel;
    sourceRevision?: string | null;
    ciRunUrl?: string | null;
  },
): UnsignedReceipt {
  if (report.status === "passed" && !report.ok) {
    throw new Error("cannot mint a passing receipt for a failed scan");
  }
  if (report.status === "inconclusive" && report.ok) {
    throw new Error("inconclusive receipts cannot be marked ok");
  }
  if (report.status === "failed-policy" && report.findings.length === 0) {
    throw new Error("failed scans must include findings or be marked inconclusive");
  }
  const fingerprints = report.findings.map(findingFingerprint).sort();
  const unsigned: UnsignedReceipt = {
    v: RECEIPT_VERSION,
    alg: RECEIPT_ALG,
    signer: "dev-hmac",
    engineVersion: report.engineVersion || "0.1.0",
    scannedAt: report.scannedAt,
    coordinate,
    artifactSha256: (report.artifactSha256 ?? "").toLowerCase(),
    artifactSha512: report.artifactSha512 ? report.artifactSha512.toLowerCase() : null,
    artifactBytes: report.artifactBytes ?? null,
    status: report.status,
    inconclusiveReason: report.inconclusiveReason ?? null,
    ok: report.ok,
    findingCount: report.findings.length,
    findingFingerprints: fingerprints,
    findingRuleIds: [...new Set(report.findings.map((finding) => finding.rule))].sort(),
    manifest: sortedManifest(report.manifest),
    sizeBytes: sizeBytesOf(report),
    maxSeverity: maxSeverityOf(report.findings),
    policyHash: report.policyHash ?? null,
    suppressedCount: report.suppressed?.length ?? 0,
    suppressedFingerprints: (report.suppressed ?? [])
      .map((row) => findingFingerprint(row.finding))
      .sort(),
    workspaces: compactWorkspaces(report.workspaces),
  };
  if (meta?.channel) unsigned.channel = meta.channel;
  if (meta?.sourceRevision) unsigned.sourceRevision = meta.sourceRevision;
  if (meta?.ciRunUrl) unsigned.ciRunUrl = meta.ciRunUrl;
  return unsigned;
}

export function signReceipt(unsigned: UnsignedReceipt, secret: string): SignedReceipt {
  if (!secret.trim()) {
    throw new Error("receipt signing secret is missing");
  }
  if (unsigned.status === "passed" && unsigned.ok !== true) {
    throw new Error("cannot mint a passing receipt unless the scan passed");
  }
  if (unsigned.status === "passed" && unsigned.inconclusiveReason) {
    throw new Error("cannot mint a passing receipt for an inconclusive scan");
  }
  if (unsigned.status === "inconclusive" && unsigned.ok) {
    throw new Error("inconclusive receipts cannot be marked ok");
  }
  const signature = createHmac("sha256", secret).update(hmacPayload(unsigned)).digest("hex");
  return { ...unsigned, signature };
}

export function verifyReceiptSignature(receipt: SignedReceipt, secret: string): boolean {
  const { signature, ...unsigned } = receipt;
  const expected = createHmac("sha256", secret).update(hmacPayload(unsigned)).digest("hex");
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyReceipt(
  raw: string,
  secret: string,
  expectedSha256?: string,
): ReceiptVerifyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "receipt is not valid JSON" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, reason: "receipt must be an object" };
  }
  const receipt = parsed as SignedReceipt;
  if (typeof receipt.signature !== "string" || receipt.signature.length < 32) {
    return { ok: false, reason: "receipt is missing a signature" };
  }
  if (receipt.v !== RECEIPT_VERSION) {
    return { ok: false, reason: "unsupported receipt version" };
  }
  if (!verifyReceiptSignature(receipt, secret)) {
    return { ok: false, reason: "signature does not match" };
  }
  if (receipt.status === "passed" && receipt.ok !== true) {
    return { ok: false, reason: "passing receipt is internally inconsistent" };
  }
  if (receipt.status === "inconclusive" && receipt.ok) {
    return { ok: false, reason: "inconclusive receipt is internally inconsistent" };
  }
  if (expectedSha256) {
    const expected = expectedSha256.toLowerCase();
    if (!receipt.artifactSha256 || receipt.artifactSha256.toLowerCase() !== expected) {
      return { ok: false, reason: "artifact SHA-256 does not match this receipt" };
    }
  }
  return { ok: true, receipt };
}

export function fileSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function receiptSecretFromEnv(): string {
  return (process.env.RECEIPT_SECRET || process.env.SESSION_SECRET || "").trim();
}
