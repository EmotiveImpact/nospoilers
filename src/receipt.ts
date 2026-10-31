import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signBytes,
  timingSafeEqual,
  verify as verifyBytes,
  type KeyObject,
} from "node:crypto";
import type { Finding, ManifestEntry, ScanReport, ScanStatus, WorkspaceDiscovery } from "./scanner/types.ts";
import type { ReleaseChannel } from "./server/release-ledger.ts";

export const RECEIPT_VERSION = 1;
export const RECEIPT_ALG = "HMAC-SHA256";
export const RECEIPT_DOMAIN = "nospoilers-receipt-v1";
/** Version 2 receipts carry an Ed25519 signature anyone can check against the published key. */
export const RECEIPT_VERSION_ED25519 = 2;
export const RECEIPT_ALG_ED25519 = "Ed25519";
export const RECEIPT_DOMAIN_ED25519 = "nospoilers-receipt-v2";
export const RECEIPT_KEYS_PATH = "/.well-known/nospoilers-receipt-keys.json";

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
  v: typeof RECEIPT_VERSION | typeof RECEIPT_VERSION_ED25519;
  alg: typeof RECEIPT_ALG | typeof RECEIPT_ALG_ED25519;
  /** "dev-hmac" on version 1; "ed25519:<keyId>" on version 2. */
  signer: string;
  /** Version 2 only: short fingerprint of the signing public key. */
  keyId?: string;
  /** Version 2 only: raw Ed25519 public key, base64, so the signature is checkable offline. */
  publicKey?: string;
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
  code?: 'malformed' | 'missing-signature' | 'unsupported-version' | 'unrecognized-signature' | 'inconsistent' | 'artifact-mismatch';
  reason?: string;
  receipt?: SignedReceipt;
  /**
   * "trusted": the key is one this verifier was told to trust (the instance key, a retired
   * instance key, or a pinned public key). "embedded": only the key carried inside the
   * receipt checked out, so the signature is intact but the issuer is not confirmed.
   */
  issuer?: 'trusted' | 'embedded';
  keyId?: string;
};

/**
 * Receipt key material is still passed around as one string so existing call sites keep
 * working. It takes one of these forms:
 *   - a plain HMAC secret (version 1 receipts only);
 *   - an Ed25519 private key in PKCS#8 PEM (version 2 receipts, no HMAC fallback);
 *   - a JSON bundle {"signingKey": PEM, "hmacSecret": string, "retiredPublicKeys": [base64]}
 *     so a migrating instance signs version 2 and still verifies its older version 1 receipts.
 * Use composeReceiptKeyMaterial to build the bundle; never hand-write it.
 */
export type ReceiptKeyMaterial = {
  hmacSecret: string;
  signingKey: KeyObject | null;
  publicKey: KeyObject | null;
  keyId: string | null;
  retiredPublicKeys: Map<string, KeyObject>;
};

export type ReceiptPublicKey = {
  kid: string;
  alg: typeof RECEIPT_ALG_ED25519;
  publicKey: string;
  status: 'active' | 'retired';
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

function ed25519Payload(unsigned: UnsignedReceipt): Buffer {
  return Buffer.from(`${RECEIPT_DOMAIN_ED25519}\n${canonicalJson(unsigned)}`, "utf8");
}

function normalizePemText(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

function rawPublicKeyBytes(key: KeyObject): Buffer {
  // SPKI DER for Ed25519 is a fixed 12-byte prefix followed by the 32-byte key.
  const der = key.export({ type: "spki", format: "der" });
  return Buffer.from(der.subarray(der.length - 32));
}

function publicKeyFromRaw(base64: string): KeyObject | null {
  let raw: Buffer;
  try {
    raw = Buffer.from(base64, "base64");
  } catch {
    return null;
  }
  if (raw.length !== 32) return null;
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  try {
    return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
  } catch {
    return null;
  }
}

export function publicKeyId(key: KeyObject): string {
  return createHash("sha256").update(rawPublicKeyBytes(key)).digest("hex").slice(0, 16);
}

export function publicKeyBase64(key: KeyObject): string {
  return rawPublicKeyBytes(key).toString("base64");
}

function ed25519PrivateKey(pem: string): KeyObject {
  const key = createPrivateKey({ key: normalizePemText(pem), format: "pem" });
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`receipt signing key must be Ed25519, got ${key.asymmetricKeyType ?? "unknown"}`);
  }
  return key;
}

