import { describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createStore } from '../src/server/store.ts';
import { migrate,openSql } from '../src/server/sql.ts';
import { processUploadedScan } from '../src/server/upload-worker.ts';
import { readBoundedBody } from '../src/server/bounded-body.ts';
import { scan } from '../src/scanner/index.ts';
import { verifyReceipt } from '../src/receipt.ts';

describe('durable uploaded releases',()=>{
  it('queues once, creates scoped proof, removes bytes and isolates personal owners',async()=>{
    const sql=await openSql('pglite://:memory:');
    try {
      await migrate(sql);const store=createStore(sql);
      await store.upsertUser({id:'alice',login:'alice'});await store.upsertUser({id:'bob',login:'bob'});
      const bytes=await readFile('fixtures/clean.tgz'),id=crypto.randomUUID();
      const input={id,userId:'alice',installationId:null,target:'clean.tgz',bytes};
      await Promise.all([store.queueUploadedScan(input),store.queueUploadedScan(input)]);
      expect((await sql.query('SELECT id FROM jobs WHERE kind=\'uploaded_scan\'')).rows).toHaveLength(1);
      expect((await sql.query<{scans:number}>('SELECT scans FROM personal_scan_usage')).rows[0].scans).toBe(1);
      expect((await store.getUploadedScan('alice',id))?.status).toBe('queued');
      expect(await store.getUploadedScan('bob',id)).toBeNull();
      await processUploadedScan(id,store,scan,'test-receipt-secret');
      const saved=await store.getUploadedScan('alice',id);
      expect(saved?.status).toBe('done');expect(saved?.report_json?.ok).toBe(true);
      expect(verifyReceipt(JSON.stringify(saved?.receipt_json),'test-receipt-secret').ok).toBe(true);
      expect((await sql.query<{artifact_bytes:unknown}>('SELECT artifact_bytes FROM uploaded_scans')).rows[0].artifact_bytes).toBeNull();
      await processUploadedScan(id,store,async()=>{throw new Error('must not scan twice');},'test-receipt-secret');
      expect((await store.getUploadedScan('alice',id))?.status).toBe('done');
      await expect(store.queueUploadedScan({...input,userId:'bob'})).rejects.toThrow('already in use');
    } finally {await sql.close();}
  });
  it('rejects expired personal coverage without creating work',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'expired',login:'expired'});
      await sql.query("UPDATE users SET trial_ends_at=now()-interval '1 day' WHERE id='expired'");
      await expect(store.queueUploadedScan({id:crypto.randomUUID(),userId:'expired',installationId:null,target:'x.zip',bytes:new Uint8Array([1])})).rejects.toThrow('coverage');
      expect((await sql.query("SELECT id FROM jobs WHERE kind='uploaded_scan'")).rows).toHaveLength(0);
    }finally{await sql.close();}
  });
  it('shares limits between application instances and resets expired buckets',async()=>{
    const sql=await openSql('pglite://:memory:');try{
      await migrate(sql);const a=createStore(sql),b=createStore(sql);
      expect(await a.reserveRequest('same',1,10000)).toBe(true);
      expect(await b.reserveRequest('same',1,10000)).toBe(false);
      await sql.query("UPDATE request_rate_buckets SET expires_at=now()-interval '1 second'");
      expect(await b.reserveRequest('same',1,10000)).toBe(true);
    }finally{await sql.close();}
  });
});
describe('bounded streaming reads',()=>{
  it('rejects stalled bodies rather than accepting a partial upload',async()=>{
    let cancelled=false;
    const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}});
    await expect(readBoundedBody(body,10,undefined,10)).rejects.toMatchObject({status:408});
    expect(cancelled).toBe(true);
  });
  it('cancels an oversized stream without buffering its remaining chunks',async()=>{
    let cancelled=false;let emitted=0;
    const body=new ReadableStream<Uint8Array>({pull(c){emitted++;c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
    await expect(readBoundedBody(body,10)).rejects.toMatchObject({status:413});
    expect(cancelled).toBe(true);expect(emitted).toBeLessThan(5);
  });
  it('accepts exact-limit input and rejects misleading Content-Length',async()=>{
    const body=new Response(new Uint8Array([1,2,3])).body;
    expect(await readBoundedBody(body,3,'1')).toEqual(Buffer.from([1,2,3]));
    await expect(readBoundedBody(new Response(new Uint8Array([1,2,3,4])).body,3,'1')).rejects.toMatchObject({status:413});
  });
});
