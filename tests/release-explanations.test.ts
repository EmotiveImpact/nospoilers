import {expect,it,vi} from 'vitest';
import {explanationProjection,releaseExplanations,reviewedExplanationText,type ExplanationProvider} from '../src/server/release-explanations.ts';
import type {Evidence} from '../src/release-intelligence/model.ts';
import type {SqlClient} from '../src/server/sql.ts';
import type {IntelligencePorts} from '../src/server/release-intelligence-service.ts';
const evidence:Evidence={workspaceId:'private-workspace',source:'private-repo',ref:{kind:'upload',id:'private-upload'},channel:'stable',format:'tgz',digest:'a'.repeat(64),fingerprint:'b'.repeat(64),scannedAt:new Date().toISOString(),engine:'engine-private',policy:null,status:'failed-policy',readiness:'blocked',held:true,suppressed:2,findings:['MAP-001|critical|secret/path.js|PRIVATE SECRET VALUE','CUSTOM|unexpected|private-notes.txt|sensitive human content'],manifest:[{path:'secret/path.js',sha256:'c'.repeat(64),size:123}],bytes:50};
it('preserves ordinary multiline reviewed drafts while trimming outer whitespace',()=>{
 expect(reviewedExplanationText('  Human review:\r\n\tAggregate evidence only.\n ')).toBe('Human review:\r\n\tAggregate evidence only.');
});
it.each(['short','x'.repeat(1001),'Review with\u0000null','Review with\u001bescape',null])('rejects invalid reviewed explanation input %s',raw=>{
 expect(()=>reviewedExplanationText(raw)).toThrow('Reviewed explanation must contain');
});
it('projects only bounded aggregates, with held/unknown evidence and no private identity or finding content',()=>{
 const result=explanationProjection(evidence);
 expect(result).toEqual({schemaVersion:1,scanStatus:'failed-policy',readiness:'blocked',held:true,files:1,totalBytes:123,findings:2,suppressed:2,severityCounts:{critical:1,high:0,medium:0,low:0,info:0,unknown:1}});
 const json=JSON.stringify(result);for(const secret of ['private','secret/','PRIVATE SECRET','sensitive human','MAP-001',evidence.digest,evidence.fingerprint])expect(json).not.toContain(secret);
});
it('keeps missing canonical readiness unknown instead of inferring ready from counts',()=>{
 expect(explanationProjection({...evidence,readiness:undefined,status:'passed',findings:[],suppressed:0})).toMatchObject({readiness:'unknown',held:true});
});
it('rejects unbounded adapter configuration without invoking it',()=>{
 const explain=vi.fn();const provider:ExplanationProvider={id:'test',model:'test-model',currency:'USD',maxCostMinor:1,dailyCostMinor:10,maxOutputTokens:1001,explain};
 expect(()=>releaseExplanations({} as SqlClient,{} as IntelligencePorts,provider)).toThrow('Declare bounded');expect(explain).not.toHaveBeenCalled();
});
