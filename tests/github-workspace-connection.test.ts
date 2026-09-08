import {it,expect} from 'vitest';
import {openSql,migrate,type SqlClient} from '../src/server/sql.ts';
import {createStore,type Store} from '../src/server/store.ts';
import {listUserWorkspaces,ensureUserWorkspaces,uploadWorkspaceScope} from '../src/server/workspaces.ts';
import {createGithubConnectionIntent,inspectGithubConnectionIntent} from '../src/server/github-connection-intents.ts';
import {stageUnboundGithubEvent} from '../src/server/github-pending-events.ts';
import {connectGithubWorkspace} from '../src/server/github-workspace-connection.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import type {GithubPort} from '../src/server/github.ts';

async function fixture(run:(ctx:{sql:SqlClient;store:Store;session:string;workspace:string;token:string;github:GithubPort;payload:Record<string,unknown>})=>Promise<void>){
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql,{tokenSecret:'secret'});
  await store.upsertUser({id:'owner',login:'owner',accessToken:'github-token'});
  const session=await store.createSession('owner'),workspace=(await listUserWorkspaces(sql,'owner'))[0].id;
  const {token}=await createGithubConnectionIntent(sql,session,'owner',workspace);
  const installation={id:999,account:{id:77,login:'github-owner',type:'User'},created_at:new Date().toISOString(),suspended_at:null,app_id:1};
  const repo={id:88,name:'project',full_name:'github-owner/project',owner:{login:'github-owner'},private:true,html_url:'https://github.com/github-owner/project'};
  const github:GithubPort={...stubGithub(),getUser:async()=>({id:77,login:'github-owner',avatar_url:''}),listUserInstallations:async()=>[999],getInstallation:async()=>installation,listInstallationRepositories:async()=>[repo]};
  await run({sql,store,session,workspace,token,github,payload:{action:'created',installation,sender:{id:77},repositories:[repo]}});
 }finally{await sql.close();}
}
it('waits for a signed creation event then atomically binds and queues without a second trial',async()=>fixture(async ctx=>{
 const input={store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'};
 expect((await connectGithubWorkspace(input)).status).toBe('awaiting_webhook');
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',ctx.payload);
 expect(await connectGithubWorkspace(input)).toMatchObject({status:'connected',workspaceId:ctx.workspace,repositoryCount:1,queued:1});
 expect((await ctx.sql.query('SELECT * FROM billing_accounts')).rows).toHaveLength(0);
 expect((await ctx.sql.query('SELECT installation_id,billing_user_id FROM jobs')).rows).toEqual([{installation_id:999,billing_user_id:'owner'}]);
 expect((await ctx.sql.query('SELECT count(*)::int AS n FROM product_organizations')).rows[0]).toEqual({n:1});
 await ensureUserWorkspaces(ctx.sql,'owner');
 await uploadWorkspaceScope(ctx.sql,'owner',999,ctx.workspace);
 expect((await ctx.sql.query('SELECT count(*)::int AS n FROM product_organizations')).rows[0]).toEqual({n:1});
 await expect(connectGithubWorkspace(input)).rejects.toMatchObject({status:403});
}));
it('supports webhook-first and refuses to bind into a revoked workspace',async()=>fixture(async ctx=>{
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',ctx.payload);
 await ctx.sql.query("UPDATE product_workspace_members SET role='viewer' WHERE workspace_id=$1",[ctx.workspace]);
 await expect(connectGithubWorkspace({store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'})).rejects.toMatchObject({status:403});
 expect((await ctx.sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
}));
it('retries a changed inventory without consuming the request or persisting partial ownership',async()=>fixture(async ctx=>{
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',ctx.payload);
 const list=ctx.github.listInstallationRepositories!;
 ctx.github.listInstallationRepositories=async id=>{
  await stageUnboundGithubEvent(ctx.sql,'secret','installation_repositories','new-repos',{installation:{id:999},action:'added',repositories_added:[]});return list(id);
 };
 await expect(connectGithubWorkspace({store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'})).rejects.toMatchObject({status:409});
 expect((await ctx.sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
 expect((await inspectGithubConnectionIntent(ctx.sql,ctx.session,'owner',ctx.token)).workspaceId).toBe(ctx.workspace);
}));
it('refuses mismatched app proof and preserves existing foreign repository ownership',async()=>fixture(async ctx=>{
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',ctx.payload);
 await ctx.store.upsertInstallation({id:7,accountId:7,accountLogin:'other',accountType:'User'});
 await ctx.store.upsertRepo({id:88,installationId:7,owner:'other',name:'project',fullName:'other/project',private:true,htmlUrl:'https://github.com/other/project'});
 const input={store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'};
 await expect(connectGithubWorkspace(input)).rejects.toMatchObject({status:409});
 expect((await ctx.sql.query('SELECT installation_id FROM repos WHERE id=88')).rows[0]).toEqual({installation_id:7});
 await expect(connectGithubWorkspace({...input,appId:'different-app'})).rejects.toMatchObject({status:409});
}));
it('does not resurrect a repository absent from the final provider inventory',async()=>fixture(async ctx=>{
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',ctx.payload);
 ctx.github.listInstallationRepositories=async()=>[];
 const result=await connectGithubWorkspace({store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'});
 expect(result).toMatchObject({status:'connected',repositoryCount:0,queued:0});
 expect((await ctx.sql.query('SELECT * FROM repos')).rows).toHaveLength(0);
 expect((await ctx.sql.query('SELECT * FROM jobs')).rows).toHaveLength(0);
 expect((await ctx.sql.query<{replayed_at:unknown}>('SELECT replayed_at FROM github_pending_events')).rows[0].replayed_at).not.toBeNull();
}));
it('rejects creation proof predating the connection intent',async()=>fixture(async ctx=>{
 const old={...(ctx.payload.installation as object),created_at:'2020-01-01T00:00:00.000Z'};
 await stageUnboundGithubEvent(ctx.sql,'secret','installation','creation',{...ctx.payload,installation:old});
 await expect(connectGithubWorkspace({store:ctx.store,github:ctx.github,sessionId:ctx.session,userId:'owner',token:ctx.token,installationId:999,appId:'1',secret:'secret'})).rejects.toMatchObject({status:409});
 expect((await ctx.sql.query('SELECT * FROM installations')).rows).toHaveLength(0);
}));
