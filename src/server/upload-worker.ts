import { mkdtemp, writeFile, unlink, rmdir, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildUnsignedReceipt, signReceipt } from '../receipt.ts';
import { scan } from '../scanner/index.ts';
import { createStore, type Store } from './store.ts';
import { persistHostedReceipt } from './receipts.ts';
import {captureHostedPolicy,applyHostedPolicySnapshot} from './hosted-policy-snapshot.ts';
import type {SqlClient} from './sql.ts';
import type {UploadedScan} from './upload-store.ts';
import {workspaceSourceAccess} from './workspace-source-access.ts';
import {workspaceArtifactPolicySnapshot,applyWorkspaceArtifactPolicy} from './workspace-policy.ts';
import {crawlOrigin,type WebCrawlOpts} from './web-origin.ts';
import {enqueueWorkspaceAlertNotifications} from './workspace-notification-outbox.ts';
import {enqueueAutomaticCapture} from './automatic-capture.ts';

async function assertScanAccess(sql:SqlClient,upload:UploadedScan){
  if(upload.installation_id!==null&&!(await sql.query('SELECT id FROM installations WHERE id=$1 AND NOT suspended AND disconnected_at IS NULL FOR SHARE',[upload.installation_id])).rows.length)throw new Error('Source connection unavailable.');
  if(upload.token_id && !(await sql.query(`SELECT t.id FROM scan_api_tokens t WHERE t.id=$1 AND t.revoked_at IS NULL
    AND t.installation_id IS NOT DISTINCT FROM $2::bigint AND (t.workspace_id IS NULL OR t.workspace_id=$3::uuid AND (t.installation_id IS NULL OR EXISTS(SELECT 1 FROM product_workspace_installations c WHERE c.workspace_id=t.workspace_id AND c.installation_id=t.installation_id)))
    FOR SHARE OF t`,[upload.token_id,upload.installation_id,upload.workspace_id])).rows.length)throw new Error('Scan token was revoked or its workspace connection changed.');
  if(upload.installation_id!==null && upload.user_id){
    const access=await workspaceSourceAccess(sql,upload.user_id,upload.installation_id);
    if(access.archived||!['admin','member'].includes(access.role??''))throw new Error('Scan access was removed.');
  }
  if(upload.workspace_id){
    const {rows}=await sql.query(`SELECT w.id FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
      LEFT JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$2
      LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$2
      WHERE w.id=$1 AND w.archived_at IS NULL AND ($3::bigint IS NOT NULL OR
        (m.role IN ('owner','admin','member') AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$2)
          AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR legacy.role IN ('admin','member')))) FOR SHARE OF w`,[upload.workspace_id,upload.user_id,upload.token_id]);
    if(!rows.length)throw new Error('Workspace access was removed.');
  }
  // Match lifecycle lock order: workspace, then source. A pause/archive cannot
  // deadlock publication by holding those same rows in the opposite order.
  if(upload.source_schedule_version!=null&&!(await sql.query('SELECT id FROM watched_origins WHERE id=$1 AND schedule_hours>0 AND schedule_version=$2 AND schedule_actor_id=$3 FOR SHARE',[upload.source_origin_id,upload.source_schedule_version,upload.user_id])).rows.length)throw new Error('Website schedule changed.');
  if(upload.source_origin_id && !(await sql.query(`SELECT id FROM watched_origins WHERE id=$1 AND workspace_id=$2 AND installation_id IS NULL AND origin_url=$3 AND disconnected_at IS NULL AND paused_at IS NULL AND verified_at IS NOT NULL FOR SHARE`,[upload.source_origin_id,upload.workspace_id,upload.target])).rows.length)throw new Error('Website ownership or access changed.');
}

