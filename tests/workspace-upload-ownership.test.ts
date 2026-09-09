import {it,expect} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {createWorkspace,ensureUserWorkspaces,listUserWorkspaces,updateWorkspace,uploadWorkspaceScope} from '../src/server/workspaces.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {inviteWorkspaceMember,acceptWorkspaceInvite} from '../src/server/workspace-membership.ts';

it('isolates two workspaces while sharing usage and retaining immutable ownership',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
    const [first]=await listUserWorkspaces(sql,'owner');
    await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[first.id,'owner']);
    await expect(uploadWorkspaceScope(sql,'owner',null,first.id)).rejects.toMatchObject({status:403});
    await sql.query('DELETE FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id=$2',[first.id,'owner']);
    const second=await createWorkspace(sql,'owner',first.organization_id,'Second');
    const input={userId:'owner',installationId:null,target:'x.zip',bytes:new Uint8Array([1])};
    const a=crypto.randomUUID(),b=crypto.randomUUID();
    await store.queueUploadedScan({...input,id:a,workspaceId:first.id});
    await store.queueUploadedScan({...input,id:b,workspaceId:second.id});
    expect((await store.listUploadedScans('owner',undefined,first.id)).map(row=>row.id)).toEqual([a]);
    expect((await store.listUploadedScans('owner',undefined,second.id)).map(row=>row.id)).toEqual([b]);
    expect((await sql.query<{scans:number}>('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:2}]);
    await expect(sql.query('UPDATE uploaded_scans SET workspace_id=$1 WHERE id=$2',[first.id,b])).rejects.toThrow('immutable');
    await updateWorkspace(sql,'owner',second.id,{archived:true});
    await expect(store.queueUploadedScan({...input,id:crypto.randomUUID(),workspaceId:second.id})).rejects.toMatchObject({status:403});
    let scans=0;
    await processUploadedScan(b,store,async()=>{scans++;throw new Error('must not run');},'test');
    expect(scans).toBe(0);
    expect((await store.getUploadedScan('owner',b))?.status).toBe('failed');
    expect((await sql.query<{scans:number}>('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:1}]);
    expect(await store.getUploadedScan('stranger',a)).toBeNull();
  }finally{await sql.close();}
});

it('charges an installation organisation without pretending its connection belongs to the new workspace',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});
    await store.upsertInstallation({id:7,accountId:7,accountLogin:'org',accountType:'Organization'});await store.linkUserInstallation(7,'owner');
    const original=(await listUserWorkspaces(sql,'owner')).find(w=>w.installation_id!==null)!;
    const added=await createWorkspace(sql,'owner',original.organization_id,'Package work');
    const id=crypto.randomUUID();
    await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:added.id,target:'x.zip',bytes:new Uint8Array([1])});
    const result=await store.getUploadedScan('owner',id);
    expect(result).toMatchObject({workspace_id:added.id,installation_id:null,billing_installation_id:7});
    expect((await sql.query<{heavy_jobs:number}>('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=7')).rows[0].heavy_jobs).toBe(1);
    await store.failUploadedScan(id,true);
    expect((await sql.query<{heavy_jobs:number}>('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=7')).rows[0].heavy_jobs).toBe(0);
    await store.upsertUser({id:'colleague',login:'colleague'});
    const invite=await inviteWorkspaceMember(sql,'owner',added.id,'colleague','member');
    await acceptWorkspaceInvite(sql,'colleague',invite.id);
    expect(await store.getInstallationRole('colleague',7)).toBeNull();
    // The billing source is not this workspace's connection or permission authority.
    await sql.query('UPDATE installations SET suspended=true WHERE id=7');
    const memberUpload=crypto.randomUUID();
    await store.queueUploadedScan({id:memberUpload,userId:'colleague',installationId:null,workspaceId:added.id,target:'x.zip',bytes:new Uint8Array([1])});
    await processUploadedScan(memberUpload,store,async()=>({target:'x.zip',kind:'zip',fileCount:1,findings:[],ok:true,status:'passed',scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null}),'test-secret');
    expect((await store.getUploadedScan('colleague',memberUpload))?.report_json).not.toBeNull();
    expect((await sql.query<{heavy_jobs:number}>('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=7')).rows[0].heavy_jobs).toBe(1);
    expect(await store.getInstallationRole('colleague',7)).toBeNull();
  }finally{await sql.close();}
});

it('uses recorded personal coverage for a connected upload and denies an expired payer without changing earlier evidence',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    await store.upsertUser({id:'payer',login:'payer'});
    await ensureUserWorkspaces(sql,'payer');
    const [workspace]=await listUserWorkspaces(sql,'payer');
    await store.upsertInstallation({id:91,accountId:91,accountLogin:'connected',accountType:'User'});
    await store.linkUserInstallation(91,'payer');
    // A GitHub connection attached to an existing personal workspace keeps its personal payer.
    await sql.query('UPDATE product_workspace_installations SET workspace_id=$1,explicitly_assigned=true WHERE installation_id=91',[workspace.id]);
    const {readFile}=await import('node:fs/promises');
    const {scan}=await import('../src/scanner/index.ts');
    const {verifyReceipt}=await import('../src/receipt.ts');
    const bytes=await readFile('fixtures/clean.tgz');
    const input={userId:'payer',installationId:91,workspaceId:workspace.id,target:'clean.tgz',bytes};
    await sql.query("UPDATE billing_accounts SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE installation_id=91");
    const id=crypto.randomUUID();
    await store.queueUploadedScan({...input,id});
    expect(await store.getUploadedScan('payer',id)).toMatchObject({billing_installation_id:null,billing_user_id:'payer',installation_id:91});
    await processUploadedScan(id,store,scan,'payer-receipt-secret');
    const saved=await store.getUploadedScan('payer',id);
    expect(saved?.status).toBe('done');
    expect(saved?.revision_id).not.toBeNull();
    expect(saved?.receipt_id).not.toBeNull();
    expect(verifyReceipt(JSON.stringify(saved?.receipt_json),'payer-receipt-secret').ok).toBe(true);
    expect((await sql.query('SELECT scans FROM personal_scan_usage WHERE user_id=$1',['payer'])).rows).toEqual([{scans:1}]);
    expect((await sql.query('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=91')).rows).toHaveLength(0);
    const deniedId=crypto.randomUUID();
    await store.queueUploadedScan({...input,id:deniedId});
    await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='payer'");
    await sql.query("UPDATE billing_accounts SET plan='team' WHERE installation_id=91");
    let parses=0;
    await processUploadedScan(deniedId,store,async()=>{parses++;throw new Error('Expired payer must not reach parser');},'payer-receipt-secret');
    expect(parses).toBe(0);
    expect(await store.getUploadedScan('payer',deniedId)).toMatchObject({status:'failed',receipt_json:null,report_json:null});
    expect((await sql.query('SELECT scans FROM personal_scan_usage WHERE user_id=$1',['payer'])).rows).toEqual([{scans:1}]);
    expect((await store.getUploadedScan('payer',id))?.receipt_json).toEqual(saved?.receipt_json);
  }finally{await sql.close();}
});
