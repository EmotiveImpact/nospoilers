import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {workspaceOverview} from '../src/server/workspace-overview.ts';
import {createWorkspaceOrigin} from '../src/server/workspace-origins.ts';

it('counts beyond the first page and keeps missing/inconclusive evidence out of passed',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  const [workspace]=await listUserWorkspaces(sql,'owner');const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other');
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status) SELECT 'scan-'||n,'owner',$1,'artifact.zip','hash','failed' FROM generate_series(1,55) n`,[workspace.id]);
  await sql.query(`UPDATE uploaded_scans SET status='done',report_json='{"ok":true,"status":"passed"}' WHERE id='scan-1'`);
  await sql.query(`UPDATE uploaded_scans SET status='done',report_json='{"ok":true,"status":"inconclusive"}' WHERE id='scan-2'`);
  await sql.query(`UPDATE uploaded_scans SET status='done' WHERE id='scan-3'`);
  await sql.query(`UPDATE uploaded_scans SET status='running' WHERE id='scan-4'`);
  await sql.query(`UPDATE uploaded_scans SET status='done',report_json='{"ok":true,"status":"unsupported"}' WHERE id='scan-5'`);
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status) VALUES('foreign','owner',$1,'other.zip','hash','queued')`,[other.id]);
  const overview=await workspaceOverview(sql,'owner',workspace.id);
  expect(overview.counts).toEqual({total:55,active:1,attention:53,passed:1});
  expect(overview.recent).toHaveLength(5);expect(overview.recent.some(row=>row.id==='foreign')).toBe(false);
  expect(overview.recent.every(row=>row.source_kind==='artifact')).toBe(true);
  const source=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
  await createWorkspaceOrigin(sql,'owner',other.id,'https://other.example.com');
  await sql.query("UPDATE watched_origins SET verified_at=now(),last_checked_at=now()-interval '2 days',last_scan_status='passed',schedule_hours=6,next_check_at=now()-interval '1 hour' WHERE id=$1",[source.id]);
  const withWebsite=await workspaceOverview(sql,'owner',workspace.id);
  expect(withWebsite.websiteCoverage).toEqual({total:1,attention:1,delayed:1,unverified:0,unchecked:0});
  expect(withWebsite.counts).toEqual(overview.counts);
  expect(withWebsite.alertCounts).toEqual({open:0,waiting:0,done:0,mine:0});
  await sql.query("INSERT INTO uploaded_scans(id,user_id,workspace_id,source_origin_id,target,artifact_sha256,status,report_json) VALUES('website-evidence','owner',$1,$2,'https://example.com/','hash','done','{}')",[workspace.id,source.id]);
  const alert=(await sql.query<{id:number}>("INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body,assigned_to_user_id) VALUES($1,$2,'website-evidence','web_origin_scan','Exposure','Evidence','owner') RETURNING id",[workspace.id,source.id])).rows[0];
  expect((await workspaceOverview(sql,'owner',workspace.id)).alertCounts).toEqual({open:1,waiting:0,done:0,mine:1});
  expect((await workspaceOverview(sql,'owner',other.id)).alertCounts).toEqual({open:0,waiting:0,done:0,mine:0});
  await sql.query('UPDATE alerts SET acknowledged_at=now() WHERE id=$1',[alert.id]);
  expect((await workspaceOverview(sql,'owner',workspace.id)).alertCounts).toEqual({open:0,waiting:1,done:0,mine:1});
  await sql.query('UPDATE alerts SET resolved_at=now() WHERE id=$1',[alert.id]);
  const resolved=await workspaceOverview(sql,'owner',workspace.id);
  expect(resolved.alertCounts).toEqual({open:0,waiting:0,done:1,mine:0});
  expect(resolved.counts.attention).toBe(54); // Response does not change failed scan history.
  await expect(workspaceOverview(sql,'stranger',workspace.id)).rejects.toMatchObject({status:404});
 }finally{await sql.close();}
});