export async function processUploadedScan(id:string,store:Store,scanFn:typeof scan,secret:string,lease?:{jobId:number;workerId:string},webOptions?:WebCrawlOpts):Promise<void> {
  const upload=await store.startUploadedScan(id);if(!upload)return;
  let dir:string|undefined;let file:string|undefined;
  let parsingStarted=false;
  try {
    if (!secret) throw new Error('Receipt signing is not configured.');
    await assertScanAccess(store.sql,upload);
    const artifactPolicy=upload.installation_id===null ? await workspaceArtifactPolicySnapshot(store.sql,upload.workspace_id,{artifactSha256:upload.artifact_sha256,sourceOriginId:upload.source_origin_id??null}):null;
    const hostedPolicy=upload.installation_id!==null?await captureHostedPolicy(store.sql,upload.installation_id):null;
    const billingInstallationId=upload.billing_installation_id??upload.installation_id;
    const billingUserId=upload.billing_user_id??upload.user_id;
    const eligible=billingInstallationId!==null
      ? (await store.sql.query("SELECT installation_id FROM billing_accounts WHERE installation_id=$1 AND (plan IN ('solo','team') OR trial_ends_at>now())",[billingInstallationId])).rows.length>0
      : (await store.sql.query('SELECT id FROM users WHERE id=$1 AND (plan IN (\'solo\',\'team\') OR trial_ends_at>now())',[billingUserId])).rows.length>0;
    if(!eligible){await store.failUploadedScan(id,true);return;}
    dir=await mkdtemp(path.join(tmpdir(),'nospoilers-upload-'));
    let crawl:Awaited<ReturnType<typeof crawlOrigin>>|undefined;
    if(upload.source_origin_id){
      crawl=await crawlOrigin(upload.target,webOptions);
      for(const asset of crawl.files){
        const destination=path.resolve(dir,asset.rel);
        if(!destination.startsWith(dir+path.sep))throw new Error('Invalid website asset path.');
        await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,asset.bytes,{mode:0o600});
      }
    }else{
      file=path.join(dir,path.basename(upload.target));
      await writeFile(file,upload.artifact_bytes,{mode:0o600});
    }
    parsingStarted=true;
    let report=await scanFn(file??dir);
    if(crawl)report={...report,artifactSha256:crawl.sha256,artifactBytes:crawl.files.reduce((sum,asset)=>sum+asset.bytes.length,0),...(crawl.truncated?{ok:false,status:'inconclusive' as const,inconclusiveReason:'Website crawl reached its size or asset limit; coverage is incomplete.'}:{})};
    report={...report,target:upload.target};
    if(hostedPolicy)report=applyHostedPolicySnapshot(report,hostedPolicy);
    else report=applyWorkspaceArtifactPolicy(report,artifactPolicy);
    const coordinate=upload.submission_meta.coordinate??`upload:${id}#${upload.target}`;
    await store.sql.transaction(async tx=>{
      if(lease && !(await tx.query("SELECT id FROM jobs WHERE id=$1 AND locked_by=$2 AND status='running' FOR UPDATE",[lease.jobId,lease.workerId])).rows.length)return;
      // Parsing can outlive a membership change. Serialize publication with archive/access writes.
      await assertScanAccess(tx,upload);
      const locked=await tx.query("SELECT id FROM uploaded_scans WHERE id=$1 AND status='running' FOR UPDATE",[id]);
      if(!locked.rows.length)return;
      const scoped=createStore(tx);
      if(upload.source_origin_id)await tx.query(`UPDATE watched_origins SET last_checked_at=now(),last_scanned_at=now(),last_sha256=$2,last_scan_status=$3 WHERE id=$1`,[upload.source_origin_id,report.artifactSha256,report.status]);
      if(upload.installation_id!==null){
        const persisted=await persistHostedReceipt({store:scoped,secret,installationId:upload.installation_id,coordinate,report,...upload.submission_meta});
        await scoped.finishUploadedScan(id,persisted.report,persisted.receipt,persisted.row.id,persisted.revision.id);
      }else{
        const receipt=signReceipt(buildUnsignedReceipt(report,coordinate),secret);
        await scoped.finishUploadedScan(id,report,receipt);
        if(upload.source_origin_id)await enqueueAutomaticCapture(tx,{kind:'upload',id});
        // One response record per immutable attempt. Later checks never silently
        // resolve earlier findings, and a worker retry cannot duplicate an alert.
        if(upload.source_origin_id && report.findings.length>0){
          const published=await tx.query<{id:number}>(`INSERT INTO alerts(workspace_id,source_origin_id,scan_attempt_id,kind,title,body,findings)
            VALUES($1,$2,$3,'web_origin_scan',$4,$5,$6::jsonb)
            ON CONFLICT(scan_attempt_id) WHERE scan_attempt_id IS NOT NULL DO NOTHING RETURNING id`,[
            upload.workspace_id,upload.source_origin_id,id,
            `Exposure found on ${new URL(upload.target).host}`,
            `${report.findings.length} finding(s) in this saved website check.${report.status==='inconclusive'?' Coverage is incomplete; this is not a complete assessment.':''}`,
            JSON.stringify(report.findings),
          ]);
          if(published.rows[0])await enqueueWorkspaceAlertNotifications(tx,upload.workspace_id!,Number(published.rows[0].id));
        }
      }
    });
  } catch {
    // Never return parser paths or raw artifact values to a customer error surface.
    if(!lease || (await store.sql.query("SELECT id FROM jobs WHERE id=$1 AND locked_by=$2 AND status='running'",[lease.jobId,lease.workerId])).rows.length)
      await store.failUploadedScan(id,!parsingStarted);
  } finally {
    if(file)await unlink(file).catch(()=>undefined);
    if(dir){if(upload.source_origin_id)await rm(dir,{recursive:true,force:true}).catch(()=>undefined);else await rmdir(dir).catch(()=>undefined);}
  }
}
