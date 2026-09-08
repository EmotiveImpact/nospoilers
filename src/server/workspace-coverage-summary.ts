import type {SqlClient} from './sql.ts';
import {sourceMonitoring} from './source-monitoring.ts';

/** Caller must first authorize the workspace. Saved release decisions are not health. */
export async function workspaceCoverageSummary(sql:SqlClient,workspaceId:string,intervalMs:number,now=Date.now()){
  const {rows}=await sql.query<{id:number;name:string;installation_id:number;account_login:string;kind:string;paused:boolean;unavailable:boolean;last_checked_at:string|null}>(`
    SELECT s.id,s.name,s.installation_id,i.account_login,s.kind,s.paused,s.last_checked_at,i.suspended AS unavailable FROM (
      SELECT id,full_name AS name,installation_id,'repository' AS kind,false AS paused,last_checked_at FROM repos WHERE disconnected_at IS NULL
      UNION ALL SELECT id,package_name,installation_id,'package',paused_at IS NOT NULL,last_checked_at FROM watched_packages WHERE disconnected_at IS NULL
      UNION ALL SELECT id,project_slug,installation_id,'custody',paused_at IS NOT NULL,
        CASE WHEN last_status IS NULL OR last_status='inconclusive' THEN NULL ELSE last_checked_at END
        FROM map_destinations WHERE disconnected_at IS NULL
      UNION ALL SELECT id,origin_url,installation_id,'website',paused_at IS NOT NULL,
        CASE WHEN (verification_token IS NOT NULL AND verified_at IS NULL)
          OR last_scan_status IS NULL OR last_scan_status NOT IN ('passed','failed-policy')
          THEN NULL ELSE last_checked_at END
        FROM watched_origins WHERE disconnected_at IS NULL AND installation_id IS NOT NULL
    ) s JOIN product_workspace_installations c ON c.installation_id=s.installation_id
    JOIN installations i ON i.id=s.installation_id
    WHERE c.workspace_id=$1 AND i.disconnected_at IS NULL`,[workspaceId]);
  const summary={total:rows.length,paused:0,unavailable:0,unknown:0,delayed:0,recent:0};
  const sources: Array<{key:string;name:string;installationId:number;connectionName:string;health:string}> = [];
  for(const row of rows){
    const cadence=row.kind==='custody'||row.kind==='website'?Math.max(3_600_000,intervalMs):intervalMs;
    const checked=row.last_checked_at?new Date(row.last_checked_at).toISOString():null;
    const freshness=row.unavailable?'unavailable':row.paused?'paused':sourceMonitoring(cadence,checked,now).freshness as 'unknown'|'delayed'|'recent';
    summary[freshness]++;
    const prefix={repository:'repo',package:'npm',custody:'map',website:'web'}[row.kind];
    sources.push({key:`${prefix}-${row.id}`,name:row.name,installationId:Number(row.installation_id),connectionName:row.account_login,health:freshness});
  }
  const connections=Array.from(new Map(rows.map(row=>[Number(row.installation_id),{installationId:Number(row.installation_id),name:row.account_login}])).values()).sort((a,b)=>a.name.localeCompare(b.name)||a.installationId-b.installationId);
  return {...summary,connections,sources};
}
