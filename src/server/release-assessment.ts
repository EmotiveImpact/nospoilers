import { assessRelease } from '../assurance/decision.ts';
import { isRecord, readReceipt } from '../assurance/evidence.ts';
import type { EvidenceSnapshot, ReleaseEvidence } from '../assurance/types.ts';
import { verifyReceipt } from '../receipt.ts';

/** Call only after authorising the record. Never trust the stored status as proof. */
export function assessSavedRelease(release: ReleaseEvidence, raw: unknown, secret: string, now = Date.now()) {
  let signature: EvidenceSnapshot['signature'] = 'unavailable';
  let receipt: EvidenceSnapshot['receipt'] = null;
  if (isRecord(raw) && secret.trim()) {
    try {
      const checked = verifyReceipt(JSON.stringify(raw), secret, release.artifactSha256);
      signature = checked.ok ? 'verified' : 'invalid';
      receipt = checked.ok ? readReceipt(checked.receipt ?? raw) : null;
    } catch { signature = 'invalid'; }
  }
  return assessRelease({scopeKey: 'authorised-record', release, receipt, signature}, now);
}

export function assessSavedUpload(upload: {id:string;status:string;artifact_sha256:string;receipt_json:unknown;receipt_id?:number|null;created_at:string|Date}, secret:string, now=Date.now()) {
  // Execution state stays separate. Incomplete or invalid completed records still
  // produce UNKNOWN rather than trusting the unsigned report's green status.
  const receipt = upload.status === 'done' ? readReceipt(upload.receipt_json) : null;
  const release:ReleaseEvidence = {
    id:upload.id, receiptId:upload.receipt_id ?? null,
    coordinate:receipt?.coordinate ?? '', channel:receipt?.channel ?? 'unspecified',
    artifactSha256:upload.artifact_sha256, artifactBytes:receipt?.artifactBytes ?? null,
    mediaType:null, createdAt:receipt?.scannedAt ?? (upload.created_at instanceof Date ? upload.created_at.toISOString() : upload.created_at),
    receiptStatus:receipt?.status ?? null, mismatch:false,
  };
  return assessSavedRelease(release, upload.status === 'done' ? upload.receipt_json : null, secret, now);
}
