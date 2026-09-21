/** Release assurance is a scoped interpretation of evidence, never a security certification. */
export type RecordId = number | string;
export type Decision = 'ready' | 'review' | 'blocked' | 'unknown';
export type CheckState = 'passed' | 'failed' | 'review' | 'unknown' | 'stale' | 'not-configured';
export type Check = {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  phase: 'before-deploy' | 'after-deploy';
};
export type FileEntry = {path: string; size: number; sha256: string};
export type ReceiptEvidence = {
  coordinate: string;
  artifactSha256: string;
  engineVersion: string;
  scannedAt: string;
  status: 'passed' | 'failed-policy' | 'inconclusive';
  ok: boolean;
  inconclusiveReason: string | null;
  policyHash: string | null;
  findingCount: number;
  findingFingerprints: string[];
  findingRuleIds: string[];
  suppressedCount: number;
  suppressedFingerprints: string[];
  manifest: FileEntry[];
  artifactBytes: number | null;
  channel?: string;
};
export type DeliveryEvidence = {
  id: number;
  revisionId: number;
  host: string;
  lastStatus: string | null;
  lastSha256: string | null;
  lastCheckedAt: string | null;
};
export type ReleaseEvidence = {
  id: RecordId;
  receiptId: number | null;
  coordinate: string;
  channel: string;
  artifactSha256: string;
  artifactBytes: number | null;
  mediaType: string | null;
  createdAt: string;
  receiptStatus: string | null;
  mismatch: boolean;
  locations?: DeliveryEvidence[];
  approval?: {decision: string; actorLogin: string; createdAt: string} | null;
  legalHold?: {active: boolean} | null;
  attestations?: {source: string; status: string; createdAt: string}[];
};
export type EvidenceSnapshot = {
  scopeKey: string;
  release: ReleaseEvidence;
  receipt: ReceiptEvidence | null;
  signature: 'verified' | 'unavailable' | 'invalid';
};
export type ReviewOptions = {
  /** A what-if preview only. Never changes stored policy or release evidence. */
  strictReview?: boolean;
  /** These may only be enforced by an explicitly adopted external gate contract. */
  requireApproval?: boolean;
  deliveryFreshnessMs?: number;
};
export type Assessment = {
  version: 1;
  evaluatedAt: string;
  releaseId: RecordId;
  receiptId: number | null;
  beforeDeploy: Decision;
  afterDeploy: CheckState;
  title: string;
  summary: string;
  nextAction: 'inspect-evidence' | 'review-findings' | 'review-exceptions' | 'review-approval' | 'configure-delivery' | 'verify-delivery' | 'keep-watching';
  checks: Check[];
  limitations: string[];
  preview: boolean;
  exceptionCount: number | null;
};
export type Comparison = {
  available: boolean;
  reason: string;
  previousReleaseId: RecordId | null;
  counts: {added: number; removed: number; changed: number; unchanged: number} | null;
  paths: {added: string[]; removed: string[]; changed: string[]};
  truncated: boolean;
  newFindingCount: number | null;
  noLongerObservedCount: number | null;
  newlySuppressedCount: number | null;
  sizeChangeBytes: number | null;
  sizeChangePercent: number | null;
  policyChanged: boolean;
  engineChanged: boolean;
};
export type InvestigationStep = {title: string; detail: string};
export type Investigation = {
  provider: 'deterministic';
  title: string;
  steps: InvestigationStep[];
  ruleIds: string[];
  caveat: string;
  capabilities: {network: false; executeCode: false; merge: false; changePolicy: false; sendDisclosure: false};
};
export type AssuranceView = {
  schema: 'nospoilers.assurance-view/v1';
  assessment: Assessment;
  comparison: Comparison;
  investigation: Investigation;
  passport: Record<string, unknown>;
  strictPreview: Assessment;
  source: 'hosted-release' | 'token-scan' | 'uploaded-scan' | 'website-scan';
};
