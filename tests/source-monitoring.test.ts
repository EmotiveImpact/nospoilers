import {it,expect} from 'vitest';
import {sourceMonitoring} from '../src/server/source-monitoring.ts';
import {buildSourceViewModels,filterSourceViewModels} from '../src/watch/view-models.ts';
it('distinguishes configured cadence from recorded freshness without inventing dispatch',()=>{
 const now=Date.parse('2026-09-06T12:00:00Z');
 expect(sourceMonitoring(3600000,'2026-09-06T11:00:00Z',now)).toMatchObject({freshness:'recent',nextDispatchAt:null});
 expect(sourceMonitoring(3600000,'2026-09-06T09:00:00Z',now).freshness).toBe('delayed');
 for(const date of [null,'bad','2026-09-07'])expect(sourceMonitoring(3600000,date,now).freshness).toBe('unknown');
 expect(sourceMonitoring(0,'2026-09-06T11:00:00Z',now).freshness).toBe('unknown');
});
it('keeps an old passing package in the attention filter when metadata checks are delayed',()=>{
 const monitoring=sourceMonitoring(3600000,'2026-09-01',Date.parse('2026-09-06'));
 const sources=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-01',last_scan_status:'passed',monitoring}]});
 expect(sources[0]).toMatchObject({status:'passed',attention:'warning',monitoring:{freshness:'delayed'}});
 expect(filterSourceViewModels(sources,'all',true)).toHaveLength(1);
});
