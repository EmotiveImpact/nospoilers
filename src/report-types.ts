export type Severity = "critical" | "warn"

export type Finding = {
  rule: string
  severity: Severity
  path: string
  title: string
  detail: string
}

export type ManifestEntry = {
  path: string
  size: number
  sha256: string
}

export type ScanStatus = "passed" | "failed-policy" | "inconclusive"

export type ScanReport = {
  target: string
  kind: string
  fileCount: number
  findings: Finding[]
  ok: boolean
  status?: ScanStatus
  inconclusiveReason?: string | null
  manifest?: ManifestEntry[]
  engineVersion?: string
  artifactSha256?: string | null
  artifactSha512?: string | null
  artifactBytes?: number | null
  scannedAt: string
}
