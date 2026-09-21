import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {createStore} from '../src/server/store.ts';
import {CURRENT_SCHEMA_MIGRATION,migrate,openSql} from '../src/server/sql.ts';
import {createWorkspace,listUserWorkspaces} from '../src/server/workspaces.ts';
import {saveWorkspaceNotification} from '../src/server/workspace-notifications.ts';
import {runWorkspaceNotification} from '../src/server/workspace-notification-worker.ts';

it('queues only future connected alerts for independent workspace delivery',async()=>{
 const sql=await openSql('pglite://:memory:');
 try {
  await migrate(sql);const store=createStore(sql);
  await store.upsertUser({id:'owner',login:'owner'});
  await store.upsertInstallation({id:711,accountId:711,accountLogin:'connected',accountType:'Organization'});
  await store.linkUserInstallation(711,'owner');
  const workspace=(await listUserWorkspaces(sql,'owner')).find(row=>Number(row.installation_id)===711)!;

  const historical=await store.insertAlert({installationId:711,kind:'release_scan',title:'Historical alert',body:'Do not send this'});
  const saved=await saveWorkspaceNotification(sql,'owner',workspace.id,'email','owner@example.com','notification-test-key');
  expect((await sql.query('SELECT id FROM workspace_notification_jobs')).rows).toEqual([]);

  const alertInput={
   installationId:711,kind:'release_scan',title:'Private release finding',body:'private evidence body',
   findings:{secret:'must remain private'},githubDeliveryId:'delivery-connected-notification',
  };
  const alertId=await store.insertAlert(alertInput);
  expect(await store.insertAlert(alertInput)).toBe(alertId);
  expect((await sql.query<{alert_id:number;workspace_id:string;destination_id:number}>(
   'SELECT alert_id,workspace_id,destination_id FROM workspace_notification_jobs',
  )).rows).toEqual([{alert_id:alertId,workspace_id:workspace.id,destination_id:saved.destination.id}]);

  const other=await createWorkspace(sql,'owner',workspace.organization_id,'Other workspace');
  const otherDestination=await saveWorkspaceNotification(sql,'owner',other.id,'email','other@example.com','notification-test-key');
  const otherVersion=(await sql.query<{configuration_version:string}>(
   'SELECT configuration_version FROM notification_destinations WHERE id=$1',[otherDestination.destination.id],
  )).rows[0].configuration_version;
  await expect(sql.query(`INSERT INTO workspace_notification_jobs(id,workspace_id,destination_id,configuration_version,alert_id,purpose,request_key)
   VALUES($1,$2,$3,$4,$5,'alert',$6)`,[randomUUID(),other.id,otherDestination.destination.id,otherVersion,alertId,randomUUID()]))
   .rejects.toThrow('alert mismatch');

  let requestBody='';
  expect(await runWorkspaceNotification(sql,{
   encryptionSecret:'notification-test-key',emailApiKey:'resend-test-key',emailFrom:'NoSpoilers <alerts@example.com>',
   fetch:async(_input,init)=>{requestBody=String(init?.body??'');return new Response('{}',{status:200});},
  })).toBe(true);
  expect(requestBody).toContain('A NoSpoilers workspace alert needs attention.');
  expect(requestBody).not.toContain('Private release finding');
  expect(requestBody).not.toContain('private evidence body');
  expect(requestBody).not.toContain('must remain private');
  expect((await sql.query('SELECT workspace_id,installation_id,alert_id,status FROM notification_deliveries')).rows)
   .toEqual([{workspace_id:workspace.id,installation_id:null,alert_id:alertId,status:'sent'}]);
  expect((await sql.query('SELECT id FROM notification_deliveries WHERE alert_id=$1',[historical])).rows).toEqual([]);
  expect((await sql.query<{id:string}>('SELECT id FROM schema_migrations WHERE id=$1',[CURRENT_SCHEMA_MIGRATION])).rows)
   .toEqual([{id:CURRENT_SCHEMA_MIGRATION}]);
 } finally {await sql.close();}
},30000);
