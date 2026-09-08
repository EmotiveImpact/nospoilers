import {randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import {workspaceEvidenceSettings} from './workspace-evidence-settings.ts';
import {uploadWorkspaceScope} from './workspaces.ts';
import {validateExceptionInput} from '../policy.ts';
import type {Finding} from '../scanner/types.ts';

export const workspaceExceptionSchema=`
ALTER TABLE product_workspace_scan_policies ADD COLUMN require_exception_approval BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE product_workspace_policy_events ADD COLUMN require_exception_approval BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE workspace_exceptions (
 id UUID PRIMARY KEY, workspace_id UUID NOT NULL REFERENCES product_workspaces(id) ON DELETE RESTRICT,
 request_key UUID NOT NULL, requested_by TEXT NOT NULL, requested_login TEXT NOT NULL,
 attempt_id TEXT NOT NULL REFERENCES uploaded_scans(id) ON DELETE RESTRICT,
 source_origin_id BIGINT REFERENCES watched_origins(id) ON DELETE RESTRICT,
 artifact_sha256 TEXT, rule TEXT NOT NULL, exact_path TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 4000), expires_at TIMESTAMPTZ NOT NULL,
 independent_approval BOOLEAN NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 decided_by TEXT, decided_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,request_key),
 CHECK((source_origin_id IS NOT NULL AND artifact_sha256 IS NULL) OR (source_origin_id IS NULL AND artifact_sha256 ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX workspace_exceptions_scope ON workspace_exceptions(workspace_id,status,expires_at);
CREATE TABLE workspace_exception_events (
 id BIGSERIAL PRIMARY KEY, exception_id UUID NOT NULL REFERENCES workspace_exceptions(id) ON DELETE RESTRICT,
 actor_user_id TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('requested','approved','rejected','revoked')),
 note TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER workspace_exception_event_immutable BEFORE UPDATE OR DELETE ON workspace_exception_events FOR EACH ROW EXECUTE FUNCTION reject_product_event_mutation();
CREATE TRIGGER workspace_exception_event_no_truncate BEFORE TRUNCATE ON workspace_exception_events FOR EACH STATEMENT EXECUTE FUNCTION reject_product_event_mutation();
CREATE FUNCTION guard_workspace_exception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Exception history is retained'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'status'-'decided_by'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'decided_by'-'decided_at') THEN RAISE EXCEPTION 'Exception scope is immutable'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM uploaded_scans s WHERE s.id=NEW.attempt_id AND s.workspace_id=NEW.workspace_id AND s.installation_id IS NULL AND s.status='done'
   AND s.source_origin_id IS NOT DISTINCT FROM NEW.source_origin_id AND (NEW.source_origin_id IS NOT NULL OR s.artifact_sha256=NEW.artifact_sha256)) THEN RAISE EXCEPTION 'Exception evidence scope mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_exception_identity BEFORE INSERT OR UPDATE OR DELETE ON workspace_exceptions FOR EACH ROW EXECUTE FUNCTION guard_workspace_exception();
`;
const fail=(message:string,status:number):never=>{throw Object.assign(new Error(message),{status});};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

async function writable(sql:SqlClient,userId:string,workspaceId:string,admin=false){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(access.workspace.archived_at||!(admin?['owner','admin']:['owner','admin','member']).includes(access.workspace.role))fail('Active workspace '+(admin?'administrator':'responder')+' access is required.',403);
 const scope=await uploadWorkspaceScope(sql,userId,null,workspaceId);
 const paid=scope.billing_installation_id!==null
  ?await sql.query("SELECT 1 FROM billing_accounts WHERE installation_id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())",[scope.billing_installation_id])
  :await sql.query("SELECT 1 FROM users WHERE id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())",[scope.billing_user_id]);
 if(!paid.rows.length)fail('An active workspace subscription is required.',402);
 return access;
}

export async function requestWorkspaceException(sql:SqlClient,userId:string,workspaceId:string,input:{requestKey?:unknown;attemptId?:unknown;receiptId?:unknown;findingIndex?:unknown;reason?:unknown;expiresAt?:unknown}){
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 const upload=typeof input.attemptId==='string'&&input.attemptId.length>0&&input.attemptId.length<=200&&input.receiptId===undefined;
 const hosted=Number.isSafeInteger(input.receiptId)&&Number(input.receiptId)>0&&input.attemptId===undefined;
 if(!uuid(input.requestKey)||(!upload&&!hosted)||!Number.isSafeInteger(input.findingIndex)||Number(input.findingIndex)<0||typeof input.reason!=='string'||input.reason.length>4000||typeof input.expiresAt!=='string')fail('Choose a saved finding, reason and expiry.',400);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);await writable(tx,userId,workspaceId);
  type Evidence={installation_id:number|null;source_origin_id:number|null;artifact_sha256:string;report_json:{findings:Finding[]}};
  const attempt=upload?(await tx.query<Evidence>(`SELECT installation_id,source_origin_id,artifact_sha256,report_json FROM uploaded_scans WHERE id=$1 AND workspace_id=$2 AND status='done'`,[input.attemptId,workspaceId])).rows[0]:(await tx.query<Evidence>(`SELECT e.installation_id,NULL::bigint AS source_origin_id,r.artifact_sha256,e.report AS report_json FROM hosted_scan_evidence e JOIN scan_receipts r ON r.id=e.receipt_id WHERE e.receipt_id=$1 AND e.workspace_id=$2`,[input.receiptId,workspaceId])).rows[0];
  const finding=attempt?.report_json?.findings?.[Number(input.findingIndex)];if(!finding)fail('Saved finding unavailable.',404);
  const login=(await tx.query<{login:string}>('SELECT login FROM users WHERE id=$1',[userId])).rows[0].login;
  const parsed=validateExceptionInput({rule:finding.rule,pathPattern:finding.path,reason:input.reason as string,expiresAt:input.expiresAt as string,actor:login});
  const previous=(await tx.query<{id:string;requested_by:string;attempt_id:string|null;receipt_id:number|null;rule:string;exact_path:string;reason:string;expires_at:string}>(`SELECT id,requested_by,attempt_id,receipt_id,rule,exact_path,reason,expires_at FROM workspace_exceptions WHERE workspace_id=$1 AND request_key=$2`,[workspaceId,input.requestKey])).rows[0];
  if(previous){
   if(previous.requested_by!==userId||previous.attempt_id!==(input.attemptId??null)||(previous.receipt_id===null?null:Number(previous.receipt_id))!==(input.receiptId??null)||previous.rule!==parsed.rule||previous.exact_path!==finding.path||previous.reason!==parsed.reason||new Date(previous.expires_at).toISOString()!==parsed.expiresAt)fail('This request identifier was already used for another exception.',409);
   return {id:previous.id};
  }
  const independent=(await tx.query<{required:boolean}>('SELECT require_exception_approval AS required FROM product_workspace_scan_policies WHERE workspace_id=$1',[workspaceId])).rows[0]?.required??false;
  const id=randomUUID();
  await tx.query(`INSERT INTO workspace_exceptions(id,workspace_id,request_key,requested_by,requested_login,attempt_id,source_origin_id,artifact_sha256,rule,exact_path,reason,expires_at,independent_approval,installation_id,receipt_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,[id,workspaceId,input.requestKey,userId,login,input.attemptId??null,attempt.source_origin_id,attempt.source_origin_id===null?attempt.artifact_sha256:null,parsed.rule,finding.path,parsed.reason,parsed.expiresAt,independent,attempt.installation_id,input.receiptId??null]);
  await tx.query("INSERT INTO workspace_exception_events(exception_id,actor_user_id,action,note) VALUES($1,$2,'requested',$3)",[id,userId,parsed.reason]);
  return {id};
 });
}

export async function decideWorkspaceException(sql:SqlClient,userId:string,workspaceId:string,id:string,action:unknown,note:unknown){
 await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(!uuid(id)||!['approved','rejected','revoked'].includes(String(action))||typeof note!=='string'||note.trim().length<8||note.length>4000)fail('Choose a decision and provide an 8–4000 character explanation.',400);
 return sql.transaction(async tx=>{
  await tx.query('SELECT id FROM product_workspaces WHERE id=$1 FOR UPDATE',[workspaceId]);await writable(tx,userId,workspaceId,true);
  const row=(await tx.query<{status:string;requested_by:string;independent_approval:boolean;expires_at:string}>('SELECT status,requested_by,independent_approval,expires_at FROM workspace_exceptions WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,workspaceId])).rows[0];
  if(!row)fail('Exception unavailable.',404);
  if(row.status===action)return {id,status:row.status==='approved'&&new Date(row.expires_at).getTime()<=Date.now()?'expired':row.status};
  const currentRequires=(await tx.query<{required:boolean}>('SELECT require_exception_approval AS required FROM product_workspace_scan_policies WHERE workspace_id=$1',[workspaceId])).rows[0]?.required??false;
  if(action==='approved'&&(row.independent_approval||currentRequires)&&row.requested_by===userId)fail('A different workspace administrator must approve this request.',403);
  if(action!=='revoked'&&(row.status!=='pending'||new Date(row.expires_at).getTime()<=Date.now())||action==='revoked'&&!['pending','approved'].includes(row.status))fail('This exception can no longer receive that decision.',409);
  await tx.query('UPDATE workspace_exceptions SET status=$2,decided_by=$3,decided_at=now() WHERE id=$1',[id,action,userId]);
  await tx.query('INSERT INTO workspace_exception_events(exception_id,actor_user_id,action,note) VALUES($1,$2,$3,$4)',[id,userId,action,(note as string).trim()]);
  return {id,status:action};
 });
}

export async function listWorkspaceExceptions(sql:SqlClient,userId:string,workspaceId:string,before?:string){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);
 if(before&&!uuid(before))fail('Invalid exception history cursor.',400);
 if(before&&!(await sql.query('SELECT id FROM workspace_exceptions WHERE id=$1 AND workspace_id=$2',[before,workspaceId])).rows.length)fail('Exception history unavailable.',404);
 const rows=await sql.query<{id:string}>(`SELECT e.*,CASE WHEN status IN ('pending','approved') AND expires_at<=now() THEN 'expired' ELSE status END AS effective_status FROM workspace_exceptions e WHERE workspace_id=$1
 AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM workspace_exceptions WHERE id=$2 AND workspace_id=$1))
 ORDER BY created_at DESC,id DESC LIMIT 51`,[workspaceId,before??null]);
 return {exceptions:rows.rows.slice(0,50),nextCursor:rows.rows.length>50?rows.rows[49].id:null,canRequest:!access.workspace.archived_at&&['owner','admin','member'].includes(access.workspace.role),canDecide:!access.workspace.archived_at&&['owner','admin'].includes(access.workspace.role),currentUserId:userId};
}

export async function workspaceExceptionDetail(sql:SqlClient,userId:string,workspaceId:string,id:string){
 const access=await workspaceEvidenceSettings(sql,userId,workspaceId);if(!uuid(id))fail('Exception unavailable.',404);
 const row=(await sql.query<{requested_by:string}>(`SELECT e.*,CASE WHEN status IN ('pending','approved') AND expires_at<=now() THEN 'expired' ELSE status END AS effective_status,
  (independent_approval OR COALESCE((SELECT require_exception_approval FROM product_workspace_scan_policies WHERE workspace_id=e.workspace_id),false)) AS requires_independent_approval
  FROM workspace_exceptions e WHERE id=$1 AND workspace_id=$2`,[id,workspaceId])).rows[0];
 if(!row)fail('Exception unavailable.',404);
 const events=await sql.query('SELECT id,actor_user_id,action,note,created_at FROM workspace_exception_events WHERE exception_id=$1 ORDER BY id',[id]);
 const eligible=await sql.query(`SELECT 1 FROM product_workspace_members m
 JOIN product_workspaces w ON w.id=m.workspace_id JOIN product_organizations o ON o.id=w.organization_id
 LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
 WHERE m.workspace_id=$1 AND w.archived_at IS NULL AND m.user_id<>$2
 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=m.workspace_id AND r.user_id=m.user_id)
 AND (CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END) IN ('owner','admin') LIMIT 1`,[workspaceId,row.requested_by]);
 return {exception:row,events:events.rows,canDecide:!access.workspace.archived_at&&['owner','admin'].includes(access.workspace.role),currentUserId:userId,independentApproverAvailable:eligible.rows.length>0};
}
