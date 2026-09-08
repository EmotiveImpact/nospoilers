import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {SqlClient} from './sql.ts';
import type {SignedReceipt} from '../receipt.ts';

export const uploadProofSharingSchema=`
ALTER TABLE product_workspace_events DROP CONSTRAINT IF EXISTS product_workspace_events_action_check;
ALTER TABLE product_workspace_events ADD CONSTRAINT product_workspace_events_action_check CHECK(action IN ('created','renamed','archived','restored','invited','invite_revoked','invite_accepted','role_changed','member_removed','proof-published','proof-revoked'));
CREATE TABLE IF NOT EXISTS uploaded_proof_shares (
 id UUID PRIMARY KEY, upload_id TEXT NOT NULL REFERENCES uploaded_scans(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, projection JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uploaded_proof_active ON uploaded_proof_shares(upload_id) WHERE revoked_at IS NULL;
CREATE OR REPLACE FUNCTION guard_uploaded_proof_share() RETURNS trigger AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.upload_id IS DISTINCT FROM OLD.upload_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.projection IS DISTINCT FROM OLD.projection OR NEW.created_at IS DISTINCT FROM OLD.created_at OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
  RAISE EXCEPTION 'Published proof snapshots are immutable; publish a new link instead';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS uploaded_proof_immutable ON uploaded_proof_shares;
CREATE TRIGGER uploaded_proof_immutable BEFORE UPDATE ON uploaded_proof_shares FOR EACH ROW EXECUTE FUNCTION guard_uploaded_proof_share();
`;
const unavailable=()=>Object.assign(new Error('Proof unavailable.'),{status:404});
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');

/** A deliberate whitelist: never publish the original signed receipt, paths, names or fingerprints. */
export function redactedProof(receipt:SignedReceipt){
 return {version:1,kind:'redacted-scan-summary',artifactSha256:receipt.artifactSha256,
  scannedAt:receipt.scannedAt,status:receipt.status,policyPassed:receipt.ok,
  findingCount:receipt.findingCount,maxSeverity:receipt.maxSeverity,
  assurance:'Recorded scan summary, not independent issuer or signature verification. Not a guarantee of security.'};
}
async function authorised(sql:SqlClient,userId:string,id:string){
 const {rows}=await sql.query<{workspace_id:string;archived_at:string|null;receipt_json:SignedReceipt|null;status:string}>(`
 SELECT s.workspace_id,w.archived_at,s.receipt_json,s.status FROM uploaded_scans s
 JOIN product_workspaces w ON w.id=s.workspace_id
 JOIN product_organizations o ON o.id=w.organization_id
 JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1
 LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=m.user_id
 WHERE s.id=$2 AND (CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END) IN ('owner','admin')
 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=m.user_id)
 FOR SHARE OF s,w,m`,[userId,id]);
 if(!rows[0])throw unavailable();return rows[0];
}
export async function previewUploadedProof(sql:SqlClient,userId:string,id:string){
 return sql.transaction(async tx=>{const scan=await authorised(tx,userId,id);
 const {rows}=await tx.query<{id:string;created_at:string}>('SELECT id,created_at FROM uploaded_proof_shares WHERE upload_id=$1 AND revoked_at IS NULL',[id]);
 return {preview:scan.receipt_json?redactedProof(scan.receipt_json):null,active:rows[0]??null,canPublish:!scan.archived_at&&scan.status==='done'&&!!scan.receipt_json};});
}
export async function publishUploadedProof(sql:SqlClient,userId:string,id:string){
 return sql.transaction(async tx=>{
 // Serialise replacements so only one public capability survives concurrent publication.
 await tx.query('SELECT id FROM uploaded_scans WHERE id=$1 FOR UPDATE',[id]);
 const scan=await authorised(tx,userId,id);
 if(scan.archived_at||scan.status!=='done'||!scan.receipt_json)throw Object.assign(new Error('Only completed evidence in an active workspace can be shared.'),{status:409});
 await tx.query('UPDATE uploaded_proof_shares SET revoked_at=now() WHERE upload_id=$1 AND revoked_at IS NULL',[id]);
 const token=randomBytes(32).toString('base64url'),shareId=randomUUID(),projection=redactedProof(scan.receipt_json);
 await tx.query('INSERT INTO uploaded_proof_shares(id,upload_id,token_hash,projection) VALUES($1,$2,$3,$4::jsonb)',[shareId,id,hash(token),JSON.stringify(projection)]);
 await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action) VALUES($1,$2,$3,'proof-published')",[randomUUID(),scan.workspace_id,userId]);
 return {token,preview:projection};
 });
}
export async function revokeUploadedProof(sql:SqlClient,userId:string,id:string){
 return sql.transaction(async tx=>{await tx.query('SELECT id FROM uploaded_scans WHERE id=$1 FOR UPDATE',[id]);const scan=await authorised(tx,userId,id);
 await tx.query('UPDATE uploaded_proof_shares SET revoked_at=now() WHERE upload_id=$1 AND revoked_at IS NULL',[id]);
 await tx.query("INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action) VALUES($1,$2,$3,'proof-revoked')",[randomUUID(),scan.workspace_id,userId]);
 return {ok:true};});
}
export async function readUploadedProof(sql:SqlClient,token:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw unavailable();
 const {rows}=await sql.query<{projection:ReturnType<typeof redactedProof>}>('SELECT projection FROM uploaded_proof_shares WHERE token_hash=$1 AND revoked_at IS NULL',[hash(token)]);
 if(!rows[0])throw unavailable();return rows[0].projection;
}
