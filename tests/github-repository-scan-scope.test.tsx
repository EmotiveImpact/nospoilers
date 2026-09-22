// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {GithubRepositoryScan} from '../src/components/watch/GithubRepositoryScan';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const repos=[{id:12,full_name:'client/release'}];
async function chooseRepository(){
 const user=userEvent.setup();
 await user.click(await screen.findByRole('combobox',{name:'Repository'}));
 await user.click(await screen.findByRole('option',{name:'client/release'}));
}
it.each([409,429,503,'network'] as const)('distinguishes rejected submission from uncertain acceptance (%s)',async(outcome)=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
  if(!init?.method)return Response.json({repos});
  if(outcome==='network')throw new TypeError('Network disconnected');
  return Response.json({error:outcome===429?'Rate limited before dispatch.':'Upstream unavailable.'},{status:outcome});
 }));
 render(<GithubRepositoryScan installationId="7" search="?workspace=w" disabledReason={null}/>);
 await chooseRepository();fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 await screen.findByRole('alert');
 expect((screen.getByRole('button',{name:'Scan latest release'}) as HTMLButtonElement).disabled).toBe(outcome!==429&&outcome!==409);
 expect(screen.getByRole('link',{name:'View releases and scan progress'}).getAttribute('href')).toContain('workspace=w');
});
it('clears queued claims when the actual tracked job has failed',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>Response.json(init?.method?{ok:true,queued:true,jobId:9}:url.startsWith('/api/jobs')?{jobs:[{id:9,installationId:7,kind:'scan_latest_release',status:'failed'}]}:{repos})));
 render(<GithubRepositoryScan installationId="7" search="?workspace=w" disabledReason={null}/>);
 await chooseRepository();fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 await screen.findByText(/The release check failed/);
 expect(screen.queryByRole('status')?.textContent??'').not.toMatch(/queued|Checking the latest/);
 expect((screen.getByRole('button',{name:'Scan latest release'}) as HTMLButtonElement).disabled).toBe(false);
});
it('does not allow a blind duplicate while the tracked job outcome is unavailable',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>init?.method?Response.json({ok:true,queued:true,jobId:9}):url.startsWith('/api/jobs')?Response.json({error:'Unavailable'},{status:503}):Response.json({repos})));
 render(<GithubRepositoryScan installationId="7" search="?workspace=w" disabledReason={null}/>);
 await chooseRepository();fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 await screen.findByText(/Could not refresh check progress/);
 expect(screen.queryByRole('status')?.textContent??'').not.toMatch(/queued|Checking the latest/);
 expect((screen.getByRole('button',{name:'Scan latest release'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByRole('button',{name:'Check progress again'})).toBeTruthy();
});
it('aborts old progress requests and ignores a late completion after workspace switch',async()=>{
 let finish:(response:Response)=>void=()=>{};let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method)return Response.json({ok:true,queued:true,jobId:9});
  if(url.startsWith('/api/jobs')){signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
  return Response.json({repos});
 }));
 const view=render(<GithubRepositoryScan installationId="7" search="?workspace=first" disabledReason={null}/>);
 await chooseRepository();fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 await waitFor(()=>expect(signal).toBeTruthy());
 view.rerender(<GithubRepositoryScan installationId="7" search="?workspace=second" disabledReason={null}/>);
 expect(signal?.aborted).toBe(true);await screen.findByRole('combobox',{name:'Repository'});
 await act(async()=>{finish(Response.json({jobs:[{id:9,installationId:7,kind:'scan_latest_release',status:'done'}]}));});
 expect(screen.queryByText(/Release check finished/)).toBeNull();expect(screen.getByRole('combobox',{name:'Repository'})).toHaveProperty('value','');
});
