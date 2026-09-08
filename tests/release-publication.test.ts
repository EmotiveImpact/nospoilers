import {expect, it} from 'vitest';
import {migrate, openSql} from '../src/server/sql.ts';
import {createStore, type JobRow} from '../src/server/store.ts';
import {scan} from '../src/scanner/index.ts';
import {publishReleaseObservation} from '../src/server/release-publication.ts';
import {handleJob} from '../src/server/worker.ts';
import {stubGithub} from '../src/server/stub-github.ts';

it('saves every asset and the linked release alert together or rolls the entire release back', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    const store = createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});
    await store.upsertInstallation({id:773,accountId:773,accountLogin:'owner',accountType:'User'});
    await store.linkUserInstallation(773,'owner');
    await store.upsertRepo({id:7730,installationId:773,owner:'owner',name:'app',fullName:'owner/app',private:false,htmlUrl:'https://github.com/owner/app'});
    const report = {...await scan('fixtures/clean.tgz'),artifactSha256:'b'.repeat(64)};
    const input = {store,installationId:773,repoId:7730,secret:'test',tag:'v1',
      assets: ['one.tgz','two.tgz'].map(name => ({name,coordinate:`github:owner/app@v1#${name}`,report,
        publicUrl:`https://github.com/owner/app/releases/download/v1/${name}`})),
      alert: () => ({installationId:773,kind:'release_scan',title:'Release observed',body:'Two assets'})};
    await sql.exec(`CREATE FUNCTION reject_release_alert_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'release publication test failure'; END $$;
      CREATE TRIGGER reject_release_alert_test BEFORE INSERT ON alerts FOR EACH ROW EXECUTE FUNCTION reject_release_alert_test();`);
    await expect(publishReleaseObservation(input)).rejects.toThrow('release publication test failure');
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','alerts','release_delivery_locations']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    }
    await sql.exec('DROP TRIGGER reject_release_alert_test ON alerts');
    const published = await publishReleaseObservation(input);
    expect(published?.alert.releaseRevisionIds).toHaveLength(2);
    for (const table of ['scan_receipts','hosted_scan_evidence','release_revisions','release_delivery_locations']) {
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toHaveLength(2);
    }
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(1);
    await store.removeRepo(7730,773);
    expect(await publishReleaseObservation(input)).toBeNull();
    await store.upsertRepo({id:7730,installationId:773,owner:'owner',name:'app',fullName:'owner/app',private:false,htmlUrl:'https://github.com/owner/app',reconnect:true});
    expect(await publishReleaseObservation(input)).toBeNull();
    const generation = String((await store.getRepo(7730))?.connection_generation);
    expect(generation).toBe('2');
    await store.upsertRepo({id:7730,installationId:773,owner:'owner',name:'app',fullName:'owner/app',private:false,htmlUrl:'https://github.com/owner/app'});
    expect(String((await store.getRepo(7730))?.connection_generation)).toBe(generation);
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(1);
    const job = await store.enqueueJob({priority:'light',kind:'release_scan',payload:{installationId:773,
      repo:{id:7730,owner:'owner',name:'app',fullName:'owner/app',private:false,htmlUrl:'https://github.com/owner/app'},connectionGeneration:'0'}});
    const queued = (await sql.query<JobRow>('SELECT * FROM jobs WHERE id=$1',[job.id])).rows[0];
    await expect(handleJob(queued,{store,github:stubGithub(),scan,notifier:{send:async()=>{throw new Error('Obsolete job published');}},maxAssetBytes:100000})).resolves.toBeUndefined();
    expect(await publishReleaseObservation({...input,generation})).not.toBeNull();
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(2);
    const activeJob = {...queued,payload:{...queued.payload as Record<string,unknown>,connectionGeneration:generation,releaseId:1,tag:'v2'}};
    await handleJob(activeJob,{store,maxAssetBytes:100000,receiptSecret:'test',
      github:{...stubGithub(),listReleaseAssets:async()=>[{id:1,name:'one.tgz',size:7,url:'https://api.github.com/asset/1'}],downloadAsset:async()=>Buffer.from('fixture')},
      scan:async()=>{
        await store.removeRepo(7730,773);
        await store.upsertRepo({id:7730,installationId:773,owner:'owner',name:'app',fullName:'owner/app',private:false,htmlUrl:'https://github.com/owner/app',reconnect:true});
        return report;
      },notifier:{send:async()=>{throw new Error('Reconnected in-flight job published');}}});
    expect((await sql.query('SELECT * FROM alerts')).rows).toHaveLength(2);
  } finally { await sql.close(); }
});
