import type { Context } from 'hono';
import type { Store } from './store.ts';

const resourceTables:Record<string,string>={
  repos:'repos',alerts:'alerts',packages:'watched_packages',origins:'watched_origins',
  namespaces:'protected_namespaces',registries:'npm_registries','scan-tokens':'scan_api_tokens',
  'map-destinations':'map_destinations',exceptions:'policy_exceptions',releases:'release_revisions',
  destinations:'notification_destinations',
};
const accountActions=new Set(['/api/auth/logout','/api/scan','/api/scan/pending','/api/origin-intent','/api/receipts/verify']);

/** Read-only roles never inherit old member write behavior. Existing admin checks still apply. */
export async function viewerWriteDenied(c:Context,store:Store,userId:string):Promise<boolean>{
  if(['GET','HEAD','OPTIONS'].includes(c.req.method) || accountActions.has(c.req.path) || c.req.path.startsWith('/api/internal/'))return false;
  // These handlers perform organisation-level checks; an unrelated install's viewer role
  // must not block management of a person's own workspace.
  if(c.req.path==='/api/billing/checkout'||c.req.path==='/api/billing/portal'||c.req.path==='/api/workspaces' || c.req.path.startsWith('/api/workspace-invitations/') || /^\/api\/(?:workspaces|organizations)\/[0-9a-f-]+(?:\/|$)/i.test(c.req.path))return false;
  // Sharing checks the actual upload's workspace administrator inside its transaction.
  if(/^\/api\/uploads\/[^/]+\/sharing$/.test(c.req.path))return false;
  const memberships=await store.listInstallationsForUser(userId);
  if(!memberships.some(m=>m.role==='viewer'))return false;
  const scopes=new Set<number>();
  const query=Number(c.req.query('installationId'));
  if(query>0)scopes.add(query);
  if(c.req.header('content-type')?.includes('application/json')){
    const body=await c.req.json().catch(()=>null) as {installationId?:unknown}|null;
    const id=Number(body?.installationId);if(id>0)scopes.add(id);
  }
  const match=/^\/api\/([^/]+)\/(\d+)(?:\/|$)/.exec(c.req.path);
  if(match){
    if(match[1]==='installations')scopes.add(Number(match[2]));
    else if(resourceTables[match[1]]){
      // Table identifier comes exclusively from the literal map above, never from input.
      const {rows}=await store.sql.query<{installation_id:unknown}>(`SELECT installation_id FROM ${resourceTables[match[1]]} WHERE id=$1`,[Number(match[2])]);
      if(rows[0])scopes.add(Number(rows[0].installation_id));
    }
  }
  if(!scopes.size)return true; // A mixed-role account must choose an explicit writable workspace.
  return [...scopes].some(id=>memberships.find(m=>m.id===id)?.role==='viewer');
}
