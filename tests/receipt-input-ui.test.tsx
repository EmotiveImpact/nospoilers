// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ReceiptVerifyPanel,verifyHeadline} from '../src/pages/ScanPage';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const file=(name:string)=>({name,text:async()=>JSON.stringify({v:1})}) as File;
it('distinguishes artifact mismatch, unknown signature and unsupported input',()=>{
  expect(verifyHeadline({ok:false,code:'artifact-mismatch'}).title).toMatch(/package does not match/);
  expect(verifyHeadline({ok:false,code:'unrecognized-signature'}).title).toMatch(/not recognized/);
  expect(verifyHeadline({ok:false,code:'unsupported-version'}).title).toMatch(/not supported/);
  expect(verifyHeadline({ok:false,code:'malformed'}).title).not.toMatch(/did not sign/);
});
it('keeps the newest selection even when an aborted request resolves late',async()=>{
  let finish!:(response:Response)=>void;
  const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve})).mockResolvedValueOnce(new Response(JSON.stringify({ok:false,code:'artifact-mismatch'}),{status:400}));
  vi.stubGlobal('fetch',fetcher);
  const {container}=render(<ReceiptVerifyPanel/>);
  const input=container.querySelector('input[type=file]')!;
  fireEvent.change(input,{target:{files:[file('first.json')]}});
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  fireEvent.change(input,{target:{files:[file('second.json')]}});
  await screen.findByText('This package does not match the release proof.');
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async()=>finish(new Response(JSON.stringify({ok:true,status:'passed'}))));
  expect(screen.getByText('This package does not match the release proof.')).toBeTruthy();
  expect(screen.queryByText('This instance signed a passing release proof.')).toBeNull();
});
it('aborts verification when the panel unmounts',async()=>{
  const fetcher=vi.fn().mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal('fetch',fetcher);
  const {container,unmount}=render(<ReceiptVerifyPanel/>);
  fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file('proof.json')]}});
  await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
  unmount();expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
