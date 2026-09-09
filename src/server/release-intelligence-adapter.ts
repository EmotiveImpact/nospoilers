import { createHash } from 'node:crypto';
import { canonicalJson, verifyReceipt } from '../receipt.ts';
import { readReceipt } from '../assurance/evidence.ts';
import {assessRelease} from '../assurance/decision.ts';
import {connectedGatePorts} from './release-gate-access.ts';
import { createStore, readSignedSession } from './store.ts';
import { listUserWorkspaces } from './workspaces.ts';
import { authenticateWorkspaceToken } from './workspace-tokens.ts';
import type { SqlClient } from './sql.ts';
import type { IntelligencePorts, Permission } from './release-intelligence-service.ts';
import { fail, validate } from '../release-intelligence/model.ts';
import type { Evidence, Ref } from '../release-intelligence/model.ts';
type Actor = { kind: 'user'; userId: string; login: string } | { kind: 'token'; workspaceId: string; tokenId: number };
type Billing = { archived_at: string | null; plan: string | null; trial_ends_at: string | Date | null };
function sessionCookie(request: Request): string | undefined {
  const values = (request.headers.get('cookie') ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith('ns_session='));
  if (values.length !== 1) return undefined;
  try { return decodeURIComponent(values[0].slice('ns_session='.length)); } catch { return undefined; }
}
const active = (row: Billing): boolean => ['solo', 'team'].includes(row.plan ?? '') || row.trial_ends_at !== null && new Date(row.trial_ends_at).getTime() > Date.now();
function createIntelligencePorts(request: Request, secrets: { sessionSecret: string; receiptSecret: string },captureUserId?:string): IntelligencePorts & {
  reserve: (sql: SqlClient) => Promise<boolean>;
  context: (sql: SqlClient, ref: Ref) => Promise<{ workspaceId: string }>;
} {
  const store = (sql: SqlClient) => createStore(sql, { tokenSecret: secrets.sessionSecret });
  async function identity(sql: SqlClient): Promise<Actor> {
    if(captureUserId){
      const user=(await sql.query<{id:string;login:string}>('SELECT id,login FROM users WHERE id=$1',[captureUserId])).rows[0];
      if(!user)return fail('Capture authorisation is unavailable.',403);
      return {kind:'user',userId:user.id,login:user.login};
    }
    const header = request.headers.get('authorization');
    if (header !== null) {
      const match = /^Bearer ([^\s]+)$/.exec(header);
      const token = match ? await authenticateWorkspaceToken(sql, match[1]) : null;
      if (!token) return fail('A valid workspace scan token is required.', 401);
      return { kind: 'token', workspaceId: token.workspaceId, tokenId: token.id };
    }
    const id = readSignedSession(secrets.sessionSecret, sessionCookie(request));
    const session = id ? await store(sql).getSession(id) : null;
    if (!session) return fail('Sign in to inspect release history.', 401);
    return { kind: 'user', userId: session.userId, login: session.login };
  }
  async function access(sql: SqlClient, workspaceId: string, mode: 'read' | 'write' | 'manage', source?: string): Promise<Permission> {
    const actor = await identity(sql);
    const connection = source ? /^installation:(\d+):/.exec(source) : null;
    let role: string, billing: Billing;
    if (actor.kind === 'token') {
      if (actor.workspaceId !== workspaceId || mode === 'manage' || connection) return fail('This token cannot access that release stream.', 403);
      const row = (await sql.query<Billing>(`SELECT w.archived_at,
        CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.plan ELSE u.plan END AS plan,
        CASE WHEN o.legacy_installation_id IS NOT NULL THEN b.trial_ends_at ELSE u.trial_ends_at END AS trial_ends_at
        FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
        LEFT JOIN billing_accounts b ON b.installation_id=o.legacy_installation_id
        LEFT JOIN users u ON u.id=o.legacy_personal_user_id WHERE w.id=$1`, [workspaceId])).rows[0];
      if (!row) return fail('Workspace unavailable.', 404);
      role = 'member'; billing = row;
    } else {
      const workspace = (await listUserWorkspaces(sql, actor.userId)).find(w => w.id === workspaceId);
      const revoked = await sql.query('SELECT 1 FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id=$2', [workspaceId, actor.userId]);
      if (!workspace || revoked.rows.length) return fail('Workspace unavailable.', 404);
      role = workspace.role; billing = workspace;
      if (connection) {
        const installationId = Number(connection[1]);
        if (!(await store(sql).userOwnsInstallation(actor.userId, installationId)) || !(await sql.query('SELECT 1 FROM product_workspace_installations WHERE workspace_id=$1 AND installation_id=$2', [workspaceId, installationId])).rows.length) return fail('Source connection unavailable.', 404);
      }
    }
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) return fail('Workspace access unavailable.', 403);
    const canWrite = !billing.archived_at && role !== 'viewer' && active(billing);
    const canManage = actor.kind === 'user' && ['owner', 'admin'].includes(role) && canWrite;
    if (mode !== 'read' && billing.archived_at) return fail('This workspace is archived.', 403);
    if (mode !== 'read' && role === 'viewer' || mode === 'manage' && !['owner', 'admin'].includes(role)) return fail('Administrator or writable workspace access is required.', 403);
    if (mode !== 'read' && !active(billing)) return fail('Workspace coverage has ended. Saved history remains readable.', 402);
    return { actorLogin: actor.kind === 'user' ? actor.login : `workspace-token:${actor.tokenId}`, canManage, canWrite,
      actorUserId:actor.kind==='user'?actor.userId:undefined,canAdminister:actor.kind==='user'&&['owner','admin'].includes(role) };
  }
  async function held(sql: SqlClient, actor: Actor, releaseId: number): Promise<boolean> {
    if (actor.kind !== 'user') return true;
    const s = store(sql), release = await s.getReleaseRevisionForUser(releaseId, actor.userId);
    if (!release) return fail('Release unavailable.', 404);
    const order = <T extends { id: number; created_at: string }>(rows: T[]) => rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || Number(b.id) - Number(a.id))[0];
    const hold = order(await s.listReleaseLegalHoldsForRevisions([releaseId]));
    const approval = order(await s.listReleaseApprovalsForRevisions([releaseId]));
    return release.mismatch || hold?.action === 'place' || approval?.decision === 'rejected';
  }
  async function evidence(sql: SqlClient, workspaceId: string, ref: Ref): Promise<Evidence> {
    const actor = await identity(sql); await access(sql, workspaceId, 'read');
    const s = store(sql);
    let raw: unknown, digest: string, coordinate: string, channel: Evidence['channel'], format: string, source: string;
    let expectedStatus: string | null, governance = false;
    if (ref.kind === 'upload') {
      const row = actor.kind === 'user' ? await s.getUploadedScan(actor.userId, ref.id) : await s.getWorkspaceTokenUpload(actor.workspaceId, ref.id);
      if (!row || row.workspace_id !== workspaceId || actor.kind === 'token' && row.installation_id !== null) return fail('Saved scan unavailable.', 404);
      if (row.status !== 'done' || !row.report_json || !row.receipt_json) return fail('Complete the scan before recording historical evidence.', 409);
      raw = row.receipt_json; digest = row.artifact_sha256.toLowerCase();
      if (row.report_json.artifactSha256?.toLowerCase() !== digest || (row.report_json.status === 'passed') !== row.report_json.ok) return fail('Saved report and artefact identity disagree.', 422);
      coordinate = row.receipt_json.coordinate; channel = row.submission_meta?.channel ?? 'stable';
      format = `scan:${row.report_json.kind}`; expectedStatus = row.report_json.status;
      source = `${row.installation_id !== null ? `installation:${row.installation_id}:` : ''}${row.source_origin_id != null ? `website:${row.source_origin_id}` : 'manual-upload'}`;
      if (row.revision_id) governance = await held(sql, actor, Number(row.revision_id));
    } else {
      if (actor.kind !== 'user') return fail('Workspace tokens cannot access connected release records.', 403);
      const row = await s.getReleaseRevisionForUser(Number(ref.id), actor.userId);
      if (!row || !(await sql.query('SELECT 1 FROM product_workspace_installations WHERE workspace_id=$1 AND installation_id=$2', [workspaceId, row.installation_id])).rows.length) return fail('Release unavailable.', 404);
      const receipt = await s.getScanReceipt(row.receipt_id);
      if (!receipt || receipt.installation_id !== row.installation_id || !row.media_type) return fail('Complete original receipt and format evidence are required.', 409);
      raw = receipt.receipt; digest = row.artifact_sha256.toLowerCase(); coordinate = row.coordinate;
      channel = row.channel; format = `media:${row.media_type}`; expectedStatus = row.receipt_status;
      source = `installation:${row.installation_id}:${row.package_id !== null ? `package:${row.package_id}` : row.repo_id !== null ? `repository:${row.repo_id}` : `coordinate:${row.coordinate}`}`;
      governance = await held(sql, actor, row.id);
    }
    const encoded = canonicalJson(raw);
    if (Buffer.byteLength(encoded, 'utf8') > 16 * 1024 * 1024) return fail('Receipt exceeds the analysis budget.', 422);
    if (!secrets.receiptSecret.trim() || !verifyReceipt(encoded, secrets.receiptSecret, digest).ok) return fail('The original receipt signature could not be verified.', 422);
    const receipt = readReceipt(raw);
    if (!receipt || receipt.coordinate !== coordinate || (receipt.channel ?? 'stable') !== channel || receipt.status !== expectedStatus) return fail('Receipt evidence is incomplete or belongs to another record.', 422);
    const signedRevision=(raw as {sourceRevision?:unknown}).sourceRevision;
    const result: Evidence = { ref, workspaceId, source, channel, format, digest,
      sourceRevision:typeof signedRevision==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(signedRevision)?signedRevision.toLowerCase():null,
      fingerprint: createHash('sha256').update(encoded).digest('hex'), scannedAt: receipt.scannedAt,
      engine: receipt.engineVersion, policy: receipt.policyHash, status: receipt.status,
      suppressed: receipt.suppressedCount, findings: receipt.findingFingerprints,
      manifest: receipt.manifest.map(f => ({ ...f, sha256: f.sha256.toLowerCase() })), bytes: receipt.artifactBytes, held: governance };
    validate(result);
    result.readiness=assessRelease({scopeKey:workspaceId,signature:'verified',receipt,release:{
      id:ref.id,receiptId:null,coordinate,channel,artifactSha256:digest,artifactBytes:receipt.artifactBytes,mediaType:format,
      createdAt:receipt.scannedAt,receiptStatus:receipt.status,mismatch:false,legalHold:{active:governance},
    }}).beforeDeploy;
    await access(sql, workspaceId, 'read', source); return result;
  }
  return {
    access, evidence,
    gate:streamId=>request.headers.has('authorization')?connectedGatePorts({access,evidence},async gateSql=>{
      // Resolve again on each use; token revocation is never cached in a capability.
      const actor=await identity(gateSql);return actor.kind==='token'?{tokenId:actor.tokenId,workspaceId:actor.workspaceId}:fail('A workspace token is required.',401);
    },userId=>createIntelligencePorts(new Request('http://internal.invalid/gate'),secrets,userId),streamId):{access,evidence},
    async reserve(sql) {
      const actor = await identity(sql), id = actor.kind === 'user' ? actor.userId : `token:${actor.tokenId}`;
      return store(sql).reserveRequest(`release-intelligence:${request.method}:${id}`, request.method === 'GET' ? 120 : 30, 60_000);
    },
    async context(sql, ref) {
      const actor = await identity(sql), s = store(sql); let workspaceId: string | null, source: string | undefined;
      if (ref.kind === 'upload') {
        const row = actor.kind === 'user' ? await s.getUploadedScan(actor.userId, ref.id) : await s.getWorkspaceTokenUpload(actor.workspaceId, ref.id);
        if (!row || actor.kind === 'token' && row.installation_id !== null) return fail('Saved scan unavailable.', 404);
        workspaceId = row.workspace_id; source = row.installation_id !== null ? `installation:${row.installation_id}:record` : undefined;
      } else {
        if (actor.kind !== 'user') return fail('Connected release access requires a signed-in user.', 403);
        const row = await s.getReleaseRevisionForUser(Number(ref.id), actor.userId);
        if (!row) return fail('Release unavailable.', 404);
        const links = (await sql.query<{ workspace_id: string }>('SELECT workspace_id FROM product_workspace_installations WHERE installation_id=$1', [row.installation_id])).rows;
        if (links.length !== 1) return fail('Release workspace identity is unavailable.', 409);
        workspaceId = links[0].workspace_id; source = `installation:${row.installation_id}:record`;
      }
      if (!workspaceId) return fail('This historical record has no stable workspace identity.', 409);
      await access(sql, workspaceId, 'read', source); return { workspaceId };
    },
  };
}

export function intelligencePorts(request:Request,secrets:{sessionSecret:string;receiptSecret:string}){
  return createIntelligencePorts(request,secrets);
}

/** Internal worker capability, tied to the stored opt-in grant. Never accepts a request user ID. */
export function intelligenceCapturePorts(userId:string,receiptSecret:string):IntelligencePorts{
  const ports=createIntelligencePorts(new Request('http://internal.invalid/capture'),{sessionSecret:'',receiptSecret},userId);
  return {...ports,access:(sql,workspace,mode,source)=>ports.access(sql,workspace,mode==='read'?'read':'manage',source)};
}
