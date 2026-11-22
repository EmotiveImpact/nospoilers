// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchMonolithShell} from '../src/components/WatchMonolithShell';
import {parseWatchRoute} from '../src/watch/routes';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
function Shell({login='owner'}:{login?:string}){
 return <WatchMonolithShell route={parseWatchRoute('/watch','?workspace=w1')} search="?workspace=w1" ended={false} role="admin" teamOnly adminOnly login={login} sourceCount={0} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={0} setupTotal={0} firstRun={false} installations={[]} activeInstallId={null} onInstall={()=>{}} onOpenPalette={()=>{}}><p>Overview content</p></WatchMonolithShell>;
}
it('retains one shared workspace request across desktop collapse and mobile drawer reopen, and refreshes on changes',async()=>{
 let name='Studio';
 const fetcher=vi.fn(async(url:string)=>Response.json(url==='/api/workspaces'?{workspaces:[{id:'w1',name,organization_id:'org',role:'owner',archived_at:null,installation_id:null}]}:{counts:{open:0,waiting:0,done:0,mine:0}}));
 vi.stubGlobal('fetch',fetcher);
 render(<Shell/>);
 await screen.findByText('Studio');
 const requests=()=>fetcher.mock.calls.filter(([url])=>url==='/api/workspaces').length;
 expect(requests()).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'Collapse sidebar'}));
 fireEvent.click(screen.getByRole('button',{name:'Expand sidebar'}));
 expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Studio');
 expect(screen.queryByText('Loading workspaces…')).toBeNull();
 expect(requests()).toBe(1);
 for(let n=0;n<2;n++){
  fireEvent.click(screen.getByRole('button',{name:'Open watch navigation'}));
  const drawer=await screen.findByRole('dialog');
  expect(within(drawer).getByRole('button',{name:'Workspace'}).textContent).toContain('Studio');
  expect(requests()).toBe(1);
  fireEvent.click(within(drawer).getByRole('button',{name:'Close watch navigation'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 }
 name='Renamed studio';
 fireEvent(window,new Event('nospoilers:workspaces-changed'));
 await screen.findByText('Renamed studio');
 expect(requests()).toBe(2);
});

it('does not reuse workspace names across signed-in identities',async()=>{
 let next=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url!=='/api/workspaces')return Response.json({counts:{open:0}});
  if(next)return new Promise<Response>(()=>{});
  return Response.json({workspaces:[{id:'w1',name:'Private studio',organization_id:'org',role:'owner',archived_at:null,installation_id:null}]});
 }));
 const view=render(<Shell/>);
 await screen.findByText('Private studio');
 next=true;view.rerender(<Shell login="other"/>);
 expect(screen.queryByText('Private studio')).toBeNull();
 expect(screen.getByText('Loading workspaces…')).toBeTruthy();
});

it('collapses the sidebar with the "[" key, remembers it, and ignores the key while typing',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[],counts:{open:0}})));
 vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('min-width: 1024px'),media:query,addEventListener(){},removeEventListener(){}}));
 render(<><Shell/><input aria-label="Notes"/></>);
 expect(screen.getByRole('button',{name:'Collapse sidebar'}).getAttribute('aria-keyshortcuts')).toBe('[');
 fireEvent.keyDown(window,{key:'['});
 expect(screen.getByRole('button',{name:'Expand sidebar'}).getAttribute('aria-expanded')).toBe('false');
 expect(localStorage.getItem('nospoilers.watch.sidebar-collapsed')).toBe('1');
 // On the icon rail every destination keeps its name as a tooltip.
 expect(screen.getByRole('link',{name:'Alerts'}).getAttribute('title')).toBe('Alerts');
 fireEvent.keyDown(screen.getByLabelText('Notes'),{key:'['});
 expect(screen.getByRole('button',{name:'Expand sidebar'})).toBeTruthy();
 fireEvent.keyDown(window,{key:'[',ctrlKey:true});
 expect(screen.getByRole('button',{name:'Expand sidebar'})).toBeTruthy();
 fireEvent.keyDown(window,{key:'['});
 expect(screen.getByRole('button',{name:'Collapse sidebar'})).toBeTruthy();
 expect(localStorage.getItem('nospoilers.watch.sidebar-collapsed')).toBe('0');
});
