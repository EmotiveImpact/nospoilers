import {randomUUID} from 'node:crypto';
import type {GithubPort} from './github.ts';
import {createStore,type Store} from './store.ts';
import {inspectGithubConnectionIntent,consumeGithubConnectionIntent} from './github-connection-intents.ts';
import {pendingGithubEvents} from './github-pending-events.ts';
import {enqueueFromWebhook} from './webhooks.ts';

function fail(message:string,status=403):never{throw Object.assign(new Error(message),{status});}
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

export type ConnectableGithubInstallation={installationId:number;accountLogin:string;accountType:'User'};

/** Discover only unbound personal installations whose GitHub account is the
 * current OAuth user. Repository access alone is insufficient proof for an
 * organisation installation, so those continue through GitHub's install flow. */
export async function connectablePersonalGithubInstallations(input:{store:Store;github:GithubPort;userId:string}):Promise<ConnectableGithubInstallation[]>{
 const accessToken=await input.store.getUserAccessToken(input.userId);
 if(!accessToken)fail('Sign in with GitHub again before connecting a source.',401);
 const actor=await input.github.getUser(accessToken);
 const installationIds=await input.github.listUserInstallations(accessToken);
 const rows:ConnectableGithubInstallation[]=[];
 for(const installationId of installationIds){
  if(!Number.isSafeInteger(installationId)||installationId<=0)continue;
  if((await input.store.sql.query('SELECT 1 FROM installations WHERE id=$1',[installationId])).rows.length)continue;
  const installation=await input.github.getInstallation(installationId);
  const accountType=installation.account.type??'User';
  if(installation.id===installationId&&!installation.suspended_at&&accountType==='User'&&installation.account.id===actor.id)
   rows.push({installationId,accountLogin:installation.account.login,accountType:'User'});
 }
 return rows.sort((a,b)=>a.accountLogin.localeCompare(b.accountLogin)||a.installationId-b.installationId);
}

/** Bind either a newly created installation or an explicitly selected,
 * unbound personal installation owned by the current GitHub OAuth user.
 * Existing tenant ownership is never reassigned. */
