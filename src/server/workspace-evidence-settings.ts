import type {SqlClient} from './sql.ts';

/** Read-only settings describe enforced behaviour, never an unenforced retention preference. */
export async function workspaceEvidenceSettings(sql:SqlClient,userId:string,workspaceId:string,before?:string){
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const fail=(message:string,status:400|404):never=>{throw Object.assign(new Error(message),{status});};
 if(!uuid.test(workspaceId))fail('Workspace unavailable.',404);
 if(before&&!uuid.test(before))fail('Invalid history cursor.',400);
 const {rows}=await sql.query<{name:string;organization_id:string;archived_at:string|null;role:string;organization_owner:boolean}>(`SELECT w.name,w.organization_id,w.archived_at,
 CASE WHEN m.access_source='legacy' AND o.legacy_installation_id IS NOT NULL THEN legacy.role ELSE m.role END AS role,
 EXISTS(SELECT 1 FROM product_organization_members om WHERE om.organization_id=w.organization_id AND om.user_id=$2 AND om.role='owner') AS organization_owner
 FROM product_workspaces w JOIN product_organizations o ON o.id=w.organization_id
 JOIN product_workspace_members m ON m.workspace_id=w.id AND m.user_id=$2
 LEFT JOIN installation_users legacy ON legacy.installation_id=o.legacy_installation_id AND legacy.user_id=$2
 WHERE w.id=$1 AND NOT EXISTS(SELECT 1 FROM product_workspace_revocations r WHERE r.workspace_id=w.id AND r.user_id=$2)
 AND (m.access_source='explicit' OR o.legacy_installation_id IS NULL OR legacy.user_id IS NOT NULL)`,[workspaceId,userId]);
 if(!rows[0])fail('Workspace unavailable.',404);
 if(before&&!(await sql.query('SELECT id FROM product_workspace_events WHERE id=$1 AND workspace_id=$2',[before,workspaceId])).rows.length)fail('History page unavailable.',404);
 const [events,counts]=await Promise.all([
 sql.query<{id:string;action:string;actor:string|null;created_at:string}>(`SELECT e.id,e.action,u.login AS actor,e.created_at FROM product_workspace_events e
 LEFT JOIN users u ON u.id=e.actor_user_id WHERE e.workspace_id=$1
 AND ($2::uuid IS NULL OR (e.created_at,e.id)<(SELECT c.created_at,c.id FROM product_workspace_events c WHERE c.id=$2 AND c.workspace_id=$1))
 ORDER BY e.created_at DESC,e.id DESC LIMIT 51`,[workspaceId,before??null]),
 sql.query<{saved:string|number;active:string|number}>(`SELECT count(*) FILTER(WHERE status IN ('done','failed')) AS saved,count(*) FILTER(WHERE status IN ('queued','running')) AS active FROM uploaded_scans WHERE workspace_id=$1`,[workspaceId])
 ]);
 return {workspace:rows[0],retention:{disconnect:'retain_history' as const,stagedArtifacts:'removed_after_processing_or_expiry' as const,savedScans:Number(counts.rows[0]?.saved??0),activeScans:Number(counts.rows[0]?.active??0)},events:events.rows.slice(0,50),nextCursor:events.rows.length>50?events.rows[49].id:null};
}
