import { createHash } from 'node:crypto';
import { reserveStagingCapacity } from './staging-budget.ts';
import { notifyJobQueued } from './job-wake.ts';
import type { SqlClient } from './sql.ts';
import { heavyUsageCapSql, FAIR_USE_EXHAUSTED } from './usage.ts';
import type { ScanReport } from '../scanner/types.ts';
import type { SignedReceipt } from '../receipt.ts';
import type { ReleaseChannel } from './release-ledger.ts';
import {uploadWorkspaceScope} from './workspaces.ts';
import {refundJobReservation} from './job-billing.ts';

export type UploadMeta = { coordinate?:string; channel?:ReleaseChannel; sourceRevision?:string|null; ciRunUrl?:string|null };

export type UploadedScan = {
  source_origin_id?:number|null;
  source_schedule_version?:number|null;
  id: string; user_id: string|null; installation_id: number | null; target: string;
  workspace_id:string|null;billing_installation_id:number|null;billing_user_id:string|null;
  token_id:number|null;submission_meta:UploadMeta;receipt_id:number|null;revision_id:number|null;
  artifact_sha256: string; status: 'queued' | 'running' | 'done' | 'failed';
  report_json: ScanReport | null; receipt_json: SignedReceipt | null;
  error: string | null; created_at: string | Date; completed_at: string | Date | null;
};
const fields = 's.id,s.user_id,s.installation_id,s.workspace_id,s.billing_installation_id,s.billing_user_id,s.target,s.artifact_sha256,s.status,s.report_json,s.receipt_json,s.error,s.created_at,s.completed_at,s.token_id,s.submission_meta,s.receipt_id,s.revision_id,s.source_origin_id,s.source_schedule_version';
const access = `(s.workspace_id IS NOT NULL AND EXISTS(SELECT 1 FROM product_workspace_members m
  JOIN product_workspaces w ON w.id=m.workspace_id JOIN product_organizations o ON o.id=w.organization_id
  WHERE m.workspace_id=s.workspace_id AND m.user_id=$1 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=m.workspace_id AND r.user_id=$1) AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR EXISTS(SELECT 1 FROM installation_users legacy WHERE legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$1)))
  OR s.workspace_id IS NULL AND (s.installation_id IS NULL AND s.user_id=$1 OR s.installation_id IN (SELECT installation_id FROM installation_users WHERE user_id=$1)))`;
