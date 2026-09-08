import {it,expect,vi} from 'vitest';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {createWorkspaceOrigin,verifyWorkspaceOrigin,changeWorkspaceOrigin} from '../src/server/workspace-origins.ts';
import {setWorkspaceOriginSchedule,runWorkspaceOriginPoll} from '../src/server/workspace-origin-schedule.ts';
import {processUploadedScan} from '../src/server/upload-worker.ts';
import {scan} from '../src/scanner/index.ts';

async function fixture(){
 const sql=await openSql('pglite://:memory:');await migrate(sql);const store=createStore(sql);
 await store.upsertUser({id:'owner',login:'owner'});await ensureUserWorkspaces(sql,'owner');
 const workspace=(await listUserWorkspaces(sql,'owner'))[0];
 const source=await createWorkspaceOrigin(sql,'owner',workspace.id,'https://example.com');
 const due=()=>sql.query("UPDATE watched_origins SET next_check_at=now()-interval '1 minute' WHERE id=$1",[source.id]);
 const verify=()=>verifyWorkspaceOrigin(sql,'owner',workspace.id,source.id,'dns',async(_h,_t,method)=>({method,detail:'matched'}));
 return {sql,store,workspace,source,due,verify};
}
it('defaults to manual, requires ownership, and admits each due window once against the existing payer',async()=>{
 const {sql,store,workspace,source,due,verify}=await fixture();try{
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0});
  await expect(setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,6)).rejects.toMatchObject({status:409});
  await verify();await setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,6);
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0});
  await due();
  await sql.query("UPDATE watched_origins SET next_check_at=date_trunc('second',next_check_at)+interval '0.123456 seconds'");
  const results=await Promise.all([runWorkspaceOriginPoll({store}),runWorkspaceOriginPoll({store})]);
  expect(results.reduce((sum,row)=>sum+row.queued,0)).toBe(1);
  expect((await sql.query('SELECT billing_user_id,installation_id,kind FROM jobs')).rows).toEqual([{billing_user_id:'owner',installation_id:null,kind:'workspace_origin_scan'}]);
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:1}]);
  expect((await sql.query('SELECT next_check_at>now() AS future,schedule_error FROM watched_origins')).rows).toEqual([{future:true,schedule_error:null}]);
  await due();expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0}); // active scan never overlaps
  expect((await sql.query('SELECT * FROM jobs')).rows).toHaveLength(1);
 }finally{await sql.close();}
});
it('stops on pause, revocation and disconnect; disabling cancels queued scheduled work before crawling and refunds once',async()=>{
 const {sql,store,workspace,source,due,verify}=await fixture();try{
  await verify();await setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,24);await due();
  await changeWorkspaceOrigin(sql,'owner',workspace.id,source.id,'pause');expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0});
  await changeWorkspaceOrigin(sql,'owner',workspace.id,source.id,'resume');
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0});
  expect((await sql.query<{schedule_error:string}>('SELECT schedule_error FROM watched_origins')).rows[0].schedule_error).toContain('access');
  await sql.query('DELETE FROM product_workspace_revocations WHERE workspace_id=$1',[workspace.id]);
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:1});
  const id=(await sql.query<{id:string}>('SELECT id FROM uploaded_scans')).rows[0].id;
  await setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,0);
  const fetch=vi.fn();await processUploadedScan(id,store,scan,'test',undefined,{fetch});
  expect(fetch).not.toHaveBeenCalled();expect((await store.getUploadedScan('owner',id))?.status).toBe('failed');
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:0}]);
  await processUploadedScan(id,store,scan,'test',undefined,{fetch});
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:0}]);
  await setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,6);
  await changeWorkspaceOrigin(sql,'owner',workspace.id,source.id,'disconnect',source.origin_url);
  await changeWorkspaceOrigin(sql,'owner',workspace.id,source.id,'reconnect');
  expect((await sql.query('SELECT schedule_hours,next_check_at FROM watched_origins')).rows).toEqual([{schedule_hours:0,next_check_at:null}]);
 }finally{await sql.close();}
});
it('persists scheduled results and rejects viewers, foreign workspaces and exhausted coverage',async()=>{
 const {sql,store,workspace,source,due,verify}=await fixture();try{
  await verify();await store.upsertUser({id:'viewer',login:'viewer'});
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  await expect(setWorkspaceOriginSchedule(sql,'viewer',workspace.id,source.id,24)).rejects.toMatchObject({status:403});
  await expect(setWorkspaceOriginSchedule(sql,'owner','00000000-0000-0000-0000-000000000000',source.id,24)).rejects.toMatchObject({status:403});
  await setWorkspaceOriginSchedule(sql,'owner',workspace.id,source.id,24);await due();
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:1});
  const id=(await sql.query<{id:string}>('SELECT id FROM uploaded_scans')).rows[0].id;
  await expect(sql.query('UPDATE uploaded_scans SET source_schedule_version=999 WHERE id=$1',[id])).rejects.toThrow('immutable');
  await processUploadedScan(id,store,scan,'test',undefined,{lookup:async()=>[{address:'1.1.1.1',family:4}],fetch:async url=>String(url)==='https://example.com/'?new Response('<html>Hello</html>',{headers:{'content-type':'text/html'}}):new Response('missing',{status:404})});
  expect((await store.getUploadedScan('owner',id))?.status).toBe('done');
  expect((await store.getUploadedScan('owner',id))?.receipt_json).toBeTruthy();
  await due();await sql.query("UPDATE users SET trial_ends_at=now()-interval '1 day',plan=NULL WHERE id='owner'");
  expect(await runWorkspaceOriginPoll({store})).toEqual({queued:0});
  expect((await sql.query('SELECT scans FROM personal_scan_usage')).rows).toEqual([{scans:1}]);
  expect((await sql.query<{schedule_error:string}>('SELECT schedule_error FROM watched_origins')).rows[0].schedule_error).toContain('allowance');
 }finally{await sql.close();}
});
