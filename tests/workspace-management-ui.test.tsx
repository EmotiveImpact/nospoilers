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
  expect(screen.queryByRole('button',{name:'Rename'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
});
it('refreshes the sidebar after workspace changes without a page reload',async()=>{
  let name='Original';
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({workspaces:[{...workspace,name}]})))));
  render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
  await screen.findByRole('option',{name:'Original'});
  name='Renamed';
  fireEvent(window,new Event('nospoilers:workspaces-changed'));
  await screen.findByRole('option',{name:'Renamed'});
  expect(screen.queryByRole('option',{name:'Original'})).toBeNull();
});
it('clears stale workspace choices on failed refresh and recovers explicitly',async()=>{
 let unavailable=false;
 vi.stubGlobal('fetch',vi.fn(async()=>unavailable?new Response('{}',{status:403}):new Response(JSON.stringify({workspaces:[workspace]}))));
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await screen.findByRole('option',{name:'Original'});
 expect(screen.queryByRole('option',{name:'Loading workspaces…'})).toBeNull();
 unavailable=true;fireEvent(window,new Event('nospoilers:workspaces-changed'));
 await screen.findByRole('alert');
 expect(screen.queryByRole('option',{name:'Original'})).toBeNull();
 expect((screen.getByRole('combobox',{name:'Workspace'}) as HTMLSelectElement).disabled).toBe(true);
 unavailable=false;fireEvent.click(screen.getByRole('button',{name:'Retry workspaces'}));
 await screen.findByRole('option',{name:'Original'});
 expect(screen.queryByRole('alert')).toBeNull();
});
