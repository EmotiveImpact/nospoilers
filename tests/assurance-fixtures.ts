import type {EvidenceSnapshot,ReceiptEvidence} from '../src/assurance/types.ts';
export const NOW=Date.parse('2026-09-08T18:00:00Z');
export const DIGEST='a'.repeat(64), OTHER='b'.repeat(64), POLICY='c'.repeat(64);
export function sample(id=2):EvidenceSnapshot{
 const at=id===1?'2026-09-07T16:00:00Z':'2026-09-08T16:00:00Z';
 const receipt:ReceiptEvidence={coordinate:`npm:@example/sdk@1.0.${id}`,artifactSha256:DIGEST,engineVersion:'0.1.0',scannedAt:at,status:'passed',ok:true,inconclusiveReason:null,policyHash:POLICY,findingCount:0,findingFingerprints:[],findingRuleIds:[],suppressedCount:0,suppressedFingerprints:[],manifest:[{path:'index.js',size:100,sha256:DIGEST}],artifactBytes:1000,channel:'stable'};
 return {scopeKey:'installation:7',signature:'verified',receipt,release:{id,receiptId:id,coordinate:receipt.coordinate,channel:'stable',artifactSha256:DIGEST,artifactBytes:1000,mediaType:'application/gzip',createdAt:at,receiptStatus:'passed',mismatch:false,locations:[]}};
}
export function warning():EvidenceSnapshot{
 const value=sample();value.receipt!.findingCount=1;value.receipt!.findingFingerprints=['MAP-002|warn|bundle.js.map|Map'];value.receipt!.findingRuleIds=['MAP-002'];return value;
}
export function delivery(){return {id:1,revisionId:2,host:'cdn.example.test',lastStatus:'matched',lastSha256:DIGEST,lastCheckedAt:'2026-09-08T17:00:00Z'};}
