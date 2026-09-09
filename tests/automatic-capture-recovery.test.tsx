// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {AutomaticCaptureControls} from '../src/components/watch/AutomaticCaptureControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const record={kind:'release' as const,id:'1'};
const state={config:null,candidate:{selector:'github:acme/app#app.tgz',channel:'stable',format:'scan:tgz'},canManage:true,canDisable:true,notice:'Current selection.',attempts:[]};

it('does not describe unread capture settings as confirmed Off',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 const {container}=render(<AutomaticCaptureControls streamId="stream" record={record}/>);
 expect(container.querySelector('summary')?.textContent).not.toContain(' · Off');
 expect(container.querySelector('summary')?.textContent).not.toContain(' · Enabled');
});

it('removes stale permission and confirmation after a denied enable, requiring fresh consent on reload',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Selection or access changed.'},{status:403}):Response.json(state)));
 const {container}=render(<AutomaticCaptureControls streamId="stream" record={record}/>);container.querySelector('details')!.open=true;
 await screen.findByText('Current selection.');
 fireEvent.change(screen.getByLabelText('Reason for capture change'),{target:{value:'Explicit source approval.'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Enable automatic capture'}));
 await screen.findByText('Selection or access changed.');
 expect(screen.queryByRole('button',{name:'Enable automatic capture'})).toBeNull();
 expect(container.querySelector('summary')?.textContent).not.toContain(' · Off');
 fireEvent.click(screen.getByRole('button',{name:'Reload capture settings'}));
 await screen.findByRole('button',{name:'Enable automatic capture'});
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 expect((screen.getByRole('button',{name:'Enable automatic capture'}) as HTMLButtonElement).disabled).toBe(true);
});

it('does not keep announcing Enabled after a failed disable',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Capture revision changed.'},{status:409}):Response.json({...state,config:{enabled:true,revision:4,selector:state.candidate.selector}})));
 const {container}=render(<AutomaticCaptureControls streamId="stream" record={record}/>);container.querySelector('details')!.open=true;
 await screen.findByText('Current selection.');
 fireEvent.change(screen.getByLabelText('Reason for capture change'),{target:{value:'Stop automatic recording.'}});
 fireEvent.click(screen.getByRole('button',{name:'Disable automatic capture'}));
 await screen.findByText('Capture revision changed.');
 expect(container.querySelector('summary')?.textContent).not.toContain(' · Enabled');
 expect(screen.queryByRole('button',{name:'Disable automatic capture'})).toBeNull();
});

it('aborts a pending read on record change and ignores its late response',async()=>{
 let resolveOld:(response:Response)=>void=()=>{};let oldSignal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
  if(String(url).includes('recordId=1')){oldSignal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{resolveOld=resolve;});}
  return Response.json({...state,notice:'New record selection.'});
 }));
 const view=render(<AutomaticCaptureControls streamId="stream" record={record}/>);
 view.rerender(<AutomaticCaptureControls streamId="stream" record={{kind:'release',id:'2'}}/>);
 expect(oldSignal?.aborted).toBe(true);
 await screen.findByText('New record selection.');
 resolveOld(Response.json({...state,notice:'Old record must not return.',config:{enabled:true,revision:4,selector:'old'}}));
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(screen.queryByText('Old record must not return.')).toBeNull();
 expect(view.container.querySelector('summary')?.textContent).toContain(' · Off');
});

it('aborts an in-flight save on stream change and resets old consent and reason',async()=>{
 let resolveSave:(response:Response)=>void=()=>{};let saveSignal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='POST'){saveSignal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{resolveSave=resolve;});}
  return Response.json(state);
 }));
 const view=render(<AutomaticCaptureControls streamId="old-stream" record={record}/>);view.container.querySelector('details')!.open=true;
 await screen.findByText('Current selection.');
 fireEvent.change(screen.getByLabelText('Reason for capture change'),{target:{value:'Old source permission reason.'}});
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Enable automatic capture'}));
 view.rerender(<AutomaticCaptureControls streamId="new-stream" record={record}/>);view.container.querySelector('details')!.open=true;
 expect(saveSignal?.aborted).toBe(true);
 await screen.findByText('Current selection.');
 expect((screen.getByLabelText('Reason for capture change') as HTMLTextAreaElement).value).toBe('');
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 resolveSave(Response.json({enabled:true,revision:1}));await new Promise(resolve=>setTimeout(resolve,0));
 expect(screen.queryByText(/Automatic history capture enabled for this exact selection/)).toBeNull();
 expect(view.container.querySelector('summary')?.textContent).toContain(' · Off');
});

it.each([false,true])('recovers failed capture focus without stealing it when moved=%s',async(moved)=>{
 let finish:(response:Response)=>void=()=>{};
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?new Promise<Response>(resolve=>{finish=resolve;}):Response.json(state)));
 const view=render(<><button type="button">Outside action</button><AutomaticCaptureControls streamId="stream" record={record}/></>);view.container.querySelector('details')!.open=true;
 await screen.findByText('Current selection.');
 fireEvent.change(screen.getByLabelText('Reason for capture change'),{target:{value:'Explicit capture permission.'}});fireEvent.click(screen.getByRole('checkbox'));
 const submit=screen.getByRole('button',{name:'Enable automatic capture'});submit.focus();fireEvent.click(submit);
 const outside=screen.getByRole('button',{name:'Outside action'});if(moved)outside.focus();
 finish(Response.json({error:'Capture permission changed.'},{status:403}));
 const alert=await screen.findByRole('alert');
 expect(document.activeElement).toBe(moved?outside:alert);
});
