// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {act,render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {GithubConnectionReturn,GithubWorkspaceConnect} from '../src/components/watch/GithubWorkspaceConnection';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('isolates pending connection feedback when the selected workspace changes',async()=>{
 let finish!:(response:Response)=>void;
 const pending=new Promise<Response>(resolve=>{finish=resolve;});
 const fetcher=vi.fn(()=>pending);vi.stubGlobal('fetch',fetcher);
 const view=render(<GithubWorkspaceConnect workspaceId="first"/>);
 fireEvent.click(screen.getByRole('button'));
 expect(fetcher).toHaveBeenCalledWith('/api/workspaces/first/github',{method:'POST'});
 view.rerender(<GithubWorkspaceConnect workspaceId="second"/>);
 expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>{finish(Response.json({error:'Old workspace error'},{status:403}));await pending;});
 expect(screen.queryByRole('alert')).toBeNull();
 fireEvent.click(screen.getByRole('button'));
 expect(fetcher).toHaveBeenLastCalledWith('/api/workspaces/second/github',{method:'POST'});
 await screen.findByRole('alert');
});
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
it('offers a verified existing personal installation before opening GitHub',async()=>{
 const fetcher=vi.fn(async()=>Response.json({status:'existing_available',installations:[{installationId:999,accountLogin:'EmotiveImpact',accountType:'User'}]}));vi.stubGlobal('fetch',fetcher);
 render(<GithubWorkspaceConnect workspaceId="workspace"/>);fireEvent.click(screen.getByRole('button',{name:'Connect GitHub to this workspace'}));
 expect(await screen.findByRole('button',{name:'Connect EmotiveImpact'})).toBeTruthy();
 expect(screen.getByText('Existing personal GitHub connection')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Use a different GitHub account'})).toBeTruthy();
});
