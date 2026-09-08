import {it,expect} from 'vitest';
import {scan} from '../src/scanner/index.ts';
import {applyHostedPolicySnapshot} from '../src/server/hosted-policy-snapshot.ts';
import {applyWorkspaceArtifactPolicy} from '../src/server/workspace-policy.ts';
import {POLICY_VERSION} from '../src/policy.ts';

it('uses snapshot expiry time for connected and independent evidence without changing the input report',async()=>{
 const report=await scan('fixtures/clean.tgz');
 report.findings=[{rule:'MAP-001',path:'app.map',severity:'critical',title:'Map',detail:'Example'}];
 report.status='failed-policy';report.ok=false;
 const before=JSON.stringify(report);
 const exception={rule:'MAP-001',pathPattern:'app.map',pathMatch:'exact' as const,reason:'Accepted scope',actor:'reviewer',expiresAt:'2021-01-01T00:00:00.000Z'};
 const evaluatedAt='2020-12-31T23:59:00.000Z';
 const connected={evaluatedAt,candidates:[{...exception,artifactSha256:report.artifactSha256}]};
 const independent={version:POLICY_VERSION,strict:false,evaluatedAt,exceptions:[exception]};
 expect(applyHostedPolicySnapshot(report,connected).suppressed).toHaveLength(1);
 expect(applyWorkspaceArtifactPolicy(report,independent).suppressed).toHaveLength(1);
 expect(applyHostedPolicySnapshot(report,{...connected,evaluatedAt:exception.expiresAt}).findings).toHaveLength(1);
 expect(applyWorkspaceArtifactPolicy(report,{...independent,evaluatedAt:exception.expiresAt}).findings).toHaveLength(1);
 expect(applyHostedPolicySnapshot({...report,artifactSha256:'different'},connected).findings).toHaveLength(1);
 expect(applyHostedPolicySnapshot({...report,status:'inconclusive'},connected).status).toBe('inconclusive');
 expect(JSON.stringify(report)).toBe(before);
});
