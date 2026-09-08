import {expect, it} from 'vitest';
import {migrate, openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {scan} from '../src/scanner/index.ts';
import {publishWebsiteObservation} from '../src/server/website-publication.ts';
import {createLogNotifier} from '../src/server/notifier.ts';

it('publishes website metadata, private proof and linked alert atomically, then delivers without duplicating the alert', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    const store = createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});
    await store.upsertInstallation({id:771,accountId:771,accountLogin:'owner',accountType:'User'});
    await store.linkUserInstallation(771,'owner');
    const origin = (await store.insertWatchedOrigin(771,'https://example.com/','example.com'))!;
    const report = {...await scan('fixtures/clean.tgz'),artifactSha256:'a'.repeat(64)};
    const input = {store,installationId:771,origin,report,sha256:report.artifactSha256,secret:'test',updateIdentity:true,
      alert: () => ({installationId:771,kind:'web_origin_scan',title:'Observation',body:'Observation saved'})};
    await sql.exec(`CREATE FUNCTION reject_website_alert_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'publication test failure'; END $$;
      CREATE TRIGGER reject_website_alert_test BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION reject_website_alert_test();`);
    await expect(publishWebsiteObservation(input)).rejects.toThrow('publication test failure');
    expect((await store.getWatchedOrigin(origin.id))?.last_scan_status).toBeNull();
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','alerts']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    }
    await sql.exec('DROP TRIGGER reject_website_alert_test ON alerts');
    const published = await publishWebsiteObservation(input);
    expect(published).not.toBeNull();
    expect((await store.getWatchedOrigin(origin.id))?.last_scan_status).toBe(report.status);
    expect(published!.alert.releaseRevisionIds).toHaveLength(1);
    await createLogNotifier(store).send(published!.alert,published!.alertId);
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','alerts']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(1);
    }
    const previous = (await sql.query('SELECT * FROM release_revisions')).rows;
    const incomplete = {...report, ok:false, status:'inconclusive' as const,
      inconclusiveReason:'Asset budget exhausted'};
    const recovery = await publishWebsiteObservation({...input,report:incomplete,sha256:null,updateIdentity:false});
    expect(recovery?.report.status).toBe('inconclusive');
    expect((await store.getWatchedOrigin(origin.id))?.last_scan_status).toBe('inconclusive');
    const revisions = (await sql.query('SELECT * FROM release_revisions ORDER BY id')).rows;
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toEqual(previous[0]);
    expect(recovery?.alert.releaseRevisionIds).not.toEqual(published!.alert.releaseRevisionIds);
    await sql.query('UPDATE watched_origins SET paused_at=now() WHERE id=$1',[origin.id]);
    expect(await publishWebsiteObservation(input)).toBeNull();
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(2);
  } finally { await sql.close(); }
});
