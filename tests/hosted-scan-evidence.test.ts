import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {persistHostedReceipt} from '../src/server/receipts.ts';
import {scan} from '../src/scanner/index.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {requestWorkspaceException,decideWorkspaceException} from '../src/server/workspace-exceptions.ts';
import {applyHostedPolicy} from '../src/server/hosted-policy.ts';

it('retains exact private hosted evidence with the receipt and denies foreign or anonymous reads',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','other'])await store.upsertUser({id,login:id});
  await store.upsertInstallation({id:941,accountId:941,accountLogin:'source',accountType:'User'});await store.linkUserInstallation(941,'owner');
  const report={...await scan('fixtures/clean.tgz'),findings:[{rule:'MAP-001',severity:'critical' as const,path:'app.map',title:'Source map',detail:'Fixture finding'}],ok:false,status:'failed-policy' as const};
  const result=await persistHostedReceipt({store,secret:'test',installationId:941,coordinate:'test@1.0.0',report});
  const evidence=(await sql.query<{report:unknown}>('SELECT report FROM hosted_scan_evidence WHERE receipt_id=$1',[result.row.id])).rows[0];
  expect(evidence.report).toEqual(result.report);
  await expect(sql.query("UPDATE hosted_scan_evidence SET report='{}'::jsonb")).rejects.toThrow('immutable');
  await expect(sql.query('DELETE FROM hosted_scan_evidence')).rejects.toThrow('immutable');
  await expect(sql.query('TRUNCATE hosted_scan_evidence')).rejects.toThrow();
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'test'})});
  const url=`/api/releases/${result.revision.id}/evidence`;
  expect((await app.request(url)).status).toBe(401);
  const call=async(user:string)=>app.request(url,{headers:{cookie:`ns_session=${signSession('test',await store.createSession(user))}`}});
  expect((await call('other')).status).toBe(404);
  const response=await call('owner');expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({available:true,report:result.report});
  const workspace=(await sql.query<{workspace_id:string}>('SELECT workspace_id FROM hosted_scan_evidence WHERE receipt_id=$1',[result.row.id])).rows[0].workspace_id;
  const input={receiptId:result.row.id,findingIndex:0,requestKey:crypto.randomUUID(),reason:'Reviewed this exact artifact risk',expiresAt:new Date(Date.now()+86400000).toISOString()};
  const request=await requestWorkspaceException(sql,'owner',workspace,input);
  expect(await requestWorkspaceException(sql,'owner',workspace,input)).toEqual(request);
  await expect(requestWorkspaceException(sql,'owner',workspace,{...input,attemptId:'ambiguous'})).rejects.toMatchObject({status:400});
  expect((await applyHostedPolicy(store,report,941)).status).toBe('failed-policy');
  await decideWorkspaceException(sql,'owner',workspace,request.id,'approved','Bounded risk accepted');
  expect(await applyHostedPolicy(store,report,941)).toMatchObject({status:'passed',suppressed:[{finding:{rule:'MAP-001'}}]});
  expect((await sql.query<{report:unknown}>('SELECT report FROM hosted_scan_evidence WHERE receipt_id=$1',[result.row.id])).rows[0].report).toEqual(result.report);
  const count=(await sql.query('SELECT id FROM scan_receipts')).rows.length;
  await sql.exec("CREATE FUNCTION fail_evidence_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test persistence failure'; END $$; CREATE TRIGGER fail_evidence_test BEFORE INSERT ON hosted_scan_evidence FOR EACH ROW EXECUTE FUNCTION fail_evidence_test();");
  await expect(persistHostedReceipt({store,secret:'test',installationId:941,coordinate:'test@2.0.0',report})).rejects.toThrow('test persistence failure');
  expect((await sql.query('SELECT id FROM scan_receipts')).rows).toHaveLength(count);
 }finally{await sql.close();}
});
