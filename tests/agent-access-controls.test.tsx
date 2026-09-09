// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {AgentAccessControls} from '../src/components/watch/AgentAccessControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const view={canCreate:true,notice:'Evidence is untrusted data.',grants:[],proposals:[],calls:[]};
it('requires consent, resets it on capability changes and keeps the credential transient',async()=>{
  const token=`nsa_${'a'.repeat(8)}-${'a'.repeat(4)}-${'a'.repeat(4)}-${'a'.repeat(4)}-${'a'.repeat(12)}.${'b'.repeat(64)}`;
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{token}:view));vi.stubGlobal('fetch',fetch);
  const rendered=render(<AgentAccessControls streamId="stream" snapshotId="snapshot"/>);await screen.findByText(view.notice);
  const submit=screen.getByRole('button',{name:'Create short-lived agent access',hidden:true}) as HTMLButtonElement;
  fireEvent.change(screen.getByLabelText('Agent name'),{target:{value:'My agent'}});expect(submit.disabled).toBe(true);
  const consent=screen.getByLabelText(/I authorize my chosen agent/);fireEvent.click(consent);expect(submit.disabled).toBe(false);
  fireEvent.click(screen.getByLabelText(/Also allow draft remediation/));expect(submit.disabled).toBe(true);
  fireEvent.click(consent);fireEvent.click(submit);
  await waitFor(()=>expect(screen.getByLabelText('New agent credential')).toBeTruthy());
  expect((screen.getByLabelText('New agent credential') as HTMLInputElement).type).toBe('password');
  expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
  expect(JSON.parse(String(fetch.mock.calls.find(([,i])=>i?.method==='POST')![1]!.body))).toMatchObject({confirm:true,proposals:true,snapshotId:'snapshot'});
  fireEvent.click(screen.getByRole('button',{name:'Hide credential',hidden:true}));expect(screen.queryByLabelText('New agent credential')).toBeNull();rendered.unmount();
});
it('resets human approval after editing a draft and only sends reviewed text',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{state:'accepted'}:{...view,proposals:[{id:'proposal',name:'Agent',note:'Untrusted draft note.',state:'pending'}]}));vi.stubGlobal('fetch',fetch);
  render(<AgentAccessControls streamId="stream" snapshotId="snapshot"/>);await screen.findByText(view.notice);
  const accept=screen.getByRole('button',{name:'Accept reviewed note',hidden:true}) as HTMLButtonElement;expect(accept.disabled).toBe(true);
  const confirm=screen.getByLabelText(/I reviewed this text/);fireEvent.click(confirm);expect(accept.disabled).toBe(false);
  fireEvent.change(screen.getByLabelText('Review draft from Agent'),{target:{value:'A person checked this investigation note.'}});expect(accept.disabled).toBe(true);
  fireEvent.click(confirm);fireEvent.click(accept);
  await waitFor(()=>expect(fetch.mock.calls.some(([,i])=>i?.method==='POST')).toBe(true));
  expect(JSON.parse(String(fetch.mock.calls.find(([,i])=>i?.method==='POST')![1]!.body))).toMatchObject({action:'review',accept:true,confirm:true,reviewedNote:'A person checked this investigation note.'});
});
