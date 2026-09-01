import { buildUnsignedReceipt, signReceipt, type SignedReceipt } from "../receipt.ts";
import {
  diffFingerprints,
  diffManifests,
  mergeReleaseDiff,
  type ReleaseDiff,
} from "../release-diff.ts";
import type { ScanReport } from "../scanner/types.ts";
import {
  appendReleaseRevision,
  inferReleaseChannelFromCoordinate,
  versionFromCoordinate,
  type ReleaseChannel,
} from "./release-ledger.ts";
import type { ReleaseRevisionRow, ScanBaselineRow, ScanReceiptRow, Store } from "./store.ts";

export type ReceiptCompareKind = "baseline" | "previous";

export async function persistHostedReceipt(opts: {
  store: Store;
  secret: string;
  installationId: number;
  packageId?: number | null;
  repoId?: number | null;
  coordinate: string;
  report: ScanReport;
  channel?: ReleaseChannel;
  sourceRevision?: string | null;
  ciRunUrl?: string | null;
}): Promise<{
  row: ScanReceiptRow;
  receipt: SignedReceipt;
  diff: ReleaseDiff | null;
  comparedTo: ReceiptCompareKind | null;
  baseline: ScanBaselineRow | null;
  revision: ReleaseRevisionRow;
}> {
  const channel = opts.channel ?? inferReleaseChannelFromCoordinate(opts.coordinate);
  const sourceRevision =
    opts.sourceRevision ?? versionFromCoordinate(opts.coordinate) ?? null;
  const unsigned = buildUnsignedReceipt(opts.report, opts.coordinate, {
    channel,
    sourceRevision,
    ciRunUrl: opts.ciRunUrl ?? null,
  });
  const receipt = signReceipt(unsigned, opts.secret);
  const baseline =
    opts.packageId != null
      ? await opts.store.getActiveBaseline(opts.installationId, opts.packageId)
      : null;
  const baselineReceipt = baseline ? await opts.store.getScanReceipt(baseline.receipt_id) : null;
  const previous =
    baselineReceipt ??
    (
      await opts.store.latestScanReceipts({
        installationId: opts.installationId,
        packageId: opts.packageId ?? null,
        repoId: opts.packageId ? null : (opts.repoId ?? null),
        coordinate: opts.packageId ? null : opts.coordinate,
        limit: 1,
      })
    )[0] ??
    null;
  const comparedTo: ReceiptCompareKind | null = baselineReceipt
    ? "baseline"
    : previous
      ? "previous"
      : null;
  const row = await opts.store.insertScanReceipt({
    installationId: opts.installationId,
    packageId: opts.packageId ?? null,
    repoId: opts.repoId ?? null,
    receipt,
  });
  const revision = await appendReleaseRevision(opts.store, {
    installationId: opts.installationId,
    packageId: opts.packageId ?? null,
    repoId: opts.repoId ?? null,
    receiptId: row.id,
    channel,
    coordinate: opts.coordinate,
    artifactSha256: receipt.artifactSha256,
    artifactSha512: receipt.artifactSha512,
    sourceRevision: sourceRevision ?? receipt.sourceRevision ?? null,
    ciRunUrl: opts.ciRunUrl ?? receipt.ciRunUrl ?? null,
  });
  const diff = previous
    ? mergeReleaseDiff(
        diffManifests(previous.manifest, receipt.manifest),
        diffFingerprints(previous.finding_fingerprints, receipt.findingFingerprints),
      )
    : null;
  return { row, receipt, diff, comparedTo, baseline, revision };
}

export function summarizeDiff(
  diff: ReleaseDiff | null,
  comparedTo: ReceiptCompareKind | null = "previous",
): string {
  if (!diff) return "";
  const label = comparedTo === "baseline" ? "approved baseline" : "previous";
  const parts = [
    `Diff vs ${label}: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length} (${diff.sizeDelta >= 0 ? "+" : ""}${diff.sizeDelta} bytes).`,
  ];
  if (diff.unexpectedSizeJump) parts.push("Unexpected size jump.");
  if (diff.newFindings.length > 0) {
    parts.push(`${diff.newFindings.length} new finding fingerprint(s).`);
  }
  return parts.join(" ");
}
