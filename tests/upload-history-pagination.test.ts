import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';

it('pages the whole scoped history deterministically and filters before paging',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
    const [workspace]=await listUserWorkspaces(sql,'owner');
    const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
    await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,created_at)
      SELECT 'scan-'||lpad(n::text,3,'0'),'owner',$1,'artifact.zip','hash','failed','2026-01-01T00:00:00.000001Z' FROM generate_series(1,55) n`,[workspace.id]);
    await sql.query(`UPDATE uploaded_scans SET status='done',report_json='{"ok":true,"status":"passed"}'::jsonb WHERE id='scan-001'`);
    await sql.query(`UPDATE uploaded_scans SET status='done',report_json='{"ok":true,"status":"inconclusive"}'::jsonb WHERE id='scan-002'`);
    const first=await store.listUploadedScanPage('owner',undefined,workspace.id);
    expect(first.uploads).toHaveLength(50);expect(first.nextCursor).toBe('scan-006');
    await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status) VALUES('new','owner',$1,'new.zip','hash','failed')`,[workspace.id]);
    const second=await store.listUploadedScanPage('owner',undefined,workspace.id,{before:first.nextCursor!});
    expect(second.uploads.map(row=>row.id)).toEqual(['scan-005','scan-004','scan-003','scan-002','scan-001']);expect(second.nextCursor).toBeNull();
    expect((await store.listUploadedScanPage('owner',undefined,workspace.id,{status:'passed'})).uploads.map(row=>row.id)).toEqual(['scan-001']);
    expect((await store.listUploadedScanPage('owner',undefined,workspace.id,{collection:'uploads'})).uploads.map(row=>row.id)).toEqual(['scan-002','scan-001']);
    expect((await store.listUploadedScanPage('owner',undefined,workspace.id,{collection:'attempts'})).uploads).toHaveLength(50);
    expect((await store.listUploadedScanPage('owner',undefined,workspace.id,{before:first.nextCursor!,status:'attention'})).uploads.map(row=>row.id)).toEqual(['scan-005','scan-004','scan-003','scan-002']);
    await expect(store.listUploadedScanPage('owner',undefined,other.id,{before:first.nextCursor!})).rejects.toMatchObject({status:404});
    await expect(store.listUploadedScanPage('stranger',undefined,workspace.id,{before:first.nextCursor!})).rejects.toMatchObject({status:404});
    await expect(store.listUploadedScanPage('owner',undefined,workspace.id,{status:'invalid'})).rejects.toMatchObject({status:400});
  }finally{await sql.close();}
});

it('loads 10, 30 or 60 matching builds across the whole authorised history without a false final cursor',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');
  const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,created_at)
   SELECT 'scan-'||lpad(n::text,3,'0'),'owner',$1,
    CASE WHEN n<=60 THEN 'Needle Only60 build-'||n||'.zip' WHEN n<=75 THEN 'Needle build-'||n||'.zip' ELSE 'Other build-'||n||'.zip' END,
    'hash','failed',now()-interval '1 day' FROM generate_series(1,120) n`,[workspace.id]);
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status) VALUES('foreign','owner',$1,'Needle foreign.zip','hash','failed')",[other.id]);
  for(const pageSize of [10,30,60]){
   let before:string|undefined;const ids:string[]=[];
   do{
    const page=await store.listUploadedScanPage('owner',undefined,workspace.id,{pageSize,query:' nEeDlE ',before});
    expect(page.uploads.length).toBeLessThanOrEqual(pageSize);
    expect(page.uploads.every(row=>row.target.startsWith('Needle'))).toBe(true);
    ids.push(...page.uploads.map(row=>row.id));before=page.nextCursor??undefined;
   }while(before);
   expect(ids).toHaveLength(75);expect(new Set(ids).size).toBe(75);expect(ids).not.toContain('foreign');
  }
  const exactly=await store.listUploadedScanPage('owner',undefined,workspace.id,{pageSize:60,query:'Only60'});
  expect(exactly.uploads).toHaveLength(60);expect(exactly.nextCursor).toBeNull();
  await expect(store.listUploadedScanPage('owner',undefined,workspace.id,{pageSize:10,before:'foreign'})).rejects.toMatchObject({status:404});
  await expect(store.listUploadedScanPage('owner',undefined,workspace.id,{query:'x'.repeat(201)})).rejects.toMatchObject({status:400});
 }finally{await sql.close();}
});
