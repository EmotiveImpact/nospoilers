// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchWorkspace} from '../src/pages/WatchWorkspace';
import {WorkspaceBoundary} from '../src/components/watch/WorkspaceBoundary';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const workspaces=[{id:'personal',installation_id:null,archived_at:null},{id:'team',installation_id:7,archived_at:null}];
function responses(uploadWorkspace='team'){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url==='/api/me'?{user:{login:'test'}}:url==='/api/workspaces'?{workspaces}:{upload:{workspace_id:uploadWorkspace}}))));
}
it('canonicalizes unscoped product entry without displaying aggregate evidence',async()=>{
  responses();render(<WatchWorkspace path="/watch/releases" search=""/>);
  await waitFor(()=>expect(new URLSearchParams(window.location.search).get('workspace')).toBe('personal'));
  expect(screen.queryByText('Uploaded releases')).toBeNull();
});
it('resolves an old upload link using immutable ownership rather than the first workspace',async()=>{
  responses();render(<WatchWorkspace path="/watch/releases" search="?upload=record"/>);
  await waitFor(()=>expect(new URLSearchParams(window.location.search).get('workspace')).toBe('team'));
  expect(new URLSearchParams(window.location.search).get('install')).toBe('7');
});
it('does not replace an inaccessible installation with the first available one',async()=>{
  responses();render(<WatchWorkspace path="/watch/releases" search="?install=99"/>);
  expect(await screen.findByRole('heading',{name:'Workspace unavailable'})).toBeTruthy();
  expect(window.location.search).toBe('');
});
it('rejects a conflicting installation and upload owner in a legacy link',async()=>{
  responses('personal');render(<WatchWorkspace path="/watch/releases" search="?install=7&upload=record"/>);
  expect(await screen.findByRole('heading',{name:'Workspace unavailable'})).toBeTruthy();
});
it('preserves a secondary connection when resolving a legacy link',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url==='/api/me'?{user:{login:'test'}}:{workspaces:[{...workspaces[1],installation_ids:[7,8]}]}))));
  render(<WatchWorkspace path="/watch/releases" search="?install=8"/>);
  await waitFor(()=>expect(new URLSearchParams(window.location.search).get('workspace')).toBe('team'));
  expect(new URLSearchParams(window.location.search).get('install')).toBe('8');
});
it('routes a selected secondary source and passes only this workspace’s connections to the product',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url==='/api/me'?{user:{login:'test'},installations:[{id:7,role:'admin'},{id:8,role:'admin'},{id:99,role:'admin'}]}:{workspaces:[{...workspaces[1],role:'owner',installation_ids:[7,8]}]}))));
  const legacy=vi.fn(()=> <p>Scoped product</p>);
  render(<WorkspaceBoundary id="team" path="/watch/releases" search="?workspace=team&install=8" legacy={legacy}/>);
  expect(await screen.findByText('Scoped product')).toBeTruthy();
  expect(legacy).toHaveBeenCalledWith('?workspace=team&install=8',[7,8]);
});
it('rejects another accessible source when it belongs to a different workspace',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url==='/api/me'?{user:{login:'test'},installations:[{id:7,role:'admin'},{id:99,role:'admin'}]}:{workspaces:[{...workspaces[1],role:'owner',installation_ids:[7]}]}))));
  const legacy=vi.fn(()=>null);
  render(<WorkspaceBoundary id="team" path="/watch/releases" search="?workspace=team&install=99" legacy={legacy}/>);
  expect(await screen.findByRole('heading',{name:'Source unavailable in this workspace'})).toBeTruthy();
  expect(legacy).not.toHaveBeenCalled();
});
