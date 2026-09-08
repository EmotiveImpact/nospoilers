// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WorkspaceEvidenceSettings} from '../src/components/watch/WorkspaceEvidenceSettings';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const data={workspace:{name:'Product',organization_id:'org',role:'viewer',organization_owner:false},retention:{savedScans:4,activeScans:1},events:[],nextCursor:null};
it('explains enforced retention without offering viewers deletion',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(data))));
 render(<WorkspaceEvidenceSettings workspaceId="first" view="retention"/>);
 expect(await screen.findByText(/Ask an organisation owner/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Request deletion review'})).toBeNull();
 expect(screen.getByText(/no automatic history-expiry setting/)).toBeTruthy();
});
it('loads scoped older audit history and clears the old page on workspace changes',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({...data,events:[{id:'event',action:'created',actor:'owner',created_at:'2026-09-05T12:00:00Z'}],nextCursor:'event'})));vi.stubGlobal('fetch',fetcher);
 const {rerender}=render(<WorkspaceEvidenceSettings workspaceId="first" view="audit"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Older activity'}));
 await screen.findByText('created');
 expect(fetcher).toHaveBeenLastCalledWith('/api/workspaces/first/evidence-settings?before=event',expect.anything());
 rerender(<WorkspaceEvidenceSettings workspaceId="second" view="audit"/>);
 await screen.findByText('created');
 expect(fetcher).toHaveBeenLastCalledWith('/api/workspaces/second/evidence-settings',expect.anything());
});
it('offers retry after a failed settings request',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Please retry.'}),{status:503})));
 render(<WorkspaceEvidenceSettings workspaceId="first" view="audit"/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Please retry.'));
 expect(screen.getByRole('button',{name:'Retry'})).toBeTruthy();
});
