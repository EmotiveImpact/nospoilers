// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {WorkspaceAlerts} from '../src/components/watch/WorkspaceAlerts';
const nav=vi.hoisted(()=>vi.fn());
vi.mock('../src/nav',()=>({navigate:nav}));
vi.mock('../src/components/WatchAlertsWorkspace',()=>({WatchAlertsWorkspace:(p:any)=><section><p>{p.state.status}</p><h1>{p.selected?.title}</h1>{p.relatedReleases}{p.pagination}<button disabled={!p.canRespond} onClick={()=>p.onAction('acknowledge')}>Acknowledge</button><span>{p.events.length} events</span></section>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();vi.clearAllMocks();});
it('disables responses when selected detail fails even if the feed and membership succeed',async()=>{
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null,scan_attempt_id:'attempt',acknowledged_at:null};
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/api/me')return new Response(JSON.stringify({user:{id:'owner',login:'Owner'}}));
  if(url.endsWith('/evidence-settings'))return new Response(JSON.stringify({workspace:{role:'owner',archived_at:null}}));
  if(url.endsWith('/alerts/9'))return new Response(JSON.stringify({error:'Alert unavailable'}),{status:404});
  if(url.includes('/alerts?'))return new Response(JSON.stringify({alerts:[alert],nextCursor:null,sourceCount:1,counts:{open:1,waiting:0,done:0,mine:0}}));
  throw new Error(`Unexpected request ${url}`);
 });vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9"/>);
 await screen.findByRole('heading',{name:'Website exposure'});
 await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url.endsWith('/alerts/9'))).toBe(true));
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Acknowledge'}));
 expect(fetcher.mock.calls.some(([url])=>url.endsWith('/respond'))).toBe(false);
 expect(screen.getByText(/Recheck actions require loaded alert evidence/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Recheck website'})).toBeNull();
});
it('loads workspace alerts and sends responses without installation-era endpoints',async()=>{
 let refresh:()=>void=()=>{},revoked=false;
 const originalInterval=window.setInterval.bind(window);
 vi.spyOn(window,'setInterval').mockImplementation((callback,delay,...args)=>{if(delay===30_000){refresh=callback as ()=>void;return 123;}return originalInterval(callback,delay,...args);});
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null,scan_attempt_id:'attempt',acknowledged_at:null};
 const fetch=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url==='/api/me')return new Response(JSON.stringify({user:{id:'owner',login:'Owner'}}));
  if(url.endsWith('/evidence-settings'))return revoked?new Response(JSON.stringify({error:'Workspace unavailable'}),{status:404}):new Response(JSON.stringify({workspace:{role:'owner',archived_at:null}}));
  if(url.endsWith('/respond'))return new Response(JSON.stringify({alert:{...alert,acknowledged_at:'2026-09-06'},events:[{id:1,action:'acknowledged'}]}));
  if(url.endsWith('/alerts/9'))return new Response(JSON.stringify({alert,events:[]}));
  if(url.includes('/alerts?'))return new Response(JSON.stringify({alerts:[alert],nextCursor:'2',sourceCount:1,counts:{open:51,waiting:0,done:0,mine:0}}));
  throw new Error(`Unexpected request ${url} ${init?.method}`);
 });vi.stubGlobal('fetch',fetch);
 render(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9"/>);
 await screen.findByRole('heading',{name:'Website exposure'});
 expect((await screen.findByRole('link',{name:'Open the saved website check'})).getAttribute('href')).toContain('upload=attempt');
 expect(fetch.mock.calls.filter(([url])=>url.includes('/alerts?'))).toHaveLength(1);
 expect(fetch.mock.calls.some(([url])=>url.includes('status=open&mine=0'))).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 expect(nav).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&before=2');nav.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Acknowledge'}));
 await waitFor(()=>expect(nav).toHaveBeenCalled());
 expect(fetch.mock.calls.some(([url,init])=>url==='/api/workspaces/workspace/alerts/9/respond'&&JSON.parse(String(init?.body)).action==='acknowledge')).toBe(true);
 expect(fetch.mock.calls.some(([url])=>url.startsWith('/api/alerts/'))).toBe(false);
 revoked=true;act(()=>refresh());
 await screen.findByText('error');
 expect(screen.queryByRole('heading',{name:'Website exposure'})).toBeNull();
 expect(screen.queryByRole('navigation',{name:'Alerts pagination'})).toBeNull();
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(true);
});
it('does not flash unavailable guidance while a selected alert is still loading',async()=>{
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null,scan_attempt_id:'attempt'};
 let finish:((value:Response)=>void)|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url==='/api/me')return new Response(JSON.stringify({user:{id:'owner',login:'Owner'}}));
  if(url.endsWith('/evidence-settings'))return new Response(JSON.stringify({workspace:{role:'owner',archived_at:null}}));
  if(url.endsWith('/alerts/9'))return new Promise<Response>(resolve=>{finish=resolve;});
  if(url.includes('/alerts?'))return new Response(JSON.stringify({alerts:[alert],nextCursor:null,sourceCount:1,counts:{open:1,waiting:0,done:0,mine:0}}));
  throw new Error(`Unexpected request ${url}`);
 }));
 render(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9"/>);
 await screen.findByRole('heading',{name:'Website exposure'});
 expect(screen.queryByText(/Recheck actions require loaded alert evidence/)).toBeNull();
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(true);
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 await act(async()=>finish!(new Response(JSON.stringify({alert,events:[]}))));
 expect(await screen.findByRole('link',{name:'Open the saved website check'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(false);
});
it('keeps the current queue visible until the next tab response arrives',async()=>{
 const first={id:9,kind:'scan_latest_release',title:'First alert',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null};
 const second={...first,id:10,title:'Second alert',acknowledged_at:'2026-09-06'};
 let requested=false;
 let finish:((value:Response)=>void)|undefined;
 const page=(alerts:unknown[])=>({alerts,nextCursor:'8',sourceCount:1,counts:{open:1,waiting:1,done:0,mine:0}});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url==='/api/me')return Response.json({user:{id:'owner',login:'Owner'}});
  if(url.endsWith('/evidence-settings'))return Response.json({workspace:{role:'owner',archived_at:null}});
  if(url.includes('status=waiting'))return new Promise<Response>(resolve=>{requested=true;finish=resolve;});
  if(url.includes('/alerts?'))return Response.json(page([first]));
  return Response.json({alert:url.endsWith('/10')?second:first,events:[]});
 }));
 const view=render(<WorkspaceAlerts workspaceId="workspace" search="?tab=open"/>);
 await screen.findByRole('heading',{name:'First alert'});
 expect((screen.getByRole('button',{name:'Next'}) as HTMLButtonElement).disabled).toBe(false);
 view.rerender(<WorkspaceAlerts workspaceId="workspace" search="?tab=waiting"/>);
 expect(screen.getByRole('heading',{name:'First alert'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Next'}) as HTMLButtonElement).disabled).toBe(true);
 await waitFor(()=>expect(requested).toBe(true));
 await act(async()=>finish!(Response.json(page([second]))));
 expect(await screen.findByRole('heading',{name:'Second alert'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Next'}) as HTMLButtonElement).disabled).toBe(false);
});

it('pages alerts at the selected size and goes back one page without losing workspace or source scope',async()=>{
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/api/me')return Response.json({user:{id:'owner',login:'Owner'}});
  if(url.endsWith('/evidence-settings'))return Response.json({workspace:{role:'owner',archived_at:null}});
  const cursor=new URL(url,'https://example.test').searchParams.get('before');
  return Response.json({alerts:[],nextCursor:cursor==='200'?null:cursor==='100'?'200':'100',sourceCount:1,counts:{open:30,waiting:0,done:0,mine:0}});
 });vi.stubGlobal('fetch',fetcher);
 const view=render(<WorkspaceAlerts workspaceId="one" search="?workspace=one&install=7&source=repo-9001"/>);
 await screen.findByText('ready');
 expect(fetcher.mock.calls.some(([url])=>url.includes('pageSize=10')&&url.includes('source=repo-9001'))).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 view.rerender(<WorkspaceAlerts workspaceId="one" search={String(nav.mock.lastCall?.[0]).split('?')[1]}/>);
 await screen.findByText('Page 2 · 0 alerts');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 view.rerender(<WorkspaceAlerts workspaceId="one" search={String(nav.mock.lastCall?.[0]).split('?')[1]}/>);
 await screen.findByText('Page 3 · 0 alerts');
 fireEvent.click(screen.getByRole('button',{name:'Previous'}));
 expect(nav.mock.lastCall?.[0]).toBe('/watch/alerts?workspace=one&install=7&source=repo-9001&before=100');
 view.rerender(<WorkspaceAlerts workspaceId="one" search={String(nav.mock.lastCall?.[0]).split('?')[1]}/>);
 await screen.findByText('Page 2 · 0 alerts');
 await userEvent.click(screen.getByRole('combobox',{name:'Alerts per page'}));
 await userEvent.click(screen.getByRole('option',{name:'60',exact:true}));
 expect(nav.mock.lastCall?.[0]).toBe('/watch/alerts?workspace=one&install=7&source=repo-9001&pageSize=60');
 view.rerender(<WorkspaceAlerts workspaceId="one" search={String(nav.mock.lastCall?.[0]).split('?')[1]}/>);
 await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url.includes('pageSize=60')&&!url.includes('before='))).toBe(true));
 expect(screen.getByRole('button',{name:'Previous'})).toHaveProperty('disabled',true);
 view.rerender(<WorkspaceAlerts workspaceId="two" search="?workspace=two"/>);
 await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url.startsWith('/api/workspaces/two/alerts?')&&url.includes('pageSize=10')&&!url.includes('source='))).toBe(true));
});

