import {describe,it,expect} from 'vitest';
import {explainAlert,ruleExplanations,kindExplanations} from '../src/watch/alert-guidance.ts';
const base={kind:'release_scan',title:'Saved result',body:'',findings:[]};
describe('specific evidence-based alert explanations',()=>{
 it.each(['MAP-001','MAP-002','MAP-003','MAP-011','MAP-012','SEC-001','SEC-002','SEC-003','SEC-004','AI-001','NET-001','DBG-001','CACHE-001','CRASH-001','GIT-001','SRC-001','SIZE-001','SIZE-002','SIZE-003','ARC-001','ARC-002','BAK-001','DB-001','DOC-001','LNK-001'])('explains supported scanner rule %s with a correction and verification',rule=>{
  const result=explainAlert({...base,findings:[{rule,path:'dist/file'}]});
  expect(result.rules[0]).toMatchObject({...ruleExplanations[rule],paths:['dist/file']});
  expect(result.rules[0].action.length).toBeGreaterThan(30);expect(result.rules[0].verify.length).toBeGreaterThan(30);
 });
 it('keeps distinct fixes and deduplicates repeated findings and paths',()=>{
  const result=explainAlert({...base,findings:[{rule:'MAP-002',path:'app.js.map'},{rule:'MAP-002',path:'app.js.map'},{rule:'SEC-003',path:'.env'}]});
  expect(result.rules).toHaveLength(2);expect(result.rules[0].paths).toEqual(['app.js.map']);
  expect(result.rules[0].meaning).toContain('original source');expect(result.rules[1].action).toContain('rotate');
 });
 it('does not confuse a reference, a pattern match or registry metadata with verified exposure',()=>{
  expect(ruleExplanations['MAP-003'].meaning).toContain('does not prove');
  expect(ruleExplanations['SEC-003'].meaning).toContain('does not authenticate');
  expect(kindExplanations.identity_size_jump.meaning).toContain('not a measurement');
  expect(kindExplanations.identity_provenance_lost.meaning).toContain('No attestation signature was verified');
 });
 it('prescribes access review rather than rebuilding an artifact for repository events',()=>{
  const result=explainAlert({...base,kind:'member_added'});
  expect(result.meaning).toContain('collaborator');expect(result.action).toContain('person and role');
  expect(result.steps.join(' ')).not.toContain('Rebuild');
 });
 it('uses website verification for website findings',()=>{
  const result=explainAlert({...base,kind:'web_origin_scan',findings:[{rule:'MAP-001',path:'/app.js.map'}]});
  expect(result.rules[0].verify).toContain('website check');expect(result.meaning).toContain('not every page');
 });
 it('does not mistake digest metadata or an unknown event for a leak or clean scan',()=>{
  const result=explainAlert({...base,kind:'future_kind',findings:{sha256:'abc'}});
  expect(result.rules).toEqual([]);expect(result.meaning).toContain('has no specific explanation');
  expect(result.location).toBeUndefined();
 });
 it('keeps unknown rules visible without inventing a cause',()=>{
  const result=explainAlert({...base,findings:[{rule:'NEW-999',path:'entry'}]});
  expect(result.rules[0].title).toBe('Finding NEW-999');expect(result.rules[0].meaning).toContain('no specific explanation');
 });
 it('treats incomplete checks as uncertainty, not a passing release',()=>{
  const result=explainAlert({...base,kind:'scan_latest_release'},true);
  expect(result.meaning).toContain('did not complete');expect(result.verify).toContain('Do not resolve this as a passing scan');
 });
});
