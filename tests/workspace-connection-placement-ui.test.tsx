// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceConnectionPlacement} from '../src/components/watch/WorkspaceConnectionPlacement';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const source={id:'source',organization_id:'org',name:'Source',role:'admin',archived_at:null,installation_id:12};
const target={...source,id:'target',name:'Production',role:'owner',installation_id:null};
it('limits destinations to active administered workspaces in the same organisation',async()=>{
  render(<WorkspaceConnectionPlacement workspaces={[source,target,{...target,id:'foreign',name:'Foreign',organization_id:'other'},{...target,id:'viewer',name:'Viewer',role:'viewer'},{...target,id:'archived',name:'Archived',archived_at:'2026-09-01'}]} organizationIds={['org']} onChanged={()=>{}}/>);
  await userEvent.click(screen.getByRole('combobox',{name:'Connection'}));
  await userEvent.click(await screen.findByRole('option',{name:/Source/}));
  await userEvent.click(screen.getByRole('combobox',{name:'Destination workspace'}));
  expect(screen.getByRole('option',{name:'Production'})).toBeTruthy();
  for(const name of ['Foreign','Viewer','Archived'])expect(screen.queryByRole('option',{name})).toBeNull();
});
it('submits the explicit destination and preserves server rejection rather than claiming a move',async()=>{
  const changed=vi.fn(),fetcher=vi.fn(()=>Promise.resolve(new Response(JSON.stringify({error:'Existing evidence cannot be moved.'}),{status:409})));
  vi.stubGlobal('fetch',fetcher);
  render(<WorkspaceConnectionPlacement workspaces={[source,target]} organizationIds={['org']} onChanged={changed}/>);
  await userEvent.click(screen.getByRole('combobox',{name:'Connection'}));
  await userEvent.click(await screen.findByRole('option',{name:/Source/}));
  await userEvent.click(screen.getByRole('combobox',{name:'Destination workspace'}));
  await userEvent.click(await screen.findByRole('option',{name:'Production'}));
  fireEvent.click(screen.getByRole('button',{name:'Check and move unused connection'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces/source/connections/12/move',expect.objectContaining({method:'POST',body:JSON.stringify({destinationWorkspaceId:'target'})})));
  expect((await screen.findByRole('alert')).textContent).toContain('Existing evidence cannot be moved.');
  expect(changed).not.toHaveBeenCalled();
});
