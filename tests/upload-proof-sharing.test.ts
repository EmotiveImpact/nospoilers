import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {uploadProofSharingSchema,publishUploadedProof,previewUploadedProof,readUploadedProof,revokeUploadedProof} from '../src/server/upload-proof-sharing.ts';

it('keeps proof private until explicit publication, redacts evidence and revokes capabilities without changing scans',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);await sql.exec(uploadProofSharingSchema);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});await store.createSession('owner');
  await store.upsertUser({id:'viewer',login:'viewer'});
  const [workspace]=await listUserWorkspaces(sql,'owner');
  await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')",[workspace.id]);
  const receipt={artifactSha256:'abc123',scannedAt:'2026-09-05',status:'failed-policy',ok:false,findingCount:1,maxSeverity:'critical',coordinate:'secret-package',signature:'private-signature',manifest:[{path:'secret.env'}],findingFingerprints:['secret-value']};
  await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,receipt_json) VALUES('proof','owner',$1,'private.zip','abc123','done',$2::jsonb)`,[workspace.id,JSON.stringify(receipt)]);
  expect((await previewUploadedProof(sql,'owner','proof')).active).toBeNull();
  await expect(publishUploadedProof(sql,'viewer','proof')).rejects.toMatchObject({status:404});
  await expect(publishUploadedProof(sql,'stranger','proof')).rejects.toMatchObject({status:404});
  const first=await publishUploadedProof(sql,'owner','proof');expect(first.token).toHaveLength(43);
  const publicProof=await readUploadedProof(sql,first.token);expect(publicProof.findingCount).toBe(1);
  expect(JSON.stringify(publicProof)).not.toMatch(/private|secret/);
  expect(publicProof).not.toHaveProperty('signature');
  const persisted=(await sql.query<{token_hash:string}>('SELECT token_hash FROM uploaded_proof_shares')).rows[0];expect(persisted.token_hash).not.toBe(first.token);
  const replacement=await publishUploadedProof(sql,'owner','proof');
  await expect(readUploadedProof(sql,first.token)).rejects.toMatchObject({status:404});
  await revokeUploadedProof(sql,'owner','proof');
  await expect(readUploadedProof(sql,replacement.token)).rejects.toMatchObject({status:404});
  await expect(readUploadedProof(sql,'unknown')).rejects.toMatchObject({status:404});
  expect((await sql.query<{receipt_json:unknown}>("SELECT receipt_json FROM uploaded_scans WHERE id='proof'")).rows[0].receipt_json).toEqual(receipt);
  await sql.query('UPDATE product_workspaces SET archived_at=now() WHERE id=$1',[workspace.id]);
  await expect(publishUploadedProof(sql,'owner','proof')).rejects.toMatchObject({status:409});
 }finally{await sql.close();}
});
