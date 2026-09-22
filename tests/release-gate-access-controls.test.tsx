// @vitest-environment jsdom
import {selectOption} from './helpers/select-option';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseGateAccessControls} from '../src/components/watch/ReleaseGateAccessControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const view={tokens:[{id:7,name:'Build CI',token_prefix:'ns_prefix'}],grants:[],eligible:true,canEnable:true,canDisable:true,notice:'Exact connected asset only.'};
const grant={token_id:7,revision:2,enabled:true,expired:false,name:'Build CI',selector:'github:qa/app#app.tgz',expires_at:'2026-12-01T00:00:00Z',revoked_at:null};
async function prepareGrant(){
 (screen.getByText('Connected-source CI access').closest('details') as HTMLDetailsElement).open=true;
 fireEvent.change(screen.getByLabelText('CI access change reason'),{target:{value:'Allow only this exact asset selection.'}});
 await selectOption(screen.getByLabelText('Existing workspace token'),'Build CI · ns_prefix');
 fireEvent.click(screen.getByRole('checkbox'));
 return screen.getByRole('button',{name:'Grant or renew CI access'});
}
it('requires confirmation and names an existing token without creating or exposing a secret',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{revision:1}:view));vi.stubGlobal('fetch',fetch);
  render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
  await screen.findByText('Exact connected asset only.');
  fireEvent.change(screen.getByLabelText('CI access change reason'),{target:{value:'Allow only the selected build to use gate checks.'}});
  await selectOption(screen.getByLabelText('Existing workspace token'),'Build CI · ns_prefix');
  const button=screen.getByRole('button',{name:'Grant or renew CI access',hidden:true});expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox',{hidden:true}));fireEvent.click(button);
  await waitFor(()=>expect(fetch.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
  expect(JSON.parse(String(fetch.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body))).toMatchObject({enabled:true,tokenId:7,expectedRevision:0,record:{kind:'release',id:'1'},confirm:true});
});
it('retains revocation controls when enabling is unavailable',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{revision:3}:{...view,eligible:false,canEnable:false,grants:[{token_id:7,revision:2,enabled:true,expired:true,name:'Build CI',selector:'github:qa/app#app.tgz',expires_at:'2026-01-01T00:00:00Z',revoked_at:null}]}));vi.stubGlobal('fetch',fetch);
  render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
  await screen.findByText('Exact connected asset only.');
  expect(screen.queryByRole('button',{name:'Grant or renew CI access',hidden:true})).toBeNull();
  fireEvent.change(screen.getByLabelText('CI access change reason'),{target:{value:'Stop this expired grant explicitly.'}});
  fireEvent.click(screen.getByRole('button',{name:'Revoke CI access for Build CI',hidden:true}));
  await waitFor(()=>expect(fetch.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
  expect(JSON.parse(String(fetch.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body))).toMatchObject({enabled:false,tokenId:7,expectedRevision:2});
});
it.each(['forbidden grant','conflicting revoke','network failure'] as const)('clears stale CI actions after %s and retries with fresh confirmation',async failure=>{
 let reads=0;
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='POST'){
   if(failure==='network failure')throw new Error('Connection lost.');
   return Response.json({error:'CI authority must be refreshed.'},{status:failure==='forbidden grant'?403:409});
  }
  reads++;return Response.json({...view,grants:[grant]});
 }));
 render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
 await screen.findByText(view.notice);
 const create=await prepareGrant();
 const action=failure==='conflicting revoke'?screen.getByRole('button',{name:'Revoke CI access for Build CI'}):create;
 action.focus();fireEvent.click(action);
 const error=await screen.findByRole('alert');
 await waitFor(()=>expect(document.activeElement).toBe(error));
 expect(screen.queryByRole('button',{name:'Grant or renew CI access'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Revoke CI access for Build CI'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Refresh CI access'}));
 await screen.findByText(view.notice);
 expect(reads).toBe(2);
 expect(screen.getByLabelText('Existing workspace token').textContent).toContain('Choose a CI token');
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 expect((screen.getByRole('button',{name:'Grant or renew CI access'}) as HTMLButtonElement).disabled).toBe(true);
});
it('hides prior controls during refresh and respects newly read revocation-only authority',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(view)).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})));
 render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
 await screen.findByText(view.notice);await prepareGrant();
 const refresh=screen.getByRole('button',{name:'Refresh CI access'});refresh.focus();fireEvent.click(refresh);
 expect(screen.getByRole('status',{name:'Reading explicit CI grants'})).toBeTruthy();
 expect(screen.queryByLabelText('Existing workspace token')).toBeNull();
 finish(Response.json({...view,eligible:false,canEnable:false,grants:[grant]}));
 await screen.findByRole('button',{name:'Revoke CI access for Build CI'});
 expect(screen.queryByRole('button',{name:'Grant or renew CI access'})).toBeNull();
 expect(document.activeElement).toBe(refresh);
});
it.each(['release','stream'] as const)('drops pending old responses and local selection after a %s switch',async scope=>{
 let finish!:(response:Response)=>void;
 let oldSignal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce((_url:unknown,init:RequestInit)=>{oldSignal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}).mockResolvedValue(Response.json({...view,notice:'New selection.',canEnable:false,tokens:[]})));
 const rendered=render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
 rendered.rerender(<ReleaseGateAccessControls streamId={scope==='stream'?'other-stream':'stream'} record={{kind:'release',id:scope==='release'?'2':'1'}}/>);
 await screen.findByText('New selection.');
 expect(oldSignal?.aborted).toBe(true);
 finish(Response.json(view));
 await waitFor(()=>expect(screen.queryByText(view.notice)).toBeNull());
 expect(screen.queryByLabelText('Existing workspace token')).toBeNull();
});
it('does not steal deliberately moved focus after a failed mutation',async()=>{
 let fail!:(reason:Error)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(view)).mockImplementationOnce(()=>new Promise<Response>((_resolve,reject)=>{fail=reject;})));
 render(<><button>Elsewhere</button><ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/></>);
 await screen.findByText(view.notice);const action=await prepareGrant();action.focus();fireEvent.click(action);
 const elsewhere=screen.getByRole('button',{name:'Elsewhere'});elsewhere.focus();fail(new Error('Connection lost.'));
 await screen.findByRole('alert');expect(document.activeElement).toBe(elsewhere);
});
it('does not move focus on an initial denied read',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'CI access denied.'},{status:403})));
 render(<><button>Elsewhere</button><ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/></>);
 const elsewhere=screen.getByRole('button',{name:'Elsewhere'});elsewhere.focus();
 await screen.findByText('CI access denied.');expect(document.activeElement).toBe(elsewhere);
 expect(screen.queryByRole('button',{name:'Grant or renew CI access',hidden:true})).toBeNull();
});
