import {describe,expect,it} from 'vitest';
import {buildAlertListViewModels,isAlertQueueActionable} from '../src/watch/view-models.js';

const base={
 id:1,
 kind:'scan_latest_release',
 title:'No release on owner/repo',
 body:'Publish a GitHub Release, then scan again.',
 findings:[],
 created_at:'2026-09-19T10:00:00Z',
};

describe('alert queue actionability',()=>{
 it('separates coverage state from incomplete checks and findings',()=>{
  const noRelease=base;
  const incomplete={...base,id:2,title:'Latest release check could not finish'};
  const finding={...base,id:3,findings:[{rule:'MAP-001',path:'dist/app.js.map'}]};

  expect(isAlertQueueActionable(noRelease)).toBe(false);
  expect(isAlertQueueActionable(incomplete)).toBe(true);
  expect(isAlertQueueActionable(finding)).toBe(true);
 expect(buildAlertListViewModels([noRelease,incomplete,finding],()=>'<1m').map(row=>row.queueKind))
   .toEqual(['coverage','incomplete-check','finding']);
 });
 it('uses recorded severity across all findings instead of guessing from the first rule',()=>{
  const mixed={...base,id:4,title:'Mixed evidence',kind:'release_scan',findings:[{rule:'SRC-001',path:'source.txt',severity:'warn'},{rule:'LNK-001',path:'link',severity:'critical'}]};
  expect(buildAlertListViewModels([mixed],()=>'<1m')[0].severity).toBe('critical');
 });
});