export async function connectGithubWorkspace(input:{store:Store;github:GithubPort;sessionId:string;userId:string;token:string;installationId:number;appId:string;secret:string;mode?:'new'|'existing-personal'}){
 const {store,github,sessionId,userId,token,installationId,secret}=input;
 if(!Number.isSafeInteger(installationId)||installationId<=0)fail('Invalid installation.',400);
 const intent=await inspectGithubConnectionIntent(store.sql,sessionId,userId,token);
 const accessToken=await store.getUserAccessToken(userId);
 if(!accessToken)fail('Sign in with GitHub again before connecting a source.',401);
 const actor=await github.getUser(accessToken);
 // Product authentication remains separate: never replace the current session.
 if(!(await github.listUserInstallations(accessToken)).includes(installationId))fail('This GitHub account cannot access that installation.');
 const installation=await github.getInstallation(installationId);
 if(installation.id!==installationId||installation.suspended_at)fail('The GitHub installation is unavailable or suspended.');
 if((await store.sql.query('SELECT 1 FROM installations WHERE id=$1',[installationId])).rows.length)
  fail('This installation already belongs to a connection. Open its existing workspace; it cannot be moved here.',409);
 const events=await pendingGithubEvents(store.sql,secret,installationId);
 if(input.mode==='existing-personal'){
  if((installation.account.type??'User')!=='User'||installation.account.id!==actor.id)
   fail('Only an unbound personal GitHub installation owned by the signed-in GitHub account can be reconnected.',403);
 }else{
  const proof=events.find(row=>row.event==='installation'&&row.payload.action==='created'&&String(object(row.payload.sender).id)===String(actor.id));
  if(!proof)return {status:'awaiting_webhook' as const,workspaceId:intent.workspaceId};
  const creation=object(proof.payload.installation);
  const created=Date.parse(String(creation.created_at));
  if(String(creation.app_id)!==input.appId||Number(creation.id)!==installationId||Number(object(creation.account).id)!==installation.account.id||
     !Number.isFinite(created)||created<Date.parse(intent.createdAt)-2000||Date.parse(proof.receivedAt)<Date.parse(intent.createdAt)||
     Date.parse(installation.created_at??'')!==created)
   fail('A new installation authorised during this connection request is required. Existing installations keep their current ownership.',409);
 }
 if(events.some(row=>row.event==='installation'&&['deleted','suspend'].includes(String(row.payload.action))))fail('The installation changed or was disabled. Start again.',409);
 if(!github.listInstallationRepositories)fail('GitHub repository listing is unavailable on this server.',503);
 const repositories=await github.listInstallationRepositories(installationId);
 return consumeGithubConnectionIntent(store.sql,sessionId,userId,token,async(tx,target)=>{
  await tx.query('LOCK TABLE github_pending_events IN SHARE ROW EXCLUSIVE MODE');
  const current=await pendingGithubEvents(tx,secret,installationId);
  if(current.length!==events.length||current.some((row,i)=>row.deliveryId!==events[i].deliveryId))fail('GitHub changed during connection. Retry to refresh its repository list.',409);
  if((await tx.query('SELECT 1 FROM installations WHERE id=$1',[installationId])).rows.length)fail('This installation was already connected.',409);
  await tx.query('LOCK TABLE repos IN SHARE ROW EXCLUSIVE MODE');
  const repositoryIds=new Set(repositories.map(repo=>repo.id));
  for(const row of events){
   const candidates=[row.payload.repository,...['repositories','repositories_added','repositories_removed'].flatMap(key=>Array.isArray(row.payload[key])?row.payload[key] as unknown[]:[])];
   for(const repo of candidates){const id=Number(object(repo).id);if(Number.isSafeInteger(id)&&id>0)repositoryIds.add(id);}
  }
  for(const id of repositoryIds){
   if((await tx.query('SELECT 1 FROM repos WHERE id=$1 AND installation_id<>$2',[id,installationId])).rows.length)fail('A repository already has evidence in another connection. It cannot be moved automatically.',409);
  }
  await tx.query(`INSERT INTO installations(id,account_id,account_login,account_type,suspended) VALUES($1,$2,$3,$4,false)`,[installationId,installation.account.id,installation.account.login,installation.account.type??'User']);
  // Freeze effective legacy roles before the new explicitly assigned source reads
  // product membership. Missing legacy access stays revoked, never resurrected.
  await tx.query(`INSERT INTO product_workspace_revocations(workspace_id,user_id)
    SELECT m.workspace_id,m.user_id FROM product_workspace_members m JOIN product_workspaces w ON w.id=m.workspace_id
    JOIN product_organizations o ON o.id=w.organization_id
    WHERE w.id=$1 AND m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM installation_users l WHERE l.installation_id=o.legacy_installation_id AND l.user_id=m.user_id)
    ON CONFLICT DO NOTHING`,[target.workspaceId]);
  await tx.query(`UPDATE product_workspace_members m SET role=l.role,access_source='explicit'
    FROM product_workspaces w,product_organizations o,installation_users l
    WHERE m.workspace_id=$1 AND w.id=m.workspace_id AND o.id=w.organization_id AND m.access_source='legacy'
    AND l.installation_id=o.legacy_installation_id AND l.user_id=m.user_id`,[target.workspaceId]);
  await tx.query('INSERT INTO product_workspace_installations(installation_id,workspace_id,explicitly_assigned) VALUES($1,$2,true)',[installationId,target.workspaceId]);
  await tx.query(`INSERT INTO installation_users(installation_id,user_id,role)
    SELECT $1,m.user_id,CASE WHEN m.role='owner' THEN 'admin' ELSE m.role END FROM product_workspace_members m
    WHERE m.workspace_id=$2 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=m.workspace_id AND r.user_id=m.user_id)`,[installationId,target.workspaceId]);
  const bound=createStore(tx,{tokenSecret:secret});
  const accessibleIds=new Set(repositories.map(repo=>repo.id));
  // Replay retained deliveries only after workspace ownership and access exist.
  for(const row of events){
   // The complete provider inventory is authoritative at first binding. Earlier
   // deliveries may describe repositories removed before this connection finished.
   // Keep their signed inbox record, but do not create sources or scan jobs for them.
   const repositoryId=Number(object(row.payload.repository).id);
   if(!repositoryId||accessibleIds.has(repositoryId)){
    const payload={...row.payload};
    for(const key of ['repositories','repositories_added','repositories_removed']){
     if(Array.isArray(payload[key]))payload[key]=(payload[key] as unknown[]).filter(repo=>accessibleIds.has(Number(object(repo).id)));
    }
    await enqueueFromWebhook(bound,row.event,row.deliveryId,payload);
   }
   await tx.query('UPDATE github_pending_events SET replayed_at=now() WHERE delivery_id=$1',[row.deliveryId]);
  }
  let queued=0;
  for(const repo of repositories){
   await bound.upsertRepo({id:repo.id,installationId,owner:repo.owner.login,name:repo.name,fullName:repo.full_name,private:repo.private,htmlUrl:repo.html_url});
   if(await bound.installationWorkAllowed(installationId)){
    const job=await bound.enqueueJob({installationId,priority:'heavy',kind:'scan_latest_release',deliveryId:`first-connection:${installationId}:${repo.id}`,
      payload:{installationId,repo:{id:repo.id,owner:repo.owner.login,name:repo.name,fullName:repo.full_name,private:repo.private,htmlUrl:repo.html_url}}});
    if(job.inserted)queued++;
   }
  }
  await tx.query(`INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action,detail) VALUES($1,$2,$3,'github_connected',$4::jsonb)`,[randomUUID(),target.workspaceId,userId,JSON.stringify({installationId,repositoryCount:repositories.length,queued,connectionMode:input.mode==='existing-personal'?'existing-personal':'new'})]);
  return {status:'connected' as const,workspaceId:target.workspaceId,installationId,repositoryCount:repositories.length,queued};
 });
}
