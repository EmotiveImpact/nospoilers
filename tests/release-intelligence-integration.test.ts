import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { openSql, migrate } from '../src/server/sql.ts';
import { createStore, signSession } from '../src/server/store.ts';
import { createApp } from '../src/server/app.ts';
import { loadConfig } from '../src/server/config.ts';
import { stubGithub } from '../src/server/stub-github.ts';
import { listUserWorkspaces } from '../src/server/workspaces.ts';
import { mintWorkspaceToken, revokeWorkspaceToken } from '../src/server/workspace-tokens.ts';
import { migrateReleaseIntelligence } from '../src/server/release-intelligence-schema.ts';
import { intelligencePorts } from '../src/server/release-intelligence-adapter.ts';
import { withReleaseIntelligence } from '../src/server/release-intelligence-app.ts';
import { withReleaseAssurance } from '../src/server/assurance-app.ts';
import { scan } from '../src/scanner/index.ts';
import { buildUnsignedReceipt, signReceipt } from '../src/receipt.ts';
import { persistHostedReceipt } from '../src/server/receipts.ts';
import {buildReleaseBriefModel} from '../src/watch/release-brief.ts';
import type {ReleaseRevision} from '../src/watch/types.ts';
import type {AssuranceView} from '../src/assurance/types.ts';

