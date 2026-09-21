// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {ReleaseGateControls} from '../src/components/watch/ReleaseGateControls';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const view={policy:{revision:0,mode:'advisory',maxAgeHours:24},policies:[],decisions:[],binding:null,canManage:true,canWrite:true,notice:'Explicit CI integration required.'};
it('requires confirmation and sends expected policy revision without activating on mount',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{revision:1}:view));vi.stubGlobal('fetch',fetch);
  render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByText('Explicit CI integration required.');
  const button=screen.getByRole('button',{name:'Adopt policy revision',hidden:true});expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Gate mode'),{target:{value:'enforce'}});
  fireEvent.change(screen.getByLabelText('Policy change reason'),{target:{value:'Require the current release evidence.'}});
  fireEvent.click(screen.getByRole('checkbox',{hidden:true}));fireEvent.click(button);
  await waitFor(()=>expect(fetch.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
  expect(JSON.parse(String(fetch.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body))).toMatchObject({action:'configure',mode:'enforce',expectedRevision:0,confirm:true});
});
it('shows unavailable state rather than retaining a passing gate on a failed read',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Workspace unavailable.'},{status:404})));
  render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Adopt policy revision',hidden:true})).toBeNull();
});
const decision=(expires_at:string,policy_revision=0)=>({id:'decision',policy_revision,deployment_id:'release-attempt',result:{readiness:'blocked',reason:'Recorded finding.',overridable:true},expires_at,overridden:false,consumed:false});
it.each(['expired','policy changed','consumed'])('does not offer an override for a %s decision',async state=>{
  const d={...decision(new Date(Date.now()+(state==='expired'?-1000:300000)).toISOString(),state==='policy changed'?1:0),consumed:state==='consumed'};
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...view,decisions:[d]})));
  render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByText(`This decision no longer applies (${state}). Evaluate a new decision for the intended deployment attempt.`);
  expect(screen.queryByRole('button',{name:'Record explicit override',hidden:true})).toBeNull();
});
it('removes an override when its decision expires while the page stays open',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...view,decisions:[decision(new Date(Date.now()+10000).toISOString())]})));
  render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByText('Recorded finding.');
  expect(screen.getByRole('button',{name:'Record explicit override',hidden:true})).toBeTruthy();
  // Preserve the mounted real timeout; advance system time, then let a refresh establish the remaining deadline.
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button',{name:'Refresh gate',hidden:true}));
  await act(async()=>{await Promise.resolve();await Promise.resolve();});
  await act(async()=>{await vi.advanceTimersByTimeAsync(11000);});
  expect(screen.queryByRole('button',{name:'Record explicit override',hidden:true})).toBeNull();
  expect(screen.getByText(/This decision no longer applies \(expired\)/)).toBeTruthy();
});
it('clears stale policy controls after a conflicting write and requires a refresh',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{error:'Gate policy changed. Reload before saving.'}:view,{status:init?.method==='POST'?409:200})));
  render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByText('Explicit CI integration required.');
  fireEvent.change(screen.getByLabelText('Policy change reason'),{target:{value:'Require recorded evidence.'}});
  fireEvent.click(screen.getByRole('checkbox',{hidden:true}));fireEvent.click(screen.getByRole('button',{name:'Adopt policy revision',hidden:true}));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button',{name:'Adopt policy revision',hidden:true})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Refresh gate',hidden:true}));
  await screen.findByText('Explicit CI integration required.');
  expect((screen.getByRole('checkbox',{hidden:true}) as HTMLInputElement).checked).toBe(false);
});
it('does not retain a previous record binding while the next record is loading',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>String(url).includes('recordId=next')?new Promise<Response>(()=>{}):Response.json({...view,binding:{record:{kind:'upload',id:'record'},digest:'a'.repeat(64)}})));
  const result=render(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'record'}} refreshVersion={0}/>);
  await screen.findByText('Explicit CI integration required.');
  expect(screen.getByRole('button',{name:'Evaluate this recorded build',hidden:true})).toBeTruthy();
  result.rerender(<ReleaseGateControls streamId="stream" record={{kind:'upload',id:'next'}} refreshVersion={0}/>);
  expect(screen.queryByRole('button',{name:'Evaluate this recorded build',hidden:true})).toBeNull();
});
