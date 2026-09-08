import {it,expect} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {skippedGithubWrites,type GithubPort} from '../src/server/github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';

it('authorises explicit proof publication and keeps anonymous verification read-only and revocable',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);const store=createStore(sql);const fail=async():Promise<never>=>{throw new Error('Unexpected GitHub call');};
  const github:GithubPort={exchangeCode:fail,getUser:fail,listUserInstallations:fail,getInstallation:fail,getRepo:fail,listReleaseAssets:fail,getLatestRelease:fail,downloadAsset:fail,...skippedGithubWrites()};
  const app=createApp({store,github,config:loadConfig({appBaseUrl:'http://127.0.0.1:4347',sessionSecret:'proof-test'})});
  await store.upsertUser({id:'owner',login:'owner'});const cookie=`ns_session=${signSession('proof-test',await store.createSession('owner'))}`;
  const headers={cookie,'content-type':'application/json',origin:'http://127.0.0.1:4347'};
  const [workspace]=await listUserWorkspaces(sql,'owner');
  // An unrelated read-only GitHub connection must not override ownership here.
  await store.upsertInstallation({id:987,accountId:987,accountLogin:'unrelated',accountType:'Organization'});
  await store.linkUserInstallation(987,'owner');
  await sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=987 AND user_id='owner'");
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,receipt_json) VALUES('proof','owner',$1,'private.zip','abc','done',$2::jsonb)`,[workspace.id,JSON.stringify({artifactSha256:'abc',scannedAt:'2026-09-05',status:'passed',ok:true,findingCount:0,maxSeverity:null,signature:'private'})]);
  const endpoint='/api/uploads/proof/sharing';
  expect((await app.request(endpoint)).status).toBe(401);
  expect((await app.request(endpoint,{method:'POST',body:'{}'})).status).toBe(401);
  expect((await app.request(endpoint,{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:'{"confirm":true}'})).status).toBe(403);
  expect((await app.request(endpoint,{method:'POST',headers,body:'{}'})).status).toBe(400);
  expect((await app.request(endpoint,{method:'POST',headers,body:'{'})).status).toBe(400);
  const published=await app.request(endpoint,{method:'POST',headers,body:'{"confirm":true}'});expect(published.status).toBe(200);
  const {token}=await published.json() as {token:string};
  const publicPath=`/api/public/upload-proofs/${token}`;
  const proof=await app.request(publicPath);expect(proof.status).toBe(200);
  expect(proof.headers.get('cache-control')).toBe('no-store');expect(proof.headers.get('referrer-policy')).toBe('no-referrer');expect(proof.headers.get('x-robots-tag')).toBe('noindex');
  expect(await proof.json()).not.toHaveProperty('signature');
  expect((await sql.query<{count:string}>('SELECT count(*) AS count FROM jobs')).rows[0].count).toBe(0);
  expect((await app.request(endpoint,{method:'DELETE',headers:{...headers,origin:'https://evil.invalid'}})).status).toBe(403);
  expect((await app.request(endpoint,{method:'DELETE',headers})).status).toBe(200);
  const revoked=await app.request(publicPath),unknown=await app.request('/api/public/upload-proofs/unknown');
  expect(revoked.status).toBe(404);expect(unknown.status).toBe(404);expect(await revoked.json()).toEqual(await unknown.json());
  await sql.query('INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,$2)',[workspace.id,'owner']);
  expect((await app.request(endpoint,{headers})).status).toBe(404);
  expect((await app.request(endpoint,{method:'POST',headers,body:'{"confirm":true}'})).status).toBe(404);
  expect((await app.request(endpoint,{method:'DELETE',headers})).status).toBe(404);
 }finally{await sql.close();}
});
