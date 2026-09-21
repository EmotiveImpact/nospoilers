import assert from 'node:assert/strict';
import {assessRelease} from '../src/assurance/decision.ts';
import {readReceipt,sourceKey,recordedTime,eligiblePredecessors} from '../src/assurance/evidence.ts';
import {compareReleases,sizeHistory,unavailableComparison} from '../src/assurance/history.ts';
import {investigate} from '../src/assurance/assistant.ts';
import {buildAssuranceView} from '../src/assurance/index.ts';
import {readAssuranceView} from '../src/assurance/view.ts';
import {sample,warning,delivery,NOW,DIGEST,OTHER} from './assurance-fixtures.ts';
export const assuranceCases:Array<[string,()=>void|Promise<void>]>=[];
const add=(name:string,run:()=>void)=>assuranceCases.push([name,run]);
add('valid receipt passes recorded checks without pretending production is verified',()=>{const result=assessRelease(sample(),NOW);assert.equal(result.beforeDeploy,'ready');assert.equal(result.afterDeploy,'not-configured');assert.match(result.title,/recorded/);});
for(const signature of ['invalid','unavailable'] as const)add(`${signature} signature never passes`,()=>{const s=sample();s.signature=signature;assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('missing receipt never passes',()=>{const s=sample();s.receipt=null;assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('failed-policy blocks even when an approval is recorded',()=>{const s=warning();s.receipt!.status='failed-policy';s.receipt!.ok=false;s.release.receiptStatus='failed-policy';s.release.approval={decision:'approved',actorLogin:'reviewer',createdAt:'2026-09-08T17:00:00Z'};assert.equal(assessRelease(s,NOW).beforeDeploy,'blocked');});
add('inconclusive is unknown, not clean and not a claimed exploit',()=>{const s=sample();s.receipt!.status='inconclusive';s.receipt!.ok=false;s.receipt!.inconclusiveReason='timeout';s.release.receiptStatus='inconclusive';assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('changed recorded digest blocks',()=>{const s=sample();s.release.mismatch=true;assert.equal(assessRelease(s,NOW).beforeDeploy,'blocked');});
add('receipt digest mismatch is unknown evidence',()=>{const s=sample();s.receipt!.artifactSha256=OTHER;assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('receipt coordinate mismatch is unknown',()=>{const s=sample();s.receipt!.coordinate='npm:other@1';assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('receipt channel mismatch is unknown',()=>{const s=sample();s.receipt!.channel='beta';assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('future evidence does not pass',()=>{const s=sample();s.receipt!.scannedAt='2027-09-08T16:00:00Z';assert.equal(assessRelease(s,NOW).beforeDeploy,'unknown');});
add('warn findings require review and strict preview does not mutate evidence',()=>{const s=warning(),copy=JSON.stringify(s);assert.equal(assessRelease(s,NOW).beforeDeploy,'review');const preview=assessRelease(s,NOW,{strictReview:true});assert.equal(preview.beforeDeploy,'blocked');assert.equal(preview.preview,true);assert.equal(JSON.stringify(s),copy);});
add('suppressed findings remain visible as accepted risk',()=>{const s=sample();s.receipt!.suppressedCount=1;s.receipt!.suppressedFingerprints=['SEC-001|critical|.env|Environment'];const result=assessRelease(s,NOW);assert.equal(result.beforeDeploy,'review');assert.equal(result.exceptionCount,1);});
add('absent optional approval is not invented as a requirement',()=>assert.equal(assessRelease(sample(),NOW).beforeDeploy,'ready'));
add('explicit approval requirement with no evidence is unknown',()=>assert.equal(assessRelease(sample(),NOW,{requireApproval:true}).beforeDeploy,'unknown'));
add('rejection blocks',()=>{const s=sample();s.release.approval={decision:'rejected',actorLogin:'reviewer',createdAt:'2026-09-08T17:00:00Z'};assert.equal(assessRelease(s,NOW).beforeDeploy,'blocked');});
add('hold blocks independently of a clean receipt',()=>{const s=sample();s.release.legalHold={active:true};assert.equal(assessRelease(s,NOW).beforeDeploy,'blocked');});
add('attestation presence is not cryptographic verification',()=>{const s=sample();s.release.attestations=[{source:'npm',status:'present',createdAt:'2026-09-08T17:00:00Z'}];const check=assessRelease(s,NOW).checks.find(c=>c.id==='attestations')!;assert.equal(check.state,'review');assert.match(check.detail,/not established/);});
add('fresh bound delivery passes only the after-deploy stage',()=>{const s=sample();s.release.locations=[delivery()];assert.equal(assessRelease(s,NOW).afterDeploy,'passed');});
for(const state of ['error','missing','blocked','redirect','content_type','unverified','something-new'])add(`delivery ${state} is not relabelled as mismatch or pass`,()=>{const s=sample();s.release.locations=[{...delivery(),lastStatus:state}];const a=assessRelease(s,NOW);assert.equal(a.afterDeploy,'unknown');assert.equal(a.beforeDeploy,'ready');});
add('recent bound delivery mismatch fails separately from the preflight',()=>{const s=sample();s.release.locations=[{...delivery(),lastStatus:'mismatch',lastSha256:OTHER}];const a=assessRelease(s,NOW);assert.equal(a.afterDeploy,'failed');assert.equal(a.beforeDeploy,'ready');});
add('matched label with the wrong digest cannot pass',()=>{const s=sample();s.release.locations=[{...delivery(),lastSha256:OTHER}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('foreign revision delivery cannot pass',()=>{const s=sample();s.release.locations=[{...delivery(),revisionId:99}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('delivery without a timestamp cannot pass',()=>{const s=sample();s.release.locations=[{...delivery(),lastCheckedAt:null}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('future delivery cannot pass',()=>{const s=sample();s.release.locations=[{...delivery(),lastCheckedAt:'2027-09-08T17:00:00Z'}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('delivery before this scan cannot pass',()=>{const s=sample();s.release.locations=[{...delivery(),lastCheckedAt:'2026-09-07T17:00:00Z'}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('expired delivery evidence is stale, not permanently green',()=>{const s=sample();s.release.locations=[delivery()];assert.equal(assessRelease(s,NOW+48*3600_000).afterDeploy,'stale');});
add('one unknown attached location prevents overall delivery pass',()=>{const s=sample();s.release.locations=[delivery(),{...delivery(),id:2,lastStatus:'error'}];assert.equal(assessRelease(s,NOW).afterDeploy,'unknown');});
add('invalid freshness is rejected',()=>assert.throws(()=>assessRelease(sample(),NOW,{deliveryFreshnessMs:0})));
add('invalid evaluation clock is rejected',()=>assert.throws(()=>assessRelease(sample(),NaN)));
for(const bad of [null,{},[],{...sample().receipt,manifest:[{path:'x',size:-1,sha256:DIGEST}]},{...sample().receipt,findingCount:3},{...sample().receipt,ok:false},{...sample().receipt,status:'unknown'},{...sample().receipt,policyHash:'x'}])add(`malformed receipt ${assuranceCases.length}`,()=>assert.equal(readReceipt(bad),null));
add('duplicate manifest paths are rejected',()=>{const r=sample().receipt!;r.manifest.push({...r.manifest[0]});assert.equal(readReceipt(r),null);});
add('empty manifests are valid for genuine empty artefacts',()=>{const r=sample().receipt!;r.manifest=[];assert.ok(readReceipt(r));});
add('dates reject impossible calendar days and locale strings',()=>{assert.equal(recordedTime('2026-02-30T10:00:00Z'),null);assert.equal(recordedTime('8 September 2026'),null);assert.equal(recordedTime('2026-09-08T24:00:00Z'),null);assert.ok(recordedTime('2026-09-08T19:00:00+01:00'));});
add('package source identity preserves scope and ignores version',()=>{assert.equal(sourceKey('npm:@acme/sdk@1.2.3'),'npm:@acme/sdk');assert.notEqual(sourceKey('npm:@acme/sdk@1'),sourceKey('npm:@other/sdk@1'));});
add('distinct GitHub assets cannot become one baseline',()=>{assert.notEqual(sourceKey('github:Acme/app@v1#a.tgz'),sourceKey('github:acme/app@v2#b.tgz'));assert.equal(sourceKey('github:Acme/app@v1#a.tgz'),sourceKey('github:acme/app@v2#a.tgz'));});
add('registry qualifiers are not discarded',()=>assert.notEqual(sourceKey('npm:sdk@1#registry-one'),sourceKey('npm:sdk@2#registry-two')));
add('arbitrary CI filenames do not establish source identity',()=>{assert.equal(sourceKey('api:7#build.tgz'),null);assert.equal(sourceKey('upload:build.tgz'),null);});
add('web identity includes path and rejects credential/query URLs',()=>{assert.notEqual(sourceKey('web:https://example.test/a'),sourceKey('web:https://example.test/b'));assert.equal(sourceKey('web:https://u:p@example.test/'),null);assert.equal(sourceKey('web:https://example.test/?token=x'),null);});
add('exact manifest comparison reports addition removal and mutation',()=>{const a=sample(1),b=sample(2);a.receipt!.manifest.push({path:'old.js',size:20,sha256:DIGEST});b.receipt!.manifest[0].sha256=OTHER;b.receipt!.manifest.push({path:'new.js',size:30,sha256:DIGEST});const diff=compareReleases(b,a,NOW);assert.deepEqual(diff.counts,{added:1,removed:1,changed:1,unchanged:0});});
for(const [name,mutate] of [
 ['tenant',(s:ReturnType<typeof sample>)=>{s.scopeKey='installation:8';}],
 ['channel',(s:ReturnType<typeof sample>)=>{s.release.channel='beta';s.receipt!.channel='beta';}],
 ['format',(s:ReturnType<typeof sample>)=>{s.release.mediaType='application/zip';}],
 ['exceptions',(s:ReturnType<typeof sample>)=>{s.receipt!.suppressedCount=1;s.receipt!.suppressedFingerprints=['x'];}],
 ['signature',(s:ReturnType<typeof sample>)=>{s.signature='invalid';}],
 ['rejected',(s:ReturnType<typeof sample>)=>{s.release.approval={decision:'rejected',actorLogin:'r',createdAt:'2026-09-07T17:00:00Z'};}],
] as const)add(`comparison rejects incompatible ${name}`,()=>{const a=sample(1);mutate(a);assert.equal(compareReleases(sample(2),a,NOW).available,false);});
add('inconclusive current manifest cannot imply removed files',()=>{const b=sample(2);b.receipt!.status='inconclusive';b.receipt!.ok=false;b.receipt!.inconclusiveReason='timeout';b.release.receiptStatus='inconclusive';assert.equal(compareReleases(b,sample(1),NOW).available,false);});
add('same release and later reference are not eligible',()=>{assert.equal(compareReleases(sample(2),sample(2),NOW).available,false);assert.equal(compareReleases(sample(1),sample(2),NOW).available,false);});
add('policy and engine changes are reported',()=>{const b=sample();b.receipt!.policyHash=OTHER;b.receipt!.engineVersion='0.2.0';const d=compareReleases(b,sample(1),NOW);assert.equal(d.policyChanged,true);assert.equal(d.engineChanged,true);});
add('suppression is not counted as disappearance',()=>{const a=sample(1),b=sample();const fp='MAP-002|warn|x.map|Map';a.receipt!.findingFingerprints=[fp];a.receipt!.findingCount=1;a.receipt!.findingRuleIds=['MAP-002'];b.receipt!.suppressedFingerprints=[fp];b.receipt!.suppressedCount=1;const d=compareReleases(b,a,NOW);assert.equal(d.noLongerObservedCount,0);assert.equal(d.newlySuppressedCount,1);});
add('zero and unknown package sizes do not fabricate percentage changes',()=>{const a=sample(1);a.receipt!.artifactBytes=0;assert.equal(compareReleases(sample(),a,NOW).sizeChangePercent,null);a.receipt!.artifactBytes=null;assert.equal(compareReleases(sample(),a,NOW).sizeChangeBytes,null);});
add('display cap preserves exact counts',()=>{const b=sample();b.receipt!.manifest=Array.from({length:80},(_,i)=>({path:`new-${i}.js`,size:2,sha256:DIGEST}));const d=compareReleases(b,sample(1),NOW);assert.equal(d.counts!.added,80);assert.equal(d.paths.added.length,50);assert.equal(d.truncated,true);});
add('insufficient history does not invent a normal range',()=>assert.equal(sizeHistory([1,2,3,4]).ready,false));
add('median and MAD resist one extreme sample',()=>{const h=sizeHistory([100,100,100,101,999999]);assert.equal(h.medianBytes,100);assert.equal(h.madBytes,0);});
add('reference selection does not mutate history or cross assets',()=>{const b=sample(),a=sample(1),copy=JSON.stringify(a);assert.equal(eligiblePredecessors(b.release,[a.release]).length,1);assert.equal(JSON.stringify(a),copy);});
add('rule-based assistant does not claim a diagnosis or execute actions',()=>{const i=investigate(assessRelease(warning(),NOW),['MAP-002','SEC-001','bad<script>'],unavailableComparison());assert.equal(i.provider,'deterministic');assert.deepEqual(i.ruleIds,['MAP-002','SEC-001']);assert.ok(i.steps.some(s=>s.detail.includes('hidden-source-map')));assert.ok(Object.values(i.capabilities).every(v=>v===false));assert.match(i.caveat,/not inferred/);});
add('passport omits file paths fingerprints actors and capability links',()=>{const s=warning();s.release.approval={decision:'approved',actorLogin:'private-person',createdAt:'2026-09-08T17:00:00Z'};const p=buildAssuranceView(s,null,NOW).passport;const text=JSON.stringify(p);assert.equal(p.signatureStatus,'unsigned-summary');assert.equal(p.certification,false);assert.ok(!text.includes('bundle.js.map'));assert.ok(!text.includes('private-person'));assert.ok(!text.includes('fingerprints'));});
add('client rejects another release or an unknown decision',()=>{const v=buildAssuranceView(sample(),null,NOW);assert.ok(readAssuranceView(v,2));assert.equal(readAssuranceView(v,3),null);(v.assessment as unknown as Record<string,unknown>).beforeDeploy='probably';assert.equal(readAssuranceView(v,2),null);});
add('client rejects missing check structure',()=>{const v=buildAssuranceView(sample(),null,NOW);(v.assessment as unknown as Record<string,unknown>).checks=[{}];assert.equal(readAssuranceView(v,2),null);});
add('all rendering views derive from non-mutated evidence',()=>{const b=warning(),a=sample(1),before=JSON.stringify([a,b]);buildAssuranceView(b,a,NOW);assert.equal(JSON.stringify([a,b]),before);});
