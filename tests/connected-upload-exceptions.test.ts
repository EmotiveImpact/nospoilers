import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {saveWorkspaceArtifactPolicy} from '../src/server/workspace-policy.ts';
import {requestWorkspaceException,decideWorkspaceException} from '../src/server/workspace-exceptions.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {scan} from '../src/scanner/index.ts';

it('approves connected uploaded findings without leaking exceptions into independent scans or rewriting evidence',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','reviewer'])await store.upsertUser({id,login:id});
  await store.upsertInstallation({id:931,accountId:931,accountLogin:'connected',accountType:'Organization'});await store.linkUserInstallation(931,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===931)!;
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'reviewer','admin','explicit')",[workspace.id]);
  await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:false,expectedRevision:0,requireExceptionApproval:true});
  const bytes=await readFile('fixtures/clean.tgz');
  const scanFinding:typeof scan=async(...args)=>({...await scan(...args),findings:[{rule:'MAP-001',severity:'critical',path:'app.map',title:'Source map',detail:'Test finding'}],ok:false,status:'failed-policy'});
  async function check(installationId:number|null,duringScan?:()=>Promise<unknown>){const id=randomUUID();await store.queueUploadedScan({id,userId:'owner',installationId,workspaceId:workspace.id,target:'clean.tgz',bytes});const scanner:typeof scan=async(...args)=>{await duringScan?.();return scanFinding(...args);};await processUploadedScan(id,store,scanner,'test-key');const result=(await store.getUploadedScan('owner',id))!;expect(result.status).toBe('done');return result;}
  const original=await check(931),before=JSON.stringify(original.receipt_json);
  const request=await requestWorkspaceException(sql,'owner',workspace.id,{requestKey:randomUUID(),attemptId:original.id,findingIndex:0,reason:'Bounded exception for this artifact',expiresAt:new Date(Date.now()+86400000).toISOString()});
  expect((await check(931)).report_json?.status).toBe('failed-policy');
  await expect(decideWorkspaceException(sql,'owner',workspace.id,request.id,'approved','Reviewed this risk')).rejects.toMatchObject({status:403});
  const pendingScan=await check(931,()=>decideWorkspaceException(sql,'reviewer',workspace.id,request.id,'approved','Independent review complete'));
  expect(pendingScan.report_json?.status).toBe('failed-policy');
  expect((await check(931)).report_json).toMatchObject({status:'passed',suppressed:[{finding:{rule:'MAP-001'}}]});
  expect((await check(null)).report_json?.status).toBe('failed-policy');
  await expect(sql.query('UPDATE workspace_exceptions SET installation_id=NULL WHERE id=$1',[request.id])).rejects.toThrow('immutable');
  const approvedScan=await check(931,()=>decideWorkspaceException(sql,'reviewer',workspace.id,request.id,'revoked','Risk acceptance withdrawn'));
  expect(approvedScan.report_json).toMatchObject({status:'passed',suppressed:[{finding:{rule:'MAP-001'}}]});
  expect((await check(931)).report_json?.status).toBe('failed-policy');
  expect(JSON.stringify((await store.getUploadedScan('owner',original.id))?.receipt_json)).toBe(before);
 }finally{await sql.close();}
});
