// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseGateControls} from '../src/components/watch/ReleaseGateControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
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
