import {it, expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {openSql, migrate} from '../src/server/sql.ts';
import {createStore, signSession} from '../src/server/store.ts';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {stubGithub} from '../src/server/stub-github.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {mintWorkspaceToken} from '../src/server/workspace-tokens.ts';
import {migrateReleaseIntelligence} from '../src/server/release-intelligence-schema.ts';
import {intelligencePorts} from '../src/server/release-intelligence-adapter.ts';
import {withReleaseIntelligence} from '../src/server/release-intelligence-app.ts';
import {scan} from '../src/scanner/index.ts';
import {buildUnsignedReceipt, signReceipt} from '../src/receipt.ts';

it('rechecks billing before consuming an already issued gate decision without consuming it on denial', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    await migrateReleaseIntelligence(sql);
    const secrets = {sessionSecret: 'billing-lifecycle-session', receiptSecret: 'billing-lifecycle-receipt'};
    const store = createStore(sql, {tokenSecret: secrets.sessionSecret});
    await store.upsertUser({id: 'owner', login: 'owner'});
    const cookie = `ns_session=${signSession(secrets.sessionSecret, await store.createSession('owner'))}`;
    const [workspace] = await listUserWorkspaces(sql, 'owner');
    const base = 'http://127.0.0.1:4347';
    const app = withReleaseIntelligence(createApp({store, github: stubGithub(), config: loadConfig({...secrets, appBaseUrl: base})}), {
      sql, appBaseUrl: base, ports: r => intelligencePorts(r, secrets), reserve: async () => true,
      context: (r, ref) => intelligencePorts(r, secrets).context(sql, ref),
    });
    const request = (path: string, payload: unknown, token?: string) => app.fetch(new Request(base + path, {
      method: 'POST', headers: {origin: base, 'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {cookie})},
      body: JSON.stringify(payload),
    }));
    const report = await scan('fixtures/clean.tgz');
    const receipt = signReceipt(buildUnsignedReceipt(report, 'upload:billing-lifecycle'), secrets.receiptSecret);
    const record = {kind: 'upload', id: randomUUID()};
    await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json)
      VALUES($1,'owner',$2,'clean.tgz',$3,'done',$4::jsonb,$5::jsonb)`, [record.id, workspace.id, report.artifactSha256, JSON.stringify(report), JSON.stringify(receipt)]);
    const created = await request('/api/release-intelligence/streams', {workspaceId: workspace.id, name: 'Billing lifecycle', key: 'billing-lifecycle', role: 'Package', record});
    expect(created.status).toBe(201);
    const {stream} = await created.json() as {stream: {id: string}};
    const path = `/api/release-intelligence/streams/${stream.id}/gate`;
    expect((await request(path, {action: 'configure', mode: 'enforce', maxAgeHours: 24, expectedRevision: 0, reason: 'Require current authorised build evidence.', confirm: true})).status).toBe(200);
    const token = await mintWorkspaceToken(sql, 'owner', workspace.id, 'Billing lifecycle CI');
    const evaluated = await request(path, {action: 'evaluate', record, digest: report.artifactSha256, expectedPolicyRevision: 1, deploymentId: 'billing-test', requestKey: randomUUID()}, token.token);
    expect(evaluated.status).toBe(201);
    const decision = await evaluated.json() as {id: string; result: {readiness: string}};
    expect(decision.result.readiness).toBe('ready');
    await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='owner'");
    const consume = {action: 'consume', decisionId: decision.id, digest: report.artifactSha256, deploymentId: 'billing-test', expectedPolicyRevision: 1};
    expect((await request(path, consume, token.token)).status).toBe(402);
    expect((await request(path, consume)).status).toBe(402);
    expect((await sql.query('SELECT id FROM release_gate_consumptions WHERE decision_id=$1', [decision.id])).rows).toHaveLength(0);
    expect((await sql.query('SELECT receipt_json FROM uploaded_scans WHERE id=$1', [record.id])).rows[0]).toEqual({receipt_json: receipt});
  } finally {
    await sql.close();
  }
}, 60_000);
