// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ScanPage} from '../src/pages/ScanPage';
import {navigate} from '../src/nav';
import {uploadArtifact} from '../src/watch/upload-transport';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
vi.mock('../src/watch/upload-transport',async importOriginal=>({...await importOriginal<typeof import('../src/watch/upload-transport')>(),uploadArtifact:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.resetAllMocks();window.history.replaceState({},'', '/');});
async function uploadInput(){return await screen.findByLabelText(/Drop a package or build here/) as HTMLInputElement;}
const artifact=()=>new File(['packed artifact'],'artifact.tgz',{type:'application/gzip'});
it('keeps a selected package tab and workspace after reopening its URL',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{login:'review'},coverage:{status:'active',plan:'solo'},developmentLogin:true})));
 const view=render(<ScanPage embedded search="?workspace=chosen"/>);
 expect(screen.getByRole('tab',{name:/GitHub repository/}).getAttribute('aria-selected')).toBe('true');
 fireEvent.click(screen.getByRole('tab',{name:/Package or build/}));
 const saved=window.location.search;
 expect(new URLSearchParams(saved).get('mode')).toBe('package');
 expect(new URLSearchParams(saved).get('workspace')).toBe('chosen');
 view.unmount();
 render(<ScanPage embedded search={saved}/>);
 expect(screen.getByRole('tab',{name:/Package or build/}).getAttribute('aria-selected')).toBe('true');
 expect(await uploadInput()).toBeTruthy();
 expect(screen.queryByText('Local review examples')).toBeNull();
 expect(screen.queryByRole('button',{name:/Clean npm tarball/})).toBeNull();
});
it('explains read-only report access without asking an active viewer to renew',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({user:{login:'viewer'},coverage:{status:'active',plan:'team'}}))));
 render(<ScanPage embedded search="?workspace=chosen" workspace={{id:'chosen',name:'QA',organization_id:'org',installation_id:null,archived_at:null,role:'viewer',plan:'team',trial_ends_at:'2099-01-01'}}/>);
 await screen.findByText(/Viewer access is read-only/);
 expect(screen.queryByText(/Choose an active workspace or renew coverage/)).toBeNull();
});
it.each([{},null,{queued:false},{pending:true},{pending:true,target:'artifact',expiresInMinutes:-1}])('rejects an incomplete upload submission %j',async response=>{
  vi.stubGlobal('fetch',vi.fn((url:unknown)=>Promise.resolve(new Response(JSON.stringify(String(url)==='/api/me'
    ?{user:{login:'review'},coverage:{status:'active',plan:'solo'},developmentLogin:true}:response)))));
  vi.mocked(uploadArtifact).mockResolvedValue(Response.json(response));
  render(<ScanPage embedded search="?workspace=chosen&mode=package"/>);
  fireEvent.change(await uploadInput(),{target:{files:[artifact()]}});
  await screen.findByText('The server did not confirm a saved attempt. Check Releases before retrying.');
  expect(navigate).not.toHaveBeenCalled();
});
it.each([{},null,{queued:false},{queued:true},{queued:true,uploadId:''}])('rejects an incomplete staged claim response %j',async response=>{
  vi.stubGlobal('fetch',vi.fn((url:unknown)=>Promise.resolve(new Response(JSON.stringify(String(url)==='/api/me'
    ?{user:{login:'review'},coverage:{status:'active',plan:'solo'}}:response)))));
  render(<ScanPage embedded search="?workspace=chosen&reveal=1"/>);
  await screen.findByText('The server did not confirm a saved attempt. Check Releases before retrying.');
  expect(navigate).not.toHaveBeenCalled();
});
it('offers an explicit retry after a staged claim fails',async()=>{
  let claims=0;
  vi.stubGlobal('fetch',vi.fn((url:unknown)=>{
    if(String(url)==='/api/me')return Promise.resolve(new Response(JSON.stringify({user:{login:'review'},coverage:{status:'active',plan:'solo'}})));
    claims++;
    return Promise.resolve(claims===1?new Response(JSON.stringify({error:'Workspace unavailable.'}),{status:403}):new Response(JSON.stringify({queued:true,uploadId:'retry-result',target:'artifact'})));
  }));
  render(<ScanPage embedded search="?workspace=chosen&reveal=1"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry staged upload'}));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=retry-result&workspace=chosen'));
  expect(claims).toBe(2);
});
it('claims a staged artifact in the explicitly selected workspace',async()=>{
  const fetcher=vi.fn((url:unknown)=>Promise.resolve(new Response(JSON.stringify(String(url)==='/api/me'
    ?{user:{login:'review'},coverage:{status:'active',plan:'solo'}}
    :{queued:true,uploadId:'claimed-result',target:'artifact'}))));
  vi.stubGlobal('fetch',fetcher);
  render(<ScanPage embedded search="?workspace=chosen&reveal=1"/>);
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/scan/pending?workspaceId=chosen',expect.objectContaining({method:'POST'})));
  await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=claimed-result&workspace=chosen'));
});
it.each(['switch','stay','leave'])('scopes upload submission when the user chooses to %s',async choice=>{
  let finish!:(response:Response)=>void;
  const pending=new Promise<Response>(resolve=>{finish=resolve;});
  const fetcher=vi.fn((url:unknown)=>String(url)==='/api/me'
    ?Promise.resolve(new Response(JSON.stringify({user:{login:'review'},coverage:{status:'active',plan:'solo'},developmentLogin:true})))
    :pending);
  vi.stubGlobal('fetch',fetcher);
  vi.mocked(uploadArtifact).mockReturnValue(pending);
  window.history.replaceState({},'', '/watch/scan?workspace=first&mode=package');
  const view=render(<ScanPage embedded search="?workspace=first&mode=package"/>);
  const file=artifact();
  fireEvent.change(await uploadInput(),{target:{files:[file]}});
  expect(uploadArtifact).toHaveBeenCalledWith(file,null,expect.any(Function),expect.any(AbortSignal),'first');
  if(choice==='switch')view.rerender(<ScanPage embedded search="?workspace=second"/>);
  if(choice==='leave')view.unmount();
  await act(async()=>{finish(new Response(JSON.stringify({queued:true,uploadId:'old-result',target:'artifact.tgz'})));await pending;});
  if(choice==='stay')expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=old-result&workspace=first');
  else expect(navigate).not.toHaveBeenCalled();
});
