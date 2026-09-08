import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {handleJob} from '../src/server/worker.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {createLogNotifier} from '../src/server/notifier.ts';
it('rejects origin credential and verification changes after workspace revocation despite stale installation membership',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(row=>Number(row.installation_id)===7)!;
  const origin=await store.insertWatchedOrigin(7,'https://example.com','example.com');expect(origin).not.toBeNull();
  await store.setOriginVerificationChallenge(origin!.id,'owner','challenge');await store.markOriginVerified(origin!.id,'owner','dns');
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);
  expect(await store.setOriginVerificationChallenge(origin!.id,'owner','replacement')).toBeNull();
  expect(await store.markOriginVerified(origin!.id,'owner','http')).toBeNull();
  expect(await store.setOriginDeployToken(origin!.id,'owner','hash','prefix')).toBeNull();
  expect(await store.deleteWatchedOriginForUser(origin!.id,'owner')).toBe(false);
  expect(await store.getWatchedOrigin(origin!.id)).toMatchObject({verification_token:'challenge',verification_method:'dns',deploy_token_prefix:null});
 }finally{await sql.close();}
});
it('does not crawl a queued origin owned by a different connection',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of [7,8])await store.upsertInstallation({id,accountId:id,accountLogin:`org${id}`,accountType:'User'});
  const origin=(await store.insertWatchedOrigin(8,'https://example.com','example.com'))!;
  await store.enqueueJob({installationId:7,priority:'heavy',kind:'web_origin_scan',payload:{installationId:7,originId:origin.id,url:'https://different.example.com'}});
  const job=(await store.claimJob('heavy',1,'test'))!;expect(job).not.toBeNull();
  let calls=0;
  await handleJob(job,{store,github:stubGithub(),notifier:createLogNotifier(store),scan:async()=>{calls++;throw new Error('Must not scan');},maxAssetBytes:1024,workerId:'test',webFetch:async()=>{calls++;throw new Error('Must not crawl');}});
  expect(calls).toBe(0);
  expect((await sql.query('SELECT id FROM alerts')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
it('disconnects without erasing origin identity and requires fresh verification on reconnection',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'owner',accountType:'User'});await store.linkUserInstallation(7,'owner');
  const origin=(await store.insertWatchedOrigin(7,'https://example.com','example.com'))!;
  await store.setOriginVerificationChallenge(origin.id,'owner','proof');await store.markOriginVerified(origin.id,'owner','dns');await store.setOriginDeployToken(origin.id,'owner','hash','prefix');
  expect(await store.deleteWatchedOriginForUser(origin.id,'owner')).toBe(true);
  expect(await store.getWatchedOrigin(origin.id)).toBeNull();expect(await store.getOriginByDeployTokenHash('hash')).toBeNull();
  expect(await store.listAllWatchedOrigins()).toEqual([]);
  expect((await sql.query('SELECT id FROM watched_origins WHERE id=$1',[origin.id])).rows).toHaveLength(1);
  const reconnected=await store.insertWatchedOrigin(7,'https://example.com','example.com');
  expect(reconnected).toMatchObject({id:origin.id,verified_at:null,verification_token:'proof',deploy_token_prefix:null});
 }finally{await sql.close();}
});
