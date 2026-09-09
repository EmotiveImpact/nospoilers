import {expect,it} from 'vitest';
import {overviewNextAction} from '../src/components/watch/overview-next-action.ts';

it('directs delayed monitoring to scoped coverage without implying a current pass',()=>{
 const counts={total:1,attention:0,active:0};
 const next=overviewNextAction({counts,websiteCoverage:{total:1,attention:1,delayed:1}},'w');
 expect(next.href).toBe('/watch/sources?workspace=w&websiteHealth=delayed');
 expect(next.text).toContain('Historical scan results');
});

it('prioritises response without rewriting scan outcomes',()=>{
 const counts={total:4,attention:2,active:1};
 const alert=overviewNextAction({counts,alertCounts:{open:1,waiting:0}},'w');
 expect(alert.href).toBe('/watch/alerts?workspace=w&tab=open');
 expect(alert.text).toContain('Open alerts need a response.');
 expect(alert.text).not.toMatch(/exposure/i);
 expect(counts.attention).toBe(2);
 expect(overviewNextAction({counts},'w').href).toContain('uploadStatus=attention');
});
it('routes connected-only review and history to the exact installation',()=>{
 const counts={total:0,attention:0,active:0};
 const hostedSources=[{installationId:9,total:3,attention:1}];
 expect(overviewNextAction({counts,hostedSources},'w').href).toBe('/watch/releases?workspace=w&install=9&releaseView=connected');
 hostedSources[0].attention=0;
 expect(overviewNextAction({counts,hostedSources},'w').text).not.toContain('No scan evidence');
 expect(overviewNextAction({counts,hostedSources},'w').href).toBe('/watch/releases?workspace=w&install=9&releaseView=connected');
});
it('keeps active scans and ongoing response actionable',()=>{
 expect(overviewNextAction({counts:{total:1,attention:0,active:1}},'w').href).toContain('uploadStatus=active');
 const waiting=overviewNextAction({counts:{total:0,attention:0,active:0},alertCounts:{open:0,waiting:2}},'w');
 expect(waiting.href).toContain('tab=waiting');
 expect(waiting.text).toContain('Alert response is in progress.');
 expect(waiting.text).not.toMatch(/exposure/i);
});

it.each(['unknown','delayed','unavailable'] as const)('routes %s connected monitoring to coverage despite saved passes',health=>{
 const data={counts:{total:4,attention:0,active:0},connectedCoverage:{unknown:0,delayed:0,unavailable:0,[health]:1}};
 const next=overviewNextAction(data,'workspace with spaces');
 expect(next.href).toBe('/watch/sources?workspace=workspace+with+spaces');
 expect(next.text).toContain('does not establish current safety');
 expect(overviewNextAction({...data,alertCounts:{open:1,waiting:0}},'w').href).toContain('/watch/alerts?');
 expect(overviewNextAction({...data,counts:{...data.counts,active:1}},'w').href).toContain('uploadStatus=active');
});

it('keeps saved evidence accessible when connected monitoring has no attention state',()=>{
 expect(overviewNextAction({counts:{total:4,attention:0,active:0},connectedCoverage:{unknown:0,delayed:0,unavailable:0}},'w').href).toBe('/watch/releases?workspace=w');
});
