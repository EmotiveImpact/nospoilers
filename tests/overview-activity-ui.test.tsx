// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {OverviewActivity,OverviewAttention} from '../src/components/watch/OverviewActivity';
import {overviewActivityBuckets} from '../src/components/watch/overview-activity';
import type {TimelineEntry} from '../src/watch/types';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
class TestResizeObserver { observe(){} unobserve(){} disconnect(){} }
beforeEach(()=>vi.stubGlobal('ResizeObserver',TestResizeObserver));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const counts={open:2,waiting:0,done:0,mine:0};
const alert={id:23,kind:'scan_latest_release',title:'Missing release',body:'',findings:null,created_at:'2026-09-09T10:00:00Z',full_name:'org/app'};
it('opens an exact real alert and clears it while switching response queues',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('status=waiting')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json({alerts:[alert],counts}))));
 render(<OverviewAttention workspaceId="workspace" counts={counts}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Review org/app'}));
 expect(screen.getByText('Check incomplete')).toBeTruthy();
 expect(navigate).toHaveBeenCalledWith('/watch/alerts?workspace=workspace&tab=open&alert=23');
 fireEvent.click(screen.getByRole('tab',{name:'In progress 0'}));
 expect(screen.queryByRole('button',{name:'Review org/app'})).toBeNull();
 await act(async()=>finish(Response.json({alerts:[],counts})));
 expect(screen.getByText('No checks in progress.')).toBeTruthy();
});
it('ignores a late prior-workspace response and uses the current alert scope',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('/old/')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json({alerts:[{...alert,id:99,full_name:'new/repo'}],counts}))));
 const view=render(<OverviewAttention workspaceId="old" counts={counts}/>);
 view.rerender(<OverviewAttention workspaceId="new" counts={counts}/>);
 await screen.findByRole('button',{name:'Review new/repo'});
 await act(async()=>finish(Response.json({alerts:[alert],counts})));
 expect(screen.queryByRole('button',{name:'Review org/app'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Review new/repo'}));
 expect(navigate).toHaveBeenCalledWith('/watch/alerts?workspace=new&tab=open&alert=99');
});
it('shows an alert read failure with retry instead of an empty response queue',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({error:'Denied'},{status:403})).mockResolvedValueOnce(Response.json({alerts:[alert],counts})));
 render(<OverviewAttention workspaceId="workspace" counts={counts}/>);
 await screen.findByRole('alert');
 expect(screen.queryByText('No open alerts.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry alerts'}));
 expect(await screen.findByRole('button',{name:'Review org/app'})).toBeTruthy();
});
it('does not request an arbitrary timeline when no workspace connection is selected',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<OverviewActivity workspaceId="workspace"/>);
 expect(fetcher).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Open timeline'}));
 expect(navigate).toHaveBeenCalledWith('/watch/timeline?workspace=workspace');
});
it.each([402,403])('preserves timeline access denial %s without inventing a zero chart',async status=>{
 const fetcher=vi.fn(async()=>Response.json({error:'Access required'},{status}));vi.stubGlobal('fetch',fetcher);
 render(<OverviewActivity workspaceId="workspace" connection={{installationId:9,name:'Connection'}}/>);
 expect(await screen.findByText('Timeline is available with Team or an active trial.')).toBeTruthy();
 expect(screen.queryByRole('img')).toBeNull();
 expect(fetcher.mock.calls[0][0]).toBe('/api/timeline?installationId=9');
 fireEvent.click(screen.getByRole('button',{name:'View timeline access'}));
 expect(navigate).toHaveBeenCalledWith('/watch/timeline?workspace=workspace&install=9');
});
const event=(type:TimelineEntry['type'],at:string)=>({type,at,alertId:23,kind:'scan_latest_release',title:'Missing release',fullName:'org/app',action:null,actorLogin:null,deliveryStatus:null,inventedIncident:null}) as TimelineEntry;
it('buckets actual alert and response events, excluding delivery and out-of-window events',()=>{
 const buckets=overviewActivityBuckets([event('alert','2026-09-09T10:00:00Z'),event('alert_event','2026-09-09T11:00:00Z'),event('delivery','2026-09-09T12:00:00Z'),event('alert','2026-09-01T10:00:00Z'),event('alert','2026-09-10T10:00:00Z')],7,'2026-09-09T14:00:00Z');
 expect(buckets.reduce((sum,b)=>sum+b.opened,0)).toBe(1);
 expect(buckets.reduce((sum,b)=>sum+b.responded,0)).toBe(1);
 expect(buckets.at(-1)).toMatchObject({opened:1,responded:1});
});
it('renders retained activity with explicit bounds and a scoped timeline link',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({entries:[event('alert','2026-09-09T10:00:00Z')],until:'2026-09-09T14:00:00Z',days:90})));
 render(<OverviewActivity workspaceId="workspace" connection={{installationId:9,name:'Connection'}}/>);
 expect((await screen.findByRole('img')).getAttribute('aria-label')).toContain('1 alerts opened, 0 response events');
 expect(screen.getByText(/Up to 200 retained events/)).toBeTruthy();
 fireEvent.click(screen.getByRole('combobox',{name:'Activity range'}));
 fireEvent.click(screen.getByRole('option',{name:'Last 30 days'}));
 expect(screen.getByRole('img').getAttribute('aria-label')).toContain('1 alerts opened');
 fireEvent.click(screen.getByRole('button',{name:'View timeline'}));
 expect(navigate).toHaveBeenCalledWith('/watch/timeline?workspace=workspace&install=9');
});

it('shows a readable saved alert title when the workspace response has no repository name',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({alerts:[{...alert,full_name:undefined,title:'No release on org/app'}],counts})));
 render(<OverviewAttention workspaceId="workspace" counts={counts}/>);
 expect(await screen.findByRole('button',{name:'Review No release on org/app'})).toBeTruthy();
 expect(screen.queryByText('scan_latest_release')).toBeNull();
});
