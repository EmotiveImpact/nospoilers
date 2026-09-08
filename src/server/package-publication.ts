import type { ScanReport } from '../scanner/index.ts';
import { publicMapFromFindings } from '../scanner/debug-id.ts';
import type { AlertInput } from './notifier.ts';
import { persistHostedReceipt, summarizeDiff } from './receipts.ts';
import { createStore, type Store } from './store.ts';
import { enqueueMapCustodyChecks } from './map-watch.ts';
import { attachCanonicalDeliveryUrl, isSealedArtifactDigest } from './delivery-verify.ts';
import type { ReleaseChannel } from './release-ledger.ts';

/** A package observation and all its customer-facing evidence commit together. */
export async function publishPackageObservation(input: {
  store: Store; installationId: number; packageId: number | null;
  generation: string | null; packageName: string; version: string;
  report: ScanReport; sha256: string | null; secret?: string;
  channel: ReleaseChannel; publicTarballUrl?: string; updateIdentity: boolean;
  alert: (report: ScanReport, diffNote: string) => AlertInput;
}) {
  return input.store.sql.transaction(async tx => {
    if (input.packageId !== null) {
      const source = await tx.query(`SELECT id FROM watched_packages WHERE id=$1 AND installation_id=$2
        AND connection_generation=$3 AND disconnected_at IS NULL AND paused_at IS NULL FOR UPDATE`,
      [input.packageId, input.installationId, input.generation]);
      if (!source.rows.length) return null;
    }
    const store = createStore(tx);
    let report = input.report;
    let diffNote = '';
    const releaseRevisionIds: number[] = [];
    if (input.secret) {
      const receipt = await persistHostedReceipt({store, secret: input.secret,
        installationId: input.installationId, packageId: input.packageId,
        coordinate: `npm:${input.packageName}@${input.version}`,
        packageConnectionGeneration: input.generation ?? undefined, report,
        channel: input.channel, sourceRevision: input.version});
      report = receipt.report;
      diffNote = summarizeDiff(receipt.diff, receipt.comparedTo);
      releaseRevisionIds.push(receipt.revision.id);
      if (input.publicTarballUrl && isSealedArtifactDigest(receipt.revision.artifact_sha256)) {
        await attachCanonicalDeliveryUrl(store, {installationId: input.installationId,
          revisionId: receipt.revision.id, url: input.publicTarballUrl});
      }
    }
    if (input.packageId !== null) {
      await store.recordWatchedPackageScan(input.packageId, {
        sha256: input.sha256, status: report.status, connectionGeneration: input.generation ?? undefined,
      });
      if (input.updateIdentity) await store.recordPackageMapIdentity(input.packageId, {
        debugIds: report.debugIds ?? [], release: input.version || report.releaseHints?.[0] || null,
        publicMap: publicMapFromFindings(report.findings), connectionGeneration: input.generation ?? undefined,
      });
    }
    const alert: AlertInput = {...input.alert(report, diffNote), installationId: input.installationId,
      packageConnection: input.packageId !== null && input.generation !== null
        ? {id: input.packageId, generation: input.generation} : undefined, releaseRevisionIds};
    const alertId = await store.insertAlert(alert);
    if (input.updateIdentity && input.packageId !== null) {
      await enqueueMapCustodyChecks(store, input.installationId, `pkg:${input.packageId}:${input.version || 'latest'}`);
    }
    return {report, alert, alertId};
  });
}
