import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {requestWorkspaceException,decideWorkspaceException,listWorkspaceExceptions,workspaceExceptionDetail} from '../src/server/workspace-exceptions.ts';
import {saveWorkspaceArtifactPolicy,workspaceArtifactPolicySnapshot} from '../src/server/workspace-policy.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {scan} from '../src/scanner/index.ts';
import {exceptionCovers} from '../src/policy.ts';

it('requests and independently approves scoped exceptions without changing historical evidence',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  for(const id of ['owner','reviewer','viewer']){await store.upsertUser({id,login:id});await store.createSession(id);}
  const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  const cookies:Record<string,string>={};for(const id of ['owner','reviewer','viewer'])cookies[id]=`ns_session=${signSession('test-key',await store.createSession(id))}`;
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'test-key',appBaseUrl:'http://127.0.0.1:4347'})});
  const call=(actor:string,suffix='',method='GET',body?:unknown,origin='http://127.0.0.1:4347')=>app.request(`/api/workspaces/${workspace.id}/exceptions${suffix}`,{method,headers:{cookie:cookies[actor]??'',origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  expect((await call('')).status).toBe(401);
  for(const [id,role] of [['reviewer','admin'],['viewer','viewer']])await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,$2,$3,'explicit')",[workspace.id,id,role]);
  await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:false,expectedRevision:0,requireExceptionApproval:true});
  const bytes=await readFile('fixtures/clean.tgz');
  const finding={rule:'MAP-001',severity:'critical' as const,path:'literal*.map',title:'Source map',detail:'Test finding'};
  const scanFinding:typeof scan=async(...args)=>({...await scan(...args),findings:[finding],ok:false,status:'failed-policy'});
  async function check(){const id=randomUUID();await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:workspace.id,target:'clean.tgz',bytes});await processUploadedScan(id,store,scanFinding,'test-signing');return (await store.getUploadedScan('owner',id))!;}
  const original=await check(),before=JSON.stringify(original.report_json),receipt=JSON.stringify(original.receipt_json);
  const input={requestKey:randomUUID(),attemptId:original.id,findingIndex:0,reason:'Reviewed bounded risk for this exact artifact',expiresAt:new Date(Date.now()+86400000).toISOString()};
  expect((await call('viewer','','POST',input)).status).toBe(403);
  expect((await call('owner','','POST',input,'https://attacker.invalid')).status).toBe(403);
  await expect(requestWorkspaceException(sql,'viewer',workspace.id,input)).rejects.toMatchObject({status:403});
  const requested=await requestWorkspaceException(sql,'owner',workspace.id,input);
  expect(await requestWorkspaceException(sql,'owner',workspace.id,input)).toEqual(requested);
  const detail=await call('viewer',`/${requested.id}`);expect(detail.status).toBe(200);expect(detail.headers.get('cache-control')).toBe('no-store');
  expect(await detail.json()).toMatchObject({exception:{status:'pending'},events:[{action:'requested'}],independentApproverAvailable:true});
  await expect(requestWorkspaceException(sql,'owner',workspace.id,{...input,reason:'A different risk reason'})).rejects.toMatchObject({status:409});
  expect((await check()).report_json?.status).toBe('failed-policy');
  await expect(decideWorkspaceException(sql,'owner',workspace.id,requested.id,'approved','I approved my own request')).rejects.toMatchObject({status:403});
  expect((await call('owner',`/${requested.id}/decision`,'POST',{action:'approved',note:'Attempted self approval'})).status).toBe(403);
  expect((await call('reviewer',`/${requested.id}/decision`,'POST',{action:'approved',note:'Independent risk review complete'})).status).toBe(200);
  const passing=await check();expect(passing.report_json?.status).toBe('passed');
  expect(passing.report_json?.suppressed).toHaveLength(1);
  expect(passing.report_json?.suppressed?.[0]).toMatchObject({finding,reason:input.reason});
  const policy=await workspaceArtifactPolicySnapshot(sql,workspace.id,{artifactSha256:original.artifact_sha256,sourceOriginId:null});
  expect(policy?.exceptions).toHaveLength(1);
  expect(exceptionCovers(policy!.exceptions[0],{...finding,path:'literal-other.map'})).toBe(false);
  expect(await workspaceArtifactPolicySnapshot(sql,workspace.id,{artifactSha256:'0'.repeat(64),sourceOriginId:null})).toMatchObject({exceptions:[]});
  await decideWorkspaceException(sql,'reviewer',workspace.id,requested.id,'revoked','Risk no longer accepted');
  expect((await check()).report_json?.status).toBe('failed-policy');
  const retained=await store.getUploadedScan('owner',original.id);
  expect(JSON.stringify(retained?.report_json)).toBe(before);expect(JSON.stringify(retained?.receipt_json)).toBe(receipt);
  await expect(sql.query('UPDATE workspace_exceptions SET exact_path=$1',['other'])).rejects.toThrow('immutable');
  await expect(sql.query('DELETE FROM workspace_exception_events')).rejects.toThrow();
  expect((await sql.query('SELECT action FROM workspace_exception_events ORDER BY id')).rows).toEqual([{action:'requested'},{action:'approved'},{action:'revoked'}]);
  const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other scope');
  await expect(requestWorkspaceException(sql,'owner',other.id,{...input,requestKey:randomUUID()})).rejects.toMatchObject({status:404});
  await expect(workspaceExceptionDetail(sql,'owner',other.id,requested.id)).rejects.toMatchObject({status:404});
  await expect(listWorkspaceExceptions(sql,'owner',other.id,requested.id)).rejects.toMatchObject({status:404});
  await expect(decideWorkspaceException(sql,'owner',other.id,requested.id,'revoked','Foreign scope attempt')).rejects.toMatchObject({status:404});
  const concurrent=await requestWorkspaceException(sql,'owner',workspace.id,{...input,requestKey:randomUUID()});
  const decisions=await Promise.allSettled([
   decideWorkspaceException(sql,'reviewer',workspace.id,concurrent.id,'approved','Concurrent approval decision'),
   decideWorkspaceException(sql,'reviewer',workspace.id,concurrent.id,'rejected','Concurrent rejection decision'),
  ]);
  expect(decisions.filter(d=>d.status==='fulfilled')).toHaveLength(1);
  expect((await sql.query("SELECT id FROM workspace_exception_events WHERE exception_id=$1 AND action IN ('approved','rejected')",[concurrent.id])).rows).toHaveLength(1);
  // Historical expired record: expiry must be enforced by reads and scan use,
  // not by a cleanup job changing the immutable exception row.
  const expired=randomUUID();
  await sql.query(`INSERT INTO workspace_exceptions(id,workspace_id,request_key,requested_by,requested_login,attempt_id,artifact_sha256,rule,exact_path,reason,expires_at,independent_approval,status)
   SELECT $1,workspace_id,$2,requested_by,requested_login,attempt_id,artifact_sha256,rule,exact_path,reason,now()-interval '1 second',independent_approval,'approved'
   FROM workspace_exceptions WHERE id=$3`,[expired,randomUUID(),requested.id]);
  expect(await workspaceExceptionDetail(sql,'owner',workspace.id,expired)).toMatchObject({exception:{effective_status:'expired'}});
  expect(await decideWorkspaceException(sql,'reviewer',workspace.id,expired,'approved','Retry original approval request')).toEqual({id:expired,status:'expired'});
  const expiredPending=randomUUID();
  await sql.query(`INSERT INTO workspace_exceptions(id,workspace_id,request_key,requested_by,requested_login,attempt_id,artifact_sha256,rule,exact_path,reason,expires_at,independent_approval)
   SELECT $1,workspace_id,$2,requested_by,requested_login,attempt_id,artifact_sha256,rule,exact_path,reason,now()-interval '1 second',independent_approval
   FROM workspace_exceptions WHERE id=$3`,[expiredPending,randomUUID(),requested.id]);
  await expect(decideWorkspaceException(sql,'reviewer',workspace.id,expiredPending,'approved','Cannot approve expired request')).rejects.toMatchObject({status:409});
  await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'reviewer')",[workspace.id]);
  expect(await workspaceExceptionDetail(sql,'owner',workspace.id,requested.id)).toMatchObject({independentApproverAvailable:false});
  await expect(decideWorkspaceException(sql,'reviewer',workspace.id,expiredPending,'revoked','Revoked reviewer authority')).rejects.toMatchObject({status:404});
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  await expect(requestWorkspaceException(sql,'owner',workspace.id,{...input,requestKey:randomUUID()})).rejects.toMatchObject({status:403});
 }finally{await sql.close();}
});
