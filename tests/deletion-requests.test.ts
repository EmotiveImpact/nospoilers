import {it,expect} from 'vitest';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';
import {ensureUserWorkspaces,listUserWorkspaces} from '../src/server/workspaces.ts';
import {deletionRequestSchema,requestDeletion,listDeletionRequests,withdrawDeletionRequest} from '../src/server/deletion-requests.ts';
it('requires exact scoped owner authorisation, records intent once, and never deletes or closes anything',async()=>{
 const sql=await openSql('pglite://:memory:');try{
  await migrate(sql);await sql.exec(deletionRequestSchema);const store=createStore(sql);
  for(const id of ['owner','stranger']){await store.upsertUser({id,login:id});await ensureUserWorkspaces(sql,id);}
  const workspace=(await listUserWorkspaces(sql,'owner'))[0],other=(await listUserWorkspaces(sql,'stranger'))[0];
  const input={scope:'workspace_history',workspaceId:workspace.id,confirmation:`DELETE HISTORY ${workspace.id}`,acknowledgeHistory:true};
  await expect(requestDeletion(sql,'stranger',workspace.organization_id,input)).rejects.toMatchObject({status:403});
  await expect(requestDeletion(sql,'owner',workspace.organization_id,{...input,acknowledgeHistory:false})).rejects.toMatchObject({status:400});
  await expect(requestDeletion(sql,'owner',workspace.organization_id,{...input,confirmation:'DELETE'})).rejects.toMatchObject({status:400});
  await expect(requestDeletion(sql,'owner',workspace.organization_id,{...input,workspaceId:other.id,confirmation:`DELETE HISTORY ${other.id}`})).rejects.toMatchObject({status:404});
  const first=await requestDeletion(sql,'owner',workspace.organization_id,input);
  expect(await requestDeletion(sql,'owner',workspace.organization_id,input)).toEqual(first);
  await requestDeletion(sql,'owner',workspace.organization_id,{scope:'organization_closure',confirmation:`CLOSE AND DELETE ${workspace.organization_id}`,acknowledgeHistory:true});
  expect(await listDeletionRequests(sql,'owner',workspace.organization_id)).toHaveLength(2);
  await expect(listDeletionRequests(sql,'stranger',workspace.organization_id)).rejects.toMatchObject({status:403});
  expect(await listUserWorkspaces(sql,'owner')).toHaveLength(1);
  expect((await sql.query('SELECT * FROM product_organization_events WHERE organization_id=$1 AND action=$2',[workspace.organization_id,'deletion_review_requested'])).rows).toHaveLength(2);
  await expect(sql.query('DELETE FROM product_deletion_requests WHERE id=$1',[first.id])).rejects.toThrow('append-only');
  await expect(withdrawDeletionRequest(sql,'stranger',workspace.organization_id,first.id)).rejects.toMatchObject({status:403});
  await withdrawDeletionRequest(sql,'owner',workspace.organization_id,first.id);
  expect(await listDeletionRequests(sql,'owner',workspace.organization_id)).toEqual(expect.arrayContaining([expect.objectContaining({id:first.id,status:'withdrawn'})]));
  expect((await requestDeletion(sql,'owner',workspace.organization_id,input)).id).not.toBe(first.id);
 }finally{await sql.close();}
});
