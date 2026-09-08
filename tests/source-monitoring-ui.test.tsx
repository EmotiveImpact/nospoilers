// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SourceMonitoringControls} from '../src/components/watch/SourceMonitoringControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const inventory=(paused=false)=>new Response(JSON.stringify({sources:[{id:1,kind:'npm',name:'example',paused,canManage:true}]}));
it('reloads controls when the parent source inventory changes',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(inventory()).mockResolvedValueOnce(new Response(JSON.stringify({sources:[]}))));
 const view=render(<SourceMonitoringControls installationId={4} refreshKey="connected"/>);
 await view.findByText('Pause monitoring');
 view.rerender(<SourceMonitoringControls installationId={4} refreshKey="disconnected"/>);
 await waitFor(()=>expect(view.queryByLabelText('Source monitoring controls')).toBeNull());
});
it('removes stale actions after rejected mutation and refreshes current authority',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(inventory()).mockResolvedValueOnce(new Response('',{status:403})).mockResolvedValueOnce(new Response(JSON.stringify({sources:[]})));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<SourceMonitoringControls installationId={4}/>);
 fireEvent.click(await view.findByText('Pause monitoring'));
 await view.findByRole('alert');
 expect(view.queryByText('Pause monitoring')).toBeNull();
 fireEvent.click(view.getByText('Refresh controls'));
 await waitFor(()=>expect(view.queryByRole('alert')).toBeNull());
 await waitFor(()=>expect(view.queryByLabelText('Source monitoring controls')).toBeNull());
 expect(fetcher.mock.calls[0][0]).toContain('installationId=4');
});
it('shows the server-confirmed state after saving',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(inventory()).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(inventory(true)));
 const view=render(<SourceMonitoringControls installationId={4}/>);
 fireEvent.click(await view.findByText('Pause monitoring'));
 await view.findByText('Resume monitoring');
 expect(view.getByText('Paused')).toBeTruthy();
});

it('keeps a pending save disabled through parent refresh and reloads its final state',async()=>{
 let finish!:(response:Response)=>void;
 const pending=new Promise<Response>(resolve=>{finish=resolve;});
 const fetcher=vi.fn().mockResolvedValueOnce(inventory()).mockReturnValueOnce(pending).mockResolvedValueOnce(inventory()).mockResolvedValueOnce(inventory(true));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<SourceMonitoringControls installationId={4} refreshKey="before"/>);
 fireEvent.click(await view.findByText('Pause monitoring'));
 view.rerender(<SourceMonitoringControls installationId={4} refreshKey="during"/>);
 const saving=await view.findByRole('button',{name:'Saving…'});
 expect((saving as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(saving);
 expect(fetcher.mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(1);
 await act(async()=>finish(new Response('{}')));
 expect((await view.findByRole('button',{name:'Resume monitoring'}) as HTMLButtonElement).disabled).toBe(false);
 expect(view.getByText('Paused')).toBeTruthy();
});

it('does not restore stale controls when an inventory response arrives after access rejection',async()=>{
 let finishSave!:(response:Response)=>void,finishRead!:(response:Response)=>void;
 const save=new Promise<Response>(resolve=>{finishSave=resolve;});
 const read=new Promise<Response>(resolve=>{finishRead=resolve;});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(inventory()).mockReturnValueOnce(save).mockReturnValueOnce(read));
 const view=render(<SourceMonitoringControls installationId={4} refreshKey="before"/>);
 fireEvent.click(await view.findByText('Pause monitoring'));
 view.rerender(<SourceMonitoringControls installationId={4} refreshKey="during"/>);
 await act(async()=>finishSave(new Response('',{status:403})));
 await view.findByRole('alert');
 await act(async()=>finishRead(inventory()));
 expect(view.queryByText('Pause monitoring')).toBeNull();
 expect(view.getByRole('alert').textContent).toContain('check your access');
});
