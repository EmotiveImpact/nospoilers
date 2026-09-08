import type { ScanReport } from '../scanner/index.ts';
import { publicMapFromFindings } from '../scanner/debug-id.ts';
import type { AlertInput } from './notifier.ts';
import { persistHostedReceipt, summarizeDiff } from './receipts.ts';
import { createStore, type Store } from './store.ts';
import { enqueueMapCustodyChecks } from './map-watch.ts';

/** Publish one website observation completely, or leave its previous evidence intact. */
export async function publishWebsiteObservation(input: {
  store: Store;
  installationId: number;
  origin: { id: number; origin_url: string; connection_generation?: string };
  report: ScanReport;
  sha256: string | null;
  secret?: string;
  updateIdentity: boolean;
  alert: (report: ScanReport, diffNote: string) => AlertInput;
}) {
  return input.store.sql.transaction(async tx => {
    const generation = input.origin.connection_generation ?? '0';
    const source = await tx.query(`SELECT id FROM watched_origins WHERE id=$1 AND installation_id=$2
      AND connection_generation=$3 AND disconnected_at IS NULL AND paused_at IS NULL
      AND (verification_token IS NULL OR verified_at IS NOT NULL) FOR UPDATE`,
    [input.origin.id, input.installationId, generation]);
    if (!source.rows.length) return null;
    const store = createStore(tx);
    let report = input.report;
    let diffNote = '';
    const releaseRevisionIds: number[] = [];
    if (input.secret) {
      const receipt = await persistHostedReceipt({store, secret: input.secret,
        installationId: input.installationId, coordinate: `web:${input.origin.origin_url}`,
        originConnection: {id: input.origin.id, generation}, report, channel: 'stable',
        sourceRevision: input.sha256?.slice(0, 12) ?? null});
      report = receipt.report;
      diffNote = summarizeDiff(receipt.diff, receipt.comparedTo);
      releaseRevisionIds.push(receipt.revision.id);
    }
    await store.recordWatchedOriginScan(input.origin.id, {
      sha256: input.sha256, status: report.status, connectionGeneration: generation,
    });
    if (input.updateIdentity) await store.recordOriginMapIdentity(input.origin.id, {
      debugIds: report.debugIds ?? [], release: report.releaseHints?.[0] ?? null,
      publicMap: publicMapFromFindings(report.findings), connectionGeneration: generation,
    });
    const alert: AlertInput = {...input.alert(report, diffNote), installationId: input.installationId,
      originConnection: {id: input.origin.id, generation}, releaseRevisionIds};
    const alertId = await store.insertAlert(alert);
    if (input.updateIdentity && input.sha256) {
      await enqueueMapCustodyChecks(store, input.installationId,
        `origin:${input.origin.id}:${input.sha256.slice(0, 12)}`);
    }
    return {report, alert, alertId};
  });
}
