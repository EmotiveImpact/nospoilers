// @vitest-environment jsdom
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {DisconnectedRepositories} from '../src/components/watch/DisconnectedRepositories';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows retained identity without implying a clean verdict or offering a scan',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({repos:[{id:99,fullName:'owner/repo',disconnectedAt:'2026-09-05T00:00:00Z'}]}))));
 const {rerender}=render(<DisconnectedRepositories installationId={7}/>);
 expect(await screen.findByText('owner/repo')).toBeTruthy();
 expect(screen.getByText(/does not mean the repository is clean/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:/scan/i})).toBeNull();
 vi.stubGlobal('fetch',vi.fn().mockReturnValue(new Promise(()=>{})));
 rerender(<DisconnectedRepositories installationId={8}/>);
 expect(screen.queryByText('owner/repo')).toBeNull();
 expect(screen.getByRole('status')).toBeTruthy();
});
it('reports a failed read rather than showing an empty connected state',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));
 render(<DisconnectedRepositories installationId={7}/>);
 await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.getByRole('button',{name:'Retry'})).toBeTruthy();
});
