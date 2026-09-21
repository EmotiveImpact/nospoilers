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
  fireEvent.click(await screen.findByRole('button',{name:'Scan this build'}));
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
  fireEvent.click(await screen.findByRole('button',{name:'Scan this build'}));
  expect(uploadArtifact).toHaveBeenCalledWith(file,null,expect.any(Function),expect.any(AbortSignal),'first');
  if(choice==='switch')view.rerender(<ScanPage embedded search="?workspace=second"/>);
  if(choice==='leave')view.unmount();
  await act(async()=>{finish(new Response(JSON.stringify({queued:true,uploadId:'old-result',target:'artifact.tgz'})));await pending;});
  if(choice==='stay')expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=old-result&workspace=first');
  else expect(navigate).not.toHaveBeenCalled();
});
it('switches evidence tabs by keyboard without submitting or losing source scope and website input',async()=>{
 const fetcher=vi.fn(async()=>Response.json({user:{login:'owner'},coverage:{status:'active',plan:'solo'}}));
 vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search="?workspace=chosen&install=7"/>);
 const tabs=screen.getAllByRole('tab');
 const select=(index:number)=>{
  tabs.forEach((tab,i)=>{expect(tab.tabIndex).toBe(i===index?0:-1);expect(tab.getAttribute('aria-selected')).toBe(String(i===index));});
  expect(document.activeElement).toBe(tabs[index]);
  expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[index].id);
  expect(tabs[index].getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
  const params=new URLSearchParams(window.location.search);
  expect(params.get('workspace')).toBe('chosen');expect(params.get('install')).toBe('7');
 };
 tabs[0].focus();
 fireEvent.keyDown(tabs[0],{key:'ArrowRight'});select(1);
 fireEvent.keyDown(tabs[1],{key:'ArrowRight'});select(2);
 fireEvent.change(screen.getByRole('textbox',{name:'HTTPS production URL'}),{target:{value:'https://owned.example/'}});
 fireEvent.keyDown(tabs[2],{key:'End'});select(3);
 fireEvent.keyDown(tabs[3],{key:'ArrowRight'});select(0);
 fireEvent.keyDown(tabs[0],{key:'ArrowLeft'});select(3);
 fireEvent.keyDown(tabs[3],{key:'Home'});select(0);
 fireEvent.keyDown(tabs[0],{key:'ArrowRight'});fireEvent.keyDown(tabs[1],{key:'ArrowRight'});select(2);
 expect((screen.getByRole('textbox',{name:'HTTPS production URL'}) as HTMLInputElement).value).toBe('https://owned.example/');
 expect(uploadArtifact).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
 expect(fetcher.mock.calls.every(call=>call.length<2||((call as unknown[])[1] as RequestInit)?.method!=='POST')).toBe(true);
});
it('offers permissions retry on the default GitHub tab without a premature sign-in prompt',async()=>{
 let finish!:(r:Response)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})).mockResolvedValue(Response.json({user:{login:'owner'},coverage:{status:'active',plan:'solo'},installations:[]}));vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search="?workspace=chosen"/>);
 expect(screen.getByLabelText('Checking sign-in and workspace permissions…')).toBeTruthy();
 expect(screen.queryByRole('link',{name:/Sign in/})).toBeNull();
 await act(async()=>finish(Response.json({error:'Unavailable'},{status:503})));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('retry before starting a scan'));
 fireEvent.click(screen.getByRole('button',{name:'Retry permissions check'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect(screen.getByRole('tab',{name:/GitHub repository/}).getAttribute('aria-selected')).toBe('true');
 expect(uploadArtifact).not.toHaveBeenCalled();
});

it('stages and removes a file without submitting an artifact',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{login:'owner'},coverage:{status:'active',plan:'solo'}})));
 render(<ScanPage embedded search="?workspace=chosen&mode=package"/>);
 const input=await uploadInput();
 fireEvent.change(input,{target:{files:[artifact()]}});
 expect(await screen.findByText('artifact.tgz')).toBeTruthy();
 expect(uploadArtifact).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Remove selected artifact'}));
 expect(screen.queryByRole('button',{name:'Scan this build'})).toBeNull();
 expect(uploadArtifact).not.toHaveBeenCalled();
});
it('clears a staged artifact when its replacement is empty',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{login:'owner'},coverage:{status:'active',plan:'solo'}})));
 render(<ScanPage embedded search="?workspace=chosen&mode=package"/>);
 const input=await uploadInput();
 fireEvent.change(input,{target:{files:[artifact()]}});
 await screen.findByRole('button',{name:'Scan this build'});
 fireEvent.change(input,{target:{files:[new File([],'empty.zip')]}});
 expect(screen.queryByRole('button',{name:'Scan this build'})).toBeNull();
 expect(uploadArtifact).not.toHaveBeenCalled();
});

it('submits and opens an upload in the rendered workspace rather than a stale browser URL',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{login:'owner'},coverage:{status:'active',plan:'team'},installations:[{id:7,account_login:'connected',plan:'team',trialEndsAt:null,suspended:false}]})));
 vi.mocked(uploadArtifact).mockResolvedValue(Response.json({queued:true,uploadId:'scoped-result',target:'artifact.tgz'}));
 window.history.replaceState({},'', '/watch/scan?workspace=stale-browser&install=99&mode=package');
 render(<ScanPage embedded search="?workspace=stale-query&install=7&mode=package" workspace={{id:'rendered',name:'Current',organization_id:'org',installation_id:7,archived_at:null,role:'owner',plan:'team',trial_ends_at:null}}/>);
 const file=artifact();
 fireEvent.change(await uploadInput(),{target:{files:[file]}});
 fireEvent.click(await screen.findByRole('button',{name:'Scan this build'}));
 await waitFor(()=>expect(uploadArtifact).toHaveBeenCalledWith(file,'7',expect.any(Function),expect.any(AbortSignal),'rendered'));
 await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=scoped-result&install=7&workspace=rendered'));
});
it('claims staged evidence in the rendered workspace and preserves it in the result link',async()=>{
 const fetcher=vi.fn(async(url:unknown)=>Response.json(String(url)==='/api/me'?{user:{login:'owner'},coverage:{status:'active',plan:'team'}}:{queued:true,uploadId:'scoped-claim',target:'artifact'}));
 vi.stubGlobal('fetch',fetcher);
 render(<ScanPage embedded search="?workspace=stale-query&reveal=1" workspace={{id:'rendered',name:'Current',organization_id:'org',installation_id:null,archived_at:null,role:'owner',plan:'team',trial_ends_at:null}}/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/scan/pending?workspaceId=rendered',expect.objectContaining({method:'POST'})));
 await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/watch/releases?upload=scoped-claim&workspace=rendered'));
});

it.each([[700,'700 B'],[2048,'2.0 KiB'],[1048576,'1.00 MiB']])('shows a readable size for a %i-byte staged build',async(size,label)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({user:{login:'owner'},coverage:{status:'active',plan:'solo'}})));
 render(<ScanPage embedded search="?workspace=chosen&mode=package"/>);
 fireEvent.change(await uploadInput(),{target:{files:[new File([new Uint8Array(Number(size))],'build.tgz')]}});
 expect(await screen.findByText(`${label} · ready to scan`)).toBeTruthy();
 expect(uploadArtifact).not.toHaveBeenCalled();
});