// Disposable database only. Real migration chain, scanner, HMAC, sessions, tokens,
// application routes and adapter; no provider calls or customer data mutations.
it('enforces real evidence, session, token, billing and workspace boundaries', async () => {
  const database = process.env.NOSPOILERS_PR44_TEST_DATABASE_URL;
  if (database) {
    const url = new URL(database);
    if (url.hostname !== '127.0.0.1' || url.pathname !== '/nospoilers_pr44_review') {
      throw new Error('Integration PostgreSQL checks require the dedicated loopback test database.');
    }
  }
  const sql = await openSql(database ?? 'pglite://:memory:');
  try {
    await migrate(sql);
    await migrateReleaseIntelligence(sql);
    const secrets = { sessionSecret: 'integration-session', receiptSecret: 'integration-receipt' };
    const store = createStore(sql, { tokenSecret: secrets.sessionSecret });
    const origin = 'http://127.0.0.1:4347';
    const cookies: Record<string, string> = {};
    for (const id of ['owner', 'viewer', 'foreign']) {
      await store.upsertUser({ id, login: id });
      cookies[id] = `ns_session=${signSession(secrets.sessionSecret, await store.createSession(id))}`;
    }
    const [workspace] = await listUserWorkspaces(sql, 'owner');
    await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'viewer','viewer','explicit')", [workspace.id]);
    const core = createApp({ store, github: stubGithub(), config: loadConfig({ ...secrets, appBaseUrl: origin }) });
    const assurance = withReleaseAssurance(core, {
      receiptSecret: secrets.receiptSecret,
      scopeForRelease: async id => {
        const row = await store.getReleaseRevision(id);
        return row ? { installationId: row.installation_id, receiptId: row.receipt_id } : null;
      },
    });
    const app = withReleaseIntelligence(assurance, {
      sql, appBaseUrl: origin,
      ports: request => intelligencePorts(request, secrets),
      reserve: request => intelligencePorts(request, secrets).reserve(sql),
      context: (request, ref) => intelligencePorts(request, secrets).context(sql, ref),
    });
    const report = await scan('fixtures/clean.tgz');
    expect(report.status).toBe('passed');
    const receipt = signReceipt(buildUnsignedReceipt(report, 'upload:integration'), secrets.receiptSecret);
    const seed = async (signature = receipt.signature) => {
      const id = randomUUID();
      await sql.query(`INSERT INTO uploaded_scans(id,user_id,workspace_id,target,artifact_sha256,status,report_json,receipt_json)
        VALUES($1,'owner',$2,'clean.tgz',$3,'done',$4::jsonb,$5::jsonb)`,
      [id, workspace.id, report.artifactSha256, JSON.stringify(report), JSON.stringify({ ...receipt, signature })]);
      return { kind: 'upload' as const, id };
    };
    const record = await seed();
    const request = (path: string, actor = 'owner', payload?: unknown, headers: Record<string, string> = {}) => app.fetch(new Request(origin + path, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { ...(cookies[actor] ? { cookie: cookies[actor] } : {}), origin, 'content-type': 'application/json', ...headers },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }));
    const path = '/api/release-intelligence/streams';
    const input = { workspaceId: workspace.id, name: 'Integration build', key: 'integration-build', role: 'Package', record };
    expect((await request(path, '', input)).status).toBe(401);
    expect((await request(path, 'foreign', input)).status).toBe(404);
    expect((await request(path, 'viewer', input)).status).toBe(403);
    expect((await request(path, 'owner', input, { origin: 'https://foreign.invalid' })).status).toBe(403);
    const forged = await seed('0'.repeat(64));
    expect((await request(path, 'owner', { ...input, record: forged })).status).toBe(422);
    const result = await request(path, 'owner', input);
    expect(result.status).toBe(201);
    const created = await result.json() as { stream: { id: string }; snapshot: { id: string } };
    const stream = `${path}/${created.stream.id}`;
    expect((await request(`/api/assurance/uploads/${record.id}`)).status).toBe(200);
    const uploaded = await request(`/api/uploads/${record.id}`);
    expect(uploaded.status).toBe(200);
    expect((await uploaded.json() as {upload:{readiness:{beforeDeploy:string}}}).upload.readiness.beforeDeploy).toBe('ready');
    const forgedRead = await request(`/api/uploads/${forged.id}`);
    expect((await forgedRead.json() as {upload:{readiness:{beforeDeploy:string}}}).upload.readiness.beforeDeploy).toBe('unknown');
    expect((await request(stream, 'foreign')).status).toBe(404);
    expect((await request(stream, 'viewer')).status).toBe(200);
    const adopt = { action: 'adopt', snapshotId: created.snapshot.id, expectedRevision: 0, reason: 'Reviewed the signed integration build.' };
    expect((await request(`${stream}/baseline`, 'viewer', adopt)).status).toBe(403);
    const competingAdoptions = await Promise.all([
      request(`${stream}/baseline`, 'owner', adopt), request(`${stream}/baseline`, 'owner', adopt),
    ]);
    expect(competingAdoptions.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await request(`${stream}/baseline`, 'owner', adopt)).status).toBe(409);
    const token = await mintWorkspaceToken(sql, 'owner', workspace.id, 'Integration CI');
    const bearer = { authorization: `Bearer ${token.token}` };
    expect((await request(`${stream}/records`, '', { record }, bearer)).status).toBe(200);
    expect((await request(`${stream}/baseline`, '', { ...adopt, expectedRevision: 1 }, bearer)).status).toBe(403);
    await revokeWorkspaceToken(sql, 'owner', workspace.id, String(token.scanToken.id), 'Integration CI');
    expect((await request(stream, '', undefined, bearer)).status).toBe(401);
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'viewer')", [workspace.id]);
    expect((await request(stream, 'viewer')).status).toBe(404);
    await sql.query("UPDATE users SET plan=NULL,trial_ends_at=now()-interval '1 day' WHERE id='owner'");
    expect((await request(stream)).status).toBe(200);
    expect((await request(`${stream}/records`, 'owner', { record })).status).toBe(402);
    const exported = await request(`${stream}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get('cache-control')).toBe('no-store');
    const data = await exported.text();
    expect(data).not.toContain(receipt.signature);
    expect(data).not.toContain('index.js');
    expect((await store.getUploadedScan('owner', record.id))?.receipt_json).toEqual(receipt);

    // Hosted evidence uses installation access as well as workspace membership.
    await store.upsertInstallation({ id: 700, accountId: 700, accountLogin: 'integration-org', accountType: 'Organization' });
    await store.linkUserInstallation(700, 'owner');
    const connected = (await listUserWorkspaces(sql, 'owner')).find(w => Number(w.installation_id) === 700)!;
    const hosted = await persistHostedReceipt({ store, secret: secrets.receiptSecret, installationId: 700,
      coordinate: 'github:integration/project@1.0.0#clean.tgz', report });
    const hostedRecord = { kind: 'release', id: String(hosted.revision.id) };
    const hostedView = await request(`/api/assurance/releases/${hosted.revision.id}`);
    expect(hostedView.status).toBe(200);
    const canonical = (await hostedView.json() as {view: AssuranceView}).view.assessment;
    const detail = (await (await request(`/api/releases/${hosted.revision.id}`)).json() as {release:ReleaseRevision}).release;
    const list = (await (await request('/api/releases?installationId=700')).json() as {releases:ReleaseRevision[]}).releases;
    expect(detail.readiness?.beforeDeploy).toBe('ready');
    expect(detail.readiness?.checks).toEqual(canonical.checks);
    expect(list.find(row => row.id === detail.id)?.readiness?.checks).toEqual(canonical.checks);
    expect(buildReleaseBriefModel(detail).title).toBe(canonical.title);
    expect(buildReleaseBriefModel(detail).cleanChecks).toBe(3);
    // A stored passing status must never conceal a tampered signature.
    const saved = await store.getScanReceiptForUser(hosted.revision.receipt_id, 'owner');
    await sql.query("UPDATE scan_receipts SET receipt=jsonb_set(receipt,'{signature}',to_jsonb($2::text)) WHERE id=$1", [hosted.revision.receipt_id, '0'.repeat(64)]);
    const tampered = (await (await request(`/api/releases/${hosted.revision.id}`)).json() as {release:ReleaseRevision}).release;
    expect(tampered.receiptStatus).toBe('passed');
    expect(tampered.readiness?.beforeDeploy).toBe('unknown');
    expect(buildReleaseBriefModel(tampered).ready).toBe(false);
    await sql.query('UPDATE scan_receipts SET receipt=$2::jsonb WHERE id=$1', [hosted.revision.receipt_id, JSON.stringify(saved!.receipt)]);
    const hostedInput = { ...input, workspaceId: connected.id, key: 'connected-build', record: hostedRecord };
    const hostedCreated = await request(path, 'owner', hostedInput);
    expect(hostedCreated.status).toBe(201);
    const hostedStream = `${path}/${(await hostedCreated.json() as { stream: { id: string } }).stream.id}`;
    expect((await request(path, 'owner', { ...input, record: hostedRecord })).status).not.toBe(201);
    const connectedToken = await mintWorkspaceToken(sql, 'owner', connected.id, 'Connected workspace CI');
    expect((await request(hostedStream, '', undefined, { authorization: `Bearer ${connectedToken.token}` })).status).toBe(403);
    expect((await request(hostedStream, 'foreign')).status).toBe(404);
    // Explicit teammates inherit the workspace's source access; they need not
    // connect their own GitHub account. Revocation must still remove that access.
    await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'foreign','member','explicit')", [connected.id]);
    expect((await request(hostedStream, 'foreign')).status).toBe(200);
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'foreign')", [connected.id]);
    expect((await request(hostedStream, 'foreign')).status).toBe(404);
    await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) VALUES($1,'owner')", [connected.id]);
    expect((await request(hostedStream)).status).toBe(404);
    expect((await request(`/api/assurance/releases/${hosted.revision.id}`)).status).toBe(404);
  } finally { await sql.close(); }
}, 60_000);
