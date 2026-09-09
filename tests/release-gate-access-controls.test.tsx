// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseGateAccessControls} from '../src/components/watch/ReleaseGateAccessControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const view={tokens:[{id:7,name:'Build CI',token_prefix:'ns_prefix'}],grants:[],eligible:true,canEnable:true,canDisable:true,notice:'Exact connected asset only.'};
it('requires confirmation and names an existing token without creating or exposing a secret',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{revision:1}:view));vi.stubGlobal('fetch',fetch);
  render(<ReleaseGateAccessControls streamId="stream" record={{kind:'release',id:'1'}}/>);
  await screen.findByText('Exact connected asset only.');
  fireEvent.change(screen.getByLabelText('CI access change reason'),{target:{value:'Allow only the selected build to use gate checks.'}});
  fireEvent.change(screen.getByLabelText('Existing workspace token'),{target:{value:'7'}});
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
