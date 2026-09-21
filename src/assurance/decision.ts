import {evidenceProblem, isDigest, MAX_CLOCK_SKEW_MS, recordedTime} from './evidence.ts';
import type {Assessment, Check, CheckState, EvidenceSnapshot, ReviewOptions} from './types.ts';
export const DEFAULT_DELIVERY_FRESHNESS_MS = 24 * 60 * 60 * 1000;

export function assessRelease(snapshot: EvidenceSnapshot, now = Date.now(), options: ReviewOptions = {}): Assessment {
  if (!Number.isFinite(now)) throw new Error('A finite evaluation clock is required.');
  const {release, receipt} = snapshot;
  const problem = evidenceProblem(snapshot, now);
  const checks: Check[] = [];
  const limitations = [
    'A passing decision covers the recorded exposure policy and inspected bytes only, not all security risks.',
    'Delivery checks cover attached URLs at the stated time, not every public endpoint or asset.',
    'This review does not change the saved policy, approve a release or block a deployment by itself.',
  ];
  checks.push({id:'receipt',label:'Receipt integrity',state:problem?'unknown':'passed',detail:problem??'The server verified the receipt signature and its release binding.',phase:'before-deploy'});
  const scanState: CheckState = problem || !receipt || receipt.status === 'inconclusive' ? 'unknown' : receipt.status === 'failed-policy' || release.mismatch ? 'failed' : 'passed';
  checks.push({id:'scan',label:'Recorded exposure policy',state:scanState,detail:problem?'Do not infer a passing scan from incomplete evidence.':receipt?.status==='inconclusive'?'The inspection was inconclusive. A new completed check is required.':scanState==='failed'?'The saved scan failed its policy or the recorded artefact digest changed.':`Passed the recorded policy${receipt?.policyHash?` (${receipt.policyHash.slice(0,12)}…)`:'. No custom policy fingerprint was recorded'}.`,phase:'before-deploy'});
  const suppressed = problem ? null : receipt!.suppressedCount;
  const warnings = !problem && receipt!.findingCount > 0 && scanState === 'passed';
  checks.push({id:'exceptions',label:'Accepted exceptions',state:suppressed===null?'unknown':suppressed>0?'review':'passed',detail:suppressed===null?'Exception evidence is unavailable.':suppressed>0?`${suppressed} finding(s) were suppressed under the recorded policy. Passing with exceptions does not mean nothing was found.`:'No suppressed findings were recorded.',phase:'before-deploy'});
  if (warnings) checks.push({id:'findings',label:'Non-blocking findings',state:options.strictReview?'failed':'review',detail:options.strictReview?'Preview only: treating all recorded findings as blocking. The saved decision is unchanged.':`${receipt!.findingCount} non-blocking finding(s) remain for review.`,phase:'before-deploy'});
  const approval = release.approval;
  const governed = Boolean(approval || release.legalHold?.active || options.requireApproval);
  const governance: CheckState = release.legalHold?.active || approval?.decision==='rejected' ? 'failed' : approval?.decision==='approved' && recordedTime(approval.createdAt)!==null && recordedTime(approval.createdAt)! <= now + MAX_CLOCK_SKEW_MS ? 'passed' : governed ? 'unknown' : 'not-configured';
  checks.push({id:'governance',label:'Recorded approval / hold',state:governance,detail:release.legalHold?.active?'A recorded hold needs review by an authorised person.':approval?.decision==='rejected'?'An authorised reviewer rejected this release.':governance==='passed'?'An approval is recorded. It never overrides failed scan evidence.':governed?'A valid approval record is required for this review.':'No approval requirement is inferred from an absent record.',phase:'before-deploy'});
  const att = release.attestations??[];
  checks.push({id:'attestations',label:'Source attestations',state:att.length?'review':'not-configured',detail:att.length?'Attestation metadata is present. Cryptographic provenance verification is not established by this record.':'No attestation metadata is recorded. This is not a verified identity claim.',phase:'before-deploy'});
  if (att.length) limitations.push('Attestation presence is not Sigstore/SLSA signature verification and is not used to establish readiness.');
  let afterDeploy: CheckState = 'not-configured';
  const locations = release.locations??[];
  const freshness = options.deliveryFreshnessMs ?? DEFAULT_DELIVERY_FRESHNESS_MS;
  if (!Number.isFinite(freshness) || freshness <= 0 || freshness > 7*24*60*60*1000) throw new Error('Delivery freshness must be greater than zero and no more than seven days.');
  const states: CheckState[] = locations.map(location => {
    const at = recordedTime(location.lastCheckedAt);
    if (problem || location.revisionId !== release.id || at===null || at>now+MAX_CLOCK_SKEW_MS || at<recordedTime(receipt!.scannedAt)!) return 'unknown';
    if (now-at>freshness) return 'stale';
    if (location.lastStatus==='mismatch') return 'failed';
    if (location.lastStatus==='matched') return isDigest(location.lastSha256) && location.lastSha256.toLowerCase()===release.artifactSha256.toLowerCase()?'passed':'unknown';
    return 'unknown'; // Unreachable, missing and errors do not prove byte mismatch.
  });
  if (states.length) afterDeploy = states.includes('failed')?'failed':states.includes('unknown')?'unknown':states.includes('stale')?'stale':states.every(state=>state==='passed')?'passed':'unknown';
  const deliveryDetail = afterDeploy==='passed'?`${locations.length} attached delivery URL(s) matched the sealed digest within this review's freshness window.`:afterDeploy==='failed'?'A recent, bound delivery check recorded a byte mismatch.':afterDeploy==='stale'?'Recorded delivery evidence is older than this review\'s freshness window.':afterDeploy==='not-configured'?'No delivery URL is attached. Production has not been verified by this review.':'Delivery evidence is incomplete, unreachable, unbound or not yet checked.';
  checks.push({id:'delivery',label:'After-deployment snapshot',state:afterDeploy,detail:deliveryDetail,phase:'after-deploy'});
  // Before-deploy never waits on an after-deploy event. Attestation presence is informational.
  const before = checks.filter(check=>check.phase==='before-deploy'&&check.id!=='attestations');
  const beforeDeploy = before.some(check=>check.state==='failed')?'blocked':before.some(check=>check.state==='unknown')?'unknown':before.some(check=>check.state==='review')?'review':'ready';
  const title = beforeDeploy==='ready'?'Passes recorded checks':beforeDeploy==='blocked'?'Recorded checks block release':beforeDeploy==='review'?'Review recorded findings':'Evidence is incomplete';
  const summary = beforeDeploy==='ready'?'The inspected artefact passes the recorded checks. Production verification is a separate stage.':beforeDeploy==='blocked'?'Resolve or formally review the blocking evidence, then produce a new scan record.':beforeDeploy==='review'?'Review the remaining findings or accepted exceptions before making a release decision.':'Unknown does not mean safe or unsafe. Complete or verify the missing evidence.';
  const nextAction = problem||scanState==='unknown'?'inspect-evidence':scanState==='failed'||warnings?'review-findings':suppressed?'review-exceptions':governance==='failed'||governance==='unknown'?'review-approval':afterDeploy==='not-configured'?'configure-delivery':afterDeploy!=='passed'?'verify-delivery':'keep-watching';
  return {version:1,evaluatedAt:new Date(now).toISOString(),releaseId:release.id,receiptId:release.receiptId,beforeDeploy,afterDeploy,title,summary,nextAction,checks,limitations,preview:Boolean(options.strictReview||options.requireApproval),exceptionCount:suppressed};
}
