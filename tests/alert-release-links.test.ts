import {it,expect} from 'vitest';
import {openSql} from '../src/server/sql.ts';
import {alertReleaseLinksSchema,insertAlertWithReleaseLinks,listAlertReleaseLinks} from '../src/server/alert-release-links.ts';

it('records exact multiple revisions atomically, preserves retry links, and rejects foreign evidence',async()=>{
  const sql=await openSql('pglite://:memory:');
  try {
    await sql.exec(`CREATE TABLE alerts(id BIGSERIAL PRIMARY KEY, installation_id BIGINT,repo_id BIGINT,kind TEXT,title TEXT,body TEXT,findings JSONB,github_delivery_id TEXT UNIQUE,created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE release_revisions(id BIGINT PRIMARY KEY,installation_id BIGINT,repo_id BIGINT,coordinate TEXT,created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE installation_users(user_id TEXT,installation_id BIGINT);
      CREATE FUNCTION row_within_retention(BIGINT,TIMESTAMPTZ) RETURNS BOOLEAN LANGUAGE SQL AS 'SELECT true';
      INSERT INTO installation_users VALUES('owner',1);
      INSERT INTO release_revisions(id,installation_id,repo_id,coordinate) VALUES(1,1,10,'asset-a'),(2,1,10,'asset-b'),(3,2,10,'foreign'),(4,1,20,'another-repo');`);
    await sql.exec(alertReleaseLinksSchema);
    const base={installationId:1,repoId:10,kind:'release',title:'Release',body:'Evidence'};
    const id=await insertAlertWithReleaseLinks(sql,{...base,githubDeliveryId:'delivery',releaseRevisionIds:[1,2,1]});
    expect((await listAlertReleaseLinks(sql,'owner',id,1)).map(r=>r.id)).toEqual([1,2]);
    expect(await listAlertReleaseLinks(sql,'stranger',id,1)).toEqual([]);
    expect(await listAlertReleaseLinks(sql,'owner',id,2)).toEqual([]);
    expect(await insertAlertWithReleaseLinks(sql,{...base,githubDeliveryId:'delivery',releaseRevisionIds:[4]})).toBe(id);
    expect((await listAlertReleaseLinks(sql,'owner',id,1)).map(r=>r.id)).toEqual([1,2]);
    for(const revisionId of [3,4,999]) await expect(insertAlertWithReleaseLinks(sql,{...base,releaseRevisionIds:[1,revisionId]})).rejects.toThrow();
    expect((await sql.query('SELECT id FROM alerts')).rows).toHaveLength(1);
    await expect(sql.query('UPDATE alert_release_links SET revision_id=2 WHERE revision_id=1')).rejects.toThrow('immutable');
    await expect(sql.query('DELETE FROM alert_release_links')).rejects.toThrow('immutable');
    await expect(sql.query('TRUNCATE alert_release_links')).rejects.toThrow('immutable');
    const legacy=await insertAlertWithReleaseLinks(sql,base);
    expect(await listAlertReleaseLinks(sql,'owner',legacy,1)).toEqual([]);
  } finally {await sql.close();}
},20000);
