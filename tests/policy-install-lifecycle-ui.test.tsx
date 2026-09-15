// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Button} from '../src/components/ui/button';
import {PolicyScreen} from '../src/components/watch/screens/PolicyScreen';
const context=vi.hoisted(()=>({current:{} as Record<string,unknown>}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context.current}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function setup(){
 const callbacks={setAllowRule:vi.fn(),setAllowPath:vi.fn(),setAllowReason:vi.fn(),setSavingAllow:vi.fn(),setPackageError:vi.fn(),refreshSignedIn:vi.fn(async()=>{})};
 context.current={...callbacks,Button,route:{view:'policy'},search:new URLSearchParams('workspace=w&install=1'),watchHref:()=>'/watch/releases?workspace=w&install=1',activeInstallId:1,selectedInstallId:1,allowRule:'MAP-001',allowPath:'app.map',allowReason:'Reviewed release map',allowExpires:'2027-01-01',baselineReason:'',setBaselineReason:vi.fn(),setAllowExpires:vi.fn(),exceptions:[],signingPolicy:{status:'ready',policy:null},previewing:false,installAdmin:true,locked:false,savingAllow:false};
 return callbacks;
}
it.each([200,403])('ignores a late allowlist response after switching installations (%s)',async status=>{
 const callbacks=setup();let finish!:(response:Response)=>void;let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:unknown,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}));
 const view=render(<PolicyScreen section="allowlist"/>);
 fireEvent.click(screen.getByRole('button',{name:'Allow'}));
 context.current={...context.current,activeInstallId:2,selectedInstallId:2,allowRule:'NEW-002',allowReason:'Draft for the new connection'};
 view.rerender(<PolicyScreen section="allowlist"/>);
 await act(async()=>finish(Response.json(status===200?{}:{error:'Old connection rejected.'},{status})));
 expect(callbacks.setAllowRule).not.toHaveBeenCalled();
 expect(callbacks.setAllowPath).not.toHaveBeenCalled();
 expect(callbacks.setAllowReason).not.toHaveBeenCalled();
 expect(callbacks.refreshSignedIn).not.toHaveBeenCalled();
 expect(callbacks.setPackageError.mock.calls).toEqual([[null]]);
 expect(screen.getByLabelText('Rule')).toHaveProperty('value','NEW-002');
 expect(screen.queryByRole('alert')).toBeNull();
 expect(signal?.aborted).toBe(true);
 expect(callbacks.setSavingAllow.mock.calls).toEqual([[true],[false]]);
});
it('aborts an allowlist request on unmount and ignores its late success',async()=>{
 const callbacks=setup();let finish!:(response:Response)=>void;let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:unknown,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}));
 const view=render(<PolicyScreen section="allowlist"/>);
 fireEvent.click(screen.getByRole('button',{name:'Allow'}));view.unmount();
 await act(async()=>finish(Response.json({})));
 expect(signal?.aborted).toBe(true);
 expect(callbacks.setAllowRule).not.toHaveBeenCalled();
 expect(callbacks.refreshSignedIn).not.toHaveBeenCalled();
});
it('retains the current installation success path and submitted scope',async()=>{
 const callbacks=setup();const fetcher=vi.fn(async()=>Response.json({}));vi.stubGlobal('fetch',fetcher);
 render(<PolicyScreen section="allowlist"/>);
 fireEvent.click(screen.getByRole('button',{name:'Allow'}));
 await waitFor(()=>expect(callbacks.refreshSignedIn).toHaveBeenCalledWith(1));
 expect(fetcher).toHaveBeenCalledWith('/api/exceptions',expect.objectContaining({method:'POST',body:JSON.stringify({installationId:1,rule:'MAP-001',path:'app.map',reason:'Reviewed release map',expires:'2027-01-01'})}));
 expect(callbacks.setAllowRule).toHaveBeenCalledWith('');
 expect(callbacks.setAllowPath).toHaveBeenCalledWith('');
 expect(callbacks.setAllowReason).toHaveBeenCalledWith('');
 expect(callbacks.setSavingAllow.mock.calls).toEqual([[true],[false]]);
});
