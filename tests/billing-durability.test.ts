import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {createWorkspace,listUserWorkspaces} from '../src/server/workspaces.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';

it('retains organisation billing, usage and independent artifact work when GitHub disconnects',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    await store.upsertUser({id:'owner',login:'owner'});
    const installation={id:81,accountId:81,accountLogin:'org',accountType:'Organization'};
    await store.upsertInstallation(installation);await store.linkUserInstallation(81,'owner');
    const original=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===81)!;
    const workspace=await createWorkspace(sql,'owner',original.organization_id,'Artifacts');
    const id=crypto.randomUUID();
    await store.queueUploadedScan({id,userId:'owner',installationId:null,workspaceId:workspace.id,target:'x.zip',bytes:new Uint8Array([1])});
    const sourceUpload=crypto.randomUUID();
    await store.queueUploadedScan({id:sourceUpload,userId:'owner',installationId:81,workspaceId:original.id,target:'source.zip',bytes:new Uint8Array([1])});
    const token=await store.insertScanApiToken({installationId:81,name:'CI',createdByLogin:'owner'});
    await store.insertAuditEvent({installationId:81,actorLogin:'owner',action:'billing.portal',summary:'Existing history',targetKind:'billing',targetId:'portal'});
    const before=(await sql.query('SELECT organization_id,trial_ends_at,plan FROM billing_accounts WHERE installation_id=81')).rows;
    await store.deleteInstallation(81);
    expect(await store.getInstallation(81)).toMatchObject({suspended:true});
    expect((await sql.query('SELECT disconnected_at FROM installations WHERE id=81')).rows[0]).toMatchObject({disconnected_at:expect.anything()});
    expect((await sql.query('SELECT organization_id,trial_ends_at,plan FROM billing_accounts WHERE installation_id=81')).rows).toEqual(before);
    expect((await sql.query('SELECT heavy_jobs FROM hosted_usage_days WHERE installation_id=81')).rows).toEqual([{heavy_jobs:2}]);
    expect((await store.getUploadedScan('owner',sourceUpload))?.status).toBe('failed');
    expect(await store.authenticateScanToken(token.token)).toBeNull();
    expect((await sql.query('SELECT summary FROM audit_events WHERE installation_id=81')).rows).toEqual([{summary:'Existing history'}]);
    expect((await store.listInstallationsForUser('owner'))[0].disconnectedAt).toBeTruthy();
    const job=await store.claimJob('heavy',2,'billing-test');expect(job?.kind).toBe('uploaded_scan');
    await processUploadedScan(id,store,async()=>({target:'x.zip',kind:'zip',fileCount:1,findings:[],ok:true,status:'passed',scannedAt:new Date().toISOString(),inconclusiveReason:null,manifest:[],engineVersion:'test',artifactSha256:null,artifactSha512:null,artifactBytes:1,suppressed:[],policyHash:null}),'test-secret');
    expect((await store.getUploadedScan('owner',id))?.status).toBe('done');
    await store.upsertInstallation({...installation,suspended:false});
    expect(await store.installationWorkAllowed(81)).toBe(false);
    await store.upsertInstallation({...installation,suspended:false,reconnect:true});
    expect((await store.listInstallationsForUser('owner'))[0].disconnectedAt).toBeNull();
    expect(await store.authenticateScanToken(token.token)).toBeNull();
    expect((await sql.query('SELECT organization_id,trial_ends_at,plan FROM billing_accounts WHERE installation_id=81')).rows).toEqual(before);
    await expect(sql.query('UPDATE billing_accounts SET installation_id=82 WHERE installation_id=81')).rejects.toThrow('immutable');
    await migrate(sql);
  }finally{await sql.close();}
});
