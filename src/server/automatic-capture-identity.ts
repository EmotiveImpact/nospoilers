import {sourceKey} from '../assurance/evidence.ts';
import type {Ref} from '../release-intelligence/model.ts';
import type {SqlClient} from './sql.ts';
import {createStore} from './store.ts';

export type CaptureIdentity={source:string;selector:string;channel:string;format:string;generation:string;workspaceId:string|null;installationId:number|null;createdAt:string};
/** Metadata only, no network or filename-only grouping. Call after authorisation
 * or from the trusted completion transaction. Locks serialize worker capture
 * with source disconnection, after the caller takes the workspace lock. */
export async function captureIdentity(sql:SqlClient,ref:Ref,lock=false):Promise<CaptureIdentity|null>{
  const share=lock?' FOR SHARE':'';
  if(ref.kind==='upload'){
    const row=(await sql.query<{workspace_id:string;source_origin_id:number;installation_id:number|null;created_at:string|Date;format:string;channel:string}>(`
      SELECT workspace_id,source_origin_id,installation_id,created_at,report_json->>'kind' AS format,
        COALESCE(submission_meta->>'channel','stable') AS channel
      FROM uploaded_scans WHERE id=$1 AND status='done' AND source_origin_id IS NOT NULL`,[ref.id])).rows[0];
    if(!row||row.installation_id!==null||!row.workspace_id||!row.format)return null;
    const origin=(await sql.query<{connection_generation:string}>(`SELECT connection_generation FROM watched_origins
      WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND disconnected_at IS NULL AND paused_at IS NULL
      AND verified_at IS NOT NULL${share}`,[row.source_origin_id,row.workspace_id])).rows[0];
    if(!origin)return null;
    return {source:`website:${row.source_origin_id}`,selector:`website:${row.source_origin_id}`,channel:row.channel,format:`scan:${row.format}`,
      generation:String(origin.connection_generation),workspaceId:row.workspace_id,installationId:null,createdAt:new Date(row.created_at).toISOString()};
  }
  const row=await createStore(sql).getReleaseRevision(Number(ref.id));
  if(!row?.media_type)return null;
  const install=(await sql.query(`SELECT id FROM installations WHERE id=$1 AND NOT suspended AND disconnected_at IS NULL${share}`,[row.installation_id])).rows[0];
  if(!install)return null;
  const selector=sourceKey(row.coordinate);if(!selector)return null;
  let source:string;let generation:string|undefined;
  if(row.repo_id!==null){
    const result=await sql.query<{connection_generation:string}>(`SELECT connection_generation FROM repos WHERE id=$1 AND installation_id=$2 AND disconnected_at IS NULL${share}`,[row.repo_id,row.installation_id]);
    generation=result.rows[0]?.connection_generation;source=`repository:${row.repo_id}`;
    // An explicitly selected release asset is required, not the whole repository.
    if(!selector.startsWith('github:')||!selector.includes('#'))return null;
  }else if(row.package_id!==null){
    const result=await sql.query<{connection_generation:string}>(`SELECT connection_generation FROM watched_packages WHERE id=$1 AND installation_id=$2 AND disconnected_at IS NULL AND paused_at IS NULL${share}`,[row.package_id,row.installation_id]);
    generation=result.rows[0]?.connection_generation;source=`package:${row.package_id}`;
    if(!selector.startsWith('npm:'))return null;
  }else if(row.coordinate.startsWith('web:')){
    const result=await sql.query<{connection_generation:string}>(`SELECT connection_generation FROM watched_origins WHERE installation_id=$1 AND origin_url=$2 AND disconnected_at IS NULL AND paused_at IS NULL AND (verification_token IS NULL OR verified_at IS NOT NULL)${share}`,[row.installation_id,row.coordinate.slice(4)]);
    if(result.rows.length!==1)return null;
    generation=result.rows[0].connection_generation;source=`coordinate:${row.coordinate}`;
  }else return null;
  if(generation===undefined)return null;
  return {source:`installation:${row.installation_id}:${source}`,selector,channel:row.channel,format:`media:${row.media_type}`,
    generation:String(generation),installationId:row.installation_id,workspaceId:null,createdAt:row.created_at};
}
