import {randomUUID} from 'node:crypto';
import {applyPolicy,POLICY_VERSION} from '../policy.ts';
import type {ScanReport,ScanPolicyShape} from '../scanner/types.ts';
import type {SqlClient} from './sql.ts';
import {listUserWorkspaces} from './workspaces.ts';
const fail=(message:string,status:400|403|404|409):never=>{throw Object.assign(new Error(message),{status});};
function validId(id:string){if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail('Workspace unavailable.',404);}

export async function getWorkspaceArtifactPolicy(sql:SqlClient,userId:string,workspaceId:string){
  validId(workspaceId);
  const workspace=(await listUserWorkspaces(sql,userId)).find(w=>w.id===workspaceId);
  if(!workspace)return fail('Workspace unavailable.',404);
  if((await sql.query('SELECT 1 FROM product_workspace_revocations WHERE workspace_id=$1 AND user_id=$2',[workspaceId,userId])).rows.length)fail('Workspace unavailable.',404);
  const {rows}=await sql.query<{strict:boolean;revision:number;require_exception_approval:boolean}>('SELECT strict,revision,require_exception_approval FROM product_workspace_scan_policies WHERE workspace_id=$1',[workspaceId]);
  const events=await sql.query('SELECT revision,strict,require_exception_approval,actor_user_id,created_at FROM product_workspace_policy_events WHERE workspace_id=$1 ORDER BY revision DESC LIMIT 30',[workspaceId]);
  return {...(rows[0]??{strict:false,revision:0,require_exception_approval:false}),canEdit:!workspace.archived_at&&['owner','admin'].includes(workspace.role),supported:true,events:events.rows};
}

export async function saveWorkspaceArtifactPolicy(sql:SqlClient,userId:string,workspaceId:string,input:{strict?:unknown;expectedRevision?:unknown;requireExceptionApproval?:unknown}){
  validId(workspaceId);
  if(typeof input.strict!=='boolean'||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0)fail('Choose a policy and reload its current revision before saving.',400);
  if(input.requireExceptionApproval!==undefined&&typeof input.requireExceptionApproval!=='boolean')fail('Choose whether independent exception approval is required.',400);
  return sql.transaction(async tx=>{
    await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);
    const current=await getWorkspaceArtifactPolicy(tx,userId,workspaceId);
    if(!current.canEdit)fail('An active workspace and administrator access are required.',403);
    if(current.revision!==input.expectedRevision)fail('This policy changed. Reload it before saving.',409);
    const requireApproval=typeof input.requireExceptionApproval==='boolean'?input.requireExceptionApproval:current.require_exception_approval;
    if(current.revision>0&&current.strict===input.strict&&requireApproval===current.require_exception_approval)return current;
    const revision=current.revision+1;
    await tx.query(`INSERT INTO product_workspace_scan_policies(workspace_id,strict,revision,require_exception_approval) VALUES($1,$2,$3,$4)
      ON CONFLICT(workspace_id) DO UPDATE SET strict=excluded.strict,revision=excluded.revision,require_exception_approval=excluded.require_exception_approval,updated_at=now()`,[workspaceId,input.strict,revision,requireApproval]);
    await tx.query('INSERT INTO product_workspace_policy_events(id,workspace_id,actor_user_id,strict,revision,require_exception_approval) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),workspaceId,userId,input.strict,revision,requireApproval]);
    return getWorkspaceArtifactPolicy(tx,userId,workspaceId);
  });
}

/** Capture before parsing. Later setting changes only affect subsequent scan starts. */
export async function workspaceArtifactPolicySnapshot(sql:SqlClient,workspaceId:string|null,scope?:{artifactSha256:string;sourceOriginId:number|null}):Promise<(ScanPolicyShape & {evaluatedAt:string})|null>{
  if(!workspaceId)return null;
  const {rows}=await sql.query<{strict:boolean|null;evaluated_at:string;exceptions:Array<{rule:string;exact_path:string;reason:string;expires_at:string;requested_login:string}>}>(`SELECT statement_timestamp() AS evaluated_at,
    (SELECT strict FROM product_workspace_scan_policies WHERE workspace_id=$1) AS strict,
    COALESCE((SELECT json_agg(e ORDER BY e.created_at,e.id) FROM workspace_exceptions e
      WHERE e.workspace_id=$1 AND e.installation_id IS NULL AND e.status='approved' AND e.expires_at>statement_timestamp()
      AND $4::boolean AND (e.source_origin_id=$2 OR $2::bigint IS NULL AND e.source_origin_id IS NULL AND e.artifact_sha256=$3)), '[]'::json) AS exceptions`,
    [workspaceId,scope?.sourceOriginId??null,scope?.artifactSha256??null,Boolean(scope)]);
  const row=rows[0];if(!row)throw new Error('Workspace policy snapshot unavailable.');
  return row.strict!==null||row.exceptions.length?{version:POLICY_VERSION,evaluatedAt:new Date(row.evaluated_at).toISOString(),strict:row.strict??false,exceptions:row.exceptions.map(e=>({rule:e.rule,pathPattern:e.exact_path,pathMatch:'exact' as const,reason:e.reason,expiresAt:new Date(e.expires_at).toISOString(),actor:e.requested_login}))}:null;
}
export function applyWorkspaceArtifactPolicy(report:ScanReport,policy:(ScanPolicyShape & {evaluatedAt?:string})|null){return applyPolicy(report,policy,policy?.evaluatedAt?new Date(policy.evaluatedAt):new Date());}
