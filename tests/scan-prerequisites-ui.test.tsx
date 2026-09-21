// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ScanPage} from '../src/pages/ScanPage';
import {navigate} from '../src/nav';
import type {ProductWorkspace} from '../src/watch/workspace-types';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();window.history.replaceState({},'', '/');});
const scope='?workspace=chosen&install=7&upload=old&release=2&preview=3&configure=github&tab=done';
const workspace=(overrides:Partial<ProductWorkspace>={}):ProductWorkspace=>({id:'chosen',name:'Customer',organization_id:'org',installation_id:7,archived_at:null,role:'admin',plan:null,trial_ends_at:'2020-01-01',...overrides});
const me={user:{login:'owner'},coverage:{status:'active',plan:'solo'},installations:[{id:7,account_login:'Customer',trialEndsAt:'2020-01-01',plan:null,suspended:false,role:'admin'}]};
it('offers scoped saved evidence and recovery while expired coverage blocks every new scan mode',async()=>{
 const fetcher=vi.fn(async(_url:unknown)=>Response.json(me));vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search={scope} workspace={workspace()}/>);
 const prerequisites=await screen.findByRole('region',{name:'Scan prerequisites'});
 expect(within(prerequisites).getByRole('link',{name:'Plan & billing'}).getAttribute('href')).toBe('/watch/workspaces?workspace=chosen&install=7&workspaceTab=billing');
 for(const [name,path] of [['View saved releases','releases'],['View coverage','sources']]){
  expect(within(prerequisites).getByRole('link',{name}).getAttribute('href')).toBe(`/watch/${path}?workspace=chosen&install=7`);
 }
 expect(screen.queryByLabelText('Repository')).toBeNull();
 expect(screen.queryByRole('button',{name:'Scan latest release'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Close scan access'}));
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('tab',{name:/Package or build/}));
 expect(document.querySelector('input[type="file"]')).toBeNull();
 expect(screen.queryByText('No hosted scan yet.')).toBeNull();
 fireEvent.click(screen.getByRole('tab',{name:/Production website/}));
 const url=screen.getByRole('textbox',{name:'HTTPS production URL'});
 fireEvent.change(url,{target:{value:'https://owned.example/'}});
 expect((screen.getByRole('button',{name:'Continue to verification'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.submit(url.closest('form')!);
 expect(navigate).not.toHaveBeenCalled();
 expect(fetcher.mock.calls.every(call=>String(call[0])==='/api/me')).toBe(true);
});
it('gives an active viewer saved evidence access without a renewal upsell',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(me)));
 render(<ScanPage embedded search={scope} workspace={workspace({role:'viewer',plan:'team'})}/>);
 const prerequisites=await screen.findByRole('region',{name:'Scan prerequisites'});
 expect(prerequisites.textContent).toContain('Viewer access is read-only');
 expect(within(prerequisites).getByRole('link',{name:'View saved releases'}).getAttribute('href')).toBe('/watch/releases?workspace=chosen&install=7');
 expect(screen.queryByRole('link',{name:'See plans'})).toBeNull();
 expect(screen.queryByLabelText('Repository')).toBeNull();
});
it('keeps receipt verification operational when new scanning coverage has ended',async()=>{
 const fetcher=vi.fn(async(url:unknown)=>String(url)==='/api/me'?Response.json(me):Response.json({ok:false,reason:'Test receipt signature is invalid.'}));vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search={scope} workspace={workspace()}/>);
 await screen.findByRole('region',{name:'Scan prerequisites'});
 fireEvent.click(screen.getByRole('button',{name:'Close scan access'}));
 fireEvent.click(screen.getByRole('tab',{name:/Verify release proof/}));
 expect(screen.queryByRole('region',{name:'Scan prerequisites'})).toBeNull();
 const receipt=new File(['{}'],'receipt.json',{type:'application/json'});
 Object.defineProperty(receipt,'text',{value:async()=>'{}'});
 fireEvent.change(screen.getByLabelText(/Release proof JSON/),{target:{files:[receipt]}});
 await screen.findByText('Test receipt signature is invalid.');
 expect(fetcher).toHaveBeenCalledWith('/api/receipts/verify',expect.objectContaining({method:'POST',body:JSON.stringify({receipt:{}})}));
 expect(navigate).not.toHaveBeenCalled();
});
it('blocks website continuation during permission loading and failure, then allows a successful retry',async()=>{
 let finish!:(response:Response)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})).mockResolvedValue(Response.json({...me,installations:[{...me.installations[0],plan:'solo'}]}));vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search='?workspace=chosen&install=7&mode=website' workspace={workspace({plan:'solo'})}/>);
 const url=screen.getByRole('textbox',{name:'HTTPS production URL'});
 fireEvent.change(url,{target:{value:'https://owned.example/'}});
 expect((screen.getByRole('button',{name:'Sign in to continue'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.submit(url.closest('form')!);
 expect(fetcher).toHaveBeenCalledTimes(1);
 await act(async()=>finish(Response.json({error:'Unavailable'},{status:503})));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('retry before starting a scan'));
 fireEvent.submit(url.closest('form')!);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(navigate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Retry permissions check'}));
 await waitFor(()=>expect((screen.getByRole('button',{name:'Continue to verification'}) as HTMLButtonElement).disabled).toBe(false));
 fireEvent.submit(url.closest('form')!);
 expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/watch/sources?'));
});
