import {it,expect} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {createGithubConnectionIntent as create,consumeGithubConnectionIntent as consume} from '../src/server/github-connection-intents.ts';

async function fixture(run:(sql:SqlClient,session:string,workspace:string,organization:string)=>Promise<void>){
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);await store.upsertUser({id:'owner',login:'owner'});
  const session=await store.createSession('owner');const workspace=(await listUserWorkspaces(sql,'owner'))[0];
  await run(sql,session,workspace.id,workspace.organization_id);
 }finally{await sql.close();}
}
it('stores only a token hash, binds one session and atomically consumes once',async()=>fixture(async(sql,session,workspace,organization)=>{
 const intent=await create(sql,session,'owner',workspace);
 expect(JSON.stringify((await sql.query('SELECT * FROM github_connection_intents')).rows)).not.toContain(intent.token);
 const otherSession=await createStore(sql).createSession('owner');
 await expect(consume(sql,otherSession,'owner',intent.token,async()=>true)).rejects.toMatchObject({status:403});
 const result=await consume(sql,session,'owner',intent.token,async(_tx,target)=>target);
 expect(result).toEqual({workspaceId:workspace,organizationId:organization,userId:'owner'});
 await expect(consume(sql,session,'owner',intent.token,async()=>true)).rejects.toMatchObject({status:403});
 const concurrent=await create(sql,session,'owner',workspace);let bindings=0;
 const outcomes=await Promise.allSettled([1,2].map(()=>consume(sql,session,'owner',concurrent.token,async()=>++bindings)));
 expect(outcomes.filter(row=>row.status==='fulfilled')).toHaveLength(1);expect(bindings).toBe(1);
 await expect(create(sql,session,'someone-else',workspace)).rejects.toMatchObject({status:403});
}));
it('replaces pending requests and rolls back consumption with a failed binding',async()=>fixture(async(sql,session,workspace)=>{
 const old=await create(sql,session,'owner',workspace),current=await create(sql,session,'owner',workspace);
 await expect(consume(sql,session,'owner',old.token,async()=>true)).rejects.toMatchObject({status:403});
 await expect(consume(sql,session,'owner',current.token,async tx=>{
  await tx.query("UPDATE product_workspaces SET name='should roll back' WHERE id=$1",[workspace]);throw new Error('binding failed');
 })).rejects.toThrow('binding failed');
 expect((await sql.query('SELECT name FROM product_workspaces WHERE id=$1',[workspace])).rows[0]).not.toEqual({name:'should roll back'});
 expect(await consume(sql,session,'owner',current.token,async()=>true)).toBe(true);
}));
it('rejects expiry, session revocation, archived destinations and lost authority',async()=>fixture(async(sql,session,workspace,organization)=>{
 const expired=await create(sql,session,'owner',workspace);
 await sql.query("UPDATE github_connection_intents SET created_at=now()-interval '20 minutes',expires_at=now()-interval '1 minute'");
 await expect(consume(sql,session,'owner',expired.token,async()=>true)).rejects.toMatchObject({status:403});
 const archived=await create(sql,session,'owner',workspace);
 await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace]);
 await expect(consume(sql,session,'owner',archived.token,async()=>true)).rejects.toMatchObject({status:403});
 await expect(create(sql,session,'owner',workspace)).rejects.toMatchObject({status:403});
 await sql.query('UPDATE product_workspaces SET archived_at=NULL WHERE id=$1',[workspace]);
 await sql.query("UPDATE product_workspace_members SET role='viewer' WHERE workspace_id=$1",[workspace]);
 await expect(consume(sql,session,'owner',archived.token,async()=>true)).rejects.toMatchObject({status:403});
 await sql.query("UPDATE product_workspace_members SET role='owner' WHERE workspace_id=$1",[workspace]);
 await sql.query("DELETE FROM product_organization_members WHERE organization_id=$1 AND user_id='owner'",[organization]);
 await expect(consume(sql,session,'owner',archived.token,async()=>true)).rejects.toMatchObject({status:403});
 await sql.query('DELETE FROM sessions WHERE id=$1',[session]);
 await expect(consume(sql,session,'owner',archived.token,async()=>true)).rejects.toMatchObject({status:403});
 expect((await sql.query('SELECT * FROM github_connection_intents')).rows).toHaveLength(0);
}));
