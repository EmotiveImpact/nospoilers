// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AlertRelatedReleases} from '../src/components/watch/AlertRelatedReleases';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses exact returned revision IDs and preserves source/workspace scope',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({releases:[{id:42,coordinate:'github:org/repo@v1#asset.zip'}]})});
  vi.stubGlobal('fetch',fetcher);
  render(<AlertRelatedReleases alertId={3} installationId={9} workspaceId="workspace-a"/>);
  const link=await screen.findByRole('link');
  expect(link.getAttribute('href')).toBe('/watch/releases?install=9&release=42&workspace=workspace-a');
  expect(fetcher.mock.calls[0][0]).toBe('/api/alerts/3/releases?installationId=9&workspaceId=workspace-a');
});
it('shows legacy empty state without inventing a release and clears links on scope change',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({releases:[]})}));
  const view=render(<AlertRelatedReleases alertId={3} installationId={9} workspaceId="workspace-a"/>);
  expect(await screen.findByText(/No linked release was recorded/)).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
  view.rerender(<AlertRelatedReleases alertId={4} installationId={10} workspaceId="workspace-b"/>);
  expect(screen.getByRole('status').textContent).toMatch(/Loading/);
  await screen.findByText(/No linked release was recorded/);
});
it('offers retry after unavailable associations without exposing stale evidence',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>({releases:[]})});
  vi.stubGlobal('fetch',fetcher);
  render(<AlertRelatedReleases alertId={3} installationId={9} workspaceId="workspace-a"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry related releases'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
  expect(await screen.findByText(/No linked release was recorded/)).toBeTruthy();
});
