import type { ScanReport } from '../scanner/index.ts';
import type { AlertInput } from './notifier.ts';
import { persistHostedReceipt, summarizeDiff } from './receipts.ts';
import { createStore, type Store } from './store.ts';
import { attachCanonicalDeliveryUrl, isSealedArtifactDigest } from './delivery-verify.ts';
import { inferReleaseChannel } from './release-ledger.ts';

export async function publishReleaseObservation(input: {
  store: Store; installationId: number; repoId: number; secret?: string; tag: string; generation?: string;
  assets: {name: string; coordinate: string; report: ScanReport; publicUrl?: string | null}[];
  alert: (assets: {name: string; report: ScanReport; diffNote: string}[]) => AlertInput;
}) {
  return input.store.sql.transaction(async tx => {
    const source = await tx.query(`SELECT id FROM repos WHERE id=$1 AND installation_id=$2
      AND disconnected_at IS NULL AND connection_generation=$3 FOR UPDATE`, [input.repoId, input.installationId, input.generation ?? '0']);
    if (!source.rows.length) return null;
    const store = createStore(tx);
    const assets: {name: string; report: ScanReport; diffNote: string}[] = [];
    const releaseRevisionIds: number[] = [];
    for (const asset of input.assets) {
      let report = asset.report;
      let diffNote = '';
      if (input.secret) {
        const saved = await persistHostedReceipt({store, secret: input.secret,
          installationId: input.installationId, repoId: input.repoId, coordinate: asset.coordinate,
          report, channel: inferReleaseChannel(input.tag), sourceRevision: input.tag});
        report = saved.report;
        diffNote = summarizeDiff(saved.diff, saved.comparedTo);
        releaseRevisionIds.push(saved.revision.id);
        if (asset.publicUrl && isSealedArtifactDigest(saved.revision.artifact_sha256)) {
          await attachCanonicalDeliveryUrl(store, {installationId: input.installationId,
            revisionId: saved.revision.id, url: asset.publicUrl});
        }
      }
      assets.push({name: asset.name, report, diffNote});
    }
    const alert: AlertInput = {...input.alert(assets), installationId: input.installationId,
      repoId: input.repoId, releaseRevisionIds};
    const alertId = await store.insertAlert(alert);
    return {assets, alert, alertId};
  });
}
