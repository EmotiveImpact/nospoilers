// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceManagement} from '../src/components/watch/WorkspaceManagement';
import {WorkspaceSwitcher} from '../src/components/watch/WorkspaceSwitcher';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const workspace={id:'w1',name:'Original',organization_id:'o1',role:'owner',archived_at:null,installation_id:null};
const organizations=[{id:'o1',name:'Account',role:'owner',workspace_limit:2}];
it('submits workspace creation through its visible button',async()=>{
  const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(new Response(JSON.stringify(options?.method?{}:{workspaces:[workspace],organizations,invites:[]}))));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
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
  expect(await screen.findByLabelText('Workspace name')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Create workspace'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Create new workspace'})).toBeNull();
});

it('offers workspace choices with avatars and a plus creation action in the sidebar menu',async()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}unobserve(){}disconnect(){}});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace,{...workspace,id:'w2',name:'Client Studio',installation_id:7,avatar_url:'/client.png'}]})));
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 fireEvent.click(screen.getByRole('button',{name:'Workspace'}));
 expect(screen.queryByRole('button',{name:'Manage workspaces'})).toBeNull();
 const target=await screen.findByRole('menuitem',{name:'Client Studio'});
 expect(target.querySelector('img')?.getAttribute('src')).toBe('/client.png');
 fireEvent.error(target.querySelector('img')!);expect(target.textContent).toContain('CS');
 fireEvent.click(target);expect(window.location.search).toBe('?workspace=w2&install=7');
 fireEvent.click(screen.getByRole('button',{name:'Workspace'}));
 const create=await screen.findByRole('menuitem',{name:'Create new workspace'});
 expect(create.querySelector('svg')).not.toBeNull();fireEvent.click(create);
 expect(window.location.pathname).toBe('/watch/workspaces');
});