/** Build the single-string key material the config and CLI hand to sign/verify. */
export function composeReceiptKeyMaterial(parts: {
  signingKey?: string;
  hmacSecret?: string;
  retiredPublicKeys?: string[];
}): string {
  const signingKey = parts.signingKey?.trim() ?? "";
  const hmacSecret = parts.hmacSecret?.trim() ?? "";
  const retired = (parts.retiredPublicKeys ?? []).map((k) => k.trim()).filter(Boolean);
  if (!signingKey) return hmacSecret;
  if (!hmacSecret && retired.length === 0) return normalizePemText(signingKey);
  return JSON.stringify({ signingKey: normalizePemText(signingKey), hmacSecret, retiredPublicKeys: retired });
}

export function parseReceiptKeyMaterial(secret: string): ReceiptKeyMaterial {
  const trimmed = (secret ?? "").trim();
  const material: ReceiptKeyMaterial = {
    hmacSecret: "",
    signingKey: null,
    publicKey: null,
    keyId: null,
    retiredPublicKeys: new Map(),
  };
  let signingPem = "";
  let retired: string[] = [];
  if (!trimmed) return material;
  if (trimmed.startsWith("{")) {
    const bundle = JSON.parse(trimmed) as { signingKey?: unknown; hmacSecret?: unknown; retiredPublicKeys?: unknown };
    signingPem = typeof bundle.signingKey === "string" ? bundle.signingKey : "";
    material.hmacSecret = typeof bundle.hmacSecret === "string" ? bundle.hmacSecret.trim() : "";
    retired = Array.isArray(bundle.retiredPublicKeys)
      ? bundle.retiredPublicKeys.filter((k): k is string => typeof k === "string")
      : [];
  } else if (trimmed.startsWith("-----BEGIN")) {
    signingPem = trimmed;
  } else {
    material.hmacSecret = trimmed;
  }
  if (signingPem) {
    material.signingKey = ed25519PrivateKey(signingPem);
    material.publicKey = createPublicKey(material.signingKey);
    material.keyId = publicKeyId(material.publicKey);
  }
  for (const encoded of retired) {
    const key = publicKeyFromRaw(encoded);
    if (!key) throw new Error("retired receipt public key is not a raw base64 Ed25519 key");
    material.retiredPublicKeys.set(publicKeyId(key), key);
  }
  return material;
}

/** The keys an instance publishes at RECEIPT_KEYS_PATH. Empty when the instance signs with HMAC only. */
export function receiptPublicKeys(secret: string): ReceiptPublicKey[] {
  const material = parseReceiptKeyMaterial(secret);
  const keys: ReceiptPublicKey[] = [];
  if (material.publicKey && material.keyId) {
    keys.push({ kid: material.keyId, alg: RECEIPT_ALG_ED25519, publicKey: publicKeyBase64(material.publicKey), status: 'active' });
  }
  for (const [kid, key] of material.retiredPublicKeys) {
    keys.push({ kid, alg: RECEIPT_ALG_ED25519, publicKey: publicKeyBase64(key), status: 'retired' });
  }
  return keys;
}

