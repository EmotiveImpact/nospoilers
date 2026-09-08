// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {WorkspaceAlertBadge} from '../src/components/watch/WorkspaceAlertBadge';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows workspace open counts and immediately clears the old badge on scope changes',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({open:3}))).mockImplementationOnce(()=>new Promise(()=>{}));vi.stubGlobal('fetch',fetch);
 const view=render(<WorkspaceAlertBadge workspaceId="one"/>);await screen.findByText('3');
 expect(fetch.mock.calls[0][0]).toBe('/api/workspaces/one/alert-counts');
 view.rerender(<WorkspaceAlertBadge workspaceId="two"/>);
 expect(screen.queryByText('3')).toBeNull();expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
