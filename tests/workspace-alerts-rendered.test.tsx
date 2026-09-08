// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceAlerts} from '../src/components/watch/WorkspaceAlerts';
const nav=vi.hoisted(()=>vi.fn());
vi.mock('../src/nav',()=>({navigate:nav}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('restores activity pages from the URL and clears their cursor on queue navigation',async()=>{
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Evidence',findings:[],created_at:'2026-09-06T00:00:00Z',installation_id:null,source_origin_id:null,scan_attempt_id:'attempt-9',acknowledged_at:null,resolved_at:null};
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/api/me')return new Response(JSON.stringify({user:{id:'owner',login:'Owner'}}));
  if(url.endsWith('/evidence-settings'))return new Response(JSON.stringify({workspace:{role:'owner',archived_at:null}}));
  if(url.includes('eventBefore=999'))return new Response(JSON.stringify({error:'Activity page unavailable.'}),{status:404});
  if(url.includes('/alerts/9'))return new Response(JSON.stringify({alert,events:[{id:url.includes('eventBefore')?1:51,actor_login:'Owner',action:'assigned',detail:url.includes('eventBefore')?'Historical response':'Latest response',created_at:'2026-09-06T00:00:00Z'}],nextEventsCursor:url.includes('eventBefore')?null:'51'}));
  if(url.includes('/alerts?'))return new Response(JSON.stringify({alerts:[alert],nextCursor:null,sourceCount:1,counts:{open:1,waiting:0,done:0,mine:0}}));
  throw new Error(`Unexpected request ${url}`);
 });vi.stubGlobal('fetch',fetcher);
 const view=render(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Older activity'}));
 expect(nav).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&alert=9&eventBefore=51');
 view.rerender(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9&eventBefore=51"/>);
 await screen.findByText(/Historical response/);
 expect(screen.queryByText(/Latest response/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Latest activity'}));
 expect(nav).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&alert=9');
 fireEvent.click(screen.getByRole('tab',{name:/In progress/}));
 expect(nav.mock.lastCall?.[0]).not.toContain('eventBefore');
 expect(nav.mock.lastCall?.[0]).toContain('tab=waiting');
 view.rerender(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9&eventBefore=999"/>);
 await screen.findByText('Activity page unavailable.');
 expect((screen.getByRole('button',{name:'Latest activity'}) as HTMLButtonElement).disabled).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Latest activity'}));
 expect(nav).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&alert=9');
});
it('renders real website evidence, requires a resolution note and preserves the exact attempt link',async()=>{
 const alert={id:9,kind:'web_origin_scan',title:'Website exposure',body:'Public source map',findings:[{rule:'MAP-001',severity:'critical',path:'/assets/app.js.map',title:'Original source exposed',detail:'Source content is public'}],created_at:'2026-09-06T00:00:00Z',installation_id:null,source_origin_id:null,scan_attempt_id:'attempt-9',acknowledged_at:null,resolved_at:null};
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url==='/api/me')return new Response(JSON.stringify({user:{id:'owner',login:'Owner'}}));
  if(url.endsWith('/evidence-settings'))return new Response(JSON.stringify({workspace:{role:'owner',archived_at:null}}));
  if(url.endsWith('/respond'))return new Response(JSON.stringify({alert:{...alert,resolved_at:'2026-09-06',resolution_note:JSON.parse(String(init?.body)).note},events:[]}));
  if(url.endsWith('/alerts/9'))return new Response(JSON.stringify({alert,events:[]}));
  if(url.includes('/alerts?'))return new Response(JSON.stringify({alerts:[alert],nextCursor:null,sourceCount:1,counts:{open:1,waiting:0,done:0,mine:0}}));
  throw new Error(`Unexpected request ${url}`);
 });vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceAlerts workspaceId="workspace" search="?workspace=workspace&alert=9"/>);
 const resolve=await screen.findByRole('button',{name:'Resolve'});
 await waitFor(()=>expect((screen.getByRole('button',{name:'Acknowledge'}) as HTMLButtonElement).disabled).toBe(false));
 expect((resolve as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByRole('link',{name:'Open the saved website check'}).getAttribute('href')).toBe('/watch/releases?workspace=workspace&upload=attempt-9&uploadView=detail');
 fireEvent.change(screen.getByRole('textbox',{name:/Resolution note/}),{target:{value:'Removed public map and recorded follow-up.'}});
 fireEvent.click(resolve);
 await waitFor(()=>expect(fetcher.mock.calls.some(([url,init])=>url.endsWith('/respond')&&JSON.parse(String(init?.body)).action==='resolve')).toBe(true));
 expect(nav).toHaveBeenCalledWith('/watch/alerts?workspace=workspace&alert=9&tab=done');
 expect(fetcher.mock.calls.some(([url])=>url.includes('/check'))).toBe(false);
});
