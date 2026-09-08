import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {workspacePolicySchema} from '../src/server/workspace-policy-schema.ts';
import {getWorkspaceArtifactPolicy,saveWorkspaceArtifactPolicy,workspaceArtifactPolicySnapshot,applyWorkspaceArtifactPolicy} from '../src/server/workspace-policy.ts';
import type {ScanReport} from '../src/scanner/types.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';

it('persists scoped strict policy, rejects stale/unauthorised changes and applies immutable snapshots',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);await sql.exec(workspacePolicySchema);const store=createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
    const workspace=(await listUserWorkspaces(sql,'owner'))[0];
    expect(await getWorkspaceArtifactPolicy(sql,'owner',workspace.id)).toMatchObject({strict:false,revision:0,canEdit:true});
    await expect(getWorkspaceArtifactPolicy(sql,'stranger',workspace.id)).rejects.toMatchObject({status:404});
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'owner')",[workspace.id]);
    await expect(getWorkspaceArtifactPolicy(sql,'owner',workspace.id)).rejects.toMatchObject({status:404});
    await sql.query("DELETE FROM product_workspace_revocations WHERE workspace_id=$1",[workspace.id]);
    await expect(saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:'true',expectedRevision:0})).rejects.toMatchObject({status:400});
    await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:0});
    const snapshot=await workspaceArtifactPolicySnapshot(sql,workspace.id);
    await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:false,expectedRevision:1});
    await expect(saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:1})).rejects.toMatchObject({status:409});
    const report={target:'artifact',kind:'zip',findings:[{rule:'DOC-001',severity:'warn',path:'notes.md',title:'Documentation',detail:'Internal notes'}],ok:true,status:'passed',suppressed:[],policyHash:null} as unknown as ScanReport;
    expect(applyWorkspaceArtifactPolicy(report,snapshot)).toMatchObject({ok:false,status:'failed-policy'});
    expect(applyWorkspaceArtifactPolicy(report,await workspaceArtifactPolicySnapshot(sql,workspace.id))).toMatchObject({ok:true,status:'passed'});
    expect(report.ok).toBe(true);
    expect(applyWorkspaceArtifactPolicy({...report,status:'inconclusive'},snapshot).status).toBe('inconclusive');
    await expect(sql.query('DELETE FROM product_workspace_policy_events')).rejects.toThrow();
    await expect(sql.query('UPDATE product_workspace_policy_events SET strict=false')).rejects.toThrow();
    await expect(sql.query('TRUNCATE product_workspace_policy_events')).rejects.toThrow();
    await sql.query("UPDATE product_workspace_members SET role='viewer' WHERE workspace_id=$1",[workspace.id]);
    await expect(saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:2})).rejects.toMatchObject({status:403});
    await store.upsertInstallation({id:911,accountId:911,accountLogin:'connected',accountType:'Organization'});
    await store.linkUserInstallation(911,'owner');
    const connected=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===911)!;
    expect(await getWorkspaceArtifactPolicy(sql,'owner',connected.id)).toMatchObject({supported:true,canEdit:true});
    expect(await saveWorkspaceArtifactPolicy(sql,'owner',connected.id,{strict:true,expectedRevision:0,requireExceptionApproval:true})).toMatchObject({strict:true,revision:1,require_exception_approval:true});
    expect(await workspaceArtifactPolicySnapshot(sql,connected.id)).toMatchObject({strict:true});
    expect(await getWorkspaceArtifactPolicy(sql,'owner',workspace.id)).toMatchObject({strict:false,revision:2});
    await sql.query("UPDATE product_workspace_members SET role='owner' WHERE workspace_id=$1",[workspace.id]);
    await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
    await expect(saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:2})).rejects.toMatchObject({status:403});
  }finally{await sql.close();}
});

it('worker uses the start-time policy despite an administrator change during parsing',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);await sql.exec(workspacePolicySchema);const store=createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
    const workspace=(await listUserWorkspaces(sql,'owner'))[0];
    await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:0});
    const id=crypto.randomUUID();await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:workspace.id,target:'artifact.zip',bytes:new Uint8Array([1])});
    await processUploadedScan(id,store,async()=>{
      await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:false,expectedRevision:1});
      return {target:'artifact.zip',kind:'zip',fileCount:1,findings:[{rule:'DOC-001',severity:'warn',path:'notes.md',title:'Documentation',detail:'Internal notes'}],ok:true,status:'passed',scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null} as ScanReport;
    },'receipt-test');
    const result=await store.getUploadedScan('owner',id);
    expect(result?.status).toBe('done');
    expect(result?.report_json).toMatchObject({ok:false,status:'failed-policy'});
    const before=result?.report_json;
    await saveWorkspaceArtifactPolicy(sql,'owner',workspace.id,{strict:true,expectedRevision:2});
    expect((await store.getUploadedScan('owner',id))?.report_json).toEqual(before);
  }finally{await sql.close();}
});

it('keeps independent and GitHub scan policies separate inside the same connected workspace',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'mixed-owner',login:'mixed-owner'});
  await store.upsertInstallation({id:912,accountId:912,accountLogin:'mixed',accountType:'Organization'});
  await store.linkUserInstallation(912,'mixed-owner');
  const workspace=(await listUserWorkspaces(sql,'mixed-owner')).find(w=>Number(w.installation_id)===912)!;
  await saveWorkspaceArtifactPolicy(sql,'mixed-owner',workspace.id,{strict:true,expectedRevision:0});
  const reports=[];
  for(const installationId of [null,912]){
   const id=crypto.randomUUID();
   await store.queueUploadedScan({id,userId:'mixed-owner',installationId,workspaceId:workspace.id,target:'artifact.zip',bytes:new Uint8Array([1])});
   await processUploadedScan(id,store,async()=>({target:'artifact.zip',kind:'zip',fileCount:1,findings:[{rule:'DOC-001',severity:'warn',path:'notes.md',title:'Documentation',detail:'Internal notes'}],ok:true,status:'passed',scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null} as ScanReport),'receipt-test');
   const result=await store.getUploadedScan('mixed-owner',id);
   expect(result?.status).toBe('done');reports.push(result?.report_json);
  }
  expect(reports[0]).toMatchObject({ok:false,status:'failed-policy'});
  expect(reports[1]).toMatchObject({ok:true,status:'passed'});
 }finally{await sql.close();}
});
