// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SettingsTabs} from '../src/components/watch/design/SettingsTabs';
import {WorkspaceManagement} from '../src/components/watch/WorkspaceManagement';
import {WorkspaceSwitcher} from '../src/components/watch/WorkspaceSwitcher';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const workspace={id:'w1',name:'Original',organization_id:'o1',role:'owner',archived_at:null,installation_id:null};
const organizations=[{id:'o1',name:'Account',role:'owner',workspace_limit:2}];
it('submits workspace creation through its visible button',async()=>{
  const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(new Response(JSON.stringify(options?.method?{}:{workspaces:[workspace],organizations,invites:[]}))));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
  await userEvent.click(await screen.findByRole('tab',{name:'Create workspace'}));
  fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Production'}});
  fireEvent.click(screen.getByRole('button',{name:'Create workspace'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'o1',name:'Production'})})));
});
it('submits a renamed workspace through Save name',async()=>{
  const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(new Response(JSON.stringify(options?.method?{}:{workspaces:[workspace],organizations,invites:[]}))));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
  fireEvent.click(await screen.findByRole('button',{name:'Rename'}));
  fireEvent.change(screen.getByDisplayValue('Original'),{target:{value:'Renamed'}});
  fireEvent.click(screen.getByRole('button',{name:'Save name'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces/w1',expect.objectContaining({method:'PATCH',body:JSON.stringify({name:'Renamed'})})));
});
it('does not expose workspace mutations to a viewer',async()=>{
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({workspaces:[{...workspace,role:'viewer'}]})))));
  render(<WorkspaceManagement/>);await screen.findByRole('heading',{name:'Original'});
  expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Create new workspace'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Rename'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
});
it('refreshes the sidebar after workspace changes without a page reload',async()=>{
  let name='Original';
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({workspaces:[{...workspace,name}]})))));
  render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
  name='Renamed';
  fireEvent(window,new Event('nospoilers:workspaces-changed'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Renamed'));
  expect(screen.queryByText('Original')).toBeNull();
});
it('clears stale workspace choices on failed refresh and recovers explicitly',async()=>{
 let unavailable=false;
 vi.stubGlobal('fetch',vi.fn(async()=>unavailable?new Response('{}',{status:403}):new Response(JSON.stringify({workspaces:[workspace]}))));
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 expect(screen.queryByText('Loading workspaces…')).toBeNull();
 unavailable=true;fireEvent(window,new Event('nospoilers:workspaces-changed'));
 await screen.findByRole('alert');
 expect(screen.queryByText('Original')).toBeNull();
 expect((screen.getByRole('button',{name:'Workspace'}) as HTMLButtonElement).disabled).toBe(true);
 unavailable=false;fireEvent.click(screen.getByRole('button',{name:'Retry workspaces'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 expect(screen.queryByRole('alert')).toBeNull();
});
it('shows available workspace avatars and readable initials when absent or unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[{...workspace,name:'Release Team',avatar_url:'/workspace-avatar.png'},{...workspace,id:'w2',name:'Client Studio'}],invites:[]})));
  const {container}=render(<WorkspaceManagement/>);
  await screen.findByRole('heading',{name:'Release Team'});
  const avatar=container.querySelector('img[src="/workspace-avatar.png"]');
  expect(avatar).not.toBeNull();expect(screen.getByText('CS')).toBeTruthy();
  fireEvent.error(avatar!);
  expect(container.querySelector('img')).toBeNull();expect(screen.getByText('RT')).toBeTruthy();
});
it('keeps the existing creation form without a duplicate plus tile',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
  render(<WorkspaceManagement/>);
  await userEvent.click(await screen.findByRole('tab',{name:'Create workspace'}));
  expect(await screen.findByLabelText('Workspace name')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Create workspace'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Create new workspace'})).toBeNull();
});

it('offers workspace choices with avatars and a plus creation action in the sidebar menu',async()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}unobserve(){}disconnect(){}});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace,{...workspace,id:'w2',name:'Client Studio',installation_id:7,avatar_url:'/client.png'}]})));
 const view=render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 await userEvent.click(screen.getByRole('button',{name:'Workspace'}));
 expect(screen.queryByRole('button',{name:'Manage workspaces'})).toBeNull();
 const target=await screen.findByRole('menuitem',{name:'Client Studio'});
 expect(target.querySelector('img')?.getAttribute('src')).toBe('/client.png');
 fireEvent.error(target.querySelector('img')!);expect(target.textContent).toContain('CS');
 await userEvent.click(target);expect(window.location.search).toBe('?workspace=w2&install=7');
 view.rerender(<WorkspaceSwitcher search="?workspace=w2&install=7&upload=old&uploadView=detail&configure=github" installationId={7}/>);
 await userEvent.click(screen.getByRole('button',{name:'Workspace'}));
 const create=await screen.findByRole('menuitem',{name:'Create new workspace'});
 expect(create.querySelector('svg')).not.toBeNull();await userEvent.click(create);
 expect(window.location.pathname).toBe('/watch/workspaces');
 const query=new URLSearchParams(window.location.search);
 expect(Object.fromEntries(query)).toEqual({workspaceTab:'create',workspace:'w2',install:'7'});
});

