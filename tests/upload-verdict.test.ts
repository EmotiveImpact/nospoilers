import { describe,it,expect } from 'vitest';
import { uploadVerdict } from '../src/watch/upload-verdict.ts';
import type { ScanReport } from '../src/report-types.ts';
const report:ScanReport={target:'a.zip',kind:'zip',fileCount:1,findings:[],ok:true,status:'passed',scannedAt:'2026-09-05T00:00:00Z'};
describe('uploaded evidence decision',()=>{
  it('never interprets job completion or missing evidence as a pass',()=>{
    expect(uploadVerdict('done',null)).toBe('Result unavailable');
    expect(uploadVerdict('unknown',report)).toBe('Result unavailable');
    expect(uploadVerdict('done',{...report,status:'unknown'} as unknown as ScanReport)).toBe('Result unavailable');
    expect(uploadVerdict('running',report)).toBe('Inspecting artifact');
  });
  it('preserves inconclusive and failed policy decisions even with inconsistent ok flags',()=>{
    expect(uploadVerdict('done',{...report,status:'inconclusive'})).toBe('Inconclusive');
    expect(uploadVerdict('done',{...report,status:'failed-policy'})).toBe('Review findings');
  });
  it('distinguishes exceptions from an unqualified pass',()=>{
    expect(uploadVerdict('done',report)).toBe('Policy passed');
    expect(uploadVerdict('done',{...report,suppressed:[{finding:{rule:'x',severity:'warn',path:'x',title:'x',detail:'x'},reason:'Accepted',actor:'a',expiresAt:'2026-10-01'}]})).toBe('Policy passed with exceptions');
  });
});
