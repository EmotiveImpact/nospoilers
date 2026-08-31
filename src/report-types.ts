export type Severity = "critical" | "warn";

export type Finding = {
  rule: string;
  severity: Severity;
  path: string;
  title: string;
  detail: string;
};

export type ScanReport = {
  target: string;
  kind: string;
  fileCount: number;
  findings: Finding[];
  ok: boolean;
  scannedAt: string;
};