export function createUploadStore(sql: SqlClient) {
  return {
    async reserveRequest(key: string, limit: number, windowMs: number): Promise<boolean> {
      if (limit <= 0) return true;
      const hashed = createHash('sha256').update(key).digest('hex');
      await sql.query('DELETE FROM request_rate_buckets WHERE expires_at < now()');
      const { rows } = await sql.query(`INSERT INTO request_rate_buckets(key,hits,expires_at)
        VALUES($1,1,now()+$3 * interval '1 millisecond')
        ON CONFLICT(key) DO UPDATE SET hits=request_rate_buckets.hits+1
        WHERE request_rate_buckets.hits < $2 RETURNING key`, [hashed,limit,windowMs]);
      return rows.length>0;
    },
    async queueUploadedScan(input: { id: string; userId: string|null; installationId: number | null; workspaceId?:string; target: string; bytes: Uint8Array; tokenId?:number; meta?:UploadMeta; sourceOriginId?:number; schedule?:{version:number;dueAt:string} }): Promise<string> {
      const queuedId=await sql.transaction(async tx => {
        await tx.query("SELECT name FROM resource_locks WHERE name='staging' FOR UPDATE");
        // Serialize a user's retries before checking idempotency and reserving usage.
        await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[input.userId]);
        if(!input.userId && !input.tokenId)throw Object.assign(new Error('An authenticated scan actor is required.'),{status:403});
        if(input.tokenId){
          const token=await tx.query('SELECT id FROM scan_api_tokens WHERE id=$1 AND installation_id IS NOT DISTINCT FROM $2::bigint AND revoked_at IS NULL FOR SHARE',[input.tokenId,input.installationId]);
          if(!token.rows.length)throw Object.assign(new Error('Invalid scan credential.'),{status:403});
        }
        const workspace=await uploadWorkspaceScope(tx,input.userId,input.installationId,input.workspaceId,input.tokenId);
        if(input.tokenId && !(await tx.query('SELECT id FROM scan_api_tokens WHERE id=$1 AND (workspace_id IS NULL OR workspace_id=$2)',[input.tokenId,workspace.id])).rows.length)
          throw Object.assign(new Error('Scan credential belongs to a different workspace.'),{status:403});
        const billingInstallationId=workspace.billing_installation_id;
        const billingUserId=workspace.billing_user_id;
        if(input.schedule&&input.sourceOriginId===undefined)throw Object.assign(new Error('Scheduled work requires a website source.'),{status:409});
        if(input.sourceOriginId!==undefined){
          if(input.installationId!==null||input.tokenId||!input.userId)throw Object.assign(new Error('An authenticated workspace website is required.'),{status:403});
          const source=await tx.query(`SELECT id FROM watched_origins WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND disconnected_at IS NULL AND paused_at IS NULL AND verified_at IS NOT NULL AND origin_url=$3 FOR SHARE`,[input.sourceOriginId,workspace.id,input.target]);
          if(!source.rows.length)throw Object.assign(new Error('Verify an active website in this workspace before scanning.'),{status:409});
          if(input.schedule){
            const due=await tx.query(`SELECT id FROM watched_origins WHERE id=$1 AND schedule_version=$2 AND schedule_actor_id=$3 AND schedule_hours>0 AND date_trunc('milliseconds',next_check_at)=$4::timestamptz AND next_check_at<=now() FOR UPDATE`,[input.sourceOriginId,input.schedule.version,input.userId,input.schedule.dueAt]);
            if(!due.rows.length)throw Object.assign(new Error('Website schedule changed or is not due.'),{status:409});
            if((await tx.query("SELECT id FROM uploaded_scans WHERE source_origin_id=$1 AND status IN ('queued','running') LIMIT 1",[input.sourceOriginId])).rows.length)throw Object.assign(new Error('A website check is already processing.'),{status:409});
          }
        }
        if(input.installationId!==null && !(await tx.query('SELECT id FROM installations WHERE id=$1 AND NOT suspended AND disconnected_at IS NULL FOR SHARE',[input.installationId])).rows.length)
          throw Object.assign(new Error('This source connection is suspended or unavailable.'),{status:402});
        if(input.installationId!==null&&input.userId&&!(await tx.query("SELECT user_id FROM installation_users WHERE installation_id=$1 AND user_id=$2 AND role IN ('admin','member')",[input.installationId,input.userId])).rows.length)
          throw Object.assign(new Error('Write access to this source is required.'),{status:403});
        const hash=input.sourceOriginId===undefined?createHash('sha256').update(input.bytes).digest('hex'):'';
        const {rows:existing}=await tx.query<{user_id:string;workspace_id:string|null;artifact_sha256:string;installation_id:unknown;source_origin_id:unknown;token_id:unknown;target:string;submission_meta:UploadMeta}>('SELECT user_id,workspace_id,artifact_sha256,installation_id,source_origin_id,token_id,target,submission_meta FROM uploaded_scans WHERE id=$1',[input.id]);
        if(existing[0]) {
          if(existing[0].workspace_id!==null && existing[0].workspace_id!==workspace.id)throw Object.assign(new Error('This submission identifier is already in use.'),{status:409});
          if(existing[0].user_id!==input.userId || Number(existing[0].source_origin_id??0)!==(input.sourceOriginId??0) || Number(existing[0].token_id??0)!==(input.tokenId??0) || existing[0].target!==input.target || (input.sourceOriginId===undefined&&existing[0].artifact_sha256!==hash) || (existing[0].installation_id == null ? null : Number(existing[0].installation_id))!==input.installationId || JSON.stringify(Object.entries(existing[0].submission_meta).sort())!==JSON.stringify(Object.entries(input.meta??{}).sort()))
            throw Object.assign(new Error('This submission identifier is already in use.'),{status:409});
          return input.id;
        }
        await reserveStagingCapacity(tx,input.bytes.byteLength,false);
        if(billingInstallationId!==null) {
          // Workspace membership authorizes the scan. The subscription's legacy billing key
          // must not require access to a different workspace's GitHub connection.
          const active=await tx.query("SELECT b.installation_id FROM billing_accounts b WHERE b.installation_id=$1 AND (b.plan IN ('solo','team') OR b.trial_ends_at>now())",[billingInstallationId]);
          if(!active.rows.length)throw Object.assign(new Error('Workspace coverage has ended.'),{status:402});
          const {rows}=await tx.query(`INSERT INTO hosted_usage_days(installation_id,day,heavy_jobs)
            SELECT b.installation_id,(timezone('utc',now()))::date,1 FROM billing_accounts b
            WHERE b.installation_id=$1 AND (b.plan IN ('solo','team') OR b.trial_ends_at>now())
            ON CONFLICT(installation_id,day) DO UPDATE SET heavy_jobs=hosted_usage_days.heavy_jobs+1
            WHERE hosted_usage_days.heavy_jobs<(SELECT ${heavyUsageCapSql()} FROM billing_accounts b WHERE b.installation_id=$1)
            RETURNING installation_id`,[billingInstallationId]);
          if(!rows.length)throw Object.assign(new Error(FAIR_USE_EXHAUSTED),{status:429});
        } else {
          const {rows}=await tx.query(`INSERT INTO personal_scan_usage(user_id,day,scans)
            SELECT id,(timezone('utc',now()))::date,1 FROM users
            WHERE id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())
            ON CONFLICT(user_id,day) DO UPDATE SET scans=personal_scan_usage.scans+1
            WHERE personal_scan_usage.scans<(SELECT ${heavyUsageCapSql()} FROM users b WHERE b.id=$1) RETURNING user_id`,[billingUserId]);
          if(!rows.length)throw Object.assign(new Error('Personal workspace coverage has ended or today’s hosted scan limit has been reached.'),{status:402});
        }
        await tx.query(`INSERT INTO uploaded_scans(id,user_id,installation_id,target,artifact_bytes,artifact_sha256,token_id,submission_meta,workspace_id,billing_installation_id,billing_user_id,source_origin_id,source_schedule_version)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13)`,[input.id,input.userId,input.installationId,input.target,input.sourceOriginId===undefined?Buffer.from(input.bytes):null,hash,input.tokenId??null,JSON.stringify(input.meta??{}),workspace.id,billingInstallationId,billingUserId,input.sourceOriginId??null,input.schedule?.version??null]);
        await tx.query(`INSERT INTO jobs(delivery_id,installation_id,priority,kind,payload,usage_reserved,usage_day,billing_installation_id,billing_user_id)
          VALUES($1,$2,'heavy',$6,$3::jsonb,true,(timezone('utc',now()))::date,$4,$5)`,[`upload:${input.id}`,input.installationId,JSON.stringify({uploadId:input.id,installationId:input.installationId,userId:input.userId,workspaceId:workspace.id}),billingInstallationId,billingUserId,input.sourceOriginId===undefined?'uploaded_scan':'workspace_origin_scan']);
        if(input.schedule)await tx.query("UPDATE watched_origins SET next_check_at=now()+schedule_hours*interval '1 hour',schedule_error=NULL WHERE id=$1",[input.sourceOriginId]);
        return input.id;
      });
      await notifyJobQueued(sql,'uploaded_scan');
      return queuedId;
    },
    async listUploadedScans(userId:string,installationId?:number,workspaceId?:string):Promise<UploadedScan[]> {
      return (await this.listUploadedScanPage(userId,installationId,workspaceId)).uploads;
    },
    async listUploadedScanPage(userId:string,installationId?:number,workspaceId?:string,options:{before?:string;status?:string;collection?:string}={}):Promise<{uploads:UploadedScan[];nextCursor:string|null}> {
      const status=options.status??'all';
      const collection=options.collection??'all';
      if(!['all','active','attention','passed'].includes(status)||!['all','uploads','attempts'].includes(collection)||options.before!==undefined&&(!options.before||options.before.length>128))throw Object.assign(new Error('Invalid release history filter.'),{status:400});
      const scope='AND ($2::bigint IS NULL OR s.installation_id=$2) AND ($3::uuid IS NULL OR s.workspace_id=$3)';
      const params=[userId,installationId??null,workspaceId??null,options.before??null,status,collection];
      if(options.before&&!(await sql.query(`SELECT s.id FROM uploaded_scans s WHERE ${access} ${scope} AND s.id=$4`,params.slice(0,4))).rows.length)
        throw Object.assign(new Error('This history page is unavailable. Return to the newest releases.'),{status:404});
      const passed="(s.status='done' AND s.report_json->'ok'='true'::jsonb AND (s.report_json->>'status' IS NULL OR s.report_json->>'status'='passed'))";
      const {rows}=await sql.query<UploadedScan>(`SELECT ${fields} FROM uploaded_scans s WHERE ${access}
        ${scope} AND ($4::text IS NULL OR (s.created_at,s.id)<(SELECT cursor.created_at,cursor.id FROM uploaded_scans cursor WHERE cursor.id=$4))
        AND ($6='all' OR $6='uploads' AND s.status='done' OR $6='attempts' AND s.status<>'done')
        AND ($5='all' OR $5='active' AND s.status IN ('queued','running') OR $5='passed' AND ${passed}
          OR $5='attention' AND (s.status='failed' OR s.status='done' AND NOT COALESCE(${passed},false)))
        ORDER BY s.created_at DESC,s.id DESC LIMIT 51`,params);
      const uploads=rows.slice(0,50).map(row=>({...row,installation_id:row.installation_id==null?null:Number(row.installation_id)}));
      return {uploads,nextCursor:rows.length>50?uploads[uploads.length-1].id:null};
    },
    async getUploadedScan(userId:string,id:string):Promise<UploadedScan|null> {
      const {rows}=await sql.query<UploadedScan>(`SELECT ${fields} FROM uploaded_scans s WHERE ${access} AND s.id=$2`,[userId,id]);
      return rows[0]?{...rows[0],installation_id:rows[0].installation_id==null?null:Number(rows[0].installation_id)}:null;
    },
    async getInstallationUpload(installationId:number,id:string):Promise<UploadedScan|null> {
      const {rows}=await sql.query<UploadedScan>(`SELECT ${fields} FROM uploaded_scans s WHERE s.installation_id=$1 AND s.id=$2`,[installationId,id]);
      return rows[0]??null;
    },
    async getWorkspaceTokenUpload(workspaceId:string,id:string):Promise<UploadedScan|null>{
      const {rows}=await sql.query<UploadedScan>(`SELECT ${fields} FROM uploaded_scans s WHERE s.workspace_id=$1 AND s.id=$2`,[workspaceId,id]);
      return rows[0]??null;
    },
    async startUploadedScan(id:string):Promise<(UploadedScan & {artifact_bytes:Uint8Array})|null> {
      const {rows}=await sql.query<UploadedScan & {artifact_bytes:Uint8Array}>(`UPDATE uploaded_scans SET status='running',error=NULL
        WHERE id=$1 AND status IN ('queued','running') AND expires_at>now() AND (artifact_bytes IS NOT NULL OR source_origin_id IS NOT NULL)
        RETURNING *`,[id]);
      return rows[0]?{...rows[0],installation_id:rows[0].installation_id==null?null:Number(rows[0].installation_id)}:null;
    },
    async finishUploadedScan(id:string,report:ScanReport,receipt:SignedReceipt,receiptId?:number,revisionId?:number):Promise<void> {
      await sql.query(`UPDATE uploaded_scans SET status='done',report_json=$2::jsonb,receipt_json=$3::jsonb,
        artifact_bytes=NULL,artifact_sha256=CASE WHEN source_origin_id IS NOT NULL THEN COALESCE($6,artifact_sha256) ELSE artifact_sha256 END,completed_at=now(),error=NULL,receipt_id=$4,revision_id=$5 WHERE id=$1 AND status='running'`,[id,JSON.stringify(report),JSON.stringify(receipt),receiptId??null,revisionId??null,report.artifactSha256??null]);
    },
    async failUploadedScan(id:string,refund=false):Promise<void> {
      await sql.transaction(async tx=>{
        const {rows}=await tx.query<{id:string}>(`UPDATE uploaded_scans SET usage_refunded=true
          WHERE id=$1 AND status<>'done' AND NOT usage_refunded AND $2
          RETURNING id`,[id,refund]);
        if(rows[0]){
          const jobs=await tx.query<{id:number}>('SELECT id FROM jobs WHERE delivery_id=$1',[`upload:${id}`]);
          if(jobs.rows[0])await refundJobReservation(tx,Number(jobs.rows[0].id));
        }
        await tx.query(`UPDATE uploaded_scans SET status='failed',artifact_bytes=NULL,completed_at=now(),
          error='This artifact could not be processed. Upload it again to start a new attempt.' WHERE id=$1 AND status<>'done'`,[id]);
      });
    },
    async expireUploadedScans():Promise<void> {
      const queued=await sql.query<{id:string}>("SELECT id FROM uploaded_scans WHERE expires_at<=now() AND status='queued'");
      for(const row of queued.rows)await this.failUploadedScan(row.id,true);
      await sql.query(`UPDATE uploaded_scans SET artifact_bytes=NULL,status='failed',error='The staged artifact expired before processing.'
        WHERE expires_at<=now() AND status IN ('queued','running')`);
    },
  };
}
