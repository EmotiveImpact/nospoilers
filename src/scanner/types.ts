export type Severity = "critical" | "warn";

export type Finding = {
  rule: string;
  severity: Severity;
  path: string;
  title: string;
  detail: string;
};

export type ScanTargetKind = "directory" | "tarball" | "zip" | "asar" | "file";

export type ScanStatus = "passed" | "failed-policy" | "inconclusive";

export type ManifestEntry = {
  path: string;
  size: number;
  sha256: string;
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
};

export type ScanOptions = {
  strict?: boolean;
  maxInputBytes?: number;
  maxUnpackedBytes?: number;
  maxFiles?: number;
  maxFileBytes?: number;
  timeoutMs?: number;
};

export class ScanInconclusiveError extends Error {
  readonly reason: "limit" | "timeout" | "malformed";

  constructor(reason: "limit" | "timeout" | "malformed", message: string) {
    super(message);
    this.name = "ScanInconclusiveError";
    this.reason = reason;
  }
}
