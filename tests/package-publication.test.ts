import {expect, it} from 'vitest';
import {migrate, openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {scan} from '../src/scanner/index.ts';
import {publishPackageObservation} from '../src/server/package-publication.ts';
import {createLogNotifier} from '../src/server/notifier.ts';

it('commits package observation and evidence together, rolling everything back on alert failure', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    const store = createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});
    await store.upsertInstallation({id:772,accountId:772,accountLogin:'owner',accountType:'User'});
    await store.linkUserInstallation(772,'owner');
    const pkg = (await store.insertWatchedPackage(772,'example'))!;
    const generation = await store.packageConnectionGeneration(pkg.id,772);
    const report = {...await scan('fixtures/clean.tgz'),artifactSha256:'a'.repeat(64)};
    const input = {store,installationId:772,packageId:pkg.id,generation,packageName:'example',version:'1.0.0',
      report,sha256:report.artifactSha256,secret:'test',updateIdentity:true,channel:'stable' as const,
      publicTarballUrl:'https://registry.npmjs.org/example/-/example-1.0.0.tgz',
      alert: () => ({installationId:772,kind:'npm_scan',title:'Observation',body:'Observation saved'})};
    await sql.exec(`CREATE FUNCTION reject_package_alert_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'publication test failure'; END $$;
      CREATE TRIGGER reject_package_alert_test BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION reject_package_alert_test();`);
    await expect(publishPackageObservation(input)).rejects.toThrow('publication test failure');
    expect((await store.getWatchedPackage(pkg.id))?.last_scan_status).toBeNull();
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','alerts','release_delivery_locations']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    }
    await sql.exec('DROP TRIGGER reject_package_alert_test ON alerts');
    const published = await publishPackageObservation(input);
    expect(published).not.toBeNull();
    expect((await store.getWatchedPackage(pkg.id))?.last_scan_status).toBe(report.status);
    expect(published!.alert.releaseRevisionIds).toHaveLength(1);
    await createLogNotifier(store).send(published!.alert,published!.alertId);
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','alerts','release_delivery_locations']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);
    }
    await store.setSourcePausedForUser('npm',pkg.id,'owner',true);
    expect(await publishPackageObservation(input)).toBeNull();
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(1);
  } finally { await sql.close(); }
});
