import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {githubSignature} from '../src/server/hmac.ts';
import {stageUnboundGithubEvent,pendingGithubEvents} from '../src/server/github-pending-events.ts';

it('stores verified unknown installation events without creating a trial or job, and rejects unsigned requests',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);const app=createApp({store,github:stubGithub(),config:loadConfig({githubWebhookSecret:'test-signature',sessionSecret:'test-encryption'})});
  const body=JSON.stringify({action:'created',installation:{id:999},sender:{id:7},repositories:[{id:88,name:'private-name'}]});
  const post=(signature:string)=>app.request('/api/webhooks/github',{method:'POST',headers:{'x-github-event':'installation','x-github-delivery':'delivery-1','x-hub-signature-256':signature},body});
  expect((await post('sha256=invalid')).status).toBe(401);
  expect((await sql.query('SELECT * FROM github_pending_events')).rows).toHaveLength(0);
  expect(await (await post(githubSignature('test-signature',body))).json()).toMatchObject({queued:false,kind:'connection_pending'});
  await post(githubSignature('test-signature',body));
  expect((await sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
  expect((await sql.query('SELECT * FROM billing_accounts')).rows).toHaveLength(0);
  expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(0);
  const rows=(await sql.query('SELECT * FROM github_pending_events')).rows;expect(rows).toHaveLength(1);expect(JSON.stringify(rows)).not.toContain('private-name');
  expect((await pendingGithubEvents(sql,'test-encryption',999))[0].payload).toEqual(JSON.parse(body));
 }finally{await sql.close();}
});

it('preserves repository events before installation events, rejects conflicting delivery IDs and expires transport data',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);
  const repo={installation:{id:999},action:'added',repositories_added:[{id:88}]};
  expect(await stageUnboundGithubEvent(sql,'secret','installation_repositories','first',repo)).toBe(true);
  await stageUnboundGithubEvent(sql,'secret','installation','second',{installation:{id:999},action:'created'});
  expect((await pendingGithubEvents(sql,'secret',999)).map(row=>row.event)).toEqual(['installation_repositories','installation']);
  await expect(stageUnboundGithubEvent(sql,'secret','installation','first',repo)).rejects.toMatchObject({status:409});
  await sql.query("UPDATE github_pending_events SET expires_at=now()-interval '1 second'");
  expect(await pendingGithubEvents(sql,'secret',999)).toEqual([]);
  await stageUnboundGithubEvent(sql,'secret','installation','third',{installation:{id:999},action:'created'});
  expect((await sql.query('SELECT delivery_id FROM github_pending_events')).rows).toEqual([{delivery_id:'third'}]);
  await createStore(sql).upsertInstallation({id:7,accountId:7,accountLogin:'existing',accountType:'User'});
  expect(await stageUnboundGithubEvent(sql,'secret','push','known',{installation:{id:7}})).toBe(false);
 }finally{await sql.close();}
});
