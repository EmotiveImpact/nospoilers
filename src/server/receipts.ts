import path from "node:path";
import { buildUnsignedReceipt, signReceipt, type SignedReceipt } from "../receipt.ts";
import { exceptionCovers } from "../policy.ts";
import {
  diffFingerprints,
  diffManifests,
  mergeReleaseDiff,
  SIZE_JUMP_RULE,
  sizeJumpFinding,
  type ReleaseDiff,
} from "../release-diff.ts";
import type { Finding, PolicyException, ScanReport, SuppressedFinding } from "../scanner/types.ts";
import {
  appendReleaseRevision,
  inferReleaseChannelFromCoordinate,
  versionFromCoordinate,
  type ReleaseChannel,
} from "./release-ledger.ts";
import { policyFromExceptionRows } from "./hosted-policy.ts";
import type { ReleaseRevisionRow, ScanBaselineRow, ScanReceiptRow, Store } from "./store.ts";
import {createStore} from './store.ts';

export type ReceiptCompareKind = "baseline" | "previous";

function assetSuffix(coordinate: string): string | null {
  const hash = coordinate.lastIndexOf("#");
  return hash >= 0 ? coordinate.slice(hash + 1) : null;
}

async function previousReceiptFor(
  store: Store,
  opts: {
    installationId: number;
    packageId?: number | null;
    repoId?: number | null;
    coordinate: string;
  },
): Promise<ScanReceiptRow | null> {
  if (opts.packageId) {
    return (
      (
        await store.latestScanReceipts({
          installationId: opts.installationId,
          packageId: opts.packageId,
          limit: 1,
        })
      )[0] ?? null
    );
  }
  if (opts.repoId) {
    const key = assetSuffix(opts.coordinate);
    const rows = await store.latestScanReceipts({
      installationId: opts.installationId,
      repoId: opts.repoId,
      limit: 50,
    });
    return rows.find((row) => (key ? assetSuffix(row.coordinate) === key : row.coordinate === opts.coordinate)) ?? null;
  }
  return (
    (
      await store.latestScanReceipts({
        installationId: opts.installationId,
        coordinate: opts.coordinate,
        limit: 1,
      })
    )[0] ?? null
  );
}

function sizeJumpPath(report: ScanReport): string {
  const base = path.basename(report.target || "").replace(/[^\w.-]+/g, "_");
  return base || "artifact";
}

function applySizeJumpFinding(
  report: ScanReport,
  diff: ReleaseDiff,
  comparedTo: ReceiptCompareKind,
  exceptions: PolicyException[],
): ScanReport {
  if (report.status === "inconclusive") return report;
  if (!diff.unexpectedSizeJump) return report;
  if (report.findings.some((finding) => finding.rule === SIZE_JUMP_RULE)) return report;
  if ((report.suppressed ?? []).some((row) => row.finding.rule === SIZE_JUMP_RULE)) return report;

  const finding = sizeJumpFinding({
    previousBytes: diff.previousBytes,
    nextBytes: diff.nextBytes,
    sizeDelta: diff.sizeDelta,
    comparedTo,
    path: sizeJumpPath(report),
  });
  const match = exceptions.find((exception) => exceptionCovers(exception, finding));
  if (match) {
    const suppressed: SuppressedFinding = {
      finding,
      rule: match.rule,
      pathPattern: match.pathPattern,
      reason: match.reason,
      expiresAt: match.expiresAt,
      actor: match.actor,
    };
    return {
      ...report,
      suppressed: [...(report.suppressed ?? []), suppressed],
    };
  }
  const findings: Finding[] = [...report.findings, finding];
  return { ...report, findings };
}

export async function persistHostedReceipt(opts: Parameters<typeof persistHostedReceiptTransaction>[0]) {
  return opts.store.sql.transaction(tx=>persistHostedReceiptTransaction({...opts,store:createStore(tx)}));
}

async function persistHostedReceiptTransaction(opts: {
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
  report: ScanReport;
  diff: ReleaseDiff | null;
  comparedTo: ReceiptCompareKind | null;
  baseline: ScanBaselineRow | null;
  revision: ReleaseRevisionRow;
}> {
  const channel = opts.channel ?? inferReleaseChannelFromCoordinate(opts.coordinate);
  const sourceRevision =
    opts.sourceRevision ?? versionFromCoordinate(opts.coordinate) ?? null;
  const baseline =
    opts.packageId != null
      ? await opts.store.getActiveBaseline(opts.installationId, opts.packageId)
      : null;
  const baselineReceipt = baseline ? await opts.store.getScanReceipt(baseline.receipt_id) : null;
  const previous = baselineReceipt ?? (await previousReceiptFor(opts.store, opts)) ?? null;
  const comparedTo: ReceiptCompareKind | null = baselineReceipt
    ? "baseline"
    : previous
      ? "previous"
      : null;
  const manifestDiff = previous ? diffManifests(previous.manifest, opts.report.manifest) : null;
  let report = opts.report;
  if (manifestDiff && comparedTo) {
    const policy = policyFromExceptionRows(
      await opts.store.listActiveExceptions(opts.installationId, opts.packageId ?? null),
    );
    report = applySizeJumpFinding(report, manifestDiff, comparedTo, policy?.exceptions ?? []);
  }
  const unsigned = buildUnsignedReceipt(report, opts.coordinate, {
    channel,
    sourceRevision,
    ciRunUrl: opts.ciRunUrl ?? null,
  });
  const receipt = signReceipt(unsigned, opts.secret);
  const row = await opts.store.insertScanReceipt({
    installationId: opts.installationId,
    packageId: opts.packageId ?? null,
    repoId: opts.repoId ?? null,
    receipt,
  });
  await opts.store.sql.query(`INSERT INTO hosted_scan_evidence(receipt_id,installation_id,report) VALUES($1,$2,$3::jsonb) ON CONFLICT(receipt_id) DO NOTHING`,[row.id,opts.installationId,JSON.stringify(report)]);
  const revision = await appendReleaseRevision(opts.store, {
    installationId: opts.installationId,
    packageId: opts.packageId ?? null,
    repoId: opts.repoId ?? null,
    receiptId: row.id,
    channel,
    coordinate: opts.coordinate,
    artifactSha256: receipt.artifactSha256,
    artifactSha512: receipt.artifactSha512,
    artifactBytes: receipt.artifactBytes,
    filename: opts.report.target,
    sourceRevision: sourceRevision ?? receipt.sourceRevision ?? null,
    ciRunUrl: opts.ciRunUrl ?? receipt.ciRunUrl ?? null,
  });
  const diff = previous
    ? mergeReleaseDiff(
        manifestDiff ?? diffManifests(previous.manifest, receipt.manifest),
        diffFingerprints(previous.finding_fingerprints, receipt.findingFingerprints),
      )
    : null;
  return { row, receipt, report, diff, comparedTo, baseline, revision };
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
  if (diff.unexpectedSizeJump) {
    parts.push(
      `SIZE-003 unpacked ${diff.nextBytes} bytes versus ${diff.previousBytes} (${diff.sizeDelta >= 0 ? "+" : ""}${diff.sizeDelta} bytes).`,
    );
  }
  if (diff.newFindings.length > 0) {
    parts.push(`${diff.newFindings.length} new finding fingerprint(s).`);
  }
  return parts.join(" ");
}
