export type Severity = "critical" | "warn";

export type Finding = {
  rule: string;
  severity: Severity;
  path: string;
  title: string;
  detail: string;
};

export type ScanTargetKind = "directory" | "tarball" | "zip" | "asar" | "file";

export type ScanReport = {
  target: string;
  kind: ScanTargetKind;
  fileCount: number;
  findings: Finding[];
  ok: boolean;
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
