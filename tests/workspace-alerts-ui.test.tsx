// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
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
 fireEvent.click(screen.getByRole('button',{name:'Older'}));
 expect(nav).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&before=2');nav.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Acknowledge'}));
 await waitFor(()=>expect(nav).toHaveBeenCalled());
 expect(fetch.mock.calls.some(([url,init])=>url==='/api/workspaces/workspace/alerts/9/respond'&&JSON.parse(String(init?.body)).action==='acknowledge')).toBe(true);
 expect(fetch.mock.calls.some(([url])=>url.startsWith('/api/alerts/'))).toBe(false);
 revoked=true;act(()=>refresh());
 await screen.findByText('error');
 expect(screen.queryByRole('heading',{name:'Website exposure'})).toBeNull();
 expect(screen.queryByRole('navigation',{name:'Alert history pages'})).toBeNull();
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(true);
});
it('does not flash unavailable guidance while a selected alert is still loading',async()=>{
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null,scan_attempt_id:'attempt'};
 let finish:(value:Response)=>void=()=>{};
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
 await act(async()=>finish(new Response(JSON.stringify({alert,events:[]}))));
 expect(await screen.findByRole('link',{name:'Open the saved website check'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(false);
});
it('keeps the current queue visible until the next tab response arrives',async()=>{
 const first={id:9,kind:'scan_latest_release',title:'First alert',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null};
 const second={...first,id:10,title:'Second alert',acknowledged_at:'2026-09-06'};
 let requested=false;
 let finish:(value:Response)=>void=()=>{};
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
 expect((screen.getByRole('button',{name:'Older'}) as HTMLButtonElement).disabled).toBe(false);
 view.rerender(<WorkspaceAlerts workspaceId="workspace" search="?tab=waiting"/>);
 expect(screen.getByRole('heading',{name:'First alert'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Older'}) as HTMLButtonElement).disabled).toBe(true);
 await waitFor(()=>expect(requested).toBe(true));
 await act(async()=>finish(Response.json(page([second]))));
 expect(await screen.findByRole('heading',{name:'Second alert'})).toBeTruthy();
 expect((screen.getByRole('button',{name:'Older'}) as HTMLButtonElement).disabled).toBe(false);
});