it('does not commit a delayed alert page after page-size or status changes',async()=>{
 let finish!:(response:Response)=>void;
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/api/me')return Response.json({user:{id:'owner',login:'Owner'}});
  if(url.endsWith('/evidence-settings'))return Response.json({workspace:{role:'owner',archived_at:null}});
  if(url.includes('before=100'))return new Promise<Response>(resolve=>{finish=resolve;});
  return Response.json({alerts:[],nextCursor:null,sourceCount:1,counts:{open:30,waiting:0,done:0,mine:0}});
 });vi.stubGlobal('fetch',fetcher);
 const view=render(<WorkspaceAlerts workspaceId="one" search="?workspace=one&before=100"/>);
 await waitFor(()=>expect(finish).toBeTypeOf('function'));
 view.rerender(<WorkspaceAlerts workspaceId="one" search="?workspace=one&tab=waiting&pageSize=30"/>);
 await screen.findByText('ready');
 await act(async()=>finish(Response.json({alerts:[],nextCursor:'90',sourceCount:999,counts:{open:999,waiting:999,done:999,mine:999}})));
 expect(screen.getByRole('button',{name:'Next'})).toHaveProperty('disabled',true);
 expect(screen.getByText('Page 1 · 0 alerts')).toBeTruthy();
 expect(fetcher.mock.calls.some(([url])=>url.includes('status=waiting&mine=0&pageSize=30')&&!url.includes('before='))).toBe(true);
});
