import type {Store} from './store.ts';

/** Only offer a repeatable operation when the persisted alert identifies its source.
 * Titles, URLs and finding text are not trustworthy resource identifiers. */
export async function alertRecheckTarget(store:Store,userId:string,alertId:number){
  const alert=await store.getAlertForUser(alertId,userId);
  if(!alert)return null;
  const candidate=alert.repo_id?await store.getRepo(Number(alert.repo_id)):null;
  const repo=candidate&&Number(candidate.installation_id)===Number(alert.installation_id)?candidate:null;
  if(alert.kind==='release_scan'&&repo){
    return {
      installationId:Number(alert.installation_id),repoId:Number(repo.id),
      endpoint:`/api/repos/${repo.id}/scan-latest-release`,
      label:'Scan latest release',
      detail:'Scan the latest published release from this repository. This creates a new result; it does not resolve this alert or rescan an immutable historical asset.',
    };
  }
  return {installationId:Number(alert.installation_id),repoId:repo?Number(repo.id):null,endpoint:null,label:null,
    detail:alert.kind==='push_sensitive_path'
      ? 'This warning came from a GitHub push, not an artifact scan. After reviewing the file, upload the build customers receive to check what actually ships.'
      : 'This event cannot be repeated as an artifact scan. Upload a build for new evidence, or review the recorded repository’s available checks.'};
}
