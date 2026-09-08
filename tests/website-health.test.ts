import {it,expect} from 'vitest';
import {websiteHealth} from '../src/watch/website-health.ts';
const now=Date.parse('2026-09-06T12:00:00Z');
const source={verified_at:'2026-09-05',last_checked_at:'2026-09-05',schedule_hours:6,next_check_at:'2026-09-06T10:00:00Z',latest_attempt_status:'done'};
it('does not let old completed evidence hide overdue or failed monitoring',()=>{
 expect(websiteHealth(source,now)).toMatchObject({state:'delayed',attention:true});
 expect(websiteHealth({...source,next_check_at:'2026-09-06T18:00:00Z',schedule_error:'Allowance'},now).state).toBe('delayed');
 expect(websiteHealth({...source,schedule_hours:0,latest_attempt_status:'failed'},now).state).toBe('failed');
});
it('separates connection lifecycle, active work and manual evidence from safety claims',()=>{
 expect(websiteHealth({...source,disconnected_at:'2026-09-06'},now).state).toBe('disconnected');
 expect(websiteHealth({...source,paused_at:'2026-09-06'},now).state).toBe('paused');
 expect(websiteHealth({...source,verified_at:null},now).state).toBe('unverified');
 expect(websiteHealth({...source,schedule_hours:0,latest_attempt_status:'running'},now).state).toBe('checking');
 expect(websiteHealth({...source,schedule_hours:0,last_checked_at:null},now).state).toBe('unchecked');
 expect(websiteHealth({...source,schedule_hours:0},now).state).toBe('manual');
 expect(websiteHealth({...source,next_check_at:'2026-09-06T18:00:00Z'},now).state).toBe('scheduled');
});
