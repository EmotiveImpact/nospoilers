import type {Assessment, Comparison, EvidenceSnapshot} from './types.ts';
export function releasePassport(snapshot:EvidenceSnapshot,assessment:Assessment,comparison:Comparison):Record<string,unknown>{
  return {
    schema:'nospoilers.release-passport/v1',
    visibility:'private-export',
    certification:false,
    signatureStatus:'unsigned-summary',
    notice:'This portable summary is not a signed receipt, security certificate or perpetual production guarantee. Verify the referenced original receipt separately.',
    evaluatedAt:assessment.evaluatedAt,
    release:{id:snapshot.release.id,receiptId:snapshot.release.receiptId,coordinate:snapshot.release.coordinate,channel:snapshot.release.channel,artifactSha256:snapshot.release.artifactSha256},
    recordedEvidence:{signatureVerification:snapshot.signature,scannedAt:snapshot.receipt?.scannedAt??null,engineVersion:snapshot.receipt?.engineVersion??null,policyHash:snapshot.receipt?.policyHash??null,status:snapshot.receipt?.status??null,findingCount:snapshot.receipt?.findingCount??null,suppressedCount:assessment.exceptionCount},
    assessment:{beforeDeploy:assessment.beforeDeploy,afterDeploy:assessment.afterDeploy,preview:assessment.preview,checks:assessment.checks.map(({id,label,state,phase})=>({id,label,state,phase}))},
    comparison:{available:comparison.available,previousReleaseId:comparison.previousReleaseId,counts:comparison.counts,policyChanged:comparison.policyChanged,engineChanged:comparison.engineChanged},
    limitations:assessment.limitations,
    redaction:'File paths, findings, credentials, public capability links and reviewer identities are omitted. Release identity and digests remain; review before sharing.',
  };
}
