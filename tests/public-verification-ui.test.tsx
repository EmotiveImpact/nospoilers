// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {VerifyPage} from '../src/pages/VerifyPage';

const verification={coordinate:'package@1',channel:'npm',artifactSha256:'abc',artifactSha512:null,artifactBytes:123,mediaType:null,sourceRevision:null,receiptStatus:'passed',passingReceipt:true,mismatch:false,approval:null,createdAt:'2026-09-05T10:00:00Z',deliveries:[]};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('public proof presentation',()=>{
  it('explains missing links without an endless loading state',()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    render(<VerifyPage path="/verify"/>);
    expect(screen.getByRole('heading',{name:'Verification unavailable'})).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not reveal whether an unavailable link existed or was withdrawn',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:404})));
    render(<VerifyPage path="/verify/token"/>);
    expect(await screen.findByText(/incorrect, private or withdrawn/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Try again'})).toBeNull();
  });
  it('retries transient failures without retaining a false result',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({verification})));
    vi.stubGlobal('fetch',fetcher);render(<VerifyPage path="/verify/token"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Try again'}));
    expect(await screen.findByRole('heading',{name:'Recorded policy passed'})).toBeTruthy();
    expect(screen.getByText(/Issuer identity and signature validity are not independently established/)).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('prioritises mismatch over passing metadata',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({verification:{...verification,mismatch:true,passingReceipt:false}}))));
    render(<VerifyPage path="/verify/token"/>);
    expect(await screen.findByRole('heading',{name:'Artifact digest mismatch'})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Recorded policy passed'})).toBeNull();
  });
  it('clears the previous token immediately on navigation',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({verification}))).mockImplementationOnce(()=>new Promise(()=>{})));
    const view=render(<VerifyPage path="/verify/first"/>);
    await screen.findByText('package@1');view.rerender(<VerifyPage path="/verify/second"/>);
    expect(screen.queryByText('package@1')).toBeNull();expect(screen.getByRole('status')).toBeTruthy();
  });
  it('rejects an incomplete response instead of loading forever',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
    render(<VerifyPage path="/verify/token"/>);
    await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('incomplete'));
  });
});