it('supports workspace typeahead and Escape without changing workspace, then returns focus',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace,{...workspace,id:'w2',name:'Client Studio',installation_id:7}]})));
 window.history.replaceState({},'','/watch?workspace=w1');
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 const trigger=await screen.findByRole('button',{name:'Workspace'});
 await waitFor(()=>expect(trigger.textContent).toContain('Original'));
 trigger.focus();await userEvent.keyboard('{ArrowDown}');await screen.findByRole('menu');await userEvent.keyboard('cli');
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:'Client Studio'})));
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
 expect(window.location.search).toBe('?workspace=w1');
});

it('uses the explicitly selected organisation when creating a workspace',async()=>{
 const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(Response.json(options?.method?{}:{workspaces:[workspace],organizations:[...organizations,{...organizations[0],id:'o2',name:'Client account'}],invites:[]})));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 await userEvent.click(await screen.findByRole('tab',{name:'Create workspace'}));
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Client account · existing subscription'}));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Client production'}});
 fireEvent.click(screen.getByRole('button',{name:'Create workspace'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'o2',name:'Client production'})})));
});

it('opens the create deep link and keeps its draft while moving between settings tabs',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 const createTab=await screen.findByRole('tab',{name:'Create workspace'});
 await waitFor(()=>expect(createTab.getAttribute('aria-selected')).toBe('true'));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Draft workspace'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
 await userEvent.click(createTab);
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Draft workspace');
});

it('reveals the active settings tab after activation and resize by scrolling only its tab list',async()=>{
 vi.stubGlobal('ResizeObserver',undefined);
 const scrollPage=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const scrollElement=vi.spyOn(HTMLElement.prototype,'scrollIntoView');
 let width=100;
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  if(this.getAttribute('role')==='tablist')return new DOMRect(0,0,width,40);
  if(this.getAttribute('role')==='tab'){
   const left=this.textContent==='Organisation'?90:0;
   return new DOMRect(left-(this.parentElement?.scrollLeft??0),0,90,40);
  }
  return new DOMRect();
 });
 try{
  const tabs=[{id:'workspaces',label:'Workspaces',content:<p>Workspace content</p>},{id:'organisation',label:'Organisation',content:<p>Organisation content</p>}];
  const view=render(<SettingsTabs label="Settings" tabs={tabs} value="workspaces"/>);
  const list=screen.getByRole('tablist',{name:'Settings'});
  expect(list.scrollLeft).toBe(0);
  view.rerender(<SettingsTabs label="Settings" tabs={tabs} value="organisation"/>);
  expect(list.scrollLeft).toBe(80);
  width=60;fireEvent(window,new Event('resize'));
  expect(list.scrollLeft).toBe(120);
  expect(scrollPage).not.toHaveBeenCalled();expect(scrollElement).not.toHaveBeenCalled();
 }finally{bounds.mockRestore();scrollPage.mockRestore();scrollElement.mockRestore();}
});

it('keeps a creation draft when an unrelated workspace is archived',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method?{}:{workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 await userEvent.click(screen.getByRole('tab',{name:'Create workspace'}));
 fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Unfinished workspace'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Archive'}));
 await screen.findByRole('button',{name:'Archive'});
 await userEvent.click(screen.getByRole('tab',{name:'Create workspace'}));
 expect(await screen.findByLabelText('Workspace name')).toHaveProperty('value','Unfinished workspace');
});

it('removes stale workspace mutation controls after a failed list refresh',async()=>{
 let saved=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method){saved=true;return Response.json({});}
  if(url==='/api/workspaces'&&saved)return Response.json({error:'Access revoked'},{status:403});
  return Response.json({workspaces:[workspace],organizations,invites:[]});
 }));
 render(<WorkspaceManagement/>);
 await userEvent.click(await screen.findByRole('button',{name:'Archive'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Could not load workspaces.'));
 expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
 expect(screen.queryByText('No workspaces yet')).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Create workspace'}));
 expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Organisation',exact:true}));
 expect(screen.queryByText('Account · organisation administration')).toBeNull();
 expect(screen.queryByText('No organisation administration access')).toBeNull();
});

it('requires a fresh organisation choice when the selected organisation disappears on refresh',async()=>{
 let saved=false;
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method){saved=true;return Response.json({});}
  return Response.json({workspaces:[workspace],organizations:saved?organizations:[...organizations,{...organizations[0],id:'o2',name:'Client'}],invites:[]});
 });
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 await userEvent.click(screen.getByRole('tab',{name:'Create workspace'}));
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Client · existing subscription'}));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Client draft'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Archive'}));
 await screen.findByRole('button',{name:'Archive'});
 await userEvent.click(screen.getByRole('tab',{name:'Create workspace'}));
 const button=await screen.findByRole('button',{name:'Create workspace'});
 expect(button).toHaveProperty('disabled',true);
 expect(screen.getByRole('combobox',{name:'Organisation'}).textContent).toContain('Choose an organisation');
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Client draft');
 fireEvent.submit(button.closest('form')!);
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});

it('synchronises popstate tabs without rewriting scoped history or discarding the create draft',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w1&install=7&workspaceTab=create');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Keep this draft'}});
 await userEvent.click(screen.getByRole('tab',{name:'Connections',exact:true}));
 expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({workspace:'w1',install:'7',workspaceTab:'connections'});
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspace=w1&install=7&workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(screen.getByRole('tab',{name:'Create workspace'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Keep this draft');
});
