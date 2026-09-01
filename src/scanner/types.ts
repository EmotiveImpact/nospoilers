export type Severity = "critical" | "warn";

export type Finding = {
  rule: string;
  severity: Severity;
  path: string;
  title: string;
  detail: string;
};

export type ScanTargetKind =
  | "directory"
  | "tarball"
  | "zip"
  | "asar"
  | "file"
  | "vsix"
  | "crx"
  | "xpi"
  | "wheel"
  | "jar"
  | "nupkg"
  | "gem"
  | "docker"
  | "oci"
  | "apk"
  | "aab"
  | "ipa"
  | "serverless";

export type ScanStatus = "passed" | "failed-policy" | "inconclusive";

export type WorkspaceKind = "npm" | "pnpm" | "yarn" | "bun";

export type WorkspaceMember = {
  name: string;
  path: string;
  private: boolean;
};

export type WorkspaceDiscovery = {
  kind: WorkspaceKind;
  root: string;
  configPath: string;
  globs: string[];
  members: WorkspaceMember[];
};

export type ManifestEntry = {
  path: string;
  size: number;
  sha256: string;
};

export type PolicyException = {
  rule: string;
  pathPattern: string | null;
  reason: string;
  expiresAt: string;
  actor: string;
};

export type ScanPolicyShape = {
  version: number;
  strict: boolean;
  exceptions: PolicyException[];
};

export type SuppressedFinding = {
  finding: Finding;
  rule: string;
  pathPattern: string | null;
  reason: string;
  expiresAt: string;
  actor: string;
};

export type ScanReport = {
  target: string;
  kind: ScanTargetKind;
  fileCount: number;
  findings: Finding[];
  ok: boolean;
  status: ScanStatus;
  inconclusiveReason: string | null;
  manifest: ManifestEntry[];
  engineVersion: string;
  artifactSha256: string | null;
  artifactSha512: string | null;
  artifactBytes: number | null;
  scannedAt: string;
  suppressed: SuppressedFinding[];
  policyHash: string | null;
  /** Present on every current scan; omitted on older in-memory helpers. */
  workspaces?: WorkspaceDiscovery[];
  /** Debug IDs found in JS/maps. Identifiers only, never source. */
  debugIds?: string[];
  /** Release/version hints from maps or package.json. Never source. */
  releaseHints?: string[];
};

export type ScanOptions = {
  strict?: boolean;
  policy?: ScanPolicyShape | null;
  maxInputBytes?: number;
  maxUnpackedBytes?: number;
  maxFiles?: number;
  maxFileBytes?: number;
  timeoutMs?: number;
};

export class ScanInconclusiveError extends Error {
  readonly reason: "limit" | "timeout" | "malformed";
  readonly scanKind?: ScanTargetKind;

  constructor(
    reason: "limit" | "timeout" | "malformed",
    message: string,
    scanKind?: ScanTargetKind,
  ) {
    super(message);
    this.name = "ScanInconclusiveError";
    this.reason = reason;
    this.scanKind = scanKind;
  }
}