export function generateReceiptSigningKey(): { privateKeyPem: string; publicKey: string; kid: string } {
  const pair = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: publicKeyBase64(pair.publicKey),
    kid: publicKeyId(pair.publicKey),
  };
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
  const material = parseReceiptKeyMaterial(secret);
  if (material.signingKey && material.publicKey && material.keyId) {
    const { keyId: _k, publicKey: _p, ...rest } = unsigned;
    const upgraded: UnsignedReceipt = {
      ...rest,
      v: RECEIPT_VERSION_ED25519,
      alg: RECEIPT_ALG_ED25519,
      signer: `ed25519:${material.keyId}`,
      keyId: material.keyId,
      publicKey: publicKeyBase64(material.publicKey),
    };
    const signature = signBytes(null, ed25519Payload(upgraded), material.signingKey).toString("hex");
    return { ...upgraded, signature };
  }
  if (!material.hmacSecret) {
    throw new Error("receipt signing secret is missing");
  }
  const signature = createHmac("sha256", material.hmacSecret).update(hmacPayload(unsigned)).digest("hex");
  return { ...unsigned, signature };
}

function verifyHmacSignature(receipt: SignedReceipt, hmacSecret: string): boolean {
  if (!hmacSecret) return false;
  const { signature, ...unsigned } = receipt;
  const expected = createHmac("sha256", hmacSecret).update(hmacPayload(unsigned)).digest("hex");
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Checks the Ed25519 signature against the public key carried in the receipt itself. */
function verifyEmbeddedEd25519(receipt: SignedReceipt): KeyObject | null {
  const { signature, ...unsigned } = receipt;
  if (typeof unsigned.publicKey !== "string" || typeof unsigned.keyId !== "string") return null;
  const key = publicKeyFromRaw(unsigned.publicKey);
  if (!key || publicKeyId(key) !== unsigned.keyId || unsigned.signer !== `ed25519:${unsigned.keyId}`) return null;
  if (!/^[0-9a-f]{128}$/.test(signature)) return null;
  try {
    return verifyBytes(null, ed25519Payload(unsigned), key, Buffer.from(signature, "hex")) ? key : null;
  } catch {
    return null;
  }
}

export function verifyReceiptSignature(receipt: SignedReceipt, secret: string): boolean {
  const material = parseReceiptKeyMaterial(secret);
  if (receipt.v === RECEIPT_VERSION_ED25519) {
    const key = verifyEmbeddedEd25519(receipt);
    if (!key) return false;
    const kid = publicKeyId(key);
    return kid === material.keyId || material.retiredPublicKeys.has(kid);
  }
  return verifyHmacSignature(receipt, material.hmacSecret);
}

function parseSignedReceipt(raw: string): ReceiptVerifyResult & { receipt?: SignedReceipt } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, code: 'malformed', reason: "receipt is not valid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: 'malformed', reason: "receipt must be an object" };
  }
  const receipt = parsed as SignedReceipt;
  if (typeof receipt.signature !== "string" || receipt.signature.length < 32) {
    return { ok: false, code: 'missing-signature', reason: "receipt is missing a signature" };
  }
  if (receipt.v !== RECEIPT_VERSION && receipt.v !== RECEIPT_VERSION_ED25519) {
    return { ok: false, code: 'unsupported-version', reason: "unsupported receipt version" };
  }
  if (receipt.v === RECEIPT_VERSION_ED25519 && receipt.alg !== RECEIPT_ALG_ED25519) {
    return { ok: false, code: 'unsupported-version', reason: "version 2 receipts must be Ed25519" };
  }
  if (receipt.v === RECEIPT_VERSION && receipt.alg !== RECEIPT_ALG) {
    return { ok: false, code: 'unsupported-version', reason: "version 1 receipts must be HMAC-SHA256" };
  }
  return { ok: true, receipt };
}

