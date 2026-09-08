// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {GithubConnectionReturn,GithubWorkspaceConnect} from '../src/components/watch/GithubWorkspaceConnection';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('waits for an explicit finish action and offers honest webhook retry',async()=>{
 const fetcher=vi.fn(async()=>Response.json({status:'awaiting_webhook'},{status:202}));vi.stubGlobal('fetch',fetcher);
 render(<GithubConnectionReturn/>);expect(fetcher).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Finish connection'}));
 await screen.findByRole('button',{name:'Check again'});
 expect(screen.getByRole('status').textContent).toContain('Nothing has been attached or scanned');
 fireEvent.click(screen.getByRole('button',{name:'Check again'}));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
});
it('explains unavailable GitHub services and prevents a disabled start',async()=>{
 const fetcher=vi.fn(async()=>Response.json({error:'GitHub is not configured.'},{status:503}));vi.stubGlobal('fetch',fetcher);
 const view=render(<GithubWorkspaceConnect workspaceId="workspace" disabledReason="Viewer access is read-only."/>);
 fireEvent.click(screen.getByRole('button'));expect(fetcher).not.toHaveBeenCalled();expect(screen.getByRole('status').textContent).toContain('Viewer');
 view.rerender(<GithubWorkspaceConnect workspaceId="workspace"/>);fireEvent.click(screen.getByRole('button'));
 expect((await screen.findByRole('alert')).textContent).toContain('not configured');
});
