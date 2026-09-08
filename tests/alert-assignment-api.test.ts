import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
it('clears ownership explicitly, preserves evidence, and rejects viewers, outsiders and ambiguous input',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);
  await store.upsertInstallation({id:7,accountId:7,accountLogin:'org',accountType:'Organization'});
  for(const id of ['owner','member','outsider'])await store.upsertUser({id,login:id});
  await store.linkUserInstallation(7,'owner');await store.linkUserInstallation(7,'member');
  const id=await store.insertAlert({installationId:7,kind:'repo_publicized',title:'Saved exposure',body:'Original evidence'});
  const app=createApp({store,github:stubGithub(),config:loadConfig({sessionSecret:'assignment'})});
  const cookie=async(user:string)=>`ns_session=${signSession('assignment',await store.createSession(user))}`;
  const owner=await cookie('owner'),member=await cookie('member'),outsider=await cookie('outsider');
  const request=(auth:string,body:object)=>app.request(`/api/alerts/${id}/assign`,{method:'POST',headers:{cookie:auth,'content-type':'application/json'},body:JSON.stringify(body)});
  expect((await request('',{userId:null})).status).toBe(401);
  expect((await request(owner,{userId:'member'})).status).toBe(200);
  expect((await request(owner,{})).status).toBe(400);
  expect((await request(owner,{userId:null,login:'owner'})).status).toBe(400);
  expect((await request(outsider,{userId:null})).status).toBe(404);
  await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=7 AND user_id='member'");
  expect((await request(member,{userId:null})).status).toBe(403);
  expect((await store.getAlertForUser(id,'owner'))?.assigned_to_user_id).toBe('member');
  expect((await request(owner,{userId:null})).status).toBe(200);
  expect(await store.getAlertForUser(id,'owner')).toMatchObject({assigned_to_user_id:null,assigned_to_login:null,resolved_at:null,title:'Saved exposure',body:'Original evidence'});
  expect((await sql.query('SELECT detail FROM alert_events WHERE alert_id=$1 ORDER BY id',[id])).rows).toEqual([{detail:'member'},{detail:'Assignment cleared'}]);
  expect((await sql.query('SELECT id FROM jobs')).rows).toHaveLength(0);
 }finally{await sql.close();}
});
