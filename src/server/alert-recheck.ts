import type {Store} from './store.ts';

/** Only offer a repeatable operation when the persisted alert identifies its source.
 * Titles, URLs and finding text are not trustworthy resource identifiers. */
export async function alertRecheckTarget(store:Store,userId:string,alertId:number){
  const alert=await store.getAlertForUser(alertId,userId);
  if(!alert)return null;
  if(alert.kind==='release_scan'&&alert.repo_id){
    const repo=await store.getRepo(Number(alert.repo_id));
    if(repo&&Number(repo.installation_id)===Number(alert.installation_id))return {
      installationId:Number(alert.installation_id),
      endpoint:`/api/repos/${repo.id}/scan-latest-release`,
      label:'Scan latest release',
      detail:'Scan the latest published release from this repository. This creates a new result; it does not resolve this alert or rescan an immutable historical asset.',
    };
  }
  return {installationId:Number(alert.installation_id),endpoint:null,label:null,
    detail:'Open Coverage to review this source and choose its available checks. This alert has no supported direct recheck.'};
}
