// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AlertRecheck} from '../src/components/watch/AlertRecheck';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const target={installationId:9,endpoint:'/api/repos/4/scan-latest-release',label:'Scan latest release',detail:'New result, not automatic resolution.'};
it('queues actual source operation and retains scope without resolving the alert',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({target})}).mockResolvedValueOnce({ok:true,json:async()=>({ok:true,queued:true})});vi.stubGlobal('fetch',fetcher);
  render(<AlertRecheck alertId={1} installationId={9} workspaceId="scope" canRespond ended={false}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Scan latest release'}));
  expect(await screen.findByText(/This alert has not been resolved/)).toBeTruthy();
  expect(fetcher.mock.calls[1][0]).toBe('/api/repos/4/scan-latest-release');
  expect(screen.getByRole('link',{name:'View releases'}).getAttribute('href')).toBe('/watch/releases?install=9&workspace=scope');
});
it('keeps viewer controls read-only',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({target})}));
  render(<AlertRecheck alertId={1} installationId={9} workspaceId={null} canRespond={false} ended={false}/>);
  expect((await screen.findByRole('button',{name:'Scan latest release'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Viewer access is read-only.')).toBeTruthy();
});
it('offers Coverage rather than pretending unsupported alerts can be rechecked',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({target:{...target,endpoint:null,label:null,detail:'No supported direct recheck.'}})}));
  render(<AlertRecheck alertId={2} installationId={9} workspaceId="scope" canRespond ended={false}/>);
  expect(await screen.findByText('No supported direct recheck.')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByRole('link',{name:'Open Coverage'}).getAttribute('href')).toBe('/watch/sources?install=9&workspace=scope');
});
it('shows the server refusal without claiming a queued scan',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({target})}).mockResolvedValueOnce({ok:false,json:async()=>({error:'Coverage ended.'})}));
  render(<AlertRecheck alertId={1} installationId={9} workspaceId={null} canRespond ended={false}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Scan latest release'}));
  expect((await screen.findByRole('alert')).textContent).toBe('Coverage ended.');
  expect(screen.queryByRole('link',{name:'View releases'})).toBeNull();
});
