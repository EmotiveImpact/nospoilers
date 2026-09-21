import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createStore } from '../src/server/store.ts';
import { migrate,openSql } from '../src/server/sql.ts';
import { processUploadedScan } from '../src/server/upload-worker.ts';
import { reserveStagingCapacity } from '../src/server/staging-budget.ts';
import { isolatedScan,scannerCommand } from '../src/server/isolated-scanner.ts';
import { isBlockedResolvedAddress } from '../src/server/siem.ts';
import { mintScanToken } from '../src/server/scan-api.ts';
import { scan } from '../src/scanner/index.ts';
import { createApp } from '../src/server/app.ts';
import { loadConfig } from '../src/server/config.ts';
import type { GithubPort } from '../src/server/github.ts';

afterEach(()=>vi.unstubAllEnvs());
describe('Gate A tenant and resource controls',()=>{
  it('denies viewers, scopes paid coverage, and refunds infrastructure failure once',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'a',login:'alice'});
      for(const id of [7,8]){
        await store.upsertInstallation({id,accountId:id,accountLogin:`org-${id}`,accountType:'Organization'});
        await store.linkUserInstallation(id,'a');
      }
      await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=7");
      const input={id:crypto.randomUUID(),userId:'a',installationId:7,target:'clean.tgz',bytes:await readFile('fixtures/clean.tgz')};
      await expect(store.queueUploadedScan(input)).rejects.toMatchObject({status:403});
      await sql.query("UPDATE installation_users SET role='member' WHERE installation_id=7");
      await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=7");
      await expect(store.queueUploadedScan(input)).rejects.toMatchObject({status:402});
      await sql.query("UPDATE billing_accounts SET plan='solo' WHERE installation_id=7");
      await store.queueUploadedScan(input);await store.queueUploadedScan(input);
      expect((await sql.query<{heavy_jobs:number}>('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=7')).rows[0].heavy_jobs).toBe(1);
      await processUploadedScan(input.id,store,scan,'');
      await store.failUploadedScan(input.id,true);
      expect((await sql.query<{heavy_jobs:number}>('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=7')).rows[0].heavy_jobs).toBe(0);
      expect((await store.getUploadedScan('a',input.id))?.status).toBe('failed');
    }finally{await sql.close();}
  });
  it('bounds aggregate staging before insert, across store instances',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.createPendingScan({id:crypto.randomUUID(),target:'a.zip',artifactBytes:new Uint8Array(8)});
      await expect(sql.transaction(tx=>reserveStagingCapacity(tx,3,true,{publicBytes:10,totalBytes:100,objects:5}))).rejects.toMatchObject({status:429});
      await expect(sql.transaction(tx=>reserveStagingCapacity(tx,93,false,{publicBytes:10,totalBytes:100,objects:5}))).rejects.toMatchObject({status:429});
      await sql.query("UPDATE pending_scans SET expires_at=now()-interval '1 second'");
      await sql.transaction(tx=>reserveStagingCapacity(tx,3,true,{publicBytes:10,totalBytes:100,objects:5}));
    }finally{await sql.close();}
  });
  it('uses a durable token actor and creates exactly one ledger revision on completion',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);
      await store.upsertInstallation({id:7,accountId:7,accountLogin:'org',accountType:'Organization'});
      const token=mintScanToken();
      const {rows}=await sql.query<{id:number}>(`INSERT INTO scan_api_tokens(installation_id,name,token_prefix,token_hash,created_by_login) VALUES(7,'CI',$1,$2,'owner') RETURNING id`,[token.tokenPrefix,token.tokenHash]);
      const input={id:crypto.randomUUID(),userId:null,installationId:7,tokenId:Number(rows[0].id),target:'clean.tgz',bytes:await readFile('fixtures/clean.tgz'),meta:{coordinate:'api:7#clean.tgz'}};
      const app=createApp({store,config:loadConfig({sessionSecret:'test-session',receiptSecret:'test-receipt-secret'}),github:{} as GithubPort});
      const submitted=await app.request('/api/v1/scan',{method:'POST',headers:{authorization:`Bearer ${token.token}`,'x-filename':'clean.tgz'},body:input.bytes});
      expect(submitted.status).toBe(202);
      const queued=await submitted.json() as {uploadId:string;statusUrl:string};
      const queuedStatus=await app.request(queued.statusUrl,{headers:{authorization:`Bearer ${token.token}`}});
      expect(await queuedStatus.json()).toMatchObject({status:'queued',report:null});
      expect((await app.request(queued.statusUrl)).status).toBe(401);
      await store.queueUploadedScan(input);await store.queueUploadedScan(input);
      await processUploadedScan(input.id,store,scan,'test-receipt-secret');
      await processUploadedScan(input.id,store,scan,'test-receipt-secret');
      const uploaded=await store.getInstallationUpload(7,input.id);
      expect(uploaded?.status).toBe('done');expect(uploaded?.revision_id).toBeTruthy();
      await expect(sql.query("UPDATE uploaded_scans SET report_json='{}' WHERE id=$1",[input.id])).rejects.toThrow('immutable');
      expect((await sql.query('SELECT id FROM release_revisions')).rows).toHaveLength(1);
      expect(await store.getInstallationUpload(8,input.id)).toBeNull();
      await sql.query('UPDATE scan_api_tokens SET revoked_at=now() WHERE id=$1',[input.tokenId]);
      await expect(store.queueUploadedScan({...input,id:crypto.randomUUID()})).rejects.toMatchObject({status:403});
    }finally{await sql.close();}
  });
});
describe('parser and egress boundaries',()=>{
  it('runs an actual fixture in a separate parser process',async()=>{
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('NOSPOILERS_SCANNER_MODE','process');
    const report=await isolatedScan('fixtures/clean.tgz');
    expect(report.ok).toBe(true);expect(report.target).toBe('fixtures/clean.tgz');
  },15000);
  it('fails closed in production without a container and configures restricted execution',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('NOSPOILERS_SCANNER_MODE','process');
    await expect(isolatedScan('fixtures/clean.tgz')).rejects.toThrow('isolated scanner executor');
    const cmd=scannerCommand('/tmp/clean.tgz','container','nospoilers-scan-test');
    expect(cmd.args).toEqual(expect.arrayContaining(['--network=none','--read-only','--cap-drop=ALL','--memory=1g','--pids-limit=32']));
    expect(cmd.args.join(' ')).not.toContain('docker.sock');
  });
  it.each([['127.0.0.1',4],['169.254.169.254',4],['240.0.0.1',4],['192.0.2.1',4],['::ffff:7f00:1',6],['2002:7f00:1::',6],['fe90::1',6],['2001:db8::1',6]])('blocks reserved destination %s',(address,family)=>{
    expect(isBlockedResolvedAddress(String(address),Number(family))).toBe(true);
  });
});
