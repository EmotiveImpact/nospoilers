// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {WorkspaceSwitcher} from '../src/components/watch/WorkspaceSwitcher';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('closes an open workspace menu after a failed refresh, removing stale navigation actions',async()=>{
 let unavailable=false;
 vi.stubGlobal('fetch',vi.fn(async()=>unavailable?Response.json({error:'Access changed'},{status:403}):Response.json({workspaces:[{id:'w1',name:'Original',organization_id:'org',role:'owner',archived_at:null,installation_id:7}]})));
 render(<WorkspaceSwitcher search="?workspace=w1&install=7" installationId={7}/>);
 const trigger=screen.getByRole('button',{name:'Workspace'});
 await waitFor(()=>expect(trigger.textContent).toContain('Original'));
 await userEvent.click(trigger);
 expect(await screen.findByRole('menuitem',{name:'Create new workspace'})).toBeTruthy();
 unavailable=true;fireEvent(window,new Event('nospoilers:workspaces-changed'));
 await screen.findByRole('alert');
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
 expect(trigger).toHaveProperty('disabled',true);
 expect(screen.queryByRole('menuitem',{name:'Create new workspace'})).toBeNull();
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Retry workspaces'})));
 unavailable=false;await userEvent.click(screen.getByRole('button',{name:'Retry workspaces'}));
 await waitFor(()=>expect(trigger).toHaveProperty('disabled',false));
 await userEvent.click(trigger);
 expect(await screen.findByRole('menuitem',{name:/Original/})).toBeTruthy();
});
