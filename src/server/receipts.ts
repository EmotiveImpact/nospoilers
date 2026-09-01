import { buildUnsignedReceipt, signReceipt, type SignedReceipt } from "../receipt.ts";
import {
  diffFingerprints,
  diffManifests,
  mergeReleaseDiff,
  type ReleaseDiff,
} from "../release-diff.ts";
import type { ScanReport } from "../scanner/types.ts";
import type { ScanReceiptRow, Store } from "./store.ts";

export async function persistHostedReceipt(opts: {
  store: Store;
  secret: string;
  installationId: number;
  packageId?: number | null;
  repoId?: number | null;
  coordinate: string;
  report: ScanReport;
}): Promise<{ row: ScanReceiptRow; receipt: SignedReceipt; diff: ReleaseDiff | null }> {
  const unsigned = buildUnsignedReceipt(opts.report, opts.coordinate);
  const receipt = signReceipt(unsigned, opts.secret);
  const previous = (
    await opts.store.latestScanReceipts({
      installationId: opts.installationId,
      packageId: opts.packageId ?? null,
      repoId: opts.packageId ? null : (opts.repoId ?? null),
      coordinate: opts.packageId ? null : opts.coordinate,
      limit: 1,
    })
  )[0];
  const row = await opts.store.insertScanReceipt({
    installationId: opts.installationId,
    packageId: opts.packageId ?? null,
    repoId: opts.repoId ?? null,
    receipt,
  });
  const diff = previous
    ? mergeReleaseDiff(
        diffManifests(previous.manifest, receipt.manifest),
        diffFingerprints(previous.finding_fingerprints, receipt.findingFingerprints),
      )
    : null;
  return { row, receipt, diff };
}

export function summarizeDiff(diff: ReleaseDiff | null): string {
  if (!diff) return "";
  const parts = [
    `Diff vs previous: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length} (${diff.sizeDelta >= 0 ? "+" : ""}${diff.sizeDelta} bytes).`,
  ];
  if (diff.unexpectedSizeJump) parts.push("Unexpected size jump.");
  if (diff.newFindings.length > 0) {
    parts.push(`${diff.newFindings.length} new finding fingerprint(s).`);
  }
  return parts.join(" ");
}