function checkReceiptBody(receipt: SignedReceipt, expectedSha256?: string): ReceiptVerifyResult | null {
  if (receipt.status === "passed" && receipt.ok !== true) {
    return { ok: false, code: 'inconsistent', reason: "passing receipt is internally inconsistent" };
  }
  if (receipt.status === "inconclusive" && receipt.ok) {
    return { ok: false, code: 'inconsistent', reason: "inconclusive receipt is internally inconsistent" };
  }
  if (expectedSha256) {
    const expected = expectedSha256.toLowerCase();
    if (!receipt.artifactSha256 || receipt.artifactSha256.toLowerCase() !== expected) {
      return { ok: false, code: 'artifact-mismatch', reason: "artifact SHA-256 does not match this receipt" };
    }
  }
  return null;
}

/**
 * Verify a version 2 receipt without any instance secret. The signature is checked against
 * the key inside the receipt; pass trustedPublicKeys (raw base64) to also confirm the issuer.
 * Version 1 receipts cannot be verified this way and return unrecognized-signature.
 */
export function verifyReceiptPublic(
  raw: string,
  options: { expectedSha256?: string; trustedPublicKeys?: string[] } = {},
): ReceiptVerifyResult {
  const parsed = parseSignedReceipt(raw);
  if (!parsed.ok || !parsed.receipt) return parsed;
  const receipt = parsed.receipt;
  if (receipt.v !== RECEIPT_VERSION_ED25519) {
    return { ok: false, code: 'unrecognized-signature', reason: "version 1 receipts need the issuing instance to verify" };
  }
  const key = verifyEmbeddedEd25519(receipt);
  if (!key) {
    return { ok: false, code: 'unrecognized-signature', reason: "signature does not match the receipt" };
  }
  const kid = publicKeyId(key);
  const trusted = new Set<string>();
  for (const encoded of options.trustedPublicKeys ?? []) {
    const pinned = publicKeyFromRaw(encoded);
    if (pinned) trusted.add(publicKeyId(pinned));
  }
  if ((options.trustedPublicKeys?.length ?? 0) > 0 && !trusted.has(kid)) {
    return { ok: false, code: 'unrecognized-signature', reason: `receipt was signed by key ${kid}, not a pinned key`, keyId: kid };
  }
  const problem = checkReceiptBody(receipt, options.expectedSha256);
  if (problem) return { ...problem, keyId: kid };
  return { ok: true, receipt, keyId: kid, issuer: trusted.has(kid) ? 'trusted' : 'embedded' };
}

export function verifyReceipt(
  raw: string,
  secret: string,
  expectedSha256?: string,
): ReceiptVerifyResult {
  const parsed = parseSignedReceipt(raw);
  if (!parsed.ok || !parsed.receipt) return parsed;
  const receipt = parsed.receipt;
  const material = parseReceiptKeyMaterial(secret);
  let keyId: string | undefined;
  if (receipt.v === RECEIPT_VERSION_ED25519) {
    const key = verifyEmbeddedEd25519(receipt);
    if (!key) {
      return { ok: false, code: 'unrecognized-signature', reason: "signature does not match the receipt" };
    }
    keyId = publicKeyId(key);
    if (keyId !== material.keyId && !material.retiredPublicKeys.has(keyId)) {
      return { ok: false, code: 'unrecognized-signature', reason: `signed by key ${keyId}, which this instance does not recognise`, keyId };
    }
  } else if (!verifyHmacSignature(receipt, material.hmacSecret)) {
    return { ok: false, code: 'unrecognized-signature', reason: "signature does not match" };
  }
  const problem = checkReceiptBody(receipt, expectedSha256);
  if (problem) return keyId ? { ...problem, keyId } : problem;
  return keyId ? { ok: true, receipt, keyId, issuer: 'trusted' } : { ok: true, receipt };
}

export function fileSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function receiptSecretFromEnv(): string {
  return composeReceiptKeyMaterial({
    signingKey: process.env.RECEIPT_SIGNING_KEY,
    hmacSecret: process.env.RECEIPT_SECRET || process.env.SESSION_SECRET || "",
    retiredPublicKeys: (process.env.RECEIPT_RETIRED_PUBLIC_KEYS || "").split(",").filter((k) => k.trim()),
  });
}
