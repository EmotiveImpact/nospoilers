import {it,expect} from 'vitest';
import {assessRemediation} from '../src/release-intelligence/remediation.ts';
import type {Evidence} from '../src/release-intelligence/model.ts';
const now=Date.now(),finding='source-map:dist/app.map';
const original:Evidence={ref:{kind:'release',id:'1'},workspaceId:'workspace',source:'repo',channel:'stable',format:'tgz',digest:'a'.repeat(64),fingerprint:'b'.repeat(64),scannedAt:new Date(now-60000).toISOString(),engine:'1',policy:null,status:'failed-policy',suppressed:0,findings:[finding],manifest:[],bytes:100,held:false};
const rebuilt:Evidence={...original,ref:{kind:'release',id:'2'},digest:'c'.repeat(64),fingerprint:'d'.repeat(64),scannedAt:new Date(now-1000).toISOString(),status:'passed',findings:[]};
const review=new Date(now-30000).toISOString();
it('reports absence only for the exact finding in equivalent fresh rebuilt evidence',()=>{expect(assessRemediation(original,rebuilt,finding,review,now)).toMatchObject({state:'verified_absent',otherFindings:0});});
it.each([
  {source:'other'}, {channel:'beta'}, {format:'zip'}, {engine:'2'}, {policy:'e'.repeat(64)},
  {digest:original.digest},{scannedAt:original.scannedAt},{scannedAt:new Date(now-48*3600000).toISOString()},
  {suppressed:1},{held:true},{status:'inconclusive'},
] as Partial<Evidence>[])('does not prove remediation when evidence changes or becomes incomplete: %j',patch=>{expect(assessRemediation(original,{...rebuilt,...patch},finding,review,now).state).toBe('unknown');});
it('does not close findings still present or pretend other findings are resolved',()=>{
  expect(assessRemediation(original,{...rebuilt,status:'failed-policy',findings:[finding]},finding,review,now).state).toBe('still_observed');
  expect(assessRemediation(original,{...rebuilt,status:'failed-policy',findings:['another']},finding,review,now)).toMatchObject({state:'verified_absent',otherFindings:1});
});
it('does not manufacture original finding evidence',()=>{expect(assessRemediation(original,rebuilt,'absent',review,now).state).toBe('unknown');});
it('rejects contradictory signed revision metadata and website evidence',()=>{
  expect(assessRemediation(original,{...rebuilt,sourceRevision:'a'.repeat(40)},finding,review,now,'b'.repeat(40)).state).toBe('unknown');
  expect(assessRemediation({...original,source:'website:1'},{...rebuilt,source:'website:1'},finding,review,now).state).toBe('unknown');
});
it('does not count a changed title, severity or moved path under the same rule as a verified fix',()=>{
  const fingerprint='SOURCEMAP|critical|dist/app.map|Original source';
  expect(assessRemediation({...original,findings:[fingerprint]},{...rebuilt,status:'failed-policy',findings:['SOURCEMAP|warn|other.map|Different title']},fingerprint,review,now).state).toBe('still_observed');
});
